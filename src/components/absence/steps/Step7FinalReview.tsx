// src/components/absence/steps/Step7FinalReview.tsx

import React from 'react';
import { CheckCircle2, Users, Briefcase, Zap, UserCheck } from 'lucide-react';
import { Employee, CalendarEvent } from '@/types';
import { SelectedTeacherState } from '../hooks/useAbsenceForm';

interface Step7FinalReviewProps {
    selectedTeachers: SelectedTeacherState[];
    globalStartDate: string;
    globalEndDate: string;
    activeExternalIds: number[];
    activeEvents: CalendarEvent[];
    substitutions: any[];
    employees: Employee[];
    onPrev: () => void;
    onSubmit: () => void;
    initialData?: any;
}

export const Step7FinalReview: React.FC<Step7FinalReviewProps> = ({
    selectedTeachers,
    globalStartDate,
    globalEndDate,
    activeExternalIds,
    activeEvents,
    substitutions,
    employees,
    onPrev,
    onSubmit,
    initialData
}) => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-[2.5rem] border border-emerald-100">
                <div className="mb-6">
                    <h4 className="font-black text-xl text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 size={24} className="text-emerald-600" /> المراجعة النهائية
                    </h4>
                    <p className="text-xs text-emerald-700 mt-1">
                        مراجعة شاملة لجميع البيانات قبل الحفظ النهائي
                    </p>
                </div>

                {/* Summary Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Card 1: Teachers */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <Users size={18} className="text-indigo-600" />
                            <span className="text-2xl font-black text-indigo-600">{selectedTeachers.length}</span>
                        </div>
                        <p className="text-xs font-black text-slate-700">معلم غائب</p>
                        <p className="text-[9px] text-slate-400 mt-1">من {new Date(globalStartDate).toLocaleDateString('ar-EG')} إلى {new Date(globalEndDate).toLocaleDateString('ar-EG')}</p>
                    </div>

                    {/* Card 2: Pool */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <Briefcase size={18} className="text-amber-600" />
                            <span className="text-2xl font-black text-amber-600">{activeExternalIds.length}</span>
                        </div>
                        <p className="text-xs font-black text-slate-700">بديل مفعّل</p>
                        <p className="text-[9px] text-slate-400 mt-1">بنك الاحتياط</p>
                    </div>

                    {/* Card 3: Modes */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <Zap size={18} className="text-violet-600" />
                            <span className="text-2xl font-black text-violet-600">{activeEvents.length}</span>
                        </div>
                        <p className="text-xs font-black text-slate-700">نمط نشط</p>
                        <p className="text-[9px] text-slate-400 mt-1">أنماط مفعلة</p>
                    </div>

                    {/* Card 4: Substitutions */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <UserCheck size={18} className="text-emerald-600" />
                            <span className="text-2xl font-black text-emerald-600">{substitutions.length}</span>
                        </div>
                        <p className="text-xs font-black text-slate-700">تغطية محددة</p>
                        <p className="text-[9px] text-slate-400 mt-1">حصص مغطاة</p>
                    </div>
                </div>

                {/* Detailed Review Sections */}
                <div className="space-y-4">
                    {/* Teachers List */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <h5 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                            <Users size={16} className="text-indigo-600" />
                            قائمة الغيابات
                        </h5>
                        <div className="space-y-2">
                            {selectedTeachers.map((t, idx) => {
                                const emp = employees.find(e => e.id === t.id);
                                return (
                                    <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                                            <div>
                                                <p className="text-xs font-black text-slate-800">{emp?.name}</p>
                                                <p className="text-[9px] text-slate-500">{t.type === 'FULL' ? 'غياب كلي' : `غياب جزئي (${t.affectedPeriods.length} حصة)`}</p>
                                            </div>
                                        </div>
                                        <span className="text-[9px] text-slate-400 font-bold">{t.reason}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Pool */}
                    {activeExternalIds.length > 0 && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200">
                            <h5 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                                <Briefcase size={16} className="text-amber-600" />
                                بنك الاحتياط المفعّل
                            </h5>
                            <div className="flex flex-wrap gap-2">
                                {activeExternalIds.map(id => {
                                    const emp = employees.find(e => e.id === id);
                                    return emp ? (
                                        <span key={id} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold border border-amber-200">
                                            {emp.name}
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    )}

                    {/* Active Modes */}
                    {activeEvents.length > 0 && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200">
                            <h5 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                                <Zap size={16} className="text-violet-600" />
                                الأنماط النشطة
                            </h5>
                            <div className="space-y-2">
                                {activeEvents.map(event => (
                                    <div key={event.id} className="flex items-center gap-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                                        <span className="text-lg">
                                            {event.eventType === 'EXAM' ? '📝' : event.eventType === 'TRIP' ? '🚌' : '🎯'}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-slate-800">{event.title}</p>
                                            <p className="text-[9px] text-slate-500">{event.description || 'لا يوجد وصف'}</p>
                                        </div>
                                        {event.opContext?.isActive && (
                                            <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded-md">
                                                قواعد نشطة
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Final Confirmation */}
                <div className="mt-6 bg-emerald-100 border-2 border-emerald-300 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-emerald-900">
                        <p className="font-black mb-1">جاهز للحفظ</p>
                        <p className="text-emerald-700">تأكد من صحة جميع البيانات أعلاه، ثم اضغط "اعتماد التوثيق" لحفظ التغييرات</p>
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
                    onClick={onSubmit}
                    className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl hover:bg-emerald-500 transition-all flex items-center gap-3"
                >
                    <CheckCircle2 size={18} /> {initialData ? 'حفظ التعديلات' : 'اعتماد التوثيق'}
                </button>
            </div>
        </div>
    );
};
