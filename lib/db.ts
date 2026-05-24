import fs from 'fs/promises';
import path from 'path';
import { crypto } from 'next/dist/compiled/@edge-runtime/primitives'; // or standard crypto
import { Student, Attendance } from './types';

// Paths to JSON files
const DATA_DIR = path.join(process.cwd(), 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');

// Helper to ensure files and directory exist
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

// Simple Promise-based Mutex Lock for concurrency protection
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
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(STUDENTS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.students || [];
  } catch (error) {
    console.error('Error reading students:', error);
    return [];
  } finally {
    release();
  }
}

// Save a student (Register)
export async function saveStudent(student: Student): Promise<boolean> {
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
    console.error('Error saving student:', error);
    return false;
  } finally {
    release();
  }
}

// Update student details
export async function updateStudent(id: string, name: string, email: string): Promise<boolean> {
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

    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students }, null, 2));

    // Also update any matching info in attendance if needed (but usually, student ID is enough.
    // However, if we cache names in attendance for dashboard performance, we can update them too).
    try {
      const attData = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
      const attParsed = JSON.parse(attData);
      const attendance: Attendance[] = attParsed.attendance || [];
      let attChanged = false;
      attendance.forEach((record) => {
        if (record.studentId === id) {
          record.studentName = name;
          record.studentEmail = email;
          attChanged = true;
        }
      });
      if (attChanged) {
        await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance }, null, 2));
      }
    } catch (e) {
      console.error('Error updating matching attendance records:', e);
    }

    return true;
  } catch (error) {
    console.error('Error updating student:', error);
    return false;
  } finally {
    release();
  }
}

// Delete student and their attendance records (Right to be Forgotten)
export async function deleteStudent(id: string): Promise<boolean> {
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
    console.error('Error deleting student:', error);
    return false;
  } finally {
    release();
  }
}

// Get all attendance
export async function getAttendance(): Promise<Attendance[]> {
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.attendance || [];
  } catch (error) {
    console.error('Error reading attendance:', error);
    return [];
  } finally {
    release();
  }
}

// Save attendance record
export async function saveAttendance(record: Omit<Attendance, 'id' | 'timestamp'>): Promise<Attendance | null> {
  const release = await dbMutex.acquire();
  try {
    await ensureDbExists();
    const data = await fs.readFile(ATTENDANCE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const attendance: Attendance[] = parsed.attendance || [];

    const newRecord: Attendance = {
      ...record,
      id: globalThis.crypto?.randomUUID() || Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString()
    };

    attendance.push(newRecord);
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance }, null, 2));
    return newRecord;
  } catch (error) {
    console.error('Error saving attendance:', error);
    return null;
  } finally {
    release();
  }
}

// Reset Database (Delete everything)
export async function resetDatabase(): Promise<boolean> {
  const release = await dbMutex.acquire();
  try {
    await fs.writeFile(STUDENTS_FILE, JSON.stringify({ students: [] }, null, 2));
    await fs.writeFile(ATTENDANCE_FILE, JSON.stringify({ attendance: [] }, null, 2));
    return true;
  } catch (error) {
    console.error('Error resetting database:', error);
    return false;
  } finally {
    release();
  }
}
