// src/components/absence/steps/Step3PoolManagement.tsx

import React from 'react';
import { Briefcase, Globe, Users, Activity, Check, UserPlus, X } from 'lucide-react';
import { Employee, Lesson } from '@/types';
import { SelectedTeacherState } from '../hooks/useAbsenceForm';
import { normalizeArabic, getSafeDayName } from '@/utils';

interface InternalCandidate {
    emp: Employee;
    status: 'FULL' | 'PARTIAL';
    label: string;
    details?: string;
}

interface Step3PoolManagementProps {
    activeExternalIds: number[];
    setActiveExternalIds: React.Dispatch<React.SetStateAction<number[]>>;
    employees: Employee[];
    availableExternals: Employee[];
    availableInternalCandidates: InternalCandidate[];
    selectedTeachers: SelectedTeacherState[];
    boardViewDate: string;
    lessons: Lesson[];
    onPoolUpdate?: (ids: number[]) => void;
    onAddToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onPrev: () => void;
    onNext: () => void;
}

export const Step3PoolManagement: React.FC<Step3PoolManagementProps> = ({
    activeExternalIds,
    setActiveExternalIds,
    employees,
    availableExternals,
    availableInternalCandidates,
    selectedTeachers,
    boardViewDate,
    lessons,
    onPoolUpdate,
    onAddToast,
    onPrev,
    onNext
}) => {
    // Calculate busy teachers count
    const busyCount = employees.filter(e => {
        if (e.constraints.isExternal) return false;
        if (selectedTeachers.some(t => t.id === e.id)) return false;
        if (activeExternalIds.includes(e.id)) return false;
        if (availableInternalCandidates.some(c => c.emp.id === e.id)) return false;
        
        // Exclude teachers with no lessons today
        const dayName = getSafeDayName(boardViewDate);
        const normDay = normalizeArabic(dayName);
        const hasLessonsToday = lessons.some(l =>
            l.teacherId === e.id && normalizeArabic(l.day) === normDay
        );
        if (!hasLessonsToday) return false;
        
        const validTeacherRoles = ['teacher', 'teachers', 'معلم', 'معلمة'];
        if (!validTeacherRoles.includes(e.baseRoleId?.toLowerCase() || '')) {
            if (!e.subjects || e.subjects.length === 0) return false;
        }
        return true;
    }).length;

    const handleToggleExternal = (id: number) => {
        const newIds = activeExternalIds.includes(id)
            ? activeExternalIds.filter(x => x !== id)
            : [...activeExternalIds, id];
        setActiveExternalIds(newIds);
    };

    const handleRemoveFromPool = (id: number, name: string) => {
        const newIds = activeExternalIds.filter(x => x !== id);
        setActiveExternalIds(newIds);
        if (onPoolUpdate) {
            onPoolUpdate(newIds);
        }
        onAddToast('تم إزالة ' + name + ' من قائمة الإشغال', 'success');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-6 rounded-[2.5rem] border border-indigo-100">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h4 className="font-black text-lg text-indigo-900 flex items-center gap-2">
                            <Briefcase size={20} className="text-indigo-600" /> إدارة بنك الاحتياط اليومي
                        </h4>
                        <p className="text-xs text-indigo-700 mt-1">
                            حدد المعلمين المتاحين للاستدعاء الفوري (خارجي وداخلي)
                        </p>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm">
                        <span className="text-xs font-black text-indigo-600">{activeExternalIds.length} مفعّل</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Active Pool - القائمة المفعلة */}
                    <div className="space-y-3 md:col-span-3 mb-4">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-2xl">
                            <h5 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 justify-center">
                                <Briefcase size={16} /> قائمة الإشغال المفعّلة ({activeExternalIds.length})
                            </h5>
                            <p className="text-xs text-white/80 text-center mt-1">المعلمون المتاحون للمراحل التالية</p>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-white rounded-xl border-2 border-dashed border-indigo-300">
                            {activeExternalIds.length > 0 ? activeExternalIds.map(id => {
                                const emp = employees.find(e => e.id === id);
                                if (!emp) return null;
                                return (
                                    <div key={`active-teacher-${id}`} className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md">
                                        <span className="text-xs font-black select-none pointer-events-none">{emp.name.split(' ').slice(0, 2).join(' ')}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleRemoveFromPool(id, emp.name);
                                            }}
                                            className="w-5 h-5 rounded-full bg-white/20 hover:bg-red-500 hover:scale-110 flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95"
                                            title="إزالة من القائمة"
                                            aria-label="إزالة"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            }) : (
                                <div className="w-full text-center py-4 text-slate-400">
                                    <p className="text-xs font-bold">اختر معلمين من القوائم أدناه لتفعيلهم</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* External Substitutes */}
                    <div className="space-y-3">
                        <h5 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                            <Globe size={14} /> بدلاء خارجيون
                        </h5>
                        <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                            {availableExternals.length > 0 ? availableExternals.map(ext => {
                                const isActive = activeExternalIds.includes(ext.id);
                                return (
                                    <button
                                        key={ext.id}
                                        onClick={() => handleToggleExternal(ext.id)}
                                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                            isActive
                                                ? 'bg-amber-50 border-amber-400 shadow-md'
                                                : 'bg-white border-slate-200 hover:border-amber-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                                                isActive ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600'
                                            }`}>
                                                {ext.name.charAt(0)}
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-black ${isActive ? 'text-amber-900' : 'text-slate-700'}`}>
                                                    {ext.name}
                                                </p>
                                                <span className="text-[9px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-md mt-1 inline-block">
                                                    {availableExternals.some(e => e.id === ext.id) ? 'خارجي' : 'داخلي محول'}
                                                </span>
                                            </div>
                                        </div>
                                        {isActive ? <Check size={20} className="text-amber-500" /> : <UserPlus size={20} className="text-slate-300" />}
                                    </button>
                                );
                            }) : (
                                <div className="text-center py-8 text-slate-400">
                                    <Globe size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-bold">لا يوجد بدلاء خارجيين</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Internal Available */}
                    <div className="space-y-3">
                        <h5 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                            <Users size={14} /> داخلي متاح
                        </h5>
                        <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                            {availableInternalCandidates.length > 0 ? availableInternalCandidates.map(cand => {
                                const isActive = activeExternalIds.includes(cand.emp.id);
                                const isFull = cand.status === 'FULL';
                                return (
                                    <button
                                        key={cand.emp.id}
                                        onClick={() => handleToggleExternal(cand.emp.id)}
                                        className={`w-full flex flex-col items-start p-4 rounded-xl border-2 transition-all text-right ${
                                            isActive
                                                ? (isFull ? 'bg-emerald-50 border-emerald-400' : 'bg-indigo-50 border-indigo-400') + ' shadow-md'
                                                : 'bg-white border-slate-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                                                    isActive
                                                        ? (isFull ? 'bg-emerald-500' : 'bg-indigo-500') + ' text-white'
                                                        : (isFull ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600')
                                                }`}>
                                                    {cand.emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800">
                                                        {cand.emp.name.split(' ').slice(0, 2).join(' ')}
                                                    </p>
                                                    <p className="text-[9px] text-slate-500 mt-0.5">{cand.label}</p>
                                                </div>
                                            </div>
                                            {isActive ? <Check size={18} className={isFull ? 'text-emerald-500' : 'text-indigo-500'} /> : <UserPlus size={18} className="text-slate-300" />}
                                        </div>
                                        {cand.details && (
                                            <span className="text-[8px] text-slate-400 mt-2">{cand.details}</span>
                                        )}
                                    </button>
                                );
                            }) : (
                                <div className="text-center py-8 text-slate-400">
                                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-bold">لا يوجد متاحين حالياً</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ملخص الإشغال */}
                    <div className="space-y-3">
                        <h5 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={14} /> ملخص الإشغال
                        </h5>
                        <div className="bg-white p-4 rounded-xl border border-indigo-100 space-y-3">
                            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                                <span className="text-xs font-bold text-amber-900">بدلاء خارجيون</span>
                                <span className="text-lg font-black text-amber-600">{availableExternals.length}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                                <span className="text-xs font-bold text-emerald-900">داخليون متاحون</span>
                                <span className="text-lg font-black text-emerald-600">{availableInternalCandidates.length}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                                <span className="text-xs font-bold text-indigo-900">إجمالي المفعّلين</span>
                                <span className="text-lg font-black text-indigo-600">{activeExternalIds.length}</span>
                            </div>
                            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                                <p className="text-[10px] text-slate-500 text-center">
                                    📊 اختر المعلمين من القوائم لتفعيلهم في بنك الاحتياط
                                </p>
                            </div>
                            {busyCount > 0 && (
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-600">معلمون مشغولون</span>
                                        <span className="text-sm font-black text-slate-500">{busyCount}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-1">غير متاحين لهذا اليوم</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-between pt-4">
                <button
                    onClick={onPrev}
                    className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"
                >
                    ← السابق
                </button>
                <button
                    onClick={onNext}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                >
                    التالي ←
                </button>
            </div>
        </div>
    );
};
