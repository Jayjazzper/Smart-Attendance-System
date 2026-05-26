"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import AdminGuard from "@/components/AdminGuard";

// Load TrendChart dynamically with SSR disabled to prevent hydration errors (standard best practice for Recharts in Next.js)
const TrendChart = dynamic(() => import("@/components/dashboard/TrendChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center bg-slate-50/50 rounded-xl animate-pulse">
      <span className="text-xs font-semibold text-slate-400">กำลังโหลดแผนภูมิสถิติ...</span>
    </div>
  ),
});

// Load HealthTrendChart dynamically
const HealthTrendChart = dynamic(() => import("@/components/dashboard/HealthTrendChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center bg-slate-50/50 rounded-xl animate-pulse">
      <span className="text-xs font-semibold text-slate-400">กำลังโหลดแผนภูมิแนวโน้มสุขภาพ...</span>
    </div>
  ),
});

// Load PeakTimeChart dynamically
const PeakTimeChart = dynamic(() => import("@/components/dashboard/PeakTimeChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center bg-slate-50/50 rounded-xl animate-pulse">
      <span className="text-xs font-semibold text-slate-400">กำลังโหลดแผนภูมิช่วงเวลา...</span>
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

interface ClassroomRank {
  classroom: string;
  total: number;
  present: number;
  late: number;
  leave: number;
  rate: number;
}

interface RiskAlert {
  studentId: string;
  name: string;
  classroom: string;
  level: string;
  attendanceRate: number;
  riskLevel: 'high' | 'medium' | 'low';
  reasons: string[];
  recommendation: string;
}

interface SickStudent {
  name: string;
  classroom: string;
  status: 'fever' | 'cough';
  temp?: number;
}

interface HealthSummary {
  normal: number;
  fever: number;
  cough: number;
  sickStudents: SickStudent[];
}

interface DashboardMetrics {
  totalStudents: number;
  presentToday: number;
  lateToday: number;
  attendanceRate: number;
  trendData: { day: string; rate: number }[];
  healthTrendData?: { day: string; fever: number; cough: number }[];
  recentScans: DashboardScan[];
  leaderboard: ClassroomRank[];
  peakCheckinTimes: { name: string; count: number }[];
  riskAlerts?: RiskAlert[];
  healthSummary?: HealthSummary;
}

export default function DashboardPage() {
  const [schoolName, setSchoolName] = useState(process.env.NEXT_PUBLIC_SCHOOL_NAME || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"all" | "kindergarten" | "primary" | "secondary">("all");
  const [lockedClassroom, setLockedClassroom] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalStudents: 0,
    presentToday: 0,
    lateToday: 0,
    attendanceRate: 0,
    trendData: [],
    healthTrendData: [],
    recentScans: [],
    leaderboard: [],
    peakCheckinTimes: [],
    riskAlerts: [],
    healthSummary: {
      normal: 0,
      fever: 0,
      cough: 0,
      sickStudents: []
    }
  });
  const [loading, setLoading] = useState(true);

  const [riskLevelFilter, setRiskLevelFilter] = useState<string>("all");
  const [riskClassroomFilter, setRiskClassroomFilter] = useState<string>("all");

  const uniqueClassrooms = Array.from(
    new Set(metrics.riskAlerts?.map((a) => a.classroom).filter(Boolean) || [])
  ).sort() as string[];

  const filteredRiskAlerts = (metrics.riskAlerts || []).filter((alert) => {
    const matchesLevel = riskLevelFilter === "all" || alert.level === riskLevelFilter;
    const matchesClassroom = riskClassroomFilter === "all" || alert.classroom === riskClassroomFilter;
    return matchesLevel && matchesClassroom;
  });

  const handleExportRiskReport = () => {
    if (!filteredRiskAlerts || filteredRiskAlerts.length === 0) {
      alert("ไม่มีข้อมูลที่จะส่งออกรายงาน");
      return;
    }
    
    const BOM = "\uFEFF";
    
    const escapeCSV = (str: string | number) => {
      const s = String(str);
      const escaped = s.replace(/"/g, '""').replace(/\r?\n/g, ' ');
      return `"${escaped}"`;
    };

    const headers = [
      "รหัสประจำตัว",
      "ชื่อ-นามสกุล",
      "ห้องเรียน",
      "ระดับชั้น",
      "อัตราการเข้าเรียน",
      "ระดับความเสี่ยง",
      "สาเหตุและพฤติกรรมเสี่ยง",
      "แนวทางการช่วยเหลือเบื้องต้น"
    ];

    let csvContent = headers.map(h => escapeCSV(h)).join(",") + "\n";
    
    filteredRiskAlerts.forEach((alert) => {
      const levelText = alert.level === 'kindergarten' ? 'อนุบาล' : alert.level === 'primary' ? 'ประถม' : 'มัธยม';
      const riskText = alert.riskLevel === 'high' ? 'เสี่ยงสูง' : 'เสี่ยงปานกลาง';
      const reasonsText = alert.reasons.join(" | ");
      
      const row = [
        alert.studentId,
        alert.name,
        alert.classroom || "-",
        levelText,
        `${alert.attendanceRate}%`,
        riskText,
        reasonsText,
        alert.recommendation
      ];
      
      csvContent += row.map(cell => escapeCSV(cell)).join(",") + "\n";
    });
    
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `รายงานเด็กกลุ่มเสี่ยง_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Fetch dashboard metrics from API Route
  const fetchMetrics = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const savedSession = localStorage.getItem("teacherSession");
      let classroom = "";
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if (parsed.role === "teacher" && parsed.classroom) {
            classroom = parsed.classroom;
          }
        } catch (e) {}
      }

      const url = classroom 
        ? `/api/dashboard?classroom=${encodeURIComponent(classroom)}`
        : `/api/dashboard?level=${selectedLevel}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMetrics({
          totalStudents: data.totalStudents || 0,
          presentToday: data.presentToday || 0,
          lateToday: data.lateToday || 0,
          attendanceRate: data.attendanceRate || 0,
          trendData: data.trendData || [],
          healthTrendData: data.healthTrendData || [],
          recentScans: data.recentScans || [],
          leaderboard: data.leaderboard || [],
          peakCheckinTimes: data.peakCheckinTimes || [],
          riskAlerts: data.riskAlerts || [],
          healthSummary: data.healthSummary || { normal: 0, fever: 0, cough: 0, sickStudents: [] }
        });
      }
    } catch (err) {
      console.error("Error fetching dashboard metrics:", err);
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  // Check for classroom lock and fetch schoolName on mount
  useEffect(() => {
    const savedSession = localStorage.getItem("teacherSession");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.role === "teacher" && parsed.classroom) {
          setLockedClassroom(parsed.classroom);
        }
      } catch (e) {}
    }

    const fetchSchoolName = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.schoolName) {
            setSchoolName(data.schoolName);
          }
        }
      } catch (e) {}
    };
    fetchSchoolName();
  }, []);

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
    <AdminGuard allowTeacher>
      <div className="flex flex-col gap-6 py-6 animate-fade-in relative text-slate-900 dark:text-slate-100">
      {/* Upper header: Title on Left, Reset Action on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            แดชบอร์ดสรุปสถิติสำหรับผู้สอน
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            ดูภาพรวมจำนวนเข้าห้องเรียน แนวโน้มสถิติย้อนหลัง และตรวจสอบข้อมูลการแสกนใบหน้าแบบเรียลไทม์
          </p>
        </div>

        {/* Reset Demo button */}
        {!lockedClassroom && (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-950/20 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-700 transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            ล้างข้อมูลเพื่อเริ่มเดโม่ใหม่ (Reset)
          </button>
        )}
      </div>

      {/* Division Level Filters / Classroom Lock Status */}
      {lockedClassroom ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 px-4 py-2 text-xs font-bold text-amber-800 dark:text-amber-400 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            เฉพาะห้องเรียน {lockedClassroom} เท่านั้น (สิทธิ์เข้าถึงแยกห้องเรียน)
          </span>
        </div>
      ) : (
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
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

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
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">นักเรียนทั้งหมด</span>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{metrics.totalStudents} คน</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">ที่ลงทะเบียนโครงหน้าไว้</span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
            </div>

            {/* Card 2: Present Today */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">มาเรียนวันนี้</span>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{metrics.presentToday} คน</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                  มาตรงเวลา: {metrics.presentToday - metrics.lateToday} คน
                </span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
            </div>

            {/* Card 3: Late Today */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">มาเรียนสายวันนี้</span>
                <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{metrics.lateToday} คน</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                  {metrics.presentToday > 0
                    ? `คิดเป็น ${Math.round((metrics.lateToday / metrics.presentToday) * 100)}% ของผู้มาเรียน`
                    : "ไม่มีผู้เข้าเรียนสาย"
                  }
                </span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
            </div>

            {/* Card 4: Attendance Rate */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">อัตราการเข้าเรียนวันนี้</span>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{metrics.attendanceRate}%</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">สัดส่วนสรุปจากสิทธิ์สแกน</span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20v-6h4v6h5v-8h3L12 3 0 12h3v8z"/></svg>
              </div>
            </div>
          </div>

          {/* AI Early Warning and Absenteeism Risk Analysis System Panel */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col gap-4 mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  ระบบเตือนภัยพฤติกรรมการขาดเรียนเชิงวิเคราะห์ (AI Early Warning System)
                </h3>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  ประมวลผลวิเคราะห์หาความเสี่ยงพฤติกรรมการหยุดเรียนสะสม ขาดเรียนวันจันทร์/วันศุกร์ หรือการขาดเรียนติดต่อกัน เพื่อป้องกันความเสี่ยงในการหลุดออกนอกระบบการศึกษา
                </p>
              </div>
              <span className="rounded-lg bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-[10px] font-extrabold text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                วิเคราะห์ด้วยระบบ AI Core
              </span>
            </div>

            {/* Filter controls and Export button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/30 p-3 rounded-xl border border-slate-100/80 dark:border-slate-800/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2055/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                  ตัวกรอง:
                </span>
                
                {/* Level filter selector */}
                <select
                  value={riskLevelFilter}
                  onChange={(e) => {
                    setRiskLevelFilter(e.target.value);
                    setRiskClassroomFilter("all");
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold focus:border-blue-500 focus:outline-none transition-colors text-slate-705 dark:text-slate-350 cursor-pointer"
                >
                  <option value="all">ระดับชั้นทั้งหมด</option>
                  <option value="kindergarten">อนุบาล</option>
                  <option value="primary">ประถม</option>
                  <option value="secondary">มัธยม</option>
                </select>

                {/* Classroom filter selector */}
                <select
                  value={riskClassroomFilter}
                  onChange={(e) => setRiskClassroomFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold focus:border-blue-500 focus:outline-none transition-colors text-slate-705 dark:text-slate-355 cursor-pointer"
                >
                  <option value="all">ห้องเรียนทั้งหมด</option>
                  {uniqueClassrooms.map((cls) => (
                    <option key={cls} value={cls}>ห้อง {cls}</option>
                  ))}
                </select>
              </div>

              {/* Export Report CTA */}
              <button
                onClick={handleExportRiskReport}
                disabled={filteredRiskAlerts.length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-blue-700 disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                ดาวน์โหลดรายงานกลุ่มเสี่ยง (.csv)
              </button>
            </div>

            {/* List of Risk Alerts */}
            <div className="flex flex-col gap-4">
              {filteredRiskAlerts.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredRiskAlerts.map((alert) => (
                    <div
                      key={alert.studentId}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all hover:shadow-md ${
                        alert.riskLevel === 'high'
                          ? 'border-red-100 dark:border-red-950/40 bg-red-50/20 dark:bg-red-950/10'
                          : 'border-amber-100 dark:border-amber-950/40 bg-amber-50/20 dark:bg-amber-950/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {alert.name}
                            </span>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[8px] font-bold text-slate-600 dark:text-slate-400">
                              ห้อง {alert.classroom}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-550 font-semibold">
                            รหัสประจำตัว: {alert.studentId}
                          </span>
                        </div>

                        <span
                          className={`rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            alert.riskLevel === 'high'
                              ? 'bg-red-500 text-white shadow-sm shadow-red-500/20'
                              : 'bg-amber-500 text-slate-950 dark:text-slate-900 shadow-sm shadow-amber-500/20'
                          }`}
                        >
                          {alert.riskLevel === 'high' ? 'เสี่ยงสูง' : 'เสี่ยงปานกลาง'}
                        </span>
                      </div>

                      {/* Warning reasons */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          เหตุผลตรวจพฤติกรรมเสี่ยง:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {alert.reasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className={`rounded-lg px-2 py-0.5 text-[9px] font-bold border ${
                                alert.riskLevel === 'high'
                                  ? 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/30 text-red-650 dark:text-red-400'
                                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Teacher action recommendation */}
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-100 dark:border-slate-800 flex items-start gap-2">
                        <span className="text-xs shrink-0 mt-0.5">💡</span>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider">
                            คำแนะนำสำหรับคุณครู
                          </span>
                          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-350 leading-relaxed">
                            {alert.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-bold text-slate-400 dark:text-slate-500 flex flex-col justify-center items-center gap-2">
                  <span>🟢 ไม่พบความเสี่ยงที่น่าเป็นห่วงในกลุ่มห้องเรียน/ระดับชั้นนี้</span>
                </div>
              )}
            </div>
          </div>

          {/* Today Health Screening Summary Card */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col gap-4 mt-2 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  🩺 สรุปรายงานคัดกรองสุขภาพวันนี้ (Today's Health Screening Summary)
                </h3>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  ประมวลผลการวัดอุณหภูมิร่างกายและคัดกรองอาการของนักเรียนทุกคนที่สแกนลงเวลาเรียนของวันนี้
                </p>
              </div>
              <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                อัปเดตสดแบบ Real-time
              </span>
            </div>

            {/* Health Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Normal */}
              <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/10 dark:bg-emerald-950/5 flex items-center gap-3">
                <div className="text-2xl">🟢</div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">สุขภาพปกติ</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{metrics.healthSummary?.normal || 0} คน</span>
                </div>
              </div>

              {/* Cough */}
              <div className="p-4 rounded-xl border border-amber-100 dark:border-amber-950/40 bg-amber-50/10 dark:bg-amber-950/5 flex items-center gap-3">
                <div className="text-2xl">🟡</div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">มีอาการไอ / จาม</span>
                  <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{metrics.healthSummary?.cough || 0} คน</span>
                </div>
              </div>

              {/* Fever */}
              <div className="p-4 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/10 dark:bg-red-950/5 flex items-center gap-3">
                <div className="text-2xl">🔴</div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ตัวร้อน / มีไข้สูง</span>
                  <span className="text-xl font-extrabold text-red-650 dark:text-red-400">{metrics.healthSummary?.fever || 0} คน</span>
                </div>
              </div>
            </div>

            {/* List of Flagged Students */}
            <div className="mt-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block mb-2">📋 รายชื่อเด็กที่มีอาการผิดปกติของวันนี้</span>
              {metrics.healthSummary?.sickStudents && metrics.healthSummary.sickStudents.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {metrics.healthSummary.sickStudents.map((sick, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 shadow-sm ${
                        sick.status === 'fever'
                          ? 'border-red-100 dark:border-red-950/30 bg-red-50/20 dark:bg-red-950/5 text-slate-900 dark:text-slate-100'
                          : 'border-amber-100 dark:border-amber-950/30 bg-amber-50/20 dark:bg-amber-950/5 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-black">{sick.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                          <span>ห้อง {sick.classroom}</span>
                          <span>•</span>
                          <span>อุณหภูมิ: {sick.temp ? `${sick.temp} °C` : 'ไม่ระบุ'}</span>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold shadow-sm ${
                        sick.status === 'fever'
                          ? 'bg-red-500 text-white'
                          : 'bg-amber-500 text-slate-900'
                      }`}>
                        {sick.status === 'fever' ? 'มีไข้สูง' : 'ไอ/จาม'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  🎉 สุขภาพแข็งแรงดี! วันนี้ยังไม่พบเด็กที่มีอาการป่วยผิดปกติ
                </div>
              )}
            </div>
          </div>

          {/* Charts Grid: Trend, Health, and Peak Check-in Times */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-2 animate-fade-in">
            {/* Trend Area Chart */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">อัตราการเข้าห้องเรียนย้อนหลัง 7 วัน</h3>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                    เปอร์เซ็นต์สถิติสรุปภาพรวมในแต่ละวันสัปดาห์นี้
                  </p>
                </div>
                <span className="rounded-lg bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-400">
                  {schoolName}
                </span>
              </div>
              <TrendChart data={metrics.trendData} />
            </div>

            {/* Health Trend Chart */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">แนวโน้มสุขภาพสะสมย้อนหลัง 7 วัน</h3>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                    ยอดรวมสถิติเด็กไอหรือมีไข้สะสมสัปดาห์นี้เพื่อเฝ้าระวังโรคระบาด
                  </p>
                </div>
                <span className="rounded-lg bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 border border-red-100/50 dark:border-red-900/30">
                  เฝ้าระวังโรค
                </span>
              </div>
              <HealthTrendChart data={metrics.healthTrendData} />
            </div>

            {/* Peak Arrival Time Distribution Chart */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">ช่วงเวลาการเข้าเรียนวันนี้ (Peak Check-in Times)</h3>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                    จำนวนนักเรียนเช็คชื่อสำเร็จ แยกตามช่วงเวลาสำคัญเช้าวันนี้
                  </p>
                </div>
                <span className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
                  เวลาเข้าแถว 08:00 น.
                </span>
              </div>
              <PeakTimeChart data={metrics.peakCheckinTimes} />
            </div>
          </div>

          {/* Tables Section: Leaderboard & Recent Scans */}
          <div className="grid gap-6 md:grid-cols-12 mt-2 animate-fade-in">
            {/* Classroom Leaderboard */}
            <div className="md:col-span-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">อันดับสถิติการเข้าเรียนรายห้อง (Leaderboard)</h3>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  ตารางสรุปจัดอันดับห้องเรียนที่เข้าเรียนตรงเวลาสูงสุดวันนี้
                </p>
              </div>

              <div className="flex-1 flex flex-col gap-2.5 justify-center min-h-[300px]">
                {metrics.leaderboard.length > 0 ? (
                  metrics.leaderboard.slice(0, 6).map((item, index) => {
                    let rankBadge = "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
                    if (index === 0) rankBadge = "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 font-black";
                    else if (index === 1) rankBadge = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-black";
                    else if (index === 2) rankBadge = "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30 font-black";

                    return (
                      <div key={item.classroom} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs shrink-0 ${rankBadge}`}>
                            {index + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">ห้อง {item.classroom}</span>
                            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                              มาตรงเวลา {item.present - item.late} คน | สาย {item.late} คน {item.leave > 0 ? `| ลา ${item.leave} คน` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-extrabold text-slate-950 dark:text-white block">{item.rate}%</span>
                          <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500">ทั้งหมด {item.total} คน</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs font-bold text-slate-400 dark:text-slate-500 flex flex-col justify-center items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300 dark:text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <span>ยังไม่มีสถิติอันดับห้องเรียนวันนี้</span>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time feed table */}
            <div className="md:col-span-7 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">ประวัติการสแกนเช็คชื่อล่าสุด</h3>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      รายชื่อการสแกนใบหน้าสำเร็จ 10 รายการล่าสุดของวันนี้
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-6">
                  <div className="inline-block min-w-full align-middle px-6">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                      <thead>
                        <tr className="text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-2">เวลาสแกน</th>
                          <th className="py-2.5 px-2">ชื่อ-นามสกุล</th>
                          <th className="py-2.5 px-2">ห้องเรียน</th>
                          <th className="py-2.5 px-2">สถานะ</th>
                          <th className="py-2.5 px-2 text-right">ความแม่นยำ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {metrics.recentScans.length > 0 ? (
                          metrics.recentScans.map((scan) => (
                            <tr key={scan.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors animate-fade-in">
                              <td className="py-3 px-2 text-slate-950 dark:text-white font-bold">{scan.time}</td>
                              <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{scan.name}</td>
                              <td className="py-3 px-2">
                                {scan.classroom ? (
                                  <span className="rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-2 py-0.5 text-[9px] font-black text-blue-600 dark:text-blue-400">
                                    {scan.classroom}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                                  scan.status === "late"
                                    ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400"
                                    : "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                }`}>
                                  {scan.status === "late" ? "สาย" : "มาเรียน"}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right text-emerald-600 dark:text-emerald-400 font-black">
                                {scan.confidence}%
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                              ยังไม่มีประวัติการเช็คชื่อเข้าห้องเรียนในวันนี้
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Confirmation Modal overlay (simulating Database Wiping for right to be forgotten presentation) */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl flex flex-col gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 self-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5 4 4-4 4"/><path d="M19 9H5.5A3.5 3.5 0 0 0 2 12.5v0A3.5 3.5 0 0 0 5.5 16H9"/></svg>
            </div>
            
            <div className="text-center flex flex-col gap-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">ยืนยันการล้างข้อมูลทั้งหมด?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                การล้างข้อมูลจะลบไฟล์รายชื่อนักเรียนใบหน้า และประวัติการสแกนเข้าเรียนทั้งหมดออกจากดิสก์ทันที เพื่อความปลอดภัยด้านข้อมูลบุคคล (PDPA)
              </p>
            </div>

            {resetSuccess ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 p-3 text-center text-xs font-bold text-emerald-700 dark:text-emerald-450 animate-fade-in">
                ✓ ล้างฐานข้อมูลจำลอง (Reset) สำเร็จ!
              </div>
            ) : (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
    </AdminGuard>
  );
}
