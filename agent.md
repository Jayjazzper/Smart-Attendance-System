# AGENT.md — Instructions for AI Coding Agent (Lite Version)

> **เอกสารนี้คืออะไร:** คำแนะนำสำหรับ AI coding agent เพื่อสร้างโปรเจกต์ **Smart Attendance System**
>
> **เวอร์ชัน Lite:** ลดสเปคให้เหลือเฉพาะ Core Feature เพื่อการเขียนโค้ดที่รวดเร็วและใช้ในการ Demo โดยเฉพาะ

---

## 1. Project Overview
โปรเจกต์นี้คือ **demo สำหรับการบรรยาย vibe coding** ไม่ใช่ระบบที่จะ deploy ไปใช้จริง
**ลำดับความสำคัญ:**
1. **ความชัดเจนของโค้ด** > ประสิทธิภาพ
2. **การทำงานได้จริงในเวทีบรรยาย** > feature completeness
3. **ความรวดเร็วในการพัฒนา** (ตัดส่วน Authentication, QR Code, และ CRUD ที่ซับซ้อนทิ้ง)

---

## 2. Tech Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- face-api.js (Face Recognition)
- recharts (Charts)
- Storage: Local JSON files via `fs/promises` (`data/students.json`, `data/attendance.json`)

---

## 3. Project Structure
```text
attendance-demo/
├── app/                          
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout
│   ├── register/page.tsx         # ลงทะเบียนนักศึกษา (signup & face capture)
│   ├── check-in/page.tsx         # สแกนหน้าเช็คชื่อ
│   ├── dashboard/page.tsx        # Dashboard (Stats & Reset)
│   ├── api/
│   │   ├── students/route.ts     # GET/POST สำหรับนักศึกษา
│   │   ├── attendance/route.ts   # POST เช็คชื่อ
│   │   ├── dashboard/route.ts    # GET ดึงสถิติ
│   │   └── reset/route.ts        # POST ล้างข้อมูลทั้งหมด
├── components/
│   ├── ui/                       # Button, Card, Input
│   ├── CameraCapture.tsx         # ถ่ายภาพตอนลงทะเบียน
│   ├── FaceDetector.tsx          # Real-time face matching ตอนเช็คชื่อ
│   └── dashboard/TrendChart.tsx  # กราฟ Recharts
├── lib/
│   ├── db.ts                     # JSON file helpers
│   ├── face.ts                   # face-api.js wrapper
│   └── types.ts                  # TypeScript types
├── data/                         # JSON storage
│   ├── students.json
│   └── attendance.json
└── public/models/                # face-api.js model weights
```

---

## 4. Backend & Storage Rules
- ทุกการ read/write JSON ต้องผ่าน `lib/db.ts`
- **การจัดการ Cache:** ใน Next.js App Router (v14+) API Routes แบบ `GET` จะถูก Cache โดยปริยาย ต้องระบุ `export const dynamic = 'force-dynamic';` ในไฟล์ Route ทุกครั้งที่ต้องการอ่านข้อมูลใหม่จาก JSON เสมอ
- ไฟล์ JSON ให้ใช้โครงสร้างแบบง่ายๆ ตัวอย่างเช่น
```json
// data/students.json
{
  "students": [
    {
      "id": "650001",
      "name": "ทดสอบ นามสมมติ",
      "email": "test@test.com",
      "faceDescriptor": [0.1, -0.2],
      "consentGiven": true,
      "registeredAt": "2026-05-17T10:00:00.000Z"
    }
  ]
}
```

---

## 5. Security & PDPA Guardrails
- **ห้ามเก็บภาพใบหน้าดิบลง disk** เด็ดขาด (ละเมิดหลัก data minimization)
- โปรเจกต์ต้องรันแบบออฟไลน์ได้ (ไม่พึ่งพา External API / Database ภายนอก)
- ต้องมีช่องติ๊ก "ยอมรับข้อตกลง (Consent)" ก่อนให้ถ่ายภาพ

---

## 6. AI & Face Recognition Tuning
- **Threshold:** เพื่อการใช้งาน Demo ที่ราบรื่น ให้ตั้งค่า Threshold รับรองความต่าง (Distance) ให้อภัยได้สูงถึง `0.75`
- **Debugging:** หากใบหน้าไม่ตรงกัน ควรปริ้นหรือแสดงผลตัวเลข Distance ให้ผู้ใช้เห็นบน UI เพื่อให้ง่ายต่อการอธิบายและวิเคราะห์ปัญหาบนเวที

---

## 2. Core Philosophy & Limitations
- **Speed over Scale:** เน้นความเร็วในการ Demo บนเวที
- **No Complex Auth:** ไม่มีระบบ Login ใดๆ ผู้สอนสามารถเข้าหน้า Dashboard และจัดการข้อมูลได้ทันที
- **Vibe Coding Focus:** โค้ดที่สร้างต้องสะอาด เรียบง่าย และทำงานได้จริงทันที
- **Design:** ให้ยึดดีไซน์ GUI คล้ายคลึงกับ **Tailwind CSS "Syntax" Template แต่เป็นโหมด Light Mode** (พื้นหลังสีสว่าง/ขาว, ขอบสีเทาอ่อน, และไฮไลท์สีฟ้า-น้ำเงิน) ใช้ไลบรารี **Lucide React** สำหรับไอคอนต่างๆ และควบคุมขนาดตัวอักษรให้พอดี ไม่ใหญ่จนเกินไป (เช่น หลีกเลี่ยง 7xl บนหน้าหลัก)
