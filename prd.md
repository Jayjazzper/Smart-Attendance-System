# PRD: Smart Attendance System

> **เอกสารนี้คืออะไร:** Product Requirements Document สำหรับระบบเช็คชื่อนักศึกษาที่ใช้ใบหน้า สร้างขึ้นเพื่อเป็นตัวอย่างประกอบการบรรยายเรื่อง "การสร้างเว็บแอปพลิเคชันสำหรับการเรียนการสอนออนไลน์ด้วยเทคนิค Vibe Coding"
>
> **เวอร์ชัน Lite:** ตัดระบบ Auth, QR Code, และระบบจัดการ CRUD ออก เน้นการนำเสนอ## 2. Scope & Features
ระบบจะถูกออกแบบมาให้เน้นความเร็วในการสาธิต มีฟีเจอร์หลักดังนี้:
1. **Face Registration:** หน้าจอสำหรับลงทะเบียนผู้ใช้ใหม่ โดยกรอกแค่รหัสและชื่อ จากนั้นถ่ายรูปเพื่อบันทึกโครงหน้า (Face Descriptor) 
2. **Face Check-in:** หน้าจอเปิดกล้องเพื่อจับคู่ใบหน้ากับฐานข้อมูลแบบ Real-time (อนุญาตให้เช็คชื่อซ้ำได้ตลอดเวลาสำหรับการสาธิต)
3. **Instructor Dashboard:** แดชบอร์ดสรุปผลแบบเรียลไทม์ พร้อมรายการผู้มาเช็คชื่อล่าสุด 10 คน และปุ่มล้างข้อมูล (Reset)
4. **Student Management:** หน้าสำหรับจัดการรายชื่อนักศึกษา สามารถตรวจสอบ ลบ และแก้ไขข้อมูลชื่อ/อีเมลได้ด้วยตัวเอง

### 1.2 Purpose
- เป็น **demo บนเวที** สำหรับการบรรยายเรื่อง vibe coding ในวงการการศึกษา
- เปิดประเด็นการพูดคุยเรื่อง **AI ในห้องเรียน** และ **PDPA ของข้อมูล biometric**

### 1.3 Out of Scope
- ❌ ไม่ใช่ระบบ production สำหรับใช้งานจริงในมหาวิทยาลัย
- ❌ ไม่มีระบบ Login / Authentication (ตัดความซับซ้อนเพื่อการ demo)
- ❌ ไม่มี QR Code Check-in

---

## 2. Target Users & Roles

- **ผู้ใช้งานทั่วไป:** สามารถใช้งานหน้าจอแบบสาธารณะได้ทั้งหมด (ระบบเปิดกว้างสำหรับการสาธิต)
- การใช้งานหลักบนเวที: ผู้บรรยายจะสาธิตการลงทะเบียนนักศึกษาใหม่, สาธิตการสแกนใบหน้า, และเปิดแดชบอร์ดสรุปผล

---

## 3. Functional Requirements

### 3.1 Module: Student Registration
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-R01 | นักศึกษากรอกข้อมูล: รหัสนักศึกษา, ชื่อ-นามสกุล, อีเมล | Must |
| FR-R02 | ระบบขอความยินยอม (consent) สำหรับเก็บข้อมูล biometric ก่อนถ่ายภาพ | Must |
| FR-R03 | ถ่ายภาพเพื่อสกัด **face descriptor** (vector 128 มิติ) ไม่เก็บภาพดิบ | Must |
| FR-R04 | บันทึก descriptor + ข้อมูลนักศึกษาลง `data/students.json` | Must |

### 3.2 Module: Face Check-in
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-F01 | เปิดกล้องและ detect ใบหน้าแบบ real-time อย่างต่อเนื่อง และมีปุ่มสแกนด้วยตนเอง (Manual Scan) | Must |
| FR-F02 | เปรียบเทียบ face descriptor กับฐานข้อมูล (Tolerance ผ่อนปรนระยะห่างที่ < 0.75 สำหรับ Demo) | Must |
| FR-F03 | แสดงข้อความสำเร็จพร้อมชื่อ หรือแสดงตัวเลขระยะความต่างเมื่อสแกนไม่ผ่าน | Must |
| FR-F04 | บันทึก attendance ลง `data/attendance.json` พร้อมเวลา | Must |

### 3.3 Module: Instructor Dashboard
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-D01 | สรุปจำนวนนักศึกษาทั้งหมดที่ลงทะเบียนแล้ว | Must |
| FR-D02 | สรุปยอดผู้มาเช็คชื่อเข้าเรียนในวันนี้ | Must |
| FR-D03 | แสดงกราฟแท่งแนวโน้มการเข้าเรียนย้อนหลัง 7 วัน | Should |
| FR-D04 | แสดงตารางรายชื่อผู้มาเช็คชื่อ 10 คนล่าสุดแบบ Real-time | Must |
| FR-D05 | มีปุ่ม Reset ข้อมูลทั้งหมด (ลบไฟล์ JSON) เพื่อสาธิตเรื่องการขอสิทธิลบข้อมูล | Must |

### 3.4 Module: Student Management (CRUD)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-M01 | แสดงรายการนักศึกษาที่ลงทะเบียนไว้ทั้งหมดในรูปแบบตาราง | Must |
| FR-M02 | สามารถกด "แก้ไข" เพื่อเปลี่ยนชื่อ-นามสกุล และอีเมลของนักศึกษาได้ | Must |
| FR-M03 | สามารถกด "ลบ" นักศึกษาได้ พร้อมกับลบประวัติการเข้าเรียนของบุคคลนั้นอัตโนมัติ | Must |

---

## 4. Non-Functional Requirements
- **Framework:** Next.js 14+ (App Router) + TypeScript
- **Styling:** Tailwind CSS (Theme อ้างอิงจาก Tailwind Syntax Template: Light mode, พื้นหลังสีขาว/สว่าง พร้อมไฮไลท์สีโทนเย็น และควบคุมขนาด Typography ไม่ให้ใหญ่เกินความจำเป็น)
- **Face Recognition:** face-api.js (client-side)
- **Storage:** Local JSON files ใน `data/` folder (students.json, attendance.json)
- **Performance:** Face detection ทำงานราบรื่นแบบเรียลไทม์

---

## 5. PDPA & Ethical Considerations
- **Data Minimization:** ไม่เก็บภาพถ่ายดิบ เก็บเพียง Face Descriptor Vector
- **Right to be Forgotten:** สามารถกดลบข้อมูลทุกอย่างในระบบทิ้งได้ด้วยปุ่มเดียว
