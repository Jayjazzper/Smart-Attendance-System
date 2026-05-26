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
import { Student, Attendance, LeaveRequest } from "@/lib/types";
import AdminGuard from "@/components/AdminGuard";

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
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"attendance" | "leaves">("attendance");
  const [leavesUpdating, setLeavesUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter States
  const [selectedLevel, setSelectedLevel] = useState<"all" | "kindergarten" | "primary" | "secondary">("all");
  const [selectedClassroom, setSelectedClassroom] = useState<string>("all");
  const [dateOption, setDateOption] = useState<"today" | "last7" | "thisMonth" | "custom">("last7");
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lockedClassroom, setLockedClassroom] = useState<string | null>(null);
  const [schoolSettings, setSchoolSettings] = useState({
    schoolName: "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)",
    schoolDistrict: "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1",
    schoolLogo: ""
  });

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

  // 1. Fetch Students, Attendance, and Leave records
  const fetchData = async () => {
    try {
      const [studentsRes, attendanceRes, leavesRes, settingsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/attendance"),
        fetch("/api/leaves"),
        fetch("/api/settings")
      ]);
      
      if (studentsRes.ok && attendanceRes.ok && leavesRes.ok) {
        const studentsData = await studentsRes.json();
        const attendanceData = await attendanceRes.json();
        const leavesData = await leavesRes.json();
        setStudents(studentsData.students || []);
        setAttendance(attendanceData.attendance || []);
        setLeaves(leavesData.leaves || []);
      }
      if (settingsRes && settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSchoolSettings({
          schoolName: settingsData.schoolName || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)",
          schoolDistrict: settingsData.schoolDistrict || "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1",
          schoolLogo: settingsData.schoolLogo || ""
        });
      }
    } catch (err) {
      console.error("Error loading reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const savedSession = localStorage.getItem("teacherSession");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.role === "teacher" && parsed.classroom) {
          setLockedClassroom(parsed.classroom);
          setSelectedClassroom(parsed.classroom);
          setSelectedLevel("all");
        }
      } catch (e) {}
    }
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
    if (!lockedClassroom) {
      setSelectedClassroom("all");
    }
  }, [selectedLevel, lockedClassroom]);

  // 4. Calculate individual student statistics
  const studentsStats: StudentReportStats[] = filteredStudents.map(student => {
    const studentLogs = attendance.filter(log => log.studentId === student.id && log.status !== "checked_out");
    
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
        
        const status = (latestLog.status || "present") as 'present' | 'late' | 'absent' | 'leave';
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

  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const handleSendDailySummary = async () => {
    if (selectedClassroom === "all") {
      setToastMessage({ text: "กรุณาเลือกห้องเรียนเฉพาะเจาะจงก่อนส่งสรุปยอด", type: "error" });
      setTimeout(() => setToastMessage({ text: "", type: "" }), 3000);
      return;
    }
    
    setIsSummaryLoading(true);
    setToastMessage({ text: "", type: "" });
    
    try {
      const res = await fetch("/api/attendance/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classroom: selectedClassroom,
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.lineSent) {
          setToastMessage({ 
            text: `✓ ส่งรายงานสรุปยอดชั้นเรียน ${selectedClassroom} เข้ากลุ่ม LINE เรียบร้อยแล้ว!`, 
            type: "success" 
          });
        } else {
          setToastMessage({ 
            text: `⚠️ ไม่สามารถส่งเข้า LINE: ${data.errorMsg || "ยังไม่ได้กำหนด Token"}`, 
            type: "error" 
          });
        }
        setTimeout(() => setToastMessage({ text: "", type: "" }), 4000);
      } else {
        setToastMessage({ text: data.error || "เกิดข้อผิดพลาดในการรวบรวมยอดสรุป", type: "error" });
        setTimeout(() => setToastMessage({ text: "", type: "" }), 4000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage({ text: "ไม่สามารถส่งคำสั่งสรุปยอดระบบได้", type: "error" });
      setTimeout(() => setToastMessage({ text: "", type: "" }), 3000);
    } finally {
      setIsSummaryLoading(false);
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

  // 8. Handle Leave Request Status Change (Approve/Reject)
  const handleLeaveStatusChange = async (id: string, status: "approved" | "rejected") => {
    setLeavesUpdating(true);
    setToastMessage({ text: "", type: "" });
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setToastMessage({ 
          text: `✓ ${status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}คำขอลาสำเร็จและซิงค์เข้าระบบเช็คชื่อเรียบร้อยแล้ว`, 
          type: "success" 
        });
        await fetchData(); // refresh stats and leaves list
        setTimeout(() => setToastMessage({ text: "", type: "" }), 4000);
      } else {
        const data = await res.json();
        setToastMessage({ text: data.error || "เกิดข้อผิดพลาดในการบันทึกสถานะใบลา", type: "error" });
      }
    } catch (e) {
      console.error(e);
      setToastMessage({ text: "ไม่สามารถส่งการทำรายการไปยังเซิร์ฟเวอร์ได้", type: "error" });
    } finally {
      setLeavesUpdating(false);
    }
  };

  // 9. Filter leaves list
  const filteredLeaves = leaves.filter(l => {
    const matchesSearch = 
      l.studentId.includes(searchTerm) || 
      l.studentName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Check classroom setting
    const matchesClass = selectedClassroom === "all" || l.classroom === selectedClassroom;

    // Check level setting
    // We map student to get their level
    const student = students.find(s => s.id === l.studentId);
    const matchesLevel = selectedLevel === "all" || (student && student.level === selectedLevel);

    return matchesSearch && matchesClass && matchesLevel;
  });

  return (
    <AdminGuard allowTeacher>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide layout header and footer */
          header, footer, .no-print {
            display: none !important;
          }
          
          /* Ensure the body background is clean for printing */
          body, html {
            background: white !important;
            color: black !important;
          }
          
          /* Main Next.js content adjustments for printing */
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            background: transparent !important;
          }

          /* Print page size and margin settings */
          @page {
            size: A4 landscape;
            margin: 12mm 10mm 12mm 10mm;
          }

          /* Custom print layout styling */
          .print-only-container {
            display: block !important;
            width: 100% !important;
            color: black !important;
          }

          .print-header {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            margin-bottom: 16px !important;
          }

          .print-title {
            font-size: 16px !important;
            font-weight: bold !important;
            margin-top: 6px !important;
            color: black !important;
          }

          .print-subtitle {
            font-size: 12px !important;
            margin-top: 2px !important;
            color: #333 !important;
          }

          .print-metadata {
            font-size: 10px !important;
            color: #555 !important;
            margin-top: 6px !important;
            font-weight: bold !important;
          }

          .print-summary-grid {
            display: grid !important;
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            gap: 8px !important;
            border: 1px solid #333 !important;
            padding: 8px !important;
            margin-bottom: 16px !important;
            background-color: #f8fafc !important;
            border-radius: 6px !important;
            text-align: center !important;
          }

          .print-summary-item {
            display: flex !important;
            flex-direction: column !important;
          }

          .print-summary-label {
            font-size: 8px !important;
            font-weight: bold !important;
            color: #555 !important;
            text-transform: uppercase !important;
          }

          .print-summary-value {
            font-size: 12px !important;
            font-weight: 800 !important;
            margin-top: 1px !important;
          }

          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 8px !important;
          }

          .print-table th, .print-table td {
            border: 1px solid #333 !important;
            padding: 4px 2px !important;
            font-size: 9px !important;
            text-align: center !important;
            color: black !important;
          }

          .print-table th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }

          .print-table td.student-name {
            text-align: left !important;
            padding-left: 4px !important;
          }

          .print-signatures {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 30px !important;
            page-break-inside: avoid !important;
          }

          .print-signature-block {
            width: 45% !important;
            text-align: center !important;
            font-size: 10px !important;
          }

          .print-signature-line {
            border-bottom: 1px dotted #333 !important;
            margin-bottom: 4px !important;
            height: 30px !important;
          }
        }
      `}} />
      <div className="flex flex-col gap-6 py-6 animate-fade-in relative no-print">
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
            onClick={() => window.print()}
            disabled={studentsStats.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer animate-fade-in"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            พิมพ์รายงาน PDF (Print PDF)
          </button>

          <button
            onClick={handleExportCSV}
            disabled={studentsStats.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2059/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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

          {selectedClassroom !== "all" && (
            <button
              onClick={handleSendDailySummary}
              disabled={isSummaryLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 dark:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700 dark:hover:bg-emerald-800 disabled:bg-slate-400 transition-colors cursor-pointer"
            >
              {isSummaryLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังส่งสรุปยอด...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  ส่งสรุปห้องเรียนเข้า LINE
                </>
              )}
            </button>
          )}
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
              disabled={!!lockedClassroom}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400"
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
              disabled={!!lockedClassroom}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400"
            >
              {lockedClassroom ? (
                <option value={lockedClassroom}>{lockedClassroom}</option>
              ) : (
                <>
                  <option value="all">ทั้งหมด</option>
                  {availableClassrooms.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </>
              )}
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

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-5 py-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
            activeTab === "attendance"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          ตารางประวัติเช็คชื่อ
        </button>
        <button
          onClick={() => setActiveTab("leaves")}
          className={`px-5 py-3 text-xs font-black border-b-2 transition-all cursor-pointer relative ${
            activeTab === "leaves"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          จัดการคำร้องขอลาเรียน
          {leaves.filter(l => l.status === "pending").length > 0 && (
            <span className="absolute top-2.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-bold">กำลังประมวลผลข้อมูลสถิติ...</span>
        </div>
      ) : activeTab === "attendance" ? (
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
      ) : (
        /* Render Leaves Management UI */
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-4 mt-1">
          <div>
            <h3 className="text-base font-bold text-slate-900">รายการคำร้องขอลาเรียนจากผู้ปกครอง</h3>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
              ตรวจสอบเหตุผลการลา อนุมัติ หรือ ปฏิเสธ คำร้องใบลาเรียนของนักเรียนยื่นออนไลน์
            </p>
          </div>

          <div className="overflow-x-auto -mx-6 mt-2">
            <div className="inline-block min-w-full align-middle px-6">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-2 w-[110px]">รหัสประจำตัว</th>
                    <th className="py-3 px-2 w-[180px]">ชื่อ-นามสกุล</th>
                    <th className="py-3 px-2 w-[80px]">ห้องเรียน</th>
                    <th className="py-3 px-2 w-[90px]">ประเภทการลา</th>
                    <th className="py-3 px-2 w-[180px]">วันที่ลา</th>
                    <th className="py-3 px-2">เหตุผลการลา</th>
                    <th className="py-3 px-2 w-[100px] text-center">สถานะ</th>
                    <th className="py-3 px-2 w-[150px] text-center">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {filteredLeaves.length > 0 ? (
                    filteredLeaves.map((leave) => {
                      const isPending = leave.status === "pending";
                      const isApproved = leave.status === "approved";
                      const isRejected = leave.status === "rejected";

                      const typeLabel = leave.type === "sick" ? "ลาป่วย" : leave.type === "personal" ? "ลากิจ" : "ลาอื่น ๆ";
                      const typeColor = leave.type === "sick" ? "bg-red-50 text-red-600 border-red-100" : leave.type === "personal" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-50 text-slate-600 border-slate-100";

                      return (
                        <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-2 text-slate-900 font-bold">{leave.studentId}</td>
                          <td className="py-3 px-2 text-slate-900 font-bold">{leave.studentName}</td>
                          <td className="py-3 px-2">
                            <span className="rounded bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">
                              {leave.classroom || "-"}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-extrabold ${typeColor}`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap">
                            {format(new Date(leave.startDate), "dd/MM/yyyy")} - {format(new Date(leave.endDate), "dd/MM/yyyy")}
                          </td>
                          <td className="py-3 px-2 text-slate-600 max-w-[250px] truncate" title={leave.reason}>
                            {leave.reason}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`rounded-lg px-2.5 py-0.5 font-bold ${
                              isApproved
                                ? "bg-emerald-50 text-emerald-600"
                                : isRejected
                                ? "bg-red-50 text-red-600"
                                : "bg-amber-50 text-amber-600"
                            }`}>
                              {isApproved ? "อนุมัติแล้ว" : isRejected ? "ปฏิเสธ" : "รออนุมัติ"}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {isPending ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleLeaveStatusChange(leave.id, "approved")}
                                  disabled={leavesUpdating}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-emerald-700 disabled:bg-slate-300 transition-colors cursor-pointer"
                                >
                                  อนุมัติ
                                </button>
                                <button
                                  onClick={() => handleLeaveStatusChange(leave.id, "rejected")}
                                  disabled={leavesUpdating}
                                  className="rounded-lg bg-red-500 px-2.5 py-1 text-[10px] font-black text-white hover:bg-red-600 disabled:bg-slate-300 transition-colors cursor-pointer"
                                >
                                  ปฏิเสธ
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-medium">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        ไม่พบคำร้องขอลาเรียนตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Manual Entry Modal Overlay */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print">
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

    {/* Print Layout (Only visible when printing) */}
    <div className="hidden print-only-container">
      {/* School Crest & Header */}
      <div className="print-header">
        {schoolSettings.schoolLogo ? (
          <img src={schoolSettings.schoolLogo} alt="School Logo" className="h-16 w-16 object-contain mb-2" />
        ) : (
          <div className="h-14 w-14 bg-slate-100 border border-slate-300 rounded-full flex items-center justify-center mb-2">
             <span className="text-[9px] font-bold text-slate-500">ตราโรงเรียน</span>
          </div>
        )}
        <h2 className="print-title">รายงานบันทึกการเข้าเรียนและคัดกรองสุขภาพนักเรียน</h2>
        <div className="print-subtitle font-bold">{schoolSettings.schoolName}</div>
        <div className="print-subtitle text-[11px] text-slate-500">{schoolSettings.schoolDistrict}</div>
        
        {/* Document Info */}
        <div className="print-metadata flex gap-6">
          <span>ระดับชั้น: {selectedLevel === "all" ? "ทุกระดับชั้น" : selectedLevel === "kindergarten" ? "อนุบาล" : selectedLevel === "primary" ? "ประถมศึกษา" : "มัธยมศึกษา"}</span>
          <span>ห้องเรียน: {selectedClassroom === "all" ? "ทุกห้องเรียน" : selectedClassroom}</span>
          <span>ช่วงวันที่: {format(startDate, "dd/MM/yyyy")} ถึง {format(endDate, "dd/MM/yyyy")}</span>
        </div>
      </div>

      {/* Summary Row */}
      <div className="print-summary-grid">
        <div className="print-summary-item">
          <span className="print-summary-label">ร้อยละการมาเรียนเฉลี่ย</span>
          <span className="print-summary-value text-blue-600">{avgAttendanceRate}%</span>
        </div>
        <div className="print-summary-item">
          <span className="print-summary-label">มาเรียนปกติรวม</span>
          <span className="print-summary-value text-emerald-600">{totalPresent} ครั้ง</span>
        </div>
        <div className="print-summary-item">
          <span className="print-summary-label">มาสายรวม</span>
          <span className="print-summary-value text-amber-600">{totalLate} ครั้ง</span>
        </div>
        <div className="print-summary-item">
          <span className="print-summary-label">ขาดเรียนรวม</span>
          <span className="print-summary-value text-red-500">{totalAbsent} ครั้ง</span>
        </div>
        <div className="print-summary-item">
          <span className="print-summary-label">ลากิจ/ลาป่วยรวม</span>
          <span className="print-summary-value text-purple-600">{totalLeave} ครั้ง</span>
        </div>
      </div>

      {/* Main Table */}
      <table className="print-table">
        <thead>
          <tr>
            <th className="w-[70px]">รหัสประจำตัว</th>
            <th className="w-[150px] text-left">ชื่อ-นามสกุล</th>
            <th className="w-[50px]">ห้องเรียน</th>
            <th className="w-[35px]">มา (วัน)</th>
            <th className="w-[35px]">สาย (วัน)</th>
            <th className="w-[35px]">ขาด (วัน)</th>
            <th className="w-[35px]">ลา (วัน)</th>
            <th className="w-[50px]">% การมา</th>
            {datesList.map(dateStr => {
              const parsedDate = new Date(dateStr);
              const displayDate = parsedDate.toLocaleDateString("th-TH", { day: "numeric", month: "numeric" });
              return (
                <th key={dateStr} className="text-center text-[7.5px] w-[30px] font-normal">
                  {displayDate}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {studentsStats.map(({ student, presentCount, lateCount, absentCount, leaveCount, attendanceRate, dailyStatus }) => {
            return (
              <tr key={student.id}>
                <td className="font-bold">{student.id}</td>
                <td className="student-name font-bold">{student.name}</td>
                <td>{student.classroom || "-"}</td>
                <td>{presentCount}</td>
                <td>{lateCount}</td>
                <td className={absentCount > 0 ? "text-red-650 font-bold" : ""}>{absentCount}</td>
                <td>{leaveCount}</td>
                <td className="font-bold">{attendanceRate}%</td>
                {datesList.map(dateStr => {
                  const status = dailyStatus[dateStr];
                  return (
                    <td key={dateStr} className="text-center font-bold">
                      {status === "present" && "✓"}
                      {status === "late" && "ส"}
                      {status === "absent" && "ข"}
                      {status === "leave" && "ล"}
                      {status === "none" && "-"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="text-[8px] font-bold text-slate-500 mt-2">
        * สัญลักษณ์สถานะรายวัน: ✓ = มาเรียนปกติ | ส = มาสาย | ข = ขาดเรียน | ล = ลากิจ/ลาป่วย | - = ไม่มีบันทึก
      </div>

      {/* Signatures */}
      <div className="print-signatures">
        <div className="print-signature-block">
          <div className="print-signature-line"></div>
          <p className="font-bold">ลงชื่อ..........................................................ครูประจำชั้น</p>
          <p className="mt-1 text-slate-500">(..........................................................)</p>
          <p className="mt-0.5 text-[9px]">ผู้จัดทำ/ผู้รายงาน</p>
          <p className="mt-0.5 text-[9px]">วันที่ ........ / ................ / ............</p>
        </div>
        <div className="print-signature-block">
          <div className="print-signature-line"></div>
          <p className="font-bold">ลงชื่อ..........................................................ผู้บริหารโรงเรียน</p>
          <p className="mt-1 text-slate-500">(..........................................................)</p>
          <p className="mt-0.5 text-[9px]">ผู้อำนวยการโรงเรียน{schoolSettings.schoolName}</p>
          <p className="mt-0.5 text-[9px]">วันที่ ........ / ................ / ............</p>
        </div>
      </div>
    </div>
    </AdminGuard>
  );
}
