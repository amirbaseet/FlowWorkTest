
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
   ArrowLeftRight, Download, Filter, GraduationCap, User, RotateCw, Eye, EyeOff,
   BookOpen, Upload, FileSpreadsheet, Clock, Sparkles, Plus, AlertTriangle, Zap,
   Calendar, Info, Timer, Users, Flag, CalendarDays, CloudRain, Bus, FileText,
   Siren, Split, Printer, FileDown, SlidersHorizontal, Check, X, ChevronDown, Minus,
   UserMinus
} from 'lucide-react';
import { Lesson, ScheduleConfig, Employee, ClassItem, LessonType, AcademicYear, DayPattern, CalendarHoliday, DayOverride, CalendarEvent, PeriodSlot, EngineContext, ResolvedDay, ScheduleFilter, ModeConfig, SubstitutionLog, AbsenceRecord, CoverageRequest } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { calculatePeriodTimeRange, getSortedDays, downloadCSV, parseCSV, resolveDay, applySmartModeToPattern, normalizeArabic, toLocalISOString } from '@/utils';
import { DAYS_AR, GRADES_AR } from '@/constants';
import SlotAbsenceModal from './SlotAbsenceModal';
import { useLessons } from '@/hooks/useLessons';
import { useAbsences } from '@/hooks/useAbsences';
import { useSubstitutions } from '@/hooks/useSubstitutions';
import { useAbsence } from '@/hooks/useAbsence';

interface ScheduleProps {
   scheduleConfig: ScheduleConfig;
   employees: Employee[];
   classes: ClassItem[];
   initialFilter?: ScheduleFilter;
   academicYear?: AcademicYear;
   patterns?: DayPattern[];
   holidays?: CalendarHoliday[];
   overrides?: DayOverride[];
   events?: CalendarEvent[];
   engineContext?: EngineContext;
   setEngineContext?: React.Dispatch<React.SetStateAction<EngineContext>>;
   onToggleMode: (modeId: string) => void;
}

type ViewMode = 'class' | 'teacher' | 'subject';

const Schedule: React.FC<ScheduleProps> = ({
   scheduleConfig, employees, classes, initialFilter,
   academicYear, patterns, holidays, overrides, events, engineContext, setEngineContext, onToggleMode
}) => {
   const { addToast } = useToast();
   // Hooks
   const { lessons, setLessons } = useLessons();
   const { absences } = useAbsences();
   const { substitutionLogs } = useSubstitutions();
   const absenceLogic = useAbsence();

   const printRef = useRef<HTMLDivElement>(null);

   // Basic View State
   const [viewMode, setViewMode] = useState<ViewMode>('class');
   const [selectedEntityId, setSelectedEntityId] = useState<string | number>(classes[0]?.id || '');
   const [isTransposed, setIsTransposed] = useState(false);
   const [hideHolidays, setHideHolidays] = useState(true);

   // Slot Absence Modal State
   const [absenceModal, setAbsenceModal] = useState<{
      isOpen: boolean;
      teacher: Employee | null;
      date: string;
      period: number;
      dayName: string;
   }>({ isOpen: false, teacher: null, date: '', period: 0, dayName: '' });

   // Advanced Filters State
   const [showFilterPanel, setShowFilterPanel] = useState(false);
   const [filteredDays, setFilteredDays] = useState<string[]>([]);
   const [periodRange, setPeriodRange] = useState<{ start: number, end: number }>({ start: 1, end: scheduleConfig.periodsPerDay });

   // Derive grouped subjects list
   const groupedSubjects = useMemo(() => {
      const groups = {
         actual: new Set<string>(),
         individual: new Set<string>(),
         stay: new Set<string>(),
         other: new Set<string>()
      };

      lessons.forEach(l => {
         if (l.type === 'stay') groups.stay.add(l.subject);
         else if (l.type === 'individual') groups.individual.add(l.subject);
         else if (l.type === 'actual') groups.actual.add(l.subject);
         else groups.other.add(l.subject);
      });

      employees.forEach(e => e.subjects.forEach(s => {
         const alreadyCategorized = groups.actual.has(s) || groups.individual.has(s) || groups.stay.has(s) || groups.other.has(s);
         if (!alreadyCategorized) groups.actual.add(s);
      }));

      const processGroup = (set: Set<string>) => Array.from(set).sort();

      return {
         actual: processGroup(groups.actual),
         individual: processGroup(groups.individual),
         stay: processGroup(groups.stay),
         other: processGroup(groups.other)
      };
   }, [employees, lessons]);

   const allSubjectsFlattened = useMemo(() => [
      ...groupedSubjects.actual,
      ...groupedSubjects.individual,
      ...groupedSubjects.stay,
      ...groupedSubjects.other
   ], [groupedSubjects]);

   useEffect(() => {
      if (initialFilter) {
         setViewMode(initialFilter.mode);
         setSelectedEntityId(initialFilter.id);
      }
   }, [initialFilter]);

   // Sync selection when data changes
   useEffect(() => {
      if (viewMode === 'class') {
         const exists = classes.some(c => String(c.id) === String(selectedEntityId));
         if (!exists && classes.length > 0) {
            setSelectedEntityId(classes[0].id);
         }
      } else if (viewMode === 'teacher') {
         const exists = employees.some(e => String(e.id) === String(selectedEntityId));
         if (!exists && employees.length > 0) {
            setSelectedEntityId(employees[0].id);
         }
      } else if (viewMode === 'subject') {
         const exists = allSubjectsFlattened.includes(selectedEntityId as string);
         if (!exists && allSubjectsFlattened.length > 0) {
            setSelectedEntityId(allSubjectsFlattened[0]);
         }
      }
   }, [viewMode, classes, employees, allSubjectsFlattened, selectedEntityId]);

   const visibleDays = useMemo(() => {
      let sorted = getSortedDays(scheduleConfig.weekStartDay);

      if (hideHolidays) {
         sorted = sorted.filter(day => {
            const normDay = normalizeArabic(day);
            return !scheduleConfig.holidays.some(h => normalizeArabic(h) === normDay);
         });
      }

      if (filteredDays.length > 0) {
         sorted = sorted.filter(day => filteredDays.includes(day));
      }

      return sorted;
   }, [hideHolidays, scheduleConfig.holidays, scheduleConfig.weekStartDay, filteredDays]);

   const periodsCount = useMemo(() => {
      return Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1)
         .filter(p => p >= periodRange.start && p <= periodRange.end);
   }, [scheduleConfig.periodsPerDay, periodRange]);

   const getCellContent = (day: string, period: number): Lesson[] => {
      const targetDayNorm = normalizeArabic(day);

      return lessons.filter(l => {
         if (normalizeArabic(l.day) !== targetDayNorm || Number(l.period) !== Number(period)) return false;

         if (viewMode === 'subject') {
            return l.subject === selectedEntityId;
         }
         if (viewMode === 'class') {
            return String(l.classId) === String(selectedEntityId);
         }
         if (viewMode === 'teacher') {
            return String(l.teacherId) === String(selectedEntityId);
         }
         return false;
      });
   };

   const getActiveModeForSlot = (dayName: string, period: number, targetId: string | number): ModeConfig | undefined => {
      if (!engineContext) return undefined;
      const modes = Object.values(engineContext) as ModeConfig[];
      return modes.find(m => {
         if (!m.isActive) return false;
         if (!m.affectedPeriods.includes(period)) return false;
         if (viewMode === 'class' && m.target === 'specific_classes' && !m.affectedClassIds.includes(String(targetId))) return false;
         return true;
      });
   };

   const resolveLayeredContent = (day: string, period: number) => {
      const baseLessons = getCellContent(day, period);

      const today = new Date();
      const currentDayIndex = today.getDay();
      const targetDayIndex = DAYS_AR.indexOf(day);
      let diff = targetDayIndex - currentDayIndex;
      if (diff < 0) diff += 7;

      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
      const dateStr = toLocalISOString(targetDate);

      let finalLessons = [...baseLessons];
      let substitutionInfo = null;

      if (viewMode === 'teacher') {
         const myAbsence = absences.find(a =>
            a.teacherId === Number(selectedEntityId) &&
            a.date === dateStr &&
            (a.type === 'FULL' || a.affectedPeriods.includes(period))
         );

         if (myAbsence) {
            finalLessons = finalLessons.map(l => ({ ...l, type: 'ABSENT_CANCELLED' }));
         }

         const myCoverage = substitutionLogs.find(s =>
            s.date === dateStr &&
            s.period === period &&
            s.substituteId === Number(selectedEntityId)
         );

         if (myCoverage) {
            const coveredClass = classes.find(c => c.id === myCoverage.classId);
            finalLessons.push({
               id: `SUB-${myCoverage.id}`,
               teacherId: Number(selectedEntityId),
               classId: myCoverage.classId,
               day: day,
               period: period,
               subject: `تغطية (${coveredClass?.name || '?'})`,
               type: 'COVERAGE'
            });
            substitutionInfo = { type: 'COVERING', detail: coveredClass?.name };
         }
      } else if (viewMode === 'class') {
         finalLessons = finalLessons.map(l => {
            const teacherAbsence = absences.find(a =>
               a.teacherId === l.teacherId &&
               a.date === dateStr &&
               (a.type === 'FULL' || a.affectedPeriods.includes(period))
            );

            if (teacherAbsence) {
               const subLog = substitutionLogs.find(s =>
                  s.date === dateStr &&
                  s.period === period &&
                  s.absentTeacherId === l.teacherId &&
                  s.classId === l.classId
               );

               if (subLog) {
                  return { ...l, teacherId: subLog.substituteId, type: 'SUBSTITUTED' };
               } else {
                  return { ...l, type: 'TEACHER_ABSENT' };
               }
            }
            return l;
         });
      }

      let activeEvent: CalendarEvent | undefined;
      if (events && events.length > 0) {
         activeEvent = events.find(e =>
            e.date === dateStr &&
            e.appliesTo.periods.includes(period) &&
            e.opContext?.isActive &&
            (
               (viewMode === 'class' && e.appliesTo.classes.includes(String(selectedEntityId))) ||
               (viewMode === 'teacher' && (e.plannerId === Number(selectedEntityId) || e.participants.some(p => p.userId === Number(selectedEntityId))))
            )
         );
      }

      return { baseLessons: finalLessons, activeEvent, substitutionInfo };
   };

   const handlePrint = () => {
      window.print();
   };

   // Handle slot click - open absence modal
   const handleSlotClick = (lesson: Lesson, day: string, period: number) => {
      const teacher = employees.find(e => e.id === lesson.teacherId);
      if (!teacher) {
         addToast('لم يتم العثور على المعلم', 'error');
         return;
      }

      // Calculate the date for this day
      const today = new Date();
      const currentDayIndex = today.getDay();
      const targetDayIndex = DAYS_AR.indexOf(day);
      let diff = targetDayIndex - currentDayIndex;
      if (diff < 0) diff += 7;

      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
      const dateStr = toLocalISOString(targetDate);

      setAbsenceModal({
         isOpen: true,
         teacher,
         date: dateStr,
         period,
         dayName: day
      });
   };

   // Handle absence save
   const handleAbsenceSave = (absence: Omit<AbsenceRecord, 'id'>, coverageRequests: Omit<CoverageRequest, 'id'>[]) => {
      absenceLogic.handleCreateAbsence(absence, coverageRequests);
      setAbsenceModal({ isOpen: false, teacher: null, date: '', period: 0, dayName: '' });
   };

   const xAxisItems = isTransposed ? periodsCount : visibleDays;
   const yAxisItems = isTransposed ? visibleDays : periodsCount;

   return (
      <div className="space-y-6 animate-fade-in pb-12">
         <style>{`
        @media print {
          body * { visibility: hidden; }
          #schedule-print-container, #schedule-print-container * { visibility: visible; }
          #schedule-print-container { position: absolute; left: 0; top: 0; width: 100%; background: white; padding: 20px; direction: rtl; }
          .no-print { display: none !important; }
        }
      `}</style>

         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 no-print">
            <div><h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">الجدول الدراسي الذكي <Sparkles className="text-amber-400 fill-amber-400" size={24} /></h2><p className="text-slate-500 mt-1 font-bold text-[10px] uppercase tracking-widest">تزامن التوقيت والمهام التشارقية تلقائياً</p></div>

            {engineContext && (
               <div className="bg-slate-900 px-4 py-2 rounded-2xl border border-white/5 shadow-2xl flex flex-wrap items-center gap-2 w-full lg:w-auto">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-3 border-l border-white/10 pl-3">بروتوكول النظام:</span>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                     {[
                        { id: 'rainyMode', label: 'ماطر', icon: CloudRain },
                        { id: 'tripMode', label: 'رحلة', icon: Bus },
                        { id: 'emergencyMode', label: 'طوارئ', icon: Siren },
                     ].map(m => {
                        const active = engineContext[m.id]?.isActive;
                        return (
                           <button
                              key={m.id}
                              onClick={() => onToggleMode(m.id)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                           >
                              <m.icon size={12} />
                              {m.label}
                           </button>
                        );
                     })}
                  </div>
               </div>
            )}
         </div>

         <div className="flex flex-col xl:flex-row gap-6 no-print">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center flex-1">
               <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                  <button onClick={() => setViewMode('class')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black transition-all ${viewMode === 'class' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>الشعب</button>
                  <button onClick={() => setViewMode('teacher')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black transition-all ${viewMode === 'teacher' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>المعلمين</button>
                  <button onClick={() => setViewMode('subject')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black transition-all ${viewMode === 'subject' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>المواضيع</button>
               </div>

               <div className="flex-1 w-full">
                  <div className="relative">
                     <select
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm rounded-2xl px-5 py-4 appearance-none outline-none focus:border-indigo-500 transition-all cursor-pointer"
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                     >
                        {viewMode === 'class' && classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        {viewMode === 'teacher' && employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        {viewMode === 'subject' && allSubjectsFlattened.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                     <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
               </div>

               <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => setIsTransposed(!isTransposed)} className={`p-4 rounded-2xl border transition-all ${isTransposed ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`} title="تبديل المحاور"><ArrowLeftRight size={20} /></button>
                  <button onClick={() => setHideHolidays(!hideHolidays)} className={`p-4 rounded-2xl border transition-all ${hideHolidays ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`} title="إخفاء العطل"><EyeOff size={20} /></button>
                  <button onClick={handlePrint} className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-slate-800 transition-all"><Printer size={20} /></button>
               </div>
            </div>
         </div>

         <div id="schedule-print-container" className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden print-border print-bg-none">
            <div className="overflow-x-auto">
               <table className="w-full text-right border-collapse">
                  <thead>
                     <tr>
                        <th className="p-6 bg-slate-50 border-b border-l border-slate-200 text-slate-400 font-black text-xs w-32 text-center print:bg-gray-100">
                           {isTransposed ? 'اليوم / الحصة' : 'الحصة / اليوم'}
                        </th>
                        {xAxisItems.map((item, idx) => (
                           <th key={idx} className="p-4 bg-slate-50 border-b border-l border-slate-200 text-slate-700 font-black text-sm text-center min-w-[120px] print:bg-gray-100">
                              {isTransposed ? `الحصة ${item}` : item}
                           </th>
                        ))}
                     </tr>
                  </thead>
                  <tbody>
                     {yAxisItems.map((yItem, yIdx) => (
                        <tr key={yIdx} className="group hover:bg-slate-50/50 transition-colors">
                           <td className="p-4 bg-slate-50/50 border-b border-l border-slate-200 text-center font-black text-slate-600 text-sm print:bg-gray-50">
                              {isTransposed ? yItem : `الحصة ${yItem}`}
                              {!isTransposed && <span className="block text-[9px] text-slate-400 mt-1 font-mono">{calculatePeriodTimeRange(Number(yItem), scheduleConfig)}</span>}
                           </td>
                           {xAxisItems.map((xItem, xIdx) => {
                              const day = isTransposed ? String(yItem) : String(xItem);
                              const period = isTransposed ? Number(xItem) : Number(yItem);
                              const { baseLessons, activeEvent, substitutionInfo } = resolveLayeredContent(day, period);
                              const activeMode = getActiveModeForSlot(day, period, selectedEntityId);

                              const isHoliday = scheduleConfig.holidays.includes(day);
                              if (isHoliday && hideHolidays) return null;

                              return (
                                 <td key={`${yIdx}-${xIdx}`} className={`p-2 border-b border-l border-slate-100 relative h-32 align-top transition-all ${isHoliday ? 'bg-slate-100/50' : 'bg-white'}`}>
                                    {isHoliday ? (
                                       <div className="h-full flex items-center justify-center text-slate-300 font-black text-xs -rotate-12 select-none">عطلة رسمية</div>
                                    ) : (
                                       <div className="h-full flex flex-col gap-1">
                                          {activeMode && (
                                             <div className="absolute top-0 right-0 left-0 h-1 bg-indigo-500 opacity-20"></div>
                                          )}
                                          {activeEvent && (
                                             <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 mb-1 flex items-start gap-2">
                                                <Zap size={12} className="text-indigo-500 mt-0.5" />
                                                <div>
                                                   <span className="block text-[10px] font-black text-indigo-700 leading-tight">{activeEvent.title}</span>
                                                   <span className="text-[8px] text-indigo-400 font-bold">{activeEvent.eventType}</span>
                                                </div>
                                             </div>
                                          )}

                                          {baseLessons.map((lesson, lIdx) => {
                                             const isSubstituted = lesson.type === 'SUBSTITUTED';
                                             const isAbsent = lesson.type === 'TEACHER_ABSENT' || lesson.type === 'ABSENT_CANCELLED';
                                             const isCoverage = lesson.type === 'COVERAGE';

                                             // Check if this slot has a pending coverage request
                                             const hasPendingCoverage = !isCoverage && !isSubstituted && absences.some(a =>
                                                a.teacherId === lesson.teacherId &&
                                                (a.type === 'FULL' || a.affectedPeriods?.includes(period)) &&
                                                a.status === 'OPEN'
                                             );

                                             let cardStyle = "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-md";
                                             if (isSubstituted || isAbsent) cardStyle = "bg-rose-50 border-rose-200 text-rose-700 opacity-70 grayscale";
                                             if (isCoverage) cardStyle = "bg-amber-50 border-amber-200 text-amber-800";
                                             if (lesson.type === 'stay') cardStyle = "bg-amber-50/50 border-amber-100 text-amber-700 hover:border-amber-300";
                                             if (lesson.type === 'individual') cardStyle = "bg-emerald-50/50 border-emerald-100 text-emerald-700 hover:border-emerald-300";
                                             if (hasPendingCoverage) cardStyle = "bg-orange-50 border-orange-300 text-orange-800 ring-2 ring-orange-200";

                                             return (
                                                <div
                                                   key={lIdx}
                                                   onClick={() => !isCoverage && !isSubstituted && handleSlotClick(lesson, day, period)}
                                                   className={`p-2 rounded-xl border ${cardStyle} shadow-sm text-right relative group overflow-hidden cursor-pointer transition-all`}
                                                >
                                                   {/* Pending Coverage Badge */}
                                                   {hasPendingCoverage && (
                                                      <div className="absolute top-0 left-0 bg-orange-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-br-lg flex items-center gap-0.5">
                                                         <UserMinus size={8} /> يحتاج بديل
                                                      </div>
                                                   )}
                                                   <div className="flex justify-between items-start">
                                                      <span className="font-black text-xs truncate max-w-[80%]">{lesson.subject}</span>
                                                      <span className="text-[9px] font-bold opacity-70 bg-white/50 px-1 rounded">{lesson.type === 'stay' ? 'مكوث' : lesson.type === 'individual' ? 'فردي' : 'فعلي'}</span>
                                                   </div>
                                                   <div className="text-[10px] font-bold mt-1 opacity-90 flex items-center gap-1">
                                                      {viewMode === 'teacher' ? (
                                                         <span className="flex items-center gap-1"><BookOpen size={10} /> {classes.find(c => c.id === lesson.classId)?.name}</span>
                                                      ) : (
                                                         <span className="flex items-center gap-1"><User size={10} /> {employees.find(e => e.id === lesson.teacherId)?.name.split(' ')[0]}</span>
                                                      )}
                                                   </div>
                                                   {isSubstituted && <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] font-black text-rose-600 text-xs rotate-12 border-2 border-rose-600 rounded-lg m-2">تم التبديل</div>}
                                                   {isAbsent && !isSubstituted && <div className="absolute inset-0 flex items-center justify-center bg-rose-100/80 font-black text-rose-600 text-xs">غائب</div>}
                                                </div>
                                             );
                                          })}
                                          {baseLessons.length === 0 && !activeEvent && (
                                             <div className="h-full flex items-center justify-center text-slate-200">
                                                <Minus size={16} />
                                             </div>
                                          )}
                                       </div>
                                    )}
                                 </td>
                              );
                           })}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Slot Absence Modal */}
         {absenceModal.teacher && (
            <SlotAbsenceModal
               isOpen={absenceModal.isOpen}
               onClose={() => setAbsenceModal({ isOpen: false, teacher: null, date: '', period: 0, dayName: '' })}
               teacher={absenceModal.teacher}
               date={absenceModal.date}
               period={absenceModal.period}
               dayName={absenceModal.dayName}
               lessons={lessons}
               scheduleConfig={scheduleConfig}
               classes={classes}
               existingAbsence={absences.find(a => a.teacherId === absenceModal.teacher?.id && a.date === absenceModal.date)}
               onSave={handleAbsenceSave}
            />
         )}
      </div>
   );
};

export default Schedule;
