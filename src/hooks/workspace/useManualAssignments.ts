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
  handleSelectTeacher: (teacherId: number) => void;
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

    addToast(`✅ تم تعيين ${substituteTeacher?.name || 'معلم'} بدل ${originalTeacher?.name || 'المعلم الغائب'}`, 'success');
  }, [viewDate, dayName, lessons, employees, absences, setAbsences, setSubstitutionLogs, addToast]);

  // Handler: Remove assignment
  const handleRemove = useCallback((classId: string, period: number, teacherId: number) => {
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
  }, [employees, addToast]);

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

    addToast(`✅ تم توزيع ${newAssignments.length} مهمة`, 'success');
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
  const handleSelectTeacher = useCallback((teacherId: number) => {
    if (!selectedLesson) return;

    const teacher = employees.find(e => e.id === teacherId);
    
    handleAssign(
      selectedLesson.classId,
      selectedLesson.period,
      teacherId,
      `بديل من القائمة - ${teacher?.name || 'معلم'}`
    );

    setIsPopupOpen(false);
    setSelectedLesson(null);
    
    addToast(`✅ تم اختيار ${teacher?.name || 'معلم'} كبديل`, 'success');
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
    setActiveSlot,
    closePopup
  };
};
