// src/hooks/workspace/useCandidateSelection.ts

import { Employee, Lesson } from '@/types';
import { normalizeArabic } from '@/utils';

export interface CandidateInfo {
  emp: Employee;
  label: string;
  type: 'FREE' | 'INDIVIDUAL' | 'STAY' | 'EDUCATOR_FREE' | 'EDUCATOR_BUSY' | 'BUSY';
  priority: number;
  isTarget?: boolean;
}

export interface CandidateGroups {
  poolCandidates: CandidateInfo[];
  educatorCandidates: CandidateInfo[];
  supportCandidates: CandidateInfo[];
}

/**
 * Get available teacher candidates for a specific slot
 * Pure function - no hooks, just computation
 */
export function getSlotCandidates(
  targetClassId: string,
  period: number,
  dayName: string,
  employees: Employee[],
  lessons: Lesson[],
  assignments: Record<string, any>,
  localPoolIds: number[]
): CandidateGroups {
  
  const normDay = normalizeArabic(dayName);
  const targetEducator = employees.find(
    e => e.addons?.educator && String(e.addons.educatorClassId) === String(targetClassId)
  );

  // Track assigned teachers in this period
  const assignedElsewhereMap = new Map<number, string>();
  Object.entries(assignments).forEach(([key, valArray]: [string, any]) => {
    const [classId, p] = key.split('-');
    if (Number(p) === period && classId !== targetClassId) {
      valArray.forEach((a: any) => assignedElsewhereMap.set(a.teacherId, classId));
    }
  });

  const poolCandidates: CandidateInfo[] = [];
  const educatorCandidates: CandidateInfo[] = [];
  const supportCandidates: CandidateInfo[] = [];

  employees.forEach(emp => {
    // Skip if assigned elsewhere in this period
    if (assignedElsewhereMap.has(emp.id)) return;

    // Find employee's lesson in this period
    const empLesson = lessons.find(l =>
      l.teacherId === emp.id &&
      normalizeArabic(l.day) === normDay &&
      l.period === period
    );

    const lessonType = empLesson?.type?.toLowerCase();
    const isTarget = targetEducator && emp.id === targetEducator.id;

    let statusLabel = '';
    let statusType: CandidateInfo['type'] = 'BUSY';
    let priority = 99;

    // Educator logic
    if (emp.addons?.educator) {
      if (isTarget) {
        if (lessonType === 'individual') {
          statusLabel = 'مربي (فردي)';
          statusType = 'INDIVIDUAL';
          priority = 2;
        } else if (lessonType === 'stay' || lessonType === 'makooth') {
          statusLabel = 'مربي (مكوث)';
          statusType = 'STAY';
          priority = 10; // Manual only
        } else if (empLesson) {
          statusLabel = 'مربي (فعلي)';
          statusType = 'EDUCATOR_BUSY';
          priority = 1;
        } else {
          statusLabel = 'مربي (فارغ)';
          statusType = 'EDUCATOR_FREE';
          priority = 1;
        }
        educatorCandidates.push({ 
          emp, 
          label: statusLabel, 
          type: statusType, 
          priority, 
          isTarget: true 
        });
      }
      return; // Skip other educators
    }

    // Support staff logic
    if (!empLesson) {
      statusLabel = 'متاح - فراغ';
      statusType = 'FREE';
      priority = 3;
    } else if (lessonType === 'individual') {
      statusLabel = 'حصة فردية';
      statusType = 'INDIVIDUAL';
      priority = 4;
    } else if (lessonType === 'stay' || lessonType === 'makooth') {
      statusLabel = 'حصة مكوث (يدوي فقط)';
      statusType = 'STAY';
      priority = 10;
    } else {
      statusLabel = 'لديه حصة';
      statusType = 'BUSY';
      priority = 5;
    }

    // Add to pool if in localPoolIds (daily reserve)
    if (localPoolIds.includes(emp.id)) {
      poolCandidates.push({ emp, label: statusLabel, type: statusType, priority });
    } else {
      supportCandidates.push({ emp, label: statusLabel, type: statusType, priority });
    }
  });

  return {
    poolCandidates: poolCandidates.sort((a, b) => a.priority - b.priority),
    educatorCandidates: educatorCandidates.sort((a, b) => a.priority - b.priority),
    supportCandidates: supportCandidates.sort((a, b) => a.priority - b.priority)
  };
}
