
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldAlert, UserX, User, Zap, BookOpen, AlertTriangle, Plus, Activity,
  Siren, Clock, CheckCircle2, UserCheck, Globe, Trash2, Shield, History,
  Users, ArrowRight, LayoutList, CloudRain, Bus, FileText, Filter, CalendarPlus,
  Briefcase, Timer, UserPlus, Check, Sunrise, Sunset, Sun
} from 'lucide-react';
import { 
  Employee, Lesson, ScheduleConfig, ClassItem, EngineContext, 
  SubstitutionLog, AbsenceRecord, ViewState, AcademicYear, 
  DayPattern, CalendarHoliday, DayOverride, CalendarEvent 
} from '../types';
import { useToast } from '../contexts/ToastContext';
import { generateSubstitutionOptions, calculatePeriodTimeRange, toLocalISOString, normalizeArabic } from '../utils';
import AbsenceForm from './AbsenceForm';
import DailyAbsenceSubstitutionGrid from './DailyAbsenceSubstitutionGrid';
import { DAYS_AR } from '../constants';

interface SubstitutionsProps {
  employees: Employee[];
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  scheduleConfig: ScheduleConfig;
  classes: ClassItem[];
  engineContext: EngineContext;
  setEngineContext: React.Dispatch<React.SetStateAction<EngineContext>>;
  onToggleMode: (modeId: string) => void;
  setSubstitutionLogs: React.Dispatch<React.SetStateAction<SubstitutionLog[]>>;
  substitutionLogs: SubstitutionLog[];
  absences: AbsenceRecord[];
  setAbsences: React.Dispatch<React.SetStateAction<AbsenceRecord[]>>;
  onNavigateToView: (view: ViewState) => void;
  academicYear: AcademicYear;
  patterns: DayPattern[];
  holidays: CalendarHoliday[];
  overrides: DayOverride[];
  setOverrides: React.Dispatch<React.SetStateAction<DayOverride[]>>;
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onOpenRequestForm: (prefill: any) => void;
}

const Substitutions: React.FC<SubstitutionsProps> = ({
  employees, lessons, scheduleConfig, classes, engineContext, setEngineContext, onToggleMode,
  setSubstitutionLogs, substitutionLogs, absences, setAbsences,
  events, onOpenRequestForm
}) => {
  const { addToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(toLocalISOString(new Date()));
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<AbsenceRecord | undefined>(undefined);
  
  // GLOBAL POOL STATE (Lifted from Wizard)
  const [activePoolIds, setActivePoolIds] = useState<number[]>([]);
  
  // Internal Filter State
  const [internalFilter, setInternalFilter] = useState<'ALL' | 'FULL' | 'LATE' | 'EARLY'>('ALL');

  const dayOfWeek = DAYS_AR[new Date(selectedDate).getDay()];

  // Reset pool on date change (optional, keeps data fresh)
  useEffect(() => {
      setActivePoolIds([]);
  }, [selectedDate]);

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
            .sort((a,b) => a-b);
          
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
                  details = `متاح الحصص (1-${firstLesson-1})`;
              } else if (lastLesson <= maxP - 2) {
                  status = 'EARLY_END';
                  label = `ينهي باكراً`;
                  details = `متاح الحصص (${lastLesson+1}-${maxP})`;
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

  const handleDeleteAbsenceEntry = () => {
      if (!editingAbsence) return;
      setAbsences(prev => prev.filter(a => !(Number(a.teacherId) === Number(editingAbsence.teacherId) && a.date === selectedDate)));
      setSubstitutionLogs(prev => prev.filter(l => !(Number(l.absentTeacherId) === Number(editingAbsence.teacherId) && l.date === selectedDate)));
      setShowAbsenceForm(false);
      setEditingAbsence(undefined);
      addToast('تم حذف سجل الغياب وإلغاء التغطيات المرتبطة به', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12" dir="rtl">
      
      {/* ACTIVE MODE BANNER */}
      {activeEvents.length > 0 && (
          <div className="bg-indigo-900 text-white p-4 rounded-[2rem] shadow-xl flex items-center justify-between border border-indigo-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
              <div className="relative z-10 flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl animate-pulse"><Zap size={24} className="text-amber-400"/></div>
                  <div>
                      <h3 className="font-black text-lg">النظام يعمل في وضع خاص</h3>
                      <p className="text-xs font-bold text-indigo-200">
                          {activeEvents.map(e => e.title).join(' + ')}
                      </p>
                  </div>
              </div>
              <div className="relative z-10 hidden md:block">
                  <span className="bg-white/20 px-4 py-2 rounded-xl text-xs font-black">
                      يتم تطبيق قواعد {activeEvents[0].eventType === 'EXAM' ? 'الامتحانات' : 'الأنماط الذكية'}
                  </span>
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
            
            {/* IN-PAGE PROTOCOL SWITCHER */}
            <div className="mt-2">
               <button 
                onClick={() => onOpenRequestForm({
                    date: selectedDate,
                    title: `توزيع مهام ${new Date(selectedDate).toLocaleDateString('ar-EG')}`,
                    type: 'EXAM',
                    description: '',
                    autoSmartMode: true,
                    poolIds: activePoolIds
                })}
                className="flex items-center gap-3 bg-slate-50 border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm group"
               >
                 <CalendarPlus size={16} className="text-indigo-500 group-hover:text-white transition-colors"/> 
                 تحديد فعاليات اليوم (توزيع مراقبين)
               </button>
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
             onClick={() => { setEditingAbsence(undefined); setShowAbsenceForm(true); }}
             className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[10px] flex items-center gap-2 shadow-xl hover:bg-rose-600 transition-all btn-press glow-primary"
           >
             <Plus size={16} /> تسجيل غياب جديد
           </button>
        </div>
      </div>

      {/* --- NEW: GLOBAL RESOURCE POOL MANAGER --- */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm animate-slide-down">
          <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Briefcase size={20}/></div>
              <div>
                  <h4 className="font-black text-sm text-slate-800">إدارة بنك الاحتياط اليومي (Pool)</h4>
                  <p className="text-[10px] font-bold text-slate-400">حدد المعلمين (الخارجي والداخلي) المتاحين للاستدعاء الفوري اليوم</p>
              </div>
              <div className="mr-auto bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black">
                  تم تفعيل: {activePoolIds.length}
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. External Substitutes */}
              <div className="space-y-2">
                  <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                      <Globe size={12}/> بدلاء خارجيون (جاهزية)
                  </h5>
                  <div className="flex flex-wrap gap-2">
                      {availableExternals.length > 0 ? availableExternals.map(ext => {
                          const isActive = activePoolIds.includes(ext.id);
                          return (
                              <button
                                  key={ext.id}
                                  onClick={() => togglePoolMember(ext.id)}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[10px] font-bold ${
                                      isActive 
                                      ? 'bg-amber-500 text-white border-amber-500 shadow-md' 
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                                  }`}
                              >
                                  {isActive && <Check size={12}/>}
                                  {ext.name}
                              </button>
                          )
                      }) : <span className="text-[10px] text-slate-400 italic">لا يوجد معرفين</span>}
                  </div>
              </div>

              {/* 2. Available Internals (Categorized) */}
              <div className="space-y-3">
                  <div className="flex justify-between items-center">
                      <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                          <Timer size={12}/> داخلي متاح
                      </h5>
                  </div>
                  
                  {/* Internal Filter Tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar">
                      <button onClick={() => setInternalFilter('ALL')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black whitespace-nowrap transition-all ${internalFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>الكل ({internalCounts.ALL})</button>
                      <button onClick={() => setInternalFilter('FULL')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black whitespace-nowrap transition-all flex items-center gap-1 ${internalFilter === 'FULL' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-emerald-500'}`}><Sun size={10}/> فراغ كامل ({internalCounts.FULL})</button>
                      <button onClick={() => setInternalFilter('LATE')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black whitespace-nowrap transition-all flex items-center gap-1 ${internalFilter === 'LATE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`}><Sunrise size={10}/> دوام متأخر ({internalCounts.LATE})</button>
                      <button onClick={() => setInternalFilter('EARLY')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black whitespace-nowrap transition-all flex items-center gap-1 ${internalFilter === 'EARLY' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-orange-500'}`}><Sunset size={10}/> مغادرة مبكرة ({internalCounts.EARLY})</button>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-1 content-start">
                      {availableInternals.length > 0 ? availableInternals
                        .filter(cand => internalFilter === 'ALL' || 
                            (internalFilter === 'FULL' && cand.status === 'FULL') ||
                            (internalFilter === 'LATE' && cand.status === 'LATE_START') ||
                            (internalFilter === 'EARLY' && cand.status === 'EARLY_END')
                        )
                        .map(cand => {
                          const isActive = activePoolIds.includes(cand.emp.id);
                          const isFull = cand.status === 'FULL';
                          const isLate = cand.status === 'LATE_START';
                          const isEarly = cand.status === 'EARLY_END';
                          
                          // Style Logic
                          let baseColor = 'emerald';
                          let icon = <Sun size={10}/>;
                          if (isLate) { baseColor = 'indigo'; icon = <Sunrise size={10}/>; }
                          if (isEarly) { baseColor = 'orange'; icon = <Sunset size={10}/>; }

                          return (
                              <button
                                  key={cand.emp.id}
                                  onClick={() => togglePoolMember(cand.emp.id)}
                                  className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border transition-all text-right w-[140px] shrink-0 ${
                                      isActive 
                                      ? `bg-${baseColor}-500 text-white border-${baseColor}-500 shadow-md` 
                                      : `bg-white text-slate-700 border-slate-200 hover:border-${baseColor}-300 hover:bg-${baseColor}-50`
                                  }`}
                              >
                                  <div className="flex items-center justify-between w-full">
                                      <span className="text-[10px] font-black truncate max-w-[80px]">{cand.emp.name.split(' ').slice(0,2).join(' ')}</span>
                                      {isActive && <Check size={10}/>}
                                  </div>
                                  <div className={`flex items-center gap-1 text-[8px] font-bold ${isActive ? 'text-white/90' : 'text-slate-400'}`}>
                                      {icon}
                                      <span>{cand.label}</span>
                                  </div>
                                  {!isFull && <span className={`text-[7px] font-mono ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{cand.details.replace('متاح الحصص ','')}</span>}
                              </button>
                          )
                      }) : <span className="text-[10px] text-slate-400 italic w-full text-center py-2">لا يوجد مرشحين متاحين في هذا التصنيف</span>}
                  </div>
              </div>
          </div>
      </div>

      {/* Grid Logic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12">
            <div className="bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-sm mb-2">
                <div className="flex items-center justify-between mb-3 px-2">
                    <h4 className="font-black text-slate-800 text-xs flex items-center gap-2"><LayoutList size={16} className="text-indigo-500"/> اللوحة التفاعلية للغياب والبدلاء</h4>
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
                        if(window.confirm('هل أنت متأكد من إلغاء غياب هذا المعلم لهذا اليوم؟')) {
                            setAbsences(prev => prev.filter(a => !(a.teacherId === tid && a.date === selectedDate)));
                            setSubstitutionLogs(prev => prev.filter(l => !(l.absentTeacherId === tid && l.date === selectedDate)));
                            addToast('تم إلغاء الغياب بنجاح', 'success');
                        }
                    }}
                    onEditAbsence={handleEditAbsence}
                    onUnassign={(logId) => {
                        if(window.confirm('هل تريد إلغاء هذا التعيين؟')) {
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
                 <div className="p-2 bg-rose-50 rounded-xl text-rose-600"><AlertTriangle size={18}/></div>
                 <div>
                    <h3 className="font-black text-sm text-slate-800">الحصص المكشوفة</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-bold text-slate-400">بحاجة لتأمين فوري</span>
                       <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-100 text-rose-600">{uncoveredLessons.length}</span>
                    </div>
                 </div>
              </div>
              <div className="flex gap-2">
                 <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><Filter size={16}/></button>
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
                                    onClick={() => {/* Trigger auto assign for this single lesson if needed in future */}}
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
                <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2"><Activity size={16} className="text-emerald-500"/> حالة الطاقم</h3>
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
                        <span className="text-amber-500">{new Set(substitutionLogs.filter(s => s.date === selectedDate).map(s => s.substituteTeacherId)).size}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

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
            onCancel={() => { setShowAbsenceForm(false); setEditingAbsence(undefined); }}
            engineContext={engineContext}
            initialData={editingAbsence}
            onDelete={editingAbsence ? handleDeleteAbsenceEntry : undefined}
            existingAbsences={absences}
            substitutionLogs={substitutionLogs}
            events={events}
            preSelectedPool={activePoolIds} 
          />
        </div>
      )}
    </div>
  );
};

export default Substitutions;
