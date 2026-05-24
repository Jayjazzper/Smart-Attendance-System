import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    // Otherwise, it's a settings save request
    const success = await saveSettings(body);
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
