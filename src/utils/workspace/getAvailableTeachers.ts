import { normalizeArabic } from '@/utils';
import { getClassSwapOpportunity } from './getClassSwapOpportunity';
import type { Employee, Lesson } from '@/types';

export interface AvailableTeacherInfo {
  teacherId: number;
  teacherName: string;
  category: 'educator' | 'shared' | 'individual' | 'stay' | 'available';
  priority: number;
  currentLesson?: {
    classId: string;
    className: string;
    subject: string;
    period: number;
    type: string;
  };
  canSwapWithLast?: boolean;
  swapInfo?: {
    currentPeriod: number;
    lastPeriod: number;
    sameClass: boolean;
  };
  hasLessonsToday?: boolean; // NEW: Does teacher have any lessons this day?
  isOnCall?: boolean; // NEW: Is teacher explicitly called to school?
  isUnavailable?: boolean; // NEW: Is teacher busy or absent (in pool but can't be selected)
  // NEW: Class-based swap opportunity
  classSwapOpportunity?: {
    canSwap: boolean;
    lastPeriod: number;
    swapType: 'gap' | 'individual' | 'stay';
    earlyDismissalPeriod: number;
  };
}

interface GetAvailableTeachersParams {
  period: number;
  classId: string;
  day: string;
  employees: Employee[];
  lessons: Lesson[];
  absentTeacherIds: number[];
  alreadyAssignedIds: number[];
  scheduleConfig?: {
    periodsPerDay: number;
  };
  reservePoolIds?: number[];
}

/**
 * Get available substitute teachers with correct classification
 *
 * Categories:
 * 1. Educator (Priority 1-4): Class educator, sub-prioritized by current activity
 * 2. Shared (Priority 2): Teaching a shared lesson (محوسب/مشترك/تفريقي)
 * 3. Individual (Priority 3): Teaching lesson with "فردي/فردية" in subject
 * 4. Stay (Priority 4): Teaching stay/makooth lesson
 * 5. Available (Priority 5): Free period AND has lessons today (at school)
 * 6. On-Call (Priority 6): No lessons today BUT explicitly added to reserve pool
 */
export function getAvailableTeachers(
  params: GetAvailableTeachersParams
): {
  educatorCandidates: AvailableTeacherInfo[];
  sharedCandidates: AvailableTeacherInfo[];
  individualCandidates: AvailableTeacherInfo[];
  stayCandidates: AvailableTeacherInfo[];
  availableCandidates: AvailableTeacherInfo[];
  onCallCandidates: AvailableTeacherInfo[]; // NEW
} {
  const {
    period,
    classId,
    day,
    employees,
    lessons,
    absentTeacherIds,
    alreadyAssignedIds,
    scheduleConfig,
    reservePoolIds = [] // NEW: Default to empty array
  } = params;

  const normalizedDay = normalizeArabic(day);
  const isLastPeriod = scheduleConfig ? period === scheduleConfig.periodsPerDay : false;

  // Result arrays
  const educatorCandidates: AvailableTeacherInfo[] = [];
  const sharedCandidates: AvailableTeacherInfo[] = [];
  const individualCandidates: AvailableTeacherInfo[] = [];
  const stayCandidates: AvailableTeacherInfo[] = [];
  const availableCandidates: AvailableTeacherInfo[] = [];
  const onCallCandidates: AvailableTeacherInfo[] = []; // NEW

  for (const employee of employees) {
    // Skip if absent
    if (absentTeacherIds.includes(employee.id)) {
      continue;
    }

    // Skip if already assigned as substitute in this period
    if (alreadyAssignedIds.includes(employee.id)) {
      continue;
    }

    // ✅ CRITICAL FIX: Check if teacher has ANY lessons on this day
    const hasLessonsToday = lessons.some(
      l => l.teacherId === employee.id && normalizeArabic(l.day) === normalizedDay
    );

    // Find teacher's current lesson at this period and day
    const currentLesson = lessons.find(
      l =>
        l.teacherId === employee.id &&
        l.period === period &&
        normalizeArabic(l.day) === normalizedDay
    );

    // Check if this teacher is the class educator
    const isTargetEducator =
      employee.addons?.educator === true &&
      employee.addons.educatorClassId === classId;

    // Prepare current lesson info if exists
    let lessonInfo: AvailableTeacherInfo['currentLesson'] | undefined;
    if (currentLesson) {
      lessonInfo = {
        classId: currentLesson.classId,
        className: currentLesson.classId, // Use classId as className
        subject: currentLesson.subject,
        period: currentLesson.period,
        type: currentLesson.type || 'actual'
      };
    }

    // Check if can swap with last period (for stay/individual)
    let canSwapWithLast = false;
    let swapInfo: AvailableTeacherInfo['swapInfo'] | undefined;

    if (!isLastPeriod && currentLesson && scheduleConfig) {
      // Check if teacher has a lesson in last period
      const lastPeriodLesson = lessons.find(
        l =>
          l.teacherId === employee.id &&
          l.period === scheduleConfig.periodsPerDay &&
          normalizeArabic(l.day) === normalizedDay
      );

      if (lastPeriodLesson) {
        // Can swap if:
        // 1. Current lesson is stay/individual
        // 2. Last period lesson is in same class as target
        const isStayOrIndividual =
          currentLesson.type === 'stay' ||
          currentLesson.type === 'makooth' ||
          currentLesson.subject?.includes('فردي') ||
          currentLesson.subject?.includes('فردية');

        const lastPeriodSameClass = lastPeriodLesson.classId === classId;

        if (isStayOrIndividual && lastPeriodSameClass) {
          canSwapWithLast = true;
          swapInfo = {
            currentPeriod: period,
            lastPeriod: scheduleConfig.periodsPerDay,
            sameClass: true
          };
        }
      }
    }

    // CATEGORY 1: CLASS EDUCATOR (highest priority)
    if (isTargetEducator) {
      let educatorPriority = 1;
      let educatorCategory: AvailableTeacherInfo['category'] = 'educator';

      // Sub-prioritize based on current activity
      if (!currentLesson) {
        educatorPriority = 1; // Free educator - best
      } else if (
        currentLesson.subject?.includes('فردي') ||
        currentLesson.subject?.includes('فردية')
      ) {
        educatorPriority = 2; // Educator in individual
      } else if (
        currentLesson.type === 'stay' ||
        currentLesson.type === 'makooth'
      ) {
        educatorPriority = 3; // Educator in stay
      } else {
        educatorPriority = 4; // Educator in actual lesson
      }

      educatorCandidates.push({
        teacherId: employee.id,
        teacherName: employee.name,
        category: educatorCategory,
        priority: educatorPriority,
        currentLesson: lessonInfo,
        canSwapWithLast,
        swapInfo,
        hasLessonsToday,
        isOnCall: false
      });
      continue; // Skip other categories if educator
    }

    // ✅ CRITICAL FIX: If no lesson - only AVAILABLE if hasLessonsToday
    if (!currentLesson && hasLessonsToday) {
      availableCandidates.push({
        teacherId: employee.id,
        teacherName: employee.name,
        category: 'available',
        priority: 5,
        canSwapWithLast: false,
        hasLessonsToday: true,
        isOnCall: false
      });
      continue;
    }

    // ✅ NEW: If no lesson - check if on-call (in reserve pool)
    if (!currentLesson && !hasLessonsToday && reservePoolIds.includes(employee.id)) {
      onCallCandidates.push({
        teacherId: employee.id,
        teacherName: employee.name,
        category: 'available',
        priority: 6, // Lowest priority
        canSwapWithLast: false,
        hasLessonsToday: false,
        isOnCall: true
      });
      continue;
    }

    // If no lessons today and not in pool - skip (not at school)
    if (!currentLesson) {
      continue;
    }

    // CATEGORY 2: SHARED LESSONS (محوسب، مشترك، تفريقي)
    if (
      currentLesson.type === 'shared' ||
      currentLesson.type === 'computerized' ||
      currentLesson.type === 'differential' ||
      currentLesson.subject?.includes('مشترك') ||
      currentLesson.subject?.includes('محوسب') ||
      currentLesson.subject?.includes('تفريقي')
    ) {
      sharedCandidates.push({
        teacherId: employee.id,
        teacherName: employee.name,
        category: 'shared',
        priority: 2,
        currentLesson: lessonInfo,
        canSwapWithLast,
        swapInfo,
        hasLessonsToday,
        isOnCall: false
      });
      continue;
    }

    // CATEGORY 3: INDIVIDUAL LESSONS (فردي، فردية)
    // CRITICAL FIX: Check subject text, NOT whether teacher has schedule
    if (
      currentLesson.subject?.includes('فردي') ||
      currentLesson.subject?.includes('فردية')
    ) {
      individualCandidates.push({
        teacherId: employee.id,
        teacherName: employee.name,
        category: 'individual',
        priority: 3,
        currentLesson: lessonInfo,
        canSwapWithLast,
        swapInfo,
        hasLessonsToday,
        isOnCall: false
      });
      continue;
    }

    // CATEGORY 4: STAY LESSONS (مكوث)
    if (
      currentLesson.type === 'stay' ||
      currentLesson.type === 'makooth' ||
      currentLesson.subject?.includes('مكوث')
    ) {
      stayCandidates.push({
        teacherId: employee.id,
        teacherName: employee.name,
        category: 'stay',
        priority: 4,
        currentLesson: lessonInfo,
        canSwapWithLast,
        swapInfo,
        hasLessonsToday,
        isOnCall: false
      });
      continue;
    }

    // If has actual lesson but doesn't match any category - skip
    // (busy with real teaching)
  }

  // NEW: Check if target class has swappable last period
  const classSwap = getClassSwapOpportunity(
    classId,
    period,
    day,
    lessons,
    scheduleConfig?.periodsPerDay || 8
  );

  // Add class swap info to ALL candidates (if available)
  if (classSwap.canSwap) {
    const addClassSwapInfo = (candidate: AvailableTeacherInfo) => {
      candidate.classSwapOpportunity = {
        canSwap: true,
        lastPeriod: classSwap.lastPeriod!,
        swapType: classSwap.swapType!,
        earlyDismissalPeriod: classSwap.earlyDismissalPeriod!
      };
    };

    educatorCandidates.forEach(addClassSwapInfo);
    sharedCandidates.forEach(addClassSwapInfo);
    individualCandidates.forEach(addClassSwapInfo);
    stayCandidates.forEach(addClassSwapInfo);
    availableCandidates.forEach(addClassSwapInfo);
    onCallCandidates.forEach(addClassSwapInfo);
  }

  // Sort each category by priority
  educatorCandidates.sort((a, b) => a.priority - b.priority);
  sharedCandidates.sort((a, b) => a.priority - b.priority);
  individualCandidates.sort((a, b) => a.priority - b.priority);
  stayCandidates.sort((a, b) => a.priority - b.priority);
  availableCandidates.sort((a, b) => a.priority - b.priority);
  onCallCandidates.sort((a, b) => a.priority - b.priority); // NEW

  return {
    educatorCandidates,
    sharedCandidates,
    individualCandidates,
    stayCandidates,
    availableCandidates,
    onCallCandidates // NEW
  };
}
