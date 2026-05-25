import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/db";
import { verifyPassword, encryptSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    
    if (!username || !password) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" },
        { status: 400 }
      );
    }
    
    const settings = await getSettings();
    const teachers = settings.teachers || [];
    
    const teacher = teachers.find(
      (t) => t.username.toLowerCase() === username.toLowerCase()
    );
    
    if (!teacher || !verifyPassword(password, teacher.passwordHash)) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }
    
    // Session payload to store in token
    const sessionData = {
      username: teacher.username,
      name: teacher.name,
      role: teacher.role,
      classrooms: teacher.classrooms,
    };
    
    const token = encryptSession(sessionData);
    
    // Set HTTP-only session cookie
    const cookieStore = await cookies();
    cookieStore.set("teacher_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    
    return NextResponse.json({ success: true, user: sessionData });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
