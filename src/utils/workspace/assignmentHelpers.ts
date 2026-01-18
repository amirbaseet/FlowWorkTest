// src/utils/workspace/assignmentHelpers.ts

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AssignmentRules {
  maxSubstitutionsPerTeacher?: number;
  maxSubstitutionsPerDay?: number;
  preventDuplicates?: boolean;
}

/**
 * Create assignment key from classId and period
 */
export function createAssignmentKey(classId: string, period: number): string {
  return `${classId}-${period}`;
}

/**
 * Parse assignment key into classId and period
 * Returns null if invalid format
 */
export function parseAssignmentKey(key: string): {
  classId: string;
  period: number;
} | null {
  const parts = key.split('-');
  
  if (parts.length !== 2) return null;

  const period = Number(parts[1]);
  
  if (isNaN(period)) return null;

  return {
    classId: parts[0],
    period
  };
}

/**
 * Validate assignment against existing assignments and rules
 */
export function validateAssignment(
  assignment: { classId: string; period: number; teacherId: number },
  existingAssignments: Record<string, Array<{ teacherId: number; reason: string }>>,
  rules: AssignmentRules = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Default rules
  const preventDuplicates = rules.preventDuplicates !== false; // default true

  // Check for duplicate assignment
  if (preventDuplicates) {
    const key = createAssignmentKey(assignment.classId, assignment.period);
    const existing = existingAssignments[key] || [];
    
    if (existing.some(a => a.teacherId === assignment.teacherId)) {
      errors.push('هذا المعلم معيّن مسبقاً لهذه الحصة');
    }
  }

  // Check teacher workload
  if (rules.maxSubstitutionsPerTeacher) {
    let teacherAssignmentCount = 0;
    
    Object.values(existingAssignments).forEach(assignments => {
      teacherAssignmentCount += assignments.filter(
        a => a.teacherId === assignment.teacherId
      ).length;
    });

    if (teacherAssignmentCount >= rules.maxSubstitutionsPerTeacher) {
      errors.push(`المعلم وصل للحد الأقصى من البدائل (${rules.maxSubstitutionsPerTeacher})`);
    } else if (teacherAssignmentCount >= (rules.maxSubstitutionsPerTeacher * 0.8)) {
      warnings.push(`المعلم قريب من الحد الأقصى للبدائل`);
    }
  }

  // Check daily workload
  if (rules.maxSubstitutionsPerDay) {
    const totalDailyAssignments = Object.values(existingAssignments).reduce(
      (sum, assignments) => sum + assignments.length,
      0
    );

    if (totalDailyAssignments >= rules.maxSubstitutionsPerDay) {
      warnings.push(`عدد البدائل اليومية عالي (${totalDailyAssignments})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Merge two assignment records
 * Deduplicates by teacherId within same key
 */
export function mergeAssignments(
  assignments1: Record<string, Array<{ teacherId: number; reason: string }>>,
  assignments2: Record<string, Array<{ teacherId: number; reason: string }>>
): Record<string, Array<{ teacherId: number; reason: string }>> {
  const result = { ...assignments1 };

  Object.entries(assignments2).forEach(([key, assignments]) => {
    if (result[key]) {
      // Merge and deduplicate by teacherId
      const combined = [...result[key], ...assignments];
      const unique = combined.filter((assignment, index, self) =>
        self.findIndex(a => a.teacherId === assignment.teacherId) === index
      );
      result[key] = unique;
    } else {
      result[key] = assignments;
    }
  });

  return result;
}

/**
 * Group assignments by teacher ID
 * Returns Map of teacherId -> array of slots
 */
export function groupAssignmentsByTeacher(
  assignments: Record<string, Array<{ teacherId: number; reason: string }>>
): Map<number, Array<{ classId: string; period: number; reason: string }>> {
  const grouped = new Map<number, Array<{ classId: string; period: number; reason: string }>>();

  Object.entries(assignments).forEach(([key, assignmentList]) => {
    const parsed = parseAssignmentKey(key);
    
    if (!parsed) return;

    assignmentList.forEach(assignment => {
      const existing = grouped.get(assignment.teacherId) || [];
      existing.push({
        classId: parsed.classId,
        period: parsed.period,
        reason: assignment.reason
      });
      grouped.set(assignment.teacherId, existing);
    });
  });

  return grouped;
}
