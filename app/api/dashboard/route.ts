import { NextRequest, NextResponse } from "next/server";
import { getStudents, getAttendance } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const levelFilter = searchParams.get("level"); // 'kindergarten' | 'primary' | 'secondary' or 'all'/null

    let students = await getStudents();
    let attendance = await getAttendance();

    // Apply division level filter if specified and not "all"
    if (levelFilter && levelFilter !== "all") {
      students = students.filter(s => s.level === levelFilter);
      const studentIds = new Set(students.map(s => s.id));
      attendance = attendance.filter(log => studentIds.has(log.studentId));
    }

    const totalStudents = students.length;
    const studentMap = new Map(students.map(s => [s.id, s]));

    // 1. Calculate checked-in today (unique students scanned today)
    const todayStart = startOfDay(new Date());
    const todayLogs = attendance.filter((log) => {
      const logDate = new Date(log.timestamp);
      return logDate >= todayStart;
    });

    const uniquePresentToday = new Set(todayLogs.map((log) => log.studentId));
    const presentToday = uniquePresentToday.size;

    // Calculate how many were late today (unique students who have a 'late' check-in status today)
    const studentStatusMap = new Map<string, string>();
    todayLogs.forEach((log) => {
      if (log.status === "late") {
        studentStatusMap.set(log.studentId, "late");
      } else if (!studentStatusMap.has(log.studentId)) {
        studentStatusMap.set(log.studentId, log.status || "present");
      }
    });

    let lateToday = 0;
    studentStatusMap.forEach((status) => {
      if (status === "late") {
        lateToday++;
      }
    });

    // 2. Calculate average attendance rate
    const attendanceRate = totalStudents > 0 
      ? parseFloat(((presentToday / totalStudents) * 100).toFixed(1))
      : 0;

    // 3. Generate 7-day trend data (rates for last 7 days)
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
        const student = studentMap.get(log.studentId);
        return {
          id: log.id,
          studentId: log.studentId,
          name: log.studentName,
          email: log.studentEmail,
          time: logDate.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " น.",
          confidence: log.confidence,
          classroom: log.classroom || student?.classroom || "",
          status: log.status || "present",
        };
      });

    return NextResponse.json({
      totalStudents,
      presentToday,
      lateToday,
      attendanceRate,
      trendData,
      recentScans,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
