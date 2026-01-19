// src/components/absence/steps/Step1SelectTeachers.tsx

import React from 'react';
import { Search, CalendarClock, ArrowLeft, CheckCircle2, Save, ChevronLeft } from 'lucide-react';
import { Employee } from '@/types';

interface Step1SelectTeachersProps {
    // Lists
    selectedList: Employee[];
    availableList: Employee[];
    preAbsentIds: Set<number>;
    // Global dates
    globalStartDate: string;
    globalEndDate: string;
    onApplyGlobalDates: (start: string, end: string) => void;
    // Search
    searchTerm: string;
    onSearchChange: (term: string) => void;
    // Actions
    onToggleTeacher: (id: number) => void;
    onSave: () => void;
    onNext: () => void;
}

export const Step1SelectTeachers: React.FC<Step1SelectTeachersProps> = ({
    selectedList,
    availableList,
    preAbsentIds,
    globalStartDate,
    globalEndDate,
    onApplyGlobalDates,
    searchTerm,
    onSearchChange,
    onToggleTeacher,
    onSave,
    onNext
}) => {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Global Dates & Search */}
            <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CalendarClock size={14} /> الفترة الزمنية (افتراضي)
                    </label>
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200">
                        <input 
                            type="date" 
                            className="bg-transparent font-bold text-xs outline-none text-slate-700" 
                            value={globalStartDate} 
                            onChange={e => onApplyGlobalDates(e.target.value, globalEndDate < e.target.value ? e.target.value : globalEndDate)} 
                        />
                        <ArrowLeft size={16} className="text-slate-300" />
                        <input 
                            type="date" 
                            className="bg-transparent font-bold text-xs outline-none text-slate-700" 
                            value={globalEndDate} 
                            onChange={e => onApplyGlobalDates(globalStartDate, e.target.value)} 
                        />
                    </div>
                </div>
                <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Search size={14} /> بحث سريع
                    </label>
                    <input 
                        type="text" 
                        placeholder="اسم المعلم..." 
                        className="w-full p-3 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-indigo-400 transition-all" 
                        value={searchTerm} 
                        onChange={e => onSearchChange(e.target.value)} 
                    />
                </div>
            </div>

            {/* Teachers Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* Selected First */}
                {selectedList.map(emp => (
                    <div 
                        key={emp.id} 
                        onClick={() => onToggleTeacher(emp.id)} 
                        className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 cursor-pointer transform hover:scale-[1.02] transition-all flex items-center gap-3 relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-bl-[3rem] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-xs">{emp.name.charAt(0)}</div>
                        <div className="min-w-0">
                            <p className="font-bold text-xs truncate" title={emp.name}>{emp.name}</p>
                            <p className="text-[9px] opacity-80 font-medium">تم التحديد</p>
                        </div>
                        <CheckCircle2 className="absolute top-2 left-2 text-white/50" size={14} />
                    </div>
                ))}

                {/* Available */}
                {availableList.map(emp => {
                    const isPreAbsent = preAbsentIds.has(emp.id);
                    return (
                        <div 
                            key={emp.id} 
                            onClick={() => !isPreAbsent && onToggleTeacher(emp.id)} 
                            className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-3 group relative ${
                                isPreAbsent 
                                    ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' 
                                    : 'bg-white border-slate-100 hover:border-indigo-300 cursor-pointer hover:shadow-md'
                            }`}
                        >
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                {emp.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-xs text-slate-700 truncate group-hover:text-indigo-900" title={emp.name}>{emp.name}</p>
                                <p className="text-[9px] text-slate-400 font-medium truncate">{isPreAbsent ? 'غائب مسبقاً' : 'على رأس عمله'}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-end items-center gap-3 pt-4">
                {/* Save button */}
                <button
                    onClick={onSave}
                    className="px-6 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all flex items-center gap-2"
                >
                    <Save size={16} />
                    حفظ
                </button>
                
                {/* Next button */}
                <button
                    onClick={onNext}
                    disabled={selectedList.length === 0}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 flex items-center gap-2"
                >
                    التالي
                    <ChevronLeft size={16} />
                </button>
            </div>
        </div>
    );
};
