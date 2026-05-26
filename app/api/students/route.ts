import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession } from "@/lib/auth";
import { getStudents, saveStudent } from "@/lib/db";
import { Student } from "@/lib/types";

// Prevent Next.js from caching GET requests, ensuring we get real-time JSON data
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await getStudents();
    return NextResponse.json({ students });
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, email, faceDescriptor, consentGiven, classroom, level, parentLineId, avatarUrl } = body;

    // Validate request body
    if (!id || !name || !email || !faceDescriptor || !consentGiven || !classroom || !level) {
      return NextResponse.json(
        { error: "ข้อมูลนักเรียนไม่ครบถ้วน หรือไม่ได้รับความยินยอม PDPA" },
        { status: 400 }
      );
    }

    // Enforce classroom limits if locked in a teacher session
    const cookieStore = await cookies();
    const token = cookieStore.get("teacher_session")?.value;
    if (token) {
      const user = decryptSession(token);
      if (user && user.role !== "admin") {
        const hasAccess = user.classrooms && user.classrooms.includes(classroom.trim());
        if (!hasAccess) {
          return NextResponse.json(
            { error: `ระบบถูกล็อกเพื่อใช้งานสำหรับครูประจำชั้นห้อง ${user.classrooms.join(", ")} เท่านั้น คุณไม่สามารถลงทะเบียนนักเรียนห้อง ${classroom} ได้` },
            { status: 403 }
          );
        }
      }
    }

    const isValidDescriptor = 
      Array.isArray(faceDescriptor) && (
        faceDescriptor.length === 128 || (
          faceDescriptor.length > 0 && 
          faceDescriptor.every((d: any) => Array.isArray(d) && d.length === 128)
        )
      );

    if (!isValidDescriptor) {
      return NextResponse.json(
        { error: "Face descriptor ต้องเป็นอาร์เรย์ตัวเลขขนาด 128 มิติ หรือชุดของเวกเตอร์ 128 มิติ" },
        { status: 400 }
      );
    }

    const newStudent: Student = {
      id: id.trim(),
      name: name.trim(),
      email: email.trim(),
      faceDescriptor,
      consentGiven: !!consentGiven,
      registeredAt: new Date().toISOString(),
      classroom: classroom.trim(),
      level: level.trim() as 'kindergarten' | 'primary' | 'secondary',
      parentLineId: parentLineId ? parentLineId.trim() : undefined,
      avatarUrl: avatarUrl ? avatarUrl.trim() : undefined,
    };

    const success = await saveStudent(newStudent);
    if (!success) {
      return NextResponse.json(
        { error: "รหัสนักเรียนนี้ได้รับการลงทะเบียนแล้ว" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, student: newStudent }, { status: 201 });
  } catch (error) {
    console.error("POST /api/students error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
