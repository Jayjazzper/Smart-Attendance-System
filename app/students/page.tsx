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
                          {student.classroom ? (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:bg-transparent print:p-0">
          {/* Custom style tag for print layout formatting */}
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
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
          
          <div className="w-full max-w-md rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl flex flex-col gap-4 no-print">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
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
            <div className="flex justify-center py-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/50">
              {/* Actual Virtual Card */}
              <div
                id="student-card-print-area"
                className="w-[280px] h-[430px] rounded-2xl bg-white text-slate-800 border-2 border-blue-500/30 shadow-lg flex flex-col relative overflow-hidden bg-cover bg-center"
                style={{
                  backgroundImage: "linear-gradient(135deg, rgba(239, 246, 255, 0.5) 0%, rgba(255, 255, 255, 0.9) 100%)"
                }}
              >
                {/* School Header Stripe */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-3 text-white flex items-center gap-2 relative">
                  {/* School Logo */}
                  {schoolSettings.schoolLogo ? (
                    <img
                      src={schoolSettings.schoolLogo}
                      alt="Logo"
                      className="w-8 h-8 rounded-full object-cover bg-white p-0.5 shrink-0 border border-white/20"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-[10px] font-extrabold leading-none truncate block">
                      {schoolSettings.schoolName}
                    </span>
                    <span className="text-[7px] text-blue-100 leading-none truncate block mt-0.5 font-medium">
                      {schoolSettings.schoolDistrict}
                    </span>
                  </div>
                  {/* Top corner design accent */}
                  <div className="absolute right-0 top-0 w-8 h-8 bg-white/5 rounded-bl-full pointer-events-none"></div>
                </div>

                {/* Card Body */}
                <div className="flex-1 flex flex-col items-center justify-between p-4 pt-5">
                  {/* Photo Container */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-gradient-to-tr from-blue-100 to-indigo-50 flex items-center justify-center overflow-hidden">
                      {/* Generates gender-neutral/avatar icon based on name prefix */}
                      {selectedStudentForCard.name.includes("หญิง") || selectedStudentForCard.name.includes("สาว") || selectedStudentForCard.name.includes("ด.ญ.") ? (
                        // Female Avatar Icon SVG
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M12 12c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      ) : (
                        // Male Avatar Icon SVG
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M12 12c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      )}
                    </div>
                    
                    {/* Student Info */}
                    <div className="text-center mt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">STUDENT CARD</span>
                      <h4 className="text-sm font-extrabold text-slate-800 leading-tight mt-0.5">{selectedStudentForCard.name}</h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">
                        ชั้นเรียน: {selectedStudentForCard.classroom || "-"} | รหัส: {selectedStudentForCard.id}
                      </p>
                    </div>
                  </div>

                  {/* QR & Barcode Container */}
                  <div className="w-[248px] flex flex-col gap-2 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between gap-2.5">
                      {/* QR Code */}
                      <div className="flex flex-col items-center shrink-0">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(selectedStudentForCard.id)}`}
                          alt="Student ID QR Code"
                          className="w-[70px] h-[70px] object-contain"
                          loading="lazy"
                        />
                      </div>
                      
                      {/* Divider line */}
                      <div className="w-[1px] h-12 bg-slate-100"></div>

                      {/* Barcode */}
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <img
                          src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(selectedStudentForCard.id)}&scale=3&rotate=N`}
                          alt="Student ID Barcode"
                          className="w-[110px] h-[50px] object-contain"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider text-center block mt-0.5">
                      SCAN FOR ATTENDANCE (QR & BARCODE)
                    </span>
                  </div>
                </div>

                {/* Card Footer Design */}
                <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-700 w-full"></div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-2">
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
      </div>
    </AdminGuard>
  );
}
