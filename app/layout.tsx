import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ระบบเช็คชื่ออัจฉริยะ | Smart Attendance System",
  description: "ระบบเช็คชื่อนักเรียนรูปแบบใหม่ด้วย Face Recognition มั่นคง ปลอดภัย รองรับ PDPA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#fafbfe] text-slate-900 selection:bg-blue-500 selection:text-white">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              {/* Logo / Title */}
              <Link href="/" className="flex items-center gap-2 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 21a8 8 0 0 1 13.292-6" />
                    <circle cx="10" cy="8" r="5" />
                    <path d="M19 16v6" />
                    <path d="M22 19h-6" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                    Smart Attendance
                  </span>
                  <span className="text-[9px] font-bold text-blue-600 truncate max-w-[180px]" title="โรงเรียนบ้านป่าเลา(ประชานุสรณ์)">
                    โรงเรียนบ้านป่าเลา(ประชานุสรณ์)
                  </span>
                </div>
              </Link>
            </div>

            {/* Nav Menu */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/check-in"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
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
                <span className="hidden md:inline">เช็คชื่อ</span>
              </Link>

              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
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
                <span className="hidden md:inline">ลงทะเบียน</span>
              </Link>

              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
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
                <span className="hidden md:inline">แดชบอร์ด</span>
              </Link>

              <Link
                href="/students"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
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
                <span className="hidden md:inline">จัดการข้อมูล</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-slate-100 bg-white py-6 mt-12 text-center text-xs text-slate-400 font-semibold flex flex-col gap-1">
          <p>© 2026 Smart Attendance System. โรงเรียนบ้านป่าเลา(ประชานุสรณ์)</p>
          <p className="text-[10px] text-slate-400/80">สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1</p>
        </footer>
      </body>
    </html>
  );
}
