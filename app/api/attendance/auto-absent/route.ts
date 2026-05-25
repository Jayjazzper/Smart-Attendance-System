import { NextRequest, NextResponse } from "next/server";
import { getStudents, getAttendance, saveAttendance } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classroom, level, date } = body;

    // Determine target date (default to today)
    const targetDate = date ? new Date(date) : new Date();
    const todayStart = startOfDay(targetDate);
    const todayEnd = endOfDay(targetDate);

    // 1. Fetch all students
    let students = await getStudents();
    if (classroom) {
      students = students.filter(s => s.classroom === classroom);
    } else if (level && level !== "all") {
      students = students.filter(s => s.level === level);
    }

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "ไม่มีรายชื่อนักเรียนตามเงื่อนไขที่เลือก"
      });
    }

    // 2. Fetch attendance logs for the target day
    const attendance = await getAttendance();
    const todayLogs = attendance.filter((log) => {
      const logDate = new Date(log.timestamp);
      return log.status !== "checked_out" && logDate >= todayStart && logDate <= todayEnd;
    });

    // Create a Set of student IDs who have checked in today
    const checkedInStudentIds = new Set(todayLogs.map(log => log.studentId));

    let count = 0;
    const createdLogs = [];

    // 3. For each missing student, record as "absent" (ขาด)
    for (const student of students) {
      if (!checkedInStudentIds.has(student.id)) {
        // Save absent record
        const record = await saveAttendance({
          studentId: student.id,
          studentName: student.name,
          studentEmail: student.email,
          confidence: 100,
          classroom: student.classroom || "",
          status: "absent",
        });
        if (record) {
          // If in Google Sheets mode, the saveAttendance returns record with new id & timestamp.
          // Otherwise, local db returns with local details.
          createdLogs.push(record);
          count++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      count,
      message: `บันทึกสถานะขาดเรียนอัตโนมัติสำเร็จ ${count} คน`,
      records: createdLogs
    });
  } catch (error) {
    console.error("POST /api/attendance/auto-absent error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
