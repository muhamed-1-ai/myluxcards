import { requireAdmin, safeError } from "@/lib/adminAuth";
import { getStorageProvider, isWasabiStorageConfigured } from "@/lib/storage";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isWasabiStorageConfigured()) {
      return Response.json(
        {
          status: "unconfigured",
          message: "Wasabi storage environment variables are missing (WASABI_ACCESS_KEY, WASABI_SECRET_KEY, WASABI_BUCKET).",
          provider: "None / Fallback Supabase",
          configured: false,
        },
        { status: 200 }
      );
    }

    const provider = getStorageProvider();
    const testKey = `health-check/test-${Date.now()}.txt`;
    const testContent = Buffer.from(`Wasabi health check at ${new Date().toISOString()}`);

    let writeOk = false;
    let readOk = false;
    let deleteOk = false;
    let errorDetail: string | null = null;

    try {
      // 1. Test Write
      const uploadRes = await provider.uploadObject({
        buffer: testContent,
        key: testKey,
        contentType: "text/plain",
        isPublic: false,
      });
      writeOk = Boolean(uploadRes.key);

      // 2. Test Read / Head
      const exists = await provider.objectExists(testKey);
      readOk = exists;

      // 3. Test Delete
      deleteOk = await provider.deleteObject(testKey);
    } catch (err: any) {
      errorDetail = err?.message || String(err);
      console.error("[Storage Health Check] Wasabi verification error:", err);
    }

    const allOk = writeOk && readOk && deleteOk;

    return Response.json({
      status: allOk ? "ok" : "degraded",
      configured: true,
      provider: provider.name,
      bucket: process.env.WASABI_BUCKET,
      region: process.env.WASABI_REGION || "ap-southeast-1",
      endpoint: process.env.WASABI_ENDPOINT || "https://s3.wasabisys.com",
      tests: {
        write: writeOk,
        read: readOk,
        delete: deleteOk,
      },
      error: errorDetail,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return safeError(error);
  }
}
