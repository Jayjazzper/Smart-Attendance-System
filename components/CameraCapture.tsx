"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";

interface CameraCaptureProps {
  onCapture: (descriptor: number[]) => void;
  status: "idle" | "capturing" | "scanning" | "success" | "error";
  setStatus: (status: "idle" | "capturing" | "scanning" | "success" | "error") => void;
  setErrorMessage: (msg: string) => void;
}

export default function CameraCapture({
  onCapture,
  status,
  setStatus,
  setErrorMessage,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [modelsLoadingError, setModelsLoadingError] = useState(false);
  const detectIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  // 1. Load face-api models on component mount
  useEffect(() => {
    async function loadModels() {
      try {
        const MODEL_URL = "/models";
        // Load the 3 essential models for face verification
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Error loading face-api models:", err);
        setModelsLoadingError(true);
        setErrorMessage("เกิดข้อผิดพลาดในการโหลดโมเดล AI กรุณาตรวจสอบว่ามีไฟล์โมเดลใน public/models/");
      }
    }
    loadModels();

    return () => {
      stopCamera();
    };
  }, []);

  // 2. Start webcam when models are loaded
  useEffect(() => {
    if (modelsLoaded && status === "idle") {
      startCamera();
    }
  }, [modelsLoaded, status, facingMode]);

  const startCamera = async () => {
    try {
      stopCamera(); // Clean up existing
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
      console.error("Camera access error:", err);
      setErrorMessage("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์เข้าใช้งานเว็บแคมในเว็บเบราว์เซอร์");
      setStatus("error");
    }
  };

  const stopCamera = () => {
    // Stop continuous detection loop
    if (detectIntervalRef.current) {
      window.clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    // Stop camera stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  // 3. Continuous Face Bounding Box Overlay Draw Loop
  useEffect(() => {
    if (!streamActive || !videoRef.current || !canvasRef.current || status === "success") return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const handlePlay = () => {
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
      faceapi.matchDimensions(canvas, displaySize);

      detectIntervalRef.current = window.setInterval(async () => {
        if (video.paused || video.ended || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

        // Perform face detection to draw bounding box
        const detections = await faceapi.detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        );

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Clear canvas and draw outline
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          resizedDetections.forEach((detection) => {
            const box = detection.box;
            // Draw custom premium border instead of standard faceapi boxes
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            
            // Draw corner guides
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
      }, 150); // running at ~6.6 FPS for drawing to optimize resource usage
    };

    video.addEventListener("play", handlePlay);
    return () => {
      video.removeEventListener("play", handlePlay);
      if (detectIntervalRef.current) {
        window.clearInterval(detectIntervalRef.current);
        detectIntervalRef.current = null;
      }
    };
  }, [streamActive, status]);

  // 4. Capture face and extract 128-dimensional descriptor vector
  const captureFace = async () => {
    const video = videoRef.current;
    if (!video || !streamActive) return;

    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setErrorMessage("กล้องยังไม่พร้อมใช้งาน กรุณารอสักครู่แล้วลองอีกครั้ง");
      return;
    }

    setStatus("capturing");
    
    // Slight timeout to simulate shutter flash
    setTimeout(async () => {
      try {
        setStatus("scanning");
        
        // Detect single face with landmarks and extract descriptor vector
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setStatus("error");
          setErrorMessage("ไม่สามารถจับภาพใบหน้าได้ชัดเจน กรุณาปรับตำแหน่งให้นิ่งและอยู่ในกรอบสแกน");
          return;
        }

        // Successfully extracted! Convert Float32Array to standard number array
        const descriptorArray = Array.from(detection.descriptor);
        
        // Stop camera stream since capture is complete
        stopCamera();
        onCapture(descriptorArray);
      } catch (err) {
        console.error("Extraction error:", err);
        setStatus("error");
        setErrorMessage("เกิดข้อผิดพลาดภายในระบบสกัดโครงสร้างใบหน้า");
      }
    }, 800);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 flex flex-col items-center justify-center shadow-inner">
      {/* 1. Loading models stage */}
      {!modelsLoaded && !modelsLoadingError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 z-30 bg-slate-950">
          <svg className="h-10 w-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-200">กำลังโหลดโมเดลปัญญาประดิษฐ์ (Face AI)</p>
            <p className="text-[10px] text-slate-500 mt-1">โมเดลจะรันแบบออฟไลน์บนเครื่องคุณทั้งหมด</p>
          </div>
        </div>
      )}

      {/* 2. Models Loading Error */}
      {modelsLoadingError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-400 z-30 bg-slate-950">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-xs font-bold text-red-200">ไม่สามารถเริ่มต้นปัญญาประดิษฐ์ใบหน้าได้</p>
        </div>
      )}

      {/* Switch Camera Button for Mobile/Smartphones */}
      {modelsLoaded && streamActive && status !== "success" && (
        <button
          onClick={toggleFacingMode}
          className="absolute top-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors shadow-lg cursor-pointer"
          title="สลับกล้อง หน้า/หลัง"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8M2 10l3-3 3 3M4 14c0 4.4 3.6 8 8 8s8-3.6 8-8M22 14l-3 3-3-3"/></svg>
        </button>
      )}

      {/* 3. Live Video feed */}
      {modelsLoaded && status !== "success" && (
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
          {/* Canvas for face tracking outlines */}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-10 ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />

          {/* Shutter guide overlays */}
          <div className="absolute inset-0 border-[24px] border-black/35 pointer-events-none flex items-center justify-center z-0">
            <div className="w-56 h-56 rounded-full border border-dashed border-blue-500/50 flex items-center justify-center relative">
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500"></div>
            </div>
          </div>
        </>
      )}

      {/* 4. Scanning or capturing indicator */}
      {status === "capturing" && (
        <div className="absolute inset-0 bg-white/20 animate-pulse flex items-center justify-center z-20">
          <span className="text-sm font-bold text-white uppercase tracking-wider drop-shadow-md">Capturing...</span>
        </div>
      )}

      {status === "scanning" && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3 z-20 animate-fade-in">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-center text-white flex flex-col">
            <span className="text-xs font-bold">สกัดใบหน้าอัจฉริยะ (AI Processing)</span>
            <span className="text-[10px] text-slate-400 mt-1 font-semibold">สร้างเวกเตอร์ข้อมูล 128 มิติ...</span>
          </div>
        </div>
      )}

      {/* 5. Shutter Trigger Button (Overlay on bottom) */}
      {modelsLoaded && streamActive && status === "idle" && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
          <button
            onClick={captureFace}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            แชะ! สแกนและลงทะเบียนใบหน้า
          </button>
        </div>
      )}
    </div>
  );
}
