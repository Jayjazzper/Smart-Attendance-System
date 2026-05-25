import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("teacher_session")?.value;
    
    if (!token) {
      return NextResponse.json({ loggedIn: false }, { status: 200 });
    }
    
    const user = decryptSession(token);
    if (!user) {
      // Clear invalid/expired cookie
      cookieStore.delete("teacher_session");
      return NextResponse.json({ loggedIn: false }, { status: 200 });
    }
    
    return NextResponse.json({ loggedIn: true, user });
  } catch (error) {
    console.error("Auth Me API error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
