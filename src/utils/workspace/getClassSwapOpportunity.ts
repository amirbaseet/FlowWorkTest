import type { Lesson } from '@/types';
import { normalizeArabic } from '@/utils';

interface ClassSwapOpportunity {
  canSwap: boolean;
  lastPeriod?: number;
  lastPeriodLesson?: Lesson;
  swapType: 'gap' | 'individual' | 'stay' | null;
  earlyDismissalPeriod?: number; // Period after which teacher can leave
}

/**
 * Check if a class has a swappable last period
 * A period is swappable if the teacher of the last period is free/individual/stay during the target period
 */
export function getClassSwapOpportunity(
  classId: string,
  targetPeriod: number, // The absence period we're covering (e.g., period 2)
  dayName: string,
  lessons: Lesson[],
  totalPeriods: number = 8
): ClassSwapOpportunity {
  const normDay = normalizeArabic(dayName);

  // Get all lessons for this class today
  const classLessons = lessons.filter(
    l => l.classId === classId && normalizeArabic(l.day) === normDay
  );

  // Find the last period for this class
  const periods = classLessons.map(l => l.period).sort((a, b) => b - a);
  const lastPeriod = periods[0];

  // Must have a last period and it must be after target period
  if (!lastPeriod || lastPeriod <= targetPeriod) {
    return { canSwap: false, swapType: null };
  }

  // Find the lesson in the last period
  const lastPeriodLesson = classLessons.find(l => l.period === lastPeriod);

  // If no lesson in last period (gap), can't swap
  if (!lastPeriodLesson) {
    return { canSwap: false, swapType: null };
  }

  // NEW LOGIC: Get the teacher of the last period
  const lastPeriodTeacherId = lastPeriodLesson.teacherId;

  // NEW LOGIC: Check what this teacher is doing during the TARGET period (absence period)
  const teacherTargetPeriodLesson = lessons.find(
    l => l.teacherId === lastPeriodTeacherId &&
         l.period === targetPeriod &&
         normalizeArabic(l.day) === normDay
  );

  // Determine if teacher is available to swap
  let swapType: 'gap' | 'individual' | 'stay' | null = null;

  if (!teacherTargetPeriodLesson) {
    // Teacher has no lesson during target period = gap/فراغ
    swapType = 'gap';
  } else if (
    teacherTargetPeriodLesson.type === 'individual' ||
    teacherTargetPeriodLesson.subject?.includes('فردي') ||
    teacherTargetPeriodLesson.subject?.includes('فردية')
  ) {
    // Teacher is teaching individual lesson during target period
    swapType = 'individual';
  } else if (
    teacherTargetPeriodLesson.type === 'stay' ||
    teacherTargetPeriodLesson.subject?.includes('مكوث')
  ) {
    // Teacher is on stay/makooth during target period
    swapType = 'stay';
  }

  // Can only swap if teacher is free/individual/stay during target period
  if (!swapType) {
    return { canSwap: false, swapType: null };
  }

  return {
    canSwap: true,
    lastPeriod,
    lastPeriodLesson,
    swapType,
    earlyDismissalPeriod: lastPeriod - 1 // Can leave after this period
  };
}
