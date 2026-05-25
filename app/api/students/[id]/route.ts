import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession } from "@/lib/auth";
import { getStudents, updateStudent, deleteStudent } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studentId } = await params;
    const students = await getStudents();
    const student = students.find((s) => s.id === studentId);

    if (!student) {
      return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียนรหัสนี้" }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (error) {
    console.error("GET /api/students/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studentId } = await params;
    const body = await req.json();
    const { name, email, classroom, level, parentLineId } = body;

    if (!name || !email || !classroom || !level) {
      return NextResponse.json({ error: "กรุณาระบุชื่อ อีเมล ระดับชั้น และห้องเรียน" }, { status: 400 });
    }

    // 1. Fetch current student to verify ownership
    const students = await getStudents();
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียนที่จะแก้ไข" }, { status: 404 });
    }

    // 2. Validate session & permissions
    const cookieStore = await cookies();
    const token = cookieStore.get("teacher_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
    }
    const user = decryptSession(token);
    if (!user) {
      return NextResponse.json({ error: "เซสชันไม่ถูกต้องหรือหมดอายุ" }, { status: 401 });
    }

    if (user.role !== "admin") {
      // Teacher must own the student's current classroom
      const hasCurrentAccess = user.classrooms && user.classrooms.includes(student.classroom || "");
      if (!hasCurrentAccess) {
        return NextResponse.json({ error: "คุณไม่มีสิทธิ์จัดการข้อมูลนักเรียนในห้องเรียนนี้" }, { status: 403 });
      }

      // Teacher must also own the new classroom they are moving the student to
      const hasNewAccess = user.classrooms && user.classrooms.includes(classroom.trim());
      if (!hasNewAccess) {
        return NextResponse.json({ error: "คุณไม่มีสิทธิ์ย้ายนักเรียนไปยังห้องเรียนที่คุณไม่ได้ดูแล" }, { status: 403 });
      }
    }

    const success = await updateStudent(
      studentId,
      name.trim(),
      email.trim(),
      classroom.trim(),
      level.trim() as 'kindergarten' | 'primary' | 'secondary',
      parentLineId ? parentLineId.trim() : undefined
    );
    if (!success) {
      return NextResponse.json({ error: "ไม่สามารถอัปเดตข้อมูลนักเรียนได้" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/students/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studentId } = await params;

    // 1. Fetch current student to verify ownership
    const students = await getStudents();
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียนที่ต้องการลบ" }, { status: 404 });
    }

    // 2. Validate session & permissions
    const cookieStore = await cookies();
    const token = cookieStore.get("teacher_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
    }
    const user = decryptSession(token);
    if (!user) {
      return NextResponse.json({ error: "เซสชันไม่ถูกต้องหรือหมดอายุ" }, { status: 401 });
    }

    if (user.role !== "admin") {
      // Teacher must own the student's classroom
      const hasAccess = user.classrooms && user.classrooms.includes(student.classroom || "");
      if (!hasAccess) {
        return NextResponse.json({ error: "คุณไม่มีสิทธิ์จัดการข้อมูลนักเรียนในห้องเรียนนี้" }, { status: 403 });
      }
    }

    const success = await deleteStudent(studentId);
    if (!success) {
      return NextResponse.json({ error: "ไม่สามารถลบข้อมูลนักเรียนได้" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "ลบประวัตินักเรียนและประวัติเข้าเรียนสำเร็จ" });
  } catch (error) {
    console.error("DELETE /api/students/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
