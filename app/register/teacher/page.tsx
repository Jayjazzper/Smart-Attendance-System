"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const GRADE_LEVELS = {
  kindergarten: [
    { value: "อนุบาล 2", label: "อนุบาล 2" },
    { value: "อนุบาล 3", label: "อนุบาล 3" },
  ],
  primary: [
    { value: "ประถมศึกษาปีที่ 1", label: "ประถมศึกษาปีที่ 1 (ป.1)" },
    { value: "ประถมศึกษาปีที่ 2", label: "ประถมศึกษาปีที่ 2 (ป.2)" },
    { value: "ประถมศึกษาปีที่ 3", label: "ประถมศึกษาปีที่ 3 (ป.3)" },
    { value: "ประถมศึกษาปีที่ 4", label: "ประถมศึกษาปีที่ 4 (ป.4)" },
    { value: "ประถมศึกษาปีที่ 5", label: "ประถมศึกษาปีที่ 5 (ป.5)" },
    { value: "ประถมศึกษาปีที่ 6", label: "ประถมศึกษาปีที่ 6 (ป.6)" },
  ],
  secondary: [
    { value: "มัธยมศึกษาปีที่ 1", label: "มัธยมศึกษาปีที่ 1 (ม.1)" },
    { value: "มัธยมศึกษาปีที่ 2", label: "มัธยมศึกษาปีที่ 2 (ม.2)" },
    { value: "มัธยมศึกษาปีที่ 3", label: "มัธยมศึกษาปีที่ 3 (ม.3)" },
    { value: "มัธยมศึกษาปีที่ 4", label: "มัธยมศึกษาปีที่ 4 (ม.4)" },
    { value: "มัธยมศึกษาปีที่ 5", label: "มัธยมศึกษาปีที่ 5 (ม.5)" },
    { value: "มัธยมศึกษาปีที่ 6", label: "มัธยมศึกษาปีที่ 6 (ม.6)" },
  ],
};

function getAbbreviatedClassroom(grade: string, room: string): string {
  const roomNumber = room.replace("ห้อง ", "");
  const num = grade.split(" ").pop() || "";
  if (grade.startsWith("อนุบาล")) {
    return `อ.${num}/${roomNumber}`;
  }
  if (grade.startsWith("ประถม")) {
    return `ป.${num}/${roomNumber}`;
  }
  if (grade.startsWith("มัธยม")) {
    return `ม.${num}/${roomNumber}`;
  }
  return `${grade}/${roomNumber}`;
}

export default function TeacherRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    teacherPasscode: ""
  });
  
  // Visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  
  // Classroom states
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
  const [classroomsList, setClassroomsList] = useState<string[]>([]);
  const [maxRooms, setMaxRooms] = useState(15);
  const [customLevel, setCustomLevel] = useState<"kindergarten" | "primary" | "secondary">("kindergarten");
  const [customGrade, setCustomGrade] = useState("อนุบาล 2");
  const [customRoom, setCustomRoom] = useState("ห้อง 1");
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  // Fetch unique classrooms from students on mount
  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        const res = await fetch("/api/students");
        if (res.ok) {
          const data = await res.json();
          const students = data.students || [];
          const uniqueClasses = Array.from(
            new Set(students.map((s: any) => s.classroom).filter(Boolean))
          ).sort() as string[];
          setClassroomsList(uniqueClasses);
        }
      } catch (err) {
        console.error("Failed to fetch classrooms for register form:", err);
      }
    };
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.maxRooms !== undefined) {
            setMaxRooms(data.maxRooms);
          }
        }
      } catch (err) {
        console.error("Failed to fetch settings for maxRooms:", err);
      }
    };
    fetchClassrooms();
    fetchSettings();
  }, []);

  const handleCheckboxChange = (cls: string) => {
    setSelectedClassrooms(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const handleAddCustomClass = (e: React.MouseEvent) => {
    e.preventDefault();
    const abbreviatedClass = getAbbreviatedClassroom(customGrade, customRoom);
    if (!selectedClassrooms.includes(abbreviatedClass)) {
      setSelectedClassrooms(prev => [...prev, abbreviatedClass]);
      if (!classroomsList.includes(abbreviatedClass)) {
        setClassroomsList(prev => [...prev, abbreviatedClass].sort());
      }
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.name || !formData.email || !formData.teacherPasscode) {
      setStatusMessage({ text: "กรุณากรอกข้อมูลให้ครบถ้วนเพื่อสมัครสมาชิก", type: "error" });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/auth/register-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          classrooms: selectedClassrooms
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: "✓ สมัครสมาชิกสำเร็จ! ระบบกำลังนำคุณไปยังหน้าสแกน...", type: "success" });
        setTimeout(() => {
          router.push("/check-in");
        }, 2000);
      } else {
        setStatusMessage({ text: data.error || "เกิดข้อผิดพลาดในการสมัครสมาชิก", type: "error" });
        setLoading(false);
      }
    } catch (err) {
      setStatusMessage({ text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", type: "error" });
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 select-none">
      <div className="w-full max-w-lg rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl flex flex-col gap-6 animate-scale-up text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              ลงทะเบียนครูประจำชั้นใหม่
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed px-4">
              สร้างบัญชีใช้งานส่วนตัวเพื่อสลับจัดการ ข้อมูลประวัตินักเรียน และสรุปรายงานการเข้าเรียนเฉพาะห้องเรียนที่ตนเองดูแล
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ชื่อผู้ใช้ (Username)</label>
              <input
                type="text"
                placeholder="เช่น kru_somchai"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-750 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">รหัสผ่าน (Password)</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="ป้อนรหัสผ่าน..."
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-4 pr-10 py-2.5 text-xs font-semibold text-slate-750 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer select-none"
                  title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ชื่อ-นามสกุลจริง (Full Name)</label>
              <input
                type="text"
                placeholder="เช่น ครูสมชาย รักเรียน"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-750 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                required
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">อีเมล (Email)</label>
              <input
                type="email"
                placeholder="เช่น somchai@school.mail"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-750 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Teacher Passcode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              รหัสผ่านความปลอดภัยครูประจำชั้น (Teacher Passcode)
            </label>
            <div className="relative flex items-center">
              <input
                type={showPasscode ? "text" : "password"}
                placeholder="กรอกรหัสผ่านเพื่อยืนยันสิทธิ์สมัครบัญชีครู (เช่น 1234)..."
                value={formData.teacherPasscode}
                onChange={(e) => setFormData(prev => ({ ...prev, teacherPasscode: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-4 pr-10 py-2.5 text-xs font-semibold text-slate-750 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer select-none"
                title={showPasscode ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPasscode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
              *รหัสยืนยันตัวตนสำหรับครูประจำชั้นที่แอดมินระบบกำหนดให้ใช้เพื่อลงทะเบียนร่วมกัน (เช่น 1234)
            </p>
          </div>

          {/* Classrooms List Checkboxes */}
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">เลือกห้องเรียนที่รับผิดชอบ</label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 max-h-[160px] overflow-y-auto flex flex-col gap-2.5">
              {classroomsList.length === 0 ? (
                <span className="text-xs font-bold text-slate-400 text-center py-4">
                  ยังไม่มีเด็กนักเรียนลงทะเบียนในระบบเพื่อสร้างห้องเรียน
                </span>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {classroomsList.map(cls => (
                    <label key={cls} className="flex items-center gap-2 text-xs font-bold text-slate-750 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedClassrooms.includes(cls)}
                        onChange={() => handleCheckboxChange(cls)}
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                        disabled={loading}
                      />
                      <span>ห้องเรียน {cls}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            {/* Add Custom Classroom input */}
            <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 mt-1">
              <span className="text-[10px] font-bold text-slate-500">เพิ่มห้องเรียนกำหนดเอง:</span>
              
              {/* Level Buttons */}
              <div className="grid grid-cols-3 gap-1">
                {(["kindergarten", "primary", "secondary"] as const).map((lvl) => {
                  const labels = { kindergarten: "อนุบาล", primary: "ประถม", secondary: "มัธยม" };
                  const active = customLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setCustomLevel(lvl);
                        setCustomGrade(GRADE_LEVELS[lvl][0].value);
                      }}
                      className={`py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer border ${
                        active
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {labels[lvl]}
                    </button>
                  );
                })}
              </div>

              {/* Grade and Room selects */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={customGrade}
                  disabled={loading}
                  onChange={(e) => setCustomGrade(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-350 focus:outline-none cursor-pointer"
                >
                  {GRADE_LEVELS[customLevel].map((grd) => (
                    <option key={grd.value} value={grd.value}>{grd.label}</option>
                  ))}
                </select>
                
                <select
                  value={customRoom}
                  disabled={loading}
                  onChange={(e) => setCustomRoom(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-350 focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: maxRooms }, (_, i) => `ห้อง ${i + 1}`).map((rm) => (
                    <option key={rm} value={rm}>{rm}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddCustomClass}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-[10px] font-black shadow-sm cursor-pointer transition-colors"
              >
                เพิ่มห้องเรียนนี้
              </button>
            </div>
          </div>

          {/* Status Message Display */}
          {statusMessage && (
            <div className={`rounded-xl px-4 py-2.5 text-center text-xs font-bold border animate-fade-in ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400"
                : "bg-red-50 border-red-100 text-red-800 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400"
            }`}>
              {statusMessage.text}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer h-10.5 mt-2"
          >
            {loading ? "กำลังสร้างบัญชี..." : "สมัครสมาชิกบัญชีครูประจำชั้น"}
          </button>
        </form>

        {/* Back Link */}
        <div className="border-t border-slate-50 dark:border-slate-800 pt-4 text-center">
          <Link
            href="/check-in"
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
            <span>ยกเลิกและกลับหน้าเช็คชื่อ</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
