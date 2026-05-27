import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("teacher_session");
    cookieStore.delete("admin_authorized");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout API error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
