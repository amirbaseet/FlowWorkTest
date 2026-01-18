// src/components/workspace/TeacherStatusLegend.tsx

import React from 'react';
import { AlertCircle, CheckCircle2, GraduationCap, Users, Coffee, Unlock } from 'lucide-react';

interface TeacherStatusLegendProps {
  isVisible: boolean;
}

/**
 * TeacherStatusLegend - Show teacher status color meanings
 */
const TeacherStatusLegend: React.FC<TeacherStatusLegendProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-2 rounded-xl border border-slate-200 shrink-0">
      <h5 className="text-[9px] font-black text-slate-700 mb-1.5 flex items-center gap-2">
        <AlertCircle size={10} /> دليل حالة المعلمين
      </h5>
      <div className="grid grid-cols-5 gap-1.5">
        {/* 1. Available (emerald) */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-emerald-200">
          <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 flex items-center justify-center">
            <CheckCircle2 size={8} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[7px] font-black text-emerald-700">متاح</p>
          </div>
        </div>

        {/* 2. Educator (blue) */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-blue-200">
          <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300 flex items-center justify-center">
            <GraduationCap size={8} className="text-blue-600" />
          </div>
          <div>
            <p className="text-[7px] font-black text-blue-700">مربي</p>
          </div>
        </div>

        {/* 3. Individual (purple) */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-purple-200">
          <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300 flex items-center justify-center">
            <Users size={8} className="text-purple-600" />
          </div>
          <div>
            <p className="text-[7px] font-black text-purple-700">فردي</p>
          </div>
        </div>

        {/* 4. Stay (orange) */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-orange-200">
          <div className="w-4 h-4 rounded bg-orange-100 border border-orange-300 flex items-center justify-center">
            <Coffee size={8} className="text-orange-600" />
          </div>
          <div>
            <p className="text-[7px] font-black text-orange-700">مكوث</p>
          </div>
        </div>

        {/* 5. Busy (red) */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-red-200">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-300 flex items-center justify-center">
            <Unlock size={8} className="text-red-600" />
          </div>
          <div>
            <p className="text-[7px] font-black text-red-700">مشغول</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherStatusLegend;
