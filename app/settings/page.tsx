"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ClassroomSetting {
  lineToken?: string;
}

interface SystemSettings {
  classrooms: Record<string, ClassroomSetting>;
}

interface Student {
  id: string;
  name: string;
  classroom?: string;
  level?: string;
}

export default function SettingsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ classrooms: {} });
  const [loading, setLoading] = useState(true);
  
  // Visibility maps for tokens (so they aren't visible by default)
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  
  // Status states
  const [savingClassroom, setSavingClassroom] = useState<string | null>(null);
  const [testingClassroom, setTestingClassroom] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<Record<string, { text: string; type: "success" | "error" }>>({});

  // 1. Fetch Students and current settings
  const fetchData = async () => {
    try {
      const [studentsRes, settingsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/settings")
      ]);
      
      if (studentsRes.ok && settingsRes.ok) {
        const studentsData = await studentsRes.json();
        const settingsData = await settingsRes.json();
        
        setStudents(studentsData.students || []);
        // Set settings defaults if empty
        setSettings(settingsData || { classrooms: {} });
      }
    } catch (err) {
      console.error("Error loading settings page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get all unique classrooms from registered students
  const classroomsList = Array.from(
    new Set(students.map(s => s.classroom).filter(Boolean))
  ).sort() as string[];

  // 2. Toggle token visibility
  const toggleVisibility = (cls: string) => {
    setVisibleTokens(prev => ({ ...prev, [cls]: !prev[cls] }));
  };

  // 3. Handle Token input changes
  const handleTokenChange = (cls: string, token: string) => {
    setSettings(prev => ({
      ...prev,
      classrooms: {
        ...prev.classrooms,
        [cls]: {
          ...prev.classrooms[cls],
          lineToken: token
        }
      }
    }));
  };

  // 4. Save Settings for a specific Classroom
  const handleSaveClassroomToken = async (cls: string) => {
    setSavingClassroom(cls);
    setStatusMessages(prev => ({ ...prev, [cls]: { text: "", type: "success" } }));

    try {
      // Load current settings and update the specific classroom
      const updatedSettings = {
        ...settings,
        classrooms: {
          ...settings.classrooms,
          [cls]: {
            ...settings.classrooms[cls],
            lineToken: settings.classrooms[cls]?.lineToken || ""
          }
        }
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings)
      });

      if (res.ok) {
        setSettings(updatedSettings);
        setStatusMessages(prev => ({
          ...prev,
          [cls]: { text: "✓ บันทึกสำเร็จ", type: "success" }
        }));
        setTimeout(() => {
          setStatusMessages(prev => ({ ...prev, [cls]: { text: "", type: "success" } }));
        }, 3000);
      } else {
        setStatusMessages(prev => ({
          ...prev,
          [cls]: { text: "เกิดข้อผิดพลาดในการบันทึก", type: "error" }
        }));
      }
    } catch (err) {
      console.error(err);
      setStatusMessages(prev => ({
        ...prev,
        [cls]: { text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", type: "error" }
      }));
    } finally {
      setSavingClassroom(null);
    }
  };

  // 5. Test LINE Notify Message
  const handleTestToken = async (cls: string) => {
    const token = settings.classrooms[cls]?.lineToken;
    if (!token) {
      setStatusMessages(prev => ({
        ...prev,
        [cls]: { text: "กรุณากรอก Token ก่อนทดสอบ", type: "error" }
      }));
      return;
    }

    setTestingClassroom(cls);
    setStatusMessages(prev => ({ ...prev, [cls]: { text: "", type: "success" } }));

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "testLine",
          token: token
        })
      });

      if (res.ok) {
        setStatusMessages(prev => ({
          ...prev,
          [cls]: { text: "✓ ส่งข้อความทดสอบเข้ากลุ่มไลน์สำเร็จแล้ว!", type: "success" }
        }));
      } else {
        const data = await res.json();
        setStatusMessages(prev => ({
          ...prev,
          [cls]: { text: data.error || "Token ไม่ถูกต้อง หรือหมดอายุ", type: "error" }
        }));
      }
    } catch (err) {
      console.error(err);
      setStatusMessages(prev => ({
        ...prev,
        [cls]: { text: "ไม่สามารถส่งคำสั่งเชื่อมต่อได้", type: "error" }
      }));
    } finally {
      setTestingClassroom(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          ตั้งค่าระบบและการแจ้งเตือน
        </h1>
        <p className="text-sm font-medium text-slate-500">
          ตั้งค่าการเชื่อมต่อแจ้งเตือนไลน์กลุ่มผู้ปกครองและคุณครู แยกเฉพาะรายห้องเรียน
        </p>
      </div>

      {/* Guide Card */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-blue-900">วิธีเชื่อมต่อแจ้งเตือนกลุ่ม LINE Notify</h3>
          <ol className="text-xs text-blue-800 list-decimal list-inside space-y-1.5 font-medium leading-relaxed">
            <li>เข้าไปที่หน้าเว็บหลักของ <a href="https://notify-bot.line.me/my/" target="_blank" rel="noopener noreferrer" className="underline font-bold text-blue-700 hover:text-blue-900">LINE Notify (คลิกเปิดที่นี่)</a> แล้วเข้าสู่ระบบด้วยบัญชี LINE</li>
            <li>กดปุ่ม **"ออกโทเคน (Generate Token)"** ที่อยู่ด้านล่างสุดของหน้าต่างโปรไฟล์</li>
            <li>ตั้งชื่อบริการแสดงตัวข้อความแจ้งเตือน (เช่น *เช็คชื่อ ป.4/2*) จากนั้นพิมพ์ค้นหากลุ่ม LINE ที่ต้องการส่งข้อความแจ้งเตือน แล้วคลิกเลือกกลุ่มนั้น</li>
            <li>กดปุ่ม **"ออกโทเคน (Generate Token)"** จากนั้น**คัดลอกรหัส (Token)** ที่แสดงขึ้นมาเอาไว้</li>
            <li>เชิญบัญชีบอทอย่างเป็นทางการของ LINE ที่ชื่อว่า **`LINE Notify`** เข้ามาในกลุ่มแชทไลน์ดังกล่าว</li>
            <li>นำรหัสโทเคนมาวางลงในช่องห้องเรียนด้านล่างนี้ และกดบันทึกเป็นอันเรียบร้อยครับ</li>
          </ol>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-bold">กำลังโหลดการตั้งค่า...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">กำหนด Token รายห้องเรียน</h3>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                เลือกและกรอกรหัสโทเคนตามห้องเรียนที่มีรายชื่อเด็กนักเรียนลงทะเบียนอยู่ในฐานข้อมูล
              </p>
            </div>

            {classroomsList.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400 flex flex-col gap-2">
                <span>ยังไม่มีข้อมูลห้องเรียนใด ๆ ในระบบ</span>
                <Link href="/register" className="text-blue-600 hover:underline">
                  ไปที่หน้าลงทะเบียนนักเรียนเพื่อเพิ่มห้องเรียนแรก ➜
                </Link>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-50">
                {classroomsList.map((cls) => {
                  const classroomSettings = settings.classrooms?.[cls];
                  const token = classroomSettings?.lineToken || "";
                  const status = statusMessages[cls];
                  const isSaving = savingClassroom === cls;
                  const isTesting = testingClassroom === cls;

                  return (
                    <div key={cls} className="py-4.5 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Classroom tag */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex h-9 w-16 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-xs font-black text-blue-600">
                          {cls}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900">ห้องเรียน {cls}</span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            จำนวนนักเรียน: {students.filter(s => s.classroom === cls).length} คน
                          </span>
                        </div>
                      </div>

                      {/* Token controls */}
                      <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <div className="flex-1 relative flex items-center">
                          <input
                            type={visibleTokens[cls] ? "text" : "password"}
                            placeholder="วางรหัส LINE Notify Token..."
                            value={token}
                            onChange={(e) => handleTokenChange(cls, e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white pl-4 pr-10 py-2 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => toggleVisibility(cls)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold cursor-pointer"
                          >
                            {visibleTokens[cls] ? "ซ่อน" : "แสดง"}
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveClassroomToken(cls)}
                            disabled={isSaving || isTesting}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer"
                          >
                            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                          </button>
                          
                          <button
                            onClick={() => handleTestToken(cls)}
                            disabled={isSaving || isTesting || !token}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 transition-colors cursor-pointer"
                          >
                            {isTesting ? "กำลังส่ง..." : "ทดสอบส่งไลน์"}
                          </button>
                        </div>
                      </div>

                      {/* Feedback status messages */}
                      {status?.text && (
                        <div className={`lg:w-56 shrink-0 rounded-xl px-3 py-2 text-center text-[10px] font-bold border ${
                          status.type === "success"
                            ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                            : "bg-red-50 border-red-100 text-red-800"
                        }`}>
                          {status.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
