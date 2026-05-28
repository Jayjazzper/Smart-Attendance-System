import { NextRequest, NextResponse } from "next/server";
import { getLeaveRequests, saveLeaveRequest, getStudents, getSettings } from "@/lib/db";
import { LeaveRequest } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leaves = await getLeaveRequests();
    return NextResponse.json({ leaves });
  } catch (error) {
    console.error("GET /api/leaves error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, startDate, endDate, type, reason, contactEmail, contactLine, contactPhone, evidenceBase64, evidenceName, evidenceMimeType } = body;

    if (!studentId || !startDate || !endDate || !type || !reason) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // Verify student exists and grab name/classroom
    const students = await getStudents();
    const student = students.find((s) => s.id === studentId);

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบรหัสนักเรียนนี้ในฐานข้อมูลระบบ" },
        { status: 404 }
      );
    }

    // Generate request
    const newRequest: LeaveRequest = {
      id: globalThis.crypto?.randomUUID() || Math.random().toString(36).substring(2, 11),
      studentId: student.id,
      studentName: student.name,
      classroom: student.classroom || "",
      startDate,
      endDate,
      type: type as 'sick' | 'personal' | 'other',
      reason,
      status: "pending",
      submittedAt: new Date().toISOString(),
      contactEmail: contactEmail || "",
      contactLine: contactLine || "",
      contactPhone: contactPhone || "",
      evidenceBase64: evidenceBase64 || "",
      evidenceName: evidenceName || "",
      evidenceMimeType: evidenceMimeType || ""
    };

    // Find teacher emails for this classroom to send email notifications
    const settings = await getSettings();
    const classroomName = student.classroom || "";
    const teacherEmails = (settings.teachers || [])
      .filter(t => (t.classrooms && t.classrooms.includes(classroomName)) || t.role === 'admin')
      .map(t => t.email)
      .filter(Boolean);
    const teacherEmailList = teacherEmails.join(",");
    const systemUrl = req.headers.get("origin") || "";

    const success = await saveLeaveRequest(newRequest, teacherEmailList, systemUrl);
    if (success) {
      // Trigger LINE Notify notification to classroom group
      try {
        const classSettings = settings.classrooms?.[classroomName];
        if (classSettings && classSettings.lineToken) {
          triggerLineLeaveNotification(classSettings.lineToken, newRequest).catch(err => {
            console.error("Error triggering leave LINE notification:", err);
          });
        }
      } catch (e) {
        console.error("Error getting settings for leave LINE notification:", e);
      }

      return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
    } else {
      return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกคำร้องขอลา" }, { status: 500 });
    }
  } catch (error) {
    console.error("POST /api/leaves error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function triggerLineLeaveNotification(token: string, record: LeaveRequest) {
  try {
    const typeMap = {
      sick: "ลาป่วย 🤒",
      personal: "ลากิจ 💼",
      other: "ลาอื่นๆ ✉️",
    };
    const typeText = typeMap[record.type as keyof typeof typeMap] || record.type;
    
    const formatThaiDate = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Bangkok",
        });
      } catch (e) {
        return dateStr;
      }
    };
    
    const startStr = formatThaiDate(record.startDate);
    const endStr = formatThaiDate(record.endDate);
    
    let contactInfo = "";
    if (record.contactEmail || record.contactLine || record.contactPhone || record.evidenceUrl) {
      contactInfo = `\n\n📞 ข้อมูลติดต่อและหลักฐาน:\n` +
                    (record.contactEmail ? `- อีเมล: ${record.contactEmail}\n` : "") +
                    (record.contactLine ? `- LINE ID: ${record.contactLine}\n` : "") +
                    (record.contactPhone ? `- โทรศัพท์: ${record.contactPhone}\n` : "") +
                    (record.evidenceUrl ? `- หลักฐานแนบ: ${record.evidenceUrl}\n` : "");
      contactInfo = contactInfo.trimEnd();
    }
    
    const message = `\n✉️ มีใบลาเรียนใหม่ของนักเรียนยื่นเข้ามา\n👤 นักเรียน: ${record.studentName}\n🆔 รหัสประจำตัว: ${record.studentId}\n🏫 ห้องเรียน: ${record.classroom || "-"}\n📅 ตั้งแต่วันที่: ${startStr}\n📅 ถึงวันที่: ${endStr}\n📌 ประเภทการลา: ${typeText}\n📝 เหตุผล: ${record.reason}${contactInfo}\n\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบสิทธิ์การอนุมัติครับ`;

    await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${token}`
      },
      body: new URLSearchParams({ message }).toString()
    });
  } catch (error) {
    console.error("Error sending LINE Notify for leave request:", error);
  }
}
