"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";

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
    parentLineId: "",
    avatarUrl: "",
    bloodGroup: "",
    emergencyPhone: "",
    medicalAlert: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [originalClassroom, setOriginalClassroom] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [compressing, setCompressing] = useState(false);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 150;
          const MAX_HEIGHT = 150;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์ภาพเท่านั้น");
      return;
    }

    setCompressing(true);
    try {
      const compressedBase64 = await compressImage(file);
      setFormData(prev => ({
        ...prev,
        avatarUrl: compressedBase64
      }));
    } catch (err) {
      console.error("Image compression error:", err);
      alert("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ");
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveAvatar = () => {
    setFormData(prev => ({
      ...prev,
      avatarUrl: ""
    }));
  };

  // 1. Fetch live student info and current user session on load
  useEffect(() => {
    async function loadStudentData() {
      try {
        const response = await fetch(`/api/students/${studentId}`);
        if (response.ok) {
          const data = await response.json();
          const student = data.student;
          setOriginalClassroom(student.classroom || "");
          const parsed = parseClassroomString(student.classroom || "");
          setFormData({
            id: student.id,
            name: student.name,
            email: student.email,
            division: student.level || "primary",
            grade: parsed.grade,
            room: parsed.room,
            parentLineId: student.parentLineId || "",
            avatarUrl: student.avatarUrl || "",
            bloodGroup: student.bloodGroup || "",
            emergencyPhone: student.emergencyPhone || "",
            medicalAlert: student.medicalAlert || "",
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
    
    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.loggedIn && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (e) {
        console.error("Error loading user profile:", e);
      } finally {
        setLoadingUser(false);
      }
    }

    if (studentId) {
      loadStudentData();
    }
    loadCurrentUser();
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

    // Frontend authorization check for classroom transfer
    const newClassroom = getAbbreviatedClassroom(formData.grade, formData.room);
    if (currentUser?.role === "teacher" && !currentUser.classrooms?.includes(newClassroom)) {
      setErrorMessage("คุณไม่มีสิทธิ์ย้ายนักเรียนไปยังห้องเรียนที่คุณไม่ได้ดูแล");
      setStatus("error");
      return;
    }

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
          parentLineId: formData.parentLineId,
          avatarUrl: formData.avatarUrl,
          bloodGroup: formData.bloodGroup,
          emergencyPhone: formData.emergencyPhone,
          medicalAlert: formData.medicalAlert,
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

  const isAdminValidated = typeof window !== "undefined" && localStorage.getItem("adminValidated") === "true";
  const isAuthorized = isAdminValidated || (currentUser && (currentUser.role === "admin" || (currentUser.role === "teacher" && originalClassroom && currentUser.classrooms?.includes(originalClassroom))));

  if (!loading && !loadingUser && !isAuthorized) {
    return (
      <AdminGuard allowTeacher={true}>
        <div className="flex flex-col gap-6 py-6 max-w-xl mx-auto w-full text-center">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-6 flex flex-col items-center gap-4 dark:bg-red-950/20 dark:border-red-900/40 mt-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h2 className="text-lg font-bold text-red-800 dark:text-red-400">ปฏิเสธการเข้าถึง (Access Denied)</h2>
            <p className="text-xs text-red-700 dark:text-red-450 font-medium">
              คุณไม่มีสิทธิ์เข้าถึงหรือแก้ไขข้อมูลนักเรียนในห้องเรียนนี้ ({originalClassroom || "ไม่มีระบุ"})
            </p>
            <Link
              href="/students"
              className="inline-flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition-colors"
            >
              กลับไปหน้ารายชื่อนักเรียน
            </Link>
          </div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard allowTeacher={true}>
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

            {/* Student Profile Picture (Avatar) */}
            <div className="flex flex-col gap-1.5 border-b border-slate-100 pb-4">
              <label className="text-xs font-bold text-slate-700">รูปภาพโปรไฟล์นักเรียน (Avatar)</label>
              <div className="flex items-center gap-4 mt-1">
                {/* Avatar Preview */}
                <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 shadow-inner">
                  {formData.avatarUrl ? (
                    <img
                      src={formData.avatarUrl}
                      alt="Student Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M12 12c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  )}
                </div>
                {/* File Input & Controls */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-950/40 rounded-xl text-xs font-bold transition-all cursor-pointer relative">
                      {compressing ? "กำลังบีบอัดรูป..." : "เลือกรูปภาพโปรไฟล์"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        disabled={status === "saving" || status === "success" || compressing}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    {formData.avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={status === "saving" || status === "success" || compressing}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        ลบรูปภาพ
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-tight">
                    รองรับไฟล์รูปภาพทั่วไป ระบบจะจำกัดความละเอียดและบีบอัดโดยอัตโนมัติไม่เกิน 150x150 พิกเซล
                  </span>
                </div>
              </div>
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

            {/* Parent LINE User ID */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="parentLineId" className="text-xs font-bold text-slate-700">
                  รหัส LINE User ID ผู้ปกครอง (สำหรับแจ้งเตือนส่วนตัว)
                </label>
                <span className="text-[10px] text-blue-600 font-semibold">ไม่บังคับ (Optional)</span>
              </div>
              <input
                type="text"
                id="parentLineId"
                name="parentLineId"
                placeholder="เช่น U1234567890abcdef1234567890abcdef"
                value={formData.parentLineId}
                onChange={handleChange}
                disabled={status === "saving" || status === "success"}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
              />
              <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">
                รหัสขึ้นต้นด้วย U ตามด้วยตัวเลขและตัวอักษรภาษาอังกฤษ 32 หลัก สำหรับส่งแจ้งเตือนรายบุคคลผ่าน LINE OA Push
              </p>
            </div>

            {/* Blood Group & Emergency Contact Section */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="bloodGroup" className="text-xs font-bold text-slate-700">
                  กรุ๊ปเลือด (Blood Group)
                </label>
                <select
                  id="bloodGroup"
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  disabled={status === "saving" || status === "success"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="O">O</option>
                  <option value="AB">AB</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="emergencyPhone" className="text-xs font-bold text-slate-700">
                  เบอร์ติดต่อฉุกเฉินผู้ปกครอง
                </label>
                <input
                  type="tel"
                  id="emergencyPhone"
                  name="emergencyPhone"
                  placeholder="เช่น 081-234-5678"
                  value={formData.emergencyPhone}
                  onChange={handleChange}
                  disabled={status === "saving" || status === "success"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Medical Alert / Allergy */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="medicalAlert" className="text-xs font-bold text-slate-700">
                โรคประจำตัว / ประวัติแพ้ยา (ถ้ามี)
              </label>
              <input
                type="text"
                id="medicalAlert"
                name="medicalAlert"
                placeholder="เช่น หอบหืด, แพ้ยาเพนิซิลลิน (ไม่มีให้ใส่ -)"
                value={formData.medicalAlert}
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
    </AdminGuard>
  );
}
