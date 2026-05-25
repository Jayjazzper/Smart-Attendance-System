import { NextRequest, NextResponse } from "next/server";
import { updateLeaveRequestStatus, getLeaveRequests, getStudents, getSettings } from "@/lib/db";
import { LeaveRequest } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json(
        { error: "สถานะไม่ถูกต้อง (ต้องเป็น approved หรือ rejected)" },
        { status: 400 }
      );
    }

    // 1. Fetch leave request details before update
    const leaves = await getLeaveRequests();
    const leaveReq = leaves.find((l) => l.id === id);

    if (!leaveReq) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลคำร้องขอลาในระบบ" },
        { status: 404 }
      );
    }

    // 2. Perform database update
    const success = await updateLeaveRequestStatus(id, status);
    if (!success) {
      return NextResponse.json(
        { error: "ไม่สามารถอัปเดตข้อมูลสถานะใบลาได้" },
        { status: 500 }
      );
    }

    // 3. Trigger LINE Notifications asynchronously
    triggerLeaveUpdateNotification(leaveReq, status).catch((err) => {
      console.error("Error triggering leave status notification:", err);
    });

    return NextResponse.json({ success: true, message: `อัปเดตสถานะใบลาสำเร็จ` });
  } catch (error) {
    console.error("POST /api/leaves/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Support PUT as fallback
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}

// Background notification worker
async function triggerLeaveUpdateNotification(leaveReq: LeaveRequest, status: 'approved' | 'rejected') {
  try {
    // Load student and settings
    const [students, settings] = await Promise.all([
      getStudents(),
      getSettings()
    ]);

    const student = students.find((s) => s.id === leaveReq.studentId);
    const parentLineId = student?.parentLineId || "";
    const classroomName = leaveReq.classroom || "";
    const classSettings = settings.classrooms?.[classroomName];
    const classLineToken = classSettings?.lineToken || "";
    const lineChannelAccessToken = settings.lineChannelAccessToken || "";

    const typeMap = {
      sick: "ลาป่วย 🤒",
      personal: "ลากิจ 💼",
      other: "ลาอื่นๆ ✉️",
    };
    const typeText = typeMap[leaveReq.type as keyof typeof typeMap] || leaveReq.type;

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

    const startStr = formatThaiDate(leaveReq.startDate);
    const endStr = formatThaiDate(leaveReq.endDate);

    const statusText = status === "approved" ? "✅ อนุมัติการลาแล้ว" : "❌ ปฏิเสธการอนุมัติ";

    // A. Send LINE OA Push to parent if they have parentLineId
    let parentNotified = false;
    if (parentLineId && lineChannelAccessToken) {
      let parentMessage = "";
      if (status === "approved") {
        parentMessage = `🔔 แจ้งเตือนสถานะใบลาเรียน\n👤 นักเรียน: ${leaveReq.studentName}\nผลการพิจารณา: ✅ ได้รับการอนุมัติการลา\n📅 ตั้งแต่วันที่: ${startStr}\n📅 ถึงวันที่: ${endStr}\n📌 ประเภทการลา: ${typeText}\n\nระบบได้บันทึกสถานะการลาเข้าระบบเช็คชื่อเรียบร้อยแล้วค่ะ`;
      } else {
        parentMessage = `🔔 แจ้งเตือนสถานะใบลาเรียน\n👤 นักเรียน: ${leaveReq.studentName}\nผลการพิจารณา: ❌ ไม่ได้รับการอนุมัติการลา\n📅 ตั้งแต่วันที่: ${startStr}\n📅 ถึงวันที่: ${endStr}\n📌 ประเภทการลา: ${typeText}\n\nกรุณาติดต่อคุณครูประจำชั้นเพื่อสอบถามรายละเอียดเพิ่มเติมค่ะ`;
      }

      try {
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lineChannelAccessToken}`
          },
          body: JSON.stringify({
            to: parentLineId,
            messages: [{ type: "text", text: parentMessage }]
          })
        });
        parentNotified = res.ok;
        if (!parentNotified) {
          console.warn("LINE OA Push failed with status:", res.status);
        }
      } catch (pushErr) {
        console.error("Error sending LINE OA Push to parent:", pushErr);
      }
    }

    // B. Send LINE Notify to classroom group
    // For approved: always send.
    // For rejected: send if parent wasn't notified (fallback), or optionally also send to keep group informed.
    const shouldSendNotify = status === "approved" || !parentNotified;

    if (shouldSendNotify && classLineToken) {
      let notifyMessage = "";
      if (status === "approved") {
        notifyMessage = `\n📢 แจ้งผลการอนุมัติใบลาเรียน\n👤 นักเรียน: ${leaveReq.studentName}\n🏫 ห้องเรียน: ${classroomName}\n📅 วันที่: ${startStr} ถึง ${endStr}\n📌 ประเภทการลา: ${typeText}\nผลการพิจารณา: ✅ ได้รับการอนุมัติเรียบร้อยแล้ว`;
      } else {
        notifyMessage = `\n📢 แจ้งผลการปฏิเสธใบลาเรียน\n👤 นักเรียน: ${leaveReq.studentName}\n🏫 ห้องเรียน: ${classroomName}\n📅 วันที่: ${startStr} ถึง ${endStr}\nผลการพิจารณา: ❌ ไม่ได้รับการอนุมัติ\nกรุณาให้ผู้ปกครองติดต่อคุณครูประจำชั้นเพื่อสอบถามรายละเอียดเพิ่มเติมครับ`;
      }

      try {
        await fetch("https://notify-api.line.me/api/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Bearer ${classLineToken}`
          },
          body: new URLSearchParams({ message: notifyMessage }).toString()
        });
      } catch (notifyErr) {
        console.error("Error sending LINE Notify for leave update:", notifyErr);
      }
    }
  } catch (err) {
    console.error("Error in triggerLeaveUpdateNotification worker:", err);
  }
}

