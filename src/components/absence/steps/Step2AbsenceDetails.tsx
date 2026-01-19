// src/components/absence/steps/Step2AbsenceDetails.tsx

import React from 'react';
import { UserMinus, Clock, Trash2, Copy, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { Employee, ScheduleConfig } from '@/types';
import { SelectedTeacherState } from '../hooks/useAbsenceForm';

interface Step2AbsenceDetailsProps {
    selectedTeachers: SelectedTeacherState[];
    employees: Employee[];
    periods: number[];
    scheduleConfig: ScheduleConfig;
    onTeacherToggle: (id: number) => void;
    onUpdateTeacherConfig: (id: number, key: string, value: any) => void;
    onApplyToAll: () => void;
    preAbsentTeachers: Employee[];
    onSave: () => void;
    onPrev: () => void;
    onNext: () => void;
}

export const Step2AbsenceDetails: React.FC<Step2AbsenceDetailsProps> = ({
    selectedTeachers,
    employees,
    periods,
    scheduleConfig,
    onTeacherToggle,
    onUpdateTeacherConfig,
    onApplyToAll,
    preAbsentTeachers,
    onSave,
    onPrev,
    onNext
}) => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Summary Header */}
            <div className="bg-gradient-to-br from-rose-50 to-red-50 p-5 rounded-[2rem] border border-rose-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-black text-lg text-rose-900 flex items-center gap-2">
                            <UserMinus size={20} className="text-rose-600" /> معلمو الغياب
                        </h4>
                        <p className="text-xs text-rose-700 mt-1">
                            {(preAbsentTeachers.length + selectedTeachers.length)} معلم/معلمة محدد{preAbsentTeachers.length + selectedTeachers.length !== 1 ? 'ون' : ''} للغياب
                        </p>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-rose-100">
                        <span className="text-sm font-black text-rose-600">{preAbsentTeachers.length + selectedTeachers.length}</span>
                    </div>
                </div>
            </div>

            {/* Display Pre-absent Teachers */}
            {preAbsentTeachers.length > 0 && (
                <div className="bg-rose-50 p-4 rounded-[2rem] border border-rose-100">
                    <h5 className="text-xs font-black text-rose-700 mb-2 flex items-center gap-1">
                        <Clock size={12} className="text-rose-500" /> المعلمين مسجلين مسبقًا:
                    </h5>
                    <div className="flex flex-wrap gap-2">
                        {preAbsentTeachers.map(emp => (
                            <div key={`pre-${emp.id}`} className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl text-xs font-black text-rose-700 border border-rose-200">
                                <UserMinus size={12} className="text-rose-500" />
                                {emp.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bulk Apply Bar */}
            <div className="bg-indigo-50/50 p-4 rounded-[2rem] border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Copy size={18} className="text-indigo-600" />
                    <div>
                        <p className="text-xs font-black text-indigo-900">تعميم الخصائص</p>
                        <p className="text-[9px] text-indigo-700/70">نسخ إعدادات المعلم الأول (نوع الغياب، الحصص، السبب) للبقية.</p>
                    </div>
                </div>
                <button onClick={onApplyToAll} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black shadow-sm hover:bg-indigo-50 border border-indigo-100 transition-all">تطبيق على الكل</button>
            </div>

            <div className="space-y-4">
                {selectedTeachers.map((tState) => {
                    const emp = employees.find(e => e.id === tState.id);
                    if (!emp) return null;
                    const isPartial = tState.type === 'PARTIAL';

                    return (
                        <div key={tState.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                {/* Teacher Info */}
                                <div className="flex items-center gap-4 min-w-[200px]">
                                    <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-black shadow-inner">
                                        <UserMinus size={16} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-black text-sm text-slate-800">{emp.name}</h4>
                                            {/* Assistant Indicator Badge */}
                                            {(() => {
                                                if (emp.addons?.educator) {
                                                    const educatorClassId = emp.addons.educatorClassId;
                                                    const hasAssistant = scheduleConfig.structure.classAssistants?.[educatorClassId];
                                                    if (hasAssistant) {
                                                        return (
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg" title="مساعد متاح لهذا الصف">
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                                <span className="text-[9px] font-black text-blue-700">مساعد متاح</span>
                                                            </div>
                                                        );
                                                    }
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <button onClick={() => onTeacherToggle(tState.id)} className="text-[9px] text-rose-500 hover:underline mt-0.5 flex items-center gap-1"><Trash2 size={10} /> إزالة من القائمة</button>
                                    </div>
                                </div>

                                {/* Config Controls */}
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                    {/* Date Range Override */}
                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                                        <input type="date" className="bg-transparent text-[10px] font-bold outline-none w-full" value={tState.startDate} onChange={e => onUpdateTeacherConfig(tState.id, 'startDate', e.target.value)} />
                                        <span className="text-slate-300">|</span>
                                        <input type="date" className="bg-transparent text-[10px] font-bold outline-none w-full" value={tState.endDate} onChange={e => onUpdateTeacherConfig(tState.id, 'endDate', e.target.value)} />
                                    </div>

                                    {/* Type & Reason */}
                                    <div className="flex gap-2">
                                        <div className="flex bg-slate-100 p-1 rounded-xl flex-1">
                                            <button onClick={() => onUpdateTeacherConfig(tState.id, 'type', 'FULL')} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${!isPartial ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>يوم كامل</button>
                                            <button onClick={() => onUpdateTeacherConfig(tState.id, 'type', 'PARTIAL')} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${isPartial ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>جزئي</button>
                                        </div>
                                        <select
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-2 text-[10px] font-bold outline-none w-1/2"
                                            value={tState.reason}
                                            onChange={(e) => onUpdateTeacherConfig(tState.id, 'reason', e.target.value)}
                                        >
                                            {scheduleConfig.absenceReasons.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>

                                    {/* Partial Period Selector */}
                                    {isPartial ? (
                                        <div className="flex flex-wrap gap-1 items-center justify-end">
                                            {periods.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => {
                                                        const current = tState.affectedPeriods;
                                                        const next = current.includes(p) ? current.filter((x: number) => x !== p) : [...current, p].sort((a, b) => a - b);
                                                        onUpdateTeacherConfig(tState.id, 'affectedPeriods', next);
                                                    }}
                                                    className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all border ${tState.affectedPeriods.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center text-slate-300 text-[10px] font-bold italic bg-slate-50 rounded-xl border border-slate-100">
                                            يشمل جميع الحصص
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-between items-center pt-4">
                {/* Left: Previous button */}
                <button
                    onClick={onPrev}
                    className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 flex items-center gap-2"
                >
                    <ChevronRight size={16} />
                    السابق
                </button>
                
                {/* Right: Save + Next buttons */}
                <div className="flex gap-3">
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
                        disabled={selectedTeachers.length === 0}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 flex items-center gap-2"
                    >
                        التالي
                        <ChevronLeft size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
