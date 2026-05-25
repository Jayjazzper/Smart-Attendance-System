"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";

interface ClassroomSetting {
  lineToken?: string;
}

interface SystemSettings {
  classrooms: Record<string, ClassroomSetting>;
  lineChannelAccessToken?: string;
  teacherPasscode?: string;
  adminPasscode?: string;
  schoolName?: string;
  schoolDistrict?: string;
  schoolLogo?: string;
}

interface Student {
  id: string;
  name: string;
  classroom?: string;
  level?: string;
}

export default function SettingsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ classrooms: {}, lineChannelAccessToken: "", teacherPasscode: "1234", adminPasscode: "1234", schoolName: "", schoolDistrict: "", schoolLogo: "" });
  const [loading, setLoading] = useState(true);
  
  // Visibility maps for tokens (so they aren't visible by default)
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  
  // Status states
  const [savingClassroom, setSavingClassroom] = useState<string | null>(null);
  const [testingClassroom, setTestingClassroom] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<Record<string, { text: string; type: "success" | "error" }>>({});

  // LINE OA states
  const [testPushUserId, setTestPushUserId] = useState("");
  const [isSavingOAToken, setIsSavingOAToken] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [oaStatusMessage, setOaStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showOAToken, setShowOAToken] = useState(false);

  // School Profile states
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatusMessage, setProfileStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Backup & Restore states
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupOverwrite, setBackupOverwrite] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 1. Fetch Students and current settings
  const fetchData = async () => {
    try {
      const [studentsRes, settingsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/settings")
      ]);
      
      if (studentsRes.ok && settingsRes.ok) {
        const studentsData = await studentsRes.json();
        const settingsData = await settingsRes.json();
        
        setStudents(studentsData.students || []);
        // Set settings defaults if empty
        setSettings(settingsData || { classrooms: {}, lineChannelAccessToken: "" });
      }
    } catch (err) {
      console.error("Error loading settings page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const savedTestId = localStorage.getItem("testPushUserId");
    if (savedTestId) setTestPushUserId(savedTestId);
  }, []);

  // Get all unique classrooms from registered students
  const classroomsList = Array.from(
    new Set(students.map(s => s.classroom).filter(Boolean))
  ).sort() as string[];

  // 2. Toggle token visibility
  const toggleVisibility = (cls: string) => {
    setVisibleTokens(prev => ({ ...prev, [cls]: !prev[cls] }));
  };

  // 3. Handle Token input changes
  const handleTokenChange = (cls: string, token: string) => {
    setSettings(prev => ({
      ...prev,
      classrooms: {
        ...prev.classrooms,
        [cls]: {
          ...prev.classrooms[cls],
          lineToken: token
        }
      }
    }));
  };

  // 4. Save Settings for a specific Classroom
  const handleSaveClassroomToken = async (cls: string) => {
    setSavingClassroom(cls);
    setStatusMessages(prev => ({ ...prev, [cls]: { text: "", type: "success" } }));

    try {
      // Load current settings and update the specific classroom
      const updatedSettings = {
        ...settings,
        classrooms: {
          ...settings.classrooms,
          [cls]: {
            ...settings.classrooms[cls],
            lineToken: settings.classrooms[cls]?.lineToken || ""
          }
        }
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings)
      });

      if (res.ok) {
        setSettings(updatedSettings);
        setStatusMessages(prev => ({
          ...prev,
          [cls]: { text: "✓ บันทึกสำเร็จ", type: "success" }
        }));
        setTimeout(() => {
          setStatusMessages(prev => ({ ...prev, [cls]: { text: "", type: "success" } }));
        }, 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMessages(prev => ({
          ...prev,
          [cls]: { text: errData.error || "เกิดข้อผิดพลาดในการบันทึก", type: "error" }
        }));
      }
    } catch (err) {
      console.error(err);
      setStatusMessages(prev => ({
        ...prev,
        [cls]: { text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", type: "error" }
      }));
    } finally {
      setSavingClassroom(null);
    }
  };

  // 5. Test LINE Notify Message
  const handleTestToken = async (cls: string) => {
    const token = settings.classrooms[cls]?.lineToken;
    if (!token) {
      setStatusMessages(prev => ({
        ...prev,
        [cls]: { text: "กรุณากรอก Token ก่อนทดสอบ", type: "error" }
      }));
      return;
    }

    setTestingClassroom(cls);
    setStatusMessages(prev => ({ ...prev, [cls]: { text: "", type: "success" } }));

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "testLine",
          token: token
        })
      });

      if (res.ok) {
        setStatusMessages(prev => ({
          ...prev,
          [cls]: { text: "✓ ส่งข้อความทดสอบเข้ากลุ่มไลน์สำเร็จแล้ว!", type: "success" }
        }));
      } else {
        const data = await res.json();
        setStatusMessages(prev => ({
          ...prev,
          [cls]: { text: data.error || "Token ไม่ถูกต้อง หรือหมดอายุ", type: "error" }
        }));
      }
    } catch (err) {
      console.error(err);
      setStatusMessages(prev => ({
        ...prev,
        [cls]: { text: "ไม่สามารถส่งคำสั่งเชื่อมต่อได้", type: "error" }
      }));
    } finally {
      setTestingClassroom(null);
    }
  };

  const handleTestUserIdChange = (val: string) => {
    setTestPushUserId(val);
    localStorage.setItem("testPushUserId", val);
  };

  const handleOATokenChange = (val: string) => {
    setSettings(prev => ({
      ...prev,
      lineChannelAccessToken: val
    }));
  };

  const handleSaveOAToken = async () => {
    setIsSavingOAToken(true);
    setOaStatusMessage(null);

    try {
      const updatedSettings = {
        ...settings,
        lineChannelAccessToken: settings.lineChannelAccessToken || ""
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings)
      });

      if (res.ok) {
        setSettings(updatedSettings);
        setOaStatusMessage({ text: "✓ บันทึกโทเคน LINE OA สำเร็จ", type: "success" });
        setTimeout(() => setOaStatusMessage(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setOaStatusMessage({ text: errData.error || "เกิดข้อผิดพลาดในการบันทึกโทเคน", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setOaStatusMessage({ text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", type: "error" });
    } finally {
      setIsSavingOAToken(false);
    }
  };

  const handleTestPushNotification = async () => {
    if (!settings.lineChannelAccessToken || !testPushUserId) {
      setOaStatusMessage({ text: "กรุณาระบุ Channel Access Token และ User ID สำหรับทดสอบ", type: "error" });
      return;
    }

    setIsTestingPush(true);
    setOaStatusMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "testLinePush",
          accessToken: settings.lineChannelAccessToken,
          testUserId: testPushUserId
        })
      });

      if (res.ok) {
        setOaStatusMessage({ text: "✓ ส่งข้อความทดสอบแบบ Push สำเร็จแล้ว! (ตรวจเช็คแชท LINE ของคุณ)", type: "success" });
      } else {
        const data = await res.json();
        setOaStatusMessage({ text: data.error || "Token หรือ User ID ไม่ถูกต้อง", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setOaStatusMessage({ text: "ไม่สามารถส่งคำสั่งเชื่อมต่อได้", type: "error" });
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleSchoolNameChange = (val: string) => {
    setSettings(prev => ({ ...prev, schoolName: val }));
  };

  const handleSchoolDistrictChange = (val: string) => {
    setSettings(prev => ({ ...prev, schoolDistrict: val }));
  };

  const handleSchoolLogoChange = (val: string) => {
    setSettings(prev => ({ ...prev, schoolLogo: val }));
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileStatusMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setProfileStatusMessage({ text: "✓ บันทึกข้อมูลโรงเรียนสำเร็จแล้ว!", type: "success" });
        setTimeout(() => setProfileStatusMessage(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setProfileStatusMessage({ text: errData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setProfileStatusMessage({ text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", type: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfileStatusMessage({ text: "⏳ กำลังประมวลผลและบีบอัดรูปภาพ...", type: "success" });

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          const maxDim = 200; // Resize to max 200px
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL("image/png");
          setSettings(prev => ({ ...prev, schoolLogo: base64 }));
          setProfileStatusMessage({ text: "✓ ประมวลผลรูปภาพสำเร็จแล้ว! อย่าลืมกดปุ่มบันทึกด้านล่าง", type: "success" });
          setTimeout(() => setProfileStatusMessage(null), 3000);
        };
        img.onerror = () => {
          setProfileStatusMessage({ text: "เกิดข้อผิดพลาดในการโหลดรูปภาพ", type: "error" });
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        setProfileStatusMessage({ text: "เกิดข้อผิดพลาดในการอ่านไฟล์", type: "error" });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setProfileStatusMessage({ text: "ไม่สามารถประมวลผลรูปภาพได้", type: "error" });
    }
  };

  const [isSavingPasscode, setIsSavingPasscode] = useState(false);
  const [passcodeStatusMessage, setPasscodeStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [isSavingAdminPasscode, setIsSavingAdminPasscode] = useState(false);
  const [adminPasscodeStatusMessage, setAdminPasscodeStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handlePasscodeChange = (val: string) => {
    setSettings(prev => ({
      ...prev,
      teacherPasscode: val
    }));
  };

  const handleAdminPasscodeChange = (val: string) => {
    setSettings(prev => ({
      ...prev,
      adminPasscode: val
    }));
  };

  const handleSavePasscode = async () => {
    setIsSavingPasscode(true);
    setPasscodeStatusMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setPasscodeStatusMessage({ text: "✓ บันทึกรหัสผ่านคุณครูสำเร็จแล้ว!", type: "success" });
        setTimeout(() => setPasscodeStatusMessage(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setPasscodeStatusMessage({ text: errData.error || "เกิดข้อผิดพลาดในการบันทึกรหัสผ่าน", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setPasscodeStatusMessage({ text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", type: "error" });
    } finally {
      setIsSavingPasscode(false);
    }
  };

  const handleSaveAdminPasscode = async () => {
    setIsSavingAdminPasscode(true);
    setAdminPasscodeStatusMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setAdminPasscodeStatusMessage({ text: "✓ บันทึกรหัสผ่านผู้ดูแลระบบสำเร็จแล้ว!", type: "success" });
        setTimeout(() => setAdminPasscodeStatusMessage(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAdminPasscodeStatusMessage({ text: errData.error || "เกิดข้อผิดพลาดในการบันทึกรหัสผ่าน", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setAdminPasscodeStatusMessage({ text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", type: "error" });
    } finally {
      setIsSavingAdminPasscode(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    setBackupStatusMessage(null);
    try {
      const res = await fetch("/api/backup");
      if (res.ok) {
        const data = await res.json();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `smart_attendance_students_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setBackupStatusMessage({ text: "✓ ส่งออกไฟล์สำรองข้อมูลสำเร็จ!", type: "success" });
      } else {
        setBackupStatusMessage({ text: "ไม่สามารถส่งออกข้อมูลนักเรียนได้", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setBackupStatusMessage({ text: "เกิดข้อผิดพลาดในการส่งออกข้อมูล", type: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFile) return;

    setIsImporting(true);
    setBackupStatusMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!parsed || !Array.isArray(parsed.students)) {
            setBackupStatusMessage({ text: "โครงสร้างไฟล์ข้อมูลไม่ถูกต้อง (ต้องเป็น JSON ที่มีฟิลด์ students)", type: "error" });
            setIsImporting(false);
            return;
          }

          const res = await fetch("/api/backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              students: parsed.students,
              overwrite: backupOverwrite
            })
          });

          if (res.ok) {
            const result = await res.json();
            setBackupStatusMessage({ text: `✓ นำเข้าข้อมูลเด็กสำเร็จแล้ว! รวมทั้งสิ้น ${result.count} คน`, type: "success" });
            setBackupFile(null);
            fetchData(); // Refresh students list and classrooms list
          } else {
            const errData = await res.json();
            setBackupStatusMessage({ text: errData.error || "เกิดข้อผิดพลาดในการนำเข้าไฟล์", type: "error" });
          }
        } catch (parseErr) {
          setBackupStatusMessage({ text: "ไฟล์ที่เลือกไม่ใช่ไฟล์ JSON ที่ถูกต้อง", type: "error" });
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(backupFile);
    } catch (err) {
      console.error(err);
      setBackupStatusMessage({ text: "ไม่สามารถอ่านไฟล์ได้", type: "error" });
      setIsImporting(false);
    }
  };

  return (
    <AdminGuard>
      <div className="flex flex-col gap-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          ตั้งค่าระบบและการแจ้งเตือน
        </h1>
        <p className="text-sm font-medium text-slate-500">
          ตั้งค่าการเชื่อมต่อแจ้งเตือนไลน์กลุ่มผู้ปกครองและคุณครู แยกเฉพาะรายห้องเรียน
        </p>
      </div>

      {/* Guide Card */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-blue-900">วิธีเชื่อมต่อแจ้งเตือนกลุ่ม LINE Notify</h3>
          <ol className="text-xs text-blue-800 list-decimal list-inside space-y-1.5 font-medium leading-relaxed">
            <li>เข้าไปที่หน้าเว็บหลักของ <a href="https://notify-bot.line.me/my/" target="_blank" rel="noopener noreferrer" className="underline font-bold text-blue-700 hover:text-blue-900">LINE Notify (คลิกเปิดที่นี่)</a> แล้วเข้าสู่ระบบด้วยบัญชี LINE</li>
            <li>กดปุ่ม **"ออกโทเคน (Generate Token)"** ที่อยู่ด้านล่างสุดของหน้าต่างโปรไฟล์</li>
            <li>ตั้งชื่อบริการแสดงตัวข้อความแจ้งเตือน (เช่น *เช็คชื่อ ป.4/2*) จากนั้นพิมพ์ค้นหากลุ่ม LINE ที่ต้องการส่งข้อความแจ้งเตือน แล้วคลิกเลือกกลุ่มนั้น</li>
            <li>กดปุ่ม **"ออกโทเคน (Generate Token)"** จากนั้น**คัดลอกรหัส (Token)** ที่แสดงขึ้นมาเอาไว้</li>
            <li>เชิญบัญชีบอทอย่างเป็นทางการของ LINE ที่ชื่อว่า **`LINE Notify`** เข้ามาในกลุ่มแชทไลน์ดังกล่าว</li>
            <li>นำรหัสโทเคนมาวางลงในช่องห้องเรียนด้านล่างนี้ และกดบันทึกเป็นอันเรียบร้อยครับ</li>
          </ol>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-bold">กำลังโหลดการตั้งค่า...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* School Profile Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
                ข้อมูลโรงเรียนและหน่วยงาน (School Profile & Logo)
              </h3>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                ตั้งค่าข้อมูลชื่อโรงเรียน สังกัดสำนักงาน และอัปโหลดไฟล์โลโก้สัญลักษณ์ประจำโรงเรียนของคุณ
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                {/* School Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">ชื่อโรงเรียน (School Name)</label>
                  <input
                    type="text"
                    placeholder="ป้อนชื่อโรงเรียน..."
                    value={settings.schoolName || ""}
                    onChange={(e) => handleSchoolNameChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* School Affiliation */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">สังกัดหน่วยงาน (School Affiliation/District)</label>
                  <input
                    type="text"
                    placeholder="ป้อนสังกัดหน่วยงาน..."
                    value={settings.schoolDistrict || ""}
                    onChange={(e) => handleSchoolDistrictChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Logo Settings */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">โลโก้ประจำโรงเรียน (School Logo)</label>
                  
                  {/* Option 1: File Upload */}
                  <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500">ตัวเลือกที่ 1: แนบไฟล์รูปภาพอัปโหลด</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>

                  {/* Option 2: Image URL */}
                  <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 mt-1">
                    <span className="text-[10px] font-bold text-slate-500">ตัวเลือกที่ 2: ระบุเป็นลิงก์รูปภาพเว็บ (URL)</span>
                    <input
                      type="text"
                      placeholder="https://example.com/logo.png"
                      value={settings.schoolLogo && !settings.schoolLogo.startsWith("data:") ? settings.schoolLogo : ""}
                      onChange={(e) => handleSchoolLogoChange(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview of logo */}
            {settings.schoolLogo && (
              <div className="flex items-center gap-4 p-4 bg-blue-50/30 rounded-xl border border-blue-100/50">
                <div className="h-14 w-14 shrink-0 bg-white rounded-xl border border-slate-100 p-1 flex items-center justify-center shadow-sm">
                  <img
                    src={settings.schoolLogo}
                    alt="School Logo Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-700">รูปภาพโลโก้โรงเรียนปัจจุบัน</span>
                  <button
                    type="button"
                    onClick={() => handleSchoolLogoChange("")}
                    className="text-[10px] text-red-600 font-bold hover:underline cursor-pointer text-left"
                  >
                    ลบรูปโลโก้นี้ออก
                  </button>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer h-10"
              >
                {isSavingProfile ? "กำลังบันทึกข้อมูล..." : "บันทึกข้อมูลโรงเรียน"}
              </button>

              {profileStatusMessage && (
                <div className={`rounded-xl px-4 py-2 text-center text-xs font-bold border animate-fade-in ${
                  profileStatusMessage.type === "success"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                    : "bg-red-50 border-red-100 text-red-800"
                }`}>
                  {profileStatusMessage.text}
                </div>
              )}
            </div>
          </div>

          {/* LINE OA settings card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
                เชื่อมต่อระบบแจ้งเตือนส่วนตัว (LINE OA Push Notification)
              </h3>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                ป้อนข้อมูล LINE Developers Messaging API เพื่อตั้งระบบ Push ส่งตรงหาผู้ปกครองแบบรายบุคคลเมื่อเด็กเข้าเรียน
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-12 items-end">
              {/* Channel Access Token */}
              <div className="md:col-span-8 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">LINE Channel Access Token</label>
                  <button
                    type="button"
                    onClick={() => setShowOAToken(!showOAToken)}
                    className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    {showOAToken ? "ซ่อนรหัส" : "แสดงรหัส"}
                  </button>
                </div>
                <input
                  type={showOAToken ? "text" : "password"}
                  placeholder="ใส่ Channel Access Token (Long-lived) ของบอท..."
                  value={settings.lineChannelAccessToken || ""}
                  onChange={(e) => handleOATokenChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Save Button */}
              <div className="md:col-span-4">
                <button
                  onClick={handleSaveOAToken}
                  disabled={isSavingOAToken || isTestingPush}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer h-9.5"
                >
                  {isSavingOAToken ? "กำลังบันทึก..." : "บันทึกโทเคนระบบ"}
                </button>
              </div>
            </div>

            {/* Test Push Section */}
            <div className="border-t border-slate-50 pt-4 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-slate-800">ทดสอบระบบส่ง Push Notification ส่วนตัว</h4>
              
              <div className="grid gap-4 md:grid-cols-12 items-end">
                <div className="md:col-span-8 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">LINE User ID ผู้รับสำหรับการทดสอบ</label>
                  <input
                    type="text"
                    placeholder="ป้อน LINE User ID ของคุณ เช่น U1234567890abcdef..."
                    value={testPushUserId}
                    onChange={(e) => handleTestUserIdChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="md:col-span-4">
                  <button
                    onClick={handleTestPushNotification}
                    disabled={isSavingOAToken || isTestingPush || !settings.lineChannelAccessToken || !testPushUserId}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 transition-colors cursor-pointer h-9.5"
                  >
                    {isTestingPush ? "กำลังส่งทดสอบ..." : "ทดสอบส่ง Line Push"}
                  </button>
                </div>
              </div>

              {/* Guide for obtaining credentials */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-800">วิธีการหารหัสสำหรับทดสอบ:</span>
                <ul className="list-disc list-inside text-[10px] text-slate-500 font-semibold space-y-1 leading-relaxed">
                  <li>สมัคร LINE Official Account และเปิดใช้งาน Messaging API ใน <a href="https://manager.line.biz" target="_blank" rel="noopener noreferrer" className="underline font-bold text-blue-700 hover:text-blue-900">LINE OA Manager (คลิกเปิดที่นี่)</a></li>
                  <li>เข้าไปที่บัญชีนักพัฒนาของคุณใน <a href="https://developers.line.biz" target="_blank" rel="noopener noreferrer" className="underline font-bold text-blue-700 hover:text-blue-900">LINE Developers Console (คลิกเปิดที่นี่)</a></li>
                  <li>ออกรหัส **Channel Access Token** ในแท็บ Messaging API settings แล้วนำมาวางด้านบน</li>
                  <li>**LINE User ID** ของคุณหาได้จากหน้าจอหลักแท็บ Basic settings ด้านล่างสุด ของคอนโซล LINE Developers หรือดึงผ่าน webhook บอท</li>
                </ul>
              </div>
            </div>
          </div>

          {/* System Passcodes card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                กำหนดรหัสผ่านความปลอดภัยระบบ (System Passcodes)
              </h3>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                ตั้งค่าและเปลี่ยนรหัสผ่านสำหรับการเข้าใช้งานในระดับห้องเรียน และการเข้าถึงข้อมูลระบบของผู้ดูแลระบบ
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Teacher Passcode */}
              <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/50 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-800">รหัสผ่านสำหรับครูประจำชั้น (Teacher Passcode)</span>
                  <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                    ใช้สำหรับล็อกการใช้งานกล้องสแกนและสลับสิทธิ์การเข้าถึงข้อมูลเฉพาะห้องเรียนตนเอง
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="ป้อนรหัสผ่านครูประจำชั้น (เช่น 1234)..."
                    value={settings.teacherPasscode || ""}
                    onChange={(e) => handlePasscodeChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handleSavePasscode}
                    disabled={isSavingPasscode}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer h-9.5"
                  >
                    {isSavingPasscode ? "กำลังบันทึก..." : "บันทึกรหัสผ่านครู"}
                  </button>
                </div>
                {/* Passcode Status Display */}
                {passcodeStatusMessage && (
                  <div className={`rounded-xl px-4 py-2.5 text-center text-xs font-bold border animate-fade-in ${
                    passcodeStatusMessage.type === "success"
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                      : "bg-red-50 border-red-100 text-red-800"
                  }`}>
                    {passcodeStatusMessage.text}
                  </div>
                )}
              </div>

              {/* Admin Passcode */}
              <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/50 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-800">รหัสผ่านสำหรับผู้ดูแลระบบ (Admin Passcode)</span>
                  <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                    ใช้สำหรับเข้าถึงหน้าตั้งค่าระบบ หน้าจัดการข้อมูลนักเรียน และแก้ไขประวัติเด็กทุกคน
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="ป้อนรหัสผ่านผู้ดูแลระบบ (เช่น 1234)..."
                    value={settings.adminPasscode || ""}
                    onChange={(e) => handleAdminPasscodeChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handleSaveAdminPasscode}
                    disabled={isSavingAdminPasscode}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 disabled:bg-slate-300 transition-colors cursor-pointer h-9.5"
                  >
                    {isSavingAdminPasscode ? "กำลังบันทึก..." : "บันทึกรหัสผ่านแอดมิน"}
                  </button>
                </div>
                {/* Admin Passcode Status Display */}
                {adminPasscodeStatusMessage && (
                  <div className={`rounded-xl px-4 py-2.5 text-center text-xs font-bold border animate-fade-in ${
                    adminPasscodeStatusMessage.type === "success"
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                      : "bg-red-50 border-red-100 text-red-800"
                  }`}>
                    {adminPasscodeStatusMessage.text}
                  </div>
                )}
              </div>
            </div>

            {/* Logout Admin button to manually clear session */}
            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => {
                  localStorage.removeItem("adminValidated");
                  window.location.reload();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 border border-red-100 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors shadow-sm cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                ออกจากระบบผู้ดูแลระบบ (Logout Admin Session)
              </button>
            </div>

          </div>

          {/* Backup & Restore card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                สำรองและกู้คืนข้อมูลนักเรียน (System Backup & Restore)
              </h3>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                ดาวน์โหลดไฟล์สำรองข้อมูลเด็กนักเรียนรวมทั้งเวกเตอร์ใบหน้าทั้งหมด หรือนำเข้าจากไฟล์สำรองข้อมูลเพื่อกู้คืนบนเครื่องอื่นได้ทันที
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Export Side */}
              <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/50 flex flex-col gap-3 justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-800">ส่งออกข้อมูลนักเรียน (Export Backup)</span>
                  <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                    ระบบจะส่งออกข้อมูลเด็กนักเรียนทุกคน รวมถึงห้องเรียน และรูปภาพเวกเตอร์ใบหน้าสำหรับ Face Recognition เก็บเป็นไฟล์ JSON ลงในเครื่องคอมพิวเตอร์ของคุณ
                  </p>
                </div>
                <button
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer h-9.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline-block mr-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {isExporting ? "กำลังดาวน์โหลด..." : "ดาวน์โหลดไฟล์สำรองข้อมูล"}
                </button>
              </div>

              {/* Import Side */}
              <form onSubmit={handleImportBackup} className="rounded-xl border border-slate-100 p-4 bg-slate-50/50 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-800">นำเข้าข้อมูลนักเรียน (Import Backup)</span>
                  <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                    เลือกไฟล์สำรองข้อมูล JSON ที่เคยดาวน์โหลดไว้เพื่อนำกลับขึ้นระบบ
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  
                  <label className="flex items-center gap-2 cursor-pointer mt-1 select-none">
                    <input
                      type="checkbox"
                      checked={backupOverwrite}
                      onChange={(e) => setBackupOverwrite(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-slate-600">
                      เขียนทับฐานข้อมูลนักเรียนที่มีอยู่ทั้งหมด (Overwrite existing data)
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isImporting || !backupFile}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 disabled:bg-slate-300 transition-colors cursor-pointer h-9.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline-block mr-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {isImporting ? "กำลังนำเข้าข้อมูล..." : "เริ่มนำเข้าไฟล์สำรองข้อมูล"}
                </button>
              </form>
            </div>

            {/* Backup Status Display */}
            {backupStatusMessage && (
              <div className={`rounded-xl px-4 py-2.5 text-center text-xs font-bold border animate-fade-in ${
                backupStatusMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-red-50 border-red-100 text-red-800"
              }`}>
                {backupStatusMessage.text}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">กำหนด Token รายห้องเรียน</h3>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                เลือกและกรอกรหัสโทเคนตามห้องเรียนที่มีรายชื่อเด็กนักเรียนลงทะเบียนอยู่ในฐานข้อมูล
              </p>
            </div>

            {classroomsList.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400 flex flex-col gap-2">
                <span>ยังไม่มีข้อมูลห้องเรียนใด ๆ ในระบบ</span>
                <Link href="/register" className="text-blue-600 hover:underline">
                  ไปที่หน้าลงทะเบียนนักเรียนเพื่อเพิ่มห้องเรียนแรก ➜
                </Link>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-50">
                {classroomsList.map((cls) => {
                  const classroomSettings = settings.classrooms?.[cls];
                  const token = classroomSettings?.lineToken || "";
                  const status = statusMessages[cls];
                  const isSaving = savingClassroom === cls;
                  const isTesting = testingClassroom === cls;

                  return (
                    <div key={cls} className="py-4.5 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Classroom tag */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex h-9 w-16 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-xs font-black text-blue-600">
                          {cls}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900">ห้องเรียน {cls}</span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            จำนวนนักเรียน: {students.filter(s => s.classroom === cls).length} คน
                          </span>
                        </div>
                      </div>

                      {/* Token controls */}
                      <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <div className="flex-1 relative flex items-center">
                          <input
                            type={visibleTokens[cls] ? "text" : "password"}
                            placeholder="วางรหัส LINE Notify Token..."
                            value={token}
                            onChange={(e) => handleTokenChange(cls, e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white pl-4 pr-10 py-2 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => toggleVisibility(cls)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold cursor-pointer"
                          >
                            {visibleTokens[cls] ? "ซ่อน" : "แสดง"}
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveClassroomToken(cls)}
                            disabled={isSaving || isTesting}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer"
                          >
                            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                          </button>
                          
                          <button
                            onClick={() => handleTestToken(cls)}
                            disabled={isSaving || isTesting || !token}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 transition-colors cursor-pointer"
                          >
                            {isTesting ? "กำลังส่ง..." : "ทดสอบส่งไลน์"}
                          </button>
                        </div>
                      </div>

                      {/* Feedback status messages */}
                      {status?.text && (
                        <div className={`lg:w-56 shrink-0 rounded-xl px-3 py-2 text-center text-[10px] font-bold border ${
                          status.type === "success"
                            ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                            : "bg-red-50 border-red-100 text-red-800"
                        }`}>
                          {status.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </AdminGuard>
  );
}
