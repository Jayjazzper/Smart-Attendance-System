import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/db";
import { decryptSession } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    
    // Check admin passcode verification cookie
    const adminAuthorized = cookieStore.get("admin_authorized")?.value;
    if (adminAuthorized === "true") {
      return NextResponse.json({ authorized: true, role: "admin" });
    }
    
    // Check teacher session
    const teacherSession = cookieStore.get("teacher_session")?.value;
    if (teacherSession) {
      const user = decryptSession(teacherSession);
      if (user) {
        return NextResponse.json({ authorized: true, role: user.role });
      }
    }
    
    return NextResponse.json({ authorized: false });
  } catch (error) {
    console.error("GET verify-passcode error:", error);
    return NextResponse.json({ authorized: false });
  }
}


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
