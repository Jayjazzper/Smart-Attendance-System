import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, role, passcode, newUsername, newPassword } = body;

    if (!email || !role || !passcode || !newUsername || !newPassword) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง" },
        { status: 400 }
      );
    }

    if (role !== "admin" && role !== "teacher") {
      return NextResponse.json(
        { error: "บทบาทผู้ใช้งานไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    const teachers = settings.teachers || [];

    // 1. Verify Passcode
    if (role === "admin") {
      const correctAdminPasscode = settings.adminPasscode || "1234";
      if (passcode !== correctAdminPasscode) {
        return NextResponse.json(
          { error: "รหัสผ่านสถาบัน (Admin Passcode) ไม่ถูกต้อง" },
          { status: 401 }
        );
      }
    } else {
      const correctTeacherPasscode = settings.teacherPasscode || "1234";
      if (passcode !== correctTeacherPasscode) {
        return NextResponse.json(
          { error: "รหัสผ่านสถาบัน (Teacher Passcode) ไม่ถูกต้อง" },
          { status: 401 }
        );
      }
    }

    // 2. Find teacher/admin by registered email and matching role
    const userIndex = teachers.findIndex(
      (t) => 
        t.email.trim().toLowerCase() === email.trim().toLowerCase() && 
        t.role === role
    );

    if (userIndex === -1) {
      return NextResponse.json(
        { 
          error: `ไม่พบประพัติการลงทะเบียนสำหรับอีเมลนี้ในกลุ่มผู้ใช้ (${
            role === "admin" ? "ผู้ดูแลระบบ" : "ครูประจำชั้น"
          })` 
        },
        { status: 404 }
      );
    }

    // 3. Prevent duplicate username with *other* users (excluding themselves)
    const usernameExists = teachers.some(
      (t, idx) => 
        idx !== userIndex && 
        t.username.trim().toLowerCase() === newUsername.trim().toLowerCase()
    );

    if (usernameExists) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้นี้ถูกใช้งานโดยบัญชีอื่นแล้ว กรุณาใช้ชื่ออื่น" },
        { status: 400 }
      );
    }

    // 4. Perform update and hash new password
    teachers[userIndex].username = newUsername.trim();
    teachers[userIndex].passwordHash = hashPassword(newPassword);

    settings.teachers = teachers;

    const success = await saveSettings(settings);
    if (!success) {
      return NextResponse.json(
        { error: "ไม่สามารถบันทึกข้อมูลรหัสผ่านใหม่ลงฐานข้อมูลได้" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "รีเซ็ตบัญชีและตั้งค่ารหัสผ่านใหม่สำเร็จแล้ว สามารถล็อกอินได้ทันที"
    });
  } catch (error) {
    console.error("POST /api/auth/reset-account error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
