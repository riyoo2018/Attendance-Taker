/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Student,
  AttendanceSession,
  AttendanceRecord,
  University,
} from '../../types/attendance.ts';
import { ReceiptModal } from './ReceiptModal.tsx';
import {
  CheckCircle2,
  Camera,
  MapPin,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  MessageCircle,
  HelpCircle,
  FileText,
  SlidersHorizontal,
  Compass,
} from 'lucide-react';

interface StudentAttendanceFlowProps {
  university: University;
  activeSession: AttendanceSession | null;
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  onAttendanceCompleted?: (record: AttendanceRecord) => void;
  onSwitchToLecturer?: () => void;
}

type Step = 'details' | 'selfie' | 'recording' | 'success';

export const StudentAttendanceFlow: React.FC<StudentAttendanceFlowProps> = ({
  university,
  activeSession,
  students,
  attendanceRecords,
  onAttendanceCompleted,
  onSwitchToLecturer,
}) => {
  // Stepper State
  const [currentStep, setCurrentStep] = useState<Step>('details');

  // Step 1: ID Entry & Student Lookup
  const [studentIdInput, setStudentIdInput] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [verifiedStudent, setVerifiedStudent] = useState<Student | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [alreadyRegisteredRecord, setAlreadyRegisteredRecord] = useState<AttendanceRecord | null>(null);

  // Step 1: Geolocation State
  const [locationStatus, setLocationStatus] = useState<'pending' | 'verified' | 'denied' | 'out_of_bounds'>('pending');
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(14);
  const [distanceFromVenue, setDistanceFromVenue] = useState<number>(24);
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState<string>('Checking classroom proximity...');
  const [simulateOnCampus, setSimulateOnCampus] = useState<boolean>(import.meta.env.DEV);
  const [showLocationSettings, setShowLocationSettings] = useState<boolean>(false);

  // Step 2: Camera & Selfie Capture
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState<string>('Looking for your face...');

  // Step 4: Submission & Success
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmedRecord, setConfirmedRecord] = useState<AttendanceRecord | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Auto lookup when default or typed 8 digits
  useEffect(() => {
    if (studentIdInput.trim().length === 8) {
      lookupStudent(studentIdInput.trim());
    } else {
      setVerifiedStudent(null);
      setLookupError(null);
      setAlreadyRegisteredRecord(null);
    }
  }, [studentIdInput]);

  // Request Geolocation on mount
  useEffect(() => {
    verifyLocation();
  }, [simulateOnCampus, activeSession]);

  useEffect(() => {
    if (studentIdInput) return;
    const firstEligibleStudent = students.find(
      (student) => student.isActive &&
        (!activeSession || student.enrolledCourseIds.includes(activeSession.courseId)) &&
        !attendanceRecords.some((record) => record.sessionId === activeSession?.id && record.studentReference === student.studentId)
    );
    if (firstEligibleStudent) setStudentIdInput(firstEligibleStudent.studentId);
  }, [students, attendanceRecords, activeSession?.id, activeSession?.courseId, studentIdInput]);

  // Lookup Student ID via API
  const lookupStudent = async (idToSearch: string) => {
    setIsLookingUp(true);
    setLookupError(null);
    try {
      const res = await fetch('/api/students/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: idToSearch,
          sessionId: activeSession?.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifiedStudent(data.student);
        if (data.alreadyRegistered && data.existingRecord) {
          setAlreadyRegisteredRecord(data.existingRecord);
        } else {
          setAlreadyRegisteredRecord(null);
        }
      } else {
        setVerifiedStudent(null);
        setLookupError(data.message || 'Student ID not found. Please check your university ID.');
      }
    } catch (err) {
      console.error('Student lookup failed:', err);
      setLookupError('Network error connecting to registrar database. Please retry.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Verify Location using HTML5 Geolocation or simulation
  const verifyLocation = async () => {
    setLocationStatus('pending');
    setLocationMessage('Requesting GPS location...');

    if (simulateOnCampus && import.meta.env.DEV) {
      // Instant simulated classroom presence
      try {
        const res = await fetch('/api/attendance/verify-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simulateCampusVenue: true,
            sessionId: activeSession?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Location verification failed.');
        setLocationStatus('verified');
        setGpsAccuracy(data.accuracyMeters || 13);
        setDistanceFromVenue(data.distanceMeters || 22);
        setLocationMessage(`Location confirmed — accurate to ±${data.accuracyMeters || 13}m`);
        setDeviceCoords({
          latitude: activeSession?.targetLatitude || 6.6745,
          longitude: activeSession?.targetLongitude || -1.5716,
          accuracy: data.accuracyMeters || 13,
        });
      } catch (e) {
        setLocationStatus('denied');
        setLocationMessage('Could not verify the simulated location. Please retry.');
      }
      return;
    }

    // Real Browser Geolocation
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      setLocationMessage('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setDeviceCoords({ latitude, longitude, accuracy: Math.round(accuracy) });

        try {
          const res = await fetch('/api/attendance/verify-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude,
              longitude,
              sessionId: activeSession?.id,
              simulateCampusVenue: false,
            }),
          });
          const data = await res.json();
          if (res.ok && data.withinRadius) {
            setLocationStatus('verified');
            setGpsAccuracy(Math.round(accuracy));
            setDistanceFromVenue(data.distanceMeters);
            setLocationMessage(`Location confirmed — accurate to ±${Math.round(accuracy)}m`);
          } else {
            setLocationStatus('out_of_bounds');
            setDistanceFromVenue(data.distanceMeters);
            setLocationMessage(
              `Outside attendance zone (${data.distanceMeters}m away; limit ${data.allowedRadiusMeters}m).`
            );
          }
        } catch (e) {
          setLocationStatus('denied');
          setLocationMessage('Could not verify your location. Check your connection and retry.');
        }
      },
      (err) => {
        console.warn('Geolocation permission denied or timed out:', err);
        setLocationStatus('denied');
        setLocationMessage('Location permission denied or unavailable. Toggle campus simulator to test.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setCapturedPhoto(null);
    setAutoSubmitCountdown(null);
    setFaceDetectionStatus('Camera ready. Position yourself and take a photo.');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.error('Video play error:', e));
      }

    } catch (err: any) {
      console.warn('Camera access unavailable or denied:', err);
      setCameraError('Camera access unavailable. Allow camera permission and retry.');
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  };

  // Capture Photo from video stream
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the canvas image to match front-facing camera
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
        stopCamera();
        startAutoSubmitTimer(dataUrl);
      }
    } else {
      setCameraError('Camera is not ready. Allow camera permission and retry.');
    }
  };

  // Auto submit timer (3, 2, 1 submission countdown from video)
  const startAutoSubmitTimer = (photoUrl: string) => {
    if (autoSubmitTimerRef.current) clearInterval(autoSubmitTimerRef.current);
    let count = 3;
    setAutoSubmitCountdown(count);

    autoSubmitTimerRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (autoSubmitTimerRef.current) clearInterval(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
        setAutoSubmitCountdown(null);
        submitAttendance(photoUrl);
      } else {
        setAutoSubmitCountdown(count);
      }
    }, 1000);
  };

  // Retake photo handler
  const handleRetake = () => {
    if (autoSubmitTimerRef.current) clearInterval(autoSubmitTimerRef.current);
    autoSubmitTimerRef.current = null;
    setCapturedPhoto(null);
    setAutoSubmitCountdown(null);
    startCamera();
  };

  // Submit attendance to backend
  const submitAttendance = async (photoData: string) => {
    setCurrentStep('recording');
    setSubmissionError(null);

    try {
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentIdInput.trim(),
          sessionId: activeSession?.id,
          selfieImage: photoData,
          deviceCoordinates: deviceCoords || {
            latitude: activeSession?.targetLatitude || 6.6745,
            longitude: activeSession?.targetLongitude || -1.5716,
            accuracy: gpsAccuracy,
          },
          simulateCampusVenue: simulateOnCampus && import.meta.env.DEV,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConfirmedRecord(data.record);
        setCurrentStep('success');

        // Confetti celebration!
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#044e29', '#10b981', '#fbbf24', '#ffffff'],
        });

        if (onAttendanceCompleted) {
          onAttendanceCompleted(data.record);
        }
      } else {
        setSubmissionError(data.message || 'Failed to submit attendance.');
        setCurrentStep('details');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setSubmissionError('Server network error. Please try again.');
      setCurrentStep('details');
    }
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) clearInterval(autoSubmitTimerRef.current);
      stopCamera();
    };
  }, []);

  // Quick fill student test helper
  const handleQuickFill = (id: string) => {
    setStudentIdInput(id);
  };

  // Reset to record another
  const handleRecordAnother = () => {
    if (autoSubmitTimerRef.current) clearInterval(autoSubmitTimerRef.current);
    autoSubmitTimerRef.current = null;
    setStudentIdInput('');
    setVerifiedStudent(null);
    setCapturedPhoto(null);
    setConfirmedRecord(null);
    setAlreadyRegisteredRecord(null);
    setCurrentStep('details');
  };

  return (
    <div className="student-app mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-lg flex-col overflow-hidden bg-white transition-all md:min-h-[640px] md:rounded-2xl md:border md:border-slate-200/80 md:shadow-xl">
      {/* ---------------- UNIVERSITY HEADER ---------------- */}
      <div className="bg-[#044e29] text-white px-5 pt-5 pb-4">
        {/* Top Brand Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center font-bold text-sm tracking-tight text-white shadow-xs">
              K
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wide text-emerald-200 uppercase block">
                {university.collegeShort} Attendance
              </span>
              <span className="text-[11px] text-emerald-300/80 font-mono">attendance.knust.edu.gh</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-900/80 text-emerald-300 border border-emerald-700/50">
            {activeSession ? activeSession.courseCode : 'IN SESSION'}
          </span>
        </div>

        {/* Title */}
        <div className="mt-4">
          <h1 className="text-xl font-bold tracking-tight text-white">Sign your attendance</h1>
          <p className="text-xs text-emerald-100/90 mt-0.5">Complete all steps to record your presence</p>
        </div>

        {/* Stepper (1 Details · 2 Selfie · 3 Submit) from reference video */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-emerald-800/60 text-xs">
          {/* Step 1 */}
          <div
            className={`flex items-center gap-1.5 font-medium ${
              currentStep === 'details'
                ? 'text-white font-semibold'
                : currentStep === 'selfie' || currentStep === 'recording' || currentStep === 'success'
                ? 'text-emerald-300'
                : 'text-emerald-400/60'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep === 'details'
                  ? 'bg-white text-[#044e29]'
                  : 'bg-emerald-700/80 text-white'
              }`}
            >
              1
            </span>
            <span>Details</span>
          </div>

          <div className="flex-1 mx-2 h-[1px] bg-emerald-800/80" />

          {/* Step 2 */}
          <div
            className={`flex items-center gap-1.5 font-medium ${
              currentStep === 'selfie'
                ? 'text-white font-semibold'
                : currentStep === 'recording' || currentStep === 'success'
                ? 'text-emerald-300'
                : 'text-emerald-400/60'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep === 'selfie'
                  ? 'bg-white text-[#044e29]'
                  : currentStep === 'recording' || currentStep === 'success'
                  ? 'bg-emerald-700/80 text-white'
                  : 'bg-emerald-900 text-emerald-400'
              }`}
            >
              2
            </span>
            <span>Selfie</span>
          </div>

          <div className="flex-1 mx-2 h-[1px] bg-emerald-800/80" />

          {/* Step 3 */}
          <div
            className={`flex items-center gap-1.5 font-medium ${
              currentStep === 'recording' || currentStep === 'success'
                ? 'text-white font-semibold'
                : 'text-emerald-400/60'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                currentStep === 'recording' || currentStep === 'success'
                  ? 'bg-white text-[#044e29]'
                  : 'bg-emerald-900 text-emerald-400'
              }`}
            >
              3
            </span>
            <span>Submit</span>
          </div>
        </div>
      </div>

      {/* ---------------- MAIN BODY CONTENT ---------------- */}
      <div className="flex flex-1 flex-col justify-between space-y-4 px-4 py-5 sm:px-5">
        {/* ==================== STEP 1: DETAILS ==================== */}
        {currentStep === 'details' && (
          <div className="space-y-4">
            {/* Active Class & Lecturer Banner */}
            {activeSession && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900">{activeSession.courseCode}</span>
                  <span title={activeSession.courseName} className="block truncate text-slate-600">{activeSession.courseName}</span>
                  <span title={`${activeSession.classroomName} · ${activeSession.lecturerName}`} className="mt-1 block truncate text-[11px] text-slate-500">
                    {activeSession.classroomName} · {activeSession.lecturerName}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                    {activeSession.presentCount} present
                  </span>
                  <span className="whitespace-nowrap text-[10px] text-slate-500">
                    {activeSession.totalEnrolled} enrolled
                  </span>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {submissionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{submissionError}</span>
              </div>
            )}

            {/* Student ID Input Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
              <label htmlFor="student-id-input" className="block text-sm font-bold text-slate-900">
                Enter your Student ID
              </label>
              <p className="text-xs text-slate-500">Type your 8-digit reference number to get started</p>

              <div className="relative mt-2">
                <input
                  id="student-id-input"
                  type="text"
                  maxLength={8}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={studentIdInput}
                  onChange={(e) => setStudentIdInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 20012345"
                  className="w-full text-xl tracking-wider font-mono font-bold text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#044e29] focus:bg-white transition-all text-center"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  {studentIdInput.length}/8
                </span>
              </div>

              {/* Lookup state indicators */}
              {isLookingUp && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#044e29]" />
                  <span>Looking up student...</span>
                </div>
              )}

              {/* Student Not Found / Error */}
              {lookupError && !isLookingUp && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{lookupError}</p>
                    <p className="text-[11px] text-rose-600/80 mt-0.5">Please check with course representative or registrar.</p>
                  </div>
                </div>
              )}

              {/* Already Registered Alert */}
              {alreadyRegisteredRecord && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Already Signed In</p>
                    <p className="text-[11px] text-amber-700">
                      Attendance was already recorded at {alreadyRegisteredRecord.timeFormatted} (Ref:{' '}
                      {alreadyRegisteredRecord.attendanceReference}).
                    </p>
                    <button
                      onClick={() => {
                        setConfirmedRecord(alreadyRegisteredRecord);
                        setShowReceiptModal(true);
                      }}
                      className="mt-1 text-xs font-bold text-amber-900 underline hover:text-amber-950 inline-block"
                    >
                      View existing receipt &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Student Found Card (from reference video) */}
            {verifiedStudent && !isLookingUp && (
              <div className="bg-emerald-50/70 border-2 border-emerald-500 rounded-2xl p-4 shadow-xs relative">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-emerald-800 tracking-wider uppercase block">
                      STUDENT FOUND
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                      {verifiedStudent.fullName}
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">{verifiedStudent.programme}</p>
                    <p className="text-xs text-slate-500">{verifiedStudent.academicYear}</p>

                    <button
                      type="button"
                      onClick={() => setStudentIdInput('')}
                      className="text-[11px] text-emerald-800 underline font-medium hover:text-emerald-950 mt-1 block"
                    >
                      Not you, or details wrong? Edit manually
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Location Verification Indicator (from reference video) */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 ${locationStatus === 'verified' ? 'text-emerald-700' : 'text-amber-600'}`} />
                <span className={`font-medium ${locationStatus === 'verified' ? 'text-emerald-900' : 'text-slate-700'}`}>
                  {locationMessage}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationSettings(!showLocationSettings)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
                title="Location settings"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Optional Geofence Testing Simulation Panel */}
            {showLocationSettings && (
              <div className="p-3 bg-slate-100 rounded-xl text-xs space-y-2 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">GPS Testing Mode</span>
                  <button
                    type="button"
                    disabled={!import.meta.env.DEV}
                    onClick={() => setSimulateOnCampus(!simulateOnCampus)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      simulateOnCampus
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-300 text-slate-800'
                    }`}
                  >
                    {!import.meta.env.DEV ? 'Unavailable in production' : simulateOnCampus ? 'Simulating In-Class' : 'Using Real GPS'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  The simulator is available only in development. Production attendance uses device location.
                </p>
              </div>
            )}

            {/* Camera Preparation Notice (Golden/Amber card from video) */}
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <Camera className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Your selfie is attached to the attendance record. It is not used for face recognition.
              </p>
            </div>

            {/* Quick Demo Test Buttons */}
            <div className="pt-1">
              <span className="text-[11px] text-slate-400 block mb-1">Quick Test Demo Student IDs:</span>
              <div className="flex flex-wrap gap-1.5">
                {students
                  .filter((student) => student.isActive &&
                    (!activeSession || student.enrolledCourseIds.includes(activeSession.courseId)) &&
                    !attendanceRecords.some((record) => record.sessionId === activeSession?.id && record.studentReference === student.studentId))
                  .slice(0, 4)
                  .map((student) => (
                    <button
                      key={student.studentId}
                      type="button"
                      onClick={() => handleQuickFill(student.studentId)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700"
                    >
                      {student.fullName} ({student.studentId})
                    </button>
                  ))}
                {!students.some((student) => student.isActive &&
                  (!activeSession || student.enrolledCourseIds.includes(activeSession.courseId)) &&
                  !attendanceRecords.some((record) => record.sessionId === activeSession?.id && record.studentReference === student.studentId)) && (
                  <span className="text-[11px] text-amber-700">No eligible students remain for this session.</span>
                )}
              </div>
            </div>

            {/* Continue to Selfie Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={!verifiedStudent || alreadyRegisteredRecord !== null || locationStatus === 'out_of_bounds'}
                onClick={() => {
                  setCurrentStep('selfie');
                  startCamera();
                }}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                  verifiedStudent && alreadyRegisteredRecord === null && locationStatus !== 'out_of_bounds'
                    ? 'bg-[#044e29] hover:bg-[#033b1f] text-white active:scale-[0.99] cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Continue to selfie</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              {!verifiedStudent && (
                <p className="text-center text-[11px] text-slate-400 mt-2">
                  Still needed: Your 8-digit reference number.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ==================== STEP 2: CAMERA & SELFIE ==================== */}
        {currentStep === 'selfie' && (
          <div className="space-y-4 text-center">
            {/* Header Instructions from Video */}
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {capturedPhoto ? 'Photo captured' : 'Face the camera'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {capturedPhoto
                  ? autoSubmitCountdown !== null
                    ? `Submitting automatically in ${autoSubmitCountdown}...`
                    : 'Photo ready. Submit when you are satisfied.'
                  : 'Center your face in the frame, then take a photo.'}
              </p>
            </div>

            {/* Circular Camera Viewfinder Frame (exact match to video) */}
            <div className="relative mx-auto w-56 h-56 flex items-center justify-center my-4">
              {/* Outer Pulsing Dashed Green Ring */}
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/80 animate-spin-slow pointer-events-none" />
              <div className="absolute -inset-1.5 rounded-full border border-emerald-300/60 animate-pulse-ring pointer-events-none" />

              {/* Inner Circular Viewport */}
              <div className="relative w-48 h-48 rounded-full overflow-hidden bg-slate-900 border-4 border-[#044e29] shadow-inner flex items-center justify-center">
                {capturedPhoto ? (
                  <img src={capturedPhoto} alt="Captured student selfie" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    {/* Live Shutter Icon in center when active */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                      <div className="w-10 h-10 rounded-full border-2 border-white/60 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Hidden canvas for drawing frame */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Status & Light Guide */}
            {!capturedPhoto ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-emerald-900 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  {faceDetectionStatus}
                </p>
                <p className="text-[11px] text-slate-500">
                  Good light on your face · remove caps & dark glasses
                </p>

                {cameraError && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    {cameraError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={cameraError ? startCamera : capturePhoto}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 transition-colors shadow-xs"
                >
                  <Camera className="w-4 h-4 text-[#044e29]" />
                  <span>{cameraError ? 'Retry camera' : 'Take photo'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Review the photo before submitting your attendance.
                </p>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (autoSubmitTimerRef.current) clearInterval(autoSubmitTimerRef.current);
                      autoSubmitTimerRef.current = null;
                      setAutoSubmitCountdown(null);
                      submitAttendance(capturedPhoto);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#044e29] hover:bg-[#033b1f] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    <span>Submit now</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== STEP 3: RECORDING SPINNER ==================== */}
        {currentStep === 'recording' && (
          <div className="py-16 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-[#044e29] animate-spin" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recording your attendance...</h2>
              <p className="text-xs text-slate-500 mt-1">
                Checking your attendance details and recording your check-in...
              </p>
            </div>
          </div>
        )}

        {/* ==================== STEP 4: SUCCESS CONFIRMATION ==================== */}
        {currentStep === 'success' && confirmedRecord && (
          <div className="space-y-4">
            {/* Success Heading with Animated Checkmark */}
            <div className="text-center pt-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-emerald-600 flex items-center justify-center mx-auto text-emerald-800 shadow-sm mb-2.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-700" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Attendance recorded!</h2>
              <p className="text-xs text-slate-600 mt-0.5">Your attendance has been successfully captured.</p>
            </div>

            {/* Student Captured Photo */}
            <div className="flex justify-center">
              {confirmedRecord.selfieDataUrl ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-emerald-600 shadow-md">
                  <img
                    src={confirmedRecord.selfieDataUrl}
                    alt="Student selfie"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center font-bold text-emerald-800 text-sm">
                  PRESENT
                </div>
              )}
            </div>

            {/* Official Record Metadata Table (exact layout from video) */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Name</span>
                <span className="font-extrabold text-slate-900 text-right">{confirmedRecord.studentName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Student ID</span>
                <span className="font-mono font-bold text-slate-900">{confirmedRecord.studentReference}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Programme</span>
                <span className="font-semibold text-slate-800 text-right">{confirmedRecord.programme}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Course</span>
                <span className="font-semibold text-slate-800">{confirmedRecord.courseCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Time</span>
                <span className="font-mono font-bold text-emerald-800">{confirmedRecord.timeFormatted}</span>
              </div>
            </div>

            {/* Receipt & Verification Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowReceiptModal(true)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Attendance Receipt</span>
              </button>
              <button
                type="button"
                onClick={handleRecordAnother}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors"
              >
                Sign Again
              </button>
            </div>

            {/* Need IT Help Card (from reference video) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                <HelpCircle className="w-4 h-4 text-emerald-800" />
                <span>Need IT help?</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Portal, Wi-Fi, email, MyClass or exam laptop problems.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://wa.me/${university.supportWhatsapp?.replace(/\D/g, '') || '233501234567'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-2.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] font-semibold text-[11px] flex items-center justify-center gap-1 border border-[#25D366]/30 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Follow CABE UITS on WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => alert(`CABE IT Helpdesk: Contact ${university.contactEmail} or call ${university.supportPhone}.`)}
                  className="py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors"
                >
                  Get help
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-400 pt-1">You may close this page.</p>
          </div>
        )}
      </div>

      {/* ---------------- RECEIPT MODAL ---------------- */}
      {showReceiptModal && confirmedRecord && (
        <ReceiptModal
          record={confirmedRecord}
          university={university}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </div>
  );
};
