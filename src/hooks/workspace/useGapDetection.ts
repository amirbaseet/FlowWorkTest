// src/hooks/workspace/useGapDetection.ts

import { useMemo } from 'react';
import { Employee, Lesson, ClassItem } from '@/types';
import { normalizeArabic } from '@/utils';

export interface ImpactedSlot {
  classId: string;
  className: string;
  period: number;
  originalTeacherId: number;
  originalTeacherName: string;
  reason: string;
}

export interface UseGapDetectionReturn {
  impactedSlots: ImpactedSlot[];
  gapCount: number;
}

export interface UseGapDetectionProps {
  showDistribution: boolean;
  assignments: Record<string, Array<{ teacherId: number; reason: string }>>;
  confirmedModes: Array<{ modeId: string; classes: string[]; periods: number[] }>;
  lessons: Lesson[];
  classes: ClassItem[];
  employees: Employee[];
  dayName: string;
}

/**
 * Detects impacted slots (gaps) created when teachers are reassigned
 * These are lessons taught by assigned teachers that are NOT in the confirmed modes
 */
export const useGapDetection = ({
  showDistribution,
  assignments,
  confirmedModes,
  lessons,
  classes,
  employees,
  dayName
}: UseGapDetectionProps): UseGapDetectionReturn => {

  const impactedSlots = useMemo(() => {
    if (!showDistribution || Object.keys(assignments).length === 0) return [];

    const normDay = normalizeArabic(dayName);
    const impacted: ImpactedSlot[] = [];

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
          const cls = classes.find(c => c.id === lesson.classId);
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
  }, [showDistribution, assignments, confirmedModes, lessons, classes, employees, dayName]);

  const gapCount = impactedSlots.length;

  return {
    impactedSlots,
    gapCount
  };
};
