import { NextResponse } from "next/server";
import { getStudents, getAttendance } from "@/lib/db";
import { startOfDay, subDays, isSameDay, format } from "date-fns";
import { th } from "date-fns/locale";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await getStudents();
    const attendance = await getAttendance();

    const totalStudents = students.length;

    // 1. Calculate checked-in today (unique students scanned today)
    const todayStart = startOfDay(new Date());
    const todayLogs = attendance.filter((log) => {
      const logDate = new Date(log.timestamp);
      return logDate >= todayStart;
    });

    const uniquePresentToday = new Set(todayLogs.map((log) => log.studentId));
    const presentToday = uniquePresentToday.size;

    // 2. Calculate average attendance rate
    // Let's assume average rate based on overall student checks today
    const attendanceRate = totalStudents > 0 
      ? parseFloat(((presentToday / totalStudents) * 100).toFixed(1))
      : 0;

    // 3. Generate 7-day trend data (rates for last 7 days)
    // Days representation in Thai
    const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสฯ", "ศุกร์", "เสาร์"];
    
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date);
      const nextDayStart = subDays(dayStart, -1);
      
      const dayLogs = attendance.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate >= dayStart && logDate < nextDayStart;
      });

      const uniquePresent = new Set(dayLogs.map((log) => log.studentId)).size;
      const rate = totalStudents > 0 
        ? Math.round((uniquePresent / totalStudents) * 100) 
        : 0;

      // Thai day string
      const dayName = THAI_DAYS[date.getDay()];

      trendData.push({
        day: dayName,
        rate: rate,
      });
    }

    // 4. Fetch the 10 most recent check-in logs
    const recentScans = [...attendance]
      .reverse() // show latest first
      .slice(0, 10)
      .map((log) => {
        const logDate = new Date(log.timestamp);
        return {
          id: log.id,
          studentId: log.studentId,
          name: log.studentName,
          email: log.studentEmail,
          time: logDate.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          confidence: log.confidence,
        };
      });

    return NextResponse.json({
      totalStudents,
      presentToday,
      attendanceRate,
      trendData,
      recentScans,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
