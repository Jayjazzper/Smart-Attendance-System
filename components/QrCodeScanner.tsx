"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Student } from "@/lib/types";

interface QrCodeScannerProps {
  onMatch: (student: Student | null, distance: number, status?: 'present' | 'late' | 'absent' | 'leave') => void;
  setMatchStatus: (status: "searching" | "found" | "failed") => void;
  homeroomTime: string;
  lateLimitTime: string;
  isPaused?: boolean;
}

export default function QrCodeScanner({
  onMatch,
  setMatchStatus,
  homeroomTime,
  lateLimitTime,
  isPaused = false,
}: QrCodeScannerProps) {
  const qrRegionId = "qr-reader-element";
  const isPausedRef = useRef(isPaused);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  const [errorText, setErrorText] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const [isScanning, setIsScanning] = useState(false);

  // 1. Fetch student registry to identify decoded IDs
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

  // 2. Initialize and start the QR Scanner
  useEffect(() => {
    if (students.length === 0) return;

    let active = true;

    async function startScanner() {
      try {
        setErrorText("");
        
        // Clean up any existing instances on this element before recreating
        if (qrCodeRef.current) {
          try {
            await qrCodeRef.current.stop();
          } catch (e) {}
        }

        const qrCode = new Html5Qrcode(qrRegionId);
        qrCodeRef.current = qrCode;

        await qrCode.start(
          { facingMode: "user" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.65;
              return { width: size, height: size };
            },
          },
          async (decodedText) => {
            if (!active || isPausedRef.current) return;
            
            const nowTime = Date.now();
            if (nowTime - lastScanTimeRef.current < 3000) {
              return; // 3-second cooling period
            }
            lastScanTimeRef.current = nowTime;
            
            // DecodedText represents the Student ID
            const matchedStudent = students.find(
              (s) => String(s.id).trim() === String(decodedText).trim()
            );

            if (matchedStudent) {
              setMatchStatus("found");

              // Calculate "present" or "late" status based on time limits
              let checkInStatus: "present" | "late" = "present";
              const now = new Date();
              const currentHours = now.getHours();
              const currentMinutes = now.getMinutes();

              const [hrHour, hrMin] = (homeroomTime || "08:00").split(":").map(Number);
              if (currentHours > hrHour || (currentHours === hrHour && currentMinutes > hrMin)) {
                checkInStatus = "late";
              }

              onMatch(matchedStudent, 0.0, checkInStatus);
            } else {
              setMatchStatus("failed");
              onMatch(null, 1.0); // No match
            }
          },
          () => {
            // Scanner loop - silence verbose frame analysis warning messages
          }
        );
        setIsScanning(true);
      } catch (err) {
        console.error("QR Code start error:", err);
        setErrorText("ไม่สามารถเริ่มต้นกล้องสำหรับสแกน QR Code ได้ กรุณาตรวจสอบสิทธิ์เว็บแคม");
      }
    }

    startScanner();

    return () => {
      active = false;
      if (qrCodeRef.current) {
        qrCodeRef.current.stop().catch(err => {
          console.warn("Failed to stop QR Code scanner in cleanup:", err);
        });
      }
    };
  }, [students, homeroomTime, lateLimitTime]);

  return (
    <div className="relative w-full h-full min-h-[300px] bg-slate-950 flex flex-col items-center justify-center">
      <div id={qrRegionId} className="w-full h-full object-cover [&>video]:object-cover [&>video]:h-full [&>video]:w-full"></div>
      
      {errorText && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center text-red-400 gap-3 z-30">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-xs font-bold text-red-200">{errorText}</p>
        </div>
      )}
      
      {!isScanning && !errorText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 z-30 bg-slate-950">
          <svg className="h-10 w-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-xs font-bold text-slate-200">กำลังเตรียมกล้องสแกน QR Code...</p>
        </div>
      )}
    </div>
  );
}
