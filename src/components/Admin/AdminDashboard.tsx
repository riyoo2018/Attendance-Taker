/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Student,
  Lecturer,
  Course,
  Department,
  CampusLocationConfig,
  AttendanceRecord,
  AuditLog,
  University,
} from '../../types/attendance.ts';
import {
  Users,
  GraduationCap,
  CalendarCheck,
  Percent,
  Search,
  PlusCircle,
  MapPin,
  ShieldAlert,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Sliders,
  History,
  Building,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface AdminDashboardProps {
  university: University;
  students: Student[];
  lecturers: Lecturer[];
  courses: Course[];
  departments: Department[];
  locationConfig: CampusLocationConfig;
  attendanceRecords: AttendanceRecord[];
  auditLogs: AuditLog[];
  onStudentUpdated: (student: Student) => void;
  onLocationUpdated: (config: CampusLocationConfig) => void;
  onResetDemoData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  university,
  students,
  lecturers,
  courses,
  departments,
  locationConfig,
  attendanceRecords,
  auditLogs,
  onStudentUpdated,
  onLocationUpdated,
  onResetDemoData,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'geofence' | 'reports' | 'audit'>('overview');

  // Search & Filter State for Students
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // New Student Modal State
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentDept, setNewStudentDept] = useState<string>('Department of Communication Design');
  const [newStudentProgramme, setNewStudentProgramme] = useState<string>('BA. COMMUNICATION DESIGN');
  const [newStudentYear, setNewStudentYear] = useState<string>('Year 1');

  // Geofence Form State
  const [geoLat, setGeoLat] = useState<number>(locationConfig.defaultLatitude);
  const [geoLng, setGeoLng] = useState<number>(locationConfig.defaultLongitude);
  const [geoRadius, setGeoRadius] = useState<number>(locationConfig.defaultRadiusMeters);
  const [geoStrict, setGeoStrict] = useState<boolean>(locationConfig.strictGpsMode);
  const [geoSavedSuccess, setGeoSavedSuccess] = useState<boolean>(false);

  // Sync Geofence fields if locationConfig prop changes
  useEffect(() => {
    setGeoLat(locationConfig.defaultLatitude);
    setGeoLng(locationConfig.defaultLongitude);
    setGeoRadius(locationConfig.defaultRadiusMeters);
    setGeoStrict(locationConfig.strictGpsMode);
  }, [locationConfig]);

  // KPIs
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.isActive).length;
  const totalLecturersCount = lecturers.length;
  const todayRecordsCount = attendanceRecords.length;
  const attendancePercentage = totalStudents > 0 ? Math.round((todayRecordsCount / totalStudents) * 100) : 0;

  // Filtered Students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.studentId.includes(studentSearchQuery) ||
      s.fullName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      s.programme.toLowerCase().includes(studentSearchQuery.toLowerCase());
    const matchesDept = selectedDeptFilter === 'ALL' || s.department === selectedDeptFilter;
    return matchesSearch && matchesDept;
  });

  // Save new student via API
  const handleSaveStudent = async () => {
    if (!newStudentId || !newStudentName) return;

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: newStudentId,
          fullName: newStudentName,
          department: newStudentDept,
          programme: newStudentProgramme,
          academicYear: newStudentYear,
          email: `${newStudentId}@st.knust.edu.gh`,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onStudentUpdated(data.student);
        setShowAddStudentModal(false);
        setNewStudentId('');
        setNewStudentName('');
      }
    } catch (e) {
      console.error('Failed to create student:', e);
    }
  };

  // Toggle Student active/inactive
  const handleToggleStudentActive = async (student: Student) => {
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          fullName: student.fullName,
          isActive: !student.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onStudentUpdated(data.student);
      }
    } catch (e) {
      console.error('Failed to toggle student:', e);
    }
  };

  // Save Geofence via API
  const handleSaveGeofence = async () => {
    try {
      const res = await fetch('/api/admin/locations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultLatitude: geoLat,
          defaultLongitude: geoLng,
          defaultRadiusMeters: geoRadius,
          strictGpsMode: geoStrict,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLocationUpdated(data.locationConfig);
        setGeoSavedSuccess(true);
        setTimeout(() => setGeoSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save geofence:', e);
    }
  };

  // Export Comprehensive Audit & Attendance CSV
  const handleExportFullReport = () => {
    const rows = [
      ['Timestamp', 'Reference Code', 'Student ID', 'Student Name', 'Programme', 'Course Code', 'Status', 'GPS Accuracy', 'Distance From Venue'],
    ];

    attendanceRecords.forEach((r) => {
      rows.push([
        r.timestamp,
        r.attendanceReference,
        r.studentReference,
        r.studentName,
        r.programme,
        r.courseCode,
        r.status,
        `±${r.gpsAccuracyMeters}m`,
        `${r.distanceFromVenueMeters}m`,
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KNUST_Full_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ---------------- ADMIN HEADER & TABS ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">University Attendance Control Center</h2>
          <p className="text-xs text-slate-500">
            {university.name} · {university.collegeName} ({university.code})
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${
              activeTab === 'overview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${
              activeTab === 'students' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Students ({students.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('geofence')}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${
              activeTab === 'geofence' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Geofence & GPS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${
              activeTab === 'reports' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${
              activeTab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Trail
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Students</span>
                <Users className="w-4 h-4 text-emerald-700" />
              </div>
              <span className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900">{totalStudents}</span>
              <span className="text-[11px] text-emerald-800 font-semibold block mt-1">
                {activeStudents} Active Accounts
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lecturers</span>
                <GraduationCap className="w-4 h-4 text-emerald-700" />
              </div>
              <span className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900">
                {totalLecturersCount}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Across 4 Departments</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today Verified</span>
                <CalendarCheck className="w-4 h-4 text-emerald-700" />
              </div>
              <span className="text-2xl lg:text-3xl font-extrabold font-mono text-emerald-800">
                {todayRecordsCount}
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold block mt-1">GPS check & selfie capture</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attendance Rate</span>
                <Percent className="w-4 h-4 text-emerald-700" />
              </div>
              <span className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900">
                {attendancePercentage}%
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Overall University Average</span>
            </div>
          </div>

          {/* Department Breakdown & Attendance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-slate-900">Department Attendance Performance</h3>
              <div className="space-y-4 pt-2">
                {departments.map((dept) => {
                  const deptStudents = students.filter((s) => s.department === dept.name);
                  const deptAttendance = attendanceRecords.filter((r) => r.department === dept.name);
                  const rate = deptStudents.length > 0 ? Math.min(100, Math.round((deptAttendance.length / deptStudents.length) * 100)) : 0;

                  return (
                    <div key={dept.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{dept.name}</span>
                        <span className="font-mono font-semibold text-slate-600">
                          {deptAttendance.length} / {deptStudents.length} present ({rate}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-700 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(8, rate)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions & Geofence Status */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-slate-900">Security & Quick Actions</h3>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Campus GPS Geofence</span>
                  <span className="font-mono text-emerald-800 font-bold">
                    {locationConfig.defaultRadiusMeters}m radius
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Enforcement Mode</span>
                  <span className="font-semibold text-slate-800">
                    {locationConfig.strictGpsMode ? 'Strict Geofence' : 'Classroom Demo Mode'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Target Campus</span>
                  <span className="font-semibold text-slate-800">{locationConfig.campusName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className="w-full py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Enroll New Student</span>
                </button>
                <button
                  onClick={handleExportFullReport}
                  className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-300 transition-colors shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Download Master Attendance CSV</span>
                </button>
                <button
                  onClick={onResetDemoData}
                  className="w-full py-2 px-3 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Demonstration Seed Records</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: STUDENTS MANAGEMENT ==================== */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Search by 8-digit ID or name (e.g. 21009023)..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="text-xs p-2 rounded-xl border border-slate-300 font-medium text-slate-700"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowAddStudentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Student</span>
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Programme & Year</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.studentId}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{s.fullName}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{s.programme}</div>
                      <div className="text-[11px] text-slate-400">{s.academicYear}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{s.department}</td>
                    <td className="py-3.5 px-4">
                      {s.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3 text-rose-700" />
                          SUSPENDED
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleToggleStudentActive(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          s.isActive
                            ? 'text-rose-700 hover:bg-rose-50 border-rose-200'
                            : 'text-emerald-800 hover:bg-emerald-50 border-emerald-300'
                        }`}
                      >
                        {s.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: GEOFENCE & GPS SETTINGS ==================== */}
      {activeTab === 'geofence' && (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-800" />
              <span>Campus Geofence Configuration</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set authorized latitude, longitude, and radius for physical attendance validation.
            </p>
          </div>

          {geoSavedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Geofence parameters updated successfully!</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Campus Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={geoLat}
                  onChange={(e) => setGeoLat(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-slate-900 font-bold"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Default: 6.6745 (KNUST Kumasi)</span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Campus Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={geoLng}
                  onChange={(e) => setGeoLng(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-slate-900 font-bold"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Default: -1.5716</span>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Permitted Radius (Meters)</label>
              <input
                type="number"
                value={geoRadius}
                onChange={(e) => setGeoRadius(parseInt(e.target.value, 10) || 50)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-slate-900 font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Standard lecture theater perimeter is 100m – 150m.
              </span>
            </div>

            {/* Strict GPS Mode Toggle */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Strict Physical Geofence Enforcement</span>
                <span className="text-[11px] text-slate-500">
                  When enabled, devices outside the {geoRadius}m perimeter will be rejected by server validation.
                </span>
              </div>
              <input
                type="checkbox"
                checked={geoStrict}
                onChange={(e) => setGeoStrict(e.target.checked)}
                className="w-5 h-5 accent-emerald-800 rounded"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveGeofence}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs transition-colors"
            >
              Save Geofence Settings
            </button>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: REPORTS ==================== */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Attendance Verification Records</h3>
              <p className="text-xs text-slate-500">Total verified submissions archived on the attendance ledger</p>
            </div>
            <button
              onClick={handleExportFullReport}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Ref Code</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">GPS Accuracy</th>
                  <th className="py-3 px-4">Distance</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {attendanceRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-900">{r.attendanceReference}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{r.studentName}</div>
                      <div className="font-mono text-slate-400 text-[10px]">{r.studentReference}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{r.courseCode}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {r.dateFormatted} · {r.timeFormatted}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">±{r.gpsAccuracyMeters}m</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{r.distanceFromVenueMeters}m</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 5: AUDIT TRAIL ==================== */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-800" />
              <span>Immutable System Audit Trail</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive chronological log of session openings, attendance submissions, and manual overrides.
            </p>
          </div>

          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-emerald-900 px-2 py-0.5 bg-emerald-100 rounded">
                      {log.action}
                    </span>
                    <span className="font-bold text-slate-900">{log.userName}</span>
                    <span className="text-slate-400">({log.role})</span>
                  </div>
                  <p className="text-slate-700">{log.details}</p>
                </div>
                <span className="font-mono text-slate-400 text-[11px] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- ADD STUDENT MODAL ---------------- */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-900">Register New Student</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Student Reference ID (8 digits)</label>
                <input
                  type="text"
                  maxLength={8}
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 21009988"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. KUSI, Michael Kwabena"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Department</label>
                <select
                  value={newStudentDept}
                  onChange={(e) => setNewStudentDept(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-slate-800"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Programme</label>
                  <input
                    type="text"
                    value={newStudentProgramme}
                    onChange={(e) => setNewStudentProgramme(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={newStudentYear}
                    onChange={(e) => setNewStudentYear(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStudent}
                disabled={!newStudentId || !newStudentName}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50"
              >
                Register Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
