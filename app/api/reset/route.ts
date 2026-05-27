import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/db";
import { isRequestAuthorized } from "@/lib/auth";

export async function POST() {
  try {
    const authorized = await isRequestAuthorized();
    if (!authorized) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาตสำหรับการดำเนินการนี้ (Admin only)" },
        { status: 403 }
      );
    }

    const success = await resetDatabase();
    if (!success) {
      return NextResponse.json({ error: "Failed to reset database" }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "ล้างข้อมูลระบบสำเร็จ" });
  } catch (error) {
    console.error("POST /api/reset error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

