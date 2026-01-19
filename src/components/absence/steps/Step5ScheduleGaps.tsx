// src/components/absence/steps/Step5ScheduleGaps.tsx

import React from 'react';
import { AlertTriangle, Shield, CheckCircle2, Zap, UserCheck, UserPlus, BookOpen, Coffee, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { Employee, Lesson, ClassItem, CalendarEvent } from '@/types';
import { SelectedTeacherState } from '../hooks/useAbsenceForm';
import { normalizeArabic, getSafeDayName } from '@/utils';

interface Step5ScheduleGapsProps {
    selectedTeachers: SelectedTeacherState[];
    activeEvents: CalendarEvent[];
    substitutions: any[];
    globalStartDate: string;
    employees: Employee[];
    lessons: Lesson[];
    classes: ClassItem[];
    periods: number[];
    onSave: () => void;
    onPrev: () => void;
    onNext: () => void;
}

export const Step5ScheduleGaps: React.FC<Step5ScheduleGapsProps> = ({
    selectedTeachers,
    activeEvents,
    substitutions,
    globalStartDate,
    employees,
    lessons,
    classes,
    periods,
    onSave,
    onPrev,
    onNext
}) => {
    // Get ALL affected teachers from multiple sources
    const affectedTeacherIds = new Set<number>();
    selectedTeachers.forEach(t => affectedTeacherIds.add(t.id));
    activeEvents.forEach(event => {
        if (event.plannerId) affectedTeacherIds.add(event.plannerId);
        event.participants.forEach(p => { if (p.userId) affectedTeacherIds.add(p.userId); });
    });
    substitutions.forEach(sub => { if (sub.date === globalStartDate) affectedTeacherIds.add(sub.absentTeacherId); });

    const affectedTeachers = Array.from(affectedTeacherIds)
        .map(id => employees.find(e => e.id === id))
        .filter(e => e) as Employee[];

    const dayName = getSafeDayName(globalStartDate);
    const normDay = normalizeArabic(dayName);

    let totalGaps = 0;
    let totalFilled = 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-[2.5rem] border border-orange-100">
                <div className="mb-4">
                    <h4 className="font-black text-lg text-orange-900 flex items-center gap-2">
                        <AlertTriangle size={20} className="text-orange-600" /> عرض شامل لسد الفجوات
                    </h4>
                    <p className="text-xs text-orange-700 mt-1">
                        عرض تجميعي لكل الإشغالات والفجوات من جميع المراحل السابقة (الغياب + الفعاليات + التعيينات)
                    </p>
                </div>

                {/* Comprehensive Schedule Display */}
                <div className="bg-white p-5 rounded-xl overflow-x-auto">
                    {affectedTeachers.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-500 opacity-50" />
                            <p className="text-sm font-black text-slate-600">لا توجد إشغالات أو فجوات</p>
                            <p className="text-xs text-slate-400 mt-1">لم يتم تسجيل أي غياب أو فعاليات بعد</p>
                        </div>
                    ) : (
                        <div>
                            {/* Header Row with Teacher Names */}
                            <div className="flex gap-2 mb-4 pb-3 border-b-2 border-orange-200">
                                <div className="w-20 shrink-0 text-xs font-black text-slate-700">الحصة</div>
                                {affectedTeachers.map(teacher => {
                                    const isAbsent = selectedTeachers.find(t => t.id === teacher.id);
                                    const hasEvent = activeEvents.some(e =>
                                        e.plannerId === teacher.id || e.participants.some(p => p.userId === teacher.id)
                                    );
                                    const hasSub = substitutions.some(s =>
                                        s.date === globalStartDate && s.absentTeacherId === teacher.id
                                    );

                                    return (
                                        <div key={teacher.id} className="flex-1 min-w-[180px]">
                                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-3 rounded-xl text-center">
                                                <p className="text-xs font-black truncate">{teacher.name}</p>
                                                <p className="text-[9px] opacity-80 mt-1">
                                                    {isAbsent ? '🚫 غائب' : hasEvent ? '⚡ فعالية' : hasSub ? '✅ مُغطى' : '📋 متأثر'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Schedule Grid */}
                            <div className="space-y-2">
                                {periods.map(period => {
                                    return (
                                        <div key={period} className="flex gap-2 items-stretch">
                                            {/* Period Number */}
                                            <div className="w-20 shrink-0 flex items-center justify-center bg-slate-100 rounded-lg">
                                                <span className="text-xs font-black text-slate-700">الحصة {period}</span>
                                            </div>

                                            {/* Teacher Columns */}
                                            {affectedTeachers.map(teacher => {
                                                const teacherLesson = lessons.find(les =>
                                                    les.teacherId === teacher.id && normalizeArabic(les.day) === normDay && les.period === period
                                                );
                                                const isAbsentInPeriod = selectedTeachers.some(t => {
                                                    if (t.id !== teacher.id) return false;
                                                    if (t.type === 'FULL') return true;
                                                    return t.affectedPeriods.includes(period);
                                                });
                                                const assignedSub = substitutions.find(sub =>
                                                    sub.date === globalStartDate && sub.period === period && sub.absentTeacherId === teacher.id
                                                );
                                                const asSubstitute = substitutions.find(sub =>
                                                    sub.date === globalStartDate && sub.period === period && sub.substituteId === teacher.id
                                                );
                                                const teacherEvent = activeEvents.find(evt =>
                                                    evt.date === globalStartDate && evt.appliesTo.periods.includes(period) &&
                                                    (evt.plannerId === teacher.id || evt.participants.some(p => p.userId === teacher.id))
                                                );

                                                const createsGap = (isAbsentInPeriod || teacherEvent) && teacherLesson && !assignedSub;
                                                if (createsGap) totalGaps++;
                                                if (assignedSub) totalFilled++;

                                                let bgColor = 'bg-white border-slate-200';
                                                let content = '';
                                                let icon = null;
                                                let statusBadge = null;

                                                if (createsGap) {
                                                    bgColor = 'bg-red-100 border-red-400 animate-pulse';
                                                    const lessonClass = classes.find(c => c.id === teacherLesson?.classId);
                                                    content = `${teacherLesson?.subject} - ${lessonClass?.name || ''}`;
                                                    icon = <AlertTriangle size={14} className="text-red-600" />;
                                                    statusBadge = <span className="text-[8px] bg-red-500 text-white px-2 py-0.5 rounded-full font-black">فجوة!</span>;
                                                } else if (assignedSub) {
                                                    bgColor = 'bg-emerald-100 border-emerald-400';
                                                    const subTeacher = employees.find(e => e.id === assignedSub.substituteId);
                                                    content = `بديل: ${subTeacher?.name || ''}`;
                                                    icon = <UserCheck size={14} className="text-emerald-600" />;
                                                    statusBadge = <span className="text-[8px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-black">مُغطى ✓</span>;
                                                } else if (teacherEvent) {
                                                    bgColor = 'bg-violet-100 border-violet-300';
                                                    content = teacherEvent.title;
                                                    icon = <Zap size={14} className="text-violet-600" />;
                                                    statusBadge = <span className="text-[8px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-black">فعالية</span>;
                                                } else if (asSubstitute) {
                                                    bgColor = 'bg-amber-100 border-amber-300';
                                                    const subForTeacher = employees.find(e => e.id === asSubstitute.absentTeacherId);
                                                    content = `بديل عن: ${subForTeacher?.name || ''}`;
                                                    icon = <UserPlus size={14} className="text-amber-600" />;
                                                    statusBadge = <span className="text-[8px] bg-amber-600 text-white px-2 py-0.5 rounded-full font-black">يُغطي</span>;
                                                } else if (teacherLesson) {
                                                    bgColor = 'bg-blue-50 border-blue-200';
                                                    const lessonClass = classes.find(c => c.id === teacherLesson.classId);
                                                    content = `${teacherLesson.subject} - ${lessonClass?.name || ''}`;
                                                    icon = <BookOpen size={14} className="text-blue-600" />;
                                                    statusBadge = <span className="text-[8px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black">عادي</span>;
                                                } else {
                                                    bgColor = 'bg-slate-50 border-slate-200';
                                                    content = 'فراغ';
                                                    icon = <Coffee size={14} className="text-slate-400" />;
                                                }

                                                return (
                                                    <div key={teacher.id} className={`flex-1 min-w-[180px] p-3 rounded-lg border-2 ${bgColor} transition-all`}>
                                                        <div className="flex items-start gap-2">
                                                            {icon}
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-[10px] font-bold ${createsGap ? 'text-red-700' : assignedSub ? 'text-emerald-700' : teacherEvent ? 'text-violet-700' : asSubstitute ? 'text-amber-700' : teacherLesson ? 'text-blue-700' : 'text-slate-500'} truncate`}>
                                                                    {content || 'متاح'}
                                                                </p>
                                                                {statusBadge && ( <div className="mt-1">{statusBadge}</div> )}
                                                                {createsGap && ( <p className="text-[8px] text-red-600 mt-1 font-black">⚠️ يحتاج بديل فوري</p> )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Summary Stats */}
                            <div className="mt-6 grid grid-cols-3 gap-3">
                                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-red-600">{totalGaps}</p>
                                    <p className="text-[10px] font-bold text-red-700">فجوات متبقية</p>
                                </div>
                                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-emerald-600">{totalFilled}</p>
                                    <p className="text-[10px] font-bold text-emerald-700">حصص مُغطاة</p>
                                </div>
                                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-indigo-600">{affectedTeachers.length}</p>
                                    <p className="text-[10px] font-bold text-indigo-700">معلم متأثر</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800 flex items-start gap-2">
                    <Shield size={14} className="mt-0.5 shrink-0" />
                    <p><span className="font-black">عرض شامل:</span> يجمع كل الإشغالات من المراحل السابقة (غياب + فعاليات + تعيينات). الفجوات الحمراء تحتاج تغطية في المرحلة التالية.</p>
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-between items-center pt-4">
                {/* LEFT: Previous button */}
                <button
                    onClick={onPrev}
                    className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 flex items-center gap-2"
                >
                    <ChevronRight size={16} />
                    السابق
                </button>
                
                {/* RIGHT: Save + Next buttons */}
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
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2"
                    >
                        التالي
                        <ChevronLeft size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
