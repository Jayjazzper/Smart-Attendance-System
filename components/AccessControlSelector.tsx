"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface Student {
  classroom?: string;
}

interface TeacherSession {
  role: "admin" | "teacher";
  classroom: string;
}

export default function AccessControlSelector() {
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [classrooms, setClassrooms] = useState<string[]>([]);
  
  // Form states
  const [selectedClass, setSelectedClass] = useState("");
  const [passcode, setPasscode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read session from localStorage
    const savedSession = localStorage.getItem("teacherSession");
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        localStorage.removeItem("teacherSession");
      }
    }

    // Fetch students to extract classrooms
    const fetchClassrooms = async () => {
      try {
        const res = await fetch("/api/students");
        if (res.ok) {
          const data = await res.json();
          const list: Student[] = data.students || [];
          const uniqueClasses = Array.from(
            new Set(list.map((s) => s.classroom).filter(Boolean))
          ).sort() as string[];
          setClassrooms(uniqueClasses);
          if (uniqueClasses.length > 0) {
            setSelectedClass(uniqueClasses[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load classrooms for access control:", err);
      }
    };

    fetchClassrooms();
  }, []);

  const handleOpen = () => {
    setErrorMsg("");
    setPasscode("");
    setShowPasscode(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setShowPasscode(false);
    setIsOpen(false);
  };

  const handleLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      setErrorMsg("กรุณาเลือกห้องเรียน");
      return;
    }
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
        const correctPasscode = settings.teacherPasscode || "1234";
        
        if (passcode === correctPasscode) {
          const newSession: TeacherSession = {
            role: "teacher",
            classroom: selectedClass,
          };
          localStorage.setItem("teacherSession", JSON.stringify(newSession));
          setSession(newSession);
          setIsOpen(false);
          // Reload page to propagate filters
          window.location.reload();
        } else {
          setErrorMsg("รหัสผ่านไม่ถูกต้อง");
        }
      } else {
        setErrorMsg("ไม่สามารถตรวจสอบรหัสผ่านได้ในขณะนี้");
      }
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) {
      setErrorMsg("กรุณากรอกรหัสผ่านเพื่อปลดล็อก");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const settings = await res.json();
        const correctPasscode = settings.teacherPasscode || "1234";

        if (passcode === correctPasscode) {
          localStorage.removeItem("teacherSession");
          setSession(null);
          setIsOpen(false);
          // Reload page to reset filters
          window.location.reload();
        } else {
          setErrorMsg("รหัสผ่านไม่ถูกต้อง");
        }
      } else {
        setErrorMsg("ไม่สามารถตรวจสอบรหัสผ่านได้ในขณะนี้");
      }
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all border shadow-sm cursor-pointer select-none ${
          session?.role === "teacher"
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
        }`}
      >
        {session?.role === "teacher" ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>ห้อง: {session.classroom}</span>
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path d="M2 12h20" />
            </svg>
            <span>ผู้บริหาร (ทั้งหมด)</span>
          </>
        )}
      </button>

      {/* Modal Dialog using React Portal */}
      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {session?.role === "teacher"
                  ? "ปลดล็อกสิทธิ์การเข้าถึง (Unlock Access)"
                  : "สลับสิทธิ์การเข้าถึง (Access Control)"}
              </h3>
              <button
                onClick={handleClose}
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

            {session?.role === "teacher" ? (
              /* Unlock Form */
              <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-3.5 text-center">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
                    ขณะนี้เข้าสู่ระบบในสิทธิ์ครูประจำชั้น ห้อง {session.classroom}
                  </p>
                  <p className="text-[10px] font-medium text-amber-700/85 dark:text-amber-400/80 mt-0.5">
                    กรุณากรอกรหัสผ่านเพื่อปลดล็อกกลับสู่สิทธิ์ผู้บริหารกลาง
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    รหัสผ่านห้องเรียนกลาง (Teacher Passcode)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showPasscode ? "text" : "password"}
                      placeholder="ป้อนรหัสผ่านปลดล็อก..."
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-4 pr-10 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
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
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700 disabled:bg-slate-300 transition-colors cursor-pointer h-10"
                >
                  {loading ? "กำลังตรวจสอบ..." : "ปลดล็อกสิทธิ์กลับสู่ผู้บริหาร"}
                </button>
              </form>
            ) : (
              /* Lock Form */
              <form onSubmit={handleLock} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">เลือกห้องเรียนที่ประจำชั้น</label>
                  {classrooms.length === 0 ? (
                    <input
                      type="text"
                      placeholder="เช่น ป.4/2..."
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
                      required
                    />
                  ) : (
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
                    >
                      {classrooms.map((cls) => (
                        <option key={cls} value={cls}>
                          ห้องเรียน {cls}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    รหัสผ่านห้องเรียนกลาง (Teacher Passcode)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showPasscode ? "text" : "password"}
                      placeholder="ป้อนรหัสผ่านยืนยัน..."
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-4 pr-10 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
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
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer h-10"
                >
                  {loading ? "กำลังตรวจสอบ..." : "ยืนยันสิทธิ์ครูประจำชั้น"}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
