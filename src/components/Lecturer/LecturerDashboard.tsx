/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  AttendanceSession,
  AttendanceRecord,
  Lecturer,
  Course,
  Student,
  University,
} from '../../types/attendance.ts';
import {
  Projector,
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  PlusCircle,
  AlertCircle,
  QrCode,
  Shield,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LecturerDashboardProps {
  university: University;
  activeSession: AttendanceSession | null;
  attendanceRecords: AttendanceRecord[];
  allStudents: Student[];
  onSessionUpdated: (session: AttendanceSession | null) => void;
  onRecordOverridden: (record: AttendanceRecord) => void;
  onOpenStudentView: (id?: string) => void;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({
  university,
  activeSession,
  attendanceRecords,
  allStudents,
  onSessionUpdated,
  onRecordOverridden,
  onOpenStudentView,
}) => {
  // Lecturer State
  const [currentLecturer, setCurrentLecturer] = useState<Lecturer>({
    id: 'lec-01',
    universityId: 'univ-knust-01',
    staffId: 'STF-0882',
    fullName: 'Dr. Kwame Boateng',
    title: 'Dr.',
    email: 'k.boateng@knust.edu.gh',
    department: 'Department of Communication Design',
    assignedCourseIds: ['course-des401', 'course-des202'],
  });

  // Projector Fullscreen Mode
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // New Session Modal State
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('course-des401');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('room-cabe-lt1');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(90);
  const [sessionRadiusMeters, setSessionRadiusMeters] = useState<number>(150);

  // Manual Override Modal
  const [overrideStudent, setOverrideStudent] = useState<{
    recordId?: string;
    student: Student;
    currentStatus: AttendanceRecord['status'] | 'ABSENT';
  } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceRecord['status']>('PRESENT');
  const [overrideReason, setOverrideReason] = useState<string>('Medical notice provided to lecturer');

  // Generate QR code whenever activeSession changes
  useEffect(() => {
    if (activeSession) {
      const studentUrl = `${window.location.origin}?session=${activeSession.id}&course=${activeSession.courseCode}`;
      QRCode.toDataURL(studentUrl, {
        width: 380,
        margin: 2,
        color: {
          dark: '#044e29',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((e) => console.error('Failed to generate projector QR code:', e));
    }
  }, [activeSession]);

  // Enrolled students for active session's course
  const enrolledStudents = allStudents.filter(
    (s) => activeSession && s.enrolledCourseIds.includes(activeSession.courseId)
  );

  // Filter attendance records for current session
  const sessionRecords = attendanceRecords.filter((r) => r.sessionId === activeSession?.id);
  const presentStudentIds = new Set(sessionRecords.map((r) => r.studentReference));

  // Export Attendance CSV
  const handleExportCSV = () => {
    if (!activeSession) return;
    const rows = [
      ['Student ID', 'Full Name', 'Programme', 'Status', 'Timestamp', 'Verification Reference', 'GPS Distance'],
    ];

    enrolledStudents.forEach((student) => {
      const record = sessionRecords.find((r) => r.studentReference === student.studentId);
      rows.push([
        student.studentId,
        student.fullName,
        student.programme,
        record ? record.status : 'ABSENT',
        record ? record.timeFormatted : 'N/A',
        record ? record.attendanceReference : 'N/A',
        record ? `${record.distanceFromVenueMeters}m` : 'N/A',
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${activeSession.courseCode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create new session via API
  const handleCreateSession = async () => {
    try {
      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          classroomId: selectedClassroomId,
          durationMinutes: sessionDurationMinutes,
          permittedRadius: sessionRadiusMeters,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSessionUpdated(data.session);
        setShowNewSessionModal(false);
      }
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  // Close Session
  const handleCloseSession = async () => {
    try {
      const res = await fetch('/api/sessions/close', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        onSessionUpdated(data.session);
      }
    } catch (e) {
      console.error('Failed to close session:', e);
    }
  };

  // Submit manual override
  const handleSaveOverride = async () => {
    if (!overrideStudent) return;

    if (overrideStudent.recordId) {
      // Update existing record
      try {
        const res = await fetch(`/api/admin/attendance/${overrideStudent.recordId}/override`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: overrideStatus,
            notes: overrideReason,
            updatedBy: `${currentLecturer.title} ${currentLecturer.fullName}`,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onRecordOverridden(data.record);
          setOverrideStudent(null);
        }
      } catch (e) {
        console.error('Override error:', e);
      }
    } else {
      // Create a record, then apply the lecturer-selected status and audit details.
      try {
        const res = await fetch('/api/attendance/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: overrideStudent.student.studentId,
            sessionId: activeSession?.id,
            selfieImage: null,
            deviceCoordinates: {
              latitude: activeSession?.targetLatitude || 6.6745,
              longitude: activeSession?.targetLongitude || -1.5716,
              accuracy: 10,
            },
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const overrideRes = await fetch(`/api/admin/attendance/${data.record.id}/override`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: overrideStatus,
              notes: overrideReason,
              updatedBy: `${currentLecturer.title} ${currentLecturer.fullName}`,
            }),
          });
          const overrideData = await overrideRes.json();
          if (!overrideRes.ok || !overrideData.success) {
            throw new Error(overrideData.message || 'Could not apply the attendance override.');
          }
          onRecordOverridden(overrideData.record);
          setOverrideStudent(null);
        }
      } catch (e) {
        console.error('Override error:', e);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* ---------------- LECTURER HEADER BAR ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-900 text-white font-bold flex items-center justify-center text-lg shadow-xs">
            {currentLecturer.title}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{currentLecturer.fullName}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                {currentLecturer.staffId}
              </span>
            </div>
            <p className="text-xs text-slate-500">{currentLecturer.department}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsProjectorMode(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Projector className="w-4 h-4" />
            <span>Launch Projector Screen</span>
          </button>

          <button
            onClick={() => setShowNewSessionModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Session</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export Roster CSV</span>
          </button>
        </div>
      </div>

      {/* ---------------- ACTIVE SESSION STATUS CARD ---------------- */}
      {activeSession ? (
        <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-emerald-800 relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  LIVE ATTENDANCE SESSION ACTIVE
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-800/80 text-emerald-200">
                  {activeSession.sessionCode}
                </span>
              </div>
              <h3 className="text-2xl font-black tracking-tight text-white">
                {activeSession.courseCode}: {activeSession.courseName}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-100/90 pt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {activeSession.classroomName} (Radius: {activeSession.permittedRadiusMeters}m)
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Closing at{' '}
                  {new Date(activeSession.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Live Stats Pill */}
            <div className="flex items-center gap-5 bg-white/10 backdrop-blur-xs px-5 py-3.5 rounded-2xl border border-white/15">
              <div className="text-center">
                <span className="text-[11px] uppercase tracking-wider text-emerald-200 block">Present</span>
                <span className="text-3xl font-extrabold font-mono text-white">
                  {sessionRecords.length}
                </span>
              </div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div className="text-center">
                <span className="text-[11px] uppercase tracking-wider text-emerald-200 block">Enrolled</span>
                <span className="text-3xl font-extrabold font-mono text-white">
                  {enrolledStudents.length || activeSession.totalEnrolled}
                </span>
              </div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div className="text-center">
                <span className="text-[11px] uppercase tracking-wider text-emerald-200 block">Rate</span>
                <span className="text-3xl font-extrabold font-mono text-emerald-300">
                  {enrolledStudents.length > 0
                    ? Math.round((sessionRecords.length / enrolledStudents.length) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between pt-4 mt-4 border-t border-emerald-800/80 text-xs text-emerald-200">
            <span>Students scan the projector QR code or enter university reference ID on attendance.knust.edu.gh</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenStudentView('21009023')}
                className="underline hover:text-white font-medium flex items-center gap-1"
              >
                <span>Simulate Student Scan (Frederick 21009023)</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={handleCloseSession}
                className="px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 font-medium transition-colors"
              >
                Close Session
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="font-bold text-slate-900">No Active Attendance Session</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            You do not currently have an open attendance session for your students. Start a new session to display the QR
            code and enable GPS attendance capture.
          </p>
          <button
            onClick={() => setShowNewSessionModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Open Attendance Session</span>
          </button>
        </div>
      )}

      {/* ---------------- LIVE COURSE ATTENDANCE ROSTER ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">Course Attendance Roster</h3>
            <p className="text-xs text-slate-500">
              Real-time student status, verification reference codes, and manual lecturer overrides
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-800 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              Present: {sessionRecords.length}
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1 text-rose-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Absent: {Math.max(0, enrolledStudents.length - sessionRecords.length)}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Student ID</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Programme & Year</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Verification Ref</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrolledStudents.map((student) => {
                const record = sessionRecords.find((r) => r.studentReference === student.studentId);
                const isPresent = !!record;
                const status = record ? record.status : 'ABSENT';

                return (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{student.studentId}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        {record?.selfieDataUrl ? (
                          <img
                            src={record.selfieDataUrl}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-emerald-600 shadow-2xs"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                            {student.fullName.charAt(0)}
                          </div>
                        )}
                        <span>{student.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{student.programme}</div>
                      <div className="text-[11px] text-slate-400">{student.academicYear}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {status === 'PRESENT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          PRESENT
                        </span>
                      )}
                      {status === 'EXCUSED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                          EXCUSED
                        </span>
                      )}
                      {status === 'ABSENT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600">
                          ABSENT
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {record ? record.timeFormatted : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {record ? (
                        <span className="text-[11px] text-emerald-900 font-semibold">
                          {record.attendanceReference}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() =>
                          setOverrideStudent({
                            recordId: record?.id,
                            student,
                            currentStatus: status,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:text-emerald-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                      >
                        Override / Notes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- PROJECTOR SCREEN MODAL (MATCHES VIDEO) ---------------- */}
      {isProjectorMode && activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-6 md:p-10 overflow-y-auto">
          {/* Top Projector Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg">
                K
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                  {university.name}
                </h1>
                <p className="text-xs md:text-sm text-emerald-400 font-semibold uppercase tracking-wider">
                  {university.collegeName} · {activeSession.classroomName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                PROJECTOR MODE ACTIVE
              </span>
              <button
                onClick={() => setIsProjectorMode(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
              >
                Exit Projector View
              </button>
            </div>
          </div>

          {/* Central Stage: Big QR Code + Session Details */}
          <div className="my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto w-full">
            {/* Left 6 cols: Massive QR Code from video */}
            <div className="lg:col-span-6 flex flex-col items-center text-center">
              <div className="relative p-6 bg-white rounded-3xl shadow-2xl border-4 border-emerald-500">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Classroom Attendance QR Code"
                    className="w-72 h-72 md:w-88 md:h-88 object-contain"
                  />
                ) : (
                  <div className="w-72 h-72 flex items-center justify-center text-slate-400">
                    Generating high-resolution QR...
                  </div>
                )}

                {/* Center Badge on QR */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-14 h-14 rounded-2xl bg-[#044e29] border-2 border-white flex items-center justify-center text-white font-black text-xl shadow-md">
                    K
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <p className="text-base md:text-lg font-extrabold text-white">
                  Point your phone camera to sign attendance
                </p>
                <p className="text-xs text-slate-400">
                  Or open browser to <span className="text-emerald-400 font-mono font-bold">attendance.knust.edu.gh</span>
                </p>
              </div>
            </div>

            {/* Right 6 cols: Live Check-in Feed */}
            <div className="lg:col-span-6 space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Course Title</span>
                  <h2 className="text-xl md:text-2xl font-black text-white">
                    {activeSession.courseCode}: {activeSession.courseName}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Lecturer: {activeSession.lecturerName}</p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-800/80 p-3 rounded-2xl">
                    <span className="text-[11px] text-slate-400 block uppercase">Present</span>
                    <span className="text-3xl font-mono font-extrabold text-emerald-400">
                      {sessionRecords.length}
                    </span>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-2xl">
                    <span className="text-[11px] text-slate-400 block uppercase">Enrolled</span>
                    <span className="text-3xl font-mono font-extrabold text-white">
                      {enrolledStudents.length || activeSession.totalEnrolled}
                    </span>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-2xl">
                    <span className="text-[11px] text-slate-400 block uppercase">Turnout</span>
                    <span className="text-3xl font-mono font-extrabold text-emerald-300">
                      {enrolledStudents.length > 0
                        ? Math.round((sessionRecords.length / enrolledStudents.length) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>

                {/* Live Real-time Attendance Stream */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Recent Live Check-Ins</span>
                    <span className="text-[11px] text-emerald-400 font-mono">Live ticker</span>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {sessionRecords.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">Waiting for first student to submit...</p>
                    ) : (
                      sessionRecords.slice(0, 6).map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between p-2.5 bg-slate-800/90 rounded-xl text-xs border border-slate-700/60"
                        >
                          <div className="flex items-center gap-2">
                            {rec.selfieDataUrl ? (
                              <img
                                src={rec.selfieDataUrl}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover border border-emerald-400"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-emerald-800 text-white text-[10px] font-bold flex items-center justify-center">
                                ✓
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-white block">{rec.studentName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{rec.studentReference}</span>
                            </div>
                          </div>
                          <span className="font-mono text-emerald-400 font-semibold">{rec.timeFormatted}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Security Geofence Badge */}
              <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-200">
                <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
                <p>
                  Geofence enforcement active: Students must be physically located within{' '}
                  <strong className="text-white">{activeSession.permittedRadiusMeters}m</strong> of{' '}
                  <strong className="text-white">{activeSession.classroomName}</strong>. Biometric selfie verification
                  required.
                </p>
              </div>
            </div>
          </div>

          {/* Projector Footer */}
          <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-500">
            <span>KNUST CABE Smart University Attendance Engine</span>
            <span>Session Code: {activeSession.sessionCode}</span>
          </div>
        </div>
      )}

      {/* ---------------- NEW SESSION MODAL ---------------- */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-900">Start New Attendance Session</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:outline-none focus:border-emerald-700"
                >
                  <option value="course-des401">DES 401: Advanced Digital Media & UX</option>
                  <option value="course-des202">DES 202: Typography and Information Design</option>
                  <option value="course-arch301">ARCH 301: Architectural Design Studio V</option>
                  <option value="course-cs410">CS 410: Distributed Systems & Security</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Classroom / Venue</label>
                <select
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:outline-none focus:border-emerald-700"
                >
                  <option value="room-cabe-lt1">CABE Lecture Theatre 1 (Main Block)</option>
                  <option value="room-arch-st3">Architecture Studio 3B (Built Env Complex)</option>
                  <option value="room-cs-lab2">Computational Software Lab 2</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={sessionDurationMinutes}
                    onChange={(e) => setSessionDurationMinutes(parseInt(e.target.value, 10) || 60)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">GPS Radius (Meters)</label>
                  <input
                    type="number"
                    value={sessionRadiusMeters}
                    onChange={(e) => setSessionRadiusMeters(parseInt(e.target.value, 10) || 100)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowNewSessionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs"
              >
                Launch Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MANUAL OVERRIDE MODAL ---------------- */}
      {overrideStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-900">Attendance Status Override</h3>
            <p className="text-xs text-slate-500">
              Modifying record for <strong>{overrideStudent.student.fullName}</strong> ({overrideStudent.student.studentId}).
              This action will be stamped into the compliance audit log.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PRESENT', 'EXCUSED', 'ABSENT'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOverrideStatus(st)}
                      className={`py-2 rounded-xl font-bold text-xs border transition-colors ${
                        overrideStatus === st
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason for Adjustment</label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Device battery died, student presented medical permit..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setOverrideStudent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs"
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
