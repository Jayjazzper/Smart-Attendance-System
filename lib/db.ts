import fs from 'fs/promises';
import path from 'path';
import { Student, Attendance, LeaveRequest, Teacher } from './types';

// Paths to JSON files
const DATA_DIR = path.join(process.cwd(), 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const LEAVES_FILE = path.join(DATA_DIR, 'leaves.json');

// Google Apps Script URL from environment variables
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;

// Helper to check if Google Script URL is defined
export function isGoogleSheetsActive(): boolean {
  return !!GOOGLE_SCRIPT_URL;
}

// Call Google Apps Script Web App
async function callGoogleScript(action: string, extraData: any = {}): Promise<any> {
  if (!GOOGLE_SCRIPT_URL) return null;
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...extraData }),
      cache: 'no-store'
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data;
      }
      throw new Error(data.error || 'Request to Google Apps Script failed');
    }
    throw new Error(`HTTP Error: ${response.status}`);
  } catch (err) {
    console.error(`Error calling Google Apps Script (${action}):`, err);
    throw err;
  }
}

// Helper to ensure local files and directory exist
async function ensureDbExists() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {}

  try {
    await fs.access(STUDENTS_FILE);
  } catch {
    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students: [] }, null, 2));
  }

  try {
    await fs.access(ATTENDANCE_FILE);
  } catch {
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance: [] }, null, 2));
  }

  try {
    await fs.access(LEAVES_FILE);
  } catch {
    await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves: [] }, null, 2));
  }
}

// Simple Promise-based Mutex Lock for local concurrency protection
class Mutex {
  private promise: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void;
    const nextPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentPromise = this.promise;
    this.promise = currentPromise.then(() => nextPromise);
    await currentPromise;
    return release!;
  }
}

const dbMutex = new Mutex();

// --- Database Operations ---

// Get all students
export async function getStudents(): Promise<Student[]> {
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('getStudents');
      if (res && res.success) {
        return (res.students || []).filter((s: any) => 
          s.id && 
          s.id.toLowerCase() !== "id" && 
          s.id.toLowerCase() !== "รหัส" &&
          s.name.toLowerCase() !== "name"
        );
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for getStudents due to API error:', e);
    }
  }

  // 2. Fallback to local files
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(STUDENTS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.students || [];
  } catch (error) {
    console.error('Error reading local students:', error);
    return [];
  } finally {
    release();
  }
}

// Save a student (Register)
export async function saveStudent(student: Student): Promise<boolean> {
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('addStudent', { student });
      if (res) {
        return !!res.success;
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for saveStudent due to API error:', e);
    }
  }

  // 2. Fallback to local files
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(STUDENTS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const students: Student[] = parsed.students || [];

    // Check duplicate ID
    if (students.some((s) => s.id === student.id)) {
      return false;
    }

    students.push(student);
    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students }, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving local student:', error);
    return false;
  } finally {
    release();
  }
}

export async function saveAllStudents(students: Student[]): Promise<boolean> {
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students }, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving all students:', error);
    return false;
  } finally {
    release();
  }
}

// Update student details
export async function updateStudent(
  id: string,
  name: string,
  email: string,
  classroom?: string,
  level?: 'kindergarten' | 'primary' | 'secondary',
  parentLineId?: string,
  avatarUrl?: string,
  bloodGroup?: string,
  emergencyPhone?: string,
  medicalAlert?: string
): Promise<boolean> {
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('updateStudent', { id, name, email, classroom, level, parentLineId, avatarUrl, bloodGroup, emergencyPhone, medicalAlert });
      if (res) {
        return !!res.success;
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for updateStudent due to API error:', e);
    }
  }

  // 2. Fallback to local files
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(STUDENTS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const students: Student[] = parsed.students || [];

    const index = students.findIndex((s) => s.id === id);
    if (index === -1) return false;

    students[index].name = name;
    students[index].email = email;
    if (classroom !== undefined) students[index].classroom = classroom;
    if (level !== undefined) students[index].level = level;
    if (parentLineId !== undefined) students[index].parentLineId = parentLineId;
    if (avatarUrl !== undefined) students[index].avatarUrl = avatarUrl;
    if (bloodGroup !== undefined) students[index].bloodGroup = bloodGroup;
    if (emergencyPhone !== undefined) students[index].emergencyPhone = emergencyPhone;
    if (medicalAlert !== undefined) students[index].medicalAlert = medicalAlert;

    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students }, null, 2));

    // Also update any matching info in local attendance
    try {
      const attData = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
      const attParsed = JSON.parse(attData);
      const attendance: Attendance[] = attParsed.attendance || [];
      let attChanged = false;
      attendance.forEach((record) => {
        if (record.studentId === id) {
          record.studentName = name;
          record.studentEmail = email;
          if (classroom !== undefined) record.classroom = classroom;
          attChanged = true;
        }
      });
      if (attChanged) {
        await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance }, null, 2));
      }
    } catch (e) {
      console.error('Error updating matching local attendance records:', e);
    }

    return true;
  } catch (error) {
    console.error('Error updating local student:', error);
    return false;
  } finally {
    release();
  }
}

// Delete student and their attendance records (Right to be Forgotten)
export async function deleteStudent(id: string): Promise<boolean> {
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('deleteStudent', { id });
      if (res) {
        return !!res.success;
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for deleteStudent due to API error:', e);
    }
  }

  // 2. Fallback to local files
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    
    // 1. Remove student
    const studentData = await fs.readFile(STUDENTS_FILE, 'utf-8');
    const studentParsed = JSON.parse(studentData);
    const students: Student[] = studentParsed.students || [];
    
    const filteredStudents = students.filter((s) => s.id !== id);
    if (students.length === filteredStudents.length) return false; // student didn't exist
    
    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students: filteredStudents }, null, 2));

    // 2. Remove their attendance history
    const attData = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
    const attParsed = JSON.parse(attData);
    const attendance: Attendance[] = attParsed.attendance || [];
    
    const filteredAttendance = attendance.filter((a) => a.studentId !== id);
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance: filteredAttendance }, null, 2));

    return true;
  } catch (error) {
    console.error('Error deleting local student:', error);
    return false;
  } finally {
    release();
  }
}

// Get all attendance
export async function getAttendance(): Promise<Attendance[]> {
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('getAttendance');
      if (res && res.success) {
        return (res.attendance || []).filter((a: any) => 
          a.id && 
          a.id.toLowerCase() !== "id" && 
          a.studentId.toLowerCase() !== "studentid"
        );
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for getAttendance due to API error:', e);
    }
  }

  // 2. Fallback to local files
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.attendance || [];
  } catch (error) {
    console.error('Error reading local attendance:', error);
    return [];
  } finally {
    release();
  }
}

// Save attendance record
export async function saveAttendance(
  record: Omit<Attendance, 'id' | 'timestamp'> & { timestamp?: string }
): Promise<Attendance | null> {
  const finalTimestamp = record.timestamp || new Date().toISOString();
  
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const newRecord: Attendance = {
        ...record,
        id: globalThis.crypto?.randomUUID() || Math.random().toString(36).substring(2, 11),
        timestamp: finalTimestamp
      };
      const res = await callGoogleScript('addAttendance', { record: newRecord });
      if (res && res.success) {
        return newRecord;
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for saveAttendance due to API error:', e);
    }
  }

  // 2. Fallback to local files
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const attendance: Attendance[] = parsed.attendance || [];

    const newRecord: Attendance = {
      ...record,
      id: globalThis.crypto?.randomUUID() || Math.random().toString(36).substring(2, 11),
      timestamp: finalTimestamp
    };

    attendance.push(newRecord);
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance }, null, 2));
    return newRecord;
  } catch (error) {
    console.error('Error saving local attendance:', error);
    return null;
  } finally {
    release();
  }
}

// Reset Database (Delete everything)
export async function resetDatabase(): Promise<boolean> {
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('reset');
      if (res) {
        return !!res.success;
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for resetDatabase due to API error:', e);
    }
  }

  // 2. Fallback to local files
  const release = await dbMutex.acquire();
  try {
    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students: [] }, null, 2));
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance: [] }, null, 2));
    await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves: [] }, null, 2));
  } catch (error) {
    console.error('Error resetting local database:', error);
    return false;
  } finally {
    release();
  }

  // Seed mock data
  await seedMockData();
  return true;
}

// Seed Mock Data for 7 students and 10 weekdays of attendance history
export async function seedMockData(): Promise<boolean> {
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();

    const mockStudents: Student[] = [
      {
        id: "10001",
        name: "เด็กชายสมชาย รักดี",
        email: "somchai.rak@school.mail",
        faceDescriptor: Array(128).fill(0),
        consentGiven: true,
        registeredAt: new Date().toISOString(),
        classroom: "ป.4/1",
        level: "primary"
      },
      {
        id: "10002",
        name: "เด็กหญิงมานี ดีใจ",
        email: "manee.dee@school.mail",
        faceDescriptor: Array(128).fill(0),
        consentGiven: true,
        registeredAt: new Date().toISOString(),
        classroom: "ป.4/1",
        level: "primary"
      },
      {
        id: "10003",
        name: "เด็กชายปิติ รุ่งเรือง",
        email: "piti.rung@school.mail",
        faceDescriptor: Array(128).fill(0),
        consentGiven: true,
        registeredAt: new Date().toISOString(),
        classroom: "ป.4/1",
        level: "primary"
      },
      {
        id: "10004",
        name: "เด็กหญิงชูใจ ตั้งใจ",
        email: "choojai.tang@school.mail",
        faceDescriptor: Array(128).fill(0),
        consentGiven: true,
        registeredAt: new Date().toISOString(),
        classroom: "ป.4/2",
        level: "primary"
      },
      {
        id: "10005",
        name: "เด็กชายวีระ แกล้วกล้า",
        email: "weera.klaw@school.mail",
        faceDescriptor: Array(128).fill(0),
        consentGiven: true,
        registeredAt: new Date().toISOString(),
        classroom: "ป.4/2",
        level: "primary"
      },
      {
        id: "10006",
        name: "นายดนัย ใฝ่รู้",
        email: "danai.fai@school.mail",
        faceDescriptor: Array(128).fill(0),
        consentGiven: true,
        registeredAt: new Date().toISOString(),
        classroom: "ม.1/1",
        level: "secondary"
      },
      {
        id: "10007",
        name: "นางสาวกานดา รักเรียน",
        email: "kanda.rak@school.mail",
        faceDescriptor: Array(128).fill(0),
        consentGiven: true,
        registeredAt: new Date().toISOString(),
        classroom: "ม.1/1",
        level: "secondary"
      }
    ];

    // Preserve existing real students (like Jirayu Go)
    let finalStudents = [...mockStudents];
    try {
      const studentData = await fs.readFile(STUDENTS_FILE, 'utf-8');
      const parsed = JSON.parse(studentData);
      const existing: Student[] = parsed.students || [];
      const realStudents = existing.filter((s: Student) => !s.id.startsWith("1000"));
      finalStudents = [...realStudents, ...mockStudents];
    } catch (e) {}

    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students: finalStudents }, null, 2));

    // Generate 10 weekdays of attendance history
    const attendanceRecords: Attendance[] = [];
    const getPastWeekdays = (count: number): Date[] => {
      const dates: Date[] = [];
      let i = 0;
      while (dates.length < count) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const day = d.getDay();
        if (day !== 0 && day !== 6) { // Skip Sat/Sun
          dates.push(d);
        }
        i++;
      }
      return dates.reverse(); // oldest first
    };

    const pastWeekdays = getPastWeekdays(10);
    const makeId = () => Math.random().toString(36).substring(2, 11);

    pastWeekdays.forEach((dayDate, dayIndex) => {
      const dayOfWeek = dayDate.getDay();

      // Student 1 (10001): Present/Late
      let s1Status: 'present' | 'late' = dayIndex === 4 ? 'late' : 'present';
      let s1Hour = s1Status === 'present' ? 7 : 8;
      let s1Min = s1Status === 'present' ? 35 + (dayIndex % 15) : 5 + (dayIndex % 5);
      attendanceRecords.push({
        id: makeId(),
        studentId: "10001",
        studentName: "เด็กชายสมชาย รักดี",
        studentEmail: "somchai.rak@school.mail",
        confidence: 100,
        timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), s1Hour, s1Min, 0).toISOString(),
        classroom: "ป.4/1",
        status: s1Status
      });

      // Student 2 (10002): Absent on Day 5, 6, 7, 9
      if (dayIndex !== 4 && dayIndex !== 5 && dayIndex !== 6 && dayIndex !== 8) {
        let s2Status: 'present' | 'late' = dayIndex === 2 ? 'late' : 'present';
        let s2Hour = s2Status === 'present' ? 7 : 8;
        let s2Min = s2Status === 'present' ? 40 + (dayIndex % 15) : 10 + (dayIndex % 5);
        attendanceRecords.push({
          id: makeId(),
          studentId: "10002",
          studentName: "เด็กหญิงมานี ดีใจ",
          studentEmail: "manee.dee@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), s2Hour, s2Min, 0).toISOString(),
          classroom: "ป.4/1",
          status: s2Status
        });
      } else {
        // Record as absent
        attendanceRecords.push({
          id: makeId(),
          studentId: "10002",
          studentName: "เด็กหญิงมานี ดีใจ",
          studentEmail: "manee.dee@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 8, 30, 0).toISOString(),
          classroom: "ป.4/1",
          status: 'absent'
        });
      }

      // Student 3 (10003): Absent on Mon/Fri (dayDate.getDay() === 1 or 5)
      if (dayOfWeek !== 1 && dayOfWeek !== 5) {
        let s3Min = 42 + (dayIndex % 12);
        attendanceRecords.push({
          id: makeId(),
          studentId: "10003",
          studentName: "เด็กชายปิติ รุ่งเรือง",
          studentEmail: "piti.rung@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 7, s3Min, 0).toISOString(),
          classroom: "ป.4/1",
          status: 'present'
        });
      } else {
        attendanceRecords.push({
          id: makeId(),
          studentId: "10003",
          studentName: "เด็กชายปิติ รุ่งเรือง",
          studentEmail: "piti.rung@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 8, 30, 0).toISOString(),
          classroom: "ป.4/1",
          status: 'absent'
        });
      }

      // Student 4 (10004): Leave on days 6, 7, 8
      if (dayIndex !== 5 && dayIndex !== 6 && dayIndex !== 7) {
        let s4Min = 45 + (dayIndex % 10);
        attendanceRecords.push({
          id: makeId(),
          studentId: "10004",
          studentName: "เด็กหญิงชูใจ ตั้งใจ",
          studentEmail: "choojai.tang@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 7, s4Min, 0).toISOString(),
          classroom: "ป.4/2",
          status: 'present'
        });
      } else {
        attendanceRecords.push({
          id: makeId(),
          studentId: "10004",
          studentName: "เด็กหญิงชูใจ ตั้งใจ",
          studentEmail: "choojai.tang@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 8, 30, 0).toISOString(),
          classroom: "ป.4/2",
          status: 'leave'
        });
      }

      // Student 5 (10005): Late/Present/Absent (80% attendance rate)
      if (dayIndex !== 8) {
        let s5Status: 'present' | 'late' = (dayIndex % 2 === 0) ? 'late' : 'present';
        let s5Hour = s5Status === 'present' ? 7 : 8;
        let s5Min = s5Status === 'present' ? 45 + (dayIndex % 10) : 8 + (dayIndex % 6);
        attendanceRecords.push({
          id: makeId(),
          studentId: "10005",
          studentName: "เด็กชายวีระ แกล้วกล้า",
          studentEmail: "weera.klaw@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), s5Hour, s5Min, 0).toISOString(),
          classroom: "ป.4/2",
          status: s5Status
        });
      } else {
        attendanceRecords.push({
          id: makeId(),
          studentId: "10005",
          studentName: "เด็กชายวีระ แกล้วกล้า",
          studentEmail: "weera.klaw@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 8, 30, 0).toISOString(),
          classroom: "ป.4/2",
          status: 'absent'
        });
      }

      // Student 6 (10006): Present early
      let s6Min = 15 + (dayIndex % 12);
      attendanceRecords.push({
        id: makeId(),
        studentId: "10006",
        studentName: "นายดนัย ใฝ่รู้",
        studentEmail: "danai.fai@school.mail",
        confidence: 100,
        timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 7, s6Min, 0).toISOString(),
        classroom: "ม.1/1",
        status: 'present'
      });

      // Student 7 (10007): Absent on Day 1, 4, 7 (70% attendance rate)
      if (dayIndex !== 0 && dayIndex !== 3 && dayIndex !== 6) {
        let s7Min = 35 + (dayIndex % 18);
        attendanceRecords.push({
          id: makeId(),
          studentId: "10007",
          studentName: "นางสาวกานดา รักเรียน",
          studentEmail: "kanda.rak@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 7, s7Min, 0).toISOString(),
          classroom: "ม.1/1",
          status: 'present'
        });
      } else {
        attendanceRecords.push({
          id: makeId(),
          studentId: "10007",
          studentName: "นางสาวกานดา รักเรียน",
          studentEmail: "kanda.rak@school.mail",
          confidence: 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 8, 30, 0).toISOString(),
          classroom: "ม.1/1",
          status: 'absent'
        });
      }
    });

    // Assign health screening records to mock history
    const finalAttendance = attendanceRecords.map(record => {
      if (record.status === 'present' || record.status === 'late') {
        const isCough = record.studentId === "10005" && new Date(record.timestamp).getDay() === 3; // make one of the entries have a cough
        const baseTemp = 36.1 + (parseFloat(record.studentId) % 5) * 0.1;
        const offset = (new Date(record.timestamp).getDate() % 4) * 0.1;
        return {
          ...record,
          temperature: parseFloat((baseTemp + offset).toFixed(1)),
          healthStatus: (isCough ? 'cough' : 'normal') as 'normal' | 'cough' | 'fever'
        };
      } else if (record.status === 'leave') {
        return {
          ...record,
          temperature: 38.2,
          healthStatus: 'fever' as 'normal' | 'cough' | 'fever'
        };
      }
      return record;
    });

    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance: finalAttendance }, null, 2));

    // Also populate leaves.json
    const mockLeaves = [
      {
        id: makeId(),
        studentId: "10004",
        studentName: "เด็กหญิงชูใจ ตั้งใจ",
        classroom: "ป.4/2",
        startDate: pastWeekdays[5].toISOString().split('T')[0],
        endDate: pastWeekdays[7].toISOString().split('T')[0],
        type: "sick",
        reason: "มีไข้สูง ปวดศีรษะ",
        status: "approved",
        submittedAt: pastWeekdays[5].toISOString()
      }
    ];
    await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves: mockLeaves }, null, 2));

    return true;
  } catch (error) {
    console.error("Error seeding mock data:", error);
    return false;
  } finally {
    release();
  }
}


const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

import { hashPassword } from './auth';

export interface ClassroomSetting {
  lineToken?: string;
}

export interface SystemSettings {
  classrooms: Record<string, ClassroomSetting>;
  lineChannelAccessToken?: string;
  teacherPasscode?: string;
  adminPasscode?: string;
  schoolName?: string;
  schoolDistrict?: string;
  schoolLogo?: string;
  enableAutoSummary?: boolean; // Enable automatic daily LINE summary
  summaryTime?: string; // Time to send daily summary, e.g., "08:30"
  lastSummarySentDate?: Record<string, string>; // Map of classroom -> last sent YYYY-MM-DD
  teachers?: Teacher[];
}

function ensureDefaultAdmin(settings: SystemSettings): { settings: SystemSettings; changed: boolean } {
  let changed = false;
  if (!settings.teachers) {
    settings.teachers = [];
    changed = true;
  }
  if (settings.teachers.length === 0) {
    settings.teachers.push({
      username: "admin",
      passwordHash: hashPassword("admin1234"),
      name: "ผู้ดูแลระบบกลาง",
      email: "admin@school.mail",
      classrooms: [],
      role: "admin",
      createdAt: new Date().toISOString()
    });
    changed = true;
  }
  return { settings, changed };
}

export async function getSettings(): Promise<SystemSettings> {
  let rawSettings: SystemSettings | null = null;
  let isFallback = false;
  
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('getSettings');
      if (res && res.success && res.settings) {
        const parsed = res.settings;
        rawSettings = {
          classrooms: parsed.classrooms || {},
          lineChannelAccessToken: parsed.lineChannelAccessToken || "",
          teacherPasscode: parsed.teacherPasscode || "1234",
          adminPasscode: parsed.adminPasscode || "1234",
          schoolName: parsed.schoolName || process.env.NEXT_PUBLIC_SCHOOL_NAME || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)",
          schoolDistrict: parsed.schoolDistrict || process.env.NEXT_PUBLIC_SCHOOL_DISTRICT || "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1",
          schoolLogo: parsed.schoolLogo || "",
          enableAutoSummary: parsed.enableAutoSummary ?? false,
          summaryTime: parsed.summaryTime || "08:30",
          lastSummarySentDate: parsed.lastSummarySentDate || {},
          teachers: parsed.teachers || []
        };
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for getSettings due to API error:', e);
      isFallback = true;
    }
  }

  // 2. Fallback to local files
  if (!rawSettings) {
    if (isGoogleSheetsActive()) {
      isFallback = true;
    }
    const release = await dbMutex.acquire();
    try {
      await ensureDbExists();
      try {
        await fs.access(SETTINGS_FILE);
      } catch {
        await fs.writeFile(SETTINGS_FILE, JSON.stringify({ 
          classrooms: {}, 
          lineChannelAccessToken: "", 
          teacherPasscode: "1234", 
          adminPasscode: "1234",
          enableAutoSummary: false,
          summaryTime: "08:30",
          lastSummarySentDate: {},
          teachers: []
        }, null, 2));
      }
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(data) as SystemSettings;
      rawSettings = {
        classrooms: parsed.classrooms || {},
        lineChannelAccessToken: parsed.lineChannelAccessToken || "",
        teacherPasscode: parsed.teacherPasscode || "1234",
        adminPasscode: parsed.adminPasscode || "1234",
        schoolName: parsed.schoolName || process.env.NEXT_PUBLIC_SCHOOL_NAME || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)",
        schoolDistrict: parsed.schoolDistrict || process.env.NEXT_PUBLIC_SCHOOL_DISTRICT || "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1",
        schoolLogo: parsed.schoolLogo || "",
        enableAutoSummary: parsed.enableAutoSummary ?? false,
        summaryTime: parsed.summaryTime || "08:30",
        lastSummarySentDate: parsed.lastSummarySentDate || {},
        teachers: parsed.teachers || []
      };
    } catch (error) {
      console.error('Error reading settings:', error);
      rawSettings = {
        classrooms: {},
        lineChannelAccessToken: "",
        teacherPasscode: "1234",
        adminPasscode: "1234",
        schoolName: process.env.NEXT_PUBLIC_SCHOOL_NAME || "โรงเรียนบ้านป่าเลา(ประชานุสรณ์)",
        schoolDistrict: process.env.NEXT_PUBLIC_SCHOOL_DISTRICT || "สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษาแพร่ เขต 1",
        schoolLogo: "",
        enableAutoSummary: false,
        summaryTime: "08:30",
        lastSummarySentDate: {},
        teachers: []
      };
    } finally {
      release();
    }
  }

  // Ensure default admin exists
  const { settings: finalSettings, changed } = ensureDefaultAdmin(rawSettings);
  if (changed && !isFallback) {
    saveSettings(finalSettings).catch(err => console.error("Failed to auto-save default admin:", err));
  }

  return finalSettings;
}

export async function saveSettings(settings: SystemSettings): Promise<boolean> {
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('saveSettings', { settings });
      if (res && res.success) {
        // Also save locally as local cache/fallback if possible
        try {
          await ensureDbExists();
          await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        } catch (e) {
          // Ignore local write failure on serverless like Vercel
        }
        return true;
      }
    } catch (e) {
      console.warn('Fallback to local JSON storage for saveSettings due to API error:', e);
    }
  }

  // 2. Fallback to local files
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  } finally {
    release();
  }
}

// --- Teacher Management Operations ---

export async function getTeachers(): Promise<Teacher[]> {
  const settings = await getSettings();
  return settings.teachers || [];
}

export async function saveTeacher(teacher: Teacher): Promise<boolean> {
  const settings = await getSettings();
  const teachers = settings.teachers || [];
  
  if (teachers.some(t => t.username.toLowerCase() === teacher.username.toLowerCase())) {
    return false; // username exists
  }
  
  teachers.push(teacher);
  settings.teachers = teachers;
  return await saveSettings(settings);
}

export async function updateTeacherAccount(
  username: string, 
  data: Partial<Omit<Teacher, 'username' | 'createdAt'>>
): Promise<boolean> {
  const settings = await getSettings();
  const teachers = settings.teachers || [];
  
  const index = teachers.findIndex(t => t.username.toLowerCase() === username.toLowerCase());
  if (index === -1) return false;
  
  const current = teachers[index];
  teachers[index] = {
    ...current,
    name: data.name !== undefined ? data.name : current.name,
    email: data.email !== undefined ? data.email : current.email,
    classrooms: data.classrooms !== undefined ? data.classrooms : current.classrooms,
    role: data.role !== undefined ? data.role : current.role,
    passwordHash: data.passwordHash !== undefined ? data.passwordHash : current.passwordHash
  };
  
  settings.teachers = teachers;
  return await saveSettings(settings);
}

export async function deleteTeacher(username: string): Promise<boolean> {
  const settings = await getSettings();
  const teachers = settings.teachers || [];
  
  const filtered = teachers.filter(t => t.username.toLowerCase() !== username.toLowerCase());
  if (teachers.length === filtered.length) return false; // not found
  
  settings.teachers = filtered;
  return await saveSettings(settings);
}

// Get all leave requests
export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  // 1. Try Google Sheets if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('getLeaves');
      if (res && res.success && res.leaves) {
        // Cache locally in background
        try {
          await ensureDbExists();
          await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves: res.leaves }, null, 2));
        } catch (e) {}
        return res.leaves;
      }
    } catch (e) {
      console.warn('Fallback to local storage for getLeaveRequests due to API error:', e);
    }
  }

  // 2. Local fallback
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(LEAVES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.leaves || [];
  } catch (error) {
    console.error('Error reading local leaves:', error);
    return [];
  } finally {
    release();
  }
}

// Save leave request (Submit)
export async function saveLeaveRequest(request: LeaveRequest, teacherEmail?: string, systemUrl?: string): Promise<boolean> {
  // 1. Try Google Sheets if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('addLeave', { record: request, teacherEmail, systemUrl });
      if (res && res.success) {
        // Cache locally
        try {
          if (res.evidenceUrl) {
            request.evidenceUrl = res.evidenceUrl;
          }
          // Remove large base64 data to save disk space
          delete request.evidenceBase64;

          await ensureDbExists();
          const data = await fs.readFile(LEAVES_FILE, 'utf-8');
          const parsed = JSON.parse(data);
          const leaves: LeaveRequest[] = parsed.leaves || [];
          leaves.push(request);
          await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves }, null, 2));
        } catch (e) {}
        return true;
      }
    } catch (e) {
      console.warn('Failed to save leave request to Google Sheets, falling back to local storage:', e);
    }
  }

  // 2. Local fallback
  const release = await dbMutex.acquire();
  try {
    // Remove base64 data before saving locally
    delete request.evidenceBase64;

    await ensureDbExists();
    const data = await fs.readFile(LEAVES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const leaves: LeaveRequest[] = parsed.leaves || [];
    leaves.push(request);
    await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves }, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving local leave request:', error);
    return false;
  } finally {
    release();
  }
}

// Update leave request status (Approve/Reject)
export async function updateLeaveRequestStatus(
  id: string,
  status: 'approved' | 'rejected'
): Promise<boolean> {
  let remoteLeaves: LeaveRequest[] | null = null;

  // 1. Try Google Sheets if active
  if (isGoogleSheetsActive()) {
    try {
      const updateRes = await callGoogleScript('updateLeaveStatus', { id, status });
      if (updateRes && updateRes.success) {
        // Fetch latest leaves from Google Sheets to sync local cache
        const res = await callGoogleScript('getLeaves');
        if (res && res.success && res.leaves) {
          remoteLeaves = res.leaves;
        }
      } else {
        return false; // Google Sheets update failed
      }
    } catch (e) {
      console.warn('Failed to sync leave status update to Google Sheets:', e);
    }
  }

  // 2. Local execution
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    
    let leaves: LeaveRequest[] = [];
    if (remoteLeaves) {
      leaves = remoteLeaves;
      await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves }, null, 2));
    } else {
      const data = await fs.readFile(LEAVES_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      leaves = parsed.leaves || [];
    }

    let index = leaves.findIndex((l) => l.id === id);
    
    // If still not found, search Remote one more time if we hadn't already
    if (index === -1 && !remoteLeaves && isGoogleSheetsActive()) {
      try {
        const res = await callGoogleScript('getLeaves');
        if (res && res.success && res.leaves) {
          leaves = res.leaves;
          await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves }, null, 2));
          index = leaves.findIndex((l) => l.id === id);
        }
      } catch (e) {}
    }

    if (index === -1) return false;

    leaves[index].status = status;
    await fs.writeFile(LEAVES_FILE, JSON.stringify({ leaves }, null, 2));

    // If approved, append attendance logs of status 'leave' for each date in range
    if (status === 'approved') {
      const req = leaves[index];
      try {
        const start = new Date(req.startDate);
        const end = new Date(req.endDate);

        // Load existing attendance
        const attData = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
        const attParsed = JSON.parse(attData);
        const attendance: Attendance[] = attParsed.attendance || [];

        let current = new Date(start);
        while (current <= end) {
          // Create custom timestamp for this specific date, matching mid-day (08:30) in local timezone
          const logTimestamp = new Date(
            current.getFullYear(),
            current.getMonth(),
            current.getDate(),
            8, 30, 0
          ).toISOString();

          const newRecord: Attendance = {
            id: globalThis.crypto?.randomUUID() || Math.random().toString(36).substring(2, 11),
            studentId: req.studentId,
            studentName: req.studentName,
            studentEmail: "",
            confidence: 100,
            timestamp: logTimestamp,
            classroom: req.classroom,
            status: 'leave'
          };

          // If Google Sheets is active, sync log to Google Sheets immediately
          if (isGoogleSheetsActive()) {
            try {
              await callGoogleScript('addAttendance', { record: newRecord });
            } catch (sheetErr) {
              console.warn('Failed to sync leave record to Google Sheets, using local cache:', sheetErr);
            }
          }

          attendance.push(newRecord);
          current.setDate(current.getDate() + 1);
        }

        await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance }, null, 2));
      } catch (e) {
        console.error('Error generating attendance logs for leave request:', e);
      }
    }

    return true;
  } catch (error) {
    console.error('Error updating leave status:', error);
    return false;
  } finally {
    release();
  }
}
