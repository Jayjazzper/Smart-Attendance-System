import Link from "next/link";
import HomeCardLink from "@/components/HomeCardLink";
import { getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();
  const schoolName = settings.schoolName || process.env.NEXT_PUBLIC_SCHOOL_NAME || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)";
  const schoolDistrict = settings.schoolDistrict || process.env.NEXT_PUBLIC_SCHOOL_DISTRICT || "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1";
  const schoolLogo = settings.schoolLogo || "";

  return (
    <div className="flex flex-col gap-12 py-8 sm:py-12 animate-fade-in">
      {/* Hero Section */}
      <section className="text-center flex flex-col items-center gap-4 max-w-2xl mx-auto">
        {schoolLogo ? (
          <img
            src={schoolLogo}
            alt="School Logo"
            className="h-16 w-16 object-contain rounded-2xl shadow-lg shadow-blue-500/10 mb-2"
          />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20">
            💻 AI + Vibe Coding
          </span>
        )}
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent py-3 leading-normal">
          ระบบเช็คชื่ออัจฉริยะด้วยใบหน้า
        </h1>
        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
          {schoolName}
        </p>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 -mt-2">
          {schoolDistrict}
        </p>
        <p className="text-base text-slate-500 dark:text-slate-400 font-medium sm:text-lg leading-relaxed mt-2">
          นวัตกรรมเว็บแอปพลิเคชันลงเวลาเรียนผ่านเว็บแคมด้วยเทคโนโลยีปัญญาประดิษฐ์ (Client-Side Face AI) ปลอดภัย ราบรื่น และรันแบบออฟไลน์ได้ 100%
        </p>
      </section>

      {/* Group 1: คุณครูผู้สอน (Teacher Features) */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="h-6 w-1 rounded-full bg-blue-600 dark:bg-blue-500"></div>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
            ระบบงานสำหรับคุณครูผู้สอน
          </h2>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Check-in */}
          <Link
            href="/check-in"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800/80 transition-all duration-300 hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-500 transition-colors duration-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                ระบบสแกนเช็คชื่อเข้าเรียน
              </h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                เปิดกล้องแคมวิดีโอเพื่อวิเคราะห์ใบหน้า ค้นหาผู้เรียน และบันทึกประวัติการเข้าเรียนในระบบแบบเรียลไทม์ทันที
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 gap-1">
              <span>เข้าสู่การสแกนเช็คชื่อ</span>
              <svg
                className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </Link>

          {/* Card 2: Leave Request */}
          <Link
            href="/leave"
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800/80 transition-all duration-300 hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-colors duration-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                ระบบยื่นใบลาสำหรับเด็ก
              </h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                บันทึกคำร้องยื่นใบลาป่วยหรือลากิจให้กับนักเรียน โดยข้อมูลทั้งหมดจะถูกบันทึกเข้าระบบเพื่อนำไปวิเคราะห์สถิติขาดเรียนย้อนหลัง
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 gap-1">
              <span>เข้าสู่การยื่นใบลา</span>
              <svg
                className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </Link>

          {/* Card 3: Dashboard Summary */}
          <HomeCardLink
            href="/dashboard"
            requireAuth={true}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800/80 transition-all duration-300 hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white dark:group-hover:bg-purple-500 transition-colors duration-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="7" height="9" x="3" y="3" rx="1" />
                  <rect width="7" height="5" x="14" y="3" rx="1" />
                  <rect width="7" height="9" x="14" y="12" rx="1" />
                  <rect width="7" height="5" x="3" y="16" rx="1" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                แดชบอร์ดสถิติห้องเรียน
              </h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                แสดงยอดรวมนักเรียน กราฟเปรียบเทียบแนวโน้มการเข้าเรียน มาสาย ขาดเรียน และประวัติเวลาเรียนเรียลไทม์
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-purple-600 dark:text-purple-400 gap-1">
              <span>ดูสถิติและรายงาน</span>
              <svg
                className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </HomeCardLink>
        </div>
      </div>

      {/* Group 2: ผู้ดูแลระบบ (Admin Features) */}
      <div className="flex flex-col gap-6 mt-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="h-6 w-1 rounded-full bg-indigo-600 dark:bg-indigo-500"></div>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
            ระบบงานสำหรับผู้ดูแลระบบ (Admin Features)
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 4: Register Student */}
          <HomeCardLink
            href="/register"
            requireAuth={true}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800/80 transition-all duration-300 hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 transition-colors duration-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" x2="19" y1="8" y2="14" />
                  <line x1="22" x2="16" y1="11" y2="11" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                ลงทะเบียนนักเรียนใหม่
              </h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                ลงทะเบียนภาพถ่ายใบหน้าพร้อมระบบบีบอัดพิกเซล สร้างเวกเตอร์ 128 มิติ เพื่อใช้ในการสแกนยืนยันตัวตนตามข้อกฎหมาย PDPA
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 gap-1">
              <span>ลงทะเบียนเด็กใหม่</span>
              <svg
                className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </HomeCardLink>

          {/* Card 5: Manage Students (CRUD & Print) */}
          <HomeCardLink
            href="/students"
            requireAuth={true}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md hover:border-amber-200 dark:hover:border-amber-800/80 transition-all duration-300 hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-500 transition-colors duration-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                จัดการข้อมูลและพิมพ์บัตร
              </h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                ค้นหารายชื่อนักเรียน แก้ไขประวัติ บันทึกข้อมูลสุขภาพฉุกเฉิน และจัดทำหน้าพิมพ์บัตรประจำตัวนักเรียนดิจิทัล
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-amber-600 dark:text-amber-400 gap-1">
              <span>เข้าสู่การจัดการนักเรียน</span>
              <svg
                className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </HomeCardLink>

          {/* Card 6: Settings */}
          <HomeCardLink
            href="/settings"
            requireAdmin={true}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md hover:border-rose-200 dark:hover:border-rose-800/80 transition-all duration-300 hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white dark:group-hover:bg-rose-500 transition-colors duration-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                ตั้งค่าระบบ & บัญชีครู
              </h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                จัดการสิทธิ์พาสโค้ด บัญชีครูประจำชั้น เชื่อมต่อซิงก์ Google Sheets ตรวจเช็ค Token สำรองและล้างข้อมูล
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-rose-600 dark:text-rose-400 gap-1">
              <span>ตั้งค่าระบบหลังบ้าน</span>
              <svg
                className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </HomeCardLink>
        </div>
      </div>

      {/* Dynamic Informative Panel for the Presentation */}
      <section className="mt-6 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">💻 เทคโนโลยีที่ใช้สาธิต (Vibe Coding Stack)</h2>
        <div className="grid gap-6 mt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold">
              1
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Next.js 14+ (App Router)</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
                สร้างเว็บแอปพลิเคชันยุคใหม่ รัน API Routes และ Static Page ได้รวดเร็วที่สุดในโครงสร้างเดียว
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold">
              2
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Client-side AI (face-api.js)</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
                ประมวลผลใบหน้าและแปลงเป็นรหัสเวกเตอร์ด้วยตัวกรอง WebGL บนเบราว์เซอร์ผู้ใช้ ไม่ดึงภาระเซิร์ฟเวอร์
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-bold">
              3
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">PDPA Compliant (Local Storage)</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
                ไม่เก็บรูปภาพถ่ายใบหน้าดิบ ปลอดภัยไร้กังวล และสามารถล้างข้อมูลในระบบออกได้ทันทีในคลิกเดียว (Right to be Forgotten)
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
