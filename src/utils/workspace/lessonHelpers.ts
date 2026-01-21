// src/utils/workspace/lessonHelpers.ts

import { Lesson } from '@/types';
import { normalizeArabic } from '@/utils';
import { BookOpen, Calculator, Languages, Palette, Dumbbell, Microscope, Globe2, Laptop2, HeartHandshake } from 'lucide-react';

export interface SubjectLabel {
  text: string;
  icon: any | null;
  color: string;
}

/**
 * Find a lesson at a specific slot (class + period + day)
 * Prefers 'actual' type lessons over individual/stay
 */
export function findLessonAtSlot(
  lessons: Lesson[],
  classId: string,
  period: number,
  day: string
): Lesson | null {
  const normDay = normalizeArabic(day);

  // Try to find actual lesson first
  const actualLesson = lessons.find(l =>
    l.classId === classId &&
    l.period === period &&
    normalizeArabic(l.day) === normDay &&
    l.type === 'actual'
  );

  if (actualLesson) return actualLesson;

  // If not found, try without type filter
  const anyLesson = lessons.find(l =>
    l.classId === classId &&
    l.period === period &&
    normalizeArabic(l.day) === normDay
  );

  return anyLesson || null;
}

/**
 * Get all lessons taught by a teacher on a specific day
 * Sorted by period ascending
 */
export function getLessonsByTeacher(
  lessons: Lesson[],
  teacherId: number,
  day: string
): Lesson[] {
  const normDay = normalizeArabic(day);

  return lessons
    .filter(l =>
      l.teacherId === teacherId &&
      normalizeArabic(l.day) === normDay
    )
    .sort((a, b) => a.period - b.period);
}

/**
 * Get compact subject label with icon and color
 * Case-insensitive matching
 */
export function getCompactSubjectLabel(subject: string): SubjectLabel {
  const s = subject.toLowerCase();

  if (s.includes('عربي')) {
    return { text: 'عربي', icon: BookOpen, color: 'text-rose-600' };
  }
  if (s.includes('english') || s.includes('إنجليزي')) {
    return { text: 'Eng', icon: Languages, color: 'text-blue-600' };
  }
  if (s.includes('رياضيات') || s.includes('هندسة')) {
    return { text: 'رياضيات', icon: Calculator, color: 'text-purple-600' };
  }
  if (s.includes('علوم') || s.includes('فيزياء') || s.includes('كيمياء') || s.includes('بيولوجيا')) {
    return { text: 'علوم', icon: Microscope, color: 'text-green-600' };
  }
  if (s.includes('اجتماعيات') || s.includes('تاريخ') || s.includes('جغرافيا')) {
    return { text: 'اجتماعيات', icon: Globe2, color: 'text-amber-600' };
  }
  if (s.includes('حاسوب') || s.includes('تكنولوجيا')) {
    return { text: 'حاسوب', icon: Laptop2, color: 'text-cyan-600' };
  }
  if (s.includes('رياضة') || s.includes('بدنية')) {
    return { text: 'رياضة', icon: Dumbbell, color: 'text-orange-600' };
  }
  if (s.includes('فن') || s.includes('رسم')) {
    return { text: 'فنون', icon: Palette, color: 'text-pink-600' };
  }
  if (s.includes('دين') || s.includes('إسلامية') || s.includes('تربية')) {
    return { text: 'تربية', icon: HeartHandshake, color: 'text-teal-600' };
  }

  return { text: subject, icon: null, color: 'text-slate-600' };
}

/**
 * Format class display name by removing numbers and extra text
 */
export function formatClassDisplayName(name: string): string {
  if (!name) return '';

  let clean = name;
  // Remove (numbers)
  clean = clean.replace(/\(\d+\)/g, '');
  // Remove [numbers]
  clean = clean.replace(/\[\d+\]/g, '');
  // Remove ranges like 1-2
  clean = clean.replace(/(^|\s)\d+-\d+(\s|$)/g, ' ');
  // Remove "طبقة"
  clean = clean.replace(/طبقة/g, '');

  return clean.trim();
}

/**
 * Find all lessons at a specific slot (handles shared/multiple lessons)
 * Returns array for handling computerized, differential, etc.
 */
export function findMultipleLessons(
  lessons: Lesson[],
  classId: string,
  period: number,
  day: string
): Lesson[] {
  const normDay = normalizeArabic(day);

  return lessons.filter(l =>
    l.classId === classId &&
    l.period === period &&
    normalizeArabic(l.day) === normDay
  );
}

/**
 * Determines color scheme for a lesson based on teacher role
 * @param lesson - The lesson to color
 * @param teacher - The teacher teaching the lesson
 * @param classId - The class ID being taught
 * @returns Color scheme object with Tailwind classes
 */
export function getLessonColorScheme(
  lesson: any,
  teacher: any,
  classId: string
): {
  bg: string;
  border: string;
  text: string;
  badge?: string;
  badgeBg?: string;
} {
  if (!teacher) {
    return { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-900' };
  }

  // Priority 1: Class Educator (highest priority)
  if (teacher.addons?.educator && teacher.addons.educatorClassId === classId) {
    return {
      bg: 'bg-emerald-50',
      border: 'border-emerald-400',
      text: 'text-emerald-900',
      badge: '🏫 مربي',
      badgeBg: 'bg-emerald-100'
    };
  }

  // Priority 2: Stay/Makooth lesson
  if (lesson.type === 'stay' || lesson.type === 'makooth') {
    return {
      bg: 'bg-amber-50',
      border: 'border-amber-400',
      text: 'text-amber-900',
      badge: '☕ مكوث',
      badgeBg: 'bg-amber-100'
    };
  }

  // Priority 3: Individual lesson
  if (lesson.type === 'individual') {
    return {
      bg: 'bg-purple-50',
      border: 'border-purple-400',
      text: 'text-purple-900',
      badge: '👤 فردي',
      badgeBg: 'bg-purple-100'
    };
  }

  // Priority 4: Shared lesson
  if (
    lesson.subject?.includes('مشترك') ||
    lesson.type === 'shared' ||
    lesson.type === 'computerized' ||
    lesson.type === 'differential'
  ) {
    return {
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      text: 'text-blue-900',
      badge: '👥 مشترك',
      badgeBg: 'bg-blue-100'
    };
  }

  // Default: Regular lesson
  return {
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    text: 'text-slate-900'
  };
}

/**
 * Determines coverage status for a lesson (normal, absent, covered, uncovered)
 * @param lesson - The lesson to check
 * @param absences - Array of absence records
 * @param assignments - Manual assignments record
 * @param substitutionLogs - Substitution logs
 * @param dateStr - Date string in ISO format
 * @returns Coverage status object
 */
export function getCoverageStatus(
  lesson: any,
  absences: any[],
  assignments: Record<string, any[]>,
  substitutionLogs: any[],
  dateStr: string
): {
  status: 'normal' | 'absent-covered' | 'absent-uncovered';
  icon: string;
  color: string;
  label: string;
} {
  if (!lesson || !lesson.teacherId) {
    return { status: 'normal', icon: '', color: '', label: '' };
  }

  const slotKey = `${lesson.classId}-${lesson.period}`;

  // Check if teacher is absent
  const teacherAbsence = absences.find(
    a =>
      a.teacherId === lesson.teacherId &&
      a.date === dateStr &&
      (a.type === 'FULL' ||
        (a.type === 'PARTIAL' && a.affectedPeriods?.includes(lesson.period)))
  );

  if (!teacherAbsence) {
    return { status: 'normal', icon: '', color: '', label: '' };
  }

  // Teacher is absent - check for coverage
  const hasManualAssignment = assignments[slotKey] && assignments[slotKey].length > 0;
  const hasSubstitutionLog = substitutionLogs.some(
    s =>
      s.date === dateStr &&
      s.period === lesson.period &&
      s.classId === lesson.classId &&
      s.absentTeacherId === lesson.teacherId
  );

  if (hasManualAssignment || hasSubstitutionLog) {
    return {
      status: 'absent-covered',
      icon: '',
      color: 'text-emerald-600',
      label: 'مغطى'
    };
  }

  return {
    status: 'absent-uncovered',
    icon: '❌',
    color: 'text-rose-600',
    label: 'غير مغطى'
  };
}

/**
 * Returns shortened teacher name (first name only)
 * @param teacher - Employee object
 * @returns Short name or fallback
 */
export function getTeacherShortName(teacher: any): string {
  if (!teacher || !teacher.name) return '؟';
  const parts = teacher.name.trim().split(/\s+/);
  return parts[0] || '؟';
}
