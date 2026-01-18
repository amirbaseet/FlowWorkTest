import { Employee, Lesson } from '@/types';
import { normalizeArabic } from '@/utils';

interface GetAvailableTeachersParams {
  period: number;
  classId: string;
  day: string;
  employees: Employee[];
  lessons: Lesson[];
  absentTeacherIds?: number[];
  alreadyAssignedIds?: number[];
}

interface AvailableTeacher {
  teacher: Employee;
  category: 'educator' | 'stay' | 'shared' | 'individual';
  reason: string;
}

/**
 * Helper function to translate lesson types to Arabic reasons
 */
const getLessonTypeReason = (type: string | undefined, subject?: string): string => {
  if (!type) return 'متاح';
  
  const normalizedType = type.toLowerCase();
  
  if (normalizedType === 'stay' || normalizedType.includes('makooth') || normalizedType.includes('مكوث')) {
    return 'حصة بقاء';
  }
  
  if (normalizedType === 'individual' || normalizedType.includes('فردي')) {
    return 'حصة فردية';
  }
  
  if (normalizedType === 'duty' || normalizedType.includes('مناوبة')) {
    return 'مناوبة';
  }
  
  if (normalizedType === 'shared' || (subject && normalizeArabic(subject).includes('مشترك'))) {
    return 'حصة مشتركة (ثانوي)';
  }
  
  return 'متاح';
};

/**
 * Analyzes available substitute teachers based on their current schedule and categorizes them by priority
 * 
 * @param params - Parameters including period, class, day, employees, lessons, and exclusion lists
 * @returns Array of available teachers sorted by priority category
 */
export function getAvailableTeachers(params: GetAvailableTeachersParams): AvailableTeacher[] {
  const {
    period,
    classId,
    day,
    employees,
    lessons,
    absentTeacherIds = [],
    alreadyAssignedIds = [],
  } = params;

  const normalizedDay = normalizeArabic(day);
  const availableTeachers: AvailableTeacher[] = [];

  // Priority order for sorting
  const categoryPriority: Record<string, number> = {
    educator: 1,
    stay: 2,
    shared: 3,
    individual: 4,
  };

  // Iterate through all employees
  for (const employee of employees) {
    // 1. Filter out absent teachers
    if (absentTeacherIds.includes(employee.id)) {
      continue;
    }

    // 2. Filter out already assigned teachers
    if (alreadyAssignedIds.includes(employee.id)) {
      continue;
    }

    // 3. Check if teacher is the class educator (highest priority)
    if (
      employee.addons?.educator &&
      employee.addons.educatorClassId &&
      String(employee.addons.educatorClassId) === String(classId)
    ) {
      availableTeachers.push({
        teacher: employee,
        category: 'educator',
        reason: 'مربي الصف',
      });
      continue; // Move to next teacher (highest priority already assigned)
    }

    // 4. Find their lesson at the same period and day
    const teacherLesson = lessons.find(
      (lesson) =>
        lesson.teacherId === employee.id &&
        lesson.period === period &&
        normalizeArabic(lesson.day) === normalizedDay
    );

    // If no lesson found, teacher is completely free (treat as individual - lowest priority)
    if (!teacherLesson) {
      availableTeachers.push({
        teacher: employee,
        category: 'individual',
        reason: 'متاح تماماً',
      });
      continue;
    }

    // Check lesson type and subject
    const lessonType = teacherLesson.type?.toLowerCase() || '';
    const lessonSubject = normalizeArabic(teacherLesson.subject || '');

    // 5a. Check if lesson type is 'stay' or 'makooth'
    if (
      lessonType === 'stay' ||
      lessonType.includes('makooth') ||
      lessonType.includes('مكوث') ||
      lessonSubject.includes('مكوث')
    ) {
      availableTeachers.push({
        teacher: employee,
        category: 'stay',
        reason: getLessonTypeReason('stay'),
      });
      continue;
    }

    // 5b. Check if lesson is shared lesson and teacher is secondary
    const isSharedLesson =
      lessonSubject.includes('مشترك') ||
      lessonType === 'shared' ||
      teacherLesson.teacherRole === 'secondary';

    if (isSharedLesson) {
      availableTeachers.push({
        teacher: employee,
        category: 'shared',
        reason: 'معلم ثانوي في حصة مشتركة',
      });
      continue;
    }

    // 5c. Check if lesson type is 'individual'
    if (lessonType === 'individual' || lessonType.includes('فردي')) {
      availableTeachers.push({
        teacher: employee,
        category: 'individual',
        reason: getLessonTypeReason('individual'),
      });
      continue;
    }

    // If lesson exists but doesn't fit any category above, it's likely a teaching lesson
    // Teacher is busy - don't add to available list
  }

  // 6. Sort results by priority: educators > stay > shared > individual
  availableTeachers.sort((a, b) => {
    const priorityDiff = categoryPriority[a.category] - categoryPriority[b.category];
    
    // If same priority, sort by teacher name (Arabic alphabetical)
    if (priorityDiff === 0) {
      return a.teacher.name.localeCompare(b.teacher.name, 'ar');
    }
    
    return priorityDiff;
  });

  return availableTeachers;
}

/**
 * Groups available teachers by category for easier consumption by UI components
 */
export function groupAvailableTeachersByCategory(teachers: AvailableTeacher[]) {
  return {
    educators: teachers.filter((t) => t.category === 'educator'),
    stayLessonTeachers: teachers.filter((t) => t.category === 'stay'),
    sharedSecondaryTeachers: teachers.filter((t) => t.category === 'shared'),
    individualTeachers: teachers.filter((t) => t.category === 'individual'),
  };
}
