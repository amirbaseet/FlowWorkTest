
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Clock, Activity, AlertTriangle, CheckCircle2, Coffee, Zap, UserX, CalendarDays, Users,
    ChevronRight, ChevronLeft, RotateCcw, Briefcase, Hash, Calendar as CalendarIcon, Timer,
    MonitorPlay, LayoutGrid, ArrowLeft, ArrowRight, Check, BookOpen, GraduationCap,
    Calculator, Languages, Palette, Dumbbell, Microscope, Globe2, Laptop2, HeartHandshake,
    PlayCircle, Star, Triangle, Circle, Shield
} from 'lucide-react';
import {
    ScheduleConfig, Employee, ClassItem, Lesson,
    CalendarEvent, SubstitutionLog, AbsenceRecord, EngineContext, ModeConfig
} from '@/types';
import { DAYS_AR } from '@/constants';
import { getLiveSchoolStatus, calculatePeriodTimeRange, generatePatternFromConfig, timeToMins, toLocalISOString, normalizeArabic } from '@/utils';

interface BulletinBoardProps {
    scheduleConfig: ScheduleConfig;
    employees: Employee[];
    classes: ClassItem[];
    lessons: Lesson[];
    events: CalendarEvent[];
    substitutionLogs: SubstitutionLog[];
    absences: AbsenceRecord[];
    engineContext: EngineContext;
}

// --- HELPER TYPES & CONSTANTS ---

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const DAY_ORDER: Record<string, number> = { "الأحد": 1, "الاثنين": 2, "الثلاثاء": 3, "الأربعاء": 4, "الخميس": 5, "الجمعة": 6, "السبت": 7 };

// --- HELPER COMPONENTS ---

const StatusBadge = ({ label, icon: Icon, colorClass, pulse }: any) => (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${colorClass} bg-opacity-10 backdrop-blur-sm shadow-sm`}>
        <Icon size={12} className={pulse ? 'animate-pulse' : ''} />
        <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
    </div>
);

const CalendarStrip = ({ date, events, holidays }: { date: Date, events: CalendarEvent[], holidays: string[] }) => {
    // Generate Data for Current Month and Next Month separately
    const monthsData = useMemo(() => {
        const results = [];
        const currentYear = date.getFullYear();
        const currentMonth = date.getMonth();

        for (let i = 0; i < 2; i++) { // Loop for 2 months
            const loopDate = new Date(currentYear, currentMonth + i, 1);
            const y = loopDate.getFullYear();
            const m = loopDate.getMonth();
            const daysInMonth = new Date(y, m + 1, 0).getDate();

            const days = [];
            for (let d = 1; d <= daysInMonth; d++) {
                days.push(new Date(y, m, d));
            }
            results.push({ year: y, month: m, days });
        }
        return results;
    }, [date.getMonth(), date.getFullYear()]);

    return (
        <div className="flex flex-col bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 rounded-t-2xl border-t border-x border-indigo-200 p-2 w-full backdrop-blur-md shadow-2xl">
            {monthsData.map((monthData, idx) => (
                <div key={idx} className={`flex gap-1 overflow-x-auto custom-scrollbar px-1 items-center h-14 w-full ${idx === 0 ? 'border-b border-indigo-200 mb-1 pb-1' : ''}`}>

                    {/* Month Label Badge */}
                    <div className="flex flex-col items-center justify-center px-2 min-w-[50px] border-r border-indigo-300 h-full bg-white/60 rounded-lg mx-1 shrink-0 sticky left-0 z-20">
                        <span className="text-[9px] font-black text-indigo-700 leading-none mb-0.5">{MONTHS_AR[monthData.month]}</span>
                        <span className="text-[7px] font-bold text-slate-600 leading-none">{monthData.year}</span>
                    </div>

                    {monthData.days.map((d, dIdx) => {
                        // FIX: Use local date string to match events
                        const dStr = toLocalISOString(d);
                        const dayEvents = events.filter(e => e.date === dStr);
                        const isToday = d.toDateString() === new Date().toDateString();
                        const hasEvent = dayEvents.length > 0;
                        // Use holidays from scheduleConfig to determine weekend days
                        const dayName = DAYS_AR[d.getDay()];
                        const normDayName = normalizeArabic(dayName);
                        const isWeekend = holidays.some(h => normalizeArabic(h) === normDayName);

                        return (
                            <div
                                key={dIdx}
                                className={`
                            flex-1 min-w-0 h-full rounded-lg border flex flex-col items-center justify-start pt-1 relative shrink-0 transition-all group overflow-hidden
                            ${isToday ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg scale-105 z-10' :
                                        hasEvent ? 'bg-indigo-100 border-indigo-300 text-indigo-800' :
                                            isWeekend ? 'bg-slate-100 border-slate-200 text-slate-500' :
                                                'bg-white border-indigo-200 text-slate-700'}
                        `}
                                title={hasEvent ? dayEvents.map(e => e.title).join('\n') : ''}
                            >
                                <span className="text-[5px] font-bold opacity-70 leading-none mb-0.5">{DAYS_AR[d.getDay()].split(' ')[0]}</span>
                                <span className="text-[9px] font-black leading-none mb-0.5">{d.getDate()}</span>

                                {/* Event Title */}
                                {hasEvent && dayEvents[0] && (
                                    <div className="w-full px-0.5 text-center">
                                        <span className={`text-[5px] font-black leading-tight line-clamp-2 ${isToday ? 'text-white' : 'text-indigo-900'
                                            }`}>
                                            {dayEvents[0].title}
                                        </span>
                                    </div>
                                )}

                                {/* Event Indicator Dots */}
                                {hasEvent && dayEvents.length > 1 && (
                                    <div className="w-full mt-auto mb-0.5 px-1 flex justify-center gap-0.5">
                                        {dayEvents.slice(0, 3).map((ev, i) => (
                                            <div key={i} className={`h-1 w-1 rounded-full ${ev.eventType === 'EXAM' ? 'bg-rose-600' :
                                                ev.eventType === 'TRIP' ? 'bg-emerald-600' :
                                                    'bg-amber-600'
                                                }`}></div>
                                        ))}
                                    </div>
                                )}

                                {/* Popup Tooltip */}
                                {hasEvent && (
                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[7px] p-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-30 shadow-xl border border-slate-700 w-max max-w-[100px] text-center">
                                        {dayEvents.map(e => <div key={e.id} className="truncate">{e.title}</div>)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

// --- HELPER FUNCTION: CLEAN DISPLAY NAME ---
const formatClassDisplayName = (name: string): string => {
    if (!name) return "";

    let clean = name;
    clean = clean.replace(/\(\d+\)/g, '');
    clean = clean.replace(/\[\d+\]/g, '');
    clean = clean.replace(/(^|\s)\d+-\d+(\s|$)/g, ' ');
    clean = clean.replace(/طبقة/g, '');
    return clean.trim();
};

// --- HELPER: COMPACT SUBJECT MAPPING ---
const getCompactSubjectLabel = (subject: string) => {
    // Remove descriptive suffixes and prefixes (محوسب, تفاضلي, متقدم, etc.)
    let s = subject.trim()
        .replace(/محوسب/g, '')
        .replace(/تفاضلي/g, '')
        .replace(/متقدم/g, '')
        .replace(/أساسي/g, '')
        .replace(/عادي/g, '')
        .replace(/تكميلي/g, '')
        .replace(/إضافي/g, '')
        .replace(/\s+/g, ' ')  // normalize spaces
        .trim();

    // Extract abbreviated name - if subject has multiple words, take the core subject name
    const extractShortName = (full: string) => {
        const words = full.trim().split(/\s+/);
        if (words.length >= 2) {
            // For multi-word subjects, take the last meaningful word (اللغة العربية → العربية)
            return words[words.length - 1];
        }
        return full.substring(0, 6);
    };

    if (s.includes("عربية")) return { text: extractShortName("اللغة العربية"), icon: BookOpen, color: "text-emerald-700" };
    if (s.includes("إنجليزية") || s.toLowerCase().includes("english")) return { text: "English", icon: BookOpen, color: "text-rose-700" };
    if (s.includes("عبرية")) return { text: extractShortName("اللغة العبرية"), icon: Languages, color: "text-blue-700" };
    if (s.includes("رياضيات")) return { text: "رياضيات", icon: Calculator, color: "text-indigo-700" };
    if (s.includes("هندسة")) return { text: "هندسة", icon: Triangle, color: "text-purple-700" };
    if (s.includes("علوم") || s.includes("فيزياء") || s.includes("كيمياء") || s.includes("بيولوجيا")) return { text: "علوم", icon: Microscope, color: "text-teal-700" };
    if (s.includes("تكنولوجيا") || s.includes("حاسوب")) return { text: "حاسوب", icon: Laptop2, color: "text-slate-700" };
    if (s.includes("إسلامية") || s.includes("دين")) return { text: extractShortName("التربية الإسلامية"), icon: Circle, color: "text-emerald-800" };
    if (s.includes("رياضة") || s.includes("بدنية")) return { text: "رياضة", icon: Dumbbell, color: "text-amber-700" };
    if (s.includes("فنون") || s.includes("رسم")) return { text: "فنون", icon: Palette, color: "text-pink-700" };
    if (s.includes("اجتماعيات") || s.includes("تاريخ") || s.includes("جغرافيا")) return { text: "اجتماعيات", icon: Globe2, color: "text-orange-700" };
    if (s.includes("مكوث")) return { text: "مكوث", icon: Coffee, color: "text-amber-800" };
    if (s.includes("فردي")) return { text: "فردي", icon: Users, color: "text-blue-800" };
    if (s.includes("حياة") || s.includes("مهارات")) return { text: "مهارات", icon: HeartHandshake, color: "text-violet-700" };

    // Default Fallback - extract abbreviated form from cleaned string
    return { text: extractShortName(s), icon: null, color: "text-slate-700" };
};

// --- MAIN COMPONENT ---

const BulletinBoard: React.FC<BulletinBoardProps> = ({
    scheduleConfig, employees, classes, lessons, events,
    substitutionLogs, absences, engineContext
}) => {
    const [now, setNow] = useState(new Date()); // Real-time clock
    const [viewDate, setViewDate] = useState(new Date()); // The date currently being viewed
    const tableRef = useRef<HTMLDivElement>(null);

    // Load Duty Management Data from localStorage
    const [dutyAssignments, setDutyAssignments] = useState<any[]>(() => {
        try {
            const stored = localStorage.getItem('dutyAssignments');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const [facilities, setFacilities] = useState<any[]>(() => {
        try {
            const stored = localStorage.getItem('dutyFacilities');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const [breakPeriodsData, setBreakPeriodsData] = useState<any[]>(() => {
        try {
            const stored = localStorage.getItem('dutyBreakPeriods');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Custom Class Order State
    const [classOrder, setClassOrder] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('bulletin_class_order');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Save order when changed
    useEffect(() => {
        localStorage.setItem('bulletin_class_order', JSON.stringify(classOrder));
    }, [classOrder]);

    const shiftDate = (days: number) => {
        const next = new Date(viewDate);
        next.setDate(next.getDate() + days);
        setViewDate(next);
    };

    const resetToToday = () => {
        setViewDate(new Date());
    };

    // FIX: Use toLocalISOString to ensure matches with data
    const todayStr = toLocalISOString(viewDate);
    const dayName = DAYS_AR[viewDate.getDay()];
    const normDayName = normalizeArabic(dayName);
    const isHoliday = (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normDayName);
    const isViewingToday = viewDate.toDateString() === new Date().toDateString();

    // 1. Live Status & Modes
    const liveStatus = useMemo(() => getLiveSchoolStatus(scheduleConfig), [scheduleConfig, now]);
    const activeModes = (Object.values(engineContext) as ModeConfig[]).filter(m => m.isActive);

    // Helper to check active mode for period
    const getActiveModeForPeriod = (period: number) => {
        return activeModes.find(m => m.affectedPeriods.includes(period));
    };

    // Holiday Logic Override
    const activeModeLabel = isHoliday ? "عطلة رسمية" : (activeModes.length > 0 ? activeModes[0].name : "الوضع الطبيعي");

    // 2. Weekly Staff Meetings Extraction (From Lessons + Schedule Config)
    const weeklyStaffMeetings = useMemo(() => {
        const uniqueMeetings = new Map<string, { title: string, day: string, period: number }>();

        // A. From Lessons (Legacy/Manual)
        lessons.forEach(l => {
            const subj = l.subject.trim();
            const normSubj = normalizeArabic(subj);
            const words = normSubj.split(/\s+/);

            // DEBUGGING: Log to console to verify what is being processed
            if (subj.includes('طاقم') || subj.includes('اجتماع')) {
                console.log(`[Meeting Check] Subject: "${subj}", Norm: "${normSubj}", Contains Taqam: ${normSubj.includes('طاقم')}, Has Ijtimaa Word: ${words.includes('اجتماع')}`);
            }

            // Looser Logic:
            // 1. Any subject containing 'طاقم' (after normalization) is a meeting.
            // 2. Any subject containing the WORD 'اجتماع' is a meeting.
            const isMeeting =
                normSubj.includes('طاقم') || // Matches 'طاقم لغة...', 'طاقم رياضيات', etc.
                words.includes('اجتماع') || // Matches 'اجتماع عام', 'اجتماع مربين'
                words.includes('إجتماع') || // Fallback just in case normalization missed it
                subj.includes('طاقم'); // Raw check fallback

            if (isMeeting) {
                const key = `${subj}-${l.day}-${l.period}`;
                if (!uniqueMeetings.has(key)) {
                    uniqueMeetings.set(key, { title: subj, day: l.day, period: l.period });
                }
            }
        });

        // B. From Schedule Config (Structure) - if defined
        if (scheduleConfig.structure?.meetings) {
            scheduleConfig.structure.meetings.forEach((m: any) => {
                const key = `${m.name}-${m.day}-${m.period}`;
                if (!uniqueMeetings.has(key)) {
                    uniqueMeetings.set(key, { title: m.name, day: m.day, period: m.period });
                }
            });
        }

        return Array.from(uniqueMeetings.values()).sort((a, b) => {
            const dayOrder = { "الأحد": 1, "الاثنين": 2, "الثلاثاء": 3, "الأربعاء": 4, "الخميس": 5, "الجمعة": 6, "السبت": 7 };
            const dayDiff = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
            if (dayDiff !== 0) return dayDiff;
            return a.period - b.period;
        });
    }, [lessons, scheduleConfig.structure]);

    // 3. Timing Changes
    const activeBreakAction = activeModes.find(m => m.breakAction !== 'none')?.breakAction || 'none';
    const timingAlert = activeBreakAction !== 'none'
        ? (activeBreakAction === 'internal' ? 'استراحات داخلية' : 'دمج استراحات')
        : 'توقيت اعتيادي';

    // 4. Dynamic Columns based on Saved Order
    const sortedClasses = useMemo(() => {
        // Default Sort (Grade -> Name)
        const defaultSort = [...classes].sort((a, b) => {
            if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
            return a.name.localeCompare(b.name, 'ar');
        });

        if (classOrder.length === 0) return defaultSort;

        const ordered: ClassItem[] = [];
        const classMap = new Map<string, ClassItem>();
        classes.forEach(c => classMap.set(c.id, c));

        // Add known classes in order
        classOrder.forEach(id => {
            const cls = classMap.get(id);
            if (cls) {
                ordered.push(cls);
                classMap.delete(id);
            }
        });

        // Append any new/remaining classes
        const remaining = Array.from(classMap.values()).sort((a, b) => {
            if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
            return a.name.localeCompare(b.name, 'ar');
        });

        return [...ordered, ...remaining];
    }, [classes, classOrder]);

    // Sync classOrder state if classes change significantly (optional, helps keep state clean)
    useEffect(() => {
        if (sortedClasses.length > 0 && classOrder.length !== sortedClasses.length) {
            setClassOrder(sortedClasses.map(c => c.id));
        }
    }, [sortedClasses]);

    const moveClass = (fromIndex: number, direction: 'right' | 'left') => {
        const newOrder = sortedClasses.map(c => c.id);
        // RTL: Right is earlier index (-1), Left is later index (+1)
        const toIndex = direction === 'right' ? fromIndex - 1 : fromIndex + 1;

        if (toIndex >= 0 && toIndex < newOrder.length) {
            // Swap
            [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]];
            setClassOrder(newOrder);
        }
    };

    // 5. Grid Data
    const periods = Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1);

    // 6. Absences List
    const todaysAbsences = useMemo(() => {
        return absences.filter(a => a.date === todayStr).map(a => {
            const emp = employees.find(e => e.id === a.teacherId);
            return emp ? emp.name : 'غير معروف';
        });
    }, [absences, employees, todayStr]);

    // 7. Live Resources (Stay/Individual Teachers available NOW)
    const currentAvailableResources = useMemo(() => {
        if (!isViewingToday || liveStatus.state !== 'IN_PERIOD' || !liveStatus.currentPeriod) return [];

        const currentP = liveStatus.currentPeriod;
        const day = DAYS_AR[now.getDay()];

        return lessons.filter(l =>
            l.day === day &&
            l.period === currentP &&
            (l.type === 'stay' || l.type === 'individual')
        ).map(l => {
            const emp = employees.find(e => e.id === l.teacherId);
            if (!emp) return null;
            // Filter out if absent today
            if (todaysAbsences.includes(emp.name)) return null;

            return {
                name: emp.name,
                type: l.type,
                subject: l.subject
            };
        }).filter(Boolean) as { name: string, type: string, subject: string }[];

    }, [isViewingToday, liveStatus, lessons, employees, todaysAbsences, now]);

    // 8. Timeline Generation
    const timelinePattern = useMemo(() => generatePatternFromConfig(scheduleConfig), [scheduleConfig]);

    // 9. Current/Next Duty Logic
    const currentDutyState = useMemo(() => {
        if (breakPeriodsData.length === 0) return null;

        const nowMins = now.getHours() * 60 + now.getMinutes();
        const activeBreak = breakPeriodsData.find(bp => {
            const start = timeToMins(bp.startTime);
            const end = timeToMins(bp.endTime);
            // Show during break and 5 mins before
            return nowMins >= (start - 5) && nowMins < end;
        });

        if (activeBreak) {
            const assignments = dutyAssignments.filter(d =>
                d.breakPeriodId === activeBreak.id &&
                d.date === todayStr
            );

            // Map to rich objects
            const richAssignments = assignments.map(a => {
                const facility = facilities.find(f => f.id === a.facilityId);
                const teacher = employees.find(e => e.id === a.teacherId);
                return {
                    id: a.id,
                    facilityName: facility?.name || 'موقع غير محدد',
                    teacherName: teacher?.name || 'غير محدد',
                    locationType: facility?.locationType || 'internal'
                };
            });

            return {
                status: 'ACTIVE',
                breakName: activeBreak.name,
                assignments: richAssignments
            };
        }

        // If no active break, find next one
        const nextBreak = breakPeriodsData
            .map(bp => ({ ...bp, start: timeToMins(bp.startTime) }))
            .filter(bp => bp.start > nowMins)
            .sort((a, b) => a.start - b.start)[0];

        if (nextBreak) {
            const assignments = dutyAssignments.filter(d =>
                d.breakPeriodId === nextBreak.id &&
                d.date === todayStr
            );
            const richAssignments = assignments.map(a => {
                const facility = facilities.find(f => f.id === a.facilityId);
                const teacher = employees.find(e => e.id === a.teacherId);
                return {
                    id: a.id,
                    facilityName: facility?.name || 'موقع غير محدد',
                    teacherName: teacher?.name || 'غير محدد',
                    locationType: facility?.locationType || 'internal'
                };
            });

            return {
                status: 'NEXT',
                breakName: nextBreak.name,
                startTime: nextBreak.startTime,
                assignments: richAssignments
            };
        }

        return null;
    }, [breakPeriodsData, dutyAssignments, facilities, employees, now, todayStr]);

    return (
        <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 text-slate-800 font-sans flex flex-col text-[10px]" dir="rtl">

            {/* --- A) HEADER (Compact) --- */}
            <header className="h-10 bg-white/80 backdrop-blur-md border-b border-indigo-200 flex items-center justify-between px-4 shrink-0 z-50 shadow-lg relative">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center shadow-lg shadow-indigo-300/30">
                        <Activity className="text-white animate-pulse-slow" size={14} />
                    </div>
                    <div>
                        <h1 className="text-xs font-black text-indigo-900 tracking-tighter hidden md:block">لوحة الإعلانات المركزية</h1>
                    </div>
                </div>

                {/* School Identity in Center */}
                {(scheduleConfig.schoolInfo?.logo || scheduleConfig.schoolInfo?.name) && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                        {scheduleConfig.schoolInfo?.logo && (
                            <div className="w-7 h-7 rounded-lg border border-indigo-200 bg-white/60 backdrop-blur-sm p-1 shadow-md flex items-center justify-center overflow-hidden">
                                <img src={scheduleConfig.schoolInfo.logo} alt="School Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                        )}
                        {scheduleConfig.schoolInfo?.name && (
                            <span className="text-sm font-black text-slate-700 drop-shadow-sm hidden md:block">{scheduleConfig.schoolInfo.name}</span>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {todaysAbsences.length > 3 && (
                        <StatusBadge label={`غياب (${todaysAbsences.length})`} icon={AlertTriangle} colorClass="bg-rose-100 border-rose-300 text-rose-800" pulse />
                    )}
                    <StatusBadge
                        label={activeModeLabel}
                        icon={isHoliday ? Coffee : Zap}
                        colorClass={isHoliday ? "bg-rose-100 border-rose-300 text-rose-800" : activeModes.length > 0 ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-emerald-100 border-emerald-300 text-emerald-800"}
                    />

                    {/* --- TIMING WIDGET (Compact) --- */}
                    <div className="hidden lg:flex items-center gap-2 bg-white/60 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-indigo-200 shadow-inner mx-1">
                        <div className="flex items-center gap-1.5 border-l border-indigo-200 pl-2 ml-1">
                            <Clock size={10} className={timingAlert === 'توقيت اعتيادي' ? "text-emerald-600" : "text-amber-600"} />
                            <span className={`text-[8px] font-black ${timingAlert === 'توقيت اعتيادي' ? 'text-emerald-600' : 'text-amber-600'}`}>{timingAlert === 'توقيت اعتيادي' ? 'عادي' : 'معدل'}</span>
                        </div>

                        <div className="flex flex-col items-center justify-center leading-none min-w-[20px]">
                            <span className="text-[6px] text-slate-600 font-bold uppercase mb-0.5">الحصة</span>
                            <span className="text-[10px] font-black text-slate-800">{isViewingToday ? (liveStatus.currentPeriod || '-') : '-'}</span>
                        </div>

                        <div className="w-px h-3 bg-indigo-200 mx-0.5"></div>

                        <div className="flex flex-col items-center justify-center leading-none min-w-[30px]">
                            <span className="text-[6px] text-slate-600 font-bold uppercase mb-0.5">متبقي</span>
                            <span className="text-[10px] font-black text-indigo-600 tabular-nums">{isViewingToday ? `${liveStatus.minsRemainingInSlot}m` : '-'}</span>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-indigo-200 mx-1 hidden md:block"></div>

                    <div className="text-left flex flex-col items-end">
                        <span className="block text-sm font-black text-indigo-900 tabular-nums leading-none mb-0.5">
                            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>

                        {/* DATE NAVIGATION */}
                        <div className="flex items-center gap-1 bg-white/60 backdrop-blur-sm p-0.5 rounded border border-indigo-200">
                            <button onClick={() => shiftDate(1)} className="p-0.5 text-slate-600 hover:text-indigo-900 hover:bg-indigo-100 rounded transition-colors"><ChevronRight size={10} /></button>
                            <span className="text-[8px] font-bold text-slate-700 uppercase tracking-widest min-w-[60px] text-center truncate">
                                {dayName} | {viewDate.toLocaleDateString('en-GB')}
                            </span>
                            <button onClick={() => shiftDate(-1)} className="p-0.5 text-slate-600 hover:text-indigo-900 hover:bg-indigo-100 rounded transition-colors"><ChevronLeft size={10} /></button>

                            {!isViewingToday && (
                                <button onClick={resetToToday} className="p-0.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors ml-0.5" title="عودة لليوم">
                                    <RotateCcw size={10} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* --- MAIN BODY --- */}
            <div className="flex-1 p-2 min-h-0 overflow-hidden flex flex-col gap-2">

                {/* TOP SECTION: (Cards + Grid) */}
                <div className="flex flex-col lg:flex-row gap-2 h-[58%] min-h-0">

                    {/* LEFT PANEL CARDS */}
                    <div className="w-full lg:w-[18%] xl:w-[15%] flex flex-col gap-2 min-h-0 h-full">

                        {/* 1. LIVE RESOURCES */}
                        <div className="bg-white/70 backdrop-blur-md rounded-xl border border-emerald-200 p-2 flex flex-col gap-1 shadow-lg shrink-0 h-[25%] relative overflow-hidden transition-all">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100/50 rounded-bl-full pointer-events-none"></div>
                            <div className="flex items-center gap-1.5 border-b border-emerald-200 pb-1.5 relative z-10 shrink-0">
                                <Zap size={12} className="text-emerald-600" />
                                <span className="text-[9px] font-black text-slate-700">متاحون الآن (حصة {liveStatus.currentPeriod || '-'})</span>
                                {currentAvailableResources.length > 0 && <span className="mr-auto text-[8px] bg-emerald-100 text-emerald-700 px-1.5 rounded-full font-bold">{currentAvailableResources.length}</span>}
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
                                {currentAvailableResources.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 content-start">
                                        {currentAvailableResources.map((res, i) => (
                                            <div key={i} className="flex items-center gap-1 px-1.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg shrink-0">
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${res.type === 'stay' ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
                                                <div className="flex items-center gap-0.5">
                                                    <span className="text-[8px] font-black text-slate-800 whitespace-nowrap">{res.name}</span>
                                                    <span className={`text-[6px] font-bold px-1 py-0.5 rounded ${res.type === 'stay' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{res.type === 'stay' ? 'مكوث' : 'فردي'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1 opacity-60">
                                        <Coffee size={16} />
                                        <span className="text-[8px] font-bold italic">لا معلمين متاحين</span>
                                    </div>
                                )}
                            </div>
                        </div>



                        {/* 2. STAFF MEETINGS CARD */}
                        <div className="bg-white/70 backdrop-blur-md rounded-xl border border-amber-200 p-2 flex flex-col gap-1 shadow-lg shrink-0 flex-1 min-h-0 relative overflow-hidden">
                            <div className="flex items-center gap-1.5 border-b border-amber-200 pb-1.5 relative z-10 shrink-0">
                                <Users size={12} className="text-amber-600" />
                                <span className="text-[9px] font-black text-slate-700">اجتماعات الطواقم</span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
                                {weeklyStaffMeetings.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-1 content-start">
                                        {weeklyStaffMeetings.map((m, i) => (
                                            <div key={i} className="flex flex-col bg-amber-50 p-1 rounded-lg border border-amber-200 group hover:border-amber-400 transition-colors">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[6px] text-amber-700 font-bold bg-amber-100 px-0.5 rounded border border-amber-300">{m.day.split(' ')[0]}</span>
                                                    <div className="flex items-center gap-0.5">
                                                        <span className="text-[6px] text-slate-600">ح</span>
                                                        <span className="text-[7px] font-black text-amber-700 leading-none">{m.period}</span>
                                                    </div>
                                                </div>
                                                <span className="block text-[7px] font-black text-slate-800 leading-tight truncate" title={m.title}>{m.title.replace('اجتماع', '').trim()}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1 opacity-60">
                                        <CalendarDays size={16} />
                                        <span className="text-[8px] font-bold italic">لا اجتماعات</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. ABSENCE LIST CARD */}
                        <div className="bg-white/70 backdrop-blur-md rounded-xl border border-rose-200 p-2 flex flex-col gap-1 shadow-lg h-[25%] shrink-0 relative overflow-hidden">
                            <div className="flex items-center gap-1.5 border-b border-rose-200 pb-1.5 relative z-10 shrink-0">
                                <UserX size={12} className="text-rose-600" />
                                <span className="text-[9px] font-black text-slate-700">الغياب اليومي</span>
                                <span className="mr-auto text-[8px] bg-rose-100 text-rose-700 px-1.5 rounded-full font-bold">{todaysAbsences.length}</span>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar pr-1 relative z-10">
                                {todaysAbsences.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 content-start">
                                        {todaysAbsences.map((name, i) => (
                                            <div key={i} className="flex items-center gap-1 px-1.5 py-1 bg-rose-50 border border-rose-200 rounded-lg shrink-0">
                                                <div className="w-1 h-1 bg-rose-500 rounded-full shrink-0"></div>
                                                <span className="text-[8px] font-bold text-slate-800 whitespace-nowrap">{name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-emerald-600/70 gap-1 h-full">
                                        <CheckCircle2 size={16} />
                                        <span className="text-[8px] font-bold">الحضور مكتمل</span>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* RIGHT PANEL: SCHEDULE TABLE (COMPRESSED) */}
                    <div className="flex-1 bg-white/70 backdrop-blur-md rounded-xl border border-indigo-400 shadow-2xl relative overflow-hidden flex flex-col min-h-0">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 z-50"></div>

                        {/* Scrollable Container */}
                        <div className="flex-1 flex flex-col h-full overflow-hidden" ref={tableRef}>
                            <table className="w-full h-full border-collapse table-fixed">
                                {/* Header */}
                                <thead className="bg-indigo-50/80 backdrop-blur-sm shadow-lg relative z-20">
                                    <tr className="h-7">
                                        <th className="w-16 border-l border-b border-indigo-400 bg-indigo-100/60 text-[10px] font-black text-black sticky right-0 z-30">#</th>
                                        {sortedClasses.map((cls, idx) => (
                                            <th
                                                key={idx}
                                                className={`border-l border-b border-indigo-400/70 relative group/header transition-colors p-0.5 ${cls.type === 'special' ? 'bg-indigo-100/50' : 'bg-white/40'}`}
                                            >
                                                <div className="flex items-center justify-center h-full w-full relative">
                                                    {/* Reordering Controls */}
                                                    <div className="absolute inset-0 flex justify-between items-center px-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity pointer-events-none group-hover/header:pointer-events-auto bg-white/95 backdrop-blur-sm z-10">
                                                        <button
                                                            onClick={() => moveClass(idx, 'right')}
                                                            className="p-0.5 bg-indigo-100 hover:bg-indigo-500 rounded text-slate-600 hover:text-white disabled:opacity-0"
                                                            disabled={idx === 0}
                                                            title="يمين"
                                                        >
                                                            <ArrowRight size={8} />
                                                        </button>
                                                        <button
                                                            onClick={() => moveClass(idx, 'left')}
                                                            className="p-0.5 bg-indigo-100 hover:bg-indigo-500 rounded text-slate-600 hover:text-white disabled:opacity-0"
                                                            disabled={idx === sortedClasses.length - 1}
                                                            title="يسار"
                                                        >
                                                            <ArrowLeft size={8} />
                                                        </button>
                                                    </div>
                                                    <span className={`text-[9px] font-black text-center leading-tight whitespace-nowrap px-1 ${cls.type === 'special' ? 'text-indigo-950' : 'text-black'}`}>
                                                        {formatClassDisplayName(cls.name)}
                                                    </span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                {/* Body */}
                                <tbody>
                                    {timelinePattern.periods.map((slot, slotIdx) => {
                                        const p = slot.period || 0;
                                        const isCurrentPeriod = isViewingToday && liveStatus.currentPeriod === p && liveStatus.state === 'IN_PERIOD';
                                        const activeMode = slot.break ? null : getActiveModeForPeriod(p);

                                        // Check if current time is in this break
                                        const nowMins = now.getHours() * 60 + now.getMinutes();
                                        const slotStartMins = timeToMins(slot.start);
                                        const slotEndMins = timeToMins(slot.end);
                                        const isCurrentBreak = slot.break && isViewingToday && nowMins >= slotStartMins && nowMins < slotEndMins;

                                        // Check if this period has any lessons scheduled
                                        if (!slot.break && p > 0) {
                                            const hasLessons = sortedClasses.some(cls => {
                                                const lesson = lessons.find(l =>
                                                    l.classId === cls.id &&
                                                    l.period === p &&
                                                    l.day === dayName
                                                );
                                                return lesson !== undefined;
                                            });

                                            // Hide row if no lessons scheduled for this period
                                            if (!hasLessons) {
                                                return null;
                                            }
                                        }

                                        if (slot.break) {
                                            // BREAK ROW
                                            return (
                                                <tr key={`break-${slotIdx}`} className={`border-b border-amber-400/60 transition-all ${isCurrentBreak ? 'bg-amber-100/40 h-3' : 'bg-amber-50/20 h-2.5'
                                                    }`}>
                                                    {/* Break Cell */}
                                                    <td className={`w-16 border-l border-amber-200/50 sticky right-0 z-10 backdrop-blur-sm text-center align-middle p-0 ${isCurrentBreak ? 'bg-amber-200/80 shadow-lg' : 'bg-amber-50/60'
                                                        }`}>
                                                        <div className="flex items-center justify-center h-full gap-0.5">
                                                            <span className="text-[7px] filter drop-shadow-sm">☕</span>
                                                            <span className="text-[5px] font-black text-amber-950 leading-none">
                                                                {slot.name === 'استراحة قصيرة' ? 'استراحة' : 'استراحة'}
                                                            </span>
                                                            <span className="text-[4px] font-bold text-amber-800 font-mono leading-none">{slot.start}</span>
                                                        </div>
                                                    </td>
                                                    {/* Empty cells for classes */}
                                                    {sortedClasses.map((cls, idx) => (
                                                        <td key={idx} className="border-l border-amber-200/30 bg-amber-50/10 text-center align-middle">
                                                            <span className="text-[7px] text-amber-600">―</span>
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        }

                                        // PERIOD ROW
                                        return (
                                            <tr key={p} className={`border-b border-indigo-300/70 last:border-0 transition-all ${isCurrentPeriod ? 'bg-indigo-100/40 h-16' : 'hover:bg-indigo-50/30 h-14'
                                                }`}>
                                                {/* Sticky Period Cell - WITH TIMELINE */}
                                                <td className={`w-16 border-l border-indigo-400/70 sticky right-0 z-10 backdrop-blur-sm text-center align-middle p-1 ${isCurrentPeriod ? 'bg-indigo-200/90 text-indigo-950 border-l-indigo-400 shadow-xl' :
                                                    activeMode ? 'bg-indigo-100/70 text-indigo-900' :
                                                        'bg-indigo-50/95 text-slate-900'
                                                    }`}>
                                                    <div className="flex flex-col items-center justify-center h-full relative overflow-hidden gap-0.5">
                                                        {activeMode && <div className="absolute inset-0 bg-indigo-300/20 animate-pulse-slow pointer-events-none"></div>}

                                                        {/* Icon (first/last/break) */}
                                                        {p === 1 && (
                                                            <span className="text-[12px] filter drop-shadow-sm">🔔</span>
                                                        )}
                                                        {p === scheduleConfig.periodsPerDay && (
                                                            <span className="text-[12px] filter drop-shadow-sm">🏁</span>
                                                        )}

                                                        {/* Period Number */}
                                                        <span className={`text-[11px] font-black leading-none ${isCurrentPeriod ? 'text-black' : activeMode ? 'text-indigo-950' : 'text-slate-950'
                                                            }`}>حصة {p}</span>

                                                        {/* Time */}
                                                        <span className="text-[7px] font-black text-slate-800 font-mono leading-none">
                                                            {timelinePattern.periods.find(slot => slot.period === p)?.start || ''}
                                                        </span>

                                                        {/* Progress Bar (only for current) */}
                                                        {isCurrentPeriod && (() => {
                                                            const currentSlot = timelinePattern.periods.find(slot => slot.period === p);
                                                            if (currentSlot) {
                                                                const startMins = timeToMins(currentSlot.start);
                                                                const endMins = timeToMins(currentSlot.end);
                                                                const nowMins = now.getHours() * 60 + now.getMinutes();
                                                                const progress = Math.min(100, Math.max(0, ((nowMins - startMins) / (endMins - startMins)) * 100));
                                                                return (
                                                                    <div className="w-full h-1 bg-slate-300 rounded-full overflow-hidden mt-0.5">
                                                                        <div
                                                                            className="h-full bg-indigo-600 transition-all duration-1000"
                                                                            style={{ width: `${progress}%` }}
                                                                        ></div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}

                                                        {activeMode && <span className="text-[5px] font-bold text-indigo-800 leading-none">{activeMode.name.split(' ')[0]}</span>}
                                                    </div>
                                                </td>

                                                {/* Class Cells */}
                                                {sortedClasses.map((cls, cIdx) => {
                                                    // PRIORITY: Show main (core) subject lesson, add suffix for specialized lessons
                                                    // Find all matching lessons for this class/period/day
                                                    const matchingLessons = lessons.filter(l => l.classId === cls.id && l.period === p && l.day === dayName && l.type === 'actual');

                                                    // Define core/main subjects (المواد الأساسية)
                                                    const coreSubjects = ['عربي', 'إنجليزي', 'english', 'عبري', 'رياضيات', 'هندسة', 'علوم', 'فيزياء', 'كيمياء', 'بيولوجيا',
                                                        'اجتماعيات', 'تاريخ', 'جغرافيا', 'دين', 'إسلامية', 'تربية', 'مرورية', 'رياضة', 'بدنية', 'فنون', 'رسم',
                                                        'حاسوب', 'تكنولوجيا', 'مهارات', 'حياة', 'لغة'];

                                                    // Find main/core lesson (not محوسب, تفاضلي, or non-core subjects)
                                                    const mainLesson = matchingLessons.find(l => {
                                                        const subj = l.subject.toLowerCase();
                                                        // Must not contain specialized keywords
                                                        if (subj.includes('محوسب') || subj.includes('تفاضلي')) return false;
                                                        // Must contain at least one core subject keyword
                                                        return coreSubjects.some(core => subj.includes(core));
                                                    });

                                                    // Check for specialized lessons
                                                    const hasComputerized = matchingLessons.some(l => l.subject.includes('محوسب'));
                                                    const hasDifferential = matchingLessons.some(l => l.subject.includes('تفاضلي'));

                                                    // Check for additional non-core subjects (like ماتيا)
                                                    const hasAdditional = matchingLessons.some(l => {
                                                        const subj = l.subject.toLowerCase();
                                                        // Not محوسب/تفاضلي but also not in core subjects
                                                        if (subj.includes('محوسب') || subj.includes('تفاضلي')) return false;
                                                        return !coreSubjects.some(core => subj.includes(core));
                                                    });

                                                    // Build suffix: م (محوسب), ض (تفاضلي), + (إضافي)
                                                    let suffix = '';
                                                    if (hasComputerized) suffix += 'م';
                                                    if (hasDifferential) suffix += 'ض';
                                                    if (hasAdditional) suffix += '+';

                                                    // Use main lesson if exists, otherwise fall back to any actual/individual/stay
                                                    const lesson = mainLesson ||
                                                        matchingLessons[0] ||
                                                        lessons.find(l => l.classId === cls.id && l.period === p && l.day === dayName && l.type === 'individual') ||
                                                        lessons.find(l => l.classId === cls.id && l.period === p && l.day === dayName && l.type === 'stay');
                                                    // FIX: use todayStr generated from local time to find substitutes
                                                    const subLog = substitutionLogs.find(s => s.date === todayStr && s.classId === cls.id && s.period === p);

                                                    // NEW: Check if teacher is absent today
                                                    const teacherAbsence = lesson ? absences.find(a =>
                                                        a.teacherId === lesson.teacherId &&
                                                        a.date === todayStr &&
                                                        (a.type === 'FULL' || (a.affectedPeriods && a.affectedPeriods.includes(p)))
                                                    ) : null;
                                                    const isTeacherAbsent = !!teacherAbsence && !subLog; // Absent but NOT covered yet

                                                    // NEW: Check for Event
                                                    const classEvent = events.find(e =>
                                                        e.date === todayStr &&
                                                        e.appliesTo.periods.includes(p) &&
                                                        e.appliesTo.classes.includes(cls.id)
                                                    );

                                                    let content = null;
                                                    let cellClass = "";

                                                    // PRIORITIZE EVENT STYLING
                                                    if (classEvent) {
                                                        cellClass = classEvent.eventType === 'EXAM'
                                                            ? "bg-indigo-500/20 border-indigo-500/40"
                                                            : "bg-emerald-500/20 border-emerald-500/40";
                                                    } else if (isTeacherAbsent) {
                                                        // RED HIGHLIGHT for absent teacher's lessons (not yet covered)
                                                        cellClass = "bg-rose-500/30 border-rose-500/50 ring-2 ring-rose-400/50";
                                                    } else if (activeMode && activeMode.target !== 'specific_classes') {
                                                        // If global mode applies (not specific class target)
                                                        // Add subtle tint to indicate mode is active for this period
                                                        cellClass = "bg-indigo-500/5";
                                                    }

                                                    if (lesson) {
                                                        const teacher = employees.find(e => e.id === lesson.teacherId);
                                                        // Format: First name + first 2 letters of last name
                                                        let teacherName = '?';
                                                        if (teacher) {
                                                            const nameParts = teacher.name.trim().split(' ');
                                                            if (nameParts.length >= 2) {
                                                                const firstName = nameParts[0];
                                                                const lastName = nameParts[nameParts.length - 1];
                                                                teacherName = `${firstName} ${lastName.substring(0, 2)}`;
                                                            } else {
                                                                teacherName = nameParts[0] || '?';
                                                            }
                                                        }

                                                        // COMPACT SUBJECT DISPLAY
                                                        const { text: subjectText, icon: SubjectIcon, color: subjectColor } = getCompactSubjectLabel(lesson.subject);

                                                        if (subLog) {
                                                            // Substituted - Format substitute name
                                                            let substituteName = subLog.substituteName;
                                                            const subNameParts = subLog.substituteName.trim().split(' ');
                                                            if (subNameParts.length >= 2) {
                                                                const subFirstName = subNameParts[0];
                                                                const subLastName = subNameParts[subNameParts.length - 1];
                                                                substituteName = `${subFirstName} ${subLastName.substring(0, 2)}`;
                                                            } else {
                                                                substituteName = subNameParts[0] || '?';
                                                            }

                                                            // Highlight substitution clearly
                                                            cellClass = subLog.type === 'assign_external' ? "bg-amber-600/30 border-amber-500" : "bg-emerald-600/30 border-emerald-500";

                                                            content = (
                                                                <div className="flex flex-col items-center justify-center w-full h-full p-0.5 relative animate-pulse-slow">
                                                                    {classEvent && (
                                                                        <div className={`absolute top-0 right-0 text-[5px] font-black px-1 rounded-bl shadow-sm ${classEvent.eventType === 'EXAM' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                                            {classEvent.eventType === 'EXAM' ? 'امتحان' : 'نشاط'}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-center gap-0.5 leading-tight mb-0.5">
                                                                        <span className="text-[8px] font-black text-slate-800 truncate max-w-full opacity-60 line-through decoration-slate-700">{teacherName}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-white bg-slate-950/70 px-1.5 py-0.5 rounded text-[8px] font-black truncate max-w-full shadow-sm border border-white/10">
                                                                        <RotateCcw size={8} className={subLog.type === 'assign_external' ? "text-amber-400" : "text-emerald-400"} />
                                                                        {substituteName}
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else {
                                                            // Normal - NEW ORDER: Icon - Subject - Teacher
                                                            // Check if teacher is absent (add red indicator)
                                                            const absentIndicator = isTeacherAbsent ? (
                                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full flex items-center justify-center animate-pulse shadow-lg border border-white z-10">
                                                                    <UserX size={8} className="text-white" />
                                                                </div>
                                                            ) : null;

                                                            content = (
                                                                <div className={`flex flex-col items-center justify-center w-full h-full p-0.5 group relative ${isTeacherAbsent ? 'opacity-80' : ''}`}>
                                                                    {absentIndicator}
                                                                    {classEvent && (
                                                                        <div className={`absolute top-0 right-0 text-[5px] font-black px-1 rounded-bl shadow-sm ${classEvent.eventType === 'EXAM' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                                            {classEvent.eventType === 'EXAM' ? 'امتحان' : 'نشاط'}
                                                                        </div>
                                                                    )}
                                                                    {/* Icon + Subject Name */}
                                                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                                                        {SubjectIcon && (
                                                                            <SubjectIcon size={14} className={`${isTeacherAbsent ? 'text-rose-600' : subjectColor}`} strokeWidth={2.5} />
                                                                        )}
                                                                        <span className={`text-[8px] font-black ${isTeacherAbsent ? 'text-rose-700' : subjectColor} truncate group-hover:text-black transition-colors max-w-full`}>{subjectText}</span>
                                                                    </div>
                                                                    {/* Teacher Name below with suffix (م or ض) */}
                                                                    <div className="flex items-center gap-0.5 mt-0.5">
                                                                        <span className={`text-[7px] font-bold ${isTeacherAbsent ? 'text-rose-600 line-through' : 'text-slate-700'} truncate group-hover:text-black max-w-full`}>{teacherName}</span>
                                                                        {suffix && <span className="text-[6px] font-black text-indigo-600 bg-indigo-100 px-0.5 rounded leading-none">{suffix}</span>}
                                                                        {isTeacherAbsent && <span className="text-[6px] font-black text-rose-600 bg-rose-100 px-0.5 rounded leading-none">غائب</span>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    } else {
                                                        // Empty slot but has event?
                                                        if (classEvent) {
                                                            cellClass = classEvent.eventType === 'EXAM'
                                                                ? "bg-indigo-500/20 border-indigo-500/40"
                                                                : "bg-emerald-500/20 border-emerald-500/40";
                                                            content = (
                                                                <div className="flex flex-col items-center justify-center w-full h-full p-0.5">
                                                                    <span className={`text-[10px] font-black ${classEvent.eventType === 'EXAM' ? 'text-indigo-900' : 'text-emerald-900'}`}>
                                                                        {classEvent.eventType === 'EXAM' ? 'امتحان' : 'فعالية'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        } else {
                                                            content = <span className="text-slate-600 text-[12px] font-black select-none opacity-30">·</span>;
                                                        }
                                                    }

                                                    return (
                                                        <td key={`${p}-${cIdx}`} className={`border-l border-indigo-400/50 p-0 relative transition-colors ${cellClass} ${isCurrentPeriod ? 'border-indigo-500/60' : ''}`}>
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                {content}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* --- TIMELINE SECTION (HIDDEN - KEPT FOR ROLLBACK) --- */}
                <div className="hidden w-full h-[15%] bg-gradient-to-br from-indigo-200 via-purple-200 to-blue-200 rounded-xl border border-indigo-300 shadow-xl relative overflow-hidden flex items-center px-4 md:px-8">
                    <div className="absolute inset-0 bg-white/30 backdrop-blur-sm z-0"></div>

                    {/* Progress Line */}
                    <div className="absolute left-4 right-4 h-1 bg-indigo-300 rounded-full top-1/2 -translate-y-1/2 z-0"></div>

                    <div className="relative z-10 w-full flex justify-between items-center h-full">
                        {timelinePattern.periods.map((slot, idx) => {
                            const startMins = timeToMins(slot.start);
                            const endMins = timeToMins(slot.end);
                            const nowMins = now.getHours() * 60 + now.getMinutes();
                            const activeMode = getActiveModeForPeriod(slot.period || 0);

                            let status = 'FUTURE';
                            if (nowMins >= endMins) status = 'PAST';
                            else if (nowMins >= startMins) status = 'CURRENT';

                            // Determine if it's first or last slot
                            const isFirstSlot = idx === 0;
                            const isLastSlot = idx === timelinePattern.periods.length - 1;

                            return (
                                <div key={idx} className="flex flex-col items-center justify-center relative group" style={{ flex: slot.break ? 0.5 : 1 }}>
                                    {/* Dot */}
                                    <div className={`w-3 h-3 rounded-full border-2 z-10 transition-all duration-500 ${status === 'CURRENT' ? 'bg-indigo-600 border-indigo-400 scale-125 shadow-[0_0_15px_rgba(99,102,241,0.8)]' :
                                        status === 'PAST' ? 'bg-indigo-400 border-indigo-300' :
                                            slot.break ? 'bg-amber-400 border-amber-300' : activeMode ? 'bg-indigo-300 border-indigo-400' : 'bg-slate-300 border-slate-400'
                                        }`}>
                                        {status === 'CURRENT' && <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-75"></div>}
                                    </div>

                                    {/* Label */}
                                    <div className={`mt-3 text-center transition-all duration-500 ${status === 'CURRENT' ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-60'}`}>
                                        {/* Icon + Text */}
                                        <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                            {isFirstSlot && !slot.break && (
                                                <span className="text-[14px] filter drop-shadow-md">🔔</span>
                                            )}
                                            {isLastSlot && !slot.break && (
                                                <span className="text-[14px] filter drop-shadow-md">🏁</span>
                                            )}
                                            {slot.break && (
                                                <span className="text-[14px] filter drop-shadow-md">☕</span>
                                            )}
                                            <span className={`block text-[10px] font-black ${status === 'CURRENT' ? 'text-black' : slot.break ? 'text-amber-950' : activeMode ? 'text-indigo-950' : 'text-slate-950'}`}>
                                                {slot.break ? (slot.name === 'استراحة قصيرة' ? 'استراحة' : 'استراحة كبرى') : `حصة ${slot.period}`}
                                            </span>
                                        </div>
                                        <span className="block text-[8px] font-black text-slate-950 font-mono mt-0.5">{slot.start}</span>
                                    </div>

                                    {/* Connecting Line Color Override for Past */}
                                    {status === 'PAST' && idx < timelinePattern.periods.length - 1 && (
                                        <div className="absolute top-1/2 left-1/2 w-[200%] h-1 bg-indigo-400/60 -z-10 -translate-y-1/2 pointer-events-none"></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* DUTY TIMELINE SECTION - Full Integration with Duty Management */}
                <div className="w-full flex-1 min-h-0 bg-white/70 backdrop-blur-md rounded-xl border border-purple-200 shadow-lg overflow-x-auto custom-scrollbar">
                    <div className="flex items-stretch min-w-max px-2 py-2 gap-2">
                        {/* CHECK FOR HOLIDAY FIRST */}
                        {(() => {
                            const isHoliday = (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(dayName));

                            if (isHoliday) {
                                return (
                                    <div className="w-full flex items-center justify-center py-4 px-8 min-w-[300px]">
                                        <div className="flex flex-col items-center gap-2 p-6 bg-slate-100/80 rounded-2xl border-2 border-slate-200 border-dashed w-full max-w-2xl">
                                            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-2 animate-pulse">
                                                <Coffee size={32} className="text-slate-400" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-500">عطلة رسمية</h3>
                                            <p className="text-sm font-bold text-slate-400">لا توجد مناوبات في هذا اليوم</p>
                                        </div>
                                    </div>
                                );
                            }

                            // Show duty assignments if available
                            return (breakPeriodsData.length > 0 || dutyAssignments.length > 0) ? (
                                <>
                                    {/* Break Period Cards - MATCHING DutyManagement WITH INTERNAL/EXTERNAL */}
                                    {breakPeriodsData.map((breakPeriod: any) => {
                                        const todayStr = toLocalISOString(viewDate);
                                        const breakAssignments = dutyAssignments.filter((a: any) =>
                                            a.date === todayStr && a.breakPeriodId === breakPeriod.id
                                        );

                                        const startMins = timeToMins(breakPeriod.startTime);
                                        const endMins = timeToMins(breakPeriod.endTime);
                                        const nowMins = now.getHours() * 60 + now.getMinutes();
                                        const isCurrentSlot = isViewingToday && nowMins >= startMins && nowMins < endMins;
                                        const isPastSlot = isViewingToday && nowMins >= endMins;

                                        // Group assignments by facility location type
                                        const internalAssignments = breakAssignments.filter((a: any) => {
                                            const facility = facilities.find((f: any) => f.id === a.facilityId);
                                            return facility && (facility.locationType === 'internal' || !facility.locationType);
                                        });

                                        const externalAssignments = breakAssignments.filter((a: any) => {
                                            const facility = facilities.find((f: any) => f.id === a.facilityId);
                                            return facility && facility.locationType === 'external';
                                        });

                                        // Group internal by facility
                                        const internalByFacility = new Map<string, any[]>();
                                        internalAssignments.forEach((a: any) => {
                                            const facility = facilities.find((f: any) => f.id === a.facilityId);
                                            const key = facility?.name || 'غير محدد';
                                            if (!internalByFacility.has(key)) internalByFacility.set(key, []);
                                            internalByFacility.get(key)!.push(a);
                                        });

                                        // Group external by facility
                                        const externalByFacility = new Map<string, any[]>();
                                        externalAssignments.forEach((a: any) => {
                                            const facility = facilities.find((f: any) => f.id === a.facilityId);
                                            const key = facility?.name || 'غير محدد';
                                            if (!externalByFacility.has(key)) externalByFacility.set(key, []);
                                            externalByFacility.get(key)!.push(a);
                                        });

                                        return (
                                            <div key={breakPeriod.id} className="flex-shrink-0" style={{ width: '500px' }}>
                                                <div className={`rounded-xl border-2 shadow-sm transition-all h-full relative overflow-hidden ${isCurrentSlot ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-amber-400 scale-[1.02] shadow-xl ring-4 ring-amber-300/50' :
                                                    isPastSlot ? 'bg-amber-50/50 border-amber-200 opacity-60' :
                                                        'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                                                    }`}>
                                                    {/* Glowing effect for current slot */}
                                                    {isCurrentSlot && (
                                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-400/20 animate-pulse"></div>
                                                    )}

                                                    {/* Header */}
                                                    <div className={`px-3 py-2 border-b-2 rounded-t-xl relative ${isCurrentSlot ? 'bg-gradient-to-r from-amber-200 to-orange-200 border-amber-400' :
                                                        'bg-gradient-to-r from-orange-100 to-amber-100 border-orange-300'
                                                        }`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-lg ${isCurrentSlot ? 'animate-bounce' : ''
                                                                    }`}>☕</span>
                                                                <h4 className="text-xs font-black text-orange-900">{breakPeriod.name}</h4>
                                                                {isCurrentSlot && (
                                                                    <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black rounded-full animate-pulse">
                                                                        ⚡ الآن
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[9px] text-orange-700 font-bold flex items-center gap-0.5">
                                                                <Clock size={11} />
                                                                {breakPeriod.startTime} - {breakPeriod.endTime}
                                                            </div>
                                                        </div>

                                                        {/* Progress Bar for current slot */}
                                                        {isCurrentSlot && (() => {
                                                            const progress = Math.min(100, Math.max(0, ((nowMins - startMins) / (endMins - startMins)) * 100));
                                                            return (
                                                                <div className="mt-2 w-full h-1.5 bg-white/50 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-1000"
                                                                        style={{ width: `${progress}%` }}
                                                                    ></div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Internal/External Split (2 Columns) */}
                                                    <div className="p-2 relative">
                                                        <div className="grid grid-cols-2 gap-2">

                                                            {/* Internal Section - داخلي */}
                                                            <div className={`rounded-lg border p-2 ${isCurrentSlot ? 'bg-blue-100/80 border-blue-400' : 'bg-blue-50/50 border-blue-200'
                                                                }`}>
                                                                <div className="flex items-center gap-1 mb-2 pb-1 border-b border-blue-300">
                                                                    <span className="text-sm">🏠</span>
                                                                    <h5 className="text-[10px] font-black text-blue-900">داخلي</h5>
                                                                    <span className="mr-auto text-[8px] bg-blue-200 text-blue-700 px-1 rounded font-bold">
                                                                        {internalAssignments.length}
                                                                    </span>
                                                                </div>

                                                                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                                    {internalByFacility.size > 0 ? (
                                                                        Array.from(internalByFacility.entries()).map(([facilityName, assignments]) => (
                                                                            <div key={facilityName} className="bg-white/70 rounded px-2 py-1.5 border border-blue-300">
                                                                                <p className="text-[9px] font-black text-blue-800 mb-1">🏛️ {facilityName}</p>
                                                                                <div className="space-y-0.5">
                                                                                    {assignments.map((assignment: any, idx: number) => {
                                                                                        const teacher = employees.find(e => String(e.id) === String(assignment.teacherId));
                                                                                        if (!teacher) return null;
                                                                                        return (
                                                                                            <div key={idx} className={`rounded px-1.5 py-0.5 border ${isCurrentSlot ? 'bg-blue-200 border-blue-400' : 'bg-blue-100 border-blue-300'
                                                                                                }`}>
                                                                                                <p className="text-[9px] font-bold text-blue-900 truncate" title={teacher.name}>
                                                                                                    👤 {teacher.name}
                                                                                                </p>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-center py-2">
                                                                            <span className="text-[16px] opacity-30">👥</span>
                                                                            <p className="text-[8px] text-blue-400 font-bold mt-0.5">لا توجد تعيينات</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* External Section - خارجي */}
                                                            <div className={`rounded-lg border p-2 ${isCurrentSlot ? 'bg-green-100/80 border-green-400' : 'bg-green-50/50 border-green-200'
                                                                }`}>
                                                                <div className="flex items-center gap-1 mb-2 pb-1 border-b border-green-300">
                                                                    <span className="text-sm">🌳</span>
                                                                    <h5 className="text-[10px] font-black text-green-900">خارجي</h5>
                                                                    <span className="mr-auto text-[8px] bg-green-200 text-green-700 px-1 rounded font-bold">
                                                                        {externalAssignments.length}
                                                                    </span>
                                                                </div>

                                                                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                                    {externalByFacility.size > 0 ? (
                                                                        Array.from(externalByFacility.entries()).map(([facilityName, assignments]) => (
                                                                            <div key={facilityName} className="bg-white/70 rounded px-2 py-1.5 border border-green-300">
                                                                                <p className="text-[9px] font-black text-green-800 mb-1">🏛️ {facilityName}</p>
                                                                                <div className="space-y-0.5">
                                                                                    {assignments.map((assignment: any, idx: number) => {
                                                                                        const teacher = employees.find(e => String(e.id) === String(assignment.teacherId));
                                                                                        if (!teacher) return null;
                                                                                        return (
                                                                                            <div key={idx} className={`rounded px-1.5 py-0.5 border ${isCurrentSlot ? 'bg-green-200 border-green-400' : 'bg-green-100 border-green-300'
                                                                                                }`}>
                                                                                                <p className="text-[9px] font-bold text-green-900 truncate" title={teacher.name}>
                                                                                                    👤 {teacher.name}
                                                                                                </p>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-center py-2">
                                                                            <span className="text-[16px] opacity-30">👥</span>
                                                                            <p className="text-[8px] text-green-400 font-bold mt-0.5">لا توجد تعيينات</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}</>
                            ) : (
                                // Fallback to simple timeline if no duty data
                                timelinePattern.periods.map((slot, idx) => {
                                    const startMins = timeToMins(slot.start);
                                    const endMins = timeToMins(slot.end);
                                    const nowMins = now.getHours() * 60 + now.getMinutes();
                                    const isCurrentSlot = isViewingToday && nowMins >= startMins && nowMins < endMins;
                                    const isPastSlot = isViewingToday && nowMins >= endMins;
                                    const isFirstSlot = idx === 0;
                                    const isLastSlot = idx === timelinePattern.periods.length - 1;

                                    if (slot.break) {
                                        // Break Card
                                        return (
                                            <div key={`break-${idx}`} className={`flex-shrink-0 w-20 rounded-lg border-2 transition-all ${isCurrentSlot ? 'bg-amber-100 border-amber-400 shadow-lg scale-105' :
                                                isPastSlot ? 'bg-amber-50/50 border-amber-200 opacity-60' :
                                                    'bg-amber-50 border-amber-300'
                                                }`}>
                                                <div className="flex flex-col items-center justify-center h-full p-2 gap-1">
                                                    <span className="text-[16px] filter drop-shadow-sm">☕</span>
                                                    <span className={`text-[8px] font-black text-center leading-tight ${isCurrentSlot ? 'text-amber-900' : 'text-amber-800'
                                                        }`}>فسحة</span>
                                                    <span className="text-[7px] font-bold text-amber-700 font-mono">{slot.start}</span>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Period Card
                                    return (
                                        <div key={`period-${slot.period}`} className={`flex-shrink-0 w-24 rounded-lg border-2 transition-all relative overflow-hidden ${isCurrentSlot ? 'bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-400 shadow-xl scale-105' :
                                            isPastSlot ? 'bg-slate-50 border-slate-200 opacity-60' :
                                                'bg-white border-indigo-300 hover:border-indigo-400'
                                            }`}>
                                            {isCurrentSlot && (
                                                <div className="absolute inset-0 bg-indigo-500/10 animate-pulse-slow"></div>
                                            )}
                                            <div className="relative flex flex-col items-center justify-center h-full p-2 gap-1">
                                                {/* Icon */}
                                                {isFirstSlot && <span className="text-[16px] filter drop-shadow-md">🔔</span>}
                                                {isLastSlot && <span className="text-[16px] filter drop-shadow-md">🏁</span>}

                                                {/* Period Number */}
                                                <span className={`text-[11px] font-black ${isCurrentSlot ? 'text-indigo-900' : 'text-slate-800'
                                                    }`}>حصة {slot.period}</span>

                                                {/* Time */}
                                                <span className={`text-[8px] font-bold font-mono ${isCurrentSlot ? 'text-indigo-700' : 'text-slate-600'
                                                    }`}>{slot.start}</span>

                                                {/* Progress Bar */}
                                                {isCurrentSlot && (() => {
                                                    const progress = Math.min(100, Math.max(0, ((nowMins - startMins) / (endMins - startMins)) * 100));
                                                    return (
                                                        <div className="w-full h-1 bg-slate-300 rounded-full overflow-hidden mt-1">
                                                            <div
                                                                className="h-full bg-indigo-600 transition-all duration-1000"
                                                                style={{ width: `${progress}%` }}
                                                            ></div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })
                            );
                        })()}
                    </div>
                </div>

                {/* BOTTOM SECTION: COMPACT CALENDAR STRIP */}
                <div className="min-h-0 flex flex-col justify-end">
                    <CalendarStrip date={viewDate} events={events} holidays={scheduleConfig.holidays} />
                </div>

            </div>
        </div>
    );
};

export default BulletinBoard;
