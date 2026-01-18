
import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserX, Search, CheckCircle2, AlertTriangle, X, List, Globe, ShieldCheck, 
  Users, Calendar, Clock, UserCheck, ChevronDown, Filter, Coffee, 
  ArrowLeftRight, CalendarRange, Trash2, Check, UserPlus, Zap, Siren,
  Activity, Shield, Briefcase, LayoutList, ChevronLeft, ChevronRight,
  UserMinus, BarChart4, TrendingUp, CalendarDays, ArrowRight, Table,
  FileText, ClipboardCheck, ArrowLeft, Split, Layers, Briefcase as CaseIcon,
  MousePointerClick, BriefcaseBusiness, Ban, LogOut, LogIn, ChevronUp, User, Edit3,
  Stethoscope, Thermometer, Clock3, AlertOctagon, RotateCcw, ToggleLeft, ToggleRight,
  CalendarClock, Copy, Lock, Home, Play, PlayCircle, CheckSquare, Sun, Moon, BrainCircuit,
  Timer
} from 'lucide-react';
import { Employee, AbsenceRecord, ScheduleConfig, Lesson, ClassItem, SubstitutionLog, EngineContext, ModeConfig, CalendarEvent } from '../types';
import { generateSubstitutionOptions, normalizeArabic } from '../utils';
import { DAYS_AR } from '../constants';
import { useToast } from '../contexts/ToastContext';
import GroupAbsenceBoard from './GroupAbsenceBoard';

interface AbsenceFormProps {
  employees: Employee[];
  classes: ClassItem[];
  lessons: Lesson[];
  scheduleConfig: ScheduleConfig;
  date: string;
  dayOfWeek: string;
  onSave: (absences: Omit<AbsenceRecord, 'id'>[], substitutions: Omit<SubstitutionLog, 'id' | 'timestamp'>[]) => void;
  onCancel: () => void;
  engineContext: EngineContext;
  initialData?: AbsenceRecord;
  onDelete?: () => void;
  existingAbsences?: AbsenceRecord[];
  substitutionLogs?: SubstitutionLog[];
  onToggleMode?: (modeId: string) => void;
  events?: CalendarEvent[];
  preSelectedPool?: number[]; // NEW PROP
}

interface SelectedTeacherState {
    id: number;
    startDate: string;
    endDate: string;
    type: 'FULL' | 'PARTIAL';
    affectedPeriods: number[];
    reason: string;
}

// --- HELPER: Partial Absence Inference ---
const inferPartialAbsence = (selectedPeriods: number[], maxPeriod: number) => {
    if (!selectedPeriods || selectedPeriods.length === 0) return {};
    const P = [...new Set(selectedPeriods)].sort((a, b) => a - b);
    const minP = P[0];
    const maxP = P[P.length - 1];
    
    let isContiguous = true;
    for (let i = 0; i < P.length - 1; i++) {
        if (P[i+1] !== P[i] + 1) { isContiguous = false; break; }
    }
    
    const coversStart = minP === 1;
    const coversEnd = maxP === maxPeriod;
    
    let type: 'LATE' | 'LEAVE_AND_RETURN' | 'LEAVE_UNTIL_END' = 'LEAVE_AND_RETURN';
    let label = 'غياب جزئي';
    
    if (!isContiguous) {
        label = 'غياب جزئي متقطع';
    } else {
        if (coversStart && !coversEnd) { type = 'LATE'; label = 'تأخير'; } 
        else if (!coversStart && coversEnd) { type = 'LEAVE_UNTIL_END'; label = 'مغادرة لنهاية الدوام'; } 
        else if (!coversStart && !coversEnd) { type = 'LEAVE_AND_RETURN'; label = 'مغادرة مع عودة'; }
    }
    
    return { 
        partialAbsenceType: type, 
        partialAbsenceLabelAr: label, 
        partialAbsencePattern: (isContiguous ? 'CONTIGUOUS' : 'NON_CONTIGUOUS') as 'CONTIGUOUS' | 'NON_CONTIGUOUS'
    };
};

// --- HELPER: Get Dates in Range ---
const getDatesInRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        dates.push(new Date(current).toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
};

// --- HELPER: Robust Day Name Getter ---
const getSafeDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00'); 
    return DAYS_AR[d.getDay()];
};

const AbsenceForm: React.FC<AbsenceFormProps> = ({
  employees, classes, lessons, scheduleConfig, date: initialDate, dayOfWeek,
  onSave, onCancel, engineContext, initialData, onDelete, existingAbsences = [], substitutionLogs = [], onToggleMode, events = [],
  preSelectedPool = [] // Use passed pool if available
}) => {
  const { addToast } = useToast();
  
  // 3 Stages: 1=Scope, 2=Details, 3=Resolution
  const [step, setStep] = useState<1 | 2 | 3>(1); 
  
  // Stage 1: Scope (Who & When & What)
  const [selectedTeachers, setSelectedTeachers] = useState<SelectedTeacherState[]>([]);
  
  // Global Dates (Defaults for new selections)
  const [globalStartDate, setGlobalStartDate] = useState(initialDate);
  const [globalEndDate, setGlobalEndDate] = useState(initialDate);
  const [searchTerm, setSearchTerm] = useState('');

  // Stage 3: Substitution (Manual & Auto)
  const [substitutions, setSubstitutions] = useState<Omit<SubstitutionLog, 'id' | 'timestamp'>[]>([]);
  
  // --- POOL WIZARD STATE ---
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [activeExternalIds, setActiveExternalIds] = useState<number[]>(preSelectedPool);
  
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Visualization Date for the Board (defaults to start date)
  const [boardViewDate, setBoardViewDate] = useState<string>(initialDate);

  const periods = Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1);

  // Sync with prop if it changes
  useEffect(() => {
      if (preSelectedPool.length > 0) {
          setActiveExternalIds(prev => [...new Set([...prev, ...preSelectedPool])]);
      }
  }, [preSelectedPool]);

  // Initial Load
  useEffect(() => {
    if (initialData) {
      const targetDate = initialData.date;
      const sameDayAbsences = existingAbsences.filter(a => a.date === targetDate);
      const teachersToLoad = sameDayAbsences.length > 0 ? sameDayAbsences : [initialData];

      const mappedTeachers: SelectedTeacherState[] = teachersToLoad.map(abs => ({
          id: abs.teacherId, 
          startDate: abs.date, 
          endDate: abs.date,
          type: abs.type,
          affectedPeriods: abs.affectedPeriods || [],
          reason: abs.reason
      }));

      setSelectedTeachers(mappedTeachers);
      setGlobalStartDate(targetDate);
      setGlobalEndDate(targetDate);
      setBoardViewDate(targetDate);
      
      const teacherIds = teachersToLoad.map(t => t.teacherId);
      const existingLogs = substitutionLogs.filter(log => 
          log.date === targetDate && teacherIds.includes(log.absentTeacherId)
      );
      setSubstitutions(existingLogs);
      setStep(3); 
    } else {
        setBoardViewDate(globalStartDate);
    }
  }, [initialData, existingAbsences, substitutionLogs]);

  useEffect(() => {
      if (boardViewDate < globalStartDate || boardViewDate > globalEndDate) {
          setBoardViewDate(globalStartDate);
      }
  }, [globalStartDate, globalEndDate]);

  // --- COMPUTED ---
  const filteredEmployees = useMemo(() => employees.filter(e => !e.constraints.isExternal && e.name.toLowerCase().includes(searchTerm.toLowerCase())), [employees, searchTerm]);
  
  // Split lists for Step 1 Display
  const selectedList = useMemo(() => {
      return selectedTeachers.map(t => employees.find(e => e.id === t.id)).filter(Boolean) as Employee[];
  }, [selectedTeachers, employees]);

  const availableList = useMemo(() => {
      return filteredEmployees.filter(e => !selectedTeachers.some(t => t.id === e.id));
  }, [filteredEmployees, selectedTeachers]);

  // Identify teachers who are ALREADY absent on the global start date
  const preAbsentIds = useMemo(() => {
      if (initialData) return new Set(); 
      return new Set(
          existingAbsences
            .filter(a => a.date === globalStartDate)
            .map(a => a.teacherId)
      );
  }, [existingAbsences, globalStartDate, initialData]);

  // Compute affected lessons (Filtered by Class Events)
  const affectedLessons = useMemo(() => {
      const list: any[] = [];
      selectedTeachers.forEach(teacherSel => {
          const tDates = getDatesInRange(teacherSel.startDate, teacherSel.endDate);
          tDates.forEach(d => {
              const dName = getSafeDayName(d);
              if (scheduleConfig.holidays.includes(dName)) return;
              const teacherName = employees.find(e => e.id === teacherSel.id)?.name;
              
              const normalizedDay = normalizeArabic(dName);

              const teacherLessons = lessons.filter(l => 
                  l.teacherId === teacherSel.id && 
                  normalizeArabic(l.day) === normalizedDay &&
                  (teacherSel.type === 'FULL' || teacherSel.affectedPeriods.includes(l.period))
              );
              
              teacherLessons.forEach(l => {
                  const hasClassEvent = events.some(e => 
                      e.date === d && 
                      e.appliesTo.periods.includes(l.period) && 
                      e.appliesTo.classes.includes(l.classId)
                  );

                  if (!hasClassEvent) {
                      const className = classes.find(c => c.id === l.classId)?.name;
                      list.push({ ...l, teacherName, className, date: d, dayName: dName });
                  }
              });
          });
      });
      return list.sort((a,b) => a.date.localeCompare(b.date) || a.period - b.period);
  }, [selectedTeachers, lessons, employees, classes, scheduleConfig, events]);

  const boardViewLessons = useMemo(() => {
      return affectedLessons.filter(l => l.date === boardViewDate);
  }, [affectedLessons, boardViewDate]);

  const assignments = useMemo(() => {
      return substitutions.reduce((acc, sub) => {
          acc[`${sub.absentTeacherId}-${sub.period}`] = sub.substituteTeacherId;
          return acc;
      }, {} as Record<string, number>);
  }, [substitutions]);

  // --- WIZARD POOL CALCULATIONS ---
  const availableExternals = useMemo(() => employees.filter(e => e.constraints.isExternal), [employees]);
  
  const availableInternalCandidates = useMemo(() => {
      const currentDayName = getSafeDayName(boardViewDate);
      const normDay = normalizeArabic(currentDayName);
      const maxP = scheduleConfig.periodsPerDay;
      const absentIds = selectedTeachers.map(t => t.id);
      
      return employees.map(emp => {
          if (emp.constraints.isExternal) return null;
          if (absentIds.includes(emp.id)) return null;

          const dayLessons = lessons
            .filter(l => l.teacherId === emp.id && normalizeArabic(l.day) === normDay)
            .map(l => l.period)
            .sort((a,b) => a-b);
          
          let status: 'FULL' | 'LATE_START' | 'EARLY_END' | 'BUSY' = 'BUSY';
          let label = '';
          let subLabel = '';

          if (dayLessons.length === 0) {
              status = 'FULL';
              label = 'يوم فراغ كامل';
              subLabel = 'متاح طوال اليوم';
          } else {
              const firstLesson = dayLessons[0];
              const lastLesson = dayLessons[dayLessons.length - 1];

              if (firstLesson > 2) {
                  status = 'LATE_START';
                  label = 'يبدأ متأخراً';
                  subLabel = `متاح (1-${firstLesson-1})`;
              } else if (lastLesson <= maxP - 2) {
                  status = 'EARLY_END';
                  label = 'ينهي باكراً';
                  subLabel = `متاح (${lastLesson+1}-${maxP})`;
              }
          }

          if (status === 'BUSY') return null;

          return { emp, status, label, subLabel };
      }).filter(Boolean) as { emp: Employee, status: 'FULL' | 'LATE_START' | 'EARLY_END', label: string, subLabel: string }[];
  }, [employees, lessons, boardViewDate, scheduleConfig.periodsPerDay, selectedTeachers]);

  // --- HANDLERS ---

  const handleTeacherToggle = (id: number) => {
    if (initialData) return;
    if (preAbsentIds.has(id)) {
        addToast("عذراً، هذا المعلم موثق كغائب بالفعل في هذا التاريخ", "error");
        return;
    }
    setSelectedTeachers(prev => {
        const exists = prev.find(t => t.id === id);
        if (exists) return prev.filter(t => t.id !== id);
        else return [...prev, { id, startDate: globalStartDate, endDate: globalEndDate, type: 'FULL', affectedPeriods: [], reason: scheduleConfig.absenceReasons[0] || 'مرضي' }];
    });
  };

  const updateTeacherConfig = (id: number, field: keyof SelectedTeacherState, value: any) => {
      setSelectedTeachers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const applyGlobalDatesToAll = (start: string, end: string) => {
      setGlobalStartDate(start);
      setGlobalEndDate(end);
      setSelectedTeachers(prev => prev.map(t => ({ ...t, startDate: start, endDate: end })));
  };

  const handleApplyToAllDetails = () => {
      if (selectedTeachers.length === 0) return;
      const template = selectedTeachers[0];
      setSelectedTeachers(prev => prev.map(t => ({ ...t, type: template.type, affectedPeriods: template.affectedPeriods, reason: template.reason })));
      addToast("تم تعميم الإعدادات على جميع المعلمين المختارين", "success");
  };

  // --- WIZARD HANDLERS ---
  const toggleWizardSelection = (id: number) => {
      setActiveExternalIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleWizardNext = () => {
      if (wizardStep < 3) setWizardStep(prev => prev + 1 as any);
      else {
          setIsWizardOpen(false);
          addToast("تم تجهيز قائمة البدلاء والأولويات بنجاح", "success");
      }
  };

  const handleBatchAutoAssign = () => {
      if (affectedLessons.length === 0) return;
      setIsAutoAssigning(true);
      
      const currentBatchAbsentIds = selectedTeachers.map(t => t.id);
      let activeMode: ModeConfig = (Object.values(engineContext) as ModeConfig[]).find(m => m.isActive) || engineContext.normalMode;
      
      setTimeout(() => {
          let assignedCount = 0;
          const newSubs = [...substitutions];
          const tempLogs: any[] = [...substitutions];

          const dailyLoadTracker: Record<string, Record<number, number>> = {}; 
          const uniqueDates = Array.from(new Set(affectedLessons.map(l => l.date))) as string[];
          
          uniqueDates.forEach(d => {
              const dName = getSafeDayName(d);
              const normDay = normalizeArabic(dName);
              dailyLoadTracker[d] = {};
              employees.forEach(e => {
                  const scheduleLoad = lessons.filter(l => l.teacherId === e.id && normalizeArabic(l.day) === normDay && l.type !== 'duty').length;
                  const subLoad = substitutions.filter(s => s.date === d && s.substituteTeacherId === e.id).length;
                  dailyLoadTracker[d][e.id] = scheduleLoad + subLoad;
              });
          });

          affectedLessons.forEach(l => {
              const isNonCoverable = l.type === 'stay' || l.type === 'individual' || l.subject.includes('مشترك') || l.type === 'duty';
              if (isNonCoverable) return;
              if (newSubs.some(s => s.period === l.period && s.classId === l.classId && s.date === l.date)) return;

              const checkAvailability = (empId: number) => {
                  if (currentBatchAbsentIds.includes(empId)) return false;
                  const currentLoad = dailyLoadTracker[l.date]?.[empId] || 0;
                  if (currentLoad >= 5) return false;

                  const emp = employees.find(e => e.id === empId);
                  if (!emp?.constraints.isExternal) {
                      const dName = getSafeDayName(l.date);
                      const normDay = normalizeArabic(dName);
                      const hasLesson = lessons.some(les => 
                          les.teacherId === empId && 
                          normalizeArabic(les.day) === normDay && 
                          les.period === l.period
                      );
                      if (hasLesson) return false;
                  }

                  const isBusySub = tempLogs.some(s => 
                      s.substituteTeacherId === empId && 
                      s.period === l.period && 
                      s.date === l.date
                  );
                  if (isBusySub) return false;

                  const isBusyEvent = events.some(e => 
                      e.date === l.date && 
                      e.appliesTo.periods.includes(l.period) && 
                      (e.plannerId === empId || e.participants.some(p => p.userId === emp.id))
                  );
                  if (isBusyEvent) return false;

                  return true;
              };

              let bestCandidate = null;

              const poolCandidates = activeExternalIds
                  .map(id => employees.find(e => e.id === id))
                  .filter(e => e) as Employee[];
              
              poolCandidates.sort((a, b) => {
                  if (a.constraints.isExternal && !b.constraints.isExternal) return -1;
                  if (!a.constraints.isExternal && b.constraints.isExternal) return 1;
                  const loadA = dailyLoadTracker[l.date]?.[a.id] || 0;
                  const loadB = dailyLoadTracker[l.date]?.[b.id] || 0;
                  return loadA - loadB;
              });

              for (const cand of poolCandidates) {
                  if (checkAvailability(cand.id)) {
                      bestCandidate = {
                          teacherId: cand.id,
                          teacherName: cand.name,
                          type: cand.constraints.isExternal ? 'assign_external' : 'assign_internal',
                          reason: 'Wizard Selection (Pool)'
                      };
                      break;
                  }
              }

              if (!bestCandidate) {
                  const options = generateSubstitutionOptions(l.teacherId, l.period, l.date, employees, lessons, classes, scheduleConfig, tempLogs, events, [], engineContext);
                  const validOptions = options.filter(o => checkAvailability(o.teacherId));
                  if (validOptions.length > 0) {
                      const top = validOptions[0];
                      bestCandidate = {
                          teacherId: top.teacherId,
                          teacherName: top.teacherName,
                          type: top.decisionType,
                          reason: top.reason + ' (AI)'
                      };
                  }
              }

              if (bestCandidate) {
                  newSubs.push({
                      date: l.date,
                      period: l.period,
                      classId: l.classId,
                      absentTeacherId: l.teacherId,
                      substituteTeacherId: bestCandidate.teacherId,
                      substituteName: bestCandidate.teacherName,
                      type: bestCandidate.type as any,
                      reason: bestCandidate.reason,
                      modeContext: activeMode.name
                  });
                  tempLogs.push({ date: l.date, period: l.period, substituteTeacherId: bestCandidate.teacherId });
                  if (dailyLoadTracker[l.date]) {
                      dailyLoadTracker[l.date][bestCandidate.teacherId] = (dailyLoadTracker[l.date][bestCandidate.teacherId] || 0) + 1;
                  }
                  assignedCount++;
              }
          });

          setSubstitutions(newSubs);
          setIsAutoAssigning(false);
          if (assignedCount > 0) {
              addToast(`تم توزيع ${assignedCount} حصة (تم استثناء حصص المكوث/الفردي/المشترك)`, 'success');
          } else {
              addToast('لم يتم العثور على بدلاء مناسبين أو لا توجد حصص فعلية تستدعي التغطية', 'warning');
          }
      }, 600);
  };

  const handleBoardAssign = (slotKey: string, substituteId: number | null) => {
      const [absentIdStr, periodStr] = slotKey.split('-');
      const absentId = Number(absentIdStr);
      const period = Number(periodStr);

      const dayName = getSafeDayName(boardViewDate);
      const normDay = normalizeArabic(dayName);
      const lesson = lessons.find(l => l.teacherId === absentId && l.period === period && normalizeArabic(l.day) === normDay);
      
      if (lesson) {
          const conflictingEvent = events.find(e => 
              e.date === boardViewDate && 
              e.appliesTo.periods.includes(period) && 
              e.appliesTo.classes.includes(lesson.classId) &&
              e.opContext?.isActive
          );

          if (conflictingEvent) {
              if (!window.confirm(
                  `⚠️ تحذير أمني: تعديل محظور!\n\n` +
                  `هذه الحصة مرتبطة بـ "${conflictingEvent.title}" (وضع ${conflictingEvent.eventType}).\n` +
                  `توزيع المراقبين تم آلياً وفق القواعد الصارمة.\n\n` +
                  `هل أنت متأكد تماماً من رغبتك في التدخل اليدوي وتغيير التعيين؟`
              )) {
                  return;
              }
          }
      }

      if (substituteId === null) {
          setSubstitutions(prev => prev.filter(s => !(s.absentTeacherId === absentId && s.period === period && s.date === boardViewDate)));
      } else {
          const sub = employees.find(e => e.id === substituteId);
          if (!sub) return;
          
          setSubstitutions(prev => {
              const filtered = prev.filter(s => !(s.absentTeacherId === absentId && s.period === period && s.date === boardViewDate));
              return [...filtered, {
                  date: boardViewDate,
                  period: period,
                  classId: lesson?.classId || '',
                  absentTeacherId: absentId,
                  substituteTeacherId: sub.id,
                  substituteName: sub.name,
                  type: sub.constraints.isExternal ? 'assign_external' : 'assign_internal',
                  reason: 'Manual Board Assign',
                  modeContext: 'Manual'
              }];
          });
      }
  };

  const handleBoardUnassign = (absentId: number, period: number) => {
      setSubstitutions(prev => prev.filter(s => !(s.absentTeacherId === absentId && s.period === period && s.date === boardViewDate)));
  };

  const handleBoardBulkAssign = (absentTeacherId: number, substituteId: number) => {
      const sub = employees.find(e => e.id === substituteId);
      if (!sub) return;
      const dayName = getSafeDayName(boardViewDate);
      const normDay = normalizeArabic(dayName);
      
      const teacherLessons = lessons.filter(l => l.teacherId === absentTeacherId && normalizeArabic(l.day) === normDay);
      
      const newSubs: Omit<SubstitutionLog, 'id' | 'timestamp'>[] = [];
      teacherLessons.forEach(l => {
          if (l.type === 'stay' || l.type === 'individual' || l.subject.includes('مشترك') || l.type === 'duty') return;
          newSubs.push({
              date: boardViewDate,
              period: l.period,
              classId: l.classId,
              absentTeacherId: absentTeacherId,
              substituteTeacherId: sub.id,
              substituteName: sub.name,
              type: sub.constraints.isExternal ? 'assign_external' : 'assign_internal',
              reason: 'Bulk Board Assign',
              modeContext: 'Manual Bulk'
          });
      });
      setSubstitutions(prev => {
          const filtered = prev.filter(s => !(s.absentTeacherId === absentTeacherId && s.date === boardViewDate));
          return [...filtered, ...newSubs];
      });
      addToast(`تم تعيين ${sub.name} للحصص الفعلية فقط`, 'success');
  };

  const handleSubmit = () => {
    if (selectedTeachers.length === 0) return;
    const absencesList: Omit<AbsenceRecord, 'id'>[] = [];
    selectedTeachers.forEach(teacherSel => {
        const tDates = getDatesInRange(teacherSel.startDate, teacherSel.endDate);
        tDates.forEach((d: string) => {
            const dName = getSafeDayName(d);
            if (scheduleConfig.holidays.includes(dName)) return;
            const partialInfo = teacherSel.type === 'PARTIAL' ? inferPartialAbsence(teacherSel.affectedPeriods, scheduleConfig.periodsPerDay) : {};
            absencesList.push({
                teacherId: teacherSel.id,
                date: d,
                reason: teacherSel.reason,
                type: teacherSel.type,
                affectedPeriods: teacherSel.type === 'FULL' ? periods : teacherSel.affectedPeriods,
                ...partialInfo
            });
        });
    });
    onSave(absencesList, substitutions);
  };

  const activeReservePool = useMemo(() => {
      return employees.filter(e => activeExternalIds.includes(e.id));
  }, [employees, activeExternalIds]);

  return (
    <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col h-[90vh] overflow-hidden relative" dir="rtl">
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <div>
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    {initialData ? <Edit3 className="text-indigo-600"/> : <UserMinus className="text-rose-600"/>}
                    {initialData ? 'تعديل سجل الغياب' : 'بروتوكول توثيق الغياب'}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                    <span className={`h-2 w-2 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                    <span className={`h-1 w-8 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                    <span className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                    <span className={`h-1 w-8 rounded-full ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                    <span className={`h-2 w-2 rounded-full ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                    <span className="text-xs font-bold text-slate-400 mr-2">
                        {step === 1 ? 'تحديد النطاق' : step === 2 ? 'تفاصيل الغياب' : 'المعالجة والبدلاء'}
                    </span>
                </div>
            </div>
            <button onClick={onCancel} className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-2xl transition-all shadow-sm"><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            {step === 1 && (
                <div className="space-y-8 animate-fade-in">
                    {/* Global Dates & Search */}
                    <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CalendarClock size={14}/> الفترة الزمنية (افتراضي)</label>
                            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200">
                                <input type="date" className="bg-transparent font-bold text-xs outline-none text-slate-700" value={globalStartDate} onChange={e => applyGlobalDatesToAll(e.target.value, globalEndDate < e.target.value ? e.target.value : globalEndDate)} />
                                <ArrowLeft size={16} className="text-slate-300" />
                                <input type="date" className="bg-transparent font-bold text-xs outline-none text-slate-700" value={globalEndDate} onChange={e => applyGlobalDatesToAll(globalStartDate, e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Search size={14}/> بحث سريع</label>
                            <input type="text" placeholder="اسم المعلم..." className="w-full p-3 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-indigo-400 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    {/* Teachers Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {/* Selected First */}
                        {selectedList.map(emp => (
                            <div key={emp.id} onClick={() => handleTeacherToggle(emp.id)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 cursor-pointer transform hover:scale-[1.02] transition-all flex items-center gap-3 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-bl-[3rem] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-xs">{emp.name.charAt(0)}</div>
                                <div className="min-w-0">
                                    <p className="font-bold text-xs truncate">{emp.name.split(' ').slice(0,2).join(' ')}</p>
                                    <p className="text-[9px] opacity-80 font-medium">تم التحديد</p>
                                </div>
                                <CheckCircle2 className="absolute top-2 left-2 text-white/50" size={14} />
                            </div>
                        ))}
                        
                        {/* Available */}
                        {availableList.map(emp => {
                            const isPreAbsent = preAbsentIds.has(emp.id);
                            return (
                                <div key={emp.id} onClick={() => !isPreAbsent && handleTeacherToggle(emp.id)} className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-3 group relative ${isPreAbsent ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' : 'bg-white border-slate-100 hover:border-indigo-300 cursor-pointer hover:shadow-md'}`}>
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">{emp.name.charAt(0)}</div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-xs text-slate-700 truncate group-hover:text-indigo-900">{emp.name.split(' ').slice(0,2).join(' ')}</p>
                                        <p className="text-[9px] text-slate-400 font-medium truncate">{isPreAbsent ? 'غائب مسبقاً' : 'على رأس عمله'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-fade-in">
                    {/* Bulk Apply Bar */}
                    <div className="bg-indigo-50/50 p-4 rounded-[2rem] border border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Copy size={18} className="text-indigo-600"/>
                            <div>
                                <p className="text-xs font-black text-indigo-900">تعميم الخصائص</p>
                                <p className="text-[9px] text-indigo-700/70">نسخ إعدادات المعلم الأول (نوع الغياب، الحصص، السبب) للبقية.</p>
                            </div>
                        </div>
                        <button onClick={handleApplyToAllDetails} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black shadow-sm hover:bg-indigo-50 border border-indigo-100 transition-all">تطبيق على الكل</button>
                    </div>

                    <div className="space-y-4">
                        {selectedTeachers.map((tState, idx) => {
                            const emp = employees.find(e => e.id === tState.id);
                            if (!emp) return null;
                            const isPartial = tState.type === 'PARTIAL';

                            return (
                                <div key={tState.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                        {/* Teacher Info */}
                                        <div className="flex items-center gap-4 min-w-[200px]">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-black shadow-inner">{idx + 1}</div>
                                            <div>
                                                <h4 className="font-black text-sm text-slate-800">{emp.name}</h4>
                                                <button onClick={() => handleTeacherToggle(tState.id)} className="text-[9px] text-rose-500 hover:underline mt-0.5 flex items-center gap-1"><Trash2 size={10}/> إزالة من القائمة</button>
                                            </div>
                                        </div>

                                        {/* Config Controls */}
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                            {/* Date Range Override */}
                                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                                                <input type="date" className="bg-transparent text-[10px] font-bold outline-none w-full" value={tState.startDate} onChange={e => updateTeacherConfig(tState.id, 'startDate', e.target.value)} />
                                                <span className="text-slate-300">|</span>
                                                <input type="date" className="bg-transparent text-[10px] font-bold outline-none w-full" value={tState.endDate} onChange={e => updateTeacherConfig(tState.id, 'endDate', e.target.value)} />
                                            </div>

                                            {/* Type & Reason */}
                                            <div className="flex gap-2">
                                                <div className="flex bg-slate-100 p-1 rounded-xl flex-1">
                                                    <button onClick={() => updateTeacherConfig(tState.id, 'type', 'FULL')} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${!isPartial ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>يوم كامل</button>
                                                    <button onClick={() => updateTeacherConfig(tState.id, 'type', 'PARTIAL')} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${isPartial ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>جزئي</button>
                                                </div>
                                                <select 
                                                    className="bg-slate-50 border border-slate-200 rounded-xl px-2 text-[10px] font-bold outline-none w-1/2"
                                                    value={tState.reason}
                                                    onChange={(e) => updateTeacherConfig(tState.id, 'reason', e.target.value)}
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
                                                                const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p].sort((a,b)=>a-b);
                                                                updateTeacherConfig(tState.id, 'affectedPeriods', next);
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
                </div>
            )}
            
            {/* STAGE 3: RESOLUTION */}
            {step === 3 && (
                <div className="h-full flex flex-col animate-fade-in relative">
                    <div className="bg-white border-b border-slate-100 pb-4 mb-4 flex justify-between items-center shrink-0">
                       <div className="flex gap-2 items-center">
                           <div className="bg-slate-50 p-1 rounded-xl flex">
                               <button onClick={() => setIsWizardOpen(true)} className="px-4 py-2 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center gap-2">
                                   <Zap size={14}/> تخصيص البدلاء (Pool Wizard)
                               </button>
                           </div>
                           <button onClick={handleBatchAutoAssign} className="px-4 py-2 rounded-xl text-[10px] font-black bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all flex items-center gap-2 border border-emerald-100">
                               {isAutoAssigning ? <Activity size={14} className="animate-spin"/> : <BrainCircuit size={14}/>}
                               توزيع ذكي (Auto-Distribute)
                           </button>
                       </div>
                       
                       <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                           <button onClick={() => {
                               const d = new Date(boardViewDate); d.setDate(d.getDate()-1); 
                               if(d >= new Date(globalStartDate)) setBoardViewDate(d.toISOString().split('T')[0]);
                           }} className="p-1.5 hover:bg-white rounded-lg text-slate-400 disabled:opacity-30" disabled={boardViewDate <= globalStartDate}><ChevronRight size={14}/></button>
                           <span className="text-[10px] font-black w-24 text-center text-slate-600">{boardViewDate}</span>
                           <button onClick={() => {
                               const d = new Date(boardViewDate); d.setDate(d.getDate()+1); 
                               if(d <= new Date(globalEndDate)) setBoardViewDate(d.toISOString().split('T')[0]);
                           }} className="p-1.5 hover:bg-white rounded-lg text-slate-400 disabled:opacity-30" disabled={boardViewDate >= globalEndDate}><ChevronLeft size={14}/></button>
                       </div>
                    </div>

                    {/* ACTIVE POOL BAR (Visible Consistently) */}
                    {activeReservePool.length > 0 && (
                        <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 mb-4 flex items-center gap-4 animate-slide-down shrink-0">
                            <div className="flex items-center gap-2 text-indigo-700 shrink-0">
                                <BriefcaseBusiness size={16}/>
                                <span className="text-xs font-black">بنك البدلاء النشط:</span>
                            </div>
                            <div className="flex gap-2 overflow-x-auto custom-scrollbar py-1">
                                {activeReservePool.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-black">{p.name.charAt(0)}</div>
                                        <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">{p.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* MAIN BOARD */}
                    <div className="flex-1 overflow-hidden relative">
                        <GroupAbsenceBoard 
                            selectedTeacherIds={selectedTeachers.map(t => t.id)}
                            employees={employees}
                            assignments={assignments}
                            onAssign={handleBoardAssign}
                            onUnassign={handleBoardUnassign}
                            onBulkAssign={handleBoardBulkAssign}
                            activeExternalIds={activeExternalIds}
                            uncoveredLessons={boardViewLessons}
                            classes={classes}
                            lessons={lessons}
                            scheduleConfig={scheduleConfig}
                            dayName={getSafeDayName(boardViewDate)}
                            events={events} 
                            date={boardViewDate}
                            engineContext={engineContext}
                        />
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            {step > 1 ? (
                <button onClick={() => setStep(prev => prev - 1 as any)} className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-100 transition-all">السابق</button>
            ) : (
                initialData && onDelete ? (
                    <button onClick={onDelete} className="px-6 py-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 font-bold text-xs hover:bg-rose-100 transition-all flex items-center gap-2"><Trash2 size={14}/> حذف السجل</button>
                ) : <div></div>
            )}

            {step < 3 ? (
                <button onClick={() => { if(selectedTeachers.length > 0) setStep(prev => prev + 1 as any); }} disabled={selectedTeachers.length === 0} className="px-8 py-3 rounded-2xl bg-slate-900 text-white font-black text-xs shadow-lg hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">التالي</button>
            ) : (
                <button onClick={handleSubmit} className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl hover:bg-emerald-500 transition-all flex items-center gap-3 glow-primary">
                    <CheckCircle2 size={18} /> {initialData ? 'حفظ التعديلات' : 'اعتماد التوثيق'}
                </button>
            )}
        </div>
        
        {isWizardOpen && (
            <div className="absolute inset-0 z-[100] bg-slate-900/10 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
                <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-white/40 flex flex-col overflow-hidden animate-scale-up">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="font-black text-slate-800 flex items-center gap-2"><BriefcaseBusiness size={18} className="text-indigo-600"/> تجهيز بنك البدلاء (Pool)</h4>
                        <button onClick={() => setIsWizardOpen(false)} className="p-2 bg-white rounded-xl shadow-sm text-slate-400 hover:text-rose-500"><X size={16}/></button>
                    </div>
                    
                    <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                        {wizardStep === 1 && (
                            <div className="space-y-6">
                                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                    حدد قائمة البدلاء الخارجيين الذين تم استدعاؤهم أو المتاحين اليوم. سيتم منحهم الأولوية القصوى في التوزيع الآلي وإظهارهم في لوحة التحكم.
                                </p>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                    {availableExternals.length > 0 ? availableExternals.map(ext => {
                                        const isActive = activeExternalIds.includes(ext.id);
                                        return (
                                            <div 
                                                key={ext.id} 
                                                onClick={() => toggleWizardSelection(ext.id)}
                                                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isActive ? 'bg-amber-50 border-amber-400 shadow-md' : 'bg-white border-slate-100 hover:border-amber-200'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isActive ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600'}`}>{ext.name.charAt(0)}</div>
                                                    <div>
                                                        <p className={`text-xs font-black ${isActive ? 'text-amber-900' : 'text-slate-700'}`}>{ext.name}</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-[8px] font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded-md">بديل خارجي</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {isActive && <CheckCircle2 size={18} className="text-amber-500"/>}
                                            </div>
                                        );
                                    }) : (
                                        <div className="text-center py-8 text-slate-400 italic text-xs">لا يوجد معلمون خارجيون معرفون في النظام</div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {wizardStep === 2 && (
                            <div className="space-y-6">
                                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                    اكتشاف المعلمين الداخليين الذين لديهم فراغ كلي أو جزئي اليوم ويمكن إضافتهم لقائمة "الاحتياط النشط".
                                </p>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                    {availableInternalCandidates.map(cand => {
                                        const isActive = activeExternalIds.includes(cand.emp.id);
                                        const isFull = cand.status === 'FULL';
                                        
                                        // Color logic: Emerald for FULL, Indigo for PARTIAL
                                        const baseColor = isFull ? 'emerald' : 'indigo';
                                        const activeBg = isFull ? 'bg-emerald-50 border-emerald-400' : 'bg-indigo-50 border-indigo-400';
                                        const activeText = isFull ? 'text-emerald-900' : 'text-indigo-900';
                                        const iconColor = isFull ? 'text-emerald-600' : 'text-indigo-600';
                                        const badgeBg = isFull ? 'bg-emerald-500' : 'bg-indigo-500';

                                        return (
                                            <div 
                                                key={cand.emp.id} 
                                                onClick={() => toggleWizardSelection(cand.emp.id)}
                                                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isActive ? `${activeBg} shadow-md` : `bg-white border-slate-100 hover:border-${baseColor}-200`}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isActive ? `${badgeBg} text-white` : 'bg-slate-100 text-slate-400'}`}>{cand.emp.name.charAt(0)}</div>
                                                    <div>
                                                        <p className={`text-xs font-black ${isActive ? activeText : 'text-slate-700'}`}>{cand.emp.name}</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            {isFull ? <CheckCircle2 size={10} className={isActive ? 'text-emerald-600' : 'text-emerald-500'}/> : <Timer size={10} className={isActive ? 'text-indigo-600' : 'text-indigo-500'}/>}
                                                            <span className={`text-[8px] font-bold ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>{cand.label} • {cand.subLabel}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {isActive && <CheckCircle2 size={18} className={iconColor}/>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                        {wizardStep > 1 && <button onClick={() => setWizardStep(prev => prev - 1 as any)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">رجوع</button>}
                        <div className="flex gap-2 ml-auto">
                            <button onClick={() => setIsWizardOpen(false)} className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-100">إلغاء</button>
                            <button onClick={handleWizardNext} className="px-8 py-3 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-indigo-600 shadow-lg transition-all">{wizardStep < 2 ? 'التالي: الداخلي المتاح' : 'إنهاء واعتماد'}</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AbsenceForm;
