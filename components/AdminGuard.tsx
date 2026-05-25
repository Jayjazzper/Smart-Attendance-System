"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AdminGuardProps {
  children: React.ReactNode;
  allowTeacher?: boolean;
}

export default function AdminGuard({ children, allowTeacher = false }: AdminGuardProps) {
  const [isValidated, setIsValidated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);

  useEffect(() => {
    // Check validation status on mount
    const status = localStorage.getItem("adminValidated");
    const teacherSession = localStorage.getItem("teacherSession");
    
    if (status === "true" || (allowTeacher && teacherSession)) {
      setIsValidated(true);
    } else {
      setIsValidated(false);
    }
  }, [allowTeacher]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) {
      setErrorMsg("กรุณากรอกรหัสผ่าน");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const settings = await res.json();
        const correctPasscode = settings.adminPasscode || "1234";

        if (passcode === correctPasscode) {
          localStorage.setItem("adminValidated", "true");
          setIsValidated(true);
        } else {
          setErrorMsg("รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง");
        }
      } else {
        setErrorMsg("ไม่สามารถเชื่อมต่อระบบตั้งค่าได้");
      }
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน");
    } finally {
      setLoading(false);
    }
  };

  // While checking validation status
  if (isValidated === null) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-2">
        <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs font-bold">กำลังตรวจสอบสิทธิ์...</span>
      </div>
    );
  }

  // If validated, render the actual content
  if (isValidated) {
    return <>{children}</>;
  }

  // If not validated, render the Glassmorphism Lock Screen
  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl flex flex-col gap-6 animate-scale-up">
        
        {/* Lock Screen Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              พื้นที่เฉพาะผู้ดูแลระบบ (Admin Area)
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed px-4">
              หน้านี้มีข้อมูลส่วนบุคคลของเด็กนักเรียนและโทเคนระบบ กรุณากรอกรหัสผ่านผู้ดูแลระบบ (Admin Passcode) เพื่อเข้าใช้งาน
            </p>
          </div>
        </div>

        {/* Lock Screen Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">รหัสผ่านผู้ดูแลระบบ (Admin Passcode)</label>
            <div className="relative flex items-center">
              <input
                type={showPasscode ? "text" : "password"}
                placeholder="ป้อนรหัสผ่านเข้าหน้าตั้งค่า..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-4 pr-10 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer select-none"
                title={showPasscode ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPasscode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-bold text-red-600 text-center animate-shake">
              ⚠️ {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer h-10.5"
          >
            {loading ? "กำลังตรวจสอบรหัส..." : "ยืนยันรหัสผ่านเพื่อเข้าใช้งาน"}
          </button>
        </form>

        {/* Cancel Action */}
        <div className="border-t border-slate-50 dark:border-slate-800 pt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>ยกเลิกและกลับหน้าหลัก</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
