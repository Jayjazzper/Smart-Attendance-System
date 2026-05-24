import { NextRequest, NextResponse } from "next/server";
import { updateLeaveRequestStatus } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json(
        { error: "สถานะไม่ถูกต้อง (ต้องเป็น approved หรือ rejected)" },
        { status: 400 }
      );
    }

    const success = await updateLeaveRequestStatus(id, status);
    if (success) {
      return NextResponse.json({ success: true, message: `อัปเดตสถานะใบลาสำเร็จ` });
    } else {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลคำร้องขอลา หรือ ไม่สามารถอัปเดตข้อมูลได้" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("POST /api/leaves/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Support PUT as fallback
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}
