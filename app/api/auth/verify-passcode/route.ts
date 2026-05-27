import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { passcode, type } = await req.json();

    if (!passcode || !type) {
      return NextResponse.json(
        { error: "กรุณาระบุรหัสผ่านและประเภทการตรวจสอบ" },
        { status: 400 }
      );
    }

    const settings = await getSettings();

    if (type === "admin") {
      const correctPasscode = settings.adminPasscode || "1234";
      if (passcode === correctPasscode) {
        const cookieStore = await cookies();
        cookieStore.set("admin_authorized", "true", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24, // 24 hours
          path: "/",
        });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: "รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง" },
        { status: 401 }
      );
    } else if (type === "teacher") {
      const correctPasscode = settings.teacherPasscode || "1234";
      if (passcode === correctPasscode) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: "รหัสผ่านครูประจำชั้นไม่ถูกต้อง" },
        { status: 401 }
      );
    } else {
      return NextResponse.json(
        { error: "ประเภทการตรวจสอบไม่ถูกต้อง" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("verify-passcode error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
