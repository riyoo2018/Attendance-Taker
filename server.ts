/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initialUniversity,
  initialDepartments,
  initialCourses,
  initialClassrooms,
  initialStudents,
  initialLecturers,
  initialActiveSession,
  initialAttendanceRecords,
  initialLocationConfig,
  initialAuditLogs,
} from './src/data/mockDatabase.ts';
import {
  Student,
  AttendanceSession,
  AttendanceRecord,
  CampusLocationConfig,
  AuditLog,
} from './src/types/attendance.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';
const stateFile = process.env.ATTENDANCE_DATA_FILE || path.join(__dirname, 'data', 'attendance-state.json');

function safeCredentialMatch(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

function requireDemoAccess(req: Request, res: Response, next: express.NextFunction): void {
  const authorization = req.get('authorization') || '';
  const credentials = authorization.startsWith('Basic ')
    ? Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    : '';
  const separator = credentials.indexOf(':');
  const username = separator >= 0 ? credentials.slice(0, separator) : '';
  const password = separator >= 0 ? credentials.slice(separator + 1) : '';
  const expectedUsername = process.env.DEMO_ACCESS_USER || '';
  const expectedPassword = process.env.DEMO_ACCESS_PASSWORD || '';

  if (safeCredentialMatch(username, expectedUsername) && safeCredentialMatch(password, expectedPassword)) {
    next();
    return;
  }

  res.set('WWW-Authenticate', 'Basic realm="Attendance Demo", charset="UTF-8"');
  res.status(401).send('Authentication required.');
}

if (isProduction && (
  !process.env.DEMO_ACCESS_USER ||
  process.env.DEMO_ACCESS_USER.includes(':') ||
  !process.env.DEMO_ACCESS_PASSWORD ||
  process.env.DEMO_ACCESS_PASSWORD.length < 16
)) {
  throw new Error('Production requires DEMO_ACCESS_USER and a DEMO_ACCESS_PASSWORD of at least 16 characters.');
}

app.get('/healthz', (_req: Request, res: Response) => res.status(200).send('ok'));
if (isProduction) app.use(requireDemoAccess);

// Middleware for parsing JSON with generous limit for selfie images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Local JSON persistence keeps this demo useful across server restarts. Selfies are never persisted.
let university = structuredClone(initialUniversity);
let departments = structuredClone(initialDepartments);
let courses = structuredClone(initialCourses);
let classrooms = structuredClone(initialClassrooms);
let students: Student[] = structuredClone(initialStudents);
let lecturers = structuredClone(initialLecturers);
let activeSession: AttendanceSession | null = structuredClone(initialActiveSession);
let attendanceRecords: AttendanceRecord[] = structuredClone(initialAttendanceRecords);
let locationConfig: CampusLocationConfig = structuredClone(initialLocationConfig);
let auditLogs: AuditLog[] = structuredClone(initialAuditLogs);

type SavedState = {
  students?: Student[];
  activeSession?: AttendanceSession | null;
  attendanceRecords?: AttendanceRecord[];
  locationConfig?: CampusLocationConfig;
  auditLogs?: AuditLog[];
};

if (existsSync(stateFile)) {
  try {
    const saved = JSON.parse(readFileSync(stateFile, 'utf8')) as SavedState;
    if (Array.isArray(saved.students)) students = saved.students;
    if (saved.activeSession === null || saved.activeSession) activeSession = saved.activeSession;
    if (Array.isArray(saved.attendanceRecords)) attendanceRecords = saved.attendanceRecords;
    if (saved.locationConfig) locationConfig = saved.locationConfig;
    if (Array.isArray(saved.auditLogs)) auditLogs = saved.auditLogs;
  } catch (error) {
    console.error('Could not load saved attendance state; using demo data.', error);
  }
}

function saveState(): void {
  const savedRecords = attendanceRecords.map(({ selfieDataUrl: _selfie, ...record }) => record);
  const saved: SavedState = { students, activeSession, attendanceRecords: savedRecords, locationConfig, auditLogs };
  const temporaryFile = `${stateFile}.tmp`;
  try {
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(temporaryFile, JSON.stringify(saved), 'utf8');
    renameSync(temporaryFile, stateFile);
  } catch (error) {
    console.error('Could not save attendance state.', error);
  }
}

// Helper: Haversine distance calculator in meters
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Helper: Format reference code e.g. ATT-KNUST-89324
function generateAttendanceReference(prefix = 'KNUST'): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `ATT-${prefix}-${randomNum}`;
}

// Helper: Formatted current date and time
function getFormattedDateTime(): { timeFormatted: string; dateFormatted: string; isoString: string } {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeFormatted = `${hours}:${minutes}:${seconds}`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateFormatted = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  return {
    timeFormatted,
    dateFormatted,
    isoString: now.toISOString(),
  };
}

// ---------------- REST API ROUTES ----------------

// System Health & University Info
app.get('/api/university', (_req: Request, res: Response) => {
  res.json({ success: true, university, locationConfig });
});

// Active Attendance Session
app.get('/api/session/active', (_req: Request, res: Response) => {
  if (!activeSession) {
    return res.status(404).json({ success: false, message: 'No active attendance session currently.' });
  }

  // Count live present students for this session
  const sessionRecords = attendanceRecords.filter(
    (r) => r.sessionId === activeSession?.id && ['PRESENT', 'LATE'].includes(r.status)
  );
  const updatedSession = {
    ...activeSession,
    presentCount: sessionRecords.length,
  };

  res.json({
    success: true,
    session: updatedSession,
    classroom: classrooms.find((c) => c.id === activeSession?.classroomId) || null,
  });
});

// Student Verification (Step 2 of attendance workflow)
app.post('/api/students/lookup', (req: Request, res: Response) => {
  const { studentId, sessionId } = req.body;

  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid Student ID is required.' });
  }

  const cleanId = studentId.trim();
  const student = students.find((s) => s.studentId === cleanId);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student ID not found. Please check your university ID.',
    });
  }

  if (!student.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Student account is currently inactive or suspended. Please contact Academic Affairs.',
      student: {
        studentId: student.studentId,
        fullName: student.fullName,
        isActive: false,
      },
    });
  }

  // Check if student has already registered for this session
  const targetSessionId = sessionId || activeSession?.id;
  const existingRecord = targetSessionId
    ? attendanceRecords.find((r) => r.sessionId === targetSessionId && r.studentReference === cleanId)
    : null;

  res.json({
    success: true,
    student: {
      id: student.id,
      studentId: student.studentId,
      fullName: student.fullName,
      programme: student.programme,
      department: student.department,
      academicYear: student.academicYear,
      email: student.email,
      isActive: student.isActive,
    },
    alreadyRegistered: !!existingRecord,
    existingRecord: existingRecord || null,
  });
});

// Location Verification (Step 3)
app.post('/api/attendance/verify-location', (req: Request, res: Response) => {
  const { latitude, longitude, sessionId, simulateCampusVenue } = req.body;

  if (sessionId && activeSession?.id !== sessionId) {
    return res.status(404).json({ success: false, message: 'Attendance session not found.' });
  }
  const targetSession = activeSession;

  const targetLat = targetSession ? targetSession.targetLatitude : locationConfig.defaultLatitude;
  const targetLng = targetSession ? targetSession.targetLongitude : locationConfig.defaultLongitude;
  const allowedRadius = targetSession ? targetSession.permittedRadiusMeters : locationConfig.defaultRadiusMeters;

  let computedDistance = 0;
  let withinRadius = false;
  let accuracyEstimate = 14;

  const demoSimulation = !isProduction && !locationConfig.strictGpsMode && simulateCampusVenue === true;
  if (demoSimulation) {
    // Demonstration/Testing mode: treat device as located on campus inside lecture hall
    computedDistance = Math.floor(Math.random() * 25) + 12; // 12m to 36m away
    withinRadius = true;
    accuracyEstimate = Math.floor(Math.random() * 6) + 10;
  } else {
    // Real coordinates calculation
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinate values received from device.',
      });
    }

    computedDistance = calculateHaversineDistance(latitude, longitude, targetLat, targetLng);
    withinRadius = computedDistance <= allowedRadius;
  }

  res.json({
    success: true,
    withinRadius,
    distanceMeters: computedDistance,
    allowedRadiusMeters: allowedRadius,
    accuracyMeters: accuracyEstimate,
    venueName: targetSession ? targetSession.classroomName : locationConfig.venueName,
    message: withinRadius
      ? `Location verified successfully (±${accuracyEstimate}m accuracy, ${computedDistance}m from venue).`
      : `You are outside the authorized attendance perimeter (${computedDistance}m away; maximum permitted is ${allowedRadius}m).`,
  });
});

// Submit Attendance (Step 6)
app.post('/api/attendance/submit', (req: Request, res: Response) => {
  const { studentId, sessionId, selfieImage, deviceCoordinates, simulateCampusVenue } = req.body;

  if (!studentId) {
    return res.status(400).json({ success: false, message: 'Student ID reference is required.' });
  }

  const cleanId = String(studentId).trim();
  const student = students.find((s) => s.studentId === cleanId);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found in registrar database.' });
  }

  if (!student.isActive) {
    return res.status(403).json({ success: false, message: 'Student registration is deactivated.' });
  }

  const targetSession = activeSession;
  if (!targetSession || targetSession.id !== sessionId || !targetSession.isActive ||
    Date.now() > new Date(targetSession.endTime).getTime()) {
    return res.status(400).json({ success: false, message: 'Attendance session is closed or inactive.' });
  }

  if (!student.enrolledCourseIds.includes(targetSession.courseId)) {
    return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });
  }

  // Atomic duplicate verification
  const duplicate = attendanceRecords.find(
    (r) => r.sessionId === targetSession.id && r.studentReference === cleanId
  );

  if (duplicate) {
    return res.status(409).json({
      success: false,
      message: 'Attendance has already been recorded for this session.',
      existingRecord: duplicate,
    });
  }

  // Calculate distance
  const demoSimulation = !isProduction && !locationConfig.strictGpsMode && simulateCampusVenue === true;
  const hasValidCoordinates = Number.isFinite(deviceCoordinates?.latitude) &&
    Number.isFinite(deviceCoordinates?.longitude) && Number.isFinite(deviceCoordinates?.accuracy) &&
    deviceCoordinates.latitude >= -90 && deviceCoordinates.latitude <= 90 &&
    deviceCoordinates.longitude >= -180 && deviceCoordinates.longitude <= 180 && deviceCoordinates.accuracy >= 0;
  if (!demoSimulation && !hasValidCoordinates) {
    return res.status(400).json({ success: false, message: 'A valid device location is required.' });
  }

  const userLat = demoSimulation ? targetSession.targetLatitude : deviceCoordinates.latitude;
  const userLng = demoSimulation ? targetSession.targetLongitude : deviceCoordinates.longitude;
  const distance = calculateHaversineDistance(
    userLat,
    userLng,
    targetSession.targetLatitude,
    targetSession.targetLongitude
  );

  // Check geofence unless simulated or overridden
  if ((isProduction || locationConfig.strictGpsMode || !demoSimulation) && distance > targetSession.permittedRadiusMeters) {
    return res.status(403).json({
      success: false,
      message: `Attendance rejected: Location is outside classroom perimeter (${distance}m away).`,
    });
  }

  const { timeFormatted, dateFormatted, isoString } = getFormattedDateTime();
  const referenceCode = generateAttendanceReference(university.shortName);

  const newRecord: AttendanceRecord = {
    id: `rec-${Date.now()}`,
    sessionId: targetSession.id,
    studentId: student.id,
    studentReference: student.studentId,
    studentName: student.fullName,
    programme: student.programme,
    department: student.department,
    courseCode: targetSession.courseCode,
    courseName: targetSession.courseName,
    timestamp: isoString,
    timeFormatted,
    dateFormatted,
    status: 'PRESENT',
    verificationMethod: 'GPS_FACE',
    gpsAccuracyMeters: demoSimulation ? 13 : deviceCoordinates.accuracy,
    distanceFromVenueMeters: distance,
    deviceLatitude: userLat,
    deviceLongitude: userLng,
    selfieDataUrl: selfieImage || undefined,
    attendanceReference: referenceCode,
  };

  // Save to database
  attendanceRecords.unshift(newRecord);

  // Increment session count
  targetSession.presentCount = attendanceRecords.filter(
    (r) => r.sessionId === targetSession.id && ['PRESENT', 'LATE'].includes(r.status)
  ).length;

  // Add audit log
  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: isoString,
    userId: student.studentId,
    userName: student.fullName,
    role: 'SYSTEM',
    action: 'ATTENDANCE_RECORDED',
    details: `Signed into ${targetSession.courseCode} (${targetSession.classroomName}). Ref: ${referenceCode}.`,
    ipAddress: req.ip,
  });

  saveState();

  res.status(201).json({
    success: true,
    message: 'Attendance recorded successfully!',
    record: newRecord,
  });
});

// Lecturer / Admin: Get All Attendance Records
app.get('/api/attendance/records', (req: Request, res: Response) => {
  const { sessionId, studentId, courseCode } = req.query;

  let filtered = [...attendanceRecords];

  if (sessionId && typeof sessionId === 'string') {
    filtered = filtered.filter((r) => r.sessionId === sessionId);
  }

  if (studentId && typeof studentId === 'string') {
    filtered = filtered.filter((r) => r.studentReference.includes(studentId));
  }

  if (courseCode && typeof courseCode === 'string') {
    filtered = filtered.filter((r) => r.courseCode.toLowerCase() === courseCode.toLowerCase());
  }

  const recordsWithoutSelfies = filtered.map(({ selfieDataUrl: _selfie, ...record }) => record);

  res.json({
    success: true,
    count: recordsWithoutSelfies.length,
    records: recordsWithoutSelfies,
  });
});

// Admin Metrics & Dashboard Analytics
app.get('/api/admin/metrics', (_req: Request, res: Response) => {
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.isActive).length;
  const totalLecturers = lecturers.length;
  const totalCourses = courses.length;

  const currentSessionRecords = activeSession
    ? attendanceRecords.filter(
        (r) => r.sessionId === activeSession?.id && ['PRESENT', 'LATE'].includes(r.status)
      )
    : [];

  const enrolledInCurrentSession = activeSession ? activeSession.totalEnrolled : 0;
  const presentCount = currentSessionRecords.length;
  const absentCount = Math.max(0, enrolledInCurrentSession - presentCount);
  const attendanceRate = enrolledInCurrentSession > 0
    ? Math.round((presentCount / enrolledInCurrentSession) * 100)
    : 0;

  // Department breakdown
  const departmentStats = departments.map((dept) => {
    const deptStudents = students.filter((s) => s.department === dept.name);
    const deptRecords = attendanceRecords.filter((r) => r.department === dept.name);
    return {
      name: dept.name,
      code: dept.code,
      studentCount: deptStudents.length,
      attendanceCount: deptRecords.length,
    };
  });

  res.json({
    success: true,
    metrics: {
      totalStudents,
      activeStudents,
      totalLecturers,
      totalCourses,
      todayTotalAttendance: attendanceRecords.length,
      currentSession: {
        enrolled: enrolledInCurrentSession,
        present: presentCount,
        absent: absentCount,
        rate: attendanceRate,
      },
      departmentStats,
    },
    activeSession,
    recentLogs: auditLogs.slice(0, 10),
  });
});

// Admin / Lecturer: Toggle or Start New Session
app.post('/api/sessions/create', (req: Request, res: Response) => {
  const {
    courseId,
    classroomId,
    durationMinutes = 90,
    permittedRadius = 150,
  } = req.body;

  if (activeSession?.isActive) {
    return res.status(409).json({ success: false, message: 'Close the active session before starting another.' });
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480 ||
    !Number.isFinite(permittedRadius) || permittedRadius < 10 || permittedRadius > 2000) {
    return res.status(400).json({ success: false, message: 'Session duration or geofence radius is invalid.' });
  }

  const course = courses.find((c) => c.id === courseId);
  const classroom = classrooms.find((c) => c.id === classroomId);
  if (!course || !classroom) {
    return res.status(400).json({ success: false, message: 'Select a valid course and classroom.' });
  }
  const lecturer = lecturers.find((l) => l.id === course.lecturerId) || lecturers[0];

  const now = new Date();
  const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const enrolledCount = students.filter((s) => s.enrolledCourseIds.includes(course.id)).length;

  activeSession = {
    id: `sess-${Date.now()}`,
    universityId: university.id,
    courseId: course.id,
    courseCode: course.code,
    courseName: course.name,
    lecturerId: lecturer.id,
    lecturerName: `${lecturer.title} ${lecturer.fullName}`,
    classroomId: classroom.id,
    classroomName: classroom.name,
    startTime: now.toISOString(),
    endTime: endTime.toISOString(),
    isActive: true,
    targetLatitude: classroom.latitude,
    targetLongitude: classroom.longitude,
    permittedRadiusMeters: permittedRadius,
    sessionCode: `${university.shortName}-${course.code.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`,
    totalEnrolled: Math.max(enrolledCount, 5),
    presentCount: 0,
  };

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: now.toISOString(),
    userId: lecturer.id,
    userName: lecturer.fullName,
    role: 'LECTURER',
    action: 'SESSION_CREATED',
    details: `Started session for ${course.code} in ${classroom.name}. Radius: ${permittedRadius}m.`,
  });

  saveState();

  res.json({ success: true, session: activeSession });
});

// Admin / Lecturer: Close Active Session
app.post('/api/sessions/close', (_req: Request, res: Response) => {
  if (activeSession) {
    activeSession.isActive = false;
    auditLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: 'admin-01',
      userName: 'Administrator',
      role: 'ADMIN',
      action: 'SESSION_CLOSED',
      details: `Closed session ${activeSession.sessionCode} (${activeSession.courseCode}).`,
    });
  }

  saveState();

  res.json({ success: true, message: 'Session closed successfully.', session: activeSession });
});

// Admin: Update Geofence Configuration
app.put('/api/admin/locations', (req: Request, res: Response) => {
  const { defaultLatitude, defaultLongitude, defaultRadiusMeters, strictGpsMode, venueName } = req.body;

  if ((defaultLatitude !== undefined && (!Number.isFinite(defaultLatitude) || defaultLatitude < -90 || defaultLatitude > 90)) ||
    (defaultLongitude !== undefined && (!Number.isFinite(defaultLongitude) || defaultLongitude < -180 || defaultLongitude > 180)) ||
    (defaultRadiusMeters !== undefined && (!Number.isFinite(defaultRadiusMeters) || defaultRadiusMeters < 10 || defaultRadiusMeters > 2000)) ||
    (strictGpsMode !== undefined && typeof strictGpsMode !== 'boolean') ||
    (venueName !== undefined && (typeof venueName !== 'string' || venueName.trim().length === 0 || venueName.length > 120))) {
    return res.status(400).json({ success: false, message: 'Invalid geofence configuration.' });
  }

  if (typeof defaultLatitude === 'number') locationConfig.defaultLatitude = defaultLatitude;
  if (typeof defaultLongitude === 'number') locationConfig.defaultLongitude = defaultLongitude;
  if (typeof defaultRadiusMeters === 'number') locationConfig.defaultRadiusMeters = defaultRadiusMeters;
  if (typeof strictGpsMode === 'boolean') locationConfig.strictGpsMode = strictGpsMode;
  if (venueName) locationConfig.venueName = venueName;

  if (activeSession) {
    activeSession.targetLatitude = locationConfig.defaultLatitude;
    activeSession.targetLongitude = locationConfig.defaultLongitude;
    activeSession.permittedRadiusMeters = locationConfig.defaultRadiusMeters;
  }

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'admin-01',
    userName: 'System Administrator',
    role: 'ADMIN',
    action: 'GEOFENCE_UPDATED',
    details: `Updated campus location to [${locationConfig.defaultLatitude}, ${locationConfig.defaultLongitude}], radius ${locationConfig.defaultRadiusMeters}m, strict mode: ${locationConfig.strictGpsMode}.`,
  });

  saveState();

  res.json({ success: true, locationConfig });
});

// Admin / Lecturer: Manual Override of Attendance Record
app.put('/api/admin/attendance/:id/override', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes, updatedBy } = req.body;

  const recordIndex = attendanceRecords.findIndex((r) => r.id === id);
  if (recordIndex === -1) {
    return res.status(404).json({ success: false, message: 'Attendance record not found.' });
  }

  if (!['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'].includes(status) ||
    (notes !== undefined && (typeof notes !== 'string' || notes.length > 500))) {
    return res.status(400).json({ success: false, message: 'Invalid attendance status or override notes.' });
  }

  const prevStatus = attendanceRecords[recordIndex].status;
  attendanceRecords[recordIndex].status = status || prevStatus;
  attendanceRecords[recordIndex].verificationMethod = 'MANUAL_OVERRIDE';
  attendanceRecords[recordIndex].overrideNotes = notes;
  attendanceRecords[recordIndex].overriddenBy = updatedBy || 'Lecturer / Admin';
  if (activeSession) {
    activeSession.presentCount = attendanceRecords.filter(
      (record) => record.sessionId === activeSession?.id && ['PRESENT', 'LATE'].includes(record.status)
    ).length;
  }

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: updatedBy || 'staff-01',
    userName: updatedBy || 'Staff Reviewer',
    role: 'LECTURER',
    action: 'ATTENDANCE_OVERRIDE',
    details: `Modified status for ${attendanceRecords[recordIndex].studentName} (${attendanceRecords[recordIndex].studentReference}) from ${prevStatus} to ${status}. Reason: ${notes || 'Not specified'}.`,
  });

  saveState();

  res.json({ success: true, record: attendanceRecords[recordIndex] });
});

// Admin: Add or Edit Student
app.post('/api/admin/students', (req: Request, res: Response) => {
  const { studentId, fullName, programme, department, academicYear, email, isActive } = req.body;

  if (typeof studentId !== 'string' || !/^\d{8}$/.test(studentId.trim()) ||
    typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 120) {
    return res.status(400).json({ success: false, message: 'Student ID and Full Name are required.' });
  }

  const existingIdx = students.findIndex((s) => s.studentId === studentId.trim());

  if (existingIdx >= 0) {
    // Update
    students[existingIdx] = {
      ...students[existingIdx],
      fullName: fullName.trim(),
      programme: programme || students[existingIdx].programme,
      department: department || students[existingIdx].department,
      academicYear: academicYear || students[existingIdx].academicYear,
      email: email || students[existingIdx].email,
      isActive: typeof isActive === 'boolean' ? isActive : students[existingIdx].isActive,
    };
    saveState();
    return res.json({ success: true, student: students[existingIdx], updated: true });
  }

  // Create
  const newStudent: Student = {
    id: `stud-${Date.now()}`,
    universityId: university.id,
    studentId: studentId.trim(),
    fullName: fullName.trim(),
    programme: programme || 'BA. COMMUNICATION DESIGN',
    department: department || 'Department of Communication Design',
    academicYear: academicYear || 'Year 1',
    email: email || `${studentId}@st.knust.edu.gh`,
    isActive: true,
    enrolledCourseIds: ['course-des401'],
  };

  students.push(newStudent);

  auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'admin-01',
    userName: 'Registrar Admin',
    role: 'ADMIN',
    action: 'STUDENT_ENROLLED',
    details: `Added new student record: ${fullName} (ID: ${studentId}).`,
  });

  saveState();

  res.status(201).json({ success: true, student: newStudent, created: true });
});

// Admin: List Students
app.get('/api/admin/students', (_req: Request, res: Response) => {
  res.json({ success: true, students });
});

// Admin: List Lecturers & Courses
app.get('/api/admin/academic-catalog', (_req: Request, res: Response) => {
  res.json({
    success: true,
    lecturers,
    courses,
    departments,
    classrooms,
  });
});

// Reset Demo Data
app.post('/api/admin/reset-demo', (_req: Request, res: Response) => {
  students = structuredClone(initialStudents);
  activeSession = structuredClone(initialActiveSession);
  attendanceRecords = structuredClone(initialAttendanceRecords);
  locationConfig = structuredClone(initialLocationConfig);
  auditLogs = structuredClone(initialAuditLogs);
  saveState();

  res.json({ success: true, message: 'Demo data reset to initial state.' });
});

// Vite Middleware Integration for Development / Production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Smart Attendance Server] Running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('[Smart Attendance Server] Failed to start:', err);
  process.exit(1);
});
