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
 * A period is swappable if it's: gap, individual, or stay
 */
export function getClassSwapOpportunity(
  classId: string,
  targetPeriod: number, // The absence period we're covering
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

  // Determine if last period is swappable
  let swapType: 'gap' | 'individual' | 'stay' | null = null;

  if (!lastPeriodLesson) {
    // No lesson = gap/فراغ
    swapType = 'gap';
  } else if (
    lastPeriodLesson.type === 'individual' ||
    lastPeriodLesson.subject?.includes('فردي') ||
    lastPeriodLesson.subject?.includes('فردية')
  ) {
    swapType = 'individual';
  } else if (
    lastPeriodLesson.type === 'stay' ||
    lastPeriodLesson.subject?.includes('مكوث')
  ) {
    swapType = 'stay';
  }

  // Can only swap if it's gap, individual, or stay
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
