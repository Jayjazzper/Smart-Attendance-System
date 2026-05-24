export interface Student {
  id: string;
  name: string;
  email: string;
  faceDescriptor: number[]; // 128-dimensional vector
  consentGiven: boolean;
  registeredAt: string; // ISO format string
}

export interface Attendance {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  confidence: number; // confidence score percentage
  timestamp: string; // ISO format string
}

export interface DatabaseState {
  students: Student[];
}

export interface AttendanceState {
  attendance: Attendance[];
}
