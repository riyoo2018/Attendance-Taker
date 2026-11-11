/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  University,
  AttendanceSession,
  AttendanceRecord,
  Student,
  Lecturer,
  Course,
  Department,
  CampusLocationConfig,
  AuditLog,
} from './types/attendance.ts';
import {
  initialUniversity,
  initialStudents,
  initialLecturers,
  initialCourses,
  initialDepartments,
  initialLocationConfig,
  initialActiveSession,
  initialAttendanceRecords,
  initialAuditLogs,
} from './data/mockDatabase.ts';
import { TopNavbar } from './components/Common/TopNavbar.tsx';
import { StudentAttendanceFlow } from './components/Student/StudentAttendanceFlow.tsx';
import { LecturerDashboard } from './components/Lecturer/LecturerDashboard.tsx';
import { AdminDashboard } from './components/Admin/AdminDashboard.tsx';
export default function App() {
  const [currentView, setCurrentView] = useState<'student' | 'lecturer' | 'admin'>('student');

  // Application Data States
  const [university, setUniversity] = useState<University>(initialUniversity);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(initialActiveSession);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [studentsLoaded, setStudentsLoaded] = useState<boolean>(false);
  const [lecturers, setLecturers] = useState<Lecturer[]>(initialLecturers);
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [locationConfig, setLocationConfig] = useState<CampusLocationConfig>(initialLocationConfig);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialAttendanceRecords);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);

  // Fetch live state from backend on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [univRes, sessRes, recRes, adminRes, studentsRes, catalogRes] = await Promise.all([
        fetch('/api/university'),
        fetch('/api/session/active'),
        fetch('/api/attendance/records'),
        fetch('/api/admin/metrics'),
        fetch('/api/admin/students'),
        fetch('/api/admin/academic-catalog'),
      ]);

      if (univRes.ok) {
        const d = await univRes.json();
        if (d.university) setUniversity(d.university);
        if (d.locationConfig) setLocationConfig(d.locationConfig);
      }

      if (sessRes.ok) {
        const d = await sessRes.json();
        setActiveSession(d.session ?? null);
      } else if (sessRes.status === 404) {
        setActiveSession(null);
      }

      if (recRes.ok) {
        const d = await recRes.json();
        if (d.records) setAttendanceRecords(d.records);
      }

      if (adminRes.ok) {
        const d = await adminRes.json();
        if (d.recentLogs) setAuditLogs(d.recentLogs);
      }

      if (studentsRes.ok) {
        const d = await studentsRes.json();
        if (Array.isArray(d.students)) setStudents(d.students);
      }

      if (catalogRes.ok) {
        const d = await catalogRes.json();
        if (Array.isArray(d.lecturers)) setLecturers(d.lecturers);
        if (Array.isArray(d.courses)) setCourses(d.courses);
        if (Array.isArray(d.departments)) setDepartments(d.departments);
      }
    } catch (err) {
      console.warn('API sync fallback to local state:', err);
    }
    setStudentsLoaded(true);
  };

  // Callback when a student records attendance
  const handleAttendanceCompleted = (newRecord: AttendanceRecord) => {
    setAttendanceRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);
    if (activeSession) {
      setActiveSession((prev) => (prev ? { ...prev, presentCount: prev.presentCount + 1 } : null));
    }
    // Add audit log entry
    setAuditLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: newRecord.studentReference,
        userName: newRecord.studentName,
        role: 'SYSTEM',
        action: 'ATTENDANCE_RECORDED',
        details: `Successfully signed attendance for ${newRecord.courseCode}.`,
      },
      ...prev,
    ]);
  };

  // Callback when lecturer updates status
  const handleRecordOverridden = (updatedRecord: AttendanceRecord) => {
    const updatedRecords = attendanceRecords.map((record) =>
      record.id === updatedRecord.id ? updatedRecord : record
    );
    setAttendanceRecords(updatedRecords);
    if (activeSession) {
      setActiveSession({
        ...activeSession,
        presentCount: updatedRecords.filter(
          (record) => record.sessionId === activeSession.id && ['PRESENT', 'LATE'].includes(record.status)
        ).length,
      });
    }
  };

  // Reset demo data
  const handleResetDemoData = async () => {
    try {
      await fetch('/api/admin/reset-demo', { method: 'POST' });
    } catch (e) {
      console.warn(e);
    }
    setStudents([...initialStudents]);
    setActiveSession({ ...initialActiveSession });
    setAttendanceRecords([...initialAttendanceRecords]);
    setLocationConfig({ ...initialLocationConfig });
    setAuditLogs([...initialAuditLogs]);
  };

  return (
    <div className="app-shell min-h-screen flex flex-col font-sans">
      {/* ---------------- TOP NAVBAR ---------------- */}
      <TopNavbar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
      />

      {/* ---------------- MAIN VIEW CONTAINER ---------------- */}
      <main className={currentView === 'student'
        ? 'w-full flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:mx-auto md:max-w-7xl md:px-8 md:py-8 md:pb-8'
        : 'mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8'}>
        {/* VIEW 1: STUDENT ATTENDANCE WORKFLOW */}
        {currentView === 'student' && (
          <StudentAttendanceFlow
            university={university}
            activeSession={activeSession}
            students={studentsLoaded ? students : []}
            attendanceRecords={attendanceRecords}
            onAttendanceCompleted={handleAttendanceCompleted}
            onSwitchToLecturer={() => setCurrentView('lecturer')}
          />
        )}

        {/* VIEW 2: LECTURER & LIVE PROJECTOR MODE */}
        {currentView === 'lecturer' && (
          <LecturerDashboard
            university={university}
            activeSession={activeSession}
            attendanceRecords={attendanceRecords}
            allStudents={students}
            onSessionUpdated={(sess) => setActiveSession(sess)}
            onRecordOverridden={handleRecordOverridden}
            onOpenStudentView={(id) => {
              setCurrentView('student');
            }}
          />
        )}

        {/* VIEW 3: ADMINISTRATOR CONTROL CONSOLE */}
        {currentView === 'admin' && (
          <AdminDashboard
            university={university}
            students={students}
            lecturers={lecturers}
            courses={courses}
            departments={departments}
            locationConfig={locationConfig}
            attendanceRecords={attendanceRecords}
            auditLogs={auditLogs}
            onStudentUpdated={(updatedStudent) => {
              setStudents((prev) => {
                const idx = prev.findIndex((s) => s.studentId === updatedStudent.studentId);
                if (idx >= 0) {
                  const arr = [...prev];
                  arr[idx] = updatedStudent;
                  return arr;
                }
                return [...prev, updatedStudent];
              });
            }}
            onLocationUpdated={(newConfig) => {
              setLocationConfig(newConfig);
              if (activeSession) {
                setActiveSession((prev) =>
                  prev
                    ? {
                        ...prev,
                        targetLatitude: newConfig.defaultLatitude,
                        targetLongitude: newConfig.defaultLongitude,
                        permittedRadiusMeters: newConfig.defaultRadiusMeters,
                      }
                    : null
                );
              }
            }}
            onResetDemoData={handleResetDemoData}
          />
        )}
      </main>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="mt-auto hidden border-t border-slate-200 bg-white py-4 text-xs text-slate-500 md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">{university.name}</span>
            <span>·</span>
            <span>{university.collegeName}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Powered by Automated GPS Geofencing, MediaDevices Face Capture, and Registrar Auditing.
          </p>
        </div>
      </footer>
    </div>
  );
}
