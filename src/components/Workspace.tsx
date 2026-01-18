import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Check, AlertTriangle, Eye, X, BookOpen, Calculator, Languages, Palette, Dumbbell, Microscope, Globe2, Laptop2, HeartHandshake, ArrowRightLeft, Wand2, AlertCircle, CheckCircle2, GraduationCap, Users, Coffee, Unlock, Clock, Plus, UserX, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Employee, ClassItem, Lesson, ScheduleConfig, EngineContext, SubstitutionLog, CalendarEvent, AbsenceRecord } from '@/types';
import { evaluatePolicyV2, applyModeRulesToDistribution, findLinkedMode, DistributionContext } from '@/utils/policyEngine';
import { normalizeArabic } from '@/utils';
import { getModeMetadata } from '@/utils/modeMetadata';
import { DAYS_AR } from '@/constants';
import CalendarRequestForm from './CalendarRequestForm';
import AbsenceForm from './AbsenceForm';
import { toLocalISOString } from '@/utils';
import { useToast } from '@/contexts/ToastContext';
import { useLessons } from '@/hooks/useLessons';
import { useSubstitutions } from '@/hooks/useSubstitutions';
import { useAbsences } from '@/hooks/useAbsences';
import { useCoverage } from '@/hooks/useCoverage';
import AvailableTeachersPopup from '@/components/workspace/AvailableTeachersPopup';
import { getAvailableTeachers, groupAvailableTeachersByCategory } from '@/utils/workspace/getAvailableTeachers';

interface WorkspaceProps {
  employees: Employee[];
  classes: ClassItem[];
  scheduleConfig: ScheduleConfig;
  engineContext: EngineContext;
  events?: CalendarEvent[]; // الفعاليات
  setEvents?: React.Dispatch<React.SetStateAction<CalendarEvent[]>>; // لتحديث الفعاليات
  onOpenAbsenceForm?: (step: 1 | 2 | 3 | 6) => void; // Open AbsenceForm at specific step
}

const Workspace: React.FC<WorkspaceProps> = ({
  employees,
  classes: classesData,
  scheduleConfig,
  engineContext,
  events = [],
  setEvents,
  onOpenAbsenceForm
}) => {
  const { addToast } = useToast();
  // Atomic Hooks
  const { lessons } = useLessons();
  const { substitutionLogs, setSubstitutionLogs } = useSubstitutions();
  const { absences, setAbsences } = useAbsences();
  const { dailyPools } = useCoverage();

  // Log when component receives new substitutionLogs
  // Logging removed for privacy
  // console.log(`📢 Workspace - Received substitutionLogs:`, substitutionLogs.length, 'items');
  // State management
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    // Find first day with lessons
    const daysWithLessons = Array.from(new Set(lessons.map(l => l.day)));
    return daysWithLessons[0] || DAYS_AR[new Date().getDay()];
  });
  const [selectedMode, setSelectedMode] = useState<string>(''); // Single mode selection
  const [confirmedModes, setConfirmedModes] = useState<Array<{
    modeId: string;
    classes: string[];
    periods: number[];
  }>>([]); // Array of confirmed mode templates
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const [showDistribution, setShowDistribution] = useState(false); // Show distribution after action
  const [activeDistributionIndex, setActiveDistributionIndex] = useState<number | null>(null); // Track which mode is being distributed

  // Phase management (SELECTION = توزيع آلي, COVERAGE = سد الفجوات)
  const [viewPhase, setViewPhase] = useState<'SELECTION' | 'COVERAGE'>('SELECTION');

  // Manual/Auto assignments state
  const [assignments, setAssignments] = useState<Record<string, { teacherId: number, reason: string }[]>>({});

  // Save to calendar modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({
    title: '',
    description: ''
  });

  // Manual selection popup state
  const [activeSlot, setActiveSlot] = useState<{ classId: string, period: number } | null>(null);
// ✅ Available Teachers Popup State
const [selectedLesson, setSelectedLesson] = useState<{
  period: number;
  classId: string;
  className: string;
  subject: string;
  day: string;
  teacherId: number;
} | null>(null);

const [isAvailableTeachersPopupOpen, setIsAvailableTeachersPopupOpen] = useState(false);
  // Absence documentation state (Stages 1-2-3-6 only)
  const [absenceDocumentation, setAbsenceDocumentation] = useState<AbsenceRecord[]>([]);
  const [showAbsenceProtocol, setShowAbsenceProtocol] = useState(true);
  const [activeProtocolStage, setActiveProtocolStage] = useState<1 | 2 | 3 | 6 | null>(null);

  // === NEW: AbsenceForm Modal State (stays on Workspace) ===
  const [showAbsenceFormModal, setShowAbsenceFormModal] = useState(false);
  const [absenceFormStep, setAbsenceFormStep] = useState<1 | 2 | 3 | 6>(1);
  const [localPoolIds, setLocalPoolIds] = useState<number[]>([]);

  const handlePoolUpdate = useCallback((poolIds: number[]) => {
    setLocalPoolIds(poolIds);
  }, []);

  // Update localPoolIds from dailyPools based on viewDate
  useEffect(() => {
    const dateStr = toLocalISOString(viewDate);
    const todayPool = dailyPools.find(p => p.date === dateStr);
    setLocalPoolIds(todayPool ? todayPool.teachers.map(t => t.teacherId) : []);
  }, [dailyPools, viewDate]);
  // Computed values
  const todayStr = toLocalISOString(viewDate);
  const dayName = selectedDay; // Use selected day instead of current day
  const periods = Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1);

  // Compute available teachers for popup (categorized)
  const availableTeachersForPopup = useMemo(() => {
    if (!selectedLesson) {
      return {
        educators: [],
        stayLessonTeachers: [],
        sharedSecondaryTeachers: [],
        individualTeachers: []
      };
    }
    
    const dateStr = toLocalISOString(viewDate);
    const absentTeacherIds = absences
      .filter(a => a.date === dateStr)
      .map(a => a.teacherId);
    
    const alreadyAssignedIds = substitutionLogs
      .filter(s => s.date === dateStr && s.period === selectedLesson.period)
      .map(s => s.substituteId);
    
    const availableTeachers = getAvailableTeachers({
      period: selectedLesson.period,
      classId: selectedLesson.classId,
      day: selectedLesson.day,
      employees: employees,
      lessons: lessons,
      absentTeacherIds: absentTeacherIds,
      alreadyAssignedIds: alreadyAssignedIds
    });
    
    return groupAvailableTeachersByCategory(availableTeachers);
  }, [selectedLesson, viewDate, absences, substitutionLogs, employees, lessons]);

  // Available days with lessons
  const availableDays = useMemo(() => {
    return Array.from(new Set(lessons.map(l => l.day)));
  }, [lessons]);

  // Sorted classes (same as BulletinBoard)
  const sortedClasses = useMemo(() => {
    return [...classesData].sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [classesData]);

  // === NEW: Check if selected date is a school day ===
  const isSchoolDay = useMemo(() => {
    const dayOfWeek = viewDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = toLocalISOString(viewDate);
    const dayNameFromDate = DAYS_AR[dayOfWeek];

    // Check 1: Is this day a configured holiday (weekend) in Settings?
    // We normalize both strings to ensure "الاحد" matches "الأحد"
    const normDayName = normalizeArabic(dayNameFromDate);
    const isHoliday = scheduleConfig.holidays?.some(h => normalizeArabic(h) === normDayName);

    if (isHoliday) {
      return { isSchool: false, reason: 'عطلة نهاية الأسبوع' };
    }

    // Check 2: Is there a HOLIDAY event on this date?
    const holidayEvent = events.find(ev =>
      ev.date === dateStr &&
      ev.status !== 'CANCELLED' &&
      (ev.eventType === 'ADMIN' || ev.title.includes('عطلة') || ev.title.includes('إجازة'))
    );

    if (holidayEvent) {
      return { isSchool: false, reason: holidayEvent.title };
    }

    // Check 3: Does the selected day exist in lessons?
    const hasLessonsForDay = lessons.some(l => l.day === dayNameFromDate);

    if (!hasLessonsForDay) {
      return { isSchool: false, reason: 'لا توجد حصص مجدولة لهذا اليوم' };
    }

    return { isSchool: true, reason: '' };
  }, [viewDate, events, lessons, scheduleConfig.holidays]);

  // === NEW: Manual Assignment Handlers ===

  // Handle manual assign
  const handleAssign = useCallback((classId: string, period: number, teacherId: number, reason: string) => {
    const key = `${classId}-${period}`;
    const dateStr = toLocalISOString(viewDate);
    const normDay = normalizeArabic(dayName);

    // Find the original lesson for this slot
    const originalLesson = lessons.find(l =>
      l.classId === classId &&
      l.period === period &&
      normalizeArabic(l.day) === normDay
    );
    const originalTeacherId = originalLesson?.teacherId;
    const originalTeacher = originalTeacherId ? employees.find(e => e.id === originalTeacherId) : null;
    const substituteTeacher = employees.find(e => e.id === teacherId);

    // Update local assignments state
    setAssignments(prev => {
      const existing = prev[key] || [];
      // Prevent duplicates
      if (existing.some(a => a.teacherId === teacherId)) {
        addToast('⚠️ هذا المعلم معيّن مسبقاً', 'warning');
        return prev;
      }
      return {
        ...prev,
        [key]: [...existing, { teacherId, reason }]
      };
    });

    // === NEW: Register absent teacher in absence records ===
    if (originalTeacherId && setAbsences) {
      // Check if teacher is already marked absent for this date
      const existingAbsence = absences.find(a =>
        a.teacherId === originalTeacherId &&
        a.date === dateStr
      );

      if (!existingAbsence) {
        // Create new absence record
        const newAbsence: AbsenceRecord = {
          id: Date.now(),
          teacherId: originalTeacherId,
          date: dateStr,
          reason: 'غياب (تم تعيين بديل)',
          type: 'PARTIAL',
          affectedPeriods: [period],
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setAbsences(prev => [...prev, newAbsence]);
        addToast(`📝 تم تسجيل غياب ${originalTeacher?.name || 'المعلم'} للحصة ${period}`, 'info');
      } else if (existingAbsence.type === 'PARTIAL') {
        // Update existing partial absence to add this period
        const updatedPeriods = [...(existingAbsence.affectedPeriods || []), period];
        const uniquePeriods = [...new Set(updatedPeriods)].sort((a, b) => a - b);

        setAbsences(prev => prev.map(a =>
          a.id === existingAbsence.id
            ? { ...a, affectedPeriods: uniquePeriods, updatedAt: new Date().toISOString() }
            : a
        ));
      }
    }

    // === NEW: Create substitution log entry ===
    if (setSubstitutionLogs && originalTeacherId) {
      const newLog: SubstitutionLog = {
        id: `log-${Date.now()}-${classId}-${period}`,
        date: dateStr,
        period,
        classId,
        absentTeacherId: originalTeacherId,
        substituteId: teacherId,
        substituteName: substituteTeacher?.name || 'بديل',
        type: 'assign_internal',
        reason: reason,
        modeContext: 'workspace_manual',
        timestamp: Date.now()
      };
      setSubstitutionLogs(prev => [...prev, newLog]);
    }

    addToast(`✅ تم تعيين ${substituteTeacher?.name || 'معلم'} بدل ${originalTeacher?.name || 'المعلم الغائب'}`, 'success');
  }, [viewDate, dayName, lessons, employees, absences, setAbsences, setSubstitutionLogs, addToast]);

  // Handle remove assignment
  const handleRemove = (classId: string, period: number, teacherId: number) => {
    const key = `${classId}-${period}`;
    setAssignments(prev => {
      const existing = prev[key] || [];
      const filtered = existing.filter(a => a.teacherId !== teacherId);

      if (filtered.length === 0) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [key]: filtered
      };
    });

    const teacher = employees.find(e => e.id === teacherId);
    addToast(`❌ تم إلغاء تعيين ${teacher?.name || 'معلم'}`, 'info');
  };

  // Handle teacher selection from popup
  const handleSelectTeacherFromPopup = useCallback((teacherId: number) => {
    if (!selectedLesson) return;

    const teacher = employees.find(e => e.id === teacherId);
    
    handleAssign(
      selectedLesson.classId,
      selectedLesson.period,
      teacherId,
      `بديل من القائمة - ${teacher?.name || 'معلم'}`
    );

    setIsAvailableTeachersPopupOpen(false);
    setSelectedLesson(null);
    
    addToast(`✅ تم اختيار ${teacher?.name || 'معلم'} كبديل`, 'success');
  }, [selectedLesson, employees, handleAssign, addToast]);
  // Handle lesson click to open available teachers popup
  const handleLessonClick = useCallback((lesson: any, className: string) => {
    if (!lesson) return;
    
    setSelectedLesson({
      period: lesson.period,
      classId: lesson.classId,
      className: className,
      subject: lesson.subject,
      day: dayName,
      teacherId: lesson.teacherId
    });
    setIsAvailableTeachersPopupOpen(true);
  }, [dayName]);

  // Handle bulk assign (from auto distribute)
  const handleBulkAssign = (newAssignments: { classId: string, period: number, teacherId: number, reason: string }[]) => {
    setAssignments(prev => {
      const updated = { ...prev };

      newAssignments.forEach(({ classId, period, teacherId, reason }) => {
        const key = `${classId}-${period}`;
        const existing = updated[key] || [];

        // Only add if not already assigned
        if (!existing.some(a => a.teacherId === teacherId)) {
          updated[key] = [...existing, { teacherId, reason }];
        }
      });

      return updated;
    });

    addToast(`✅ تم توزيع ${newAssignments.length} مهمة`, 'success');
  };

  // Handle auto distribute button click (optional templateIndex for single-mode distribution)
  const handleAutoDistribute = (templateIndex?: number) => {
    if (confirmedModes.length === 0) {
      addToast('⚠️ يرجى تثبيت نمط أولاً', 'warning');
      return;
    }

    // Set which mode(s) to distribute
    if (templateIndex !== undefined) {
      setActiveDistributionIndex(templateIndex);
    } else {
      setActiveDistributionIndex(null); // null = all modes
    }

    // Trigger recalculation by toggling showDistribution
    setShowDistribution(true);

    // If templateIndex provided, distribute only for that mode
    if (templateIndex !== undefined) {
      const template = confirmedModes[templateIndex];
      if (!template) return;

      const modeInfo = [
        { id: 'EXAM', name: 'امتحانات' },
        { id: 'ACTIVITY', name: 'نشاط' },
        { id: 'TRIP', name: 'رحلة' },
        { id: 'RAINY', name: 'مطر' },
        { id: 'EMERGENCY', name: 'طوارئ' },
        { id: 'HOLIDAY', name: 'عطلة' },
      ].find(m => m.id === template.modeId);

      addToast(`⚙️ جاري التوزيع لـ ${modeInfo?.name || 'نمط'}...`, 'info');
    } else {
      addToast('⚙️ جاري التوزيع الآلي...', 'info');
    }
  };

  // Get slot candidates (for manual popup)
  const getSlotCandidates = useCallback((targetClassId: string, period: number) => {
    const normDay = normalizeArabic(dayName);
    const targetEducator = employees.find(e => e.addons?.educator && String(e.addons.educatorClassId) === String(targetClassId));

    // Track assigned teachers in this period
    const assignedElsewhereMap = new Map<number, string>();
    Object.entries(assignments).forEach(([key, valArray]: [string, any]) => {
      const [classId, p] = key.split('-');
      if (Number(p) === period && classId !== targetClassId) {
        const clsName = classesData.find(c => c.id === classId)?.name || 'مهمة أخرى';
        valArray.forEach((a: any) => assignedElsewhereMap.set(a.teacherId, clsName));
      }
    });

    const poolCandidates: any[] = [];
    const educatorCandidates: any[] = [];
    const supportCandidates: any[] = [];

    employees.forEach(emp => {
      // Skip if assigned elsewhere in this period
      if (assignedElsewhereMap.has(emp.id)) return;

      // Find employee's lesson in this period
      const empLesson = lessons.find(l =>
        l.teacherId === emp.id &&
        normalizeArabic(l.day) === normDay &&
        l.period === period
      );

      const lessonType = empLesson?.type?.toLowerCase();
      const isTarget = targetEducator && emp.id === targetEducator.id;

      let statusLabel = '';
      let statusType = '';
      let priority = 99;

      // Educator logic
      if (emp.addons?.educator) {
        if (isTarget) {
          if (lessonType === 'individual') {
            statusLabel = 'مربي (فردي)';
            statusType = 'INDIVIDUAL';
            priority = 2;
          } else if (lessonType === 'stay' || lessonType === 'makooth') {
            statusLabel = 'مربي (مكوث)';
            statusType = 'STAY';
            priority = 10; // Manual only
          } else if (empLesson) {
            statusLabel = 'مربي (فعلي)';
            statusType = 'EDUCATOR_BUSY';
            priority = 1;
          } else {
            statusLabel = 'مربي (فارغ)';
            statusType = 'EDUCATOR_FREE';
            priority = 1;
          }
          educatorCandidates.push({ emp, label: statusLabel, type: statusType, priority, isTarget: true });
        }
        return; // Skip other educators
      }

      // Support staff logic
      if (!empLesson) {
        statusLabel = 'متاح - فراغ';
        statusType = 'FREE';
        priority = 3;
      } else if (lessonType === 'individual') {
        statusLabel = 'حصة فردية';
        statusType = 'INDIVIDUAL';
        priority = 4;
      } else if (lessonType === 'stay' || lessonType === 'makooth') {
        statusLabel = 'حصة مكوث (يدوي فقط)';
        statusType = 'STAY';
        priority = 10;
      } else {
        statusLabel = 'لديه حصة';
        statusType = 'BUSY';
        priority = 5;
      }

      // Add to pool if in localPoolIds (daily reserve)
      if (localPoolIds.includes(emp.id)) {
        poolCandidates.push({ emp, label: statusLabel, type: statusType, priority });
      } else {
        supportCandidates.push({ emp, label: statusLabel, type: statusType, priority });
      }
    });

    return {
      poolCandidates: poolCandidates.sort((a, b) => a.priority - b.priority),
      educatorCandidates: educatorCandidates.sort((a, b) => a.priority - b.priority),
      supportCandidates: supportCandidates.sort((a, b) => a.priority - b.priority)
    };
  }, [assignments, employees, classesData, lessons, localPoolIds, dayName]);

  // Handle save to calendar
  const handleSaveToCalendar = () => {
    if (!saveForm.title.trim()) {
      addToast('⚠️ يرجى إدخال عنوان الفعالية', 'warning');
      return;
    }

    if (Object.keys(assignments).length === 0) {
      addToast('⚠️ لا توجد توزيعات للحفظ', 'warning');
      return;
    }

    // Build CalendarEvent
    const event: CalendarEvent = {
      id: `event-${Date.now()}`,
      title: saveForm.title,
      description: saveForm.description,
      date: toLocalISOString(viewDate),
      eventType: confirmedModes[0]?.modeId === 'examMode' ? 'EXAM' : 'ACTIVITY',
      status: 'CONFIRMED',
      plannerId: 1, // TODO: Get from user context
      plannerName: 'مدير المدرسة',
      patternId: '',
      appliesTo: {
        grades: [],
        classes: confirmedModes.flatMap(m => m.classes),
        periods: confirmedModes.flatMap(m => m.periods)
      },
      participants: []
    };

    // Build SubstitutionLogs
    const logs: SubstitutionLog[] = [];
    Object.entries(assignments).forEach(([key, assignmentList]: [string, any]) => {
      const [classId, periodStr] = key.split('-');
      const period = Number(periodStr);

      assignmentList.forEach((assignment: any) => {
        const substitute = employees.find(e => e.id === assignment.teacherId);
        if (substitute) {
          logs.push({
            id: `log-${Date.now()}-${key}-${assignment.teacherId}`,
            date: toLocalISOString(viewDate),
            period,
            classId,
            absentTeacherId: 0,
            substituteId: assignment.teacherId,
            substituteName: substitute.name,
            type: 'assign_distribution',
            reason: assignment.reason,
            modeContext: confirmedModes[0]?.modeId || 'ACTIVITY',
            timestamp: Date.now()
          });
        }
      });
    });

    // Save Logic
    if (setEvents) {
      setEvents(prev => [...prev, event]);
      setSubstitutionLogs(prev => [...prev, ...logs]);
      addToast(`📅 تم الحفظ في الرزنامة: ${logs.length} تكليف`, 'success');

      // Reset
      setShowSaveModal(false);
      setSaveForm({ title: '', description: '' });
      setShowDistribution(false);
      setConfirmedModes([]);
      setAssignments({});
    } else {
      addToast('⚠️ لا يمكن الحفظ - دالة التحديث غير موجودة', 'warning');
    }
  };

  // === NEW: Context Menu for Smart Event Creation ===
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedClasses.length > 0 && selectedPeriods.length > 0) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const createSmartEvent = (type: 'EXAM' | 'ACTIVITY' | 'TRIP') => {
    // 1. Validate Constraints (Constraint Checking)
    const activeGrade = classesData.find(c => selectedClasses.includes(c.id))?.grade;

    // Example rule: Max 2 exams per week (Mock check)
    if (type === 'EXAM' && selectedPeriods.length > 2) {
      addToast("⚠️ تنبيه: هذا الامتحان طويل جداً (أكثر من حصتين)", "warning");
    }

    // 2. Build Event
    const newEvent: CalendarEvent = {
      id: `smart-event-${Date.now()}`,
      title: type === 'EXAM' ? 'امتحان جديد' : 'فعالية مدرسية',
      description: 'تم إنشاؤه من مساحة العمل',
      date: toLocalISOString(viewDate),
      eventType: type,
      status: 'CONFIRMED',
      plannerId: 1,
      plannerName: 'Admin',
      patternId: '',
      appliesTo: {
        grades: [],
        classes: selectedClasses,
        periods: selectedPeriods
      },
      participants: []
    };

    // 3. Smart Cleanup (Option B): Cancel existing subs in these slots
    // This logic relies on the parent keeping state, so we just pass the event up
    // 3. Smart Cleanup (Option B): Cancel existing subs in these slots
    // This logic relies on the parent keeping state, so we just pass the event up
    // In a real app, we would calculate which subs to cancel here or in formatting
    if (setEvents) {
      setEvents(prev => [...prev, newEvent]);
      // Note: We need a way to tell the parent "Cancel subs in these slots". 
      // For now, setEvents handles adding events. The 'Workspace' component 
      // usually receives events and renders them. 
      // The cleanup logic would ideally happen in AppRouter or a useEvent hook.
    }

    addToast(`✨ تم إنشاء ${newEvent.title} بنجاح`, "success");
    setContextMenu(null);
    setSelectedClasses([]);
    setSelectedPeriods([]);
  };

  // Close context menu on click elsewhere
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);
  // LIVE Distribution Grid - recalculates when engineContext changes!
  const distributionGrid = useMemo(() => {
    if (!showDistribution || confirmedModes.length === 0) return {};

    console.log('=== LIVE DISTRIBUTION RECALCULATION ===');
    console.log('activeDistributionIndex:', activeDistributionIndex);
    const normDay = normalizeArabic(dayName);
    const newDistribution: Record<string, any> = {};
    const newAssignments: { classId: string, period: number, teacherId: number, reason: string }[] = [];

    // Determine which modes to process
    const modesToProcess = activeDistributionIndex !== null
      ? [confirmedModes[activeDistributionIndex]]
      : confirmedModes;

    modesToProcess.forEach(template => {
      if (!template) return;

      const modeConfig = engineContext[template.modeId as keyof EngineContext] as any;
      if (!modeConfig) return;

      console.log('=== MODE CONFIG DEBUG ===');
      console.log('Mode ID:', template.modeId);
      console.log('Mode Name:', modeConfig.name);
      console.log('Golden Rules:', modeConfig.goldenRules?.length || 0);
      console.log('Priority Ladder:', modeConfig.priorityLadder?.length || 0);
      console.log('Conditions:', modeConfig.conditions?.length || 0);
      console.log('========================');

      console.log('Recalculating for mode:', modeConfig.name);

      template.classes.forEach(cls => {
        template.periods.forEach(period => {
          const originalLesson = lessons.find(l =>
            l.classId === cls &&
            l.period === period &&
            normalizeArabic(l.day) === normDay
          );

          console.log(`--- Slot: ${cls} - حصة ${period} ---`);
          console.log('Original Lesson:', originalLesson ? `${originalLesson.subject} - معلم #${originalLesson.teacherId}` : '❌ لا توجد حصة');

          if (!originalLesson) {
            console.log('⚠️ Skipped: No lesson found for this slot');
            return;
          }

          const context: DistributionContext = {
            date: toLocalISOString(viewDate),
            period,
            classId: cls,
            originalTeacherId: originalLesson.teacherId,
            educatorId: employees.find(e =>
              e.addons?.educator &&
              String(e.addons.educatorClassId) === String(cls)
            )?.id,
            modeType: modeConfig.linkedEventType,
            allLessons: lessons,
            allClasses: classesData,
            substitutionLogs
          };

          const rankedCandidates = applyModeRulesToDistribution(
            modeConfig,
            employees,
            context
          );

          console.log(`🎯 Candidates found: ${rankedCandidates.length}`);
          if (rankedCandidates.length > 0) {
            console.log('Top 3:');
            rankedCandidates.slice(0, 3).forEach((c, i) => {
              console.log(`  ${i + 1}. ${c.employee.name} - Score: ${c.score} - ${c.reason}`);
            });
          }

          const best = rankedCandidates[0];
          const slotKey = `${cls}-${period}`;

          if (best && best.score > 0) {
            console.log(`✅ Selected: ${best.employee.name} (Score: ${best.score})`);
            newDistribution[slotKey] = {
              originalTeacher: originalLesson.teacherId,
              substituteId: best.employee.id,
              substituteName: best.employee.name,
              score: best.score,
              reason: best.reason,
              breakdown: best.breakdown,
              modes: [modeConfig.id],
              type: 'automatic'
            };

            // Add to assignments for bulk assign
            newAssignments.push({
              classId: cls,
              period,
              teacherId: best.employee.id,
              reason: best.reason
            });
          } else {
            console.log('❌ No suitable candidate found (score = 0 or no candidates)');
            newDistribution[slotKey] = {
              originalTeacher: originalLesson.teacherId,
              substituteId: null,
              substituteName: 'لا يوجد بديل',
              score: 0,
              modes: [modeConfig.id],
              type: 'automatic'
            };
          }
        });
      });
    });

    // Auto-assign if we have new assignments
    if (newAssignments.length > 0) {
      handleBulkAssign(newAssignments);
    }

    console.log(`✅ Live distribution: ${Object.keys(newDistribution).length} slots`);
    return newDistribution;
  }, [showDistribution, confirmedModes, activeDistributionIndex, engineContext, dayName, lessons, employees, classesData, viewDate, substitutionLogs]);

  // State for opening CalendarRequestForm modal
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<any>(null);

  // Toggle selection handlers
  const toggleClass = (classId: string) => {
    setSelectedClasses(prev =>
      prev.includes(classId) ? prev.filter(c => c !== classId) : [...prev, classId]
    );
  };

  const togglePeriod = (period: number) => {
    setSelectedPeriods(prev =>
      prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period]
    );
  };

  // Handle mode confirmation (تثبيت) - save as template
  const handleConfirmMode = () => {
    if (!selectedMode) {
      alert('يرجى اختيار نمط');
      return;
    }
    if (selectedClasses.length === 0 || selectedPeriods.length === 0) {
      alert('يرجى تحديد الصفوف والحصص');
      return;
    }

    // Convert button ID to mode key
    const modeKey = getModeKey(selectedMode);

    // Check if mode already confirmed
    if (confirmedModes.some(cm => cm.modeId === modeKey)) {
      alert('تم تثبيت هذا النمط مسبقاً');
      return;
    }

    // Add to confirmed modes with selections
    setConfirmedModes(prev => [
      ...prev,
      {
        modeId: modeKey, // Store the engineContext key
        classes: [...selectedClasses],
        periods: [...selectedPeriods]
      }
    ]);

    // Reset selections for next mode
    setSelectedMode('');
    setSelectedClasses([]);
    setSelectedPeriods([]);
    setShowDistribution(false);
  };

  // Map UI button IDs to engineContext mode keys
  const getModeKey = (buttonId: string): string => {
    const mapping: Record<string, string> = {
      'EXAM': 'examMode',
      'TRIP': 'tripMode',
      'RAINY': 'rainyMode',
      'EMERGENCY': 'emergencyMode',
      'HOLIDAY': 'holidayMode',
      'ACTIVITY': 'normalMode' // Activity uses normal mode
    };
    return mapping[buttonId] || buttonId;
  };

  // Handle mode selection (single select)
  const handleModeToggle = (buttonId: string) => {
    // If clicking already selected mode, deselect it
    if (selectedMode === buttonId) {
      setSelectedMode('');
    } else {
      // Select new mode
      setSelectedMode(buttonId);
      // Reset selections when switching modes
      setSelectedClasses([]);
      setSelectedPeriods([]);
    }
    setShowDistribution(false);
  };

  // Get pattern-specific buttons from centralized metadata utility
  const getPatternButtons = (modeId: string) => {
    // engineContext[modeId] contains the mode configuration
    const mode = engineContext[modeId as keyof EngineContext] as any;
    if (!mode || !mode.linkedEventType) return [];

    // Get metadata configuration from utility
    const metadata = getModeMetadata(mode.linkedEventType);

    // Map buttons with modeId
    return metadata.buttons.map(btn => ({
      ...btn,
      modeId: modeId
    }));
  };

  // Get all buttons for confirmed modes
  const allPatternButtons = useMemo(() => {
    const buttons: Array<{
      id: string;
      label: string;
      icon: string;
      color: string;
      modeId: string;
      type: 'automatic' | 'monitored' | 'partner';
      classes: string[];
      periods: number[];
    }> = [];

    confirmedModes.forEach(template => {
      const modeButtons = getPatternButtons(template.modeId);
      modeButtons.forEach(btn => {
        buttons.push({
          ...btn,
          classes: template.classes,
          periods: template.periods
        });
      });
    });

    return buttons;
  }, [confirmedModes, engineContext]);

  // Calculate impacted slots (for COVERAGE phase)
  const impactedSlots = useMemo(() => {
    if (!showDistribution || Object.keys(assignments).length === 0) return [];

    const normDay = normalizeArabic(dayName);
    const impacted: Array<{
      classId: string;
      className: string;
      period: number;
      originalTeacherId: number;
      originalTeacherName: string;
      reason: string;
    }> = [];

    // Get all assigned teacher IDs
    const assignedTeacherIds = new Set<number>();
    Object.values(assignments).forEach((assignmentList: any) => {
      assignmentList.forEach((a: any) => assignedTeacherIds.add(a.teacherId));
    });

    // Find all lessons taught by assigned teachers
    assignedTeacherIds.forEach(teacherId => {
      const teacherLessons = lessons.filter(l =>
        l.teacherId === teacherId &&
        normalizeArabic(l.day) === normDay
      );

      teacherLessons.forEach(lesson => {
        // Check if this slot is NOT in the confirmed modes (not already assigned)
        const isInConfirmedModes = confirmedModes.some(template =>
          template.classes.includes(lesson.classId) &&
          template.periods.includes(lesson.period)
        );

        if (!isInConfirmedModes) {
          const cls = classesData.find(c => c.id === lesson.classId);
          const teacher = employees.find(e => e.id === teacherId);

          impacted.push({
            classId: lesson.classId,
            className: cls?.name || lesson.classId,
            period: lesson.period,
            originalTeacherId: teacherId,
            originalTeacherName: teacher?.name || '؟',
            reason: `محول لمهمة أخرى`
          });
        }
      });
    });

    // Sort by period then class
    return impacted.sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      return a.className.localeCompare(b.className, 'ar');
    });
  }, [showDistribution, assignments, confirmedModes, lessons, classesData, employees, dayName]);



  // Subject icon helper (copied from BulletinBoard)
  const getCompactSubjectLabel = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('عربي')) return { text: 'عربي', icon: BookOpen, color: 'text-rose-600' };
    if (s.includes('english') || s.includes('إنجليزي')) return { text: 'Eng', icon: Languages, color: 'text-blue-600' };
    if (s.includes('رياضيات') || s.includes('هندسة')) return { text: 'رياضيات', icon: Calculator, color: 'text-purple-600' };
    if (s.includes('علوم') || s.includes('فيزياء') || s.includes('كيمياء') || s.includes('بيولوجيا')) return { text: 'علوم', icon: Microscope, color: 'text-green-600' };
    if (s.includes('اجتماعيات') || s.includes('تاريخ') || s.includes('جغرافيا')) return { text: 'اجتماعيات', icon: Globe2, color: 'text-amber-600' };
    if (s.includes('حاسوب') || s.includes('تكنولوجيا')) return { text: 'حاسوب', icon: Laptop2, color: 'text-cyan-600' };
    if (s.includes('رياضة') || s.includes('بدنية')) return { text: 'رياضة', icon: Dumbbell, color: 'text-orange-600' };
    if (s.includes('فن') || s.includes('رسم')) return { text: 'فنون', icon: Palette, color: 'text-pink-600' };
    if (s.includes('دين') || s.includes('إسلامية') || s.includes('تربية')) return { text: 'تربية', icon: HeartHandshake, color: 'text-teal-600' };
    return { text: subject, icon: null, color: 'text-slate-600' };
  };

  // Format class name (remove numbers and extra text)
  const formatClassDisplayName = (name: string): string => {
    if (!name) return "";

    let clean = name;
    clean = clean.replace(/\(\d+\)/g, ''); // Remove (numbers)
    clean = clean.replace(/\[\d+\]/g, ''); // Remove [numbers]
    clean = clean.replace(/(^|\s)\d+-\d+(\s|$)/g, ' '); // Remove ranges like 1-2
    clean = clean.replace(/طبقة/g, ''); // Remove "طبقة"
    return clean.trim();
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex flex-col" dir="rtl">

      {/* Header */}
      <header className="h-12 bg-white/80 backdrop-blur-md border-b border-indigo-200 flex items-center justify-between px-2 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-cyan-500 rounded-md flex items-center justify-center shadow-lg">
            <Check className="text-white" size={16} />
          </div>
          <h1 className="text-base font-black text-cyan-900">مساحة العمل</h1>
        </div>
      </header>

      {/* === NEW: Date Navigator === */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-indigo-200 px-3 py-2 shrink-0 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Navigation Arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newDate = new Date(viewDate);
                newDate.setDate(newDate.getDate() - 1);
                setViewDate(newDate);
              }}
              className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-700 hover:text-indigo-900"
              title="اليوم السابق"
            >
              <ChevronRight size={20} />
            </button>

            {/* Date Display & Picker */}
            <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
              <Calendar size={16} className="text-indigo-600" />
              <input
                type="date"
                value={viewDate.toISOString().split('T')[0]}
                onChange={(e) => setViewDate(new Date(e.target.value))}
                className="bg-transparent text-sm font-bold text-indigo-900 border-none outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => {
                const newDate = new Date(viewDate);
                newDate.setDate(newDate.getDate() + 1);
                setViewDate(newDate);
              }}
              className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-700 hover:text-indigo-900"
              title="اليوم التالي"
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          {/* Center: Current Date Display (Arabic) */}
          <div className="flex-1 text-center">
            <div className="text-sm font-black text-indigo-900">
              {viewDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {/* Right: Quick Shortcuts */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewDate(new Date())}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              اليوم
            </button>
            <button
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setViewDate(tomorrow);
              }}
              className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              غداً
            </button>
          </div>
        </div>
      </div>


      {/* Main Content - NO SCROLL */}
      <div className="flex-1 overflow-hidden flex flex-col py-0.5 gap-1">

        {/* Card 0: Absence Documentation Protocol (standalone) */}
        {showAbsenceProtocol && (
          <div className="bg-white rounded-l-xl shadow-lg border border-gray-200 p-2 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-black text-gray-800">📋 بروتوكول توثيق الغياب</h2>
              <button
                onClick={() => setShowAbsenceProtocol(false)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            </div>

            <div className="text-[9px] text-gray-600 mb-1.5">
              المراحل: <span className="font-bold">1 - 2 - 3 - 6</span> (مستثنى: 4، 5، 7)
            </div>

            {/* Interactive Stages */}
            <div className="grid grid-cols-4 gap-1.5">
              {/* Stage 1: تحديد الغائبين → Select Absent Teachers */}
              <button
                onClick={() => {
                  setActiveProtocolStage(1);
                  setAbsenceFormStep(1);
                  setShowAbsenceFormModal(true);
                }}
                className={`border rounded p-1.5 text-right transition-all cursor-pointer hover:scale-105 ${activeProtocolStage === 1
                  ? 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300'
                  : 'border-indigo-200 bg-indigo-50 hover:border-indigo-400'
                  }`}
              >
                <div className="text-[8px] font-black text-indigo-900 flex items-center gap-1">
                  <span>1️⃣</span> تحديد الغائبين
                </div>
                <div className="text-[6px] text-indigo-600 mt-0.5">← اختر المعلمين</div>
              </button>

              {/* Stage 2: فترة الغياب → Absence Period Details */}
              <button
                onClick={() => {
                  setActiveProtocolStage(2);
                  setAbsenceFormStep(2);
                  setShowAbsenceFormModal(true);
                }}
                className={`border rounded p-1.5 text-right transition-all cursor-pointer hover:scale-105 ${activeProtocolStage === 2
                  ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-300'
                  : 'border-purple-200 bg-purple-50 hover:border-purple-400'
                  }`}
              >
                <div className="text-[8px] font-black text-purple-900 flex items-center gap-1">
                  <span>2️⃣</span> فترة الغياب
                </div>
                <div className="text-[6px] text-purple-600 mt-0.5">← حدد الحصص</div>
              </button>

              {/* Stage 3: بنك الاحتياط → Pool Management */}
              <button
                onClick={() => {
                  setActiveProtocolStage(3);
                  setAbsenceFormStep(3);
                  setShowAbsenceFormModal(true);
                }}
                className={`border rounded p-1.5 text-right transition-all cursor-pointer hover:scale-105 ${activeProtocolStage === 3
                  ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-300'
                  : 'border-blue-200 bg-blue-50 hover:border-blue-400'
                  }`}
              >
                <div className="text-[8px] font-black text-blue-900 flex items-center gap-1">
                  <span>3️⃣</span> بنك الاحتياط
                </div>
                <div className="text-[6px] text-blue-600 mt-0.5">← {localPoolIds.length} معلم</div>
              </button>

              {/* Stage 6: التوزيع الآلي → Auto Distribution */}
              <button
                onClick={() => {
                  setActiveProtocolStage(6);
                  setAbsenceFormStep(6);
                  setShowAbsenceFormModal(true);
                }}
                className={`border rounded p-1.5 text-right transition-all cursor-pointer hover:scale-105 ${activeProtocolStage === 6
                  ? 'border-green-500 bg-green-100 ring-2 ring-green-300'
                  : 'border-green-200 bg-green-50 hover:border-green-400'
                  }`}
              >
                <div className="text-[8px] font-black text-green-900 flex items-center gap-1">
                  <span>6️⃣</span> التوزيع الآلي
                </div>
                <div className="text-[6px] text-green-600 mt-0.5">← المعالجة</div>
              </button>
            </div>

            {/* Progress Indicator */}
            {activeProtocolStage && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1 text-[8px] text-gray-500">
                  <Clock size={10} />
                  <span>المرحلة الحالية: </span>
                  <span className="font-black text-indigo-600">
                    {activeProtocolStage === 1 && 'تحديد الغائبين'}
                    {activeProtocolStage === 2 && 'فترة الغياب'}
                    {activeProtocolStage === 3 && 'بنك الاحتياط'}
                    {activeProtocolStage === 6 && 'التوزيع الآلي'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === NEW: Holiday / Non-School Day Display === */}
        {!isSchoolDay.isSchool ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-300 p-12 max-w-2xl text-center">
              <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-6xl">🏖️</span>
              </div>
              <h2 className="text-3xl font-black text-amber-900 mb-4">
                {isSchoolDay.reason}
              </h2>
              <p className="text-lg text-amber-700 mb-6">
                لا توجد حصص دراسية في هذا اليوم
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setViewDate(new Date())}
                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
                >
                  العودة لليوم الحالي
                </button>
                <button
                  onClick={() => {
                    const nextDay = new Date(viewDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setViewDate(nextDay);
                  }}
                  className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg"
                >
                  اليوم التالي
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Card 1: Mode Selection */}
            <div className="bg-white rounded-l-xl shadow-lg border border-gray-200 p-2 shrink-0">
              <h2 className="text-[10px] font-black text-gray-800 mb-2">🎯 اختر النمط</h2>
              <div className="grid grid-cols-6 gap-1.5">
                {[
                  {
                    id: 'EXAM',
                    name: 'امتحانات',
                    icon: '📝',
                    selectedClass: 'bg-red-50 border-red-300 text-red-700',
                    hoverClass: 'hover:bg-red-50 hover:border-red-300 hover:text-red-700',
                    buttonClass: 'bg-red-600 hover:bg-red-700'
                  },
                  {
                    id: 'ACTIVITY',
                    name: 'نشاط',
                    icon: '🎨',
                    selectedClass: 'bg-purple-50 border-purple-300 text-purple-700',
                    hoverClass: 'hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700',
                    buttonClass: 'bg-purple-600 hover:bg-purple-700'
                  },
                  {
                    id: 'TRIP',
                    name: 'رحلة',
                    icon: '🚌',
                    selectedClass: 'bg-blue-50 border-blue-300 text-blue-700',
                    hoverClass: 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700',
                    buttonClass: 'bg-blue-600 hover:bg-blue-700'
                  },
                  {
                    id: 'RAINY',
                    name: 'مطر',
                    icon: '🌧️',
                    selectedClass: 'bg-cyan-50 border-cyan-300 text-cyan-700',
                    hoverClass: 'hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-700',
                    buttonClass: 'bg-cyan-600 hover:bg-cyan-700'
                  },
                  {
                    id: 'EMERGENCY',
                    name: 'طوارئ',
                    icon: '🚨',
                    selectedClass: 'bg-orange-50 border-orange-300 text-orange-700',
                    hoverClass: 'hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700',
                    buttonClass: 'bg-orange-600 hover:bg-orange-700'
                  },
                  {
                    id: 'HOLIDAY',
                    name: 'عطلة',
                    icon: '🎉',
                    selectedClass: 'bg-green-50 border-green-300 text-green-700',
                    hoverClass: 'hover:bg-green-50 hover:border-green-300 hover:text-green-700',
                    buttonClass: 'bg-green-600 hover:bg-green-700'
                  },
                ].map(mode => {
                  // Convert UI button ID to engine mode key for comparison
                  const modeKey = getModeKey(mode.id);
                  // Find if this mode is confirmed
                  const confirmedIndex = confirmedModes.findIndex(t => t.modeId === modeKey);
                  const isConfirmed = confirmedIndex !== -1;

                  return (
                    <div key={mode.id} className="flex flex-col gap-1">
                      {/* Mode Button */}
                      <button
                        onClick={() => handleModeToggle(mode.id)}
                        className={`border-2 rounded-lg p-2 transition-all text-center ${selectedMode === mode.id
                          ? `${mode.selectedClass} ring-2 ring-offset-1 ring-current font-black scale-105`
                          : `bg-gray-50 border-gray-200 text-gray-600 ${mode.hoverClass}`
                          }`}
                      >
                        <div className="text-xl mb-0.5">{mode.icon}</div>
                        <div className="text-[8px] font-bold">{mode.name}</div>
                      </button>

                      {/* Auto Distribute Button (always visible, but disabled if not confirmed) */}
                      <button
                        onClick={() => isConfirmed && handleAutoDistribute(confirmedIndex)}
                        disabled={!isConfirmed}
                        className={`w-full px-1.5 py-1 text-white rounded text-[7px] font-black transition-all flex items-center justify-center gap-1 ${isConfirmed
                          ? `${mode.buttonClass} shadow-sm hover:shadow-md cursor-pointer`
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                          }`}
                      >
                        <Wand2 size={8} /> توزيع
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teacher Status Legend (only if mode selected) */}
            {selectedMode && (
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-2 rounded-xl border border-slate-200 shrink-0">
                <h5 className="text-[9px] font-black text-slate-700 mb-1.5 flex items-center gap-2">
                  <AlertCircle size={10} /> دليل حالة المعلمين
                </h5>
                <div className="grid grid-cols-5 gap-1.5">
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-emerald-200">
                    <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                      <CheckCircle2 size={8} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-emerald-700">متاح</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-blue-200">
                    <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300 flex items-center justify-center">
                      <GraduationCap size={8} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-blue-700">مربي</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-purple-200">
                    <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300 flex items-center justify-center">
                      <Users size={8} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-purple-700">فردي</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-orange-200">
                    <div className="w-4 h-4 rounded bg-orange-100 border border-orange-300 flex items-center justify-center">
                      <Coffee size={8} className="text-orange-600" />
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-orange-700">مكوث</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-red-200">
                    <div className="w-4 h-4 rounded bg-red-100 border border-red-300 flex items-center justify-center">
                      <Unlock size={8} className="text-red-600" />
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-red-700">مشغول</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Card 2: Distribution Table (Fill remaining space) */}
            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-l-xl border border-indigo-400 shadow-2xl relative overflow-hidden flex flex-col min-h-0">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 z-50"></div>

              <div className="p-2 border-b border-gray-200 bg-indigo-50/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[10px] font-black text-gray-800">📊 جدول التوزيع التفاعلي</h2>
                    <div className="text-[8px] text-gray-600 mt-0.5">
                      حدد الصفوف والحصص لتطبيق التوزيع الآلي
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Phase Toggle (only show after distribution) */}
                    {showDistribution && confirmedModes.length > 0 && (
                      <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button
                          onClick={() => setViewPhase('SELECTION')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewPhase === 'SELECTION'
                            ? 'bg-violet-100 text-violet-700'
                            : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                          1. التوزيع الآلي
                        </button>
                        <ArrowRightLeft size={14} className="mx-1 text-slate-300 self-center" />
                        <button
                          onClick={() => setViewPhase('COVERAGE')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewPhase === 'COVERAGE'
                            ? 'bg-rose-100 text-rose-700'
                            : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                          2. سد الفجوات ({impactedSlots.length})
                        </button>
                      </div>
                    )}

                    {/* Day Selector */}
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-gray-600">اليوم:</span>
                      <select
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="text-[9px] font-bold px-2 py-1 border border-indigo-300 rounded bg-white text-indigo-900"
                      >
                        {availableDays.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Container - Fills remaining space */}
              <div className="flex-1 overflow-auto">
                {/* PHASE 1: Distribution Table */}
                {viewPhase === 'SELECTION' && (
                  <table className="w-full h-full border-collapse text-[10px] table-fixed">
                    <thead className="sticky top-0 z-10 bg-indigo-50/80 backdrop-blur-sm shadow-lg">
                      <tr className="bg-indigo-100 border-b border-indigo-300 h-7">
                        {/* Corner Cell */}
                        <th className="sticky right-0 z-20 w-12 border-l border-indigo-400 bg-indigo-100/60 p-0.5">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[8px] font-black text-black">الحصة</span>
                          </div>
                        </th>

                        {/* Class Headers with Checkboxes (only if mode selected) */}
                        {sortedClasses.map(cls => (
                          <th key={cls.id} className={`border-l border-indigo-400/70 relative group/header transition-colors p-0.5 ${cls.type === 'special' ? 'bg-indigo-100/50' : 'bg-white/40'
                            }`}>
                            <div className="flex flex-col items-center gap-1">
                              {/* Checkbox - only show if mode selected */}
                              {selectedMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedClasses.includes(cls.id)}
                                  onChange={() => toggleClass(cls.id)}
                                  className="w-3 h-3 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              )}
                              {/* Class Label */}
                              <span className={`text-[9px] font-black text-center leading-tight whitespace-nowrap px-1 ${cls.type === 'special' ? 'text-indigo-950' : 'text-black'
                                }`}>{formatClassDisplayName(cls.name)}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {periods.map(p => (
                        <tr key={p} className="border-b border-indigo-200 hover:bg-indigo-50/30 transition-colors h-14">
                          {/* Period Row Header with Checkbox (only if mode selected) */}
                          <td className="sticky right-0 z-10 border-l border-indigo-400/70 bg-indigo-50/95 p-0.5 text-center w-12">
                            <div className="flex flex-col items-center gap-0.5 justify-center">
                              {/* Checkbox - only show if mode selected */}
                              {selectedMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedPeriods.includes(p)}
                                  onChange={() => togglePeriod(p)}
                                  className="w-3 h-3 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              )}
                              {/* Period Label */}
                              <span className="text-[8px] font-black text-black">حصة {p}</span>
                            </div>
                          </td>

                          {/* Class Cells */}
                          {sortedClasses.map((cls, cIdx) => {
                            // Find lesson for this cell (period = row, class = column)
                            const matchingLessons = lessons.filter(l =>
                              l.classId === cls.id && l.period === p && l.day === dayName && l.type === 'actual'
                            );

                            const coreSubjects = ['عربي', 'إنجليزي', 'english', 'عبري', 'رياضيات', 'هندسة', 'علوم', 'فيزياء', 'كيمياء', 'بيولوجيا',
                              'اجتماعيات', 'تاريخ', 'جغرافيا', 'دين', 'إسلامية', 'تربية', 'مرورية', 'رياضة', 'بدنية', 'فنون', 'رسم',
                              'حاسوب', 'تكنولوجيا', 'مهارات', 'حياة', 'لغة'];

                            const mainLesson = matchingLessons.find(l => {
                              const subj = l.subject.toLowerCase();
                              if (subj.includes('محوسب') || subj.includes('تفاضلي')) return false;
                              return coreSubjects.some(core => subj.includes(core));
                            });

                            const hasComputerized = matchingLessons.some(l => l.subject.includes('محوسب'));
                            const hasDifferential = matchingLessons.some(l => l.subject.includes('تفاضلي'));
                            const hasAdditional = matchingLessons.some(l => {
                              const subj = l.subject.toLowerCase();
                              if (subj.includes('محوسب') || subj.includes('تفاضلي')) return false;
                              return !coreSubjects.some(core => subj.includes(core));
                            });

                            let suffix = '';
                            if (hasComputerized) suffix += 'م';
                            if (hasDifferential) suffix += 'ض';
                            if (hasAdditional) suffix += '+';

                            const lesson = mainLesson ||
                              matchingLessons[0] ||
                              lessons.find(l => l.classId === cls.id && l.period === p && l.day === dayName && l.type === 'individual') ||
                              lessons.find(l => l.classId === cls.id && l.period === p && l.day === dayName && l.type === 'stay');

                            // Highlight if selected
                            const isSelected = selectedClasses.includes(cls.id) && selectedPeriods.includes(p);

                            // Check if distributed
                            const slotKey = `${cls.id}-${p}`;
                            const distribution = distributionGrid[slotKey];
                            const hasDistribution = showDistribution && distribution;

                            // Check for Manual Sub (existing logic)
                            // ...

                            // === NEW: Check for Smart Events (Calendar) ===
                            const dateStr = toLocalISOString(viewDate);
                            const activeEvent = events.find(ev =>
                              ev.date === dateStr &&
                              ev.status !== 'CANCELLED' &&
                              (ev.appliesTo.classes.includes(cls.id) || ev.appliesTo.grades.includes(cls.gradeLevel)) &&
                              ev.appliesTo.periods.includes(p)
                            );

                            // Check for manual substitution from substitutionLogs
                            const manualSub = substitutionLogs.find(s =>
                              s.date === dateStr &&
                              s.period === p &&
                              s.classId === cls.id
                            );
                            const hasManualSub = !!manualSub;

                            // === NEW: Check for LOCAL assignment (from popup selection) ===
                            const slotAssignments = assignments[slotKey] || [];
                            const hasLocalAssignment = slotAssignments.length > 0;
                            const localSubstitute = hasLocalAssignment
                              ? employees.find(e => e.id === slotAssignments[0].teacherId)
                              : null;

                            // === RED HIGHLIGHT: Check if teacher is absent ===
                            const teacherAbsence = lesson ? absences.find(a =>
                              a.teacherId === lesson.teacherId &&
                              a.date === dateStr &&
                              (a.type === 'FULL' || (a.affectedPeriods && a.affectedPeriods.includes(p)))
                            ) : null;

                            // Teacher is absent AND lesson not covered yet
                            // If there is an event, we might consider it "covered" or at least "handled" depending on logic, 
                            // but usually an exam still needs a proctor. 
                            // For now, let's keep absence highlight unless there is a sub or local assignment.
                            const isTeacherAbsent = !!teacherAbsence && !hasManualSub && !hasLocalAssignment;

                            if (lesson) {
                              const teacher = employees.find(e => e.id === lesson.teacherId);
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

                              const { text: subjectText, icon: SubjectIcon, color: subjectColor } = getCompactSubjectLabel(lesson.subject);

                              return (
                                <td
                                   key={`${cls.id}-${p}`}
  onClick={(e) => {
    // Shift + Click = فتح popup المعلمين المتاحين
    if (e.shiftKey && lesson) {
      handleLessonClick(lesson, cls.name);
    } else {
      // Click عادي = فتح الـ popup القديم
      setActiveSlot({ classId: cls.id, period: p });
    }
  }}
                                  className={`border-l border-indigo-400/50 p-0 relative transition-all cursor-pointer hover:bg-indigo-100 ${isSelected ? 'bg-indigo-200 ring-2 ring-indigo-500' : ''
                                    } ${isTeacherAbsent ? 'bg-rose-500/30 border-rose-500/50 ring-2 ring-rose-400/50' : ''
                                    } ${hasDistribution || hasManualSub || hasLocalAssignment ? 'bg-amber-100 border-amber-300' : ''
                                    } ${cls.type === 'special' && !isSelected && !hasDistribution && !hasManualSub && !hasLocalAssignment && !isTeacherAbsent ? 'bg-indigo-50/30' : ''
                                    }`}>

                                  {/* Smart Event Overlay */}
                                  {activeEvent && (
                                    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-1 opacity-90 shadow-sm backdrop-blur-[1px] ${activeEvent.eventType === 'EXAM' ? 'bg-rose-50/90 text-rose-900 border border-rose-200' :
                                      activeEvent.eventType === 'TRIP' ? 'bg-blue-50/90 text-blue-900 border border-blue-200' :
                                        'bg-purple-50/90 text-purple-900 border border-purple-200'
                                      }`}>
                                      <span className="text-[7px] font-black uppercase tracking-wider mb-0.5">{activeEvent.eventType === 'EXAM' ? '📝 امتحان' : '✨ فعالية'}</span>
                                      <span className="text-[8px] font-bold text-center leading-tight line-clamp-2">{activeEvent.title}</span>
                                    </div>
                                  )}

                                  {/* Red pulse indicator for absent teacher */}
                                  {isTeacherAbsent && !activeEvent && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full flex items-center justify-center animate-pulse shadow-lg border border-white z-10">
                                      <UserX size={8} className="text-white" />
                                    </div>
                                  )}
                                  <div className="w-full h-full flex items-center justify-center p-1">
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      {SubjectIcon && (
                                        <SubjectIcon size={14} className={`${subjectColor}`} strokeWidth={2.5} />
                                      )}
                                      <span className={`text-[8px] font-black ${subjectColor} truncate max-w-full`}>{subjectText}</span>

                                      {/* Show manual substitute first, then local assignment, then auto distribution */}
                                      {hasManualSub ? (
                                        <div className="flex flex-col items-center gap-0.5 mt-1 pt-0.5 border-t border-amber-400">
                                          <span className="text-[6px] text-amber-700 font-bold">↓ بديل خارجي</span>
                                          <span className="text-[7px] font-black text-amber-900 truncate max-w-full">{manualSub.substituteName}</span>
                                          <span className="text-[6px] text-gray-600">(يدوي)</span>
                                        </div>
                                      ) : hasLocalAssignment && localSubstitute ? (
                                        <div className="flex flex-col items-center gap-0.5 mt-1 pt-0.5 border-t border-amber-400 bg-amber-50 rounded px-1">
                                          <span className="text-[6px] text-amber-700 font-bold">↓ بديل</span>
                                          <span className="text-[7px] font-black text-amber-900 truncate max-w-full">{localSubstitute.name.split(' ')[0]}</span>
                                          <span className="text-[6px] text-amber-600 font-bold">✅ معيّن</span>
                                        </div>
                                      ) : hasDistribution && distribution.substituteId ? (
                                        <div
                                          className="flex flex-col items-center gap-0.5 mt-1 pt-0.5 border-t border-green-300 group/sub cursor-help relative"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // TODO: Open detail popover
                                            // For now, we'll implement the popover logic in a separate state
                                            // but the structure is ready for the "Reasoning" object
                                          }}
                                        >
                                          <span className="text-[6px] text-green-700 font-bold">↓ بديل</span>
                                          <span className="text-[7px] font-black text-green-900 truncate max-w-full">{distribution.substituteName}</span>
                                          <span className="text-[6px] text-gray-600">({Math.round(distribution.score)})</span>

                                          {/* Reasoning Tooltip / Popover Trigger */}
                                          <div className="hidden group-hover/sub:flex absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 p-2 z-[100] flex-col gap-1 pointer-events-none">
                                            <div className="text-[9px] font-black text-slate-800 border-b border-slate-100 pb-1 mb-1 flex justify-between">
                                              <span>{distribution.substituteName}</span>
                                              <span className="text-green-600">{Math.round(distribution.score)} نقطة</span>
                                            </div>
                                            <div className="space-y-0.5">
                                              {/* This would come from 'reasoning.factors' in a real implementation */}
                                              <div className="flex justify-between text-[8px] text-slate-600">
                                                <span>نفس التخصص</span>
                                                <span className="text-emerald-600 font-bold">+20</span>
                                              </div>
                                              <div className="flex justify-between text-[8px] text-slate-600">
                                                <span>حصة فراغ</span>
                                                <span className="text-emerald-600 font-bold">+50</span>
                                              </div>
                                            </div>
                                            <div className="mt-1 pt-1 border-t border-slate-100 text-[8px] text-indigo-600 font-bold text-center">
                                              اضغط للتغيير أو التفاصيل
                                            </div>
                                          </div>
                                        </div>
                                      ) : hasDistribution && !distribution.substituteId ? (
                                        <div className="flex items-center gap-0.5 mt-1 pt-0.5 border-t border-red-300">
                                          <AlertTriangle size={10} className="text-red-600" />
                                          <span className="text-[6px] text-red-700 font-bold">لا بديل</span>
                                        </div>
                                      ) : isTeacherAbsent ? (
                                        <div className="flex flex-col items-center gap-0.5 mt-1 pt-0.5 border-t border-rose-400">
                                          <span className="text-[7px] font-bold text-rose-700 line-through truncate max-w-full">{teacherName}</span>
                                          <span className="text-[6px] font-black text-rose-600 bg-rose-100 px-1 rounded">غائب</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-0.5">
                                          <span className="text-[7px] font-bold text-slate-700 truncate max-w-full">{teacherName}</span>
                                          {suffix && <span className="text-[6px] font-black text-indigo-600 bg-indigo-100 px-0.5 rounded leading-none">{suffix}</span>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            } else {
                              return (
                                <td
                                  key={`${cls.id}-${p}`}
                                  onClick={() => setActiveSlot({ classId: cls.id, period: p })}
                                  className={`border-l border-indigo-400/50 p-0 relative transition-all cursor-pointer hover:bg-indigo-100 ${isSelected ? 'bg-indigo-200 ring-2 ring-indigo-500' : ''
                                    } ${cls.type === 'special' ? 'bg-indigo-50/30' : ''
                                    }`}>
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-slate-400 text-[12px] font-black select-none opacity-30">·</span>
                                  </div>
                                </td>
                              );
                            }
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* PHASE 2: Coverage / Gap Filling View */}
                {viewPhase === 'COVERAGE' && (
                  <div className="p-4 space-y-4">
                    {impactedSlots.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                          <Check size={40} className="text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-black text-emerald-900 mb-2">✅ لا توجد فجوات!</h3>
                        <p className="text-sm text-gray-600">جميع المعلمين متفرغين للمهمة</p>
                      </div>
                    ) : (
                      <>
                        {/* Summary */}
                        <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
                          <h3 className="text-sm font-black text-rose-900 mb-2 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-rose-600" />
                            الحصص المتأثرة ({impactedSlots.length})
                          </h3>
                          <p className="text-[10px] text-rose-700">
                            المعلمون المحولون لديهم حصص في صفوف أخرى تحتاج إلى تغطية
                          </p>
                        </div>

                        {/* Impacted Slots List */}
                        <div className="space-y-2">
                          {impactedSlots.map((slot, idx) => (
                            <div
                              key={`${slot.classId}-${slot.period}`}
                              className="bg-white border border-rose-200 rounded-lg p-3 hover:shadow-md transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="bg-rose-100 text-rose-700 font-black text-xs px-2 py-1 rounded">
                                    حصة {slot.period}
                                  </div>
                                  <div>
                                    <div className="text-sm font-black text-gray-900">{slot.className}</div>
                                    <div className="text-[10px] text-gray-600">
                                      المعلم: {slot.originalTeacherName}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-[9px] text-rose-600 font-bold">
                                  {slot.reason}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Action Bar - Fixed at bottom */}
              <div className="p-2 bg-indigo-50 border-t border-indigo-200 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-gray-600">الصفوف: <span className="font-bold text-indigo-900">{selectedClasses.length}</span></span>
                  <span className="text-[9px] text-gray-600">الحصص: <span className="font-bold text-indigo-900">{selectedPeriods.length}</span></span>
                  {confirmedModes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[8px] text-gray-600">الأنماط المثبتة:</span>
                      {confirmedModes.map(template => {
                        const mode = engineContext[template.modeId as keyof EngineContext] as any;
                        return (
                          <span key={template.modeId} className="text-[8px] px-1.5 py-0.5 bg-green-200 text-green-900 rounded-full font-bold">
                            {mode?.name || template.modeId} ({template.classes.length}ص × {template.periods.length}ح)
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Show "تثبيت" button when mode selected AND classes/periods selected */}
                {selectedMode && selectedClasses.length > 0 && selectedPeriods.length > 0 && (
                  <button
                    onClick={handleConfirmMode}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg"
                  >
                    <Check size={14} />
                    تثبيت النمط
                  </button>
                )}

                {showDistribution && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg"
                    >
                      <Check size={14} />
                      حفظ وإرسال للرزنامة
                    </button>
                    <button
                      onClick={() => {
                        setShowDistribution(false);
                        setConfirmedModes([]);
                        setSelectedMode('');
                        setSelectedClasses([]);
                        setSelectedPeriods([]);
                        setAssignments({});
                      }}
                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[8px] font-bold rounded transition-all"
                    >
                      إعادة تعيين
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Manual Selection Popup */}
        {activeSlot && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-6 animate-scale-up max-h-[85vh] flex flex-col border border-white/20">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h5 className="font-black text-slate-800 text-lg">اختيار بديل</h5>
                  <p className="text-xs text-slate-500 font-bold mt-1">حصة {activeSlot.period}</p>
                </div>
                <button onClick={() => setActiveSlot(null)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                {(() => {
                  const { poolCandidates, educatorCandidates, supportCandidates } = getSlotCandidates(activeSlot.classId, activeSlot.period);

                  const freeTeachers = supportCandidates.filter(c => c.type === 'FREE');
                  const individualTeachers = supportCandidates.filter(c => c.type === 'INDIVIDUAL');
                  const stayTeachers = supportCandidates.filter(c => c.type === 'STAY');

                  const renderBtn = (cand: any, styleClass: string) => (
                    <button
                      key={cand.emp.id}
                      onClick={() => {
                        handleAssign(activeSlot.classId, activeSlot.period, cand.emp.id, cand.label);
                        setActiveSlot(null);
                      }}
                      className={`w-full p-3 rounded-xl border transition-all flex justify-between items-center group shadow-sm ${styleClass}`}
                    >
                      <span className="font-bold text-xs">{cand.emp.name}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded opacity-80 bg-white/50">{cand.label}</span>
                    </button>
                  );

                  return (
                    <>
                      {/* === إدارة بنك الاحتياط اليومي (TOP PRIORITY) === */}
                      {poolCandidates.length > 0 && (
                        <div className="space-y-2 bg-indigo-50 p-3 rounded-2xl border-2 border-indigo-300 shadow-sm">
                          <h6 className="text-[10px] font-black text-indigo-700 uppercase flex items-center gap-2">
                            <Users size={14} /> 📊 إدارة بنك الاحتياط اليومي ({poolCandidates.length})
                          </h6>
                          <div className="grid gap-2">
                            {poolCandidates.map(c => renderBtn(c, 'bg-white border-indigo-400 text-indigo-900 hover:bg-indigo-100 ring-2 ring-indigo-200 font-bold'))}
                          </div>
                        </div>
                      )}
                      {educatorCandidates.length > 0 && (
                        <div className="space-y-2 bg-blue-50 p-3 rounded-2xl border border-blue-200">
                          <h6 className="text-[10px] font-black text-blue-700 uppercase flex items-center gap-2">
                            <GraduationCap size={14} /> مربو الصفوف
                          </h6>
                          <div className="grid gap-2">
                            {educatorCandidates.map(c => renderBtn(c, 'bg-white border-blue-600 text-blue-900 hover:bg-blue-100 font-black shadow-md'))}
                          </div>
                        </div>
                      )}
                      {/* {freeTeachers.length > 0 && (
                      <div className="space-y-2 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                        <h6 className="text-[10px] font-black text-emerald-700 uppercase flex items-center gap-2">
                          <CheckCircle2 size={14}/> متاحون
                        </h6>
                        <div className="grid gap-2">
                          {freeTeachers.map(c => renderBtn(c, 'bg-white border-emerald-200 text-emerald-900 hover:bg-emerald-100'))}
                        </div>
                      </div>
                    )} */}
                      {individualTeachers.length > 0 && (
                        <div className="space-y-2 bg-pink-50 p-3 rounded-2xl border border-pink-200">
                          <h6 className="text-[10px] font-black text-pink-700 uppercase flex items-center gap-2">
                            <Users size={14} /> حصص فردي
                          </h6>
                          <div className="grid gap-2">
                            {individualTeachers.map(c => renderBtn(c, 'bg-white border-pink-300 text-pink-900 hover:bg-pink-100'))}
                          </div>
                        </div>
                      )}
                      {stayTeachers.length > 0 && (
                        <div className="space-y-2 bg-orange-50 p-3 rounded-2xl border border-orange-200">
                          <h6 className="text-[10px] font-black text-orange-700 uppercase flex items-center gap-2">
                            <Coffee size={14} /> مكوث (يدوي فقط)
                          </h6>
                          <div className="grid gap-2">
                            {stayTeachers.map(c => renderBtn(c, 'bg-white border-orange-300 text-orange-900 hover:bg-orange-100'))}
                          </div>
                        </div>
                      )}
                      {educatorCandidates.length === 0 && supportCandidates.length === 0 && poolCandidates.length === 0 && (
                        <div className="text-center py-8 text-slate-400 italic font-bold">لا يوجد مرشحين متاحين</div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Save to Calendar Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-gray-900">📅 حفظ في الرزنامة</h3>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    عنوان الفعالية *
                  </label>
                  <input
                    type="text"
                    value={saveForm.title}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثال: امتحان رياضيات - الطبقة الأولى"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    وصف مختصر
                  </label>
                  <textarea
                    value={saveForm.description}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="معلومات إضافية (اختياري)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Summary */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="text-[10px] text-emerald-800 space-y-1">
                    <div>📅 التاريخ: {toLocalISOString(viewDate)}</div>
                    <div>📚 الصفوف: {confirmedModes.flatMap(m => m.classes).length}</div>
                    <div>⏰ الحصص: {confirmedModes.flatMap(m => m.periods).length}</div>
                    <div>👥 التكليفات: {Object.keys(assignments).length}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-6">
                <button
                  onClick={handleSaveToCalendar}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  حفظ في الرزنامة
                </button>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === AbsenceForm Modal (stays on Workspace) === */}
        {showAbsenceFormModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-2xl shadow-2xl w-[95vw] h-[95vh] max-w-6xl overflow-hidden flex flex-col">
              <AbsenceForm
                employees={employees}
                classes={classesData}
                lessons={lessons}
                scheduleConfig={scheduleConfig}
                date={toLocalISOString(viewDate)}
                dayOfWeek={dayName}
                engineContext={engineContext}
                existingAbsences={absences}
                substitutionLogs={substitutionLogs}
                events={events}
                preSelectedPool={localPoolIds}
                onPoolUpdate={handlePoolUpdate}
                initialStep={absenceFormStep}
                singleStageMode={true}
                onSave={(newAbsences, newSubs) => {
                  // Save absences
                  if (setAbsences) {
                    const absencesWithIds = newAbsences.map((a, i) => ({
                      ...a,
                      id: Date.now() + i
                    }));
                    setAbsences(prev => [...prev, ...absencesWithIds]);
                  }
                  // Save substitutions
                  if (setSubstitutionLogs) {
                    const logsWithIds = newSubs.map((s, i) => ({
                      ...s,
                      id: `log-${Date.now()}-${i}`,
                      timestamp: Date.now()
                    }));
                    setSubstitutionLogs(prev => [...prev, ...logsWithIds]);
                  }
                  addToast('✅ تم الحفظ بنجاح', 'success');
                  setShowAbsenceFormModal(false);
                  setActiveProtocolStage(null);
                }}
                onCancel={() => {
                  setShowAbsenceFormModal(false);
                  setActiveProtocolStage(null);
                }}
                onStageSave={(stage, data) => {
                  // Handle single stage save
                  if (stage === 1 && data.selectedTeachers && setAbsences) {
                    const newAbsences = data.selectedTeachers.map((t: any, i: number) => ({
                      id: Date.now() + i,
                      teacherId: t.id,
                      date: data.globalStartDate || toLocalISOString(viewDate),
                      reason: t.reason || 'غياب',
                      type: t.type || 'FULL',
                      affectedPeriods: t.affectedPeriods || [],
                      status: 'OPEN' as const,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    }));
                    setAbsences(prev => [...prev, ...newAbsences]);
                  }
                  if (stage === 3 && data.poolIds) {
                    setLocalPoolIds(data.poolIds);
                  }
                  addToast(`✅ تم حفظ المرحلة ${stage}`, 'success');
                  setShowAbsenceFormModal(false);
                  setActiveProtocolStage(null);
                }}
                onOpenRequestForm={(prefill) => {
                  // Handle mode/event request - can open CalendarRequestForm modal here if needed
                  addToast('📅 طلب إضافة فعالية', 'info');
                }}
              />
            </div>
          </div>
        )}
        {/* Available Teachers Popup */}
        <AvailableTeachersPopup
          isOpen={isAvailableTeachersPopupOpen}
          onClose={() => {
            setIsAvailableTeachersPopupOpen(false);
            setSelectedLesson(null);
          }}
          lesson={selectedLesson || {
            period: 0,
            classId: '',
            className: '',
            subject: '',
          }}
          availableTeachers={availableTeachersForPopup}
          onSelectTeacher={handleSelectTeacherFromPopup}
        />
      </div>
    </div>
  );
};

export default Workspace;
