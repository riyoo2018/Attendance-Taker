/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface University {
  id: string;
  name: string;
  shortName: string;
  code: string;
  collegeName: string;
  collegeShort: string;
  logoUrl?: string;
  themeColor: string;
  contactEmail: string;
  supportPhone: string;
  supportWhatsapp?: string;
}

export interface Department {
  id: string;
  universityId: string;
  name: string;
  code: string;
  faculty: string;
}

export interface Course {
  id: string;
  universityId: string;
  departmentId: string;
  code: string;
  name: string;
  credits: number;
  lecturerId: string;
}

export interface Student {
  id: string; // Internal UUID
  universityId: string;
  studentId: string; // 8-digit reference e.g. "21009023"
  fullName: string;
  programme: string;
  department: string;
  academicYear: string; // e.g. "Year 4"
  email: string;
  photoUrl?: string;
  isActive: boolean;
  enrolledCourseIds: string[];
}

export interface Lecturer {
  id: string;
  universityId: string;
  staffId: string;
  fullName: string;
  email: string;
  department: string;
  title: string; // e.g. "Dr.", "Prof."
  assignedCourseIds: string[];
}

export interface Classroom {
  id: string;
  name: string;
  building: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  capacity: number;
}

export interface AttendanceSession {
  id: string;
  universityId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  lecturerId: string;
  lecturerName: string;
  classroomId: string;
  classroomName: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  isActive: boolean;
  targetLatitude: number;
  targetLongitude: number;
  permittedRadiusMeters: number;
  sessionCode: string; // QR session code
  totalEnrolled: number;
  presentCount: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentReference: string;
  studentName: string;
  programme: string;
  department: string;
  courseCode: string;
  courseName: string;
  timestamp: string; // ISO string
  timeFormatted: string; // "15:33:11"
  dateFormatted: string; // "Nov 10, 2026"
  status: 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT';
  verificationMethod: 'GPS_FACE' | 'MANUAL_OVERRIDE';
  gpsAccuracyMeters: number;
  distanceFromVenueMeters: number;
  deviceLatitude: number;
  deviceLongitude: number;
  selfieDataUrl?: string;
  attendanceReference: string; // e.g. "ATT-KNUST-89324"
  overrideNotes?: string;
  overriddenBy?: string;
}

export interface CampusLocationConfig {
  campusName: string;
  defaultLatitude: number;
  defaultLongitude: number;
  defaultRadiusMeters: number;
  strictGpsMode: boolean; // if false, allows demonstration simulation
  venueName: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: 'ADMIN' | 'LECTURER' | 'SYSTEM';
  action: string;
  details: string;
  ipAddress?: string;
}
