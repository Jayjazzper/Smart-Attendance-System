import { NextRequest, NextResponse } from "next/server";
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

    const success = await updateStudent(
      studentId,
      name.trim(),
      email.trim(),
      classroom.trim(),
      level.trim() as 'kindergarten' | 'primary' | 'secondary',
      parentLineId ? parentLineId.trim() : undefined
    );
    if (!success) {
      return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียนที่จะแก้ไข" }, { status: 404 });
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
    const success = await deleteStudent(studentId);

    if (!success) {
      return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียนที่ต้องการลบ" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "ลบประวัตินักเรียนและประวัติเข้าเรียนสำเร็จ" });
  } catch (error) {
    console.error("DELETE /api/students/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
