export interface Student {
  id: string;
  name: string;
  email: string;
  faceDescriptor: number[]; // 128-dimensional vector
  consentGiven: boolean;
  registeredAt: string; // ISO format string
  classroom?: string; // e.g., "ป.4/2"
  level?: 'kindergarten' | 'primary' | 'secondary';
  parentLineId?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  confidence: number; // confidence score percentage
  timestamp: string; // ISO format string
  classroom?: string;
  status?: 'present' | 'late' | 'absent' | 'leave';
}

export interface DatabaseState {
  students: Student[];
}

export interface AttendanceState {
  attendance: Attendance[];
}

export interface LeaveRequest {
  id: string;
  studentId: string;
  studentName: string;
  classroom: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: 'sick' | 'personal' | 'other'; // ลาป่วย, ลากิจ, อื่นๆ
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string; // ISO format string
}
