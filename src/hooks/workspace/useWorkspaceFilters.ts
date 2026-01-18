import { useState, useMemo } from 'react';
import { normalizeArabic, toLocalISOString } from '@/utils';
import { getCoverageStatus } from '@/utils/workspace/lessonHelpers';

export interface FilterState {
  showAbsencesOnly: boolean;
  showCoveredOnly: boolean;
  showUncoveredOnly: boolean;
  searchTeacherId: number | null;
}

interface UseWorkspaceFiltersParams {
  lessons: any[];
  employees: any[];
  absences: any[];
  assignments: Record<string, any[]>;
  substitutionLogs: any[];
  viewDate: Date;
  dayName: string;
}

export function useWorkspaceFilters(params: UseWorkspaceFiltersParams) {
  const {
    lessons,
    employees,
    absences,
    assignments,
    substitutionLogs,
    viewDate,
    dayName
  } = params;

  const [filters, setFilters] = useState<FilterState>({
    showAbsencesOnly: false,
    showCoveredOnly: false,
    showUncoveredOnly: false,
    searchTeacherId: null
  });

  // Filter lessons based on active filters
  const filteredLessons = useMemo(() => {
    const normDay = normalizeArabic(dayName);
    const dateStr = toLocalISOString(viewDate);

    let filtered = lessons.filter(l => normalizeArabic(l.day) === normDay);

    // Filter by teacher search
    if (filters.searchTeacherId !== null) {
      filtered = filtered.filter(l => l.teacherId === filters.searchTeacherId);
    }

    // Filter by absence status
    if (filters.showAbsencesOnly) {
      filtered = filtered.filter(lesson => {
        const coverage = getCoverageStatus(
          lesson,
          absences,
          assignments,
          substitutionLogs,
          dateStr
        );
        return coverage.status !== 'normal';
      });
    }

    // Filter by covered status
    if (filters.showCoveredOnly) {
      filtered = filtered.filter(lesson => {
        const coverage = getCoverageStatus(
          lesson,
          absences,
          assignments,
          substitutionLogs,
          dateStr
        );
        return coverage.status === 'absent-covered';
      });
    }

    // Filter by uncovered status
    if (filters.showUncoveredOnly) {
      filtered = filtered.filter(lesson => {
        const coverage = getCoverageStatus(
          lesson,
          absences,
          assignments,
          substitutionLogs,
          dateStr
        );
        return coverage.status === 'absent-uncovered';
      });
    }

    return filtered;
  }, [
    lessons,
    dayName,
    filters,
    absences,
    assignments,
    substitutionLogs,
    viewDate
  ]);

  // Get set of visible class-period combinations
  const visibleSlots = useMemo(() => {
    const slots = new Set<string>();
    filteredLessons.forEach(lesson => {
      slots.add(`${lesson.classId}-${lesson.period}`);
    });
    return slots;
  }, [filteredLessons]);

  // Check if a slot should be visible
  const isSlotVisible = (classId: string, period: number): boolean => {
    // If no filters active, show all
    if (Object.values(filters).every(v => !v)) {
      return true;
    }
    return visibleSlots.has(`${classId}-${period}`);
  };

  // Get active filters count
  const activeFiltersCount = Object.values(filters).filter(v =>
    typeof v === 'boolean' ? v : v !== null
  ).length;

  return {
    filters,
    setFilters,
    filteredLessons,
    isSlotVisible,
    activeFiltersCount,
    hasActiveFilters: activeFiltersCount > 0
  };
}
