import fs from 'fs/promises';
import path from 'path';
import { Student, Attendance } from './types';

// Paths to JSON files
const DATA_DIR = path.join(process.cwd(), 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');

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
        return res.students || [];
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

// Update student details
export async function updateStudent(
  id: string,
  name: string,
  email: string,
  classroom?: string,
  level?: 'kindergarten' | 'primary' | 'secondary'
): Promise<boolean> {
  // 1. Try Google Sheets Web App if active
  if (isGoogleSheetsActive()) {
    try {
      const res = await callGoogleScript('updateStudent', { id, name, email, classroom, level });
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
        return res.attendance || [];
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
    return true;
  } catch (error) {
    console.error('Error resetting local database:', error);
    return false;
  } finally {
    release();
  }
}
