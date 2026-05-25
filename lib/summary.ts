import { getStudents, getAttendance, getSettings } from "./db";
import { startOfDay, endOfDay } from "date-fns";

export async function sendDailySummaryForClassroom(classroom: string, date?: Date): Promise<{ 
  success: boolean; 
  errorMsg?: string; 
  stats?: {
    total: number;
    present: number;
    late: number;
    leave: number;
    absent: number;
  };
  messageText?: string;
}> {
  try {
    const targetDate = date || new Date();
    const todayStart = startOfDay(targetDate);
    const todayEnd = endOfDay(targetDate);

    // 1. Fetch students for this classroom
    const students = await getStudents();
    const classStudents = students.filter(s => s.classroom === classroom);

    if (classStudents.length === 0) {
      return { success: false, errorMsg: `ไม่พบข้อมูลนักเรียนของห้องเรียน ${classroom} ในระบบ` };
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
    const absentList: string[] = [];

    classStudents.forEach(student => {
      const log = latestLogsMap.get(student.id);
      if (log) {
        if (log.status === "present") presentList.push(student.name);
        else if (log.status === "late") lateList.push(student.name);
        else if (log.status === "leave") leaveList.push(student.name);
        else if (log.status === "absent") absentList.push(student.name);
      } else {
        absentList.push(student.name);
      }
    });

    const dateStr = targetDate.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    });

    // 5. Construct report message
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

    const stats = {
      total: classStudents.length,
      present: presentList.length,
      late: lateList.length,
      leave: leaveList.length,
      absent: absentList.length
    };

    // 6. Send to LINE Notify
    const settings = await getSettings();
    const classSettings = settings.classrooms?.[classroom];
    const token = classSettings?.lineToken;

    if (!token) {
      return { 
        success: false, 
        errorMsg: "ห้องเรียนนี้ไม่ได้กำหนดรหัส LINE Notify Token ในหน้าตั้งค่า",
        stats,
        messageText: message
      };
    }

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
        return { 
          success: true,
          stats,
          messageText: message
        };
      } else {
        const errorText = await res.text();
        return { 
          success: false, 
          errorMsg: `LINE Notify API returned error: ${res.status} - ${errorText}`,
          stats,
          messageText: message
        };
      }
    } catch (err: any) {
      return {
        success: false,
        errorMsg: `LINE Notify network error: ${err.message}`,
        stats,
        messageText: message
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      errorMsg: error.message || "เกิดข้อผิดพลาดภายในระบบสรุปข้อมูล" 
    };
  }
}
