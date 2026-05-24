# Implementation Plan — Smart Attendance System

> **เอกสารนี้คืออะไร:** แผนการพัฒนาแบบแบ่ง Phase เพื่อใช้เป็น Roadmap ในการสร้างโปรเจกต์นี้ตั้งแต่เริ่มต้นจนจบ ครอบคลุมฟีเจอร์ทั้งหมดที่เราได้พัฒนามาจนถึงปัจจุบัน (รวมถึง Student Management และ AI Tuning)

---

## 📋 Overview

| Phase | ชื่อ | สถานะการพัฒนา |
|-------|------|--------|
| 0 | Setup & Foundation | ⬜ |
| 1 | UI/UX Design & GUI Prototyping | ⬜ |
| 2 | Student Registration & Face Enrollment | ⬜ |
| 3 | Face Check-in & AI Tuning | ⬜ |
| 4 | Instructor Dashboard & Live Feed | ⬜ |
| 5 | Student Management (CRUD) | ⬜ |
| 6 | Demo Prep & System Reset | ⬜ |

---

## Phase 0: Setup & Foundation
**เป้าหมาย:** สร้างโครงสร้างโปรเจกต์ Next.js, ติดตั้งไลบรารี, สร้างฐานข้อมูล JSON
-[ ] สั่ง `npx create-next-app@latest`
-[ ] ติดตั้ง Dependencies: `face-api.js`, `recharts`, `lucide-react`, `date-fns`, `nanoid`
-[ ] สร้างโฟลเดอร์สำหรับโมเดล AI `public/models/` และเก็บไฟล์ Weights ของ `face-api.js`
-[ ] สร้างโฟลเดอร์ `data/` และไฟล์เปล่า `students.json`, `attendance.json`
-[ ] เขียน `lib/db.ts` สำหรับการอ่าน/เขียน JSON File (มี Lock ป้องกันการเขียนทับ)
-[ ] สร้าง Layout หลัก (`app/layout.tsx`) พร้อมแถบ Navbar กว้าง `max-w-5xl` และใส่ไอคอนจาก `lucide-react`

## Phase 1: UI/UX Design & GUI Prototyping
**เป้าหมาย:** ออกแบบหน้าตาแอปพลิเคชัน (GUI) และพัฒนา UI ส่วนหน้าด้วย Dummy Data ให้เห็นภาพรวมทั้งหมดก่อนเริ่มเขียนลอจิกและระบบหลังบ้าน
-[ ] ออกแบบภาพจำลอง (Mockup) สำหรับหน้า Dashboard และหน้า Face Check-in
-[ ] สร้างหน้าตา GUI ฝั่ง Frontend ให้สวยงามตามดีไซน์ (ใช้ Tailwind Syntax Template: Light Mode)
-[ ] เตรียม Layout และโครงสร้าง UI ให้พร้อมสำหรับการเชื่อมต่อข้อมูลจริง

## Phase 2: Student Registration & Face Enrollment
**เป้าหมาย:** ระบบลงทะเบียนนักศึกษาใหม่ พร้อมถ่ายภาพสกัด Face Descriptor Vector
-[ ] สร้างหน้า `/register`
-[ ] สร้างฟอร์มกรอก รหัสนักศึกษา, ชื่อ-นามสกุล, อีเมล และ Checkbox รับรอง PDPA Consent
-[ ] สร้าง Component `CameraCapture.tsx` เพื่อดึงภาพจากกล้องหน้า
-[ ] โหลดโมเดล `tinyFaceDetector`, `faceLandmark68Net`, `faceRecognitionNet`
-[ ] สกัดใบหน้าและแปลงเป็น Array ตัวเลข 128 มิติ (Face Descriptor)
-[ ] สร้าง API `POST /api/students` เพื่อบันทึกข้อมูลและเช็คการซ้ำซ้อนของรหัสนักศึกษา

## Phase 3: Face Check-in & AI Tuning
**เป้าหมาย:** ระบบสแกนหน้าแบบ Real-time ที่ถูกปรับแต่งมาให้ง่ายต่อการใช้งานบนเวที (Demo-friendly)
-[ ] สร้างหน้า `/check-in`
-[ ] สร้าง Component `FaceDetector.tsx` ที่ทำงาน 2 ระบบ:
  - สแกนอัตโนมัติ (Continuous Scan) ทุก 2 วินาที
  - ปุ่มสแกนด้วยตนเอง (Manual Scan) เพื่อความสะดวกในการสั่งการ
-[ ] ตั้งค่า AI Threshold (ความเข้มงวด) ให้ผ่อนปรนสูง (`0.75`) ในฟังก์ชัน `findBestMatch`
-[ ] หากใบหน้าไม่ตรงกับฐานข้อมูล ให้ปริ้นค่าตัวเลข **"ระยะความต่าง (Distance)"** ลงบนหน้าจอเพื่อการ Debugging
-[ ] สร้าง API `POST /api/attendance` สำหรับบันทึกเวลาเข้าเรียน (ปลดล็อกให้เช็คชื่อซ้ำได้ตลอดเวลา เพื่อโชว์บนเวที)

## Phase 4: Instructor Dashboard & Live Feed
**เป้าหมาย:** หน้าแดชบอร์ดสรุปผลการเข้าเรียนที่อัปเดตแบบ Real-time ทุก 5 วินาที
-[ ] สร้าง API `GET /api/dashboard` (ระบุ `export const dynamic = 'force-dynamic'` เพื่อป้องกัน Cache ปัญหาข้อมูลไม่วิ่ง)
-[ ] คำนวณสรุปผล: จำนวนนักศึกษาทั้งหมด และผู้มาเรียนในวันนี้
-[ ] เตรียมข้อมูล Trend Data ย้อนหลัง 7 วันเพื่อใช้วาดกราฟ
-[ ] เตรียมข้อมูล "ผู้มาเช็คชื่อ 10 คนล่าสุด" (เรียงลำดับจากเวลาล่าสุด)
-[ ] สร้างหน้า `/dashboard`
-[ ] นำ `recharts` มาวาดกราฟเส้น
-[ ] สร้างตาราง Live Feed ด้านล่างเพื่อแสดง 10 รายชื่อล่าสุด พร้อมเวลาและเปอร์เซ็นต์ความแม่นยำ AI

## Phase 5: Student Management (CRUD)
**เป้าหมาย:** ระบบหลังบ้านสำหรับเรียกดู แก้ไข และลบรายชื่อนักศึกษา
-[ ] เพิ่มฟังก์ชัน `updateStudent` และ `deleteStudent` ลงใน `lib/db.ts` (ลบนักศึกษาต้องลบ attendance ด้วยอัตโนมัติ)
-[ ] สร้าง API `PUT /api/students/[id]` และ `DELETE /api/students/[id]`
-[ ] สร้างหน้า `/students` แสดงตารางรายชื่อทั้งหมดพร้อมปุ่ม "แก้ไข" และ "ลบ"
-[ ] สร้างหน้า `/students/[id]` เป็นฟอร์มสำหรับแก้ไขชื่อ-นามสกุล และอีเมล
-[ ] อัปเดต Navbar ให้มีปุ่ม "Students (Manage)" 

## Phase 6: Demo Prep & System Reset
**เป้าหมาย:** เตรียมระบบและสคริปต์ให้พร้อมสำหรับการบรรยายเรื่อง Right to be Forgotten
-[ ] สร้าง API `POST /api/reset` เพื่อดัมพ์ข้อมูลใน JSON ทิ้งทั้งหมด
-[ ] สร้างปุ่ม "ล้างข้อมูล (Reset Demo)" สีแดงไว้มุมขวาบนของหน้า Dashboard
-[ ] ตรวจสอบว่า `DEMO_SCRIPT.md` ตรงกับ Workflow ใหม่ล่าสุด
