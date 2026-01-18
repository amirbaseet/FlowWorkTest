
import React from 'react';
import { ExternalLink, Calendar, Phone, MessageSquare, ShieldAlert, User, BookOpen } from 'lucide-react';
import { ViewState } from '@/types';

interface QuickActionMenuProps {
  teacherId?: number;
  classId?: string;
  onNavigate: (view: ViewState, params?: any) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

const QuickActionMenu: React.FC<QuickActionMenuProps> = ({ teacherId, classId, onNavigate, onClose, position }) => {
  return (
    <div 
      className="fixed z-[3000] bg-white rounded-3xl shadow-2xl border border-slate-200 p-3 w-64 animate-scale-up"
      style={{ top: position.y, left: position.x }}
      onMouseLeave={onClose}
    >
      <div className="p-3 border-b border-slate-50 mb-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجراءات سريعة</p>
      </div>
      <div className="space-y-1">
        {teacherId && (
          <>
            <button onClick={() => { onNavigate('schedule', { mode: 'teacher', id: teacherId }); onClose(); }} className="w-full flex items-center gap-3 p-3 hover:bg-indigo-50 rounded-2xl text-slate-700 hover:text-indigo-600 transition-all font-bold text-sm group">
              <Calendar size={18} className="text-slate-400 group-hover:text-indigo-500" /> عرض الجدول الشخصي
            </button>
            <button onClick={() => { onNavigate('substitutions'); onClose(); }} className="w-full flex items-center gap-3 p-3 hover:bg-rose-50 rounded-2xl text-slate-700 hover:text-rose-600 transition-all font-bold text-sm group">
              <ShieldAlert size={18} className="text-slate-400 group-hover:text-rose-500" /> تسجيل غياب / تغطية
            </button>
          </>
        )}
        {classId && (
          <button onClick={() => { onNavigate('schedule', { mode: 'class', id: classId }); onClose(); }} className="w-full flex items-center gap-3 p-3 hover:bg-emerald-50 rounded-2xl text-slate-700 hover:text-emerald-600 transition-all font-bold text-sm group">
            <BookOpen size={18} className="text-slate-400 group-hover:text-emerald-500" /> عرض جدول الشعبة
          </button>
        )}
        <button onClick={onClose} className="w-full flex items-center justify-center p-2 text-[10px] font-black text-slate-300 hover:text-slate-500 mt-2 italic">
          إغلاق القائمة
        </button>
      </div>
    </div>
  );
};

export default QuickActionMenu;
