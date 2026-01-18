
import React, { useState, useMemo, useEffect } from 'react';
import {
    ChevronRight, ChevronLeft, Calendar as CalendarIcon, Plus, Filter,
    Settings2, LayoutPanelTop, UserX, Maximize2, Eye, EyeOff, GripHorizontal,
    Timer, PlayCircle, Coffee, Zap, Edit3, Globe, BrainCircuit, Send,
    Briefcase, Columns, PanelLeft, Maximize, LayoutTemplate,
    Grid3X3, List, CalendarDays, Table, LayoutGrid
} from 'lucide-react';
import {
    Employee, ClassItem, Lesson, ScheduleConfig, AcademicYear, DayPattern,
    CalendarHoliday, DayOverride, CalendarEvent, CalendarTask, EventComment,
    AbsenceRecord, SubstitutionLog, EngineContext, ViewState, ResolvedDay
} from '@/types';
import { useEmployees } from '@/hooks/useEmployees';
import { useClasses } from '@/hooks/useClasses';
import { useLessons } from '@/hooks/useLessons';
import { useSubstitutions } from '@/hooks/useSubstitutions';
import { useAbsences } from '@/hooks/useAbsences';
import { resolveDay, timeToMins, toLocalISOString, normalizeArabic } from '@/utils';
import DailyAbsenceSubstitutionGrid from './DailyAbsenceSubstitutionGrid';
import { DAYS_AR } from '@/constants';

interface CalendarModuleProps {
    currentUser: Employee | null;
    academicYear: AcademicYear;
    patterns: DayPattern[];
    holidays: CalendarHoliday[];
    overrides: DayOverride[];
    events: CalendarEvent[];
    tasks: CalendarTask[];
    setHolidays: React.Dispatch<React.SetStateAction<CalendarHoliday[]>>;
    setOverrides: React.Dispatch<React.SetStateAction<DayOverride[]>>;
    setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
    setTasks: React.Dispatch<React.SetStateAction<CalendarTask[]>>;
    setComments: React.Dispatch<React.SetStateAction<EventComment[]>>;
    onOpenRequestForm: (prefill: any) => void;
    onNavigateToView: (view: ViewState) => void;
    engineContext: EngineContext;
    scheduleConfig: ScheduleConfig;
}

type CalendarViewMode = 'DAILY_OPS' | 'WEEKLY' | 'MONTHLY' | 'YEARLY_GRID' | 'YEARLY_LIST';

const MONTHS_AR = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const CalendarModule: React.FC<CalendarModuleProps> = ({
    currentUser, academicYear, patterns, holidays, overrides, events, tasks,
    comments,
    setHolidays, setOverrides, setEvents, setTasks,
    setComments, onOpenRequestForm, onNavigateToView, engineContext, scheduleConfig
}) => {
    // Atomic Hooks
    const { employees } = useEmployees();
    const { classes } = useClasses();
    const { lessons } = useLessons();
    const { substitutionLogs } = useSubstitutions();
    const { absences, setAbsences } = useAbsences();

    const [viewDate, setViewDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<CalendarViewMode>('DAILY_OPS');
    const [isCustomizeMode, setIsCustomizeMode] = useState(false);
    const [aiNote, setAiNote] = useState('');

    // Terminal Layout State
    const [terminalLayout, setTerminalLayout] = useState([
        { id: 'flow', title: 'التدفق الزمني الميداني', visible: true, size: 'large', order: 1 },
        { id: 'absences', title: 'مراقب الغيابات والإشغال', visible: true, size: 'medium', order: 2 },
        { id: 'external', title: 'البدلاء والخبراء', visible: true, size: 'medium', order: 3 },
        { id: 'ai-ledger', title: 'السجل الاستراتيجي (AI)', visible: true, size: 'medium', order: 4 },
    ]);

    const [nowMins, setNowMins] = useState(0);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setNowMins(now.getHours() * 60 + now.getMinutes());
        };
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    // Derived State for Daily Ops
    const activeDay: ResolvedDay = useMemo(() =>
        resolveDay(viewDate, academicYear, patterns, holidays, overrides, events, scheduleConfig),
        [viewDate, academicYear, patterns, holidays, overrides, events, scheduleConfig]);

    const dayAbsences = useMemo(() => absences.filter(a => a.date === activeDay.date), [absences, activeDay]);
    const daySubs = useMemo(() => substitutionLogs.filter(s => s.date === activeDay.date), [substitutionLogs, activeDay]);

    const externalForce = useMemo(() => {
        const externals = employees.filter(e => e.constraints.isExternal);
        return externals.map(ext => {
            const load = daySubs.filter(s => s.substituteId === ext.id).length;
            return { ...ext, todayLoad: load };
        }).sort((a, b) => b.todayLoad - a.todayLoad);
    }, [employees, daySubs]);

    // --- Handlers ---
    const handleOpenRequestForm = (prefill: any) => {
        onOpenRequestForm(prefill);
    };

    const handleSaveAiNote = () => {
        if (!aiNote.trim()) return;
        const newComment: EventComment = {
            id: `NOTE-${Date.now()}`,
            eventId: `DAY-${activeDay.date}`,
            authorName: currentUser?.name || 'User',
            content: aiNote,
            category: 'STRATEGIC',
            status: 'COMPLETED',
            priority: 'MEDIUM',
            impactScore: 5,
            timestamp: Date.now()
        };
        setComments(prev => [...prev, newComment]);
        setAiNote('');
    };

    const updateWidgetSize = (id: string, size: string) => {
        setTerminalLayout(prev => prev.map(w => w.id === id ? { ...w, size: size } : w));
    };

    const toggleWidgetVisibility = (id: string) => {
        setTerminalLayout(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
    };

    const navigateDate = (amount: number) => {
        const newDate = new Date(viewDate);
        if (viewMode === 'WEEKLY') newDate.setDate(newDate.getDate() + (amount * 7));
        else if (viewMode === 'MONTHLY' || viewMode === 'YEARLY_GRID' || viewMode === 'YEARLY_LIST') newDate.setMonth(newDate.getMonth() + amount);
        else newDate.setDate(newDate.getDate() + amount);
        setViewDate(newDate);
    };

    // --- RENDERERS ---

    const renderEventBadge = (evt: CalendarEvent, minimal = false) => {
        const colorClass = evt.eventType === 'EXAM' ? 'bg-rose-100 text-rose-700 border-rose-200'
            : evt.eventType === 'TRIP' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-indigo-100 text-indigo-700 border-indigo-200';

        if (minimal) {
            return <div key={evt.id} className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0]}`} title={evt.title}></div>;
        }

        return (
            <div
                key={evt.id}
                onClick={(e) => { e.stopPropagation(); onOpenRequestForm(evt); }}
                className={`text-[9px] px-2 py-1 rounded-lg border font-black truncate cursor-pointer hover:opacity-80 transition-opacity mb-1 ${colorClass}`}
            >
                {evt.title}
            </div>
        );
    };

    const renderDailyTerminal = () => {
        const dayEvents = events.filter(e => e.date === activeDay.date);

        if (!activeDay.isSchoolDay) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-dashed border-slate-200 p-12 text-center animate-fade-in min-h-[500px]">
                    <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                        <span className="text-5xl">🏖️</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">عطلة رسمية</h3>
                    <p className="text-slate-500 font-bold max-w-md">لا توجد عمليات ميدانية أو حصص دراسية مجدولة لهذا اليوم ({activeDay.dayOfWeek})</p>
                    <button
                        onClick={() => setViewDate(new Date())}
                        className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all"
                    >
                        العودة لليوم الحالي
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-6 animate-fade-in h-full flex flex-col pb-6">
                {/* Ops Controls */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 gap-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><LayoutPanelTop size={24} /></div>
                        <div>
                            <h3 className="font-black text-xl text-slate-800 tracking-tight">قمرة القيادة اليومية</h3>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-0.5">Operational Control</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsCustomizeMode(!isCustomizeMode)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] transition-all ${isCustomizeMode ? 'bg-indigo-600 text-white shadow-xl glow-primary scale-105' : 'bg-slate-50 text-slate-500 hover:bg-white border border-slate-100'}`}>
                            <Settings2 size={16} className={isCustomizeMode ? "animate-spin-slow" : ""} />
                            {isCustomizeMode ? 'حفظ التخطيط' : 'تخصيص الواجهة'}
                        </button>
                        <button onClick={() => onNavigateToView('substitutions')} className="bg-rose-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] shadow-xl hover:bg-rose-700 transition-all flex items-center gap-2"><UserX size={16} /> رصد غياب</button>
                    </div>
                </div>

                {/* Widgets Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto content-start pb-10">
                    {terminalLayout.filter(w => w.visible || isCustomizeMode).sort((a, b) => a.order - b.order).map((widget) => {
                        const colSpan = widget.size === 'small' ? 'lg:col-span-4' : widget.size === 'medium' ? 'lg:col-span-6' : 'lg:col-span-12';
                        return (
                            <div key={widget.id} className={`${colSpan} h-full min-h-[450px] transition-all duration-500 ease-in-out ${!widget.visible ? 'opacity-40 grayscale blur-[1px]' : ''}`}>
                                <div className={`bg-white rounded-[3rem] border shadow-md overflow-hidden h-full flex flex-col relative group transition-all ${isCustomizeMode ? 'border-indigo-300 ring-4 ring-indigo-50/50' : 'border-slate-100'}`}>
                                    {isCustomizeMode && (
                                        <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-center bg-slate-900/95 backdrop-blur-xl p-3 rounded-[2rem] text-white border border-white/10 shadow-2xl animate-slide-down">
                                            <div className="flex items-center gap-3 px-2"><GripHorizontal size={18} className="text-indigo-400 cursor-move" /><span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]">{widget.title}</span></div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
                                                    {['small', 'medium', 'large'].map(s => (
                                                        <button key={s} onClick={() => updateWidgetSize(widget.id, s)} className={`p-2 rounded-lg transition-all ${widget.size === s ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{s === 'small' ? <Columns size={14} /> : s === 'medium' ? <PanelLeft size={14} /> : <Maximize size={14} />}</button>
                                                    ))}
                                                </div>
                                                <div className="w-px h-5 bg-slate-700 mx-1"></div>
                                                <button onClick={() => toggleWidgetVisibility(widget.id)} className={`p-2 rounded-xl transition-all ${widget.visible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{widget.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-6 h-full flex flex-col">
                                        {widget.id === 'flow' && (
                                            <div className="flex flex-col h-full">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2 shrink-0">
                                                    <div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100"><Timer size={24} /></div><div><h4 className="text-xl font-black text-slate-800 tracking-tight">التدفق الزمني</h4><p className="text-[10px] font-bold text-slate-400 mt-0.5">جدولة فورية</p></div></div>
                                                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-[10px] font-black text-slate-500 ltr">{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></div>
                                                </div>
                                                <div className="relative pr-4 lg:pr-10 flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-2 pt-2">
                                                    <div className="absolute top-4 right-[1.15rem] lg:right-[2.65rem] bottom-4 w-1 bg-slate-100 rounded-full"></div>
                                                    {activeDay.pattern.periods.filter(p => !p.isMerged).map((p, idx) => {
                                                        const isBreak = !!p.break;
                                                        const event = dayEvents.find(e => e.appliesTo.periods.includes(p.period || 0));
                                                        const startMins = timeToMins(p.start);
                                                        const endMins = timeToMins(p.end);
                                                        const isCurrent = nowMins >= startMins && nowMins < endMins;
                                                        return (
                                                            <div key={idx} onClick={() => !isBreak && handleOpenRequestForm(event ? event : { date: activeDay.date, period: p.period })} className={`relative group/item cursor-pointer transition-all duration-300 ${!isBreak ? 'hover:translate-x-[-5px]' : ''}`}>
                                                                <div className={`absolute -right-[0.5rem] lg:-right-[0.1rem] top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-xl border-4 flex items-center justify-center transition-all duration-500 ${isCurrent ? 'bg-indigo-600 border-indigo-100 scale-110 shadow-lg' : 'bg-white border-slate-200 group-hover/item:border-indigo-400'}`}>
                                                                    {isCurrent ? <PlayCircle size={20} className="text-white animate-pulse" /> : isBreak ? <Coffee size={16} className="text-slate-400" /> : <span className="font-black text-[10px] text-slate-400 group-hover/item:text-indigo-600">{p.period}</span>}
                                                                </div>
                                                                <div className={`mr-12 sm:mr-16 lg:mr-24 p-4 rounded-[2rem] border-2 transition-all duration-500 flex flex-col md:flex-row justify-between items-center gap-4 ${isCurrent ? 'bg-white border-indigo-600 shadow-lg' : 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-md'}`}>
                                                                    <div className="flex-1 space-y-1 text-center md:text-right w-full">
                                                                        <div className="flex items-center justify-center md:justify-start gap-3"><span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${isBreak ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>{isBreak ? 'فاصل' : `حصة ${p.period}`}</span></div>
                                                                        <div><h5 className={`text-base font-black tracking-tight ${isCurrent ? 'text-indigo-950' : 'text-slate-800'}`}>{p.name}</h5>{event && (<div className="mt-2 p-3 bg-indigo-600 text-white rounded-2xl shadow-md flex items-center gap-3 border border-indigo-500"><Zap size={16} fill="currentColor" /><div><p className="font-black text-xs leading-tight">{event.title}</p><p className="text-[8px] font-black opacity-80">{event.eventType}</p></div></div>)}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {widget.id === 'absences' && (
                                            <div className="flex flex-col h-full">
                                                <div className="flex items-center gap-5 mb-4 border-b border-slate-50 pb-4 shrink-0"><div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><UserX size={24} /></div><div><h4 className="text-xl font-black text-slate-800">الغيابات والإشغال</h4></div></div>
                                                <div className="flex-1 overflow-auto custom-scrollbar"><DailyAbsenceSubstitutionGrid absences={dayAbsences} substitutions={daySubs} employees={employees} lessons={lessons} classes={classes} maxPeriod={scheduleConfig.periodsPerDay} date={activeDay.date} onEditAbsence={() => onNavigateToView('substitutions')} /></div>
                                            </div>
                                        )}
                                        {widget.id === 'external' && (
                                            <div className="flex flex-col h-full">
                                                <div className="flex items-center gap-5 mb-4 border-b border-slate-50 pb-4 shrink-0"><div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Globe size={24} /></div><h4 className="text-xl font-black text-slate-800">البدلاء والخبراء</h4></div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                                                    {externalForce.length > 0 ? externalForce.map(ext => (<div key={ext.id} className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4"><div className="w-10 h-10 bg-white text-amber-500 rounded-2xl flex items-center justify-center shadow-sm"><Globe size={20} /></div><div className="flex-1 min-w-0"><p className="font-black text-slate-800 truncate text-xs">{ext.name}</p><p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Load: {ext.todayLoad}</p></div></div>)) : <div className="col-span-full flex items-center justify-center text-slate-300 italic font-bold text-xs h-full flex-col gap-2"><LayoutTemplate size={32} className="opacity-20" />لا يوجد خبراء اليوم</div>}
                                                </div>
                                            </div>
                                        )}
                                        {widget.id === 'ai-ledger' && (
                                            <div className="flex flex-col h-full">
                                                <div className="flex items-center gap-5 mb-4 border-b border-slate-50 pb-4 shrink-0"><div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><BrainCircuit size={24} /></div><div><h4 className="text-xl font-black text-slate-800">السجل الاستراتيجي</h4></div></div>
                                                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                                                    <div className="p-4 bg-slate-50 rounded-[2rem] border border-slate-200 shadow-inner space-y-3 shrink-0"><textarea className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all min-h-[60px]" placeholder="ملاحظة..." value={aiNote} onChange={e => setAiNote(e.target.value)} /><div className="flex gap-2"><button onClick={handleSaveAiNote} className="flex-1 bg-slate-900 text-white py-2 rounded-xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all"><Send size={12} /> تثبيت</button></div></div>
                                                    <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">{comments.filter(c => c.eventId === `DAY-${activeDay.date}`).map(note => (<div key={note.id} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm"><p className="text-[10px] font-bold text-slate-600 leading-relaxed">{note.content}</p></div>))}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderWeeklyView = () => {
        // Calculate week range based on scheduleConfig.weekStartDay
        const startDayIndex = DAYS_AR.indexOf(scheduleConfig.weekStartDay);
        const currentDayIndex = viewDate.getDay();

        // Adjust to get to the start of the week
        let diff = currentDayIndex - startDayIndex;
        if (diff < 0) diff += 7;

        const startOfWeek = new Date(viewDate);
        startOfWeek.setDate(viewDate.getDate() - diff);

        const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
        });

        const periods = Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1);

        return (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full animate-slide-up">
                {/* Week Header */}
                <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-slate-50 border-b border-slate-200">
                    <div className="p-4 border-l border-slate-200 flex items-center justify-center font-black text-slate-400">#</div>
                    {weekDays.map((d, i) => {
                        const dateStr = toLocalISOString(d);
                        const isToday = toLocalISOString(new Date()) === dateStr;
                        const dayName = DAYS_AR[d.getDay()];
                        const isHoliday = (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(dayName));
                        return (
                            <div key={i} className={`p-4 text-center border-l border-slate-100 last:border-0 ${isToday ? 'bg-indigo-50 font-black' : isHoliday ? 'bg-slate-50 flex flex-col justify-center' : ''}`}>
                                <span className={`block text-xs font-black ${isToday ? 'text-indigo-600' : isHoliday ? 'text-slate-400' : 'text-slate-800'}`}>{DAYS_AR[d.getDay()]}</span>
                                <span className={`block text-[10px] font-bold mt-1 ${isToday ? 'text-indigo-400' : isHoliday ? 'text-slate-300' : 'text-slate-400'}`}>{d.getDate()} {MONTHS_AR[d.getMonth()]}</span>
                                {isHoliday && <span className="block text-[7px] font-black text-amber-500 uppercase tracking-tighter mt-1">عطلة</span>}
                            </div>
                        );
                    })}
                </div>

                {/* Grid Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {periods.map(p => (
                        <div key={p} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100 min-h-[100px]">
                            <div className="flex items-center justify-center border-l border-slate-100 bg-slate-50 font-black text-slate-400 text-lg">{p}</div>
                            {weekDays.map((d, i) => {
                                const dateStr = toLocalISOString(d);
                                const cellEvents = events.filter(e => e.date === dateStr && e.appliesTo.periods.includes(p));
                                const dayName = DAYS_AR[d.getDay()];
                                const isHoliday = (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(dayName));

                                return (
                                    <div
                                        key={`${dateStr}-${p}`}
                                        className={`border-l border-slate-100 p-2 relative group transition-colors ${isHoliday ? 'bg-slate-50/50' : 'hover:bg-slate-50/50'}`}
                                        onClick={() => !isHoliday && onOpenRequestForm({ date: dateStr, period: p })}
                                    >
                                        {!isHoliday && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="bg-indigo-50 text-indigo-600 p-1 rounded-lg"><Plus size={14} /></button>
                                            </div>
                                        )}
                                        {isHoliday && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                                                <Coffee size={32} />
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {cellEvents.map(evt => renderEventBadge(evt))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthlyView = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Calculate padding days based on weekStartDay
        const startDayIndex = DAYS_AR.indexOf(scheduleConfig.weekStartDay);
        let padding = firstDayOfMonth.getDay() - startDayIndex;
        if (padding < 0) padding += 7;

        const totalSlots = Math.ceil((daysInMonth + padding) / 7) * 7;
        const days = Array.from({ length: totalSlots }, (_, i) => {
            const dayNum = i - padding + 1;
            if (dayNum > 0 && dayNum <= daysInMonth) {
                return new Date(year, month, dayNum);
            }
            return null;
        });

        return (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 h-full flex flex-col animate-slide-up">
                <div className="grid grid-cols-7 mb-4">
                    {DAYS_AR.map((d, i) => {
                        // Reorder days header based on start day
                        const idx = (i + startDayIndex) % 7;
                        return (
                            <div key={i} className="text-center font-black text-slate-400 text-xs py-2">
                                {DAYS_AR[idx]}
                            </div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-7 gap-4 flex-1">
                    {days.map((d, i) => {
                        if (!d) return <div key={i} className="bg-slate-50/30 rounded-2xl"></div>;
                        const dateStr = toLocalISOString(d);
                        const isToday = toLocalISOString(new Date()) === dateStr;
                        const dayEvents = events.filter(e => e.date === dateStr);
                        const dayName = DAYS_AR[d.getDay()];
                        const isHoliday = (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(dayName));

                        return (
                            <div
                                key={i}
                                onClick={() => onOpenRequestForm({ date: dateStr })}
                                className={`rounded-3xl p-3 border transition-all cursor-pointer flex flex-col ${isToday ? 'bg-indigo-50 border-indigo-200' :
                                    isHoliday ? 'bg-slate-50/80 border-slate-100 grayscale-[0.5]' :
                                        'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : isHoliday ? 'text-slate-400' : 'text-slate-700'}`}>{d.getDate()}</span>
                                    {isHoliday && <Coffee size={12} className="text-slate-300" />}
                                    {dayEvents.length > 0 && <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 rounded-full">{dayEvents.length}</span>}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                    {dayEvents.slice(0, 3).map(evt => renderEventBadge(evt, true))}
                                    {dayEvents.length > 3 && <span className="text-[8px] text-slate-400 block text-center">+{dayEvents.length - 3} المزيد</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderYearlyGrid = () => {
        const year = viewDate.getFullYear();
        const months = Array.from({ length: 12 }, (_, i) => i);

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-scale-up pb-10">
                {months.map(m => {
                    const daysInM = new Date(year, m + 1, 0).getDate();
                    const firstDay = new Date(year, m, 1).getDay(); // 0-6 Sun-Sat

                    // Simple grid generation
                    const grid = [];
                    // Adjust for RTL week start? No, keep standard visual
                    for (let i = 0; i < firstDay; i++) grid.push(null);
                    for (let i = 1; i <= daysInM; i++) grid.push(i);

                    return (
                        <div key={m} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                            <h4 className="font-black text-slate-800 text-center mb-4">{MONTHS_AR[m]}</h4>
                            <div className="grid grid-cols-7 gap-1 text-center">
                                {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(d => <span key={d} className="text-[8px] font-bold text-slate-400">{d}</span>)}
                                {grid.map((d, idx) => {
                                    if (!d) return <span key={idx}></span>;
                                    const dateStr = toLocalISOString(new Date(year, m, d));
                                    const hasEvent = events.some(e => e.date === dateStr);
                                    const dayName = DAYS_AR[new Date(year, m, d).getDay()];
                                    const isHoliday = (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(dayName));

                                    return (
                                        <div
                                            key={idx}
                                            className={`aspect-square flex items-center justify-center rounded-lg text-[9px] font-bold ${isHoliday ? 'text-slate-300 bg-slate-50/50' :
                                                hasEvent ? 'bg-indigo-100 text-indigo-700' :
                                                    'text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {d}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderYearlyList = () => {
        const year = viewDate.getFullYear();
        const months = Array.from({ length: 12 }, (_, i) => i);

        return (
            <div className="space-y-3 animate-fade-in pb-10">
                {months.map(m => {
                    const daysInM = new Date(year, m + 1, 0).getDate();
                    const days = Array.from({ length: daysInM }, (_, i) => i + 1);

                    return (
                        <div key={m} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            {/* Horizontal Days Strip (Row Layout) */}
                            <div className="p-4 flex gap-3 overflow-x-auto custom-scrollbar">
                                {/* Month Name Badge - First Item */}
                                <div className="flex items-center justify-center min-w-[120px] p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg shrink-0 sticky right-0 z-10">
                                    <div className="text-center">
                                        <span className="block text-2xl font-black text-white drop-shadow-md">{MONTHS_AR[m]} ({m + 1})</span>
                                        <span className="block text-xs font-bold text-white/80 mt-1">{year}</span>
                                    </div>
                                </div>

                                {days.map(d => {
                                    const date = new Date(year, m, d);
                                    const dateStr = toLocalISOString(date); // FIX: Use local date
                                    const dayEvents = events.filter(e => e.date === dateStr);
                                    const dayName = DAYS_AR[date.getDay()];
                                    const normDayName = normalizeArabic(dayName);
                                    const isWeekend = scheduleConfig.holidays.some(h => normalizeArabic(h) === normDayName);
                                    const isToday = toLocalISOString(new Date()) === dateStr;

                                    return (
                                        <div
                                            key={d}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border min-w-[100px] hover:shadow-md transition-all group cursor-pointer ${isToday ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' :
                                                isWeekend ? 'bg-slate-50/80 border-slate-100' :
                                                    'bg-white border-slate-100 hover:border-indigo-200'
                                                }`}
                                            onClick={() => onOpenRequestForm({ date: dateStr })}
                                        >
                                            <div className="text-center w-full pb-2 border-b border-slate-100/50">
                                                <span className={`block text-[10px] font-bold ${isWeekend ? 'text-slate-400' : 'text-slate-500'}`}>{DAYS_AR[date.getDay()]}</span>
                                                <span className={`block text-xl font-black ${isToday ? 'text-indigo-600' : isWeekend ? 'text-slate-400' : 'text-slate-800'}`}>{d}</span>
                                            </div>

                                            <div className="flex-1 w-full space-y-1 min-h-[40px] flex flex-col justify-start">
                                                {dayEvents.length > 0 ? dayEvents.map(evt => (
                                                    <div key={evt.id} className="w-full">{renderEventBadge(evt, true)}</div>
                                                )) : (
                                                    <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="w-6 h-6 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-500 transition-colors">
                                                            <Plus size={12} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col" dir="rtl">
            {/* Main Header with View Switcher */}
            <div className="p-6 md:p-8 bg-white border-b border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-6 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-start">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                            <CalendarIcon size={32} className="text-indigo-600" /> الرزنامة المركزية
                        </h1>
                        <p className="text-slate-500 font-bold mt-1 text-sm">التخطيط الاستراتيجي للعام الدراسي {academicYear.name}</p>
                    </div>
                </div>

                {/* View Switcher Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-[2rem] shadow-inner overflow-x-auto max-w-full">
                    {[
                        { id: 'DAILY_OPS', label: 'العمليات اليومية', icon: LayoutPanelTop },
                        { id: 'WEEKLY', label: 'أسبوعي', icon: Columns },
                        { id: 'MONTHLY', label: 'شهري', icon: CalendarDays },
                        { id: 'YEARLY_GRID', label: 'سنوي (شبكة)', icon: Grid3X3 },
                        { id: 'YEARLY_LIST', label: 'سنوي (شامل)', icon: List },
                    ].map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setViewMode(mode.id as CalendarViewMode)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-[1.5rem] font-black text-[10px] transition-all whitespace-nowrap ${viewMode === mode.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            <mode.icon size={14} /> {mode.label}
                        </button>
                    ))}
                </div>

                {/* Date Navigation & Add Action */}
                <div className="flex items-center gap-4 w-full xl:w-auto justify-end">
                    <div className="flex items-center bg-slate-100 rounded-2xl p-1 shadow-inner">
                        <button onClick={() => navigateDate(-1)} className="p-3 hover:bg-white rounded-xl shadow-sm transition-all text-slate-500"><ChevronRight size={20} /></button>
                        <div className="px-6 text-center min-w-[140px]">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {viewMode === 'DAILY_OPS' ? 'اليوم المحدد' : viewMode === 'WEEKLY' ? 'الأسبوع الحالي' : viewMode === 'MONTHLY' ? 'الشهر الحالي' : 'السنة الحالية'}
                            </span>
                            <span className="block text-lg font-black text-slate-800 whitespace-nowrap">
                                {viewMode === 'DAILY_OPS'
                                    ? viewDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
                                    : viewMode === 'WEEKLY'
                                        ? `${viewDate.getDate()} ${MONTHS_AR[viewDate.getMonth()]}`
                                        : viewMode === 'MONTHLY'
                                            ? `${MONTHS_AR[viewDate.getMonth()]} ${viewDate.getFullYear()}`
                                            : viewDate.getFullYear()}
                            </span>
                        </div>
                        <button onClick={() => navigateDate(1)} className="p-3 hover:bg-white rounded-xl shadow-sm transition-all text-slate-500"><ChevronLeft size={20} /></button>
                    </div>

                    <button onClick={() => onOpenRequestForm({ date: activeDay.date })} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all btn-press shrink-0">
                        <Plus size={20} /> <span className="hidden md:inline">إضافة فعالية</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-6 md:p-8 bg-slate-50/50">
                {viewMode === 'DAILY_OPS' && renderDailyTerminal()}
                {viewMode === 'WEEKLY' && renderWeeklyView()}
                {viewMode === 'MONTHLY' && renderMonthlyView()}
                {viewMode === 'YEARLY_GRID' && <div className="h-full overflow-y-auto custom-scrollbar">{renderYearlyGrid()}</div>}
                {viewMode === 'YEARLY_LIST' && <div className="h-full overflow-y-auto custom-scrollbar">{renderYearlyList()}</div>}
            </div>
        </div>
    );
};

export default CalendarModule;
