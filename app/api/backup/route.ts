import { NextRequest, NextResponse } from "next/server";
import { getStudents, saveAllStudents } from "@/lib/db";
import { Student } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await getStudents();
    return NextResponse.json({ students });
  } catch (error) {
    console.error("GET /api/backup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { students, overwrite } = body;

    if (!Array.isArray(students)) {
      return NextResponse.json({ error: "ข้อมูลนำเข้าไม่ถูกต้อง (ต้องเป็นอาร์เรย์ของนักเรียน)" }, { status: 400 });
    }

    // Basic structural validation of the imported data to verify it is student records
    for (const student of students) {
      if (!student.id || !student.name || !student.email || !Array.isArray(student.faceDescriptor)) {
        return NextResponse.json(
          { error: `ข้อมูลนักเรียนรายคนไม่ถูกต้อง (ID: ${student.id || "ไม่มี"}, Name: ${student.name || "ไม่มี"})` },
          { status: 400 }
        );
      }
    }

    let finalStudents: Student[] = [];

    if (overwrite) {
      finalStudents = students;
    } else {
      // Merge: keep current students and append only non-duplicate student IDs
      const currentStudents = await getStudents();
      const currentIds = new Set(currentStudents.map(s => s.id));
      
      finalStudents = [...currentStudents];
      for (const student of students) {
        if (!currentIds.has(student.id)) {
          finalStudents.push(student);
          currentIds.add(student.id);
        }
      }
    }

    const success = await saveAllStudents(finalStudents);
    if (!success) {
      return NextResponse.json({ error: "ไม่สามารถบันทึกข้อมูลนักเรียนลงดิสก์ได้" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `นำเข้าข้อมูลนักเรียนสำเร็จ ${finalStudents.length} คน`,
      count: finalStudents.length
    });
  } catch (error) {
    console.error("POST /api/backup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
