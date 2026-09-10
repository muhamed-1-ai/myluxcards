import * as dotenv from "dotenv";
import { WasabiStorageProvider, sanitizeStorageKey } from "../src/lib/storage";

dotenv.config();

async function runWasabiDiagnostic() {
  console.log("==========================================");
  console.log("ZAPPIT Wasabi S3 Storage Diagnostic Tool");
  console.log("==========================================");

  const provider = new WasabiStorageProvider();

  if (!provider.isConfigured()) {
    console.log("⚠️  WASABI STORAGE IS NOT CONFIGURED IN ENVIRONMENT.");
    console.log("Required variables:");
    console.log("  - WASABI_ACCESS_KEY");
    console.log("  - WASABI_SECRET_KEY");
    console.log("  - WASABI_BUCKET");
    console.log("Optional variables:");
    console.log("  - WASABI_REGION (default: ap-southeast-1)");
    console.log("  - WASABI_ENDPOINT (default: https://s3.wasabisys.com)");
    process.exit(1);
  }

  console.log(`Bucket:   ${process.env.WASABI_BUCKET}`);
  console.log(`Region:   ${process.env.WASABI_REGION || "ap-southeast-1"}`);
  console.log(`Endpoint: ${process.env.WASABI_ENDPOINT || "https://s3.wasabisys.com"}`);

  const testKey = sanitizeStorageKey(`admin/test-diagnostic-${Date.now()}.txt`);
  const testBuffer = Buffer.from("ZAPPIT Wasabi S3 storage connection test successful.");

  try {
    console.log("\n1. Testing Upload (PutObject)...");
    const uploadRes = await provider.uploadObject({
      buffer: testBuffer,
      key: testKey,
      contentType: "text/plain",
      isPublic: true,
    });
    console.log("   ✅ Upload succeeded!");
    console.log("   Canonical URL:", uploadRes.publicUrl);

    console.log("\n2. Testing Head / Object Exists (HeadObject)...");
    const exists = await provider.objectExists(testKey);
    if (exists) {
      console.log("   ✅ Object exists check succeeded!");
    } else {
      console.error("   ❌ Object exists check failed!");
    }

    console.log("\n3. Testing Presigned Upload URL (S3 Request Presigner)...");
    const presigned = await provider.createPresignedUploadUrl({
      key: `admin/presigned-test-${Date.now()}.txt`,
      contentType: "text/plain",
      expiresInSeconds: 300,
    });
    console.log("   ✅ Presigned upload URL generated successfully!");
    console.log("   Presigned PUT URL (first 80 chars):", presigned.uploadUrl.substring(0, 80) + "...");

    console.log("\n4. Testing Delete (DeleteObject)...");
    const deleted = await provider.deleteObject(testKey);
    if (deleted) {
      console.log("   ✅ Delete succeeded!");
    } else {
      console.error("   ❌ Delete failed!");
    }

    console.log("\n==========================================");
    console.log("🎉 ALL WASABI STORAGE DIAGNOSTIC TESTS PASSED!");
    console.log("==========================================");
  } catch (err: any) {
    console.error("\n❌ WASABI STORAGE DIAGNOSTIC FAILED:", err?.message || err);
    process.exit(1);
  }
}

runWasabiDiagnostic();
