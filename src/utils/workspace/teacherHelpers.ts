// src/utils/workspace/teacherHelpers.ts

import { Employee, Lesson, AbsenceRecord, SubstitutionLog } from '@/types';
import { normalizeArabic } from '@/utils';

export interface TeachersByStatus {
  available: Employee[];
  educators: Employee[];
  busy: Employee[];
  individual: Employee[];
  stay: Employee[];
}

/**
 * Calculate teacher's total workload for a specific date
 * Includes regular lessons + substitutions
 */
export function getTeacherWorkload(
  teacherId: number,
  lessons: Lesson[],
  substitutions: SubstitutionLog[],
  date: string
): number {
  // Count regular lessons (all days, not date-specific since lessons are recurring)
  const regularLessons = lessons.filter(l => l.teacherId === teacherId).length;

  // Count substitutions for this specific date
  const substitutionCount = substitutions.filter(s =>
    s.date === date && s.substituteId === teacherId
  ).length;

  return regularLessons + substitutionCount;
}

/**
 * Check if teacher is available at a specific period/day
 * Returns false if absent, already assigned, or busy with actual lesson
 */
export function isTeacherAvailable(
  teacherId: number,
  period: number,
  day: string,
  lessons: Lesson[],
  absences: AbsenceRecord[],
  assignments: Record<string, any>,
  date?: string
): boolean {
  const normDay = normalizeArabic(day);

  // Check if teacher is absent (if date provided)
  if (date) {
    const isAbsent = absences.some(a => {
      if (a.teacherId !== teacherId) return false;
      if (a.date !== date) return false;
      if (a.type === 'FULL') return true;
      if (a.type === 'PARTIAL' && a.affectedPeriods?.includes(period)) return true;
      return false;
    });

    if (isAbsent) return false;
  }

  // Check if already assigned elsewhere in this period
  for (const [key, valArray] of Object.entries(assignments)) {
    const [, p] = key.split('-');
    if (Number(p) === period) {
      const isAssigned = Array.isArray(valArray)
        ? valArray.some((a: any) => a.teacherId === teacherId)
        : false;
      if (isAssigned) return false;
    }
  }

  // Find teacher's lesson at this period/day
  const teacherLesson = lessons.find(l =>
    l.teacherId === teacherId &&
    l.period === period &&
    normalizeArabic(l.day) === normDay
  );

  // If no lesson: free
  if (!teacherLesson) return true;

  // If lesson type is 'individual' or 'stay': can substitute
  const lessonType = teacherLesson.type?.toLowerCase();
  if (lessonType === 'individual' || lessonType === 'stay' || lessonType === 'makooth') {
    return true;
  }

  // Else: busy with actual lesson
  return false;
}

/**
 * Categorize all employees by their status at a specific period/day
 */
export function getTeachersByStatus(
  employees: Employee[],
  lessons: Lesson[],
  day: string,
  period: number
): TeachersByStatus {
  const normDay = normalizeArabic(day);

  const result: TeachersByStatus = {
    available: [],
    educators: [],
    busy: [],
    individual: [],
    stay: []
  };

  employees.forEach(emp => {
    // Find employee's lesson at this period/day
    const empLesson = lessons.find(l =>
      l.teacherId === emp.id &&
      l.period === period &&
      normalizeArabic(l.day) === normDay
    );

    // Categorize by educator status first
    if (emp.addons?.educator) {
      result.educators.push(emp);
      return;
    }

    // Categorize by lesson status
    if (!empLesson) {
      result.available.push(emp);
    } else if (empLesson.type === 'individual') {
      result.individual.push(emp);
    } else if (empLesson.type === 'stay' || empLesson.type === 'makooth') {
      result.stay.push(emp);
    } else {
      result.busy.push(emp);
    }
  });

  return result;
}

/**
 * Get formatted teacher display name
 * @param format 'full' | 'short' | 'firstLast'
 */
export function getTeacherDisplayName(
  teacher: Employee,
  format: 'full' | 'short' | 'firstLast' = 'full'
): string {
  if (!teacher || !teacher.name) return '?';

  const nameParts = teacher.name.trim().split(' ');

  if (format === 'full') {
    return teacher.name;
  }

  if (format === 'short') {
    // First name + first 2 letters of last name
    // Example: "أحمد محمود حسن" -> "أحمد حس"
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      return `${firstName} ${lastName.substring(0, 2)}`;
    }
    return nameParts[0] || '?';
  }

  if (format === 'firstLast') {
    // First name + last name
    // Example: "أحمد محمود حسن" -> "أحمد حسن"
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      return `${firstName} ${lastName}`;
    }
    return nameParts[0] || '?';
  }

  return teacher.name;
}
