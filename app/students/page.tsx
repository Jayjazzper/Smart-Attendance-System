"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Student } from "@/lib/types";

export default function StudentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [levelFilter, setLevelFilter] = useState<"all" | "kindergarten" | "primary" | "secondary">("all");

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
  }, []);

  // Search and Level filter
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.id.includes(searchTerm) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = levelFilter === "all" || s.level === levelFilter;
    
    return matchesSearch && matchesLevel;
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

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in relative">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            จัดการรายชื่อนักเรียน (CRUD)
          </h1>
          <p className="text-sm font-medium text-slate-500">
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
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-4 mt-2">
        {/* Table filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="ค้นหาด้วยรหัส ชื่อ หรืออีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs font-semibold placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
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
              แสดง {filteredStudents.length} จาก {students.length} รายการ
            </span>
          </div>

          {/* Level Filters */}
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
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-2 text-slate-900 font-bold">{student.id}</td>
                        <td className="py-3.5 px-2 font-bold text-slate-900">{student.name}</td>
                        <td className="py-3.5 px-2">
                          {student.classroom ? (
                            <span className="rounded bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                              {student.classroom}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2">
                          {student.level ? (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {student.level === 'kindergarten' ? 'อนุบาล' : student.level === 'primary' ? 'ประถม' : 'มัธยม'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-slate-400 hidden sm:table-cell">{student.email}</td>
                        <td className="py-3.5 px-2 text-slate-400 hidden md:table-cell">
                          {new Date(student.registeredAt).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-2 text-right flex items-center justify-end gap-2">
                          <Link
                            href={`/students/${student.id}`}
                            className="inline-flex h-7 px-2.5 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors font-bold text-[10px]"
                          >
                            แก้ไข
                          </Link>
                          <button
                            onClick={() => setShowDeleteConfirm(student.id)}
                            className="inline-flex h-7 px-2.5 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-bold text-[10px] cursor-pointer"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
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
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-xl flex flex-col gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 self-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </div>
            
            <div className="text-center flex flex-col gap-1">
              <h3 className="text-base font-bold text-slate-900">ยืนยันการลบข้อมูลนักเรียน?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                การลบจะนำโครงหน้าเวกเตอร์และลบประวัติการเช็คเรียนของนักเรียนรหัส {showDeleteConfirm} ออกจากระบบถาวรทันที ไม่สามารถกู้คืนได้ (Right to be Forgotten)
              </p>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
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
    </div>
  );
}
