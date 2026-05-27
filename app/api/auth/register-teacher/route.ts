import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveTeacher } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { Teacher } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, name, email, classrooms, teacherPasscode } = body;
    
    if (!username || !password || !name || !email || !teacherPasscode) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วนเพื่อสมัครสมาชิก" },
        { status: 400 }
      );
    }
    
    const settings = await getSettings();
    const correctPasscode = settings.teacherPasscode || "1234";
    
    if (teacherPasscode !== correctPasscode) {
      return NextResponse.json(
        { error: "รหัสผ่านผู้ใช้ระดับครูประจำชั้น (Teacher Passcode) ไม่ถูกต้อง" },
        { status: 401 }
      );
    }
    
    const newTeacher: Teacher = {
      username: username.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      name: name.trim(),
      email: email.trim(),
      classrooms: classrooms || [],
      role: "teacher", // Forced to teacher role for self-registration
      createdAt: new Date().toISOString(),
    };
    
    const success = await saveTeacher(newTeacher);
    if (!success) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้นี้ได้รับการลงทะเบียนแล้วในระบบ" },
        { status: 409 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Register teacher API error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการประมวลผลบนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
