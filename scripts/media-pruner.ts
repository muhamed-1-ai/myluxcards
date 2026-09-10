import pg from "pg";
import * as dotenv from "dotenv";
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Extracts normalized storage identifier/key from DB media references
 */
function extractStorageIdentifier(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null;
  const trimmed = urlOrKey.trim();
  if (!trimmed) return null;

  const bucket = process.env.WASABI_BUCKET;
  if (bucket && trimmed.includes(`/${bucket}/`)) {
    const parts = trimmed.split(`/${bucket}/`);
    if (parts.length > 1) return parts[1].replace(/^\/+/, "");
  }

  // Supabase URL pattern: /storage/v1/object/public/card-media/...
  if (trimmed.includes("/storage/v1/object/public/card-media/")) {
    const parts = trimmed.split("/storage/v1/object/public/card-media/");
    if (parts.length > 1) return parts[1].replace(/^\/+/, "");
  }

  // Pure key reference
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
    return trimmed;
  }

  return trimmed;
}

async function main() {
  console.log(`Starting ZAPPIT Media Pruner...${DRY_RUN ? " [DRY RUN MODE]" : ""}`);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Error: No DATABASE_URL found.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    // 1. Build complete media reference map across ALL database fields
    console.log("Building complete media reference map from database...");

    const referencesRes = await pool.query<{ url: string }>(`
      SELECT DISTINCT url FROM (
        SELECT profile->>'avatarUrl' as url FROM digital_cards
        UNION ALL
        SELECT profile->>'coverUrl' FROM digital_cards
        UNION ALL
        SELECT profile->>'logoUrl' FROM digital_cards
        UNION ALL
        SELECT profile->>'brochureUrl' FROM digital_cards
        UNION ALL
        SELECT profile->>'resumeUrl' FROM digital_cards
        UNION ALL
        SELECT image_url FROM card_profile_products
        UNION ALL
        SELECT image_url FROM card_profile_services
        UNION ALL
        SELECT image_url FROM card_profile_portfolio
        UNION ALL
        SELECT image_url FROM card_profile_gallery
        UNION ALL
        SELECT video_url FROM card_profile_videos
        UNION ALL
        SELECT file_url FROM card_profile_documents
        UNION ALL
        SELECT image_url FROM card_profile_achievements
        UNION ALL
        SELECT credential_url FROM card_profile_certifications
        UNION ALL
        SELECT certificate_url FROM card_profile_certifications
        UNION ALL
        SELECT image FROM users
        UNION ALL
        SELECT profile_image FROM leads
      ) AS all_urls
      WHERE url IS NOT NULL AND url != ''
    `);

    const referencedRawUrls = new Set<string>();
    const referencedKeys = new Set<string>();

    for (const row of referencesRes.rows) {
      if (row.url) {
        referencedRawUrls.add(row.url);
        const key = extractStorageIdentifier(row.url);
        if (key) referencedKeys.add(key);
      }
    }

    console.log(
      `Found ${referencedRawUrls.size} raw DB media references (${referencedKeys.size} normalized storage keys).`
    );

    // 2. Scan Wasabi Storage if configured
    const wasabiAccessKey = process.env.WASABI_ACCESS_KEY;
    const wasabiSecretKey = process.env.WASABI_SECRET_KEY;
    const wasabiBucket = process.env.WASABI_BUCKET;
    const wasabiRegion = process.env.WASABI_REGION || "ap-southeast-1";
    const wasabiEndpoint = process.env.WASABI_ENDPOINT || "https://s3.wasabisys.com";

    if (wasabiAccessKey && wasabiSecretKey && wasabiBucket) {
      console.log(`Scanning Wasabi bucket '${wasabiBucket}'...`);
      const s3 = new S3Client({
        region: wasabiRegion,
        endpoint: wasabiEndpoint,
        credentials: { accessKeyId: wasabiAccessKey, secretAccessKey: wasabiSecretKey },
        forcePathStyle: true,
      });

      let continuationToken: string | undefined = undefined;
      let totalObjectsScanned = 0;
      let potentialOrphansCount = 0;

      do {
        const listCmd: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: wasabiBucket,
          ContinuationToken: continuationToken,
        });

        const listRes = await s3.send(listCmd);
        const contents = listRes.Contents || [];
        totalObjectsScanned += contents.length;

        for (const obj of contents) {
          if (!obj.Key) continue;
          const key = obj.Key;
          const fullPublicUrl = `${wasabiEndpoint.replace(/\/+$/, "")}/${wasabiBucket}/${key}`;

          const isReferenced =
            referencedKeys.has(key) ||
            referencedRawUrls.has(fullPublicUrl) ||
            referencedRawUrls.has(key);

          if (isReferenced) {
            // Protected! If marked as DETECTED in orphaned_media, mark as RESTORED
            if (!DRY_RUN) {
              await pool.query(
                `UPDATE orphaned_media SET status = 'RESTORED', last_verified_at = NOW()
                 WHERE bucket = $1 AND storage_path = $2 AND status != 'DELETED'`,
                [wasabiBucket, key]
              );
            }
          } else {
            potentialOrphansCount++;
            if (!DRY_RUN) {
              await pool.query(
                `INSERT INTO orphaned_media (bucket, storage_path, prune_eligible_at, status, detection_reason)
                 VALUES ($1, $2, NOW() + INTERVAL '7 days', 'DETECTED', 'No references found in database')
                 ON CONFLICT (bucket, storage_path) DO UPDATE SET
                   status = CASE WHEN orphaned_media.status = 'RESTORED' THEN 'DETECTED' ELSE orphaned_media.status END,
                   prune_eligible_at = CASE WHEN orphaned_media.status = 'RESTORED' THEN NOW() + INTERVAL '7 days' ELSE orphaned_media.prune_eligible_at END,
                   last_verified_at = NOW()`,
                [wasabiBucket, key]
              );
            }
          }
        }

        continuationToken = listRes.NextContinuationToken;
      } while (continuationToken);

      console.log(`Scanned ${totalObjectsScanned} Wasabi objects. Potential orphans flagged: ${potentialOrphansCount}`);

      // 3. Pruning: Recheck and delete ELIGIBLE orphans after 7-day grace period
      console.log("Checking for eligible orphans to prune...");
      const eligibleOrphans = await pool.query<{ id: string; bucket: string; storage_path: string }>(
        `SELECT id, bucket, storage_path FROM orphaned_media WHERE status = 'DETECTED' AND prune_eligible_at <= NOW()`
      );

      let deletedCount = 0;
      for (const orphan of eligibleOrphans.rows) {
        const fullPublicUrl = `${wasabiEndpoint.replace(/\/+$/, "")}/${orphan.bucket}/${orphan.storage_path}`;
        const isReReferenced =
          referencedKeys.has(orphan.storage_path) ||
          referencedRawUrls.has(fullPublicUrl) ||
          referencedRawUrls.has(orphan.storage_path);

        if (isReReferenced) {
          console.log(`Orphan ${orphan.storage_path} was re-referenced! Restoring...`);
          if (!DRY_RUN) {
            await pool.query(`UPDATE orphaned_media SET status = 'RESTORED', last_verified_at = NOW() WHERE id = $1`, [orphan.id]);
          }
        } else {
          if (!DRY_RUN) {
            try {
              await s3.send(new DeleteObjectCommand({ Bucket: orphan.bucket, Key: orphan.storage_path }));
              await pool.query(
                `UPDATE orphaned_media SET status = 'DELETED', deleted_at = NOW(), last_verified_at = NOW() WHERE id = $1`,
                [orphan.id]
              );
              deletedCount++;
            } catch (delErr) {
              console.error(`Failed to delete orphaned Wasabi object ${orphan.storage_path}:`, delErr);
            }
          } else {
            deletedCount++;
          }
        }
      }

      console.log(`Orphaned objects pruned / eligible for deletion: ${deletedCount}`);
    } else {
      console.log("Wasabi storage credentials not found. Skipping Wasabi live scan.");
    }
  } catch (err) {
    console.error("Media pruner encountered an error:", err);
  } finally {
    await pool.end();
  }
}

main();
