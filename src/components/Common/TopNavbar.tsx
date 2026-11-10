/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GraduationCap, Monitor, Presentation, QrCode, Smartphone, ShieldCheck } from 'lucide-react';

interface TopNavbarProps {
  currentView: 'student' | 'lecturer' | 'admin';
  onViewChange: (view: 'student' | 'lecturer' | 'admin') => void;
  isMobileDeviceFrame: boolean;
  onToggleDeviceFrame: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentView,
  onViewChange,
  isMobileDeviceFrame,
  onToggleDeviceFrame,
}) => {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-slate-200/80 border-t-[3px] border-t-[#044e29] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#044e29] text-sm font-bold text-white shadow-sm ring-1 ring-emerald-950/10">
            K
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-slate-950 sm:text-base">KNUST Attendance</span>
            <span className="mt-1 block text-[10px] font-semibold text-slate-500">CAMPUS SERVICES</span>
          </div>
        </div>

        <nav aria-label="Main navigation" className="order-3 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 md:order-none md:w-auto">
          <button
            type="button"
            aria-current={currentView === 'student' ? 'page' : undefined}
            onClick={() => onViewChange('student')}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors sm:px-3 md:flex-none md:text-sm ${
              currentView === 'student'
                ? 'bg-white text-[#044e29] shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
            }`}
          >
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span>Student</span>
          </button>
          <button
            type="button"
            aria-current={currentView === 'lecturer' ? 'page' : undefined}
            onClick={() => onViewChange('lecturer')}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors sm:px-3 md:flex-none md:text-sm ${
              currentView === 'lecturer'
                ? 'bg-white text-[#044e29] shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
            }`}
          >
            <Presentation className="h-4 w-4 shrink-0" />
            <span>Lecturer</span>
          </button>
          <button
            type="button"
            aria-current={currentView === 'admin' ? 'page' : undefined}
            onClick={() => onViewChange('admin')}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors sm:px-3 md:flex-none md:text-sm ${
              currentView === 'admin'
                ? 'bg-white text-[#044e29] shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Admin</span>
          </button>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {currentView === 'student' && (
            <button
              type="button"
              onClick={onToggleDeviceFrame}
              title={isMobileDeviceFrame ? 'Switch to Full Width Responsive View' : 'Switch to iPhone 15 Mobile Frame'}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              {isMobileDeviceFrame ? (
                <>
                  <Monitor className="h-4 w-4 text-slate-600" />
                  <span className="hidden sm:inline">Desktop View</span>
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4 text-slate-600" />
                  <span className="hidden sm:inline">Phone Frame</span>
                </>
              )}
            </button>
          )}

          {currentView !== 'student' && (
            <button
              type="button"
              onClick={() => onViewChange('student')}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#044e29] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#033b1f]"
            >
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Attendance</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
