// src/utils/workspace/index.ts

// Date helpers
export {
  isSchoolDay,
  getWorkingDays,
  formatArabicDate,
  getSafeDayName
} from './dateHelpers';

// Lesson helpers
export {
  findLessonAtSlot,
  getLessonsByTeacher,
  getCompactSubjectLabel,
  formatClassDisplayName,
  findMultipleLessons
} from './lessonHelpers';
export type { SubjectLabel } from './lessonHelpers';

// Teacher helpers
export {
  getTeacherWorkload,
  isTeacherAvailable,
  getTeachersByStatus,
  getTeacherDisplayName
} from './teacherHelpers';
export type { TeachersByStatus } from './teacherHelpers';

// Assignment helpers
export {
  createAssignmentKey,
  parseAssignmentKey,
  validateAssignment,
  mergeAssignments,
  groupAssignmentsByTeacher
} from './assignmentHelpers';
export type { ValidationResult, AssignmentRules } from './assignmentHelpers';
