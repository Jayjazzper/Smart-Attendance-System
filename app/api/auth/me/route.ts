import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    
    // 1. Check teacher session (username/password login)
    const token = cookieStore.get("teacher_session")?.value;
    if (token) {
      const user = decryptSession(token);
      if (user) {
        return NextResponse.json({ loggedIn: true, user });
      } else {
        cookieStore.delete("teacher_session");
      }
    }
    
    // 2. Check admin passcode verification cookie
    const adminAuthorized = cookieStore.get("admin_authorized")?.value;
    if (adminAuthorized === "true") {
      return NextResponse.json({
        loggedIn: true,
        user: {
          username: "admin",
          name: "ผู้ดูแลระบบกลาง",
          role: "admin",
          classrooms: []
        }
      });
    }
    
    return NextResponse.json({ loggedIn: false }, { status: 200 });
  } catch (error) {
    console.error("Auth Me API error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
