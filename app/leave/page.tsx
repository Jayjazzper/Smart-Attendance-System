"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

interface LeaveRequest {
  id: string;
  studentId: string;
  studentName: string;
  classroom: string;
  startDate: string;
  endDate: string;
  type: 'sick' | 'personal' | 'other';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  contactEmail?: string;
  contactLine?: string;
  contactPhone?: string;
  evidenceUrl?: string;
  evidenceName?: string;
  evidenceMimeType?: string;
  evidenceBase64?: string;
}

interface Student {
  id: string;
  name: string;
  classroom?: string;
  level?: string;
}

export default function LeavePage() {
  // Input fields
  const [studentId, setStudentId] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leaveType, setLeaveType] = useState<'sick' | 'personal' | 'other'>("sick");
  const [reason, setReason] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactLine, setContactLine] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  
  // File upload states
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceBase64, setEvidenceBase64] = useState("");
  const [evidenceName, setEvidenceName] = useState("");
  const [evidenceMimeType, setEvidenceMimeType] = useState("");
  const [fileError, setFileError] = useState("");
  
  // Verification states
  const [verifiedStudent, setVerifiedStudent] = useState<Student | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  
  // History states
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ text: "", type: "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError("");
    if (!file) return;

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setFileError("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return;
    }

    // Check type: images, pdf, doc, docx
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (!allowedTypes.includes(file.type)) {
      setFileError("รองรับเฉพาะไฟล์ภาพ (JPG, PNG, WEBP), PDF หรือไฟล์ Word (.doc, .docx) เท่านั้น");
      return;
    }

    setEvidenceFile(file);
    setEvidenceName(file.name);
    setEvidenceMimeType(file.type);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(",")[1];
      setEvidenceBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setEvidenceFile(null);
    setEvidenceBase64("");
    setEvidenceName("");
    setEvidenceMimeType("");
    setFileError("");
  };

  // 1. Verify Student ID exists
  const handleVerifyStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!studentId.trim()) return;

    setIsVerifying(true);
    setVerifyError("");
    setVerifiedStudent(null);
    setSubmitMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/students");
      if (res.ok) {
        const data = await res.json();
        const students: Student[] = data.students || [];
        const matched = students.find(s => s.id === studentId.trim());

        if (matched) {
          setVerifiedStudent(matched);
          // Load history for this student
          await fetchLeaveHistory(matched.id);
        } else {
          setVerifyError("ไม่พบรหัสประจำตัวนี้ในระบบ กรุณาตรวจสอบความถูกต้อง");
        }
      } else {
        setVerifyError("ไม่สามารถเชื่อมต่อระบบตรวจสอบนักเรียนได้");
      }
    } catch (err) {
      console.error(err);
      setVerifyError("เกิดข้อผิดพลาดในการตรวจสอบ");
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. Fetch History for specific student
  const fetchLeaveHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/leaves");
      if (res.ok) {
        const data = await res.json();
        const allLeaves: LeaveRequest[] = data.leaves || [];
        const studentLeaves = allLeaves
          .filter(l => l.studentId === id)
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setLeaveHistory(studentLeaves);
      }
    } catch (err) {
      console.error("Error loading leave history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 3. Handle Leave Submission
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedStudent || !startDate || !endDate || !leaveType || !reason.trim()) return;

    setIsSubmitting(true);
    setSubmitMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: verifiedStudent.id,
          startDate,
          endDate,
          type: leaveType,
          reason: reason.trim(),
          contactEmail: contactEmail.trim(),
          contactLine: contactLine.trim(),
          contactPhone: contactPhone.trim(),
          evidenceBase64,
          evidenceName,
          evidenceMimeType
        })
      });

      if (res.ok) {
        setSubmitMessage({ text: "ส่งใบลาออนไลน์สำเร็จแล้ว! กรุณารอครูประจำชั้นอนุมัติ", type: "success" });
        setReason(""); // clear form
        setContactEmail("");
        setContactLine("");
        setContactPhone("");
        setEvidenceFile(null);
        setEvidenceBase64("");
        setEvidenceName("");
        setEvidenceMimeType("");
        // Reload history list
        await fetchLeaveHistory(verifiedStudent.id);
      } else {
        const data = await res.json();
        setSubmitMessage({ text: data.error || "เกิดข้อผิดพลาดในการส่งใบลา", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setSubmitMessage({ text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อส่งคำขอได้", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLeaveTypeLabel = (type: 'sick' | 'personal' | 'other') => {
    if (type === "sick") return "ลาป่วย";
    if (type === "personal") return "ลากิจ";
    return "ลาอื่น ๆ";
  };

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col gap-1.5 text-center max-w-xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          ระบบส่งใบลาออนไลน์สำหรับผู้ปกครอง
        </h1>
        <p className="text-sm font-medium text-slate-500">
          กรอกรหัสนักเรียนและกรอกใบลาเรียนย้อนหลังหรือล่วงหน้า ข้อมูลจะถูกจัดส่งเข้าห้องเรียนและหน้าเช็คสถิติของครูโดยตรง
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 max-w-4xl mx-auto w-full">
        {/* Verification and Submission Form Card */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-5">
          {/* Step 1: Verify ID */}
          <form onSubmit={handleVerifyStudent} className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-600">1</span>
              ขั้นตอนแรก: ยืนยันตัวตนน้องนักเรียน
            </h3>
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="กรอกรหัสประจำตัวนักเรียน (เช่น 1001)..."
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={isVerifying || isSubmitting}
                required
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isVerifying || isSubmitting || !studentId.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer"
              >
                {isVerifying ? "กำลังเช็ค..." : "ตรวจสอบ"}
              </button>
            </div>
            
            {verifyError && (
              <p className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 rounded-lg p-2">{verifyError}</p>
            )}
            
            {verifiedStudent && (
              <div className="rounded-xl bg-emerald-50/50 border border-emerald-100/80 p-3.5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-slate-900">นักเรียน: {verifiedStudent.name}</span>
                  <span className="text-[10px] font-semibold text-slate-500">รหัสประจำตัว: {verifiedStudent.id}</span>
                </div>
                <span className="rounded bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                  ชั้นเรียน {verifiedStudent.classroom || "-"}
                </span>
              </div>
            )}
          </form>

          {/* Step 2: Leave Form */}
          {verifiedStudent && (
            <form onSubmit={handleSubmitLeave} className="flex flex-col gap-4 border-t border-slate-50 pt-5 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-600">2</span>
                ขั้นตอนที่สอง: กรอกรายละเอียดใบลา
              </h3>

              {/* Leave Type Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">ประเภทการลา</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sick', 'personal', 'other'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLeaveType(type)}
                      className={`rounded-xl py-2 px-3 text-xs font-bold transition-all border cursor-pointer ${
                        leaveType === type
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {getLeaveTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">ลาตั้งแต่วันที่</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">ลาถึงวันที่</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  />
                </div>
              </div>

              {/* Leave Reason */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">เหตุผลการลา</label>
                <textarea
                  rows={3}
                  placeholder="กรอกรายละเอียด เช่น ป่วยมีไข้สูง หรือ ไปทำธุระต่างจังหวัดกับผู้ปกครอง..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Parent Contacts */}
              <div className="flex flex-col gap-2 border-t border-slate-100/70 pt-3.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  📞 ข้อมูลติดต่อผู้ปกครอง (สะดวกช่องทางใดกรอกช่องทางนั้นได้เลยครับ)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400">อีเมล (Email)</label>
                    <input
                      type="email"
                      placeholder="parent@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 placeholder-slate-350 focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400">LINE ID</label>
                    <input
                      type="text"
                      placeholder="line-id"
                      value={contactLine}
                      onChange={(e) => setContactLine(e.target.value)}
                      disabled={isSubmitting}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 placeholder-slate-350 focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400">เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      placeholder="081-234-5678"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      disabled={isSubmitting}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 placeholder-slate-350 focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Evidence Upload */}
              <div className="flex flex-col gap-1.5 border-t border-slate-100/70 pt-3.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  📎 แนบเอกสารหลักฐาน (ใบรับรองแพทย์/หลักฐานประกอบการลา - ขนาดไม่เกิน 5MB)
                </label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-all cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      เลือกไฟล์แนบ (.jpg, .png, .pdf, .doc)
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleFileChange}
                        disabled={isSubmitting}
                        className="hidden"
                      />
                    </label>
                    
                    {evidenceFile && (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-700 animate-fade-in">
                        <span className="truncate max-w-[180px]">{evidenceFile.name}</span>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {fileError && (
                    <p className="text-[10px] font-bold text-red-500">{fileError}</p>
                  )}
                </div>
              </div>

              {submitMessage.text && (
                <div className={`rounded-xl p-3 border text-xs font-semibold ${
                  submitMessage.type === "success" 
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                    : "bg-red-50 border-red-100 text-red-800"
                }`}>
                  {submitMessage.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !reason.trim()}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? "กำลังส่งใบลา..." : "ส่งใบลาเรียน"}
              </button>
            </form>
          )}
        </div>

        {/* History List Card */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            ประวัติการลาน้องนักเรียน
          </h3>

          {!verifiedStudent ? (
            <div className="py-20 text-center text-xs font-bold text-slate-400">
              กรุณากรอกและตรวจสอบรหัสนักเรียนก่อน เพื่อเรียกดูประวัติการลา
            </div>
          ) : historyLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-[10px] font-bold">กำลังโหลดประวัติ...</span>
            </div>
          ) : leaveHistory.length === 0 ? (
            <div className="py-20 text-center text-xs font-bold text-slate-400">
              ยังไม่พบการยื่นใบลาในประวัตินักเรียนคนนี้
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[380px]">
              {leaveHistory.map((leave) => {
                const isApproved = leave.status === "approved";
                const isRejected = leave.status === "rejected";
                const isPending = leave.status === "pending";

                return (
                  <div key={leave.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-[9px] font-extrabold text-blue-600">
                        {getLeaveTypeLabel(leave.type)}
                      </span>
                      
                      <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black ${
                        isApproved
                          ? "bg-emerald-50 text-emerald-600"
                          : isRejected
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {isApproved ? "อนุมัติแล้ว" : isRejected ? "ปฏิเสธ" : "รออนุมัติ"}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">
                      <span>ลา: {format(new Date(leave.startDate), "dd/MM/yyyy")} ถึง {format(new Date(leave.endDate), "dd/MM/yyyy")}</span>
                      <span className="text-slate-800 mt-1 line-clamp-2">เหตุผล: {leave.reason}</span>
                      {leave.evidenceUrl && (
                        <a 
                          href={leave.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline mt-1.5 flex items-center gap-1 text-[9px] font-bold"
                        >
                          <svg xmlns="http://www.w3.org/2050/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          ดูเอกสารหลักฐานประกอบการลา
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
