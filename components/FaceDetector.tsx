"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { Student } from "@/lib/types";

interface FaceDetectorProps {
  scanMode: "auto" | "manual";
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
  onMatch: (student: Student | null, distance: number, status?: 'present' | 'late' | 'absent' | 'leave') => void;
  setMatchStatus: (status: "searching" | "found" | "failed") => void;
  homeroomTime?: string;
  lateLimitTime?: string;
}

export default function FaceDetector({
  scanMode,
  isScanning,
  setIsScanning,
  onMatch,
  setMatchStatus,
  homeroomTime = "08:00",
  lateLimitTime = "08:30",
}: FaceDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [errorText, setErrorText] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const isProcessingFrame = useRef(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  // 1. Load models and fetch students list
  useEffect(() => {
    async function init() {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);

        // Fetch students list
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
        } catch (studentErr) {
          const cached = localStorage.getItem("cachedStudents");
          if (cached) {
            setStudents(JSON.parse(cached));
            console.log("Loaded student registry from offline localStorage cache");
          } else {
            throw studentErr;
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setErrorText("ไม่สามารถโหลดโมเดลหรือรายชื่อนักเรียนได้");
      }
    }
    init();

    return () => {
      stopCamera();
    };
  }, []);

  // 2. Manage Camera State
  useEffect(() => {
    if (modelsLoaded && isScanning) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [modelsLoaded, isScanning, facingMode]);

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: facingMode
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
      }
    } catch (err) {
      console.error("Camera start error:", err);
      setErrorText("ไม่สามารถเข้าถึงกล้องเว็บแคมได้");
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (loopRef.current) {
      window.clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
    isProcessingFrame.current = false;
  };

  // 3. Scan & Match Frame Core Logic
  const processFrame = async () => {
    const video = videoRef.current;
    if (!video || !streamActive || isProcessingFrame.current) return;
    
    // Ensure video elements and metadata are fully loaded before passing to face-api
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return;
    }
    
    isProcessingFrame.current = true;

    try {
      // Detect face and extract descriptor
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        // No face found in this frame
        isProcessingFrame.current = false;
        return;
      }

      const currentDescriptor = detection.descriptor;

      // Handle matching if we have students registered
      if (students.length === 0) {
        // No students in database
        onMatch(null, 1.0);
        setMatchStatus("failed");
        isProcessingFrame.current = false;
        return;
      }

      // Calculate Euclidean distances
      let bestMatch: Student | null = null;
      let minDistance = 99.0;

      students.forEach((student) => {
        // Parse descriptor back to Float32Array
        const savedDescriptor = new Float32Array(student.faceDescriptor);
        const distance = faceapi.euclideanDistance(currentDescriptor, savedDescriptor);
        
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = student;
        }
      });

      // Threshold check: 0.75 for generous demo mode
      if (minDistance < 0.75 && bestMatch) {
        const matchedStudent = bestMatch as Student;
        setMatchStatus("found");

        // Calculate status: "present" or "late" based on current local time
        let checkInStatus: "present" | "late" = "present";
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        
        // Parse homeroomTime (e.g., "08:00")
        const [hrHour, hrMin] = (homeroomTime || "08:00").split(":").map(Number);
        
        if (currentHours > hrHour || (currentHours === hrHour && currentMinutes > hrMin)) {
          checkInStatus = "late";
        }
        
        // Post attendance record to API or queue locally if offline
        const confidenceScore = Math.round((1 - minDistance) * 100);
        const scanPayload = {
          studentId: matchedStudent.id,
          confidence: confidenceScore,
          status: checkInStatus,
          classroom: matchedStudent.classroom || "",
          timestamp: new Date().toISOString()
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
          console.warn("สแกนใบหน้าล้มเหลว (บันทึกออฟไลน์):", err);
          // Save in localStorage queue
          const existing = localStorage.getItem("offlineScans");
          const scans = existing ? JSON.parse(existing) : [];
          scans.push(scanPayload);
          localStorage.setItem("offlineScans", JSON.stringify(scans));
          
          // Notify parent window
          window.dispatchEvent(new Event("offline-scan-queued"));
        }

        onMatch(matchedStudent, parseFloat(minDistance.toFixed(2)), checkInStatus);
      } else {
        // Fail or no match: Return best effort or unknown state with distance for debugging
        setMatchStatus("failed");
        onMatch(null, parseFloat(minDistance.toFixed(2)));
      }
    } catch (e) {
      console.error("Frame processing error:", e);
    } finally {
      isProcessingFrame.current = false;
    }
  };

  // 4. Detection intervals (Auto mode loop vs Canvas tracker drawing)
  useEffect(() => {
    if (!streamActive || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Draw tracking outline box
    const drawTrackerLoop = window.setInterval(async () => {
      if (video.paused || video.ended || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
      faceapi.matchDimensions(canvas, displaySize);

      const detections = await faceapi.detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      );

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        resizedDetections.forEach((det) => {
          const box = det.box;
          // Draw standard corner points
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          const length = 20;

          // Top Left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + length);
          ctx.lineTo(box.x, box.y);
          ctx.lineTo(box.x + length, box.y);
          ctx.stroke();

          // Top Right
          ctx.beginPath();
          ctx.moveTo(box.x + box.width - length, box.y);
          ctx.lineTo(box.x + box.width, box.y);
          ctx.lineTo(box.x + box.width, box.y + length);
          ctx.stroke();

          // Bottom Left
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + box.height - length);
          ctx.lineTo(box.x, box.y + box.height);
          ctx.lineTo(box.x + length, box.y + box.height);
          ctx.stroke();

          // Bottom Right
          ctx.beginPath();
          ctx.moveTo(box.x + box.width - length, box.y + box.height);
          ctx.lineTo(box.x + box.width, box.y + box.height);
          ctx.lineTo(box.x + box.width, box.y + box.height - length);
          ctx.stroke();
        });
      }
    }, 150);

    // Active AI Recognition Loop (in auto-mode scan every 1.5 seconds)
    if (scanMode === "auto") {
      loopRef.current = window.setInterval(async () => {
        await processFrame();
      }, 1500);
    }

    return () => {
      window.clearInterval(drawTrackerLoop);
      if (loopRef.current) {
        window.clearInterval(loopRef.current);
        loopRef.current = null;
      }
    };
  }, [streamActive, scanMode, students]);

  // Exposed manual scan trigger handler
  useEffect(() => {
    if (scanMode === "manual" && isScanning) {
      // Force single process trigger
      processFrame().then(() => {
        setIsScanning(false); // Stop scanning state when done
      });
    }
  }, [isScanning, scanMode]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Loading Overlay */}
      {!modelsLoaded && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400 z-30">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-200">กำลังเชื่อมต่อปัญญาประดิษฐ์ Face AI...</p>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">โหลดโมเดลใบหน้าแบบออฟไลน์ 100%</p>
          </div>
        </div>
      )}

      {errorText && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-red-400 z-30">
          <p className="text-xs font-bold text-red-200">{errorText}</p>
        </div>
      )}

      {/* Switch Camera Button for Mobile/Smartphones */}
      {modelsLoaded && streamActive && (
        <button
          onClick={toggleFacingMode}
          className="absolute top-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors shadow-lg cursor-pointer"
          title="สลับกล้อง หน้า/หลัง"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8M2 10l3-3 3 3M4 14c0 4.4 3.6 8 8 8s8-3.6 8-8M22 14l-3 3-3-3"/></svg>
        </button>
      )}

      {/* Video feeds */}
      {modelsLoaded && (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            width="640"
            height="480"
            className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-10 ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />
        </>
      )}
    </div>
  );
}
