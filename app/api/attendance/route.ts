import { NextRequest, NextResponse } from "next/server";
import { getStudents, getAttendance, saveAttendance, getSettings } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const attendance = await getAttendance();
    return NextResponse.json({ attendance });
  } catch (error) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, confidence, status, classroom, timestamp } = body;

    if (!studentId || confidence === undefined) {
      return NextResponse.json(
        { error: "กรุณาส่งรหัสนักเรียนและรหัสความน่าเชื่อถือใบหน้า" },
        { status: 400 }
      );
    }

    // 1. Fetch student info to get details (Name, Email, Classroom) to duplicate inside log
    const students = await getStudents();
    const student = students.find((s) => s.id === studentId);

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียนรหัสนี้ในฐานข้อมูลระบบ" },
        { status: 404 }
      );
    }

    const recordClassroom = classroom || student.classroom || "";
    const recordStatus = status || "present";

    // 2. Save log record (using mutex in db.ts)
    const newRecord = await saveAttendance({
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      confidence: parseFloat(confidence),
      classroom: recordClassroom,
      status: recordStatus as 'present' | 'late' | 'absent' | 'leave',
      timestamp: timestamp,
    });

    if (!newRecord) {
      return NextResponse.json(
        { error: "เกิดข้อผิดพลาดในการบันทึกประวัติการสแกนใบหน้า" },
        { status: 500 }
      );
    }

    // 3. Optional: Trigger LINE Notify and LINE OA Push if token/credentials exist
    try {
      const settings = await getSettings();
      
      // LINE Notify (Group-level broadcast)
      const classSettings = settings.classrooms?.[recordClassroom];
      if (classSettings?.lineToken) {
        triggerLineNotification(classSettings.lineToken, newRecord).catch(err => {
          console.error("Async LINE notify error:", err);
        });
      }

      // LINE OA Push (Personal direct message)
      if (settings.lineChannelAccessToken && student.parentLineId) {
        triggerLineOAPushNotification(settings.lineChannelAccessToken, student.parentLineId, newRecord).catch(err => {
          console.error("Async LINE OA Push error:", err);
        });
      }
    } catch (err) {
      console.error("Error triggering LINE notification:", err);
    }

    return NextResponse.json({ success: true, record: newRecord }, { status: 201 });
  } catch (error) {
    console.error("POST /api/attendance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function triggerLineNotification(token: string, record: any) {
  try {
    const statusMap = {
      present: "มาเรียนปกติ ✓",
      late: "มาเรียนสาย ⚠️",
      absent: "ขาดเรียน ❌",
      leave: "ลาเรียน ✉️",
    };
    const statusText = statusMap[record.status as keyof typeof statusMap] || record.status;
    const timestamp = record.timestamp ? new Date(record.timestamp) : new Date();
    
    const timeStr = timestamp.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    });
    const dateStr = timestamp.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    });

    const message = `\n📢 รายงานการเช็คชื่อเข้าเรียน\n👤 นักเรียน: ${record.studentName}\n🆔 รหัสประจำตัว: ${record.studentId}\n🏫 ห้องเรียน: ${record.classroom || "-"}\n📅 วันที่: ${dateStr}\n⏰ เวลา: ${timeStr} น.\n📌 สถานะ: ${statusText}`;

    await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${token}`
      },
      body: new URLSearchParams({ message }).toString()
    });
  } catch (error) {
    console.error("Error sending LINE Notify message:", error);
  }
}

async function triggerLineOAPushNotification(accessToken: string, toUserId: string, record: any) {
  try {
    const statusMap = {
      present: "มาเรียนปกติ ✓",
      late: "มาเรียนสาย ⚠️",
      absent: "ขาดเรียน ❌",
      leave: "ลาเรียน ✉️",
    };
    const statusText = statusMap[record.status as keyof typeof statusMap] || record.status;
    const timestamp = record.timestamp ? new Date(record.timestamp) : new Date();
    
    const timeStr = timestamp.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    });
    const dateStr = timestamp.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    });

    const message = `📢 รายงานการเช็คชื่อเรียนของบุตรหลาน\n👤 บุตรหลาน: ${record.studentName}\n🆔 รหัสประจำตัว: ${record.studentId}\n🏫 ห้องเรียน: ${record.classroom || "-"}\n📅 วันที่: ${dateStr}\n⏰ เวลา: ${timeStr} น.\n📌 สถานะ: ${statusText}`;

    const payload = {
      to: toUserId,
      messages: [
        {
          type: "text",
          text: message
        }
      ]
    };

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`LINE OA Push API failed with status ${res.status}:`, errorText);
    }
  } catch (error) {
    console.error("Error sending LINE OA Push message:", error);
  }
}
