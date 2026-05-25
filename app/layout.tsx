import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import AccessControlSelector from "@/components/AccessControlSelector";
import HeaderNavigation from "@/components/HeaderNavigation";
import { getSettings } from "@/lib/db";
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

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();
  const schoolName = settings.schoolName || process.env.NEXT_PUBLIC_SCHOOL_NAME || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)";
  const schoolDistrict = settings.schoolDistrict || process.env.NEXT_PUBLIC_SCHOOL_DISTRICT || "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1";
  const schoolLogo = settings.schoolLogo || "";

  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#fafbfe] dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-500 selection:text-white">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              {/* Logo / Title */}
              <Link href="/" className="flex items-center gap-2 group">
                {schoolLogo ? (
                  <img
                    src={schoolLogo}
                    alt="School Logo"
                    className="h-10 w-10 object-contain rounded-xl shadow-md shadow-blue-500/10 group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
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
                )}
                <div className="flex flex-col">
                  <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                    Smart Attendance
                  </span>
                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 truncate max-w-[180px]" title={schoolName}>
                    {schoolName}
                  </span>
                </div>
              </Link>
            </div>

            {/* Nav Menu */}
            <div className="flex items-center gap-3">
              <AccessControlSelector />
              <HeaderNavigation />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mt-12 text-center text-xs text-slate-400 dark:text-slate-500 font-semibold flex flex-col gap-1">
          <p>© 2026 Smart Attendance System. {schoolName}</p>
          <p className="text-[10px] text-slate-400/80 dark:text-slate-500/80">{schoolDistrict}</p>
          <p className="text-[10px] text-slate-400/60 dark:text-slate-500/60 mt-1">
            Developed & Customized by{" "}
            <a
              href="https://www.facebook.com/JirayuGoh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
            >
              Kru Jirayu Goh
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
