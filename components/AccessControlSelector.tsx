"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface Student {
  classroom?: string;
}

interface TeacherSession {
  role: "admin" | "teacher";
  classroom: string;
  username: string;
  name: string;
}

export default function AccessControlSelector() {
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [classrooms, setClassrooms] = useState<string[]>([]);
  
  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Fetch students to extract classrooms
    const fetchClassrooms = async () => {
      try {
        const res = await fetch("/api/students");
        if (res.ok) {
          const data = await res.json();
          const list: Student[] = data.students || [];
          const uniqueClasses = Array.from(
            new Set(
              list
                .map((s) => s.classroom)
                .filter((cls): cls is string => {
                  if (!cls) return false;
                  const normalized = cls.trim().toLowerCase();
                  return (
                    normalized !== "consentgiven" &&
                    normalized !== "classroom" &&
                    normalized !== "true" &&
                    normalized !== "false" &&
                    normalized !== "id" &&
                    normalized !== "name" &&
                    normalized !== "email" &&
                    normalized.length <= 15
                  );
                })
            )
          ).sort() as string[];
          setClassrooms(uniqueClasses);
        }
      } catch (err) {
        console.error("Failed to load classrooms for access control:", err);
      }
    };

    // Verify session from API on mount
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.loggedIn && data.user) {
            setUser(data.user);
            
            // Check if there is a saved classroom lock in localStorage
            const savedSession = localStorage.getItem("teacherSession");
            if (savedSession) {
              try {
                const parsed = JSON.parse(savedSession);
                // Ensure the saved session belongs to the logged-in user
                if (parsed.username === data.user.username) {
                  setSession(parsed);
                  setSelectedClass(parsed.classroom);
                  return;
                }
              } catch (e) {}
            }
            
            // Default lock settings
            const defaultSession: TeacherSession = {
              role: data.user.role,
              username: data.user.username,
              name: data.user.name,
              classroom: data.user.role === "admin" ? "" : (data.user.classrooms[0] || "")
            };
            localStorage.setItem("teacherSession", JSON.stringify(defaultSession));
            setSession(defaultSession);
            setSelectedClass(defaultSession.classroom);
          } else {
            localStorage.removeItem("teacherSession");
            setSession(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Failed to verify session:", err);
      }
    };

    fetchClassrooms().then(() => checkSession());
  }, []);

  const handleOpen = () => {
    setErrorMsg("");
    setUsername("");
    setPassword("");
    setShowPasscode(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setShowPasscode(false);
    setIsOpen(false);
  };

  const handleLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        const teacher = data.user;
        
        let targetClassroom = selectedClass;
        if (teacher.role !== "admin") {
          if (teacher.classrooms && teacher.classrooms.length > 0) {
            // Check if selected class is valid for this teacher
            if (!targetClassroom || !teacher.classrooms.includes(targetClassroom)) {
              targetClassroom = teacher.classrooms[0];
            }
          } else {
            setErrorMsg("คุณไม่มีสิทธิ์เข้าจัดการห้องเรียนใด ๆ ในระบบ");
            setLoading(false);
            return;
          }
        }
        
        const newSession: TeacherSession = {
          role: teacher.role,
          classroom: targetClassroom,
          username: teacher.username,
          name: teacher.name
        };
        
        localStorage.setItem("teacherSession", JSON.stringify(newSession));
        setSession(newSession);
        setUser(teacher);
        setIsOpen(false);
        window.location.reload();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        localStorage.removeItem("teacherSession");
        setSession(null);
        setUser(null);
        setIsOpen(false);
        window.location.reload();
      } else {
        setErrorMsg("ไม่สามารถออกจากระบบได้");
      }
    } catch (err) {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchClassroom = (newClass: string) => {
    if (!session) return;
    const newSession = {
      ...session,
      classroom: newClass
    };
    localStorage.setItem("teacherSession", JSON.stringify(newSession));
    setSession(newSession);
    setSelectedClass(newClass);
    window.location.reload();
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all border shadow-sm cursor-pointer select-none ${
          session
            ? session.role === "admin" && !session.classroom
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        {session ? (
          session.classroom ? (
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
              <span>{session.name || "ครู"}: ห้อง {session.classroom}</span>
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
              <span>{session.name || "ผู้บริหาร"} (ทั้งหมด)</span>
            </>
          )
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
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>เข้าสู่ระบบคุณครู</span>
          </>
        )}
      </button>

      {/* Modal Dialog using React Portal */}
      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {session
                  ? "จัดการเซสชันล็อกอินครู"
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

            {session ? (
              /* Logout & Switch Classroom Form */
              <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-3.5 text-center">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
                    เข้าสู่ระบบในชื่อ: {session.name || session.username}
                  </p>
                  <p className="text-[10px] font-medium text-amber-700/85 dark:text-amber-400/80 mt-0.5">
                    {session.role === "admin" 
                      ? "สิทธิ์ผู้ดูแลระบบสูงสุด (Admin)" 
                      : `ครูผู้ดูแลห้องเรียน: ${user?.classrooms?.join(", ") || "-"}`}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {user?.role === "admin" ? (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">ล็อกห้องสแกนจำลอง (สิทธิ์ Admin)</label>
                      <select
                        value={selectedClass}
                        onChange={(e) => handleSwitchClassroom(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- ไม่ล็อกห้อง (ผู้บริหารทั้งหมด) --</option>
                        {classrooms.map((cls) => (
                          <option key={cls} value={cls}>ห้องเรียน {cls}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    user?.classrooms && user.classrooms.length > 1 && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500">สลับล็อกห้องสแกน</label>
                        <select
                          value={selectedClass}
                          onChange={(e) => handleSwitchClassroom(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
                        >
                          {user.classrooms.map((cls: string) => (
                            <option key={cls} value={cls}>ห้องเรียน {cls}</option>
                          ))}
                        </select>
                      </div>
                    )
                  )}
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-red-600 text-center">
                    ⚠️ {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-rose-500/20 hover:bg-rose-700 disabled:bg-slate-300 transition-colors cursor-pointer h-10"
                >
                  {loading ? "กำลังออกจากระบบ..." : "ออกจากระบบ (Logout)"}
                </button>
              </form>
            ) : (
              /* Login Form */
              <form onSubmit={handleLock} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ชื่อผู้ใช้ (Username)</label>
                  <input
                    type="text"
                    placeholder="ป้อนชื่อผู้ใช้..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">รหัสผ่าน (Password)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPasscode ? "text" : "password"}
                      placeholder="ป้อนรหัสผ่าน..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-4 pr-10 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode(!showPasscode)}
                      className="absolute right-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer select-none"
                    >
                      {showPasscode ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ห้องเรียนที่ล็อกการสแกน (ถ้ามี)</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:border-blue-500 focus:outline-none transition-colors"
                  >
                    <option value="">-- ไม่ล็อกห้อง (สิทธิ์ผู้บริหารรวม) --</option>
                    {classrooms.map((cls) => (
                      <option key={cls} value={cls}>
                        ห้องเรียน {cls}
                      </option>
                    ))}
                  </select>
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
                  {loading ? "กำลังตรวจสอบ..." : "ยืนยันสิทธิ์เข้าใช้งาน"}
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
