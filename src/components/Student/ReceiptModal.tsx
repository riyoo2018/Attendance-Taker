/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AttendanceRecord, University } from '../../types/attendance.ts';
import { CheckCircle2, Download, Printer, X, ShieldCheck, MapPin, Clock } from 'lucide-react';

interface ReceiptModalProps {
  record: AttendanceRecord;
  university: University;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ record, university, onClose }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    const verificationUrl = `${window.location.origin}?verifyRef=${record.attendanceReference}`;
    QRCode.toDataURL(verificationUrl, {
      width: 140,
      margin: 1,
      color: {
        dark: '#044e29',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [record]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-950 text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-base">Official Attendance Receipt</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-colors"
            aria-label="Close receipt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Certificate / Receipt Content (Printable) */}
        <div id="printable-receipt" className="p-6 md:p-8 space-y-6 bg-white">
          {/* Institutional Header */}
          <div className="text-center border-b border-slate-200 pb-5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-900 text-white font-bold text-xl mb-2 shadow-xs">
              K
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{university.name}</h2>
            <p className="text-xs font-semibold text-emerald-800 tracking-wide uppercase">
              {university.collegeName} ({university.collegeShort})
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Automated Biometric & Geolocation Attendance System</p>
          </div>

          {/* Reference & Status Banner */}
          <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5">
            <div>
              <span className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wider block">
                Reference Code
              </span>
              <span className="font-mono text-base font-bold text-emerald-950">{record.attendanceReference}</span>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-700 text-white text-xs font-bold tracking-wide">
                <CheckCircle2 className="w-3.5 h-3.5" />
                VERIFIED PRESENT
              </span>
            </div>
          </div>

          {/* Student & Verification Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-1.5">
                Student Credentials
              </h4>
              <div>
                <span className="text-slate-500 block">Full Name</span>
                <span className="font-semibold text-slate-900 text-sm">{record.studentName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Student ID Number</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">{record.studentReference}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Programme of Study</span>
                <span className="font-medium text-slate-800">{record.programme}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Department</span>
                <span className="font-medium text-slate-800">{record.department}</span>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-1.5">
                Session & Verification
              </h4>
              <div>
                <span className="text-slate-500 block">Course Code & Title</span>
                <span className="font-semibold text-slate-900">{record.courseCode}</span>
                <span className="text-[11px] text-slate-600 block line-clamp-1">{record.courseName}</span>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-slate-500 block">Date</span>
                  <span className="font-medium text-slate-900">{record.dateFormatted}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Timestamp</span>
                  <span className="font-mono font-semibold text-slate-900 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-700" />
                    {record.timeFormatted}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block">GPS Verification</span>
                <span className="font-medium text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-700" />
                  Accurate to ±{record.gpsAccuracyMeters}m ({record.distanceFromVenueMeters}m from venue)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Verification Protocol</span>
                <span className="font-medium text-emerald-800">
                  {record.verificationMethod === 'GPS_FACE'
                    ? 'Biometric Facial Capture + Haversine Geofence'
                    : 'Authorized Manual Lecturer Override'}
                </span>
              </div>
            </div>
          </div>

          {/* Photographic & QR Code Verification Footnote */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <div className="flex items-center gap-3">
              {record.selfieDataUrl ? (
                <img
                  src={record.selfieDataUrl}
                  alt="Student selfie capture"
                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-600 shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-emerald-600 flex items-center justify-center text-emerald-800 font-bold text-xs">
                  Photo OK
                </div>
              )}
              <div className="text-[11px] text-slate-500 max-w-xs">
                <p className="font-semibold text-slate-700">Digital Identity Stamp</p>
                <p>Cryptographically hashed and permanently archived on the university registrar attendance ledger.</p>
              </div>
            </div>

            {qrCodeDataUrl && (
              <div className="text-center">
                <img src={qrCodeDataUrl} alt="Verification QR Code" className="w-16 h-16 rounded border border-slate-200 p-0.5" />
                <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">Scan to verify</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-500">Official digital document. Valid without physical signature.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
