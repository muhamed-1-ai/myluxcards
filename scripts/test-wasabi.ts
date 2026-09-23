import * as dotenv from "dotenv";
import { WasabiStorageProvider, sanitizeStorageKey } from "../src/lib/storage";

dotenv.config();

async function runWasabiDiagnostic() {
  console.log("==========================================");
  console.log("ZAPPIT Wasabi S3 Storage Diagnostic Tool");
  console.log("==========================================");

  const provider = new WasabiStorageProvider();

  const bucket = process.env.WASABI_BUCKET || "";
  const region = process.env.WASABI_REGION || "us-east-1";
  const endpoint = process.env.WASABI_ENDPOINT || "https://s3.wasabisys.com";

  console.log(`Bucket:          ${bucket}`);
  console.log(`Region:          ${region}`);
  console.log(`Endpoint:        ${endpoint}`);

  if (!provider.isConfigured()) {
    console.log("\n⚠️  WASABI STORAGE IS NOT CONFIGURED IN ENVIRONMENT.");
    console.log("Required variables: WASABI_ACCESS_KEY, WASABI_SECRET_KEY, WASABI_BUCKET");
    process.exit(1);
  }

  const testTimestamp = Date.now();
  const rawPrefix = (process.env.WASABI_ROOT_PREFIX || "").trim().replace(/^\/+|\/+$/g, "");
  const rootPrefix = rawPrefix ? `${rawPrefix}/` : "";
  const testKey = sanitizeStorageKey(`${rootPrefix}admin/diagnostics/wasabi-test-${testTimestamp}.txt`);
  console.log(`Test object key: ${testKey}`);
  console.log("------------------------------------------");

  const testBuffer = Buffer.from(`ZAPPIT Wasabi S3 storage connection test payload at ${new Date().toISOString()}`);

  let putSuccess = false;
  let headSuccess = false;
  let getSuccess = false;
  let deleteSuccess = false;
  let failureReason = "";

  // 1. PUT OBJECT TEST
  try {
    const uploadRes = await provider.uploadObject({
      buffer: testBuffer,
      key: testKey,
      contentType: "text/plain",
      isPublic: true,
    });
    if (uploadRes.key) {
      putSuccess = true;
    }
  } catch (err: any) {
    failureReason = `PUT failed: ${err?.message || err}`;
  }

  // 2. HEAD OBJECT TEST
  if (putSuccess) {
    try {
      const meta = await provider.headObject(testKey);
      if (meta && meta.size > 0) {
        headSuccess = true;
      }
    } catch (err: any) {
      failureReason += ` | HEAD failed: ${err?.message || err}`;
    }
  }

  // 3. GET OBJECT TEST
  if (putSuccess) {
    try {
      const data = await provider.getObject(testKey);
      if (data && data.length > 0) {
        getSuccess = true;
      }
    } catch (err: any) {
      failureReason += ` | GET failed: ${err?.message || err}`;
    }
  }

  let publicHttpGetSuccess = false;
  if (putSuccess) {
    try {
      const publicUrl = provider.getPublicUrl(testKey);
      console.log(`Public URL:       ${publicUrl}`);
      const res = await fetch(publicUrl);
      console.log(`Public HTTP fetch status: ${res.status}`);

      const presignedDownloadUrl = await provider.createPresignedDownloadUrl(testKey, 3600);
      console.log(`Presigned Download URL generated successfully.`);
      const presignedRes = await fetch(presignedDownloadUrl);
      console.log(`Presigned HTTP fetch status: ${presignedRes.status}`);

      if (presignedRes.ok) {
        publicHttpGetSuccess = true;
      } else {
        failureReason += ` | Presigned HTTP GET returned ${presignedRes.status}`;
      }
    } catch (err: any) {
      failureReason += ` | Presigned HTTP GET error: ${err?.message || err}`;
    }
  }

  // 4. DELETE OBJECT TEST
  if (putSuccess) {
    try {
      deleteSuccess = await provider.deleteObject(testKey);
    } catch (err: any) {
      failureReason += ` | DELETE failed: ${err?.message || err}`;
    }
  }

  console.log(`PUT:    ${putSuccess ? "SUCCESS" : "FAILED"}`);
  console.log(`HEAD:   ${headSuccess ? "SUCCESS" : "FAILED"}`);
  console.log(`GET:    ${getSuccess ? "SUCCESS" : "FAILED"}`);
  console.log(`DELETE: ${deleteSuccess ? "SUCCESS" : "FAILED"}`);
  console.log("==========================================");

  if (!putSuccess || !getSuccess) {
    console.error("\n❌ WASABI STORAGE DIAGNOSTIC FAILED!");
    if (failureReason) {
      console.error(`Details: ${failureReason}`);
    }
    console.error("\nRequired IAM Permissions on Wasabi Console for Access Key:");
    console.error("  - s3:PutObject");
    console.error("  - s3:GetObject");
    console.error("  - s3:HeadObject (s3:GetObject)");
    console.error("  - s3:DeleteObject");
    console.error("  - s3:ListBucket");
    console.error(`Target Bucket ARN: arn:aws:s3:::${bucket} and arn:aws:s3:::${bucket}/*`);
    process.exit(1);
  }

  console.log("🎉 ALL WASABI STORAGE DIAGNOSTIC TESTS PASSED SUCCESSFULLY!");
}

runWasabiDiagnostic();
