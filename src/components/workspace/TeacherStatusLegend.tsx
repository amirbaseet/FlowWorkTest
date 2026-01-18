// src/components/workspace/TeacherStatusLegend.tsx

import React from 'react';
import { AlertCircle, GraduationCap, Coffee, Users, UserCircle } from 'lucide-react';

interface TeacherStatusLegendProps {
  isVisible: boolean;
}

const TeacherStatusLegend: React.FC<TeacherStatusLegendProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  const statusItems = [
    {
      icon: GraduationCap,
      label: 'مربي الصف',
      color: 'emerald',
      bgColor: 'bg-emerald-100',
      borderColor: 'border-emerald-300',
      textColor: 'text-emerald-700'
    },
    {
      icon: Coffee,
      label: 'مكوث',
      color: 'amber',
      bgColor: 'bg-amber-100',
      borderColor: 'border-amber-300',
      textColor: 'text-amber-700'
    },
    {
      icon: UserCircle,
      label: 'فردي',
      color: 'purple',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300',
      textColor: 'text-purple-700'
    },
    {
      icon: Users,
      label: 'مشترك',
      color: 'blue',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300',
      textColor: 'text-blue-700'
    },
    {
      icon: AlertCircle,
      label: 'غير مغطى',
      color: 'rose',
      bgColor: 'bg-rose-100',
      borderColor: 'border-rose-300',
      textColor: 'text-rose-700'
    }
  ];

  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-2 rounded-xl border border-slate-200 shrink-0">
      <h5 className="text-[9px] font-black text-slate-700 mb-1.5 flex items-center gap-2">
        <AlertCircle size={10} />
        دليل ألوان الحصص
      </h5>
      <div className="grid grid-cols-5 gap-1.5">
        {statusItems.map(item => (
          <div
            key={item.label}
            className={`
              flex items-center gap-1 bg-white p-1 rounded-lg border
              ${item.borderColor}
            `}
          >
            <div
              className={`
                w-4 h-4 rounded flex items-center justify-center
                ${item.bgColor} ${item.borderColor} border
              `}
            >
              <item.icon size={8} className={item.textColor} />
            </div>
            <div>
              <p className={`text-[7px] font-black ${item.textColor}`}>
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherStatusLegend;
