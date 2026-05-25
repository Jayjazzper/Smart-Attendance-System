// Prevent registering multiple intervals during Next.js hot reloads in development mode
const globalWithScheduler = global as typeof globalThis & {
  summarySchedulerActive?: boolean;
};

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (globalWithScheduler.summarySchedulerActive) {
      return;
    }
    globalWithScheduler.summarySchedulerActive = true;

    console.log("Smart Attendance System: Initializing Daily Summary Background Scheduler (running every minute)...");
    
    // We dynamically import database and summary helpers to avoid early import loading conflicts during Next.js boot
    const { getSettings, saveSettings, getStudents } = await import("./lib/db");
    const { sendDailySummaryForClassroom } = await import("./lib/summary");

    // Runs a background interval loop check every 60 seconds
    setInterval(async () => {
      try {
        const settings = await getSettings();
        if (!settings.enableAutoSummary) {
          return; // Automatic daily summaries are disabled
        }

        const summaryTime = settings.summaryTime || "08:30";
        const [targetHour, targetMinute] = summaryTime.split(":").map(Number);

        // Get current time in Bangkok (matching school timezone)
        const now = new Date();
        const bangkokTimeStr = now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Bangkok"
        });

        const [currentHour, currentMinute] = bangkokTimeStr.split(":").map(Number);

        if (currentHour === targetHour && currentMinute === targetMinute) {
          // Format date as YYYY-MM-DD in Bangkok timezone
          const todayDateStr = now.toLocaleDateString("en-ZA", {
            timeZone: "Asia/Bangkok",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }).replace(/\//g, "-");

          const studentsList = await getStudents();
          const classroomsList = Array.from(new Set(studentsList.map(s => s.classroom).filter(Boolean))) as string[];
          
          const lastSentMap = settings.lastSummarySentDate || {};
          let settingsUpdated = false;

          for (const classroom of classroomsList) {
            const classSettings = settings.classrooms?.[classroom];
            if (!classSettings?.lineToken) {
              continue; // Skip if classroom has no LINE Notify token configured
            }

            const lastSent = lastSentMap[classroom];
            if (lastSent === todayDateStr) {
              continue; // Already successfully triggered/sent today
            }

            console.log(`[Scheduler] Triggering Auto Daily Summary for ${classroom} at ${summaryTime}...`);
            const result = await sendDailySummaryForClassroom(classroom, now);
            
            if (result.success) {
              console.log(`[Scheduler] Auto Daily Summary successfully sent for ${classroom}`);
            } else {
              console.warn(`[Scheduler] Failed to send summary for ${classroom}: ${result.errorMsg}`);
            }

            // Record as sent to prevent multiple executions in the same minute
            lastSentMap[classroom] = todayDateStr;
            settingsUpdated = true;
          }

          if (settingsUpdated) {
            settings.lastSummarySentDate = lastSentMap;
            await saveSettings(settings);
          }
        }
      } catch (error) {
        console.error("[Scheduler] Error in daily summary check loop:", error);
      }
    }, 60000); // 1-minute tick interval
  }
}
