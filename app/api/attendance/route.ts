import { NextRequest, NextResponse } from "next/server";
import { getStudents, getAttendance, saveAttendance } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const attendance = await getAttendance();
    return NextResponse.json({ attendance });
  } catch (error) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, confidence, status, classroom, timestamp } = body;

    if (!studentId || confidence === undefined) {
      return NextResponse.json(
        { error: "กรุณาส่งรหัสนักเรียนและรหัสความน่าเชื่อถือใบหน้า" },
        { status: 400 }
      );
    }

    // 1. Fetch student info to get details (Name, Email, Classroom) to duplicate inside log
    const students = await getStudents();
    const student = students.find((s) => s.id === studentId);

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียนรหัสนี้ในฐานข้อมูลระบบ" },
        { status: 404 }
      );
    }

    const recordClassroom = classroom || student.classroom || "";
    const recordStatus = status || "present";

    // 2. Save log record (using mutex in db.ts)
    const newRecord = await saveAttendance({
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      confidence: parseFloat(confidence),
      classroom: recordClassroom,
      status: recordStatus as 'present' | 'late' | 'absent' | 'leave',
      timestamp: timestamp,
    });

    if (!newRecord) {
      return NextResponse.json(
        { error: "เกิดข้อผิดพลาดในการบันทึกประวัติการสแกนใบหน้า" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, record: newRecord }, { status: 201 });
  } catch (error) {
    console.error("POST /api/attendance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
