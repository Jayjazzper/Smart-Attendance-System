"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  format, 
  subDays, 
  startOfMonth, 
  endOfDay, 
  startOfDay, 
  eachDayOfInterval, 
  parseISO, 
  isSameDay 
} from "date-fns";
import { Student, Attendance } from "@/lib/types";

interface StudentReportStats {
  student: Student;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  totalDays: number;
  attendanceRate: number;
  dailyStatus: Record<string, 'present' | 'late' | 'absent' | 'leave' | 'none'>;
}

export default function ReportsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter States
  const [selectedLevel, setSelectedLevel] = useState<"all" | "kindergarten" | "primary" | "secondary">("all");
  const [selectedClassroom, setSelectedClassroom] = useState<string>("all");
  const [dateOption, setDateOption] = useState<"today" | "last7" | "thisMonth" | "custom">("last7");
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Manual Log Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [manualStatus, setManualStatus] = useState<'present' | 'late' | 'absent' | 'leave'>("present");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState({ text: "", type: "" });

  // Auto Absent Loading State
  const [isAutoAbsentLoading, setIsAutoAbsentLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState({ text: "", type: "" });

  // 1. Fetch Students and Attendance records
  const fetchData = async () => {
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/attendance")
      ]);
      
      if (studentsRes.ok && attendanceRes.ok) {
        const studentsData = await studentsRes.json();
        const attendanceData = await attendanceRes.json();
        setStudents(studentsData.students || []);
        setAttendance(attendanceData.attendance || []);
      }
    } catch (err) {
      console.error("Error loading reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Compute date range endpoints based on dateOption selection
  const getDateRange = () => {
    const today = new Date();
    let start = startOfDay(today);
    let end = endOfDay(today);

    if (dateOption === "last7") {
      start = startOfDay(subDays(today, 6));
    } else if (dateOption === "thisMonth") {
      start = startOfDay(startOfMonth(today));
    } else if (dateOption === "custom") {
      start = startOfDay(new Date(customStartDate));
      end = endOfDay(new Date(customEndDate));
    }

    return { start, end };
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Generate day-by-day dates list within selected interval for report columns
  const datesList: string[] = [];
  try {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    days.forEach(d => {
      datesList.push(format(d, "yyyy-MM-dd"));
    });
  } catch (e) {}

  // 3. Filter Students list
  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      s.id.includes(searchTerm) || 
      s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = selectedLevel === "all" || s.level === selectedLevel;
    const matchesClass = selectedClassroom === "all" || s.classroom === selectedClassroom;
    
    return matchesSearch && matchesLevel && matchesClass;
  });

  // Unique classrooms registered in selected level division
  const availableClassrooms = Array.from(
    new Set(
      students
        .filter(s => selectedLevel === "all" || s.level === selectedLevel)
        .map(s => s.classroom)
        .filter(Boolean)
    )
  ).sort();

  // Reset classroom selection when division level changes
  useEffect(() => {
    setSelectedClassroom("all");
  }, [selectedLevel]);

  // 4. Calculate individual student statistics
  const studentsStats: StudentReportStats[] = filteredStudents.map(student => {
    const studentLogs = attendance.filter(log => log.studentId === student.id);
    
    // Group logs by date (YYYY-MM-DD)
    const logsByDate: Record<string, Attendance[]> = {};
    studentLogs.forEach(log => {
      try {
        const logDateStr = format(new Date(log.timestamp), "yyyy-MM-dd");
        if (!logsByDate[logDateStr]) logsByDate[logDateStr] = [];
        logsByDate[logDateStr].push(log);
      } catch (e) {}
    });

    // Determine final status for each date in datesList (using the latest log for that day)
    const dailyStatus: Record<string, 'present' | 'late' | 'absent' | 'leave' | 'none'> = {};
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    datesList.forEach(dateStr => {
      const logs = logsByDate[dateStr] || [];
      if (logs.length > 0) {
        // Sort by timestamp descending to get the latest override/record
        const latestLog = [...logs].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
        
        const status = latestLog.status || "present";
        dailyStatus[dateStr] = status;
        
        if (status === "present") presentCount++;
        else if (status === "late") lateCount++;
        else if (status === "absent") absentCount++;
        else if (status === "leave") leaveCount++;
      } else {
        dailyStatus[dateStr] = "none";
      }
    });

    const totalDays = presentCount + lateCount + absentCount + leaveCount;
    // Attendance rate = (Present + Late) / Total Tracked Days
    const attendanceRate = totalDays > 0 
      ? Math.round(((presentCount + lateCount) / totalDays) * 100)
      : 100; // default to 100 if no logs recorded

    return {
      student,
      presentCount,
      lateCount,
      absentCount,
      leaveCount,
      totalDays,
      attendanceRate,
      dailyStatus
    };
  });

  // Calculate Group Totals
  const totalStudents = studentsStats.length;
  const avgAttendanceRate = totalStudents > 0 
    ? Math.round(studentsStats.reduce((acc, curr) => acc + curr.attendanceRate, 0) / totalStudents)
    : 100;
  const totalPresent = studentsStats.reduce((acc, curr) => acc + curr.presentCount, 0);
  const totalLate = studentsStats.reduce((acc, curr) => acc + curr.lateCount, 0);
  const totalAbsent = studentsStats.reduce((acc, curr) => acc + curr.absentCount, 0);
  const totalLeave = studentsStats.reduce((acc, curr) => acc + curr.leaveCount, 0);

  // 5. Submit Manual Entry
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStudentId || !manualDate || !manualStatus) return;

    setIsSavingManual(true);
    setManualMessage({ text: "", type: "" });

    try {
      // Find matching student
      const matchedStudent = students.find(s => s.id === manualStudentId);
      if (!matchedStudent) {
        setManualMessage({ text: "ไม่พบรหัสนักเรียนในระบบ", type: "error" });
        setIsSavingManual(false);
        return;
      }

      // Convert date to ISO timestamp
      const localTime = new Date();
      const [year, month, day] = manualDate.split("-").map(Number);
      const logDate = new Date(year, month - 1, day, localTime.getHours(), localTime.getMinutes(), localTime.getSeconds());

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: manualStudentId,
          confidence: 100, // manual entry gets 100% confidence
          status: manualStatus,
          classroom: matchedStudent.classroom || "",
          timestamp: logDate.toISOString()
        })
      });

      if (res.ok) {
        setManualMessage({ text: "บันทึกข้อมูลการเข้าเรียน/ลาสำเร็จ!", type: "success" });
        await fetchData(); // refresh stats
        setTimeout(() => {
          setShowManualModal(false);
          setManualStudentId("");
          setManualMessage({ text: "", type: "" });
        }, 1200);
      } else {
        const data = await res.json();
        setManualMessage({ text: data.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setManualMessage({ text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", type: "error" });
    } finally {
      setIsSavingManual(false);
    }
  };

  // 6. Trigger Auto Absent check
  const handleAutoAbsentTrigger = async () => {
    setIsAutoAbsentLoading(true);
    setToastMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/attendance/auto-absent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classroom: selectedClassroom === "all" ? undefined : selectedClassroom,
          level: selectedLevel === "all" ? undefined : selectedLevel
        })
      });

      if (res.ok) {
        const data = await res.json();
        setToastMessage({ 
          text: `✓ สำเร็จ: บันทึกสถานะขาดเรียนสำหรับผู้ไม่มีข้อมูลวันนี้จำนวน ${data.count} คน`, 
          type: "success" 
        });
        await fetchData(); // refresh stats
        setTimeout(() => setToastMessage({ text: "", type: "" }), 4000);
      } else {
        setToastMessage({ text: "เกิดข้อผิดพลาดในการรันคำสั่งเช็คชื่อขาดเรียน", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToastMessage({ text: "ไม่สามารถส่งคำสั่งระบบได้", type: "error" });
    } finally {
      setIsAutoAbsentLoading(false);
    }
  };

  // 7. Export report to Excel-readable CSV
  const handleExportCSV = () => {
    if (studentsStats.length === 0) return;

    const headers = [
      "รหัสประจำตัว",
      "ชื่อ-นามสกุล",
      "ห้องเรียน",
      "มาเรียน (ครั้ง)",
      "สาย (ครั้ง)",
      "ขาด (ครั้ง)",
      "ลา (ครั้ง)",
      "ร้อยละการมาเรียน",
      ...datesList.map(d => {
        try {
          return format(new Date(d), "dd/MM/yyyy");
        } catch (e) {
          return d;
        }
      })
    ];

    const rows = studentsStats.map(stat => {
      const statusMap = {
        present: "มาเรียน",
        late: "สาย",
        absent: "ขาด",
        leave: "ลา",
        none: "-"
      };
      
      const dailyCells = datesList.map(d => {
        const status = stat.dailyStatus[d] || "none";
        return statusMap[status as keyof typeof statusMap] || "-";
      });

      return [
        stat.student.id,
        stat.student.name,
        stat.student.classroom || "-",
        stat.presentCount,
        stat.lateCount,
        stat.absentCount,
        stat.leaveCount,
        `${stat.attendanceRate}%`,
        ...dailyCells
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => {
        const escaped = String(cell).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const fileClassroom = selectedClassroom === "all" ? "ทุกห้อง" : `ห้อง_${selectedClassroom}`;
    const filename = `รายงานการมาเรียน_${fileClassroom}_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in relative">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            รายงานสถิติการเช็คชื่อเข้าเรียน
          </h1>
          <p className="text-sm font-medium text-slate-500">
            วิเคราะห์เปอร์เซ็นต์การเข้าเรียน สรุปยอดวันสาย การขาดเรียน หรือใบลาสะสมรายบุคคลและช่วงชั้น
          </p>
        </div>

        {/* Actions Button Row */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={studentsStats.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ส่งออกรายงาน (CSV)
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            บันทึกการมา/ลา ด้วยตนเอง
          </button>
          
          <button
            onClick={handleAutoAbsentTrigger}
            disabled={isAutoAbsentLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-400 transition-colors cursor-pointer"
          >
            {isAutoAbsentLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังบันทึก...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                บันทึกขาดเรียนอัตโนมัติวันนี้
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage.text && (
        <div className={`rounded-xl p-4 border animate-fade-in ${
          toastMessage.type === "success" 
            ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
            : "bg-red-50 border-red-100 text-red-800"
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold font-semibold">
            {toastMessage.text}
          </div>
        </div>
      )}

      {/* Advanced Filters Block */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          ฟิลเตอร์ตัวกรองรายงาน
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {/* Level Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500">ระดับชั้นหลัก</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
            >
              <option value="all">ทุกระดับชั้น</option>
              <option value="kindergarten">ระดับอนุบาล</option>
              <option value="primary">ระดับประถมศึกษา</option>
              <option value="secondary">ระดับมัธยมศึกษา</option>
            </select>
          </div>

          {/* Classroom Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500">ห้องเรียนย่อย</label>
            <select
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
            >
              <option value="all">ทั้งหมด</option>
              {availableClassrooms.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Date Option */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500">ช่วงเวลารายงาน</label>
            <select
              value={dateOption}
              onChange={(e) => setDateOption(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
            >
              <option value="today">วันนี้</option>
              <option value="last7">ย้อนหลัง 7 วัน</option>
              <option value="thisMonth">เดือนนี้</option>
              <option value="custom">กำหนดช่วงวันที่เอง</option>
            </select>
          </div>

          {/* Search box */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500">ค้นหารายบุคคล</label>
            <input
              type="text"
              placeholder="รหัส หรือชื่อนักเรียน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateOption === "custom" && (
          <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4 animate-fade-in max-w-md">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-bold">กำลังประมวลผลข้อมูลสถิติ...</span>
        </div>
      ) : (
        <>
          {/* Summary stats row */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mt-1">
            <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">ร้อยละการมาเรียนเฉลี่ย</span>
              <span className="text-xl font-extrabold text-blue-600">{avgAttendanceRate}%</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">มาเรียนปกติรวม</span>
              <span className="text-xl font-extrabold text-emerald-600">{totalPresent} ครั้ง</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">มาสายรวม</span>
              <span className="text-xl font-extrabold text-amber-600">{totalLate} ครั้ง</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">ขาดเรียนรวม</span>
              <span className="text-xl font-extrabold text-red-500">{totalAbsent} ครั้ง</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">ลากิจ/ลาป่วยรวม</span>
              <span className="text-xl font-extrabold text-purple-500">{totalLeave} ครั้ง</span>
            </div>
          </div>

          {/* Main Table and Grid Display */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm overflow-hidden mt-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">ตารางวิเคราะห์สถิติและการเช็คชื่อรายบุคคล</h3>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                  ตารางแสดงข้อมูลสรุปพร้อมปฏิทินสแกนย้อนหลัง (เรียงรายชื่อจากรหัส)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto -mx-6">
              <div className="inline-block min-w-full align-middle px-6">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-2 w-[110px]">รหัสประจำตัว</th>
                      <th className="py-3 px-2 w-[180px]">ชื่อ-นามสกุล</th>
                      <th className="py-3 px-2 w-[80px]">ห้องเรียน</th>
                      <th className="py-3 px-2 text-center w-[60px]">มา</th>
                      <th className="py-3 px-2 text-center w-[60px]">สาย</th>
                      <th className="py-3 px-2 text-center w-[60px]">ขาด</th>
                      <th className="py-3 px-2 text-center w-[60px]">ลา</th>
                      <th className="py-3 px-2 text-center w-[80px]">ร้อยละการมา</th>
                      {/* Dynamic date header columns */}
                      {datesList.map(dateStr => {
                        const parsedDate = new Date(dateStr);
                        const displayDate = parsedDate.toLocaleDateString("th-TH", { day: "numeric", month: "numeric" });
                        return (
                          <th key={dateStr} className="py-3 px-1 text-center font-semibold text-[9px] w-[50px] whitespace-nowrap min-w-[50px]">
                            {displayDate}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {studentsStats.length > 0 ? (
                      studentsStats.map(({ student, presentCount, lateCount, absentCount, leaveCount, attendanceRate, dailyStatus }) => (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-2 text-slate-900 font-bold">{student.id}</td>
                          <td className="py-3 px-2 text-slate-900 font-bold max-w-[180px] truncate">{student.name}</td>
                          <td className="py-3 px-2">
                            <span className="rounded bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">
                              {student.classroom || "-"}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center text-emerald-600">{presentCount}</td>
                          <td className="py-3 px-2 text-center text-amber-600">{lateCount}</td>
                          <td className="py-3 px-2 text-center text-red-500">{absentCount}</td>
                          <td className="py-3 px-2 text-center text-purple-600">{leaveCount}</td>
                          <td className="py-3 px-2 text-center">
                            <span className={`rounded-lg px-2 py-0.5 font-bold ${
                              attendanceRate >= 80 
                                ? "bg-emerald-50 text-emerald-600" 
                                : attendanceRate >= 60 
                                ? "bg-amber-50 text-amber-600" 
                                : "bg-red-50 text-red-600"
                            }`}>
                              {attendanceRate}%
                            </span>
                          </td>
                          {/* Calendar cell rendering */}
                          {datesList.map(dateStr => {
                            const status = dailyStatus[dateStr];
                            return (
                              <td key={dateStr} className="py-3 px-1 text-center select-none w-[50px] min-w-[50px]">
                                {status === "present" && (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[10px]" title="มาเรียน">
                                    ✓
                                  </span>
                                )}
                                {status === "late" && (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-extrabold text-[10px]" title="มาสาย">
                                    สาย
                                  </span>
                                )}
                                {status === "absent" && (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-700 font-extrabold text-[10px]" title="ขาดเรียน">
                                    ขาด
                                  </span>
                                )}
                                {status === "leave" && (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-extrabold text-[10px]" title="ลา">
                                    ลา
                                  </span>
                                )}
                                {status === "none" && (
                                  <span className="text-slate-200">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8 + datesList.length} className="py-12 text-center text-slate-400">
                          ไม่พบข้อมูลประวัติการมาเรียนตามเงื่อนไขที่เลือก
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Manual Entry Modal Overlay */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">บันทึกข้อมูลเวลาเข้าเรียน/ลานักเรียน</h3>
              <button 
                onClick={() => setShowManualModal(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              {/* Select Student */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">เลือกนักเรียน</label>
                <select
                  value={manualStudentId}
                  onChange={(e) => setManualStudentId(e.target.value)}
                  required
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                >
                  <option value="">-- กรุณาเลือกรายชื่อนักเรียน --</option>
                  {students
                    .sort((a, b) => a.name.localeCompare(b.name, "th"))
                    .map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.id}) {student.classroom ? `[${student.classroom}]` : ""}
                      </option>
                    ))}
                </select>
              </div>

              {/* Select Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">วันที่ต้องการเช็คชื่อ</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Select Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">สถานะ</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: "present", label: "มาเรียนปกติ" },
                    { val: "late", label: "มาเรียนสาย" },
                    { val: "leave", label: "ลาเรียน" },
                    { val: "absent", label: "ขาดเรียน" }
                  ].map(item => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setManualStatus(item.val as any)}
                      className={`rounded-xl py-2 px-3 text-xs font-bold transition-all border cursor-pointer ${
                        manualStatus === item.val
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status alerts */}
              {manualMessage.text && (
                <div className={`rounded-xl p-3 border text-xs font-semibold ${
                  manualMessage.type === "success" 
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                    : "bg-red-50 border-red-100 text-red-800"
                }`}>
                  {manualMessage.text}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingManual || !manualStudentId}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSavingManual ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
