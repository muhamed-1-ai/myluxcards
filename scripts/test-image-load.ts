import * as dotenv from "dotenv";
import { WasabiStorageProvider, sanitizeStorageKey } from "../src/lib/storage";

dotenv.config();

async function testImageLifecycle() {
  console.log("=== Testing Image Lifecycle & Presigned Redirect ===");
  const provider = new WasabiStorageProvider();
  const testKey = sanitizeStorageKey(`Luxcards App Data/images/uploads/test/test-image-${Date.now()}.png`);
  
  // Create a tiny 1x1 PNG buffer
  const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

  console.log("1. Uploading PNG buffer to Wasabi:", testKey);
  const uploadRes = await provider.uploadObject({
    buffer: tinyPng,
    key: testKey,
    contentType: "image/png",
    isPublic: true,
  });
  console.log("Upload result:", uploadRes);

  console.log("2. Generating presigned download URL for key:", testKey);
  const presignedUrl = await provider.createPresignedDownloadUrl(testKey, 86400);
  console.log("Presigned URL:", presignedUrl);

  console.log("3. Fetching object bytes via getObject...");
  const objectBytes = await provider.getObject(testKey);
  console.log("Object byte length:", objectBytes?.length, "Is Uint8Array:", objectBytes instanceof Uint8Array);

  console.log("4. Cleanup test object...");
  await provider.deleteObject(testKey);
  console.log("Cleanup complete!");
}

testImageLifecycle().catch((err) => console.error("Error:", err));
