"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Student } from "@/lib/types";

// Load FaceDetector dynamically to avoid SSR node-environment crashes
const FaceDetector = dynamic(() => import("@/components/FaceDetector"), {
  ssr: false,
  loading: () => (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center shadow-inner animate-pulse">
      <span className="text-xs font-semibold text-slate-400">กำลังดาวน์โหลดตัวสแกนใบหน้า...</span>
    </div>
  ),
});

interface CheckInLog {
  id: string;
  name: string;
  time: string;
  distance: number;
}

export default function CheckInPage() {
  const [scanMode, setScanMode] = useState<"auto" | "manual">("auto");
  const [isScanning, setIsScanning] = useState(true);
  const [matchStatus, setMatchStatus] = useState<"searching" | "found" | "failed">("searching");
  const [currentMatch, setCurrentMatch] = useState<CheckInLog | null>(null);
  const [history, setHistory] = useState<CheckInLog[]>([]);

  // 1. Fetch recent scan history on load
  const fetchRecentLogs = async () => {
    try {
      const res = await fetch("/api/attendance");
      if (res.ok) {
        const data = await res.json();
        // Map API records to local layout interface
        const logs: CheckInLog[] = (data.attendance || [])
          .slice(-5) // get last 5
          .reverse() // show latest first
          .map((record: any) => {
            const date = new Date(record.timestamp);
            return {
              id: record.studentId,
              name: record.studentName,
              time: date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
              // Reconstruct mockup distance for list presentation (mapped back from confidence score)
              distance: parseFloat(((100 - record.confidence) / 100).toFixed(2)),
            };
          });
        setHistory(logs);
      }
    } catch (err) {
      console.error("Error fetching attendance history:", err);
    }
  };

  useEffect(() => {
    fetchRecentLogs();
  }, []);

  // 2. Callback when face matching finishes processing a frame
  const handleFaceMatch = async (matchedStudent: Student | null, distance: number) => {
    const formattedTime = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
    
    if (matchedStudent) {
      // 1. Found Match
      const matchedLog: CheckInLog = {
        id: matchedStudent.id,
        name: matchedStudent.name,
        time: formattedTime,
        distance,
      };
      setCurrentMatch(matchedLog);
      setMatchStatus("found");
      
      // Update session listing
      fetchRecentLogs();
    } else {
      // 2. Failed Match (Unknown face / High distance)
      setCurrentMatch({
        id: "Unknown",
        name: "ไม่พบข้อมูลที่ตรงกัน",
        time: "",
        distance,
      });
      setMatchStatus("failed");
    }
  };

  const handleManualScanTrigger = () => {
    setIsScanning(true);
    setMatchStatus("searching");
    setCurrentMatch(null);
  };

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          ระบบสแกนใบหน้าเช็คชื่อเข้าเรียน
        </h1>
        <p className="text-sm font-medium text-slate-500">
          จับคู่ใบหน้าผ่านกล้องเว็บแคม เปรียบเทียบกับฐานข้อมูลนักเรียน (AI Distance Threshold ผ่อนปรน &lt; 0.75 สำหรับใช้สาธิต)
        </p>
      </div>

      {/* Main Container Layout */}
      <div className="grid gap-8 lg:grid-cols-12 mt-2">
        {/* Left Side: Webcam Frame */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            {/* Mode Controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl p-1">
                <button
                  onClick={() => {
                    setScanMode("auto");
                    setIsScanning(true);
                    setCurrentMatch(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    scanMode === "auto"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  สแกนอัตโนมัติ (Continuous)
                </button>
                <button
                  onClick={() => {
                    setScanMode("manual");
                    setIsScanning(false);
                    setMatchStatus("searching");
                    setCurrentMatch(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    scanMode === "manual"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  สแกนด้วยตนเอง (Manual)
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${isScanning && scanMode === "auto" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                <span className="text-xs font-bold text-slate-600">
                  {scanMode === "auto" && isScanning ? "กำลังรันกล้องต่อเนื่อง" : "กล้องสแตนด์บาย"}
                </span>
              </div>
            </div>

            {/* Webcam Live Frame Container */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 flex items-center justify-center">
              {/* Scan Laser Line */}
              {isScanning && <div className="animate-scan"></div>}

              {/* FaceDetector actual component */}
              <FaceDetector
                scanMode={scanMode}
                isScanning={isScanning}
                setIsScanning={setIsScanning}
                onMatch={handleFaceMatch}
                setMatchStatus={setMatchStatus}
              />

              {/* Scanning visual frames guides */}
              {isScanning && !currentMatch && (
                <div className="absolute inset-0 border-[24px] border-black/35 pointer-events-none flex items-center justify-center z-10">
                  <div className="w-56 h-56 rounded-full border-2 border-dashed border-blue-500/50 flex items-center justify-center relative">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500"></div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500"></div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500"></div>
                  </div>
                </div>
              )}

              {/* Overlay Feedback Panel displaying faceAPI data */}
              {currentMatch && (
                <div className="absolute bottom-4 left-4 right-4 z-20 rounded-xl bg-slate-900/90 border border-slate-700/50 p-3 text-white backdrop-blur-md flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-xs ${matchStatus === "found" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {matchStatus === "found" ? "OK" : "ERR"}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <h4 className="text-sm font-bold">{currentMatch.name}</h4>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        {currentMatch.id !== "Unknown" ? `รหัสประจำตัว: ${currentMatch.id}` : "ไม่พบประวัตินักเรียนในระบบ"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs font-extrabold text-blue-400">
                      Distance: {currentMatch.distance}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      {matchStatus === "found" ? `Match (ความแม่นยำ ${Math.round((1 - currentMatch.distance) * 100)}%)` : "High Distance (ยังไม่ตรงกัน)"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Scan Actions */}
            {scanMode === "manual" && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleManualScanTrigger}
                  disabled={isScanning}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  {isScanning ? "กำลังแสกนและค้นหา..." : "กดเพื่อค้นหาและสแกนใบหน้า (Scan)"}
                </button>
                {isScanning && (
                  <button
                    onClick={() => {
                      setIsScanning(false);
                      setCurrentMatch(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    หยุด
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Log sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                ประวัติการเช็คเรียนวันนี้
              </h2>
              <p className="text-[10px] font-semibold text-slate-500 mt-1">
                รายชื่อสแกนใบหน้าเข้าเรียนที่ตรวจพบ 5 คนล่าสุด
              </p>
            </div>

            {/* List of Scans */}
            <div className="flex flex-col gap-3">
              {history.length > 0 ? (
                history.map((record, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100/50 hover:border-slate-200 transition-all animate-fade-in"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-xs">
                        {record.name.charAt(0)}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-900">{record.name}</span>
                        <span className="text-[9px] text-slate-500 font-semibold">รหัส: {record.id}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-bold text-slate-900">{record.time}</span>
                      <span className="text-[9px] font-bold text-emerald-600">
                        Dist: {record.distance}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs font-semibold text-slate-400">
                  ยังไม่มีประวัติการสแกนในวันนี้
                </div>
              )}
            </div>

            {/* Link to dashboard */}
            <Link
              href="/dashboard"
              className="mt-2 rounded-xl bg-slate-100 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
            >
              <span>เปิดแดชบอร์ดสรุปสถิติ</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
