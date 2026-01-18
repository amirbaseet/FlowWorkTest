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
