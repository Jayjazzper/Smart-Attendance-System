import { NextRequest, NextResponse } from "next/server";
import { getStudents, getAttendance, getSettings } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classroom, date, sendToLine = true } = body;

    if (!classroom) {
      return NextResponse.json({ error: "กรุณาระบุห้องเรียน (classroom)" }, { status: 400 });
    }

    // Determine target date (default to today)
    const targetDate = date ? new Date(date) : new Date();
    const todayStart = startOfDay(targetDate);
    const todayEnd = endOfDay(targetDate);

    // 1. Fetch students for this classroom
    const students = await getStudents();
    const classStudents = students.filter(s => s.classroom === classroom);

    if (classStudents.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `ไม่พบข้อมูลนักเรียนของห้องเรียน ${classroom} ในระบบ` 
      }, { status: 404 });
    }

    // 2. Fetch attendance logs for this classroom today
    const attendance = await getAttendance();
    const classLogs = attendance.filter(log => {
      const logDate = new Date(log.timestamp);
      return log.classroom === classroom && logDate >= todayStart && logDate <= todayEnd;
    });

    // 3. Map student ID to latest attendance log
    const latestLogsMap = new Map<string, any>();
    classLogs.forEach(log => {
      const existing = latestLogsMap.get(log.studentId);
      if (!existing || new Date(log.timestamp) > new Date(existing.timestamp)) {
        latestLogsMap.set(log.studentId, log);
      }
    });

    // 4. Categorize students
    const presentList: string[] = [];
    const lateList: string[] = [];
    const leaveList: string[] = [];
    const absentList: string[] = []; // those who checked in as absent or no check-in at all

    classStudents.forEach(student => {
      const log = latestLogsMap.get(student.id);
      if (log) {
        if (log.status === "present") presentList.push(student.name);
        else if (log.status === "late") lateList.push(student.name);
        else if (log.status === "leave") leaveList.push(student.name);
        else if (log.status === "absent") absentList.push(student.name);
      } else {
        // No log means absent/no check-in
        absentList.push(student.name);
      }
    });

    // 5. Format Date string for Thai
    const dateStr = targetDate.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    });

    // 6. Construct report message
    const message = `
📢 สรุปสถิติเข้าเรียนประจำวัน
🏫 ห้องเรียน: ${classroom}
📅 วันที่: ${dateStr}

📊 สรุปภาพรวม:
• นักเรียนทั้งหมด: ${classStudents.length} คน
• มาเรียนปกติ: ${presentList.length} คน ✓
• มาเรียนสาย: ${lateList.length} คน ⚠️
• ลาเรียน: ${leaveList.length} คน ✉️
• ขาดเรียน/ยังไม่เช็ค: ${absentList.length} คน ❌

📌 รายชื่อแยกกลุ่มสถานะ:
⚠️ มาเรียนสาย: ${lateList.length > 0 ? lateList.join(", ") : "ไม่มี"}
✉️ ลาเรียน: ${leaveList.length > 0 ? leaveList.join(", ") : "ไม่มี"}
❌ ขาดเรียน/ยังไม่เช็ค: ${absentList.length > 0 ? absentList.join(", ") : "ไม่มี"}`;

    // 7. Send to LINE Notify if active
    let lineSent = false;
    let errorMsg = "";

    if (sendToLine) {
      const settings = await getSettings();
      const classSettings = settings.classrooms?.[classroom];
      const token = classSettings?.lineToken;

      if (token) {
        try {
          const res = await fetch("https://notify-api.line.me/api/notify", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Bearer ${token}`
            },
            body: new URLSearchParams({ message }).toString()
          });

          if (res.ok) {
            lineSent = true;
          } else {
            const errorText = await res.text();
            errorMsg = `LINE Notify API returned error: ${res.status} - ${errorText}`;
          }
        } catch (err: any) {
          errorMsg = `LINE Notify network error: ${err.message}`;
        }
      } else {
        errorMsg = "ห้องเรียนนี้ไม่ได้กำหนดรหัส LINE Notify Token ในหน้าตั้งค่า";
      }
    }

    return NextResponse.json({
      success: true,
      classroom,
      date: dateStr,
      stats: {
        total: classStudents.length,
        present: presentList.length,
        late: lateList.length,
        leave: leaveList.length,
        absent: absentList.length
      },
      messageText: message,
      lineSent,
      errorMsg: errorMsg || undefined
    });

  } catch (error: any) {
    console.error("POST /api/attendance/summary error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
