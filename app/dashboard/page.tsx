"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Load TrendChart dynamically with SSR disabled to prevent hydration errors (standard best practice for Recharts in Next.js)
const TrendChart = dynamic(() => import("@/components/dashboard/TrendChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center bg-slate-50/50 rounded-xl animate-pulse">
      <span className="text-xs font-semibold text-slate-400">กำลังโหลดแผนภูมิสถิติ...</span>
    </div>
  ),
});

interface DashboardScan {
  id: string;
  studentId: string;
  name: string;
  email: string;
  time: string;
  confidence: number;
  classroom?: string;
  status?: 'present' | 'late' | 'absent' | 'leave';
}

interface DashboardMetrics {
  totalStudents: number;
  presentToday: number;
  lateToday: number;
  attendanceRate: number;
  trendData: { day: string; rate: number }[];
  recentScans: DashboardScan[];
}

export default function DashboardPage() {
  const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)";
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"all" | "kindergarten" | "primary" | "secondary">("all");
  
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalStudents: 0,
    presentToday: 0,
    lateToday: 0,
    attendanceRate: 0,
    trendData: [],
    recentScans: [],
  });
  const [loading, setLoading] = useState(true);

  // 1. Fetch dashboard metrics from API Route
  const fetchMetrics = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?level=${selectedLevel}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics({
          totalStudents: data.totalStudents || 0,
          presentToday: data.presentToday || 0,
          lateToday: data.lateToday || 0,
          attendanceRate: data.attendanceRate || 0,
          trendData: data.trendData || [],
          recentScans: data.recentScans || [],
        });
      }
    } catch (err) {
      console.error("Error fetching dashboard metrics:", err);
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  // 2. Set up continuous polling (every 5 seconds) to ensure real-time updates on stage
  useEffect(() => {
    fetchMetrics(true);

    const interval = setInterval(() => {
      fetchMetrics(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedLevel]);

  // 3. Wipes database and clears local states
  const handleWipeData = async () => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
      });

      if (response.ok) {
        setResetSuccess(true);
        // Refresh local metrics view immediately
        await fetchMetrics(false);
        
        setTimeout(() => {
          setResetSuccess(false);
          setShowResetConfirm(false);
        }, 1500);
      } else {
        alert("มีข้อผิดพลาดในการล้างฐานข้อมูล");
      }
    } catch (err) {
      console.error("Reset API error:", err);
      alert("ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อล้างข้อมูลได้");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in relative">
      {/* Upper header: Title on Left, Reset Action on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            แดชบอร์ดสรุปสถิติสำหรับผู้สอน
          </h1>
          <p className="text-sm font-medium text-slate-500">
            ดูภาพรวมจำนวนเข้าห้องเรียน แนวโน้มสถิติย้อนหลัง และตรวจสอบข้อมูลการแสกนใบหน้าแบบเรียลไทม์
          </p>
        </div>

        {/* Reset Demo button */}
        <button
          onClick={() => setShowResetConfirm(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700 transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          ล้างข้อมูลเพื่อเริ่มเดโม่ใหม่ (Reset)
        </button>
      </div>

      {/* Division Level Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "all", label: "ทุกระดับชั้น" },
          { id: "kindergarten", label: "ระดับอนุบาล (อ.2-อ.3)" },
          { id: "primary", label: "ระดับประถม (ป.1-ป.6)" },
          { id: "secondary", label: "ระดับมัธยม (ม.1-ม.6)" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedLevel(tab.id as any)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
              selectedLevel === tab.id
                ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-bold">กำลังประมวลผลข้อมูลแดชบอร์ดสด...</span>
        </div>
      ) : (
        <>
          {/* 4 KPI Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2 animate-fade-in">
            {/* Card 1: Registered Students */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500">นักเรียนทั้งหมด</span>
                <span className="text-2xl font-extrabold text-slate-900">{metrics.totalStudents} คน</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-1">ที่ลงทะเบียนโครงหน้าไว้</span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
            </div>

            {/* Card 2: Present Today */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500">มาเรียนวันนี้</span>
                <span className="text-2xl font-extrabold text-slate-900">{metrics.presentToday} คน</span>
                <span className="text-[10px] text-emerald-600 font-bold mt-1">
                  มาตรงเวลา: {metrics.presentToday - metrics.lateToday} คน
                </span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
            </div>

            {/* Card 3: Late Today */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500">มาเรียนสายวันนี้</span>
                <span className="text-2xl font-extrabold text-amber-600">{metrics.lateToday} คน</span>
                <span className="text-[10px] text-amber-600 font-bold mt-1">
                  {metrics.presentToday > 0
                    ? `คิดเป็น ${Math.round((metrics.lateToday / metrics.presentToday) * 100)}% ของผู้มาเรียน`
                    : "ไม่มีผู้เข้าเรียนสาย"
                  }
                </span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
            </div>

            {/* Card 4: Attendance Rate */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500">อัตราการเข้าเรียนวันนี้</span>
                <span className="text-2xl font-extrabold text-slate-900">{metrics.attendanceRate}%</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-1">สัดส่วนสรุปจากสิทธิ์สแกน</span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20v-6h4v6h5v-8h3L12 3 0 12h3v8z"/></svg>
              </div>
            </div>
          </div>

          {/* Main Grid: Trend Chart & Logs */}
          <div className="grid gap-6 mt-2 animate-fade-in">
            {/* Trend Area Chart Container */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">อัตราการเข้าห้องเรียนย้อนหลัง 7 วัน</h3>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    เปอร์เซ็นต์สถิติสรุปภาพรวมในแต่ละวันสัปดาห์นี้
                  </p>
                </div>
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                  {schoolName}
                </span>
              </div>
              <TrendChart data={metrics.trendData} />
            </div>

            {/* Real-time feed table */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">ตารางประวัติผู้แสกนใบหน้า 10 คนล่าสุด</h3>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    รายชื่อสแกนใบหน้าสำเร็จแบบสด ๆ เรียงลำดับจากเวลาล่าสุด
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto -mx-6">
                <div className="inline-block min-w-full align-middle px-6">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead>
                      <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-2">เวลาสแกน</th>
                        <th className="py-3 px-2">รหัสนักเรียน</th>
                        <th className="py-3 px-2">ชื่อ-นามสกุล</th>
                        <th className="py-3 px-2">ห้องเรียน</th>
                        <th className="py-3 px-2">สถานะ</th>
                        <th className="py-3 px-2 hidden sm:table-cell">อีเมล</th>
                        <th className="py-3 px-2 text-right">ความแม่นยำ AI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {metrics.recentScans.length > 0 ? (
                        metrics.recentScans.map((scan) => (
                          <tr key={scan.id} className="hover:bg-slate-50/50 transition-colors animate-fade-in">
                            <td className="py-3.5 px-2 text-slate-900 font-bold">{scan.time}</td>
                            <td className="py-3.5 px-2 text-slate-500">{scan.studentId}</td>
                            <td className="py-3.5 px-2 font-bold text-slate-900">{scan.name}</td>
                            <td className="py-3.5 px-2">
                              {scan.classroom ? (
                                <span className="rounded bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                  {scan.classroom}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-2">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                scan.status === "late"
                                  ? "bg-amber-50 border border-amber-100 text-amber-600"
                                  : "bg-emerald-50 border border-emerald-100 text-emerald-600"
                              }`}>
                                {scan.status === "late" ? "สาย" : "มาเรียน"}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-slate-400 hidden sm:table-cell">{scan.email}</td>
                            <td className="py-3.5 px-2 text-right text-emerald-600 font-bold">
                              {scan.confidence}% (OK)
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            ยังไม่มีรายชื่อเช็คชื่อเข้าห้องเรียนในวันนี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal overlay (simulating Database Wiping for right to be forgotten presentation) */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-xl flex flex-col gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 self-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5 4 4-4 4"/><path d="M19 9H5.5A3.5 3.5 0 0 0 2 12.5v0A3.5 3.5 0 0 0 5.5 16H9"/></svg>
            </div>
            
            <div className="text-center flex flex-col gap-1">
              <h3 className="text-base font-bold text-slate-900">ยืนยันการล้างข้อมูลทั้งหมด?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                การล้างข้อมูลจะลบไฟล์รายชื่อนักเรียนใบหน้า และประวัติการสแกนเข้าเรียนทั้งหมดออกจากดิสก์ทันที เพื่อความปลอดภัยด้านข้อมูลบุคคล (PDPA)
              </p>
            </div>

            {resetSuccess ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center text-xs font-bold text-emerald-700 animate-fade-in">
                ✓ ล้างฐานข้อมูลจำลอง (Reset) สำเร็จ!
              </div>
            ) : (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleWipeData}
                  disabled={isResetting}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm shadow-red-500/20 hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isResetting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      กำลังล้าง...
                    </>
                  ) : (
                    "ล้างไฟล์ JSON"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
