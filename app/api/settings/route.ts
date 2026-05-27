import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import { isRequestAuthorized } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSettings();
    const authorized = await isRequestAuthorized();

    if (authorized) {
      return NextResponse.json(settings);
    }

    // Sanitize settings to prevent credential leakage
    const sanitizedClassrooms: any = {};
    if (settings.classrooms) {
      Object.keys(settings.classrooms).forEach((cls) => {
        sanitizedClassrooms[cls] = {}; // Strip classroom-specific LINE tokens but keep class keys
      });
    }

    const sanitizedSettings = {
      schoolName: settings.schoolName || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)",
      schoolDistrict: settings.schoolDistrict || "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1",
      schoolLogo: settings.schoolLogo || "",
      classrooms: sanitizedClassrooms,
      enableAutoSummary: settings.enableAutoSummary ?? false,
      summaryTime: settings.summaryTime || "08:30"
    };

    return NextResponse.json(sanitizedSettings);
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorized = await isRequestAuthorized();
    if (!authorized) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาตสำหรับการดำเนินการนี้ (Admin only)" },
        { status: 403 }
      );
    }

    const body = await req.json();
    
    // If it's a test notification request
    if (body.action === "testLine") {
      const { token } = body;
      if (!token) {
        return NextResponse.json({ error: "กรุณาระบุ LINE token" }, { status: 400 });
      }

      const message = "\n📢 ข้อความทดสอบเชื่อมต่อจากระบบเช็คชื่ออัจฉริยะ Smart Attendance System สำเร็จเรียบร้อยแล้ว!";
      const success = await sendLineNotify(token, message);
      if (success) {
        return NextResponse.json({ success: true, message: "ส่งข้อความทดสอบสำเร็จแล้ว" });
      } else {
        return NextResponse.json({ error: "ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบความถูกต้องของ Token" }, { status: 400 });
      }
    }

    // If it's a test line push notification request
    if (body.action === "testLinePush") {
      const { accessToken, testUserId } = body;
      if (!accessToken || !testUserId) {
        return NextResponse.json({ error: "กรุณาระบุ Channel Access Token และ User ID สำหรับทดสอบ" }, { status: 400 });
      }

      const message = "📢 ข้อความทดสอบเชื่อมต่อ LINE OA Push Notification จากระบบเช็คชื่ออัจฉริยะ Smart Attendance System สำเร็จแล้ว!";
      const success = await sendLinePush(accessToken, testUserId, message);
      if (success) {
        return NextResponse.json({ success: true, message: "ส่งข้อความทดสอบแบบ Push สำเร็จแล้ว" });
      } else {
        return NextResponse.json({ error: "ส่งข้อความ Push ไม่สำเร็จ กรุณาตรวจสอบ Token และ User ID" }, { status: 400 });
      }
    }

    // Otherwise, it's a settings save request
    const currentSettings = await getSettings();
    const updatedSettings = {
      ...currentSettings,
      classrooms: body.classrooms !== undefined ? body.classrooms : currentSettings.classrooms,
      lineChannelAccessToken: body.lineChannelAccessToken !== undefined ? body.lineChannelAccessToken : currentSettings.lineChannelAccessToken,
      teacherPasscode: body.teacherPasscode !== undefined ? body.teacherPasscode : currentSettings.teacherPasscode,
      adminPasscode: body.adminPasscode !== undefined ? body.adminPasscode : currentSettings.adminPasscode,
      schoolName: body.schoolName !== undefined ? body.schoolName : currentSettings.schoolName,
      schoolDistrict: body.schoolDistrict !== undefined ? body.schoolDistrict : currentSettings.schoolDistrict,
      schoolLogo: body.schoolLogo !== undefined ? body.schoolLogo : currentSettings.schoolLogo,
      enableAutoSummary: body.enableAutoSummary !== undefined ? body.enableAutoSummary : currentSettings.enableAutoSummary,
      summaryTime: body.summaryTime !== undefined ? body.summaryTime : currentSettings.summaryTime,
      // Always preserve teachers and last summary dates from DB to prevent accidental wipes
      teachers: currentSettings.teachers,
      lastSummarySentDate: currentSettings.lastSummarySentDate
    };

    const success = await saveSettings(updatedSettings);
    if (success) {
      return NextResponse.json({ success: true, message: "บันทึกการตั้งค่าสำเร็จ" });
    } else {
      return NextResponse.json({ error: "ไม่สามารถบันทึกการตั้งค่าได้" }, { status: 500 });
    }
  } catch (error) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function sendLineNotify(token: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${token}`
      },
      body: new URLSearchParams({ message }).toString()
    });
    return res.ok;
  } catch (error) {
    console.error("sendLineNotify error:", error);
    return false;
  }
}

async function sendLinePush(accessToken: string, toUserId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: toUserId,
        messages: [{ type: "text", text }]
      })
    });
    return res.ok;
  } catch (error) {
    console.error("sendLinePush error:", error);
    return false;
  }
}
