import { NextRequest, NextResponse } from "next/server";
import { getStudents, getAttendance } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const levelFilter = searchParams.get("level"); // 'kindergarten' | 'primary' | 'secondary' or 'all'/null
    const classroomFilter = searchParams.get("classroom"); // e.g. 'ป.4/2'

    let students = await getStudents();
    let attendance = await getAttendance();

    // Apply classroom filter if specified
    if (classroomFilter) {
      students = students.filter(s => s.classroom === classroomFilter);
      const studentIds = new Set(students.map(s => s.id));
      attendance = attendance.filter(log => studentIds.has(log.studentId));
    } else if (levelFilter && levelFilter !== "all") {
      // Apply division level filter if specified and not "all"
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

    // 4. Calculate classroom leaderboard (attendance rate today)
    const classrooms = Array.from(new Set(students.map(s => s.classroom).filter(Boolean))) as string[];
    const leaderboard = classrooms.map(cls => {
      const classStudents = students.filter(s => s.classroom === cls);
      const total = classStudents.length;
      
      const classStudentIds = new Set(classStudents.map(s => s.id));
      const classTodayLogs = todayLogs.filter(log => classStudentIds.has(log.studentId));
      
      const uniquePresent = new Set(
        classTodayLogs
          .filter(log => log.status === "present" || log.status === "late")
          .map(log => log.studentId)
      ).size;

      const uniqueLate = new Set(
        classTodayLogs
          .filter(log => log.status === "late")
          .map(log => log.studentId)
      ).size;

      const uniqueLeave = new Set(
        classTodayLogs
          .filter(log => log.status === "leave")
          .map(log => log.studentId)
      ).size;

      const rate = total > 0 ? parseFloat(((uniquePresent / total) * 100).toFixed(1)) : 0;
      
      return {
        classroom: cls,
        total,
        present: uniquePresent,
        late: uniqueLate,
        leave: uniqueLeave,
        rate
      };
    }).sort((a, b) => b.rate - a.rate);

    // 5. Calculate peak arrival times distribution
    const peakBrackets = {
      "ก่อน 07:30": 0,
      "07:30 - 07:45": 0,
      "07:45 - 08:00": 0,
      "หลัง 08:00": 0
    };

    const studentEarliestScan = new Map<string, Date>();
    todayLogs.forEach(log => {
      if (log.status === "leave" || log.status === "absent") return;
      const logDate = new Date(log.timestamp);
      const existing = studentEarliestScan.get(log.studentId);
      if (!existing || logDate < existing) {
        studentEarliestScan.set(log.studentId, logDate);
      }
    });

    studentEarliestScan.forEach((logDate) => {
      const timeStr = logDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Bangkok"
      });

      if (timeStr < "07:30") {
        peakBrackets["ก่อน 07:30"]++;
      } else if (timeStr < "07:45") {
        peakBrackets["07:30 - 07:45"]++;
      } else if (timeStr < "08:00") {
        peakBrackets["07:45 - 08:00"]++;
      } else {
        peakBrackets["หลัง 08:00"]++;
      }
    });

    const peakCheckinTimes = Object.entries(peakBrackets).map(([name, count]) => ({
      name,
      count
    }));

    // 6. Fetch the 10 most recent check-in logs
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
      leaderboard,
      peakCheckinTimes,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
