import { normalizeArabic } from '@/utils';

interface Employee {
  id: number;
  name: string;
  addons?: {
    educator?: boolean;
    educatorClassId?: string;
  };
}

interface Lesson {
  teacherId: number;
  classId: string;
  className?: string;
  period: number;
  day: string;
  subject: string;
  type?: string;
}

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
  canSwapWithLast?: boolean; // New: for stay/individual in last period
  swapInfo?: {
    currentPeriod: number;
    lastPeriod: number;
    sameClass: boolean;
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
}

/**
 * Get available substitute teachers with correct classification
 *
 * Categories:
 * 1. Educator (Priority 1): Class educator, any availability status
 * 2. Shared (Priority 2): Teaching a shared lesson (محوسب/مشترك/تفريقي)
 * 3. Individual (Priority 3): Teaching lesson with "فردي/فردية" in subject
 * 4. Stay (Priority 4): Teaching stay/makooth lesson
 * 5. Available (Priority 5): Free period (no lesson at all)
 */
export function getAvailableTeachers(
  params: GetAvailableTeachersParams
): {
  educatorCandidates: AvailableTeacherInfo[];
  sharedCandidates: AvailableTeacherInfo[];
  individualCandidates: AvailableTeacherInfo[];
  stayCandidates: AvailableTeacherInfo[];
  availableCandidates: AvailableTeacherInfo[];
} {
  const {
    period,
    classId,
    day,
    employees,
    lessons,
    absentTeacherIds,
    alreadyAssignedIds,
    scheduleConfig
  } = params;

  const normalizedDay = normalizeArabic(day);
  const isLastPeriod = scheduleConfig ? period === scheduleConfig.periodsPerDay : false;

  // Result arrays
  const educatorCandidates: AvailableTeacherInfo[] = [];
  const sharedCandidates: AvailableTeacherInfo[] = [];
  const individualCandidates: AvailableTeacherInfo[] = [];
  const stayCandidates: AvailableTeacherInfo[] = [];
  const availableCandidates: AvailableTeacherInfo[] = [];

  for (const employee of employees) {
    // Skip if absent
    if (absentTeacherIds.includes(employee.id)) {
      continue;
    }

    // Skip if already assigned as substitute in this period
    if (alreadyAssignedIds.includes(employee.id)) {
      continue;
    }

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
        className: currentLesson.className || currentLesson.classId,
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
        swapInfo
      });
      continue; // Skip other categories if educator
    }

    // If no lesson - AVAILABLE
    if (!currentLesson) {
      availableCandidates.push({
        teacherId: employee.id,
        teacherName: employee.name,
        category: 'available',
        priority: 5,
        canSwapWithLast: false
      });
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
        swapInfo
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
        swapInfo
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
        swapInfo
      });
      continue;
    }

    // If has actual lesson but doesn't match any category - skip
    // (busy with real teaching)
  }

  // Sort each category by priority
  educatorCandidates.sort((a, b) => a.priority - b.priority);
  sharedCandidates.sort((a, b) => a.priority - b.priority);
  individualCandidates.sort((a, b) => a.priority - b.priority);
  stayCandidates.sort((a, b) => a.priority - b.priority);
  availableCandidates.sort((a, b) => a.priority - b.priority);

  return {
    educatorCandidates,
    sharedCandidates,
    individualCandidates,
    stayCandidates,
    availableCandidates
  };
}
