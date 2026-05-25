"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function HeaderNavigation() {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Passcode modal states
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.loggedIn && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      }
    } catch (e) {
      console.error("Error fetching user profile in header:", e);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchCurrentUser();
  }, [pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change and auto-lock admin session
  useEffect(() => {
    setDropdownOpen(false);
    if (pathname === "/" || pathname === "/check-in") {
      localStorage.removeItem("adminValidated");
    }
  }, [pathname]);

  const handleVerifyPasscode = async (e: React.FormEvent) => {
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
          setIsPasscodeModalOpen(false);
          setDropdownOpen(true);
        } else {
          setErrorMsg("รหัสผ่านไม่ถูกต้อง");
        }
      } else {
        setErrorMsg("ไม่สามารถเชื่อมต่อระบบตรวจสอบสิทธิ์ได้");
      }
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน");
    } finally {
      setLoading(false);
    }
  };

  const adminActive = ["/dashboard", "/reports", "/register", "/students", "/settings"].some(
    (path) => pathname.startsWith(path)
  );

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 select-none">
      {/* Core Links */}
      <Link
        href="/check-in"
        className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-2 text-xs font-bold transition-all border ${
          pathname === "/check-in"
            ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        <span className="hidden md:inline">เช็คชื่อเข้าเรียน</span>
      </Link>

      <Link
        href="/leave"
        className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-2 text-xs font-bold transition-all border ${
          pathname === "/leave"
            ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        <span className="hidden md:inline">ยื่นใบลา</span>
      </Link>

      {currentUser && (
        <span className="hidden lg:inline-flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-350">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{currentUser.name} ({currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : `ครู ${currentUser.classrooms?.join(', ')}`})</span>
        </span>
      )}

      {/* Admin Dropdown Menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => {
            if (dropdownOpen) {
              setDropdownOpen(false);
            } else {
              const isPasscodeValidated = typeof window !== "undefined" && localStorage.getItem("adminValidated") === "true";
              if (currentUser || isPasscodeValidated) {
                setDropdownOpen(true);
              } else {
                setErrorMsg("");
                setPasscode("");
                setShowPasscode(false);
                setIsPasscodeModalOpen(true);
              }
            }
          }}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-2 text-xs font-bold transition-all border cursor-pointer ${
            adminActive
              ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-400"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0 1.51-1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span className="hidden sm:inline">เครื่องมือระบบ</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2.5 w-48 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl z-50 animate-scale-up">
            <Link
              href="/dashboard"
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                pathname === "/dashboard" ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
              แดชบอร์ดสรุปสถิติ
            </Link>
            <Link
              href="/reports"
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                pathname === "/reports" ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              รายงานสถิติเด็ก
            </Link>
            <Link
              href="/register"
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                pathname === "/register" ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              ลงทะเบียนนักเรียนใหม่
            </Link>
            <Link
              href="/students"
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                pathname === "/students" ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              จัดการข้อมูลเด็ก (CRUD)
            </Link>
            {(!currentUser || currentUser.role === "admin") && (
              <>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                <Link
                  href="/settings"
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    pathname === "/settings" ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  ตั้งค่าระบบ
                </Link>
              </>
            )}
            {currentUser && (
              <>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/auth/logout", { method: "POST" });
                      if (res.ok) {
                        localStorage.removeItem("teacherSession");
                        localStorage.removeItem("adminValidated");
                        window.location.reload();
                      }
                    } catch (e) {
                      console.error("Error logging out:", e);
                    }
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-700 transition-colors text-left cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  ออกจากระบบ (Logout)
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Passcode Modal for System Tools */}
      {isPasscodeModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                ยืนยันสิทธิ์เครื่องมือระบบ
              </h3>
              <button
                onClick={() => setIsPasscodeModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleVerifyPasscode} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  รหัสผ่านผู้ดูแลระบบ (Admin Passcode)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPasscode ? "text" : "password"}
                    placeholder="ป้อนรหัสผ่าน..."
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-4 pr-10 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none transition-colors"
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
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 disabled:bg-slate-300 transition-colors cursor-pointer h-10"
              >
                {loading ? "กำลังตรวจสอบ..." : "ยืนยันรหัสผ่าน"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
