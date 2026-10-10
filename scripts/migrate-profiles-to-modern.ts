import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config";

interface ProfileMigrationOptions {
  dryRun: boolean;
  batchSize?: number;
}

interface ProfileRecord {
  id: string;
  slug: string;
  owner_id: string;
  profile: Record<string, unknown> | null;
  updated_at: string;
}

interface MigrationReport {
  totalInspected: number;
  alreadyApproved: number;
  requiringConversion: number;
  missingOrInvalidSettings: number;
  unresolvedRecords: number;
  convertedCount: number;
  records: Array<{
    id: string;
    slug: string;
    status: "SKIPPED_APPROVED" | "CONVERTED" | "CONVERTED_INVALID" | "UNRESOLVED";
    reason: string;
    before?: {
      format: unknown;
      background: unknown;
      accent: unknown;
      text: unknown;
    };
    after?: {
      format: string;
      background: string;
      accent: string;
      text: string;
    };
  }>;
}

const APPROVED_DEFAULT_BACKGROUND = "#050B14";
const APPROVED_DEFAULT_ACCENT = "#0066FF";
const APPROVED_DEFAULT_TEXT = "#ffffff";
const RETIRED_GOLD_COLORS = new Set(["#FFAE00", "#D4AF37", "#C5A059"]);

export async function runProfileMigration(options: ProfileMigrationOptions): Promise<MigrationReport> {
  const pool = new Pool({ ...databaseConfig(), max: 1, application_name: "profile-design-migrator" });
  const client = await pool.connect();

  const report: MigrationReport = {
    totalInspected: 0,
    alreadyApproved: 0,
    requiringConversion: 0,
    missingOrInvalidSettings: 0,
    unresolvedRecords: 0,
    convertedCount: 0,
    records: [],
  };

  try {
    const { rows } = await client.query<ProfileRecord>(
      `SELECT id, slug, owner_id, profile, updated_at FROM digital_cards ORDER BY created_at ASC`
    );

    report.totalInspected = rows.length;

    for (const row of rows) {
      const rawProfile = row.profile && typeof row.profile === "object" && !Array.isArray(row.profile)
        ? row.profile
        : {};

      const currentFormat = String(rawProfile.profileFormat || "").toLowerCase().trim();
      const currentBg = typeof rawProfile.profileBackground === "string" ? rawProfile.profileBackground.trim() : "";
      const currentAccent = typeof rawProfile.profileAccent === "string" ? rawProfile.profileAccent.trim() : "";
      const currentText = typeof rawProfile.profileText === "string" ? rawProfile.profileText.trim() : "";

      const isFormatMissingOrInvalid = !currentFormat || (currentFormat !== "modern" && currentFormat !== "standard");
      const isOldStandard = currentFormat === "standard";
      const isApprovedModern = currentFormat === "modern";

      if (isApprovedModern) {
        report.alreadyApproved++;
        report.records.push({
          id: row.id,
          slug: row.slug,
          status: "SKIPPED_APPROVED",
          reason: "Profile is already using the approved modern design template.",
          before: {
            format: currentFormat,
            background: currentBg,
            accent: currentAccent,
            text: currentText,
          },
        });
        continue;
      }

      if (isOldStandard || isFormatMissingOrInvalid) {
        if (isFormatMissingOrInvalid) {
          report.missingOrInvalidSettings++;
        } else {
          report.requiringConversion++;
        }

        // Determine resolved presentation fields while preserving user content
        // If background was missing, empty, white, or retired gold, use approved navy default
        const resolvedBg = (!currentBg || RETIRED_GOLD_COLORS.has(currentBg.toUpperCase()) || currentBg.toUpperCase() === "#FFFFFF")
          ? APPROVED_DEFAULT_BACKGROUND
          : currentBg;

        // If accent was missing, empty, or retired gold, use approved blue default
        const resolvedAccent = (!currentAccent || RETIRED_GOLD_COLORS.has(currentAccent.toUpperCase()))
          ? APPROVED_DEFAULT_ACCENT
          : currentAccent;

        const resolvedText = currentText || APPROVED_DEFAULT_TEXT;

        const beforePresentation = {
          format: currentFormat || null,
          background: currentBg || null,
          accent: currentAccent || null,
          text: currentText || null,
        };

        const afterPresentation = {
          format: "modern",
          background: resolvedBg,
          accent: resolvedAccent,
          text: resolvedText,
        };

        if (!options.dryRun) {
          // Bounded transactional update that re-checks eligibility
          await client.query("BEGIN");
          try {
            const updateRes = await client.query(
              `UPDATE digital_cards
               SET profile = jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       profile,
                       '{_legacy_presentation_backup}',
                       jsonb_build_object(
                         'profileFormat', COALESCE(profile->>'profileFormat', 'standard'),
                         'profileBackground', profile->>'profileBackground',
                         'profileAccent', profile->>'profileAccent',
                         'profileText', profile->>'profileText',
                         'migratedAt', now()
                       ),
                       true
                     ),
                     '{profileFormat}',
                     '"modern"',
                     true
                   ),
                   '{profileBackground}',
                   to_jsonb($1::text),
                   true
                 ),
                 '{profileAccent}',
                 to_jsonb($2::text),
                 true
               )
               WHERE id = $3 AND (profile->>'profileFormat' IS NULL OR LOWER(profile->>'profileFormat') <> 'modern')`,
              [resolvedBg, resolvedAccent, row.id]
            );

            if ((updateRes.rowCount ?? 0) > 0) {
              report.convertedCount++;
            }
            await client.query("COMMIT");
          } catch (err) {
            await client.query("ROLLBACK");
            report.unresolvedRecords++;
            report.records.push({
              id: row.id,
              slug: row.slug,
              status: "UNRESOLVED",
              reason: `Update transaction failed: ${err instanceof Error ? err.message : String(err)}`,
            });
            continue;
          }
        } else {
          report.convertedCount++;
        }

        report.records.push({
          id: row.id,
          slug: row.slug,
          status: isFormatMissingOrInvalid ? "CONVERTED_INVALID" : "CONVERTED",
          reason: isFormatMissingOrInvalid
            ? "Missing/invalid format resolved and presentation repaired to approved modern design."
            : "Retired standard profile converted to approved modern design with previous settings backed up.",
          before: beforePresentation,
          after: afterPresentation,
        });
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  return report;
}

// CLI Execution
if (require.main === module || process.argv[1]?.endsWith("migrate-profiles-to-modern.ts")) {
  const isApply = process.argv.includes("--apply");
  const isDryRun = !isApply || process.argv.includes("--dry-run");

  console.log(`\n======================================================`);
  console.log(`  ZAPPIT PROFILE DESIGN MIGRATION`);
  console.log(`  Mode: ${isDryRun ? "DRY-RUN (No writes applied)" : "APPLY (Writing changes to database)"}`);
  console.log(`======================================================\n`);

  runProfileMigration({ dryRun: isDryRun })
    .then((report) => {
      console.log(`MIGRATION SUMMARY:`);
      console.log(`------------------------------------------------------`);
      console.log(`Total Profiles Inspected:        ${report.totalInspected}`);
      console.log(`Already Approved (Skipped):      ${report.alreadyApproved}`);
      console.log(`Requiring Conversion:            ${report.requiringConversion}`);
      console.log(`Missing/Invalid Settings Repaired: ${report.missingOrInvalidSettings}`);
      console.log(`Profiles Converted:              ${report.convertedCount}`);
      console.log(`Unresolved Records:              ${report.unresolvedRecords}`);
      console.log(`------------------------------------------------------\n`);

      console.log(`DETAILED CARD AUDIT:`);
      for (const rec of report.records) {
        console.log(`- [${rec.status}] ${rec.slug} (${rec.id})`);
        console.log(`  Reason: ${rec.reason}`);
        if (rec.before && rec.after) {
          console.log(`  Before: format=${rec.before.format}, bg=${rec.before.background}, accent=${rec.before.accent}`);
          console.log(`  After:  format=${rec.after.format}, bg=${rec.after.background}, accent=${rec.after.accent}`);
        }
      }
      console.log(`\n======================================================\n`);
    })
    .catch((err) => {
      console.error("Migration fatal error:", err);
      process.exitCode = 1;
    });
}
