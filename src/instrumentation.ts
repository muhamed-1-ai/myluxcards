export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startReminderScheduler } = await import("./lib/followUpScheduler");
      startReminderScheduler();
    } catch (err) {
      console.error("[Instrumentation] Failed to initialize reminder scheduler:", err);
    }
  }
}
