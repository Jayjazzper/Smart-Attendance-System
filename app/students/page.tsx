"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Student } from "@/lib/types";
import AdminGuard from "@/components/AdminGuard";

export default function StudentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [levelFilter, setLevelFilter] = useState<"all" | "kindergarten" | "primary" | "secondary">("all");
  const [lockedClassroom, setLockedClassroom] = useState<string | null>(null);
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);
  const [selectedStudentForCalendar, setSelectedStudentForCalendar] = useState<Student | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleOpenCalendar = async (student: Student) => {
    setSelectedStudentForCalendar(student);
    setLoadingCalendar(true);
    setSelectedDate(null);
    try {
      const res = await fetch("/api/attendance");
      if (res.ok) {
        const data = await res.json();
        // filter for this student
        const studentLogs = (data.attendance || []).filter((log: any) => log.studentId === student.id);
        setAttendanceLogs(studentLogs);
      }
    } catch (err) {
      console.error("Error fetching attendance for student:", err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const [schoolSettings, setSchoolSettings] = useState({
    schoolName: "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)",
    schoolDistrict: "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1",
    schoolLogo: ""
  });
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 1. Fetch live students from API
  const fetchStudents = async () => {
    try {
      const res = await fetch("/api/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error("Error loading students list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    const savedSession = localStorage.getItem("teacherSession");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.role === "teacher" && parsed.classroom) {
          setLockedClassroom(parsed.classroom);
        }
      } catch (e) {}
    }

    const fetchSchoolSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSchoolSettings({
            schoolName: data.schoolName || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)",
            schoolDistrict: data.schoolDistrict || "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1",
            schoolLogo: data.schoolLogo || ""
          });
        }
      } catch (e) {}
    };
    fetchSchoolSettings();

    const fetchCurrentUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.loggedIn && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (e) {}
    };
    fetchCurrentUser();
  }, []);

  // Search and Level filter
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.id.includes(searchTerm) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = levelFilter === "all" || s.level === levelFilter;
    const matchesClassroom = !lockedClassroom || s.classroom === lockedClassroom;
    
    return matchesSearch && matchesLevel && matchesClassroom;
  });

  // 2. Perform actual deletion request to Next.js API route
  const handleDeleteStudent = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/students/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Refresh local student listing
        await fetchStudents();
        setShowDeleteConfirm(null);
      } else {
        const errData = await response.json();
        alert(errData.error || "ไม่สามารถลบข้อมูลนักเรียนได้");
      }
    } catch (err) {
      console.error("Delete API error:", err);
      alert("ไม่สามารถติดต่อเครื่องเซิร์ฟเวอร์เพื่อลบข้อมูลได้");
    } finally {
      setIsDeleting(false);
    }
  };

  const checkCanEdit = (studentClassroom?: string) => {
    if (typeof window !== "undefined" && localStorage.getItem("adminValidated") === "true") {
      return true;
    }
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    if (currentUser.role === "teacher") {
      return studentClassroom ? currentUser.classrooms?.includes(studentClassroom) : false;
    }
    return false;
  };

  return (
    <AdminGuard allowTeacher={true}>
      <div className="flex flex-col gap-6 py-6 animate-fade-in relative text-slate-900 dark:text-slate-100">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            จัดการรายชื่อนักเรียน (CRUD)
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            ดูรายชื่อที่ลงทะเบียนทั้งหมด ตรวจสอบ แก้ไขข้อมูลพื้นฐาน หรือลบข้อมูลนักเรียน (ลบรูปหน้าสแกน) ออกจากระบบ
          </p>
        </div>

        {/* Register CTA */}
        <Link
          href="/register"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          ลงทะเบียนนักเรียนใหม่
        </Link>
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col gap-4 mt-2">
        {/* Table filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="ค้นหาด้วยรหัส ชื่อ หรืออีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-9 pr-3.5 py-2 text-xs font-semibold placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors text-slate-800 dark:text-white"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
             <span className="text-xs font-bold text-slate-400">
              แสดง {filteredStudents.length} จาก {lockedClassroom ? students.filter(s => s.classroom === lockedClassroom).length : students.length} รายการ
            </span>
          </div>

          {/* Level Filters / Classroom Lock Status */}
          {lockedClassroom ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-800 shadow-sm whitespace-nowrap">
              เฉพาะห้องเรียน {lockedClassroom}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "all", label: "ทุกระดับชั้น" },
                { id: "kindergarten", label: "อนุบาล" },
                { id: "primary", label: "ประถม" },
                { id: "secondary", label: "มัธยม" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLevelFilter(tab.id as any)}
                  className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all border whitespace-nowrap cursor-pointer ${
                    levelFilter === tab.id
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs font-bold">กำลังโหลดข้อมูลนักเรียน...</span>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <div className="inline-block min-w-full align-middle px-6">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-2">รหัสนักเรียน</th>
                    <th className="py-3 px-2">ชื่อ-นามสกุล</th>
                    <th className="py-3 px-2">ห้องเรียน</th>
                    <th className="py-3 px-2">ระดับชั้น</th>
                    <th className="py-3 px-2 hidden sm:table-cell">อีเมล</th>
                    <th className="py-3 px-2 hidden md:table-cell">วันที่ลงทะเบียน</th>
                    <th className="py-3 px-2 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-2 text-slate-900 dark:text-white font-bold">{student.id}</td>
                        <td className="py-3.5 px-2 font-bold text-slate-900 dark:text-white">{student.name}</td>
                        <td className="py-3.5 px-2">
                          {student.classroom && String(student.classroom).toLowerCase() !== "true" && String(student.classroom).toLowerCase() !== "false" ? (
                            <span className="rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              {student.classroom}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2">
                          {student.level ? (
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                              {student.level === 'kindergarten' ? 'อนุบาล' : student.level === 'primary' ? 'ประถม' : 'มัธยม'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-slate-400 dark:text-slate-500 hidden sm:table-cell">{student.email}</td>
                        <td className="py-3.5 px-2 text-slate-400 dark:text-slate-500 hidden md:table-cell">
                          {new Date(student.registeredAt).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-2 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedStudentForCard(student)}
                            className="inline-flex h-7 px-2.5 items-center justify-center rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-bold text-[10px] cursor-pointer"
                          >
                            บัตรนักเรียน
                          </button>
                          <button
                            onClick={() => handleOpenCalendar(student)}
                            className="inline-flex h-7 px-2.5 items-center justify-center rounded-lg border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors font-bold text-[10px] cursor-pointer"
                          >
                            ประวัติเวลาเรียน
                          </button>
                          {checkCanEdit(student.classroom) && (
                            <>
                              <Link
                                href={`/students/${student.id}`}
                                className="inline-flex h-7 px-2.5 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors font-bold text-[10px]"
                              >
                                แก้ไข
                              </Link>
                              <button
                                onClick={() => setShowDeleteConfirm(student.id)}
                                className="inline-flex h-7 px-2.5 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors font-bold text-[10px] cursor-pointer"
                              >
                                ลบ
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Delete Confirmation Modal overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl flex flex-col gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 self-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </div>
            
            <div className="text-center flex flex-col gap-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">ยืนยันการลบข้อมูลนักเรียน?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                การลบจะนำโครงหน้าเวกเตอร์และลบประวัติการเช็คเรียนของนักเรียนรหัส {showDeleteConfirm} ออกจากระบบถาวรทันที ไม่สามารถกู้คืนได้ (Right to be Forgotten)
              </p>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDeleteStudent(showDeleteConfirm)}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm shadow-red-500/20 hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังลบ...
                  </>
                ) : (
                  "ยืนยันการลบ"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Student ID Card Modal */}
      {selectedStudentForCard && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in print:bg-transparent print:p-0">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #student-card-print-area, #student-card-print-area * {
                visibility: visible;
              }
              #student-card-print-area {
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) scale(1.5);
                box-shadow: none !important;
                border: 1px solid #cbd5e1 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              .print-wrapper-reset {
                display: contents !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
          
          <div className="my-auto w-full max-w-md rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl flex flex-col gap-4 print-wrapper-reset">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 no-print">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 21v-2a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2"/></svg>
                บัตรประจำตัวนักเรียนดิจิทัล
              </h3>
              <button
                onClick={() => setSelectedStudentForCard(null)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-350 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Virtual Card Wrapper */}
            <div className="flex justify-center py-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/50 print-wrapper-reset">
              {/* Actual Virtual Card */}
              <div
                id="student-card-print-area"
                className="w-[280px] h-[430px] rounded-2xl bg-white text-slate-800 border border-slate-200/80 shadow-xl flex flex-col relative overflow-hidden transition-all duration-300 animate-fade-in"
                style={{
                  backgroundImage: "radial-gradient(circle at 10% 20%, rgba(238, 242, 255, 0.7) 0%, rgba(255, 255, 255, 0.95) 100%)",
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact"
                }}
              >
                {/* Tech microgrid pattern watermark overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none"></div>

                {/* Ambient glow decoration blobs */}
                <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full bg-blue-400/10 blur-xl pointer-events-none"></div>
                <div className="absolute -bottom-10 -right-10 w-24 h-24 rounded-full bg-indigo-400/10 blur-xl pointer-events-none"></div>

                {/* RFID micro-chip graphics accent */}
                <div className="absolute top-[88px] right-5 w-8 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-500 border border-amber-600/20 p-1 flex flex-col justify-between shadow-sm opacity-70 pointer-events-none">
                  <div className="h-[1px] bg-amber-800/25 w-full"></div>
                  <div className="flex justify-between h-full py-0.5">
                    <div className="w-[1px] bg-amber-800/25 h-full"></div>
                    <div className="w-[1px] bg-amber-800/25 h-full"></div>
                    <div className="w-[1px] bg-amber-800/25 h-full"></div>
                  </div>
                  <div className="h-[1px] bg-amber-800/25 w-full"></div>
                </div>

                {/* School Header Stripe */}
                <div 
                  className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-3 text-white flex items-center gap-2.5 relative border-b border-indigo-500/20"
                  style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                >
                  {/* School Logo */}
                  {schoolSettings.schoolLogo ? (
                    <img
                      src={schoolSettings.schoolLogo}
                      alt="Logo"
                      className="w-9 h-9 rounded-full object-cover bg-white p-0.5 shrink-0 border border-white/10"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/15">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-300"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-[10px] font-black leading-tight tracking-wide truncate block text-slate-100">
                      {schoolSettings.schoolName}
                    </span>
                    <span className="text-[7px] text-slate-450 leading-none truncate block mt-0.5 font-bold tracking-wider">
                      {schoolSettings.schoolDistrict}
                    </span>
                  </div>
                  {/* Top corner design accent */}
                  <div className="absolute right-0 top-0 w-8 h-8 bg-white/5 rounded-bl-full pointer-events-none"></div>
                </div>

                {/* Card Body */}
                <div className="flex-1 flex flex-col items-center justify-between p-4 pt-5 z-10">
                  {/* Photo Container */}
                  <div className="flex flex-col items-center gap-2.5">
                    {/* Glowing Premium Border Ring */}
                    <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 shadow-md">
                      <div className="w-full h-full rounded-full border-2 border-white/95 bg-gradient-to-tr from-blue-50 to-indigo-50 flex items-center justify-center overflow-hidden">
                        {selectedStudentForCard.avatarUrl ? (
                          <img
                            src={selectedStudentForCard.avatarUrl}
                            alt={selectedStudentForCard.name}
                            className="w-full h-full object-cover"
                          />
                        ) : selectedStudentForCard.name.includes("หญิง") || selectedStudentForCard.name.includes("สาว") || selectedStudentForCard.name.includes("ด.ญ.") ? (
                          // Female avatar with premium gradient styling
                          <div className="w-full h-full bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 text-rose-500/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M12 12c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                          </div>
                        ) : (
                          // Male avatar with premium gradient styling
                          <div className="w-full h-full bg-gradient-to-br from-sky-100 to-blue-200 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 text-blue-500/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M12 12c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Student Info */}
                    <div className="text-center mt-1">
                      <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] font-mono block">STUDENT IDENTIFICATION</span>
                      <h4 className="text-sm font-black text-slate-800 leading-tight mt-1">{selectedStudentForCard.name}</h4>
                      
                      {/* Classroom & ID Pills Layout */}
                      <div className="flex items-center gap-1.5 justify-center mt-2.5">
                        {/* Classroom Pill */}
                        <span className="bg-blue-50/80 text-blue-700 border border-blue-100/80 rounded-lg px-2.5 py-0.5 text-[9px] font-extrabold flex items-center gap-1 shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          ชั้น: {
                            (selectedStudentForCard.classroom && 
                            String(selectedStudentForCard.classroom).toLowerCase() !== "true" && 
                            String(selectedStudentForCard.classroom).toLowerCase() !== "false") 
                              ? String(selectedStudentForCard.classroom) 
                              : "-"
                          }
                        </span>
                        {/* ID Pill */}
                        <span className="bg-slate-50/80 text-slate-700 border border-slate-200/60 rounded-lg px-2.5 py-0.5 text-[9px] font-extrabold font-mono flex items-center gap-1 shadow-sm">
                          ID: {selectedStudentForCard.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QR & Barcode Container (High-tech style) */}
                  <div className="w-[248px] flex flex-col gap-2 bg-slate-50/50 backdrop-blur-md p-2.5 rounded-2xl border border-slate-200/40 shadow-sm relative">
                    <div className="flex items-center justify-between gap-2">
                      {/* QR Code */}
                      <div className="flex flex-col items-center shrink-0 p-0.5 bg-white rounded-lg border border-slate-100">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(selectedStudentForCard.id)}`}
                          alt="Student ID QR Code"
                          className="w-[65px] h-[65px] object-contain"
                          loading="lazy"
                        />
                      </div>
                      
                      {/* Divider line */}
                      <div className="w-[1px] h-10 bg-slate-200/80"></div>

                      {/* Barcode */}
                      <div className="flex-1 flex flex-col items-center justify-center p-1 bg-white rounded-lg border border-slate-100">
                        <img
                          src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(selectedStudentForCard.id)}&scale=3&rotate=N`}
                          alt="Student ID Barcode"
                          className="w-[110px] h-[45px] object-contain"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest text-center block mt-0.5">
                      ★ SMART SCAN ACCESS PANEL ★
                    </span>
                  </div>
                </div>

                {/* Card Footer Design */}
                <div 
                  className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 py-1.5 px-3 flex items-center justify-between border-t border-indigo-500/10"
                  style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
                >
                  <span className="text-[6px] font-bold text-slate-400 tracking-widest uppercase">SMART ID CARD</span>
                  <span className="text-[6px] font-bold text-indigo-400 tracking-wider">SECURE CAMPUS SYSTEM</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-2 no-print">
              <button
                onClick={() => setSelectedStudentForCard(null)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                พิมพ์บัตรประจำตัว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Attendance Calendar Modal */}
      {selectedStudentForCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl flex flex-col gap-4 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex flex-col text-left">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M21 12H3"/><path d="M12 3v18"/></svg>
                  ปฏิทินสถิติเวลาเรียนรายบุคคล
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                  นักเรียน: {selectedStudentForCalendar.name} | รหัส: {selectedStudentForCalendar.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentForCalendar(null)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-350 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingCalendar ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs font-bold">กำลังโหลดประวัติเวลาเรียน...</span>
              </div>
            ) : (
              <>
                {/* Calendar Navigation */}
                <div className="flex items-center justify-between px-2">
                  <button
                    onClick={() => {
                      if (calendarMonth === 0) {
                        setCalendarMonth(11);
                        setCalendarYear(calendarYear - 1);
                      } else {
                        setCalendarMonth(calendarMonth - 1);
                      }
                    }}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-655 dark:text-slate-350 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span className="text-xs font-black text-slate-805 dark:text-white">
                    {["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"][calendarMonth]} {calendarYear + 543}
                  </span>
                  <button
                    onClick={() => {
                      if (calendarMonth === 11) {
                        setCalendarMonth(0);
                        setCalendarYear(calendarYear + 1);
                      } else {
                        setCalendarMonth(calendarMonth + 1);
                      }
                    }}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-655 dark:text-slate-355 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    <div>อา.</div>
                    <div>จ.</div>
                    <div>อ.</div>
                    <div>พ.</div>
                    <div>พฤ.</div>
                    <div>ศ.</div>
                    <div>ส.</div>
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {(() => {
                      const firstDay = new Date(calendarYear, calendarMonth, 1);
                      const startDayOfWeek = firstDay.getDay();
                      const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                      
                      const cells = [];
                      // Empty cells for preceding month
                      for (let i = 0; i < startDayOfWeek; i++) {
                        cells.push(<div key={`empty-${i}`} className="aspect-square" />);
                      }

                      // Map logs for quick lookups
                      const dailyLogs: Record<string, { arrival?: any; checkout?: any }> = {};
                      attendanceLogs.forEach((log) => {
                        try {
                          const d = new Date(log.timestamp);
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const date = String(d.getDate()).padStart(2, '0');
                          const dateStr = `${y}-${m}-${date}`;
                          
                          if (!dailyLogs[dateStr]) {
                            dailyLogs[dateStr] = {};
                          }
                          if (log.status === "checked_out") {
                            dailyLogs[dateStr].checkout = log;
                          } else {
                            // Official morning status
                            const existing = dailyLogs[dateStr].arrival;
                            if (!existing || new Date(log.timestamp) < new Date(existing.timestamp)) {
                              dailyLogs[dateStr].arrival = log;
                            }
                          }
                        } catch (e) {}
                      });

                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                      // Populate month days
                      for (let day = 1; day <= totalDays; day++) {
                        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const logs = dailyLogs[dateStr];
                        const arrivalStatus = logs?.arrival?.status;
                        const checkoutLog = logs?.checkout;

                        let bgStyle = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800";
                        let ringStyle = "";

                        // Highlight today
                        if (dateStr === todayStr) {
                          ringStyle = "ring-2 ring-blue-500 shadow-sm";
                        }

                        // Style depending on arrival status
                        if (arrivalStatus === "present") {
                          bgStyle = "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20";
                        } else if (arrivalStatus === "late") {
                          bgStyle = "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20";
                        } else if (arrivalStatus === "absent") {
                          bgStyle = "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20";
                        } else if (arrivalStatus === "leave") {
                          bgStyle = "bg-sky-500/10 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border-sky-500/30 hover:bg-sky-500/20";
                        } else if (checkoutLog) {
                          bgStyle = "bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20";
                        } else {
                          // Standard non-log days
                          const dayOfWeek = new Date(calendarYear, calendarMonth, day).getDay();
                          if (dayOfWeek === 0 || dayOfWeek === 6) {
                            bgStyle = "bg-slate-100/50 dark:bg-slate-900 border-transparent text-slate-400 dark:text-slate-650 hover:bg-slate-200/50 dark:hover:bg-slate-800/50";
                          }
                        }

                        cells.push(
                          <button
                            key={`day-${day}`}
                            onClick={() => setSelectedDate(dateStr)}
                            className={`aspect-square w-full rounded-xl flex flex-col items-center justify-center text-xs font-black border transition-all relative cursor-pointer ${bgStyle} ${ringStyle}`}
                          >
                            <span>{day}</span>
                            {/* Checked out indicator (purple dot) */}
                            {checkoutLog && arrivalStatus && (
                              <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-purple-500" title="เช็คเอาท์กลับบ้านแล้ว" />
                            )}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850/30">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/30" />
                    <span>มาเรียนปกติ</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/30" />
                    <span>มาเรียนสาย</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500/20 border border-rose-500/30" />
                    <span>ขาดเรียน</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-sky-500/20 border border-sky-500/30" />
                    <span>ลาเรียน</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-purple-500/20 border border-purple-500/30" />
                    <span>กลับบ้านอย่างเดียว</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span>เช็คเอาท์กลับบ้านแล้ว</span>
                  </div>
                </div>

                {/* Selected Date Details */}
                <div className="border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl text-left flex flex-col gap-2.5 min-h-[90px]">
                  {selectedDate ? (() => {
                    const logs = attendanceLogs.filter((log) => {
                      try {
                        const d = new Date(log.timestamp);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const date = String(d.getDate()).padStart(2, '0');
                        return `${y}-${m}-${date}` === selectedDate;
                      } catch (e) {
                        return false;
                      }
                    });

                    const formattedDateThai = (() => {
                      try {
                        const parts = selectedDate.split("-");
                        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        return d.toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        });
                      } catch (e) {
                        return selectedDate;
                      }
                    })();

                    const morningLog = logs.find((l) => l.status !== "checked_out");
                    const eveningLog = logs.find((l) => l.status === "checked_out");

                    return (
                      <>
                        <h4 className="text-xs font-black text-slate-850 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          รายละเอียดวันที่ {formattedDateThai}
                        </h4>
                        
                        {logs.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold py-2 text-center">ไม่มีการสแกนหรือบันทึกข้อมูลเวลาเรียนในวันนี้</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
                            {/* Morning */}
                            <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">การเช็คชื่อเข้าเรียน (เช้า)</span>
                              {morningLog ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-800 dark:text-white">สถานะ:</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                                      morningLog.status === "present" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                                      morningLog.status === "late" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                                      morningLog.status === "leave" ? "bg-sky-500/20 text-sky-700 dark:text-sky-300" :
                                      "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                                    }`}>
                                      {morningLog.status === "present" ? "มาเรียนปกติ ✓" :
                                       morningLog.status === "late" ? "มาเรียนสาย ⚠️" :
                                       morningLog.status === "leave" ? "ลาเรียน ✉️" : "ขาดเรียน ❌"}
                                    </span>
                                  </div>
                                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 flex flex-col gap-0.5 font-medium">
                                    <span>⏰ เวลาสแกน: {new Date(morningLog.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} น.</span>
                                    {morningLog.temperature && <span>🌡️ อุณหภูมิร่างกาย: {morningLog.temperature} °C</span>}
                                    {morningLog.healthStatus && <span>🩺 อาการภายนอก: {
                                      morningLog.healthStatus === "normal" ? "ปกติ 🟢" :
                                      morningLog.healthStatus === "fever" ? "ตัวร้อน/มีไข้ 🔴" : "ไอ/จาม 🟡"
                                    }</span>}
                                    <span>🎯 ความเชื่อมั่นใบหน้า: {morningLog.confidence}%</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 italic text-[11px] font-medium mt-1">ไม่มีบันทึกข้อมูลเข้าเรียนตอนเช้า</span>
                              )}
                            </div>

                            {/* Evening */}
                            <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">การเช็คเอาท์กลับบ้าน (เย็น)</span>
                              {eveningLog ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-850 dark:text-white">สถานะ:</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-700 dark:text-purple-300">
                                      กลับบ้านแล้ว 🏠
                                    </span>
                                  </div>
                                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 flex flex-col gap-0.5 font-medium">
                                    <span>⏰ เวลาสแกน: {new Date(eveningLog.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} น.</span>
                                    <span>🎯 ความเชื่อมั่นใบหน้า: {eveningLog.confidence}%</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 italic text-[11px] font-medium mt-1">ไม่มีบันทึกข้อมูลสแกนกลับบ้าน</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })() : (
                    <div className="flex-1 flex items-center justify-center py-2 text-slate-400 dark:text-slate-500 text-xs font-bold">
                      💡 คลิกเลือกวันที่ในตารางปฏิทินด้านบน เพื่อดูบันทึกประวัติและอุณหภูมิร่างกายโดยละเอียด
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end mt-1 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                onClick={() => setSelectedStudentForCalendar(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-750 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminGuard>
  );
}
