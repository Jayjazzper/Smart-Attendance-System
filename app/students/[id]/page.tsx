"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const LEVELS = [
  { value: "kindergarten", label: "ระดับอนุบาล" },
  { value: "primary", label: "ระดับประถมศึกษา" },
  { value: "secondary", label: "ระดับมัธยมศึกษา" },
];

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

const ROOMS = ["ห้อง 1", "ห้อง 2", "ห้อง 3", "ห้อง 4", "ห้อง 5"];

function getAbbreviatedClassroom(grade: string, room: string): string {
  const roomNumber = room.replace("ห้อง ", "");
  if (grade.startsWith("อนุบาล")) {
    const kNum = grade.split(" ")[1];
    return `อ.${kNum}/${roomNumber}`;
  }
  if (grade.startsWith("ประถม")) {
    const pNum = grade.split(" ")[2];
    return `ป.${pNum}/${roomNumber}`;
  }
  if (grade.startsWith("มัธยม")) {
    const mNum = grade.split(" ")[2];
    return `ม.${mNum}/${roomNumber}`;
  }
  return `${grade}/${roomNumber}`;
}

function parseClassroomString(classroomStr: string): { grade: string; room: string } {
  if (!classroomStr) return { grade: "ประถมศึกษาปีที่ 1", room: "ห้อง 1" };
  const parts = classroomStr.split("/");
  const prefixAndNum = parts[0]; // e.g. "ป.4", "ม.3", "อ.2"
  const roomNum = parts[1] || "1"; // e.g. "2"
  
  let grade = "ประถมศึกษาปีที่ 1";
  if (prefixAndNum.startsWith("อ.")) {
    const num = prefixAndNum.replace("อ.", "");
    grade = `อนุบาล ${num}`;
  } else if (prefixAndNum.startsWith("ป.")) {
    const num = prefixAndNum.replace("ป.", "");
    grade = `ประถมศึกษาปีที่ ${num}`;
  } else if (prefixAndNum.startsWith("ม.")) {
    const num = prefixAndNum.replace("ม.", "");
    grade = `มัธยมศึกษาปีที่ ${num}`;
  }
  
  return {
    grade,
    room: `ห้อง ${roomNum}`,
  };
}

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [formData, setFormData] = useState({
    id: studentId || "",
    name: "",
    email: "",
    division: "primary" as "kindergarten" | "primary" | "secondary",
    grade: "ประถมศึกษาปีที่ 1",
    room: "ห้อง 1",
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // 1. Fetch live student info on load
  useEffect(() => {
    async function loadStudentData() {
      try {
        const response = await fetch(`/api/students/${studentId}`);
        if (response.ok) {
          const data = await response.json();
          const student = data.student;
          const parsed = parseClassroomString(student.classroom || "");
          setFormData({
            id: student.id,
            name: student.name,
            email: student.email,
            division: student.level || "primary",
            grade: parsed.grade,
            room: parsed.room,
          });
        } else {
          setErrorMessage("ไม่สามารถดึงข้อมูลนักเรียนรหัสนี้ได้");
          setStatus("error");
        }
      } catch (err) {
        console.error("Error loading student info:", err);
        setErrorMessage("ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อโหลดข้อมูลได้");
        setStatus("error");
      } finally {
        setLoading(false);
      }
    }
    if (studentId) {
      loadStudentData();
    }
  }, [studentId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };
      
      // If division changes, automatically update grade to the first option of new division
      if (name === "division") {
        const nextDivision = value as "kindergarten" | "primary" | "secondary";
        next.grade = GRADE_LEVELS[nextDivision][0].value;
      }
      return next;
    });
  };

  // 2. Submit updates via PUT API route
  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    setStatus("saving");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          classroom: getAbbreviatedClassroom(formData.grade, formData.room),
          level: formData.division,
        }),
      });

      if (response.ok) {
        setStatus("success");
        setTimeout(() => {
          router.push("/students");
        }, 1000);
      } else {
        const errData = await response.json();
        setErrorMessage(errData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        setStatus("error");
      }
    } catch (err) {
      console.error("Update API error:", err);
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่ออัปเดตข้อมูลได้");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in max-w-xl mx-auto w-full">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/students"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </Link>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            แก้ไขข้อมูลนักเรียน
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            ปรับปรุงรายละเอียดชื่อ-นามสกุล หรือที่อยู่อีเมลของรายชื่อนี้
          </p>
        </div>
      </div>

      {/* Form Container */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm mt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs font-bold">กำลังโหลดข้อมูลนักเรียน...</span>
          </div>
        ) : (
          <form onSubmit={handleUpdateStudent} className="flex flex-col gap-4">
            {/* Student ID (Disabled) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400">
                รหัสนักเรียน (ไม่สามารถแก้ไขได้)
              </label>
              <input
                type="text"
                value={formData.id}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-400 font-semibold cursor-not-allowed"
              />
            </div>

            {/* Student Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-bold text-slate-700">
                ชื่อ-นามสกุล
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={status === "saving" || status === "success"}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Student Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-700">
                อีเมล
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={status === "saving" || status === "success"}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Division & Grade & Room */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-bold text-slate-700">ระดับชั้นเรียน</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    name="division"
                    value={formData.division}
                    onChange={handleChange}
                    disabled={status === "saving" || status === "success"}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  >
                    {LEVELS.map((lvl) => (
                      <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                    ))}
                  </select>
                  
                  <select
                    name="grade"
                    value={formData.grade}
                    onChange={handleChange}
                    disabled={status === "saving" || status === "success"}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  >
                    {GRADE_LEVELS[formData.division].map((grd) => (
                      <option key={grd.value} value={grd.value}>{grd.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 col-span-2">
                <label htmlFor="room" className="text-xs font-bold text-slate-700">ห้องเรียน</label>
                <select
                  id="room"
                  name="room"
                  value={formData.room}
                  onChange={handleChange}
                  disabled={status === "saving" || status === "success"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                >
                  {ROOMS.map((rm) => (
                    <option key={rm} value={rm}>{rm}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Feedback/Error messages */}
            {status === "error" && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex gap-2 animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-red-800">เกิดข้อผิดพลาด</span>
                  <p className="text-[11px] text-red-700 leading-relaxed font-semibold">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <Link
                href="/students"
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </Link>
              <button
                type="submit"
                disabled={status === "saving" || status === "success" || !formData.name || !formData.email}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white shadow-sm transition-all ${
                  status === "success"
                    ? "bg-emerald-600 shadow-emerald-500/20"
                    : "bg-blue-600 shadow-blue-500/20 hover:bg-blue-700"
                }`}
              >
                {status === "idle" || status === "error" ? (
                  "บันทึกข้อมูล"
                ) : status === "saving" ? (
                  <>กำลังบันทึกข้อมูล...</>
                ) : (
                  "✓ บันทึกสำเร็จ!"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
