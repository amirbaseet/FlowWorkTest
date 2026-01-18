
import React, { useState, useMemo, useEffect } from 'react';
import {
    ShieldAlert, UserX, User, Zap, BookOpen, AlertTriangle, Plus, Activity,
    Siren, Clock, CheckCircle2, UserCheck, Globe, Trash2, Shield, History,
    Users, ArrowRight, LayoutList, CloudRain, Bus, FileText, Filter, CalendarPlus, Coffee,
    Briefcase, Timer, UserPlus, Check, Sunrise, Sunset, Sun, Edit3, X, ClipboardList
} from 'lucide-react';
import {
    Employee, Lesson, ScheduleConfig, ClassItem, EngineContext,
    SubstitutionLog, AbsenceRecord, ViewState, AcademicYear,
    DayPattern, CalendarHoliday, DayOverride, CalendarEvent,
    CoverageRequest, CoverageAssignment, DailyPool
} from '@/types';
import { useLessons } from '@/hooks/useLessons';
import { useAbsences } from '@/hooks/useAbsences';
import { useSubstitutions } from '@/hooks/useSubstitutions';
import { useCoverage } from '@/hooks/useCoverage';
import { useAbsence } from '@/hooks/useAbsence';
import { useToast } from '@/contexts/ToastContext';
import { generateSubstitutionOptions, calculatePeriodTimeRange, toLocalISOString, normalizeArabic, createModeOverlay } from '@/utils';
import AbsenceForm from './AbsenceForm';
import DailyAbsenceSubstitutionGrid from './DailyAbsenceSubstitutionGrid';
import ReplacementNeededList from './ReplacementNeededList';
import { DAYS_AR } from '@/constants';

interface SubstitutionsProps {
    employees: Employee[];
    scheduleConfig: ScheduleConfig;
    classes: ClassItem[];
    engineContext: EngineContext;
    setEngineContext: React.Dispatch<React.SetStateAction<EngineContext>>;
    onToggleMode: (modeId: string) => void;
    onNavigateToView: (view: ViewState) => void;
    academicYear: AcademicYear;
    patterns: DayPattern[];
    holidays: CalendarHoliday[];
    overrides: DayOverride[];
    setOverrides: React.Dispatch<React.SetStateAction<DayOverride[]>>;
    events: CalendarEvent[];
    setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
    onOpenRequestForm: (prefill: any) => void;
    // Workspace integration
    initialAbsenceStep?: 1 | 2 | 3 | 6 | null;
    onClearInitialStep?: () => void;
}

const Substitutions: React.FC<SubstitutionsProps> = ({
    employees, scheduleConfig, classes, engineContext, setEngineContext, onToggleMode,
    events, onOpenRequestForm,
    initialAbsenceStep, onClearInitialStep
}) => {
    const { addToast } = useToast();
    // Atomic Hooks
    const { lessons, setLessons } = useLessons();
    const { absences, setAbsences } = useAbsences();
    const { substitutionLogs, setSubstitutionLogs } = useSubstitutions();
    const { coverageRequests, coverageAssignments, dailyPools } = useCoverage();
    const absenceLogic = useAbsence();

    const [selectedDate, setSelectedDate] = useState(toLocalISOString(new Date()));
    const [showAbsenceForm, setShowAbsenceForm] = useState(false);
    const [showEventForm, setShowEventForm] = useState(false); // New state for event form
    const [editingAbsence, setEditingAbsence] = useState<AbsenceRecord | undefined>(undefined);
    const [absenceFormInitialStep, setAbsenceFormInitialStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1); // NEW: Track initial step
    const [isSingleStageMode, setIsSingleStageMode] = useState(false); // NEW: Track if in single stage mode

    // GLOBAL POOL STATE (Lifted from Wizard)
    const [activePoolIds, setActivePoolIds] = useState<number[]>([]);

    // Internal Filter State
    const [internalFilter, setInternalFilter] = useState<'ALL' | 'FULL' | 'LATE' | 'EARLY'>('ALL');

    const dayOfWeek = DAYS_AR[new Date(selectedDate).getDay()];

    // Reset pool on date change (optional, keeps data fresh)
    useEffect(() => {
        setActivePoolIds([]);
    }, [selectedDate]);

    // Handle initial step from Workspace
    useEffect(() => {
        if (initialAbsenceStep) {
            setAbsenceFormInitialStep(initialAbsenceStep);
            setIsSingleStageMode(true); // Set single stage mode when opened from Workspace
            setShowAbsenceForm(true);
            onClearInitialStep?.();
        }
    }, [initialAbsenceStep, onClearInitialStep]);

    // Handle single stage save
    const handleSingleStageSave = (stage: number, data: any) => {
        console.log(`💾 Stage ${stage} saved:`, data);

        if (stage === 1 && data.selectedTeachers) {
            // Create absence records from selected teachers
            const newAbsences = data.selectedTeachers.map((t: any) => ({
                id: Date.now() + Math.random(),
                teacherId: t.id,
                date: data.globalStartDate || selectedDate,
                reason: t.reason || 'غياب',
                type: t.type || 'FULL',
                affectedPeriods: t.affectedPeriods || [],
                status: 'OPEN',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));

            setAbsences(prev => {
                const targetDate = data.globalStartDate || selectedDate;
                const newIds = newAbsences.map((a: any) => a.teacherId);
                const filtered = prev.filter(a => !(a.date === targetDate && newIds.includes(a.teacherId)));
                return [...filtered, ...newAbsences];
            });
        } else if (stage === 3 && data.activeExternalIds) {
            // Update pool IDs
            setActivePoolIds(data.activeExternalIds);
        } else if (stage === 6 && data.substitutions) {
            // Save substitutions
            setSubstitutionLogs(prev => {
                const newLogs = data.substitutions.map((s: any) => ({
                    ...s,
                    id: `LOG-${Date.now()}-${Math.random()}`,
                    timestamp: Date.now()
                }));
                return [...prev, ...newLogs];
            });
        }
    };

    // --- DETECT ACTIVE EVENTS FOR BANNER ---
    const activeEvents = useMemo(() => {
        return events.filter(e => e.date === selectedDate && e.opContext?.isActive);
    }, [events, selectedDate]);

    const dailyAbsences = useMemo(() =>
        absences.filter(a => a.date === selectedDate),
        [absences, selectedDate]);

    // --- POOL LOGIC CALCULATIONS ---
    const availableExternals = useMemo(() => employees.filter(e => e.constraints.isExternal), [employees]);

    const availableInternals = useMemo(() => {
        const normDay = normalizeArabic(dayOfWeek);
        const maxP = scheduleConfig.periodsPerDay;
        const absentIds = dailyAbsences.map(a => a.teacherId);

        return employees.map(emp => {
            if (emp.constraints.isExternal) return null;
            if (absentIds.includes(emp.id)) return null; // Already absent

            const dayLessons = lessons
                .filter(l => l.teacherId === emp.id && normalizeArabic(l.day) === normDay)
                .map(l => l.period)
                .sort((a, b) => a - b);

            let status: 'FULL' | 'LATE_START' | 'EARLY_END' | 'BUSY' = 'BUSY';
            let label = '';
            let details = '';

            if (dayLessons.length === 0) {
                status = 'FULL';
                label = 'يوم فراغ كامل';
                details = 'متاح طوال اليوم';
            } else {
                const firstLesson = dayLessons[0];
                const lastLesson = dayLessons[dayLessons.length - 1];

                if (firstLesson > 2) {
                    status = 'LATE_START';
                    label = `يبدأ متأخراً`;
                    details = `متاح الحصص (1-${firstLesson - 1})`;
                } else if (lastLesson <= maxP - 2) {
                    status = 'EARLY_END';
                    label = `ينهي باكراً`;
                    details = `متاح الحصص (${lastLesson + 1}-${maxP})`;
                }
            }

            if (status === 'BUSY') return null;

            return { emp, status, label, details };
        }).filter(Boolean) as { emp: Employee, status: 'FULL' | 'LATE_START' | 'EARLY_END' | 'BUSY', label: string, details: string }[];
    }, [employees, lessons, dayOfWeek, scheduleConfig.periodsPerDay, dailyAbsences]);

    // Count metrics for filters
    const internalCounts = useMemo(() => ({
        ALL: availableInternals.length,
        FULL: availableInternals.filter(i => i.status === 'FULL').length,
        LATE: availableInternals.filter(i => i.status === 'LATE_START').length,
        EARLY: availableInternals.filter(i => i.status === 'EARLY_END').length,
    }), [availableInternals]);

    // --- HANDLERS ---
    const togglePoolMember = (id: number) => {
        setActivePoolIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const uncoveredLessons = useMemo(() => {
        const list: any[] = [];
        dailyAbsences.forEach(abs => {
            const teacher = employees.find(e => e.id === abs.teacherId);
            if (!teacher) return;

            const teacherLessons = lessons.filter(l =>
                l.teacherId === abs.teacherId &&
                normalizeArabic(l.day) === normalizeArabic(dayOfWeek) &&
                (abs.type === 'FULL' || abs.affectedPeriods.includes(l.period))
            );

            teacherLessons.forEach(l => {
                const isCovered = substitutionLogs.some(s =>
                    s.date === selectedDate &&
                    s.period === l.period &&
                    s.absentTeacherId === abs.teacherId
                );

                if (!isCovered) {
                    list.push({ ...l, teacherName: teacher.name });
                }
            });
        });
        return list;
    }, [dailyAbsences, employees, lessons, dayOfWeek, substitutionLogs, selectedDate]);

    const handleEditAbsence = (teacherId: number) => {
        const abs = absences.find(a => a.teacherId === teacherId && a.date === selectedDate);
        if (abs) {
            setEditingAbsence(abs);
            setAbsenceFormInitialStep(1); // Start from step 1 when editing
            setShowAbsenceForm(true);
        }
    };

    const handleSaveAbsence = (absencesList: Omit<AbsenceRecord, 'id'>[], subs: Omit<SubstitutionLog, 'id' | 'timestamp'>[]) => {
        setAbsences(prev => {
            const updatedTeachers = absencesList.map(a => a.teacherId);
            const targetDate = absencesList[0]?.date || selectedDate;

            const filtered = prev.filter(a => !(a.date === targetDate && updatedTeachers.includes(a.teacherId)));
            return [...filtered, ...absencesList.map(a => ({ ...a, id: Date.now() + Math.random() }))];
        });

        setSubstitutionLogs(prev => {
            const targetDate = absencesList[0]?.date || selectedDate;
            const updatedTeacherIds = absencesList.map(a => a.teacherId);

            const cleanedLogs = prev.filter(log =>
                !(log.date === targetDate && updatedTeacherIds.includes(log.absentTeacherId))
            );

            const newLogs = subs.map(s => ({
                ...s,
                id: `LOG-${Date.now()}-${Math.random()}`,
                timestamp: Date.now()
            }));

            return [...cleanedLogs, ...newLogs];
        });

        setShowAbsenceForm(false);
        setEditingAbsence(undefined);
        addToast(editingAbsence ? "تم تحديث بيانات الغياب والتغطية" : `تم معالجة غياب ${absencesList.length} معلمين`, "success");
    };

    const handleAddSubstitution = (sub: Omit<SubstitutionLog, 'id' | 'timestamp'>) => {
        const newSub = {
            ...sub,
            id: `LOG-${Date.now()}-${Math.random()}`,
            timestamp: Date.now()
        };
        setSubstitutionLogs(prev => {
            // Remove potential duplicates
            const filtered = prev.filter(s => !(s.absentTeacherId === sub.absentTeacherId && s.period === sub.period && s.date === sub.date));
            return [...filtered, newSub];
        });
        addToast('تم إضافة التعيين بنجاح', 'success');
    };

    const handleRemoveSubstitution = (absentTeacherId: number, period: number, date: string) => {
        setSubstitutionLogs(prev => prev.filter(s => !(s.absentTeacherId === absentTeacherId && s.period === period && s.date === date)));
        addToast('تم إزالة التعيين', 'success');
    };

    const handleDeleteAbsenceEntry = () => {
        if (!editingAbsence) return;
        setAbsences(prev => prev.filter(a => !(Number(a.teacherId) === Number(editingAbsence.teacherId) && a.date === selectedDate)));
        setSubstitutionLogs(prev => prev.filter(l => !(Number(l.absentTeacherId) === Number(editingAbsence.teacherId) && l.date === selectedDate)));
        setShowAbsenceForm(false);
        setEditingAbsence(undefined);
        addToast('تم حذف سجل الغياب وإلغاء التغطيات المرتبطة به', 'success');
    };

    // --- HOLIDAY DETECTION ---
    const isHoliday = useMemo(() => {
        const dayName = DAYS_AR[new Date(selectedDate).getDay()];
        const normDay = normalizeArabic(dayName);
        return (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normDay);
    }, [selectedDate, scheduleConfig.holidays]);

    return (
        <div className="space-y-6 animate-fade-in pb-12" dir="rtl">

            {/* ACTIVE MODES BANNER - MULTI-MODE SUPPORT */}
            {activeEvents.length > 0 && !isHoliday && (
                <div className="bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 text-white p-6 rounded-[2rem] shadow-2xl border border-indigo-700/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>

                    <div className="relative z-10 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl animate-pulse backdrop-blur-sm">
                                    <Zap size={24} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg">أنماط نشطة في هذا اليوم</h3>
                                    <p className="text-xs font-bold text-indigo-200">
                                        {activeEvents.length} {activeEvents.length === 1 ? 'نمط' : activeEvents.length === 2 ? 'نمطان' : 'أنماط'} قيد التشغيل
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white/20 px-4 py-2 rounded-xl text-xs font-black backdrop-blur-sm">
                                النظام الذكي • نشط
                            </div>
                        </div>

                        {/* Active Modes List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {activeEvents.map((event, idx) => {
                                const modeColor = event.eventType === 'EXAM' ? 'amber' :
                                    event.eventType === 'TRIP' ? 'sky' :
                                        event.eventType === 'ACTIVITY' ? 'emerald' : 'indigo';
                                const modeIcon = event.eventType === 'EXAM' ? '📝' :
                                    event.eventType === 'TRIP' ? '🚌' :
                                        event.eventType === 'ACTIVITY' ? '🎯' : '⚙️';

                                return (
                                    <div key={event.id} className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 hover:bg-white/15 transition-all group relative">
                                        {/* Edit Button */}
                                        <button
                                            onClick={() => onOpenRequestForm(event)}
                                            className="absolute top-2 left-2 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                            title="تعديل النشاط"
                                        >
                                            <Edit3 size={14} className="text-white" />
                                        </button>

                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">{modeIcon}</span>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-sm truncate">{event.title}</h4>
                                                <p className="text-[10px] font-bold text-white/70 mt-1 line-clamp-2">
                                                    {event.description || 'لا يوجد وصف'}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    {event.appliesTo?.periods?.length > 0 && (
                                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold">
                                                            {event.appliesTo.periods.length} حصة
                                                        </span>
                                                    )}
                                                    {event.appliesTo?.grades?.length > 0 && (
                                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold">
                                                            {event.appliesTo.grades.length} صف
                                                        </span>
                                                    )}
                                                    {event.opContext?.isActive && (
                                                        <span className="bg-emerald-500/30 px-2 py-0.5 rounded text-[8px] font-bold flex items-center gap-1">
                                                            <CheckCircle2 size={10} /> قواعد نشطة
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary Info */}
                        <div className="flex items-center gap-4 pt-3 border-t border-white/10">
                            <div className="text-[10px] font-bold text-white/60">
                                💡 يتم تطبيق قواعد الأنماط تلقائياً عند معالجة الغيابات
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Strategic Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-rose-600/5 rounded-bl-[6rem] -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-rose-600 text-white rounded-[1.5rem] shadow-xl shadow-rose-200"><ShieldAlert size={28} /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tighter">نظام الإشغال وبروتوكول الغياب</h2>

                        {/* IN-PAGE PROTOCOL & MODES MANAGER */}
                        <div className="mt-3 flex flex-col md:flex-row gap-3">
                            {/* Quick Event Setup */}
                            <button
                                disabled={isHoliday}
                                onClick={() => onOpenRequestForm({
                                    date: selectedDate,
                                    title: `توزيع مهام ${new Date(selectedDate).toLocaleDateString('ar-EG')}`,
                                    type: 'EXAM',
                                    description: '',
                                    autoSmartMode: true,
                                    poolIds: activePoolIds
                                })}
                                className={`flex items-center gap-3 border px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm group flex-1
                                    ${isHoliday
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'
                                    }`}
                            >
                                <CalendarPlus size={16} className={isHoliday ? "text-slate-400" : "text-indigo-500 group-hover:text-white transition-colors"} />
                                إضافة نمط/فعالية لهذا اليوم
                            </button>

                            {/* View Active Modes */}
                            {activeEvents.length > 0 && !isHoliday && (
                                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-xl">
                                    <Zap size={14} className="text-indigo-600" />
                                    <span className="text-[10px] font-black text-indigo-700">
                                        {activeEvents.length} نمط نشط
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <input
                        type="date"
                        className="bg-slate-50 p-2.5 rounded-xl font-black text-xs text-slate-700 outline-none border border-slate-100 focus:bg-white transition-all shadow-inner"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    <button
                        disabled={isHoliday}
                        onClick={() => {
                            setEditingAbsence(undefined);
                            setAbsenceFormInitialStep(1); // Start from step 1 for new absence
                            setShowAbsenceForm(true);
                        }}
                        className={`px-6 py-2.5 rounded-xl font-black text-[10px] flex items-center gap-2 shadow-xl transition-all
                            ${isHoliday
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-900 text-white hover:bg-rose-600 btn-press glow-primary'
                            }`}
                    >
                        <Plus size={16} /> تسجيل غياب جديد
                    </button>
                </div>
            </div>

            {/* HOLIDAY BANNER (BLOCKING VIEW) */}
            {isHoliday ? (
                <div className="bg-[repeating-linear-gradient(45deg,#FEE2E2,#FEE2E2_10px,#FEF2F2_10px,#FEF2F2_20px)] border-2 border-rose-200 rounded-[2.5rem] p-12 text-center animate-fade-in shadow-inner relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px]"></div>
                    <div className="relative z-10 flex flex-col items-center justify-center gap-4">
                        <div className="p-6 bg-white rounded-full shadow-lg mb-2 ring-8 ring-rose-50">
                            <Coffee size={48} className="text-rose-500" />
                        </div>
                        <h2 className="text-2xl font-black text-rose-800">
                            عطلة رسمية - لا توجد مناوبات في هذا اليوم
                        </h2>
                        <p className="text-rose-600/80 font-bold max-w-md mx-auto">
                            هذا اليوم مصنف كعطلة في إعدادات الجدول، لذلك تم تعطيل نظام الإشغال والبدلاء لضمان سلامة البيانات.
                        </p>
                        <div className="mt-4 flex gap-3">
                            <div className="px-4 py-2 bg-white rounded-xl text-rose-700 text-xs font-black shadow-sm border border-rose-100">
                                {DAYS_AR[new Date(selectedDate).getDay()]}
                            </div>
                            <div className="px-4 py-2 bg-white rounded-xl text-rose-700 text-xs font-black shadow-sm border border-rose-100">
                                {new Date(selectedDate).toLocaleDateString('ar-EG')}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* --- NEW: GLOBAL RESOURCE POOL MANAGER WITH MODE AWARENESS --- */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm animate-slide-down">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Briefcase size={20} /></div>
                            <div className="flex-1">
                                <h4 className="font-black text-sm text-slate-800">إدارة بنك الاحتياط اليومي (Pool)</h4>
                                <p className="text-[10px] font-bold text-slate-400">المعلمون المحددون للاستدعاء الفوري اليوم</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black">
                                    مفعّل: {activePoolIds.length}
                                </div>
                                {activeEvents.length > 0 && (
                                    <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1">
                                        <Zap size={10} /> قواعد نشطة
                                    </div>
                                )}
                                {/* Add Button */}
                                <button
                                    onClick={() => {
                                        setEditingAbsence(undefined);
                                        setAbsenceFormInitialStep(3); // Go directly to step 3 (Pool Management)
                                        setShowAbsenceForm(true);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 transition-all shadow-sm"
                                    title="إضافة معلمين للبنك"
                                >
                                    <UserPlus size={12} />
                                    إضافة
                                </button>
                            </div>
                        </div>

                        {/* Mode Impact Notice */}
                        {activeEvents.length > 0 && (
                            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                                <Shield size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                <div className="text-[10px] font-bold text-amber-800">
                                    <span className="font-black">ملاحظة:</span> سيتم تطبيق قواعد الأنماط النشطة تلقائياً عند إضافة غياب جديد.
                                    {activeEvents.map(e => e.opContext?.isActive && (
                                        <span key={e.id} className="block mt-1">
                                            • نمط "{e.title}" سيحدد أولويات البدلاء
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active Pool Members - Only show selected ones */}
                        {activePoolIds.length > 0 ? (
                            <div className="space-y-3">
                                {/* External Members */}
                                {(() => {
                                    const activeExternals = availableExternals.filter(e => activePoolIds.includes(e.id));
                                    if (activeExternals.length === 0) return null;
                                    return (
                                        <div className="space-y-2">
                                            <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                                <Globe size={12} /> بدلاء خارجيون ({activeExternals.length})
                                            </h5>
                                            <div className="flex flex-wrap gap-2">
                                                {activeExternals.map(ext => (
                                                    <div
                                                        key={ext.id}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 text-white border border-amber-500 shadow-md text-[10px] font-bold group"
                                                    >
                                                        <Check size={12} />
                                                        <span>{ext.name}</span>
                                                        <button
                                                            onClick={() => togglePoolMember(ext.id)}
                                                            className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                            title="إزالة من البنك"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Internal Members */}
                                {(() => {
                                    const activeInternals = availableInternals.filter(i => activePoolIds.includes(i.emp.id));
                                    if (activeInternals.length === 0) return null;
                                    return (
                                        <div className="space-y-2">
                                            <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                                <Timer size={12} /> داخليون متاحون ({activeInternals.length})
                                            </h5>
                                            <div className="flex flex-wrap gap-2">
                                                {activeInternals.map(cand => {
                                                    const isFull = cand.status === 'FULL';
                                                    const isLate = cand.status === 'LATE_START';
                                                    const isEarly = cand.status === 'EARLY_END';

                                                    let baseColor = 'emerald';
                                                    let icon = <Sun size={10} />;
                                                    if (isLate) { baseColor = 'indigo'; icon = <Sunrise size={10} />; }
                                                    if (isEarly) { baseColor = 'orange'; icon = <Sunset size={10} />; }

                                                    return (
                                                        <div
                                                            key={cand.emp.id}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-${baseColor}-500 text-white border border-${baseColor}-500 shadow-md text-[10px] font-bold group`}
                                                        >
                                                            <div className="flex items-center gap-1">
                                                                {icon}
                                                                <span>{cand.emp.name.split(' ').slice(0, 2).join(' ')}</span>
                                                            </div>
                                                            <span className="text-[8px] text-white/80">({cand.label})</span>
                                                            <button
                                                                onClick={() => togglePoolMember(cand.emp.id)}
                                                                className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                                title="إزالة من البنك"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                                <Briefcase size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-sm font-black text-slate-400">لا يوجد معلمين في بنك الاحتياط</p>
                                <p className="text-[10px] text-slate-400 mt-1">اضغط "إضافة" أو سجّل غياب جديد لتحديد البنك</p>
                            </div>
                        )}
                    </div>

                    {/* Grid Logic */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-12">
                            <div className="bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-sm mb-2">
                                <div className="flex items-center justify-between mb-3 px-2">
                                    <h4 className="font-black text-slate-800 text-xs flex items-center gap-2"><LayoutList size={16} className="text-indigo-500" /> اللوحة التفاعلية للغياب والبدلاء</h4>
                                    <p className="text-[9px] text-slate-400 font-bold">يمكنك السحب والإفلات أو النقر للتعيين</p>
                                </div>
                                <DailyAbsenceSubstitutionGrid
                                    absences={dailyAbsences}
                                    substitutions={substitutionLogs.filter(s => s.date === selectedDate)}
                                    employees={employees}
                                    lessons={lessons}
                                    classes={classes}
                                    maxPeriod={scheduleConfig.periodsPerDay}
                                    date={selectedDate}
                                    events={activeEvents}
                                    activeExternalIds={activePoolIds} // Pass the global pool down
                                    onCancelAbsence={(tid) => {
                                        if (window.confirm('هل أنت متأكد من إلغاء غياب هذا المعلم لهذا اليوم؟')) {
                                            setAbsences(prev => prev.filter(a => !(a.teacherId === tid && a.date === selectedDate)));
                                            setSubstitutionLogs(prev => prev.filter(l => !(l.absentTeacherId === tid && l.date === selectedDate)));
                                            addToast('تم إلغاء الغياب بنجاح', 'success');
                                        }
                                    }}
                                    onEditAbsence={handleEditAbsence}
                                    onUnassign={(logId) => {
                                        if (window.confirm('هل تريد إلغاء هذا التعيين؟')) {
                                            setSubstitutionLogs(prev => prev.filter(l => l.id !== logId));
                                            addToast('تم إلغاء التعيين', 'success');
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* UNCOVERED LESSONS (COMPACT MODE) */}
                        <div className="lg:col-span-8 space-y-6">
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[400px]">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-rose-50 rounded-xl text-rose-600"><AlertTriangle size={18} /></div>
                                        <div>
                                            <h3 className="font-black text-sm text-slate-800">الحصص المكشوفة</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-slate-400">بحاجة لتأمين فوري</span>
                                                <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-100 text-rose-600">{uncoveredLessons.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><Filter size={16} /></button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                    {uncoveredLessons.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                            <CheckCircle2 size={48} className="mb-2 text-emerald-500" />
                                            <p className="font-bold">جميع الحصص مغطاة</p>
                                        </div>
                                    ) : (
                                        uncoveredLessons.map((l, i) => {
                                            return (
                                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shadow-sm">
                                                            <span className="text-[10px] font-black text-slate-400">حصة</span>
                                                            <span className="text-sm font-black text-slate-800">{l.period}</span>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-slate-800 text-sm">{l.subject} - {classes.find(c => c.id === l.classId)?.name}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] text-slate-500 font-bold">{l.teacherName}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Auto-Assign Button (Quick Action) */}
                                                    <button
                                                        onClick={() => {/* Trigger auto assign for this single lesson if needed in future */ }}
                                                        className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-50"
                                                        title="اقتراح بديل"
                                                    >
                                                        <Zap size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* STATS WIDGETS */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-6 text-white shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[5rem] pointer-events-none"></div>
                                <h3 className="font-black text-lg mb-1">نسبة التغطية</h3>
                                <div className="text-4xl font-black tracking-tighter mb-4">
                                    {Math.round(((dailyAbsences.length * (scheduleConfig.periodsPerDay || 7) - uncoveredLessons.length) / (Math.max(1, dailyAbsences.length * (scheduleConfig.periodsPerDay || 7)))) * 100)}%
                                </div>
                                <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                                    <div className="bg-emerald-400 h-full transition-all duration-1000" style={{ width: `${Math.round(((dailyAbsences.length * 7 - uncoveredLessons.length) / (Math.max(1, dailyAbsences.length * 7))) * 100)}%` }}></div>
                                </div>
                            </div>

                            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm">
                                <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2"><Activity size={16} className="text-emerald-500" /> حالة الطاقم</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                        <span>المعلمون الحاضرون</span>
                                        <span className="text-slate-900">{employees.length - dailyAbsences.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                        <span>إجمالي الغياب</span>
                                        <span className="text-rose-500">{dailyAbsences.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                        <span>بدلاء نشطون</span>
                                        <span className="text-amber-500">{new Set(substitutionLogs.filter(s => s.date === selectedDate).map(s => s.substituteId)).size}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COVERAGE REQUESTS LIST */}
                    {coverageRequests.length > 0 && (
                        <div className="animate-slide-up">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                                    <ClipboardList size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800">قائمة طلبات التغطية</h3>
                                    <p className="text-[10px] text-slate-500 font-bold">
                                        طلبات التغطية الناتجة عن النقر على الجدول • {coverageRequests.filter(r => r.date === selectedDate && r.status === 'PENDING').length} طلب معلق
                                    </p>
                                </div>
                            </div>
                            <ReplacementNeededList
                                coverageRequests={coverageRequests}
                                employees={employees}
                                lessons={lessons}
                                classes={classes}
                                scheduleConfig={scheduleConfig}
                                absences={absences}
                                dailyPools={dailyPools}
                                onAssignSubstitute={absenceLogic.handleAssignSubstitute}
                                onCancelRequest={absenceLogic.handleCancelCoverageRequest}
                                date={selectedDate}
                            />
                        </div>
                    )}
                </>
            )}

            {showAbsenceForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <AbsenceForm
                        employees={employees}
                        classes={classes}
                        lessons={lessons}
                        scheduleConfig={scheduleConfig}
                        date={selectedDate}
                        dayOfWeek={dayOfWeek}
                        onSave={handleSaveAbsence}
                        onCancel={() => { setShowAbsenceForm(false); setEditingAbsence(undefined); setIsSingleStageMode(false); }}
                        engineContext={engineContext}
                        initialData={editingAbsence}
                        onDelete={editingAbsence ? handleDeleteAbsenceEntry : undefined}
                        existingAbsences={absences}
                        substitutionLogs={substitutionLogs}
                        events={events}
                        preSelectedPool={activePoolIds}
                        onPoolUpdate={setActivePoolIds}
                        onOpenRequestForm={onOpenRequestForm}
                        initialStep={absenceFormInitialStep}
                        singleStageMode={isSingleStageMode}
                        onStageSave={handleSingleStageSave}
                        onAddSubstitution={handleAddSubstitution}
                        onRemoveSubstitution={handleRemoveSubstitution}
                    />
                </div>
            )}
        </div>
    );
};

export default Substitutions;
