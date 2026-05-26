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

// Load QrCodeScanner dynamically to avoid SSR node-environment crashes
const QrCodeScanner = dynamic(() => import("@/components/QrCodeScanner"), {
  ssr: false,
  loading: () => (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center shadow-inner animate-pulse">
      <span className="text-xs font-semibold text-slate-400">กำลังดาวน์โหลดตัวสแกน QR / Barcode...</span>
    </div>
  ),
});

interface CheckInLog {
  id: string;
  name: string;
  time: string;
  distance: number;
  classroom?: string;
  status?: 'present' | 'late' | 'absent' | 'leave' | 'checked_out';
}

export default function CheckInPage() {
  const [scanMode, setScanMode] = useState<"auto" | "manual">("auto");
  const [scannerType, setScannerType] = useState<"face" | "qrcode">("face");
  const [checkMode, setCheckMode] = useState<"checkin" | "checkout">("checkin");
  const [isScanning, setIsScanning] = useState(true);
  const [matchStatus, setMatchStatus] = useState<"searching" | "found" | "failed">("searching");
  const [currentMatch, setCurrentMatch] = useState<CheckInLog | null>(null);
  const [history, setHistory] = useState<CheckInLog[]>([]);
  const [homeroomTime, setHomeroomTime] = useState("08:00");
  const [lateLimitTime, setLateLimitTime] = useState("08:30");

  // Connection states
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Health Screening states
  const [enableHealthScreening, setEnableHealthScreening] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthStudent, setHealthStudent] = useState<any | null>(null);
  const [healthDistance, setHealthDistance] = useState(0);
  const [healthCheckInStatus, setHealthCheckInStatus] = useState<'present' | 'late' | 'absent' | 'leave' | 'checked_out'>('present');
  const [healthTemperature, setHealthTemperature] = useState(36.5);
  const [healthStatus, setHealthStatus] = useState<'normal' | 'fever' | 'cough'>('normal');
  const [countdown, setCountdown] = useState(5);
  const [isCountdownActive, setIsCountdownActive] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);

  // 1. Fetch recent scan history on load
  const fetchRecentLogs = async () => {
    try {
      if (!navigator.onLine) return; // skip if offline
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
              classroom: record.classroom || "",
              status: record.status || "present",
            };
          });
        setHistory(logs);
      }
    } catch (err) {
      console.error("Error fetching attendance history:", err);
    }
  };

  // Sync function
  const syncOfflineScans = async () => {
    if (!navigator.onLine || isSyncing) return;
    const queued = localStorage.getItem("offlineScans");
    if (!queued) {
      setOfflineQueueCount(0);
      return;
    }

    try {
      const scans = JSON.parse(queued);
      if (!Array.isArray(scans) || scans.length === 0) {
        localStorage.removeItem("offlineScans");
        setOfflineQueueCount(0);
        return;
      }

      setIsSyncing(true);
      console.log(`Syncing ${scans.length} offline scans to server...`);
      
      for (const scan of scans) {
        await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scan),
        });
      }

      localStorage.removeItem("offlineScans");
      setOfflineQueueCount(0);
      fetchRecentLogs();
      console.log("Offline scans successfully synced!");
    } catch (err) {
      console.error("Failed to sync offline scans:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle local state updates from storage queue
  const updateQueueCount = () => {
    const queued = localStorage.getItem("offlineScans");
    if (queued) {
      try {
        const parsed = JSON.parse(queued);
        setOfflineQueueCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch (e) {
        setOfflineQueueCount(0);
      }
    } else {
      setOfflineQueueCount(0);
    }
  };

  useEffect(() => {
    fetchRecentLogs();
    
    // Set initial connection status
    setIsOnline(navigator.onLine);
    updateQueueCount();

    // Load health screening toggle persistent preference
    const savedScreening = localStorage.getItem("enableHealthScreening");
    if (savedScreening === "true") {
      setEnableHealthScreening(true);
    }

    // Event listeners for online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineScans();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleQueueChange = () => {
      updateQueueCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-scan-queued", handleQueueChange);

    // Interval worker to check and sync every 10 seconds
    const interval = setInterval(() => {
      updateQueueCount();
      if (navigator.onLine) {
        syncOfflineScans();
      }
    }, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-scan-queued", handleQueueChange);
      clearInterval(interval);
    };
  }, []);

  const handleToggleHealthScreening = (val: boolean) => {
    setEnableHealthScreening(val);
    localStorage.setItem("enableHealthScreening", String(val));
  };

  // Fetch student list on mount for offline support and barcode matching
  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await fetch("/api/students");
        if (res.ok) {
          const data = await res.json();
          const list = data.students || [];
          setStudents(list);
          localStorage.setItem("cachedStudents", JSON.stringify(list));
        } else {
          throw new Error("HTTP failure");
        }
      } catch (e) {
        const cached = localStorage.getItem("cachedStudents");
        if (cached) {
          setStudents(JSON.parse(cached));
        }
      }
    }
    loadStudents();
  }, []);

  const handleBarcodeScan = (scannedText: string) => {
    if (isPaused) return;

    // Search for student
    const matched = students.find(
      (s) => String(s.id).trim() === String(scannedText).trim()
    );

    if (matched) {
      let checkInStatus: "present" | "late" | "checked_out" = checkMode === "checkout" ? "checked_out" : "present";
      if (checkMode !== "checkout") {
        const timeNow = new Date();
        const currentHours = timeNow.getHours();
        const currentMinutes = timeNow.getMinutes();

        const [hrHour, hrMin] = (homeroomTime || "08:00").split(":").map(Number);
        if (currentHours > hrHour || (currentHours === hrHour && currentMinutes > hrMin)) {
          checkInStatus = "late";
        }
      }

      handleFaceMatch(matched, 0.0, checkInStatus);
    } else {
      handleFaceMatch(null, 1.0);
    }
  };

  // Hardware Barcode Scanner Global Event Listener
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // Determine if the user is typing in a text/password input box
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      );

      // If activeEl is a text/password input, skip intercepting (except our own input box)
      if (isInputActive && activeEl.getAttribute("type") !== "checkbox" && activeEl.getAttribute("type") !== "range" && activeEl.id !== "manual-barcode-input") {
        return;
      }

      // If key interval is more than 150ms, reset buffer (physical scanners dump keys in < 30ms)
      if (now - lastKeyTime > 150) {
        buffer = "";
      }
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (buffer.length > 2) {
          const scannedText = buffer.trim();
          buffer = "";
          handleBarcodeScan(scannedText);
        }
      } else {
        if (e.key.length === 1) {
          buffer += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [students, isPaused, homeroomTime, enableHealthScreening, healthStudent]);

  // 1.5-second auto-clear timer helper for scan matches
  const startAutoClearTimer = () => {
    setTimeout(() => {
      setCurrentMatch(null);
    }, 1500);
  };

  // Helper to submit check-in to API or queue offline
  const submitCheckIn = async (
    student: any,
    status: 'present' | 'late' | 'absent' | 'leave' | 'checked_out',
    confidence: number,
    temp?: number,
    hStatus?: 'normal' | 'fever' | 'cough'
  ) => {
    const scanPayload = {
      studentId: student.id,
      confidence: confidence,
      status: status,
      classroom: student.classroom || "",
      timestamp: new Date().toISOString(),
      temperature: temp,
      healthStatus: hStatus
    };

    try {
      if (!navigator.onLine) {
        throw new Error("ระบบอยู่ในสถานะออฟไลน์");
      }
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanPayload),
      });
      if (!res.ok) {
        throw new Error("HTTP connection failed");
      }
    } catch (err) {
      console.warn("สแกนบันทึกล้มเหลว (บันทึกออฟไลน์):", err);
      const existing = localStorage.getItem("offlineScans");
      const scans = existing ? JSON.parse(existing) : [];
      scans.push(scanPayload);
      localStorage.setItem("offlineScans", JSON.stringify(scans));
      window.dispatchEvent(new Event("offline-scan-queued"));
    }
  };

  // Health modal submission handler
  const handleHealthSubmit = async (
    temp: number,
    hStatus: 'normal' | 'fever' | 'cough'
  ) => {
    if (!healthStudent) return;
    
    const confidenceScore = Math.round((1 - healthDistance) * 100);
    await submitCheckIn(healthStudent, healthCheckInStatus, confidenceScore, temp, hStatus);
    
    const formattedTime = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
    const matchedLog: CheckInLog = {
      id: healthStudent.id,
      name: healthStudent.name,
      time: formattedTime,
      distance: healthDistance,
      classroom: healthStudent.classroom || "",
      status: healthCheckInStatus,
    };
    
    setCurrentMatch(matchedLog);
    setMatchStatus("found");
    
    setShowHealthModal(false);
    fetchRecentLogs();
    
    // Pause for 1.5 seconds to show verification details then resume detector
    setTimeout(() => {
      setCurrentMatch(null);
      setHealthStudent(null);
      setIsPaused(false);
    }, 1500);
  };

  // Countdown timer for automatic health submission
  useEffect(() => {
    if (!showHealthModal || !isCountdownActive) return;

    if (countdown <= 0) {
      handleHealthSubmit(healthTemperature, healthStatus);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showHealthModal, countdown, isCountdownActive, healthTemperature, healthStatus, healthStudent]);

  // 2. Callback when face matching finishes processing a frame
  const handleFaceMatch = async (
    matchedStudent: Student | null,
    distance: number,
    status?: 'present' | 'late' | 'absent' | 'leave' | 'checked_out'
  ) => {
    const formattedTime = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
    
    if (matchedStudent) {
      const checkInStatus = checkMode === "checkout" ? "checked_out" : (status || "present");
      const confidenceScore = Math.round((1 - distance) * 100);

      if (enableHealthScreening) {
        // Pause scanning and trigger health screening wizard
        setIsPaused(true);
        setHealthStudent(matchedStudent);
        setHealthDistance(distance);
        setHealthCheckInStatus(checkInStatus);
        setHealthTemperature(36.5);
        setHealthStatus("normal");
        setCountdown(5);
        setIsCountdownActive(true);
        setShowHealthModal(true);
      } else {
        // Immediate check-in without health screening
        await submitCheckIn(matchedStudent, checkInStatus, confidenceScore);
        
        const matchedLog: CheckInLog = {
          id: matchedStudent.id,
          name: matchedStudent.name,
          time: formattedTime,
          distance,
          classroom: matchedStudent.classroom || "",
          status: checkInStatus,
        };
        setCurrentMatch(matchedLog);
        setMatchStatus("found");
        
        fetchRecentLogs();
        startAutoClearTimer();
      }
    } else {
      // 2. Failed Match (Unknown face / High distance)
      setCurrentMatch({
        id: "Unknown",
        name: "ไม่พบข้อมูลที่ตรงกัน",
        time: "",
        distance,
      });
      setMatchStatus("failed");
      startAutoClearTimer();
    }
  };

  const handleManualScanTrigger = () => {
    setIsScanning(true);
    setMatchStatus("searching");
    setCurrentMatch(null);
    setIsPaused(false);
  };

  return (
    <>
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

      {/* Offline/Sync Banner */}
      {!isOnline && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 shadow-sm flex items-center gap-3 animate-pulse">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.5M5 12.5a10.94 10.94 0 0 1 5.83-2.84M8.5 16.5a4.92 4.92 0 0 1 2-1M16.5 16.5a4.9 4.9 0 0 1-1.34 1.77M12 20h.01"/></svg>
          </div>
          <div className="flex flex-col">
            <h4 className="text-xs font-bold text-red-900">📴 ระบบทำงานในโหมดออฟไลน์</h4>
            <p className="text-[10px] font-semibold text-red-700 mt-0.5">
              สัญญาณอินเทอร์เน็ตขาดหาย ตัวสแกนจะบันทึกสถิติลงในเครื่องชั่วคราว (เก็บในคิว {offlineQueueCount} รายการ) และจะส่งข้อมูลเข้าไลน์ทันทีเมื่อเน็ตกลับมาต่อติด
            </p>
          </div>
        </div>
      )}

      {isOnline && offlineQueueCount > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white animate-spin">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          </div>
          <div className="flex flex-col">
            <h4 className="text-xs font-bold text-amber-900">🔄 กำลังเชื่อมต่อระบบและซิงค์ข้อมูล...</h4>
            <p className="text-[10px] font-semibold text-amber-700 mt-0.5">
              กำลังนำประวัติการสแกนออฟไลน์จำนวน {offlineQueueCount} รายการ ส่งขึ้นฐานข้อมูลกลางและอัปเดตแจ้งเตือนทาง LINE ย้อนหลังให้โดยอัตโนมัติ
            </p>
          </div>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="grid gap-8 lg:grid-cols-12 mt-2">
        {/* Left Side: Webcam Frame & Settings */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Time Settings Panel */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ตั้งค่าเกณฑ์เวลาเช็คสาย
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  เวลาเข้าแถว (เริ่มนับสาย)
                </label>
                <input
                  type="time"
                  value={homeroomTime}
                  onChange={(e) => setHomeroomTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  เกณฑ์สายสุด (เริ่มนับขาด)
                </label>
                <input
                  type="time"
                  value={lateLimitTime}
                  onChange={(e) => setLateLimitTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
            {/* Health Screening Toggle */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-900">🩺 เปิดระบบคัดกรองสุขภาพ (Health Screening)</span>
                <p className="text-[10px] font-semibold text-slate-500">บันทึกอุณหภูมิ (ป้อนด้วยมือจากเครื่องวัดไข้จริง) และอาการป่วยเมื่อเด็กเช็คชื่อ</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableHealthScreening}
                  onChange={(e) => handleToggleHealthScreening(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Hardware Barcode Scanner Status Card */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 5H1M21 5h2M3 10H1M21 10h2M3 15H1M21 15h2M3 20H1M21 20h2M7 5v14M11 5v14M15 5v14M19 5v14"/></svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">🔌 เครื่องยิงบาร์โค้ดฮาร์ดแวร์ (USB/Bluetooth)</span>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">ระบบดักจับการยิงรหัสพื้นหลังทำงานอยู่ ยิงบาร์โค้ดหรือ QR Code เพื่อเช็คชื่อได้ทันที</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 self-start sm:self-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                พร้อมใช้งาน
              </span>
            </div>
            
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <input
                id="manual-barcode-input"
                type="text"
                placeholder="หรือป้อนรหัสนักเรียนด้วยตัวเองที่นี่ แล้วกด Enter..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/45 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors shadow-inner"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      handleBarcodeScan(val);
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white dark:bg-slate-900 p-4 shadow-sm">
            {/* Check-in / Check-out Mode Switcher */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">🕒 โหมดบันทึกเวลาเรียน:</span>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 rounded-xl p-1">
                <button
                  onClick={() => setCheckMode("checkin")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    checkMode === "checkin"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2050/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                  สแกนเข้าเรียน (Check-in)
                </button>
                <button
                  onClick={() => setCheckMode("checkout")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    checkMode === "checkout"
                      ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2050/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 9H4v6"/><path d="M14 20H4v-6"/><path d="M19 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                  สแกนกลับบ้าน (Check-out)
                </button>
              </div>
            </div>

            {/* Scanner Type Switcher */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">📸 เลือกรูปแบบเครื่องสแกน:</span>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 rounded-xl p-1">
                <button
                  onClick={() => {
                    setScannerType("face");
                    setIsScanning(true);
                    setCurrentMatch(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    scannerType === "face"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  สแกนใบหน้า (Face AI)
                </button>
                <button
                  onClick={() => {
                    setScannerType("qrcode");
                    setIsScanning(true);
                    setCurrentMatch(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    scannerType === "qrcode"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  สแกน QR / Barcode (บัตรนักเรียน)
                </button>
              </div>
            </div>

            {/* Mode Controls */}
            {scannerType === "face" && (
              <div className="flex items-center justify-between mb-4 animate-fade-in">
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
            )}

            {/* Webcam Live Frame Container */}
            <div className={`relative aspect-video w-full overflow-hidden rounded-xl border-2 bg-slate-950 flex items-center justify-center transition-colors ${
              checkMode === "checkout"
                ? "border-rose-500 shadow-lg shadow-rose-500/10"
                : "border-slate-200 dark:border-slate-800"
            }`}>
              {/* Scan Laser Line */}
              {isScanning && (
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${
                  checkMode === "checkout"
                    ? "from-transparent via-rose-500 to-transparent shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-scan"
                    : "from-transparent via-blue-500 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-scan"
                }`}></div>
              )}

              {/* Conditional Scanner Component */}
              {scannerType === "face" ? (
                <FaceDetector
                  scanMode={scanMode}
                  isScanning={isScanning}
                  setIsScanning={setIsScanning}
                  isPaused={isPaused}
                  onMatch={handleFaceMatch}
                  setMatchStatus={setMatchStatus}
                  homeroomTime={homeroomTime}
                  lateLimitTime={lateLimitTime}
                />
              ) : (
                <QrCodeScanner
                  onMatch={handleFaceMatch}
                  setMatchStatus={setMatchStatus}
                  homeroomTime={homeroomTime}
                  lateLimitTime={lateLimitTime}
                  isPaused={isPaused}
                />
              )}

              {/* Scanning visual frames guides */}
              {isScanning && !currentMatch && (
                <div className="absolute inset-0 border-[24px] border-black/35 pointer-events-none flex items-center justify-center z-10">
                  {scannerType === "face" ? (
                    <div className="w-56 h-56 rounded-full border-2 border-dashed border-blue-500/50 flex items-center justify-center relative">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500"></div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500"></div>
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500"></div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500"></div>
                    </div>
                  ) : (
                    <div className="w-56 h-56 rounded-2xl border-2 border-dashed border-blue-500/50 flex items-center justify-center relative">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500"></div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500"></div>
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500"></div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500"></div>
                    </div>
                  )}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold">{currentMatch.name}</h4>
                        {matchStatus === "found" && currentMatch.classroom && (
                          <span className="rounded bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                            {currentMatch.classroom}
                          </span>
                        )}
                        {matchStatus === "found" && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            currentMatch.status === "checked_out"
                              ? "bg-rose-500/20 border border-rose-500/30 text-rose-400"
                              : currentMatch.status === "late"
                              ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                              : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                          }`}>
                            {currentMatch.status === "checked_out" ? "กลับบ้าน" : currentMatch.status === "late" ? "สาย" : "มาเรียน"}
                          </span>
                        )}
                      </div>
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{record.name}</span>
                          {record.classroom && (
                            <span className="rounded bg-slate-200 px-1 py-0.2 text-[8px] font-bold text-slate-600">
                              {record.classroom}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-semibold">
                          <span>รหัส: {record.id}</span>
                          <span>•</span>
                          <span className={`font-bold ${
                            record.status === "checked_out"
                              ? "text-rose-600 dark:text-rose-450"
                              : record.status === "late"
                              ? "text-amber-600 dark:text-amber-450"
                              : "text-emerald-600 dark:text-emerald-450"
                          }`}>
                            {record.status === "checked_out" ? "กลับบ้าน" : record.status === "late" ? "สาย" : "มาเรียน"}
                          </span>
                        </div>
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

      {/* Glassmorphism Health Screening Modal */}
      {showHealthModal && healthStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-white/80 dark:bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-5 text-slate-800 dark:text-slate-100">
            {/* Header with Countdown progress bar */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">🩺 คัดกรองสุขภาพนักเรียน</span>
                {isCountdownActive ? (
                  <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <span>บันทึกอัตโนมัติใน {countdown} วินาที</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                    ⏸️ ครูหยุดตรวจเช็คอยู่
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {healthStudent.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                ชั้นเรียน: {healthStudent.classroom || "ไม่ระบุ"} | สถานะ: {healthCheckInStatus === "checked_out" ? "กลับบ้าน" : healthCheckInStatus === "late" ? "สาย" : "ปกติ"}
              </p>
            </div>

            {/* Countdown progress bar line */}
            {isCountdownActive && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 dark:bg-blue-400 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 5) * 100}%` }}
                ></div>
              </div>
            )}

            {/* Temperature Slider & Input */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">🌡️ บันทึกอุณหภูมิร่างกาย</span>
                  <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 leading-none mt-0.5">(ป้อนค่าจริงที่วัดได้จากเครื่องวัดไข้หน้าโรงเรียน)</span>
                </div>
                <span className={`text-base font-extrabold ${healthTemperature >= 37.5 ? "text-red-500" : "text-emerald-500"}`}>
                  {healthTemperature.toFixed(1)} °C
                </span>
              </div>
              <input
                type="range"
                min="35.0"
                max="40.0"
                step="0.1"
                value={healthTemperature}
                onChange={(e) => {
                  setHealthTemperature(parseFloat(e.target.value));
                  setIsCountdownActive(false); // Pause auto-submit on manual edit
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400"
              />
              
              {/* Quick Presets */}
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[36.5, 37.2, 37.8, 38.5].map((temp) => (
                  <button
                    key={temp}
                    onClick={() => {
                      setHealthTemperature(temp);
                      setIsCountdownActive(false); // Pause auto-submit on manual edit
                      if (temp >= 37.5) {
                        setHealthStatus("fever");
                      } else {
                        setHealthStatus("normal");
                      }
                    }}
                    className={`py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      Math.abs(healthTemperature - temp) < 0.05
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {temp} °C
                  </button>
                ))}
              </div>
            </div>

            {/* Symptoms evaluation buttons */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">🟢 ผลประเมินคัดกรองเบื้องต้น</span>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setHealthStatus("normal");
                    setIsCountdownActive(false);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                    healthStatus === "normal"
                      ? "bg-emerald-50/50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="text-lg">🟢</span>
                  <span className="text-[10px] font-bold mt-1">ปกติ</span>
                </button>
                <button
                  onClick={() => {
                    setHealthStatus("cough");
                    setIsCountdownActive(false);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                    healthStatus === "cough"
                      ? "bg-amber-50/50 border-amber-500 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="text-lg">🟡</span>
                  <span className="text-[10px] font-bold mt-1">มีอาการไอ</span>
                </button>
                <button
                  onClick={() => {
                    setHealthStatus("fever");
                    setIsCountdownActive(false);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                    healthStatus === "fever"
                      ? "bg-red-50/50 border-red-500 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="text-lg">🔴</span>
                  <span className="text-[10px] font-bold mt-1">มีไข้ตัวร้อน</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => {
                  setShowHealthModal(false);
                  setHealthStudent(null);
                  setIsPaused(false);
                }}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              {isCountdownActive && (
                <button
                  onClick={() => setIsCountdownActive(false)}
                  className="py-2 px-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  หยุดเวลา
                </button>
              )}
              <button
                onClick={() => handleHealthSubmit(healthTemperature, healthStatus)}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-md shadow-blue-500/20"
              >
                บันทึกคัดกรอง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
