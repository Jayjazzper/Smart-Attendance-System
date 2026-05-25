import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession, hashPassword } from "@/lib/auth";
import { saveTeacher, updateTeacherAccount, deleteTeacher, getTeachers } from "@/lib/db";
import { Teacher } from "@/lib/types";

// Helper to verify admin role
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("teacher_session")?.value;
  if (!token) return false;
  const user = decryptSession(token);
  return user && user.role === "admin";
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "ไม่ได้รับอนุญาต (Admin only)" },
      { status: 403 }
    );
  }
  
  try {
    const list = await getTeachers();
    // Exclude password hash from list for safety
    const safeList = list.map(({ passwordHash, ...rest }) => rest);
    return NextResponse.json({ teachers: safeList });
  } catch (error) {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการโหลดบัญชีผู้ใช้ครู" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "ไม่ได้รับอนุญาต (Admin only)" },
      { status: 403 }
    );
  }
  
  try {
    const body = await req.json();
    const { username, password, name, email, classrooms, role } = body;
    
    if (!username || !password || !name || !email || !role) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบถ้วน" },
        { status: 400 }
      );
    }
    
    const newTeacher: Teacher = {
      username: username.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      name: name.trim(),
      email: email.trim(),
      classrooms: classrooms || [],
      role: role,
      createdAt: new Date().toISOString(),
    };
    
    const success = await saveTeacher(newTeacher);
    if (!success) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้นี้ได้รับการลงทะเบียนแล้ว" },
        { status: 409 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Create teacher error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างบัญชีครู" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "ไม่ได้รับอนุญาต (Admin only)" },
      { status: 403 }
    );
  }
  
  try {
    const body = await req.json();
    const { username, password, name, email, classrooms, role } = body;
    
    if (!username) {
      return NextResponse.json(
        { error: "ระบุชื่อผู้ใช้ที่ต้องการแก้ไข" },
        { status: 400 }
      );
    }
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim();
    if (classrooms !== undefined) updateData.classrooms = classrooms;
    if (role !== undefined) updateData.role = role;
    if (password) {
      updateData.passwordHash = hashPassword(password);
    }
    
    const success = await updateTeacherAccount(username, updateData);
    if (!success) {
      return NextResponse.json(
        { error: "ไม่พบบัญชีครูนี้ในระบบ" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update teacher error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตบัญชีครู" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "ไม่ได้รับอนุญาต (Admin only)" },
      { status: 403 }
    );
  }
  
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    
    if (!username) {
      return NextResponse.json(
        { error: "ระบุชื่อผู้ใช้ที่ต้องการลบ" },
        { status: 400 }
      );
    }
    
    // Prevent self-deletion if logged in as that admin
    const cookieStore = await cookies();
    const token = cookieStore.get("teacher_session")?.value;
    const user = decryptSession(token || "");
    if (user && user.username.toLowerCase() === username.toLowerCase()) {
      return NextResponse.json(
        { error: "ไม่สามารถลบบัญชีผู้ใช้ที่กำลังล็อกอินใช้งานอยู่ได้" },
        { status: 400 }
      );
    }
    
    const success = await deleteTeacher(username);
    if (!success) {
      return NextResponse.json(
        { error: "ไม่พบบัญชีครูนี้ในระบบ" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete teacher error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบบัญชีครู" },
      { status: 500 }
    );
  }
}
