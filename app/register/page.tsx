"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

// Load CameraCapture component with SSR disabled to prevent SSR browser-globals errors
const CameraCapture = dynamic(() => import("@/components/CameraCapture"), {
  ssr: false,
  loading: () => (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center shadow-inner animate-pulse">
      <span className="text-xs font-semibold text-slate-400">กำลังดาวน์โหลดตัวควบคุมกล้อง...</span>
    </div>
  ),
});

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    email: "",
    consent: false,
  });
  const [status, setStatus] = useState<"idle" | "capturing" | "scanning" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Called when camera successfully extracts a 128d face descriptor vector
  const handleFaceCaptured = async (descriptorArray: number[]) => {
    try {
      setStatus("scanning");
      
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: formData.id,
          name: formData.name,
          email: formData.email,
          faceDescriptor: descriptorArray,
          consentGiven: formData.consent,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(result.error || "เกิดข้อผิดพลาดในการลงทะเบียนใบหน้า");
      }
    } catch (err) {
      console.error("API submission error:", err);
      setStatus("error");
      setErrorMessage("ไม่สามารถเชื่อมต่อเครื่องเซิร์ฟเวอร์ฐานข้อมูลได้");
    }
  };

  const handleValidationCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.name.trim() || !formData.email.trim()) {
      setErrorMessage("กรุณากรอกข้อมูลนักเรียนให้ครบถ้วนก่อนสแกนใบหน้า");
      setStatus("error");
      return;
    }
    if (!formData.consent) {
      setErrorMessage("กรุณายอมรับนโยบายคุ้มครองข้อมูลส่วนบุคคล (Consent) ก่อนทำการสแกน");
      setStatus("error");
      return;
    }
    setErrorMessage("");
    setStatus("idle"); // reset state to ready for camera interaction
  };

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          ลงทะเบียนนักเรียนใหม่
        </h1>
        <p className="text-sm font-medium text-slate-500">
          กรอกข้อมูลและสแกนใบหน้าเพื่อแปลงเป็นเวกเตอร์ 128 มิติ บันทึกลงในเครื่องแบบออฟไลน์
        </p>
      </div>

      {/* Main Grid: Form on Left, Camera on Right */}
      <div className="grid gap-8 md:grid-cols-12 mt-2">
        {/* Left Side: Form */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              ข้อมูลพื้นฐานของนักเรียน
            </h2>
            <form onSubmit={handleValidationCheck} className="flex flex-col gap-4">
              {/* Student ID */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="id" className="text-xs font-bold text-slate-700">
                  รหัสนักเรียน
                </label>
                <input
                  type="text"
                  id="id"
                  name="id"
                  placeholder="เช่น 65010999"
                  value={formData.id}
                  onChange={handleChange}
                  disabled={status === "capturing" || status === "scanning" || status === "success"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
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
                  placeholder="เช่น นายอัจฉริยะ เรียนดี"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={status === "capturing" || status === "scanning" || status === "success"}
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
                  placeholder="เช่น student@university.ac.th"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={status === "capturing" || status === "scanning" || status === "success"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Consent Box */}
              <div className="mt-2 rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="flex h-5 items-center">
                    <input
                      id="consent"
                      name="consent"
                      type="checkbox"
                      checked={formData.consent}
                      onChange={handleChange}
                      disabled={status === "capturing" || status === "scanning" || status === "success"}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="consent" className="text-xs font-bold text-slate-900 cursor-pointer">
                      ข้อตกลงความเป็นส่วนตัว (PDPA Consent)
                    </label>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                      ฉันยินยอมให้ระบบสแกนใบหน้าและสกัดโครงสร้างเวกเตอร์ 128 มิติ เพื่อใช้ในการตรวจสอบสถิติการเรียน ระบบนี้จะไม่บันทึกภาพถ่ายดิบลงในฮาร์ดดิสก์
                    </p>
                  </div>
                </div>
              </div>

              {/* Information Status Trigger */}
              {status === "idle" && (!formData.id || !formData.name || !formData.email || !formData.consent) && (
                <button
                  type="submit"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-slate-400 shadow-sm cursor-pointer"
                >
                  กรุณากรอกข้อมูลและยอมรับข้อตกลงก่อน
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Side: Camera Component */}
        <div className="md:col-span-7 flex flex-col gap-4">
          {formData.id && formData.name && formData.email && formData.consent ? (
            status === "success" ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex flex-col items-center justify-center gap-4 text-emerald-400 animate-fade-in">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-2 ring-emerald-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="text-center">
                  <h4 className="text-base font-bold text-white">ลงทะเบียนระบบสแกนใบหน้าสำเร็จ!</h4>
                  <p className="text-xs text-emerald-300 mt-1 font-semibold">ข้อมูลของ {formData.name} บันทึกสำเร็จ</p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => {
                      setFormData({ id: "", name: "", email: "", consent: false });
                      setStatus("idle");
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                  >
                    ลงทะเบียนคนใหม่
                  </button>
                  <Link
                    href="/check-in"
                    className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    เข้าสู่สแกนเช็คชื่อ
                  </Link>
                </div>
              </div>
            ) : (
              <CameraCapture
                onCapture={handleFaceCaptured}
                status={status}
                setStatus={setStatus}
                setErrorMessage={setErrorMessage}
              />
            )
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center shadow-inner">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 p-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 animate-pulse-slow text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <div className="text-center max-w-sm">
                  <p className="text-xs font-bold text-slate-200">กล้องเว็บแคมจะทำงานอัตโนมัติ</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-semibold leading-relaxed">
                    กรุณากรอกรหัสนักเรียน ชื่อ อีเมล และกดติ๊กยินยอม PDPA Consent ด้านซ้ายให้เรียบร้อยก่อน ระบบจึงจะเชื่อมต่อกล้องเว็บแคมเพื่อแสกนใบหน้า
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feedback/Error messages */}
          {status === "error" && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex gap-2 animate-fade-in">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-red-800">มีข้อผิดพลาดเกิดขึ้น</span>
                <p className="text-[11px] text-red-700 leading-relaxed font-semibold">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
