import { NextRequest, NextResponse } from "next/server";
import { getLeaveRequests, saveLeaveRequest, getStudents } from "@/lib/db";
import { LeaveRequest } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leaves = await getLeaveRequests();
    return NextResponse.json({ leaves });
  } catch (error) {
    console.error("GET /api/leaves error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, startDate, endDate, type, reason } = body;

    if (!studentId || !startDate || !endDate || !type || !reason) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // Verify student exists and grab name/classroom
    const students = await getStudents();
    const student = students.find((s) => s.id === studentId);

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบรหัสนักเรียนนี้ในฐานข้อมูลระบบ" },
        { status: 404 }
      );
    }

    // Generate request
    const newRequest: LeaveRequest = {
      id: globalThis.crypto?.randomUUID() || Math.random().toString(36).substring(2, 11),
      studentId: student.id,
      studentName: student.name,
      classroom: student.classroom || "",
      startDate,
      endDate,
      type: type as 'sick' | 'personal' | 'other',
      reason,
      status: "pending",
      submittedAt: new Date().toISOString()
    };

    const success = await saveLeaveRequest(newRequest);
    if (success) {
      return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
    } else {
      return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกคำร้องขอลา" }, { status: 500 });
    }
  } catch (error) {
    console.error("POST /api/leaves error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
