// src/hooks/workspace/useManualAssignments.ts

import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { Employee, Lesson, AbsenceRecord, SubstitutionLog } from '@/types';
import { toLocalISOString, normalizeArabic } from '@/utils';

export interface UseManualAssignmentsReturn {
  assignments: Record<string, Array<{ teacherId: number; reason: string }>>;
  activeSlot: { classId: string; period: number } | null;
  selectedLesson: {
    period: number;
    classId: string;
    className: string;
    subject: string;
    day: string;
    teacherId: number;
  } | null;
  isPopupOpen: boolean;
  handleAssign: (classId: string, period: number, teacherId: number, reason: string) => void;
  handleRemove: (classId: string, period: number, teacherId: number) => void;
  handleBulkAssign: (assignments: Array<{
    classId: string;
    period: number;
    teacherId: number;
    reason: string;
  }>) => void;
  handleLessonClick: (lesson: any, className: string) => void;
  handleSelectTeacher: (teacherId: number, swapWithLast?: boolean, swapType?: 'substitute-based' | 'class-based', classSwapInfo?: any) => void;
  handleSwapWithLast: (teacherId: number, scheduleConfig?: { periodsPerDay: number }) => void;
  handleClassBasedSwap: (teacherId: number, classSwapInfo: any) => void;
  setActiveSlot: (slot: { classId: string; period: number } | null) => void;
  closePopup: () => void;
}

export interface UseManualAssignmentsProps {
  employees: Employee[];
  lessons: Lesson[];
  viewDate: Date;
  dayName: string;
  absences: AbsenceRecord[];
  substitutionLogs: SubstitutionLog[];
  setAbsences: Dispatch<SetStateAction<AbsenceRecord[]>>;
  setSubstitutionLogs: Dispatch<SetStateAction<SubstitutionLog[]>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const useManualAssignments = ({
  employees,
  lessons,
  viewDate,
  dayName,
  absences,
  substitutionLogs,
  setAbsences,
  setSubstitutionLogs,
  addToast
}: UseManualAssignmentsProps): UseManualAssignmentsReturn => {
  
  // State
  const [assignments, setAssignments] = useState<Record<string, Array<{ teacherId: number; reason: string }>>>({});
  const [activeSlot, setActiveSlot] = useState<{ classId: string; period: number } | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<{
    period: number;
    classId: string;
    className: string;
    subject: string;
    day: string;
    teacherId: number;
  } | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Handler: Manual assign
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

    // Register absent teacher in absence records
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

    // Create substitution log entry
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

    addToast(` تم تعيين ${substituteTeacher?.name || 'معلم'} بدل ${originalTeacher?.name || 'المعلم الغائب'}`, 'success');
  }, [viewDate, dayName, lessons, employees, absences, setAbsences, setSubstitutionLogs, addToast]);

  // Handler: Remove assignment
  const handleRemove = useCallback((classId: string, period: number, teacherId: number) => {
    console.log('🗑️ [handleRemove] Removing assignment:', { classId, period, teacherId });
    
    const dateStr = toLocalISOString(viewDate);
    const key = `${classId}-${period}`;
    
    // 1. Remove from local state (in-memory)
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
    
    // 2. Remove from substitutionLogs (persistent storage)
    if (setSubstitutionLogs) {
      setSubstitutionLogs(prev => prev.filter(log => !(
        log.classId === classId &&
        log.period === period &&
        log.date === dateStr &&
        log.substituteId === teacherId
      )));
      console.log('✅ [handleRemove] Removed from substitutionLogs');
    }
    
    // 3. Update absence record - remove this period from affected periods
    if (setAbsences) {
      setAbsences(prev => prev.map(absence => {
        // Find the absence for this slot
        const shouldUpdate = 
          absence.date === dateStr &&
          absence.type === 'PARTIAL' &&
          absence.affectedPeriods?.includes(period);
        
        if (shouldUpdate) {
          const updatedPeriods = absence.affectedPeriods!.filter(p => p !== period);
          console.log('✅ [handleRemove] Updated absence periods:', { 
            teacherId: absence.teacherId,
            before: absence.affectedPeriods, 
            after: updatedPeriods 
          });
          
          // If no periods left, could remove the absence entirely
          if (updatedPeriods.length === 0) {
            return null as any; // Will be filtered out
          }
          
          return {
            ...absence,
            affectedPeriods: updatedPeriods,
            updatedAt: new Date().toISOString()
          };
        }
        return absence;
      }).filter(Boolean)); // Remove null entries
    }

    const teacher = employees.find(e => e.id === teacherId);
    addToast(`❌ تم إلغاء تعيين ${teacher?.name || 'معلم'}`, 'info');
    console.log('✅ [handleRemove] Removal completed');
  }, [viewDate, employees, setSubstitutionLogs, setAbsences, addToast]);

  // Handler: Bulk assign
  const handleBulkAssign = useCallback((newAssignments: Array<{
    classId: string;
    period: number;
    teacherId: number;
    reason: string;
  }>) => {
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

    addToast(` تم توزيع ${newAssignments.length} مهمة`, 'success');
  }, [addToast]);

  // Handler: Lesson click
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
    setIsPopupOpen(true);
  }, [dayName]);

  // Handler: Select teacher from popup
  const handleSelectTeacher = useCallback((teacherId: number, swapWithLast?: boolean, swapType?: 'substitute-based' | 'class-based', classSwapInfo?: any) => {
    if (!selectedLesson) return;

    const teacher = employees.find(e => e.id === teacherId);

    // Check if we need to perform a swap
    if (swapWithLast && swapType === 'substitute-based') {
      // Use existing substitute-based swap handler
      const scheduleConfig = { periodsPerDay: 8 }; // TODO: Get from context
      handleSwapWithLast(teacherId, scheduleConfig);
      return;
    }

    if (swapType === 'class-based' && classSwapInfo) {
      // Use new class-based swap handler
      handleClassBasedSwap(teacherId, classSwapInfo);
      return;
    }
    
    // Normal assignment (no swap)
    handleAssign(
      selectedLesson.classId,
      selectedLesson.period,
      teacherId,
      `بديل من القائمة - ${teacher?.name || 'معلم'}`
    );

    setIsPopupOpen(false);
    setSelectedLesson(null);
    
    addToast(` تم اختيار ${teacher?.name || 'معلم'} كبديل`, 'success');
  }, [selectedLesson, employees, handleAssign, addToast]);

  // Handler: Swap with last period (for early dismissal)
  const handleSwapWithLast = useCallback((teacherId: number, scheduleConfig?: { periodsPerDay: number }) => {
    if (!selectedLesson) return;
    if (!scheduleConfig) {
      addToast('⚠️ لا يمكن تحديد الحصة الأخيرة', 'warning');
      return;
    }

    const teacher = employees.find(e => e.id === teacherId);
    const normDay = normalizeArabic(dayName);
    const lastPeriod = scheduleConfig.periodsPerDay;
    
    // Find teacher's lesson in last period
    const lastPeriodLesson = lessons.find(l => 
      l.teacherId === teacherId &&
      l.period === lastPeriod &&
      normalizeArabic(l.day) === normDay
    );

    if (!lastPeriodLesson) {
      addToast('⚠️ المعلم ليس لديه حصة في الحصة الأخيرة', 'warning');
      return;
    }

    // Verify last period is in same class as target
    if (lastPeriodLesson.classId !== selectedLesson.classId) {
      addToast('⚠️ الحصة الأخيرة ليست في نفس الصف', 'warning');
      return;
    }

    // Assign teacher to current period
    handleAssign(
      selectedLesson.classId,
      selectedLesson.period,
      teacherId,
      `بديل مع تبديل شخصي - ${teacher?.name || 'معلم'} (مغادرة مبكرة)`
    );

    setIsPopupOpen(false);
    setSelectedLesson(null);
    
    addToast(
      ` تم تعيين ${teacher?.name || 'معلم'} مع تبديل الحصة ${selectedLesson.period} والحصة ${lastPeriod}\n` +
      `يمكن للمعلم المغادرة بعد الحصة ${selectedLesson.period}`,
      'success'
    );
  }, [selectedLesson, employees, lessons, dayName, handleAssign, addToast]);

  // NEW: Handler: Class-based swap (swap absence with class's last period)
  const handleClassBasedSwap = useCallback((teacherId: number, classSwapInfo: {
    lastPeriod: number;
    swapType: 'gap' | 'individual' | 'stay';
    earlyDismissalPeriod: number;
  }) => {
    if (!selectedLesson) return;

    console.log('🔄 Class-based swap initiated:', {
      teacherId,
      selectedLesson,
      classSwapInfo
    });

    const teacher = employees.find(e => e.id === teacherId);
    const swapTypeLabel = {
      gap: 'فراغ',
      individual: 'فردي',
      stay: 'مكوث'
    }[classSwapInfo.swapType];

    console.log('📝 Creating assignment at period:', classSwapInfo.lastPeriod);

    // Assign teacher to LAST period instead of target period
    handleAssign(
      selectedLesson.classId,
      classSwapInfo.lastPeriod, // ← Assign to last period!
      teacherId,
      `بديل مع تبديل صفي - ${teacher?.name || 'معلم'} (تغطية حصة ${classSwapInfo.lastPeriod} بدلاً من ${selectedLesson.period})`
    );

    console.log(' Assignment created successfully');

    setIsPopupOpen(false);
    setSelectedLesson(null);
    
    addToast(
      ` تبديل ذكي! ${teacher?.name || 'معلم'} سيغطي الحصة ${classSwapInfo.lastPeriod} (${swapTypeLabel}) بدلاً من ${selectedLesson.period}\n` +
      `🎓 الصف ينتهي بعد حصة ${classSwapInfo.earlyDismissalPeriod}`,
      'success'
    );
  }, [selectedLesson, employees, handleAssign, addToast]);

  // Handler: Close popup
  const closePopup = useCallback(() => {
    setIsPopupOpen(false);
    setSelectedLesson(null);
  }, []);

  return {
    assignments,
    activeSlot,
    selectedLesson,
    isPopupOpen,
    handleAssign,
    handleRemove,
    handleBulkAssign,
    handleLessonClick,
    handleSelectTeacher,
    handleSwapWithLast,
    handleClassBasedSwap,
    setActiveSlot,
    closePopup
  };
};
