import { NextRequest, NextResponse } from "next/server";
import { sendDailySummaryForClassroom } from "@/lib/summary";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classroom, date, sendToLine = true } = body;

    if (!classroom) {
      return NextResponse.json({ error: "กรุณาระบุห้องเรียน (classroom)" }, { status: 400 });
    }

    const targetDate = date ? new Date(date) : new Date();
    
    // Call shared helper
    const result = await sendDailySummaryForClassroom(classroom, targetDate);

    if (result.success) {
      return NextResponse.json({
        success: true,
        classroom,
        date: targetDate.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Bangkok",
        }),
        stats: result.stats,
        messageText: result.messageText,
        lineSent: true
      });
    } else {
      return NextResponse.json({
        success: false,
        classroom,
        error: result.errorMsg || "ไม่สามารถส่งสรุปยอดได้",
        stats: result.stats,
        messageText: result.messageText,
        lineSent: false
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error("POST /api/attendance/summary error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
