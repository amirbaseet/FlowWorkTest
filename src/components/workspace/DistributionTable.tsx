// src/components/workspace/DistributionTable.tsx

import React from 'react';
import { Employee, ClassItem, Lesson, AbsenceRecord, SubstitutionLog, CalendarEvent } from '@/types';
import { normalizeArabic, toLocalISOString } from '@/utils';
import { 
  getCompactSubjectLabel, 
  formatClassDisplayName, 
  getLessonColorScheme, 
  getCoverageStatus, 
  getTeacherShortName 
} from '@/utils/workspace/lessonHelpers';
import LessonTooltip from './LessonTooltip';
import { AvailableSubsBadge, SharedLessonBadge } from './LessonBadges';
import { countAvailableSubstitutes, calculateTeacherWorkload } from '@/utils/workspace/teacherHelpers';
import { getClassSwapOpportunity } from '@/utils/workspace/getClassSwapOpportunity';
import { RefreshCw } from 'lucide-react';

interface DistributionTableProps {
  classes: ClassItem[];
  periods: number[];
  lessons: Lesson[];
  employees: Employee[];
  selectedClasses: string[];
  selectedPeriods: number[];
  selectedMode: string;
  assignments: Record<string, Array<{ teacherId: number; reason: string }>>;
  distributionGrid: Record<string, any>;
  absences: AbsenceRecord[];
  substitutionLogs: SubstitutionLog[];
  events: CalendarEvent[];
  viewDate: Date;
  dayName: string;
  onToggleClass: (classId: string) => void;
  onTogglePeriod: (period: number) => void;
  onLessonClick: (lesson: Lesson, className: string) => void;
  isSlotVisible?: (classId: string, period: number) => boolean;
  hasActiveFilters?: boolean;
}

/**
 * DistributionTable - Main schedule grid with selection and assignments
 * Simplified version for refactored Workspace
 */
const DistributionTable: React.FC<DistributionTableProps> = ({
  classes,
  periods,
  lessons,
  employees,
  selectedClasses,
  selectedPeriods,
  selectedMode,
  assignments,
  distributionGrid,
  absences,
  substitutionLogs,
  viewDate,
  dayName,
  onToggleClass,
  onTogglePeriod,
  onLessonClick,
  isSlotVisible,
  hasActiveFilters
}) => {
  const normDay = normalizeArabic(dayName);

  const findLesson = (classId: string, period: number) => {
    return lessons.find(l =>
      l.classId === classId &&
      l.period === period &&
      normalizeArabic(l.day) === normDay
    );
  };

  const getAssignments = (classId: string, period: number) => {
    const key = `${classId}-${period}`;
    return assignments[key] || [];
  };

  return (
    <table className="w-full text-[9px] border-collapse">
      <thead className="sticky top-0 bg-indigo-100 z-20 shadow-sm">
        <tr>
          {/* Period Label (sticky left corner) */}
          <th className="sticky right-0 z-30 bg-indigo-200 border border-indigo-300 p-2 text-[10px] font-black text-indigo-900 w-16">
            الحصة
          </th>

          {/* Class Headers */}
          {classes.map(cls => {
            const isSelected = selectedClasses.includes(cls.id);
            return (
              <th
                key={cls.id}
                className="border border-indigo-300 p-1 min-w-[100px] relative"
              >
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-indigo-900">
                    {cls.name}
                  </div>
                  {selectedMode && (
                    <button
                      onClick={() => onToggleClass(cls.id)}
                      className={`w-full px-2 py-0.5 rounded text-[7px] font-bold transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-indigo-50'
                      }`}
                    >
                      {isSelected ? '✓ محدد' : 'اختيار'}
                    </button>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {periods.map(period => {
          const isPeriodSelected = selectedPeriods.includes(period);
          return (
            <tr key={period} className="border-b border-indigo-200">
              {/* Period Number (sticky left) */}
              <td className="sticky right-0 z-10 bg-indigo-100 border border-indigo-300 p-2 text-center font-black text-indigo-900">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-base">{period}</div>
                  {selectedMode && (
                    <button
                      onClick={() => onTogglePeriod(period)}
                      className={`w-full px-2 py-0.5 rounded text-[7px] font-bold transition-all ${
                        isPeriodSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-indigo-50'
                      }`}
                    >
                      {isPeriodSelected ? '✓' : '○'}
                    </button>
                  )}
                </div>
              </td>

              {/* Lesson Cells */}
              {classes.map(cls => {
                const normDay = normalizeArabic(dayName);
                const lesson = lessons.find(
                  l =>
                    l.classId === cls.id &&
                    l.period === period &&
                    normalizeArabic(l.day) === normDay
                );
                const slotKey = `${cls.id}-${period}`;
                const isSelected =
                  selectedMode &&
                  selectedClasses.includes(cls.id) &&
                  selectedPeriods.includes(period);

                // Check if slot is visible with filters
                const isVisible = isSlotVisible ? isSlotVisible(cls.id, period) : true;

                // If filtered out, dim the cell
                if (hasActiveFilters && !isVisible) {
                  return (
                    <td
                      key={slotKey}
                      className="p-1 border border-slate-200 bg-gray-100 opacity-30"
                    >
                      {lesson && (
                        <div className="text-[8px] text-gray-400 truncate">
                          {getCompactSubjectLabel(lesson.subject).text}
                        </div>
                      )}
                    </td>
                  );
                }

                // If no lesson, show empty cell
                if (!lesson) {
                  return (
                    <td
                      key={slotKey}
                      className={`
                        p-1 border border-slate-200 text-center text-[8px] text-slate-400
                        ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-white'}
                      `}
                    >
                      فراغ
                    </td>
                  );
                }

                // Get teacher and color scheme
                const teacher = employees.find(e => e.id === lesson.teacherId);
                const colorScheme = getLessonColorScheme(lesson, teacher, cls.id);
                const subjectLabel = getCompactSubjectLabel(lesson.subject);

                // Get coverage status
                const dateStr = toLocalISOString(viewDate);
                const coverage = getCoverageStatus(
                  lesson,
                  absences,
                  assignments,
                  substitutionLogs,
                  dateStr
                );

                // Get assignments for this slot
                const localAssignments = assignments[slotKey] || [];
                const distributionSlot = distributionGrid[slotKey];

                // NEW: Calculate available substitutes
                const absentIds = absences
                  .filter(a => a.date === dateStr)
                  .map(a => a.teacherId);
                const assignedIds = substitutionLogs
                  .filter(s => s.date === dateStr && s.period === period)
                  .map(s => s.substituteId);
                const availableSubsCount = countAvailableSubstitutes(
                  period,
                  cls.id,
                  dayName,
                  employees,
                  lessons,
                  absentIds,
                  assignedIds
                );

                // NEW: Calculate teacher workload
                const todaySubstitutions = substitutionLogs.filter(
                  s => s.date === dateStr
                );
                const teacherWorkload = teacher
                  ? calculateTeacherWorkload(teacher.id, lessons, dayName, todaySubstitutions)
                  : 0;

                // Check if lesson is shared
                const isShared =
                  lesson.subject?.includes('مشترك') ||
                  lesson.type === 'shared' ||
                  lesson.type === 'computerized';

                // NEW: Check if class has swap opportunity (for uncovered absences)
                const hasSwapOpportunity = coverage.status === 'absent-uncovered' ?
                  getClassSwapOpportunity(cls.id, period, dayName, lessons, 8).canSwap :
                  false;
                const swapInfo = hasSwapOpportunity ?
                  getClassSwapOpportunity(cls.id, period, dayName, lessons, 8) :
                  null;

                // Debug logging
                if (coverage.status === 'absent-uncovered') {
                  console.log(`[Swap Check] Class: ${cls.name}, Period: ${period}`);
                  console.log(`  Has swap opportunity: ${hasSwapOpportunity}`);
                  if (swapInfo) {
                    console.log(`  Last period: ${swapInfo.lastPeriod}, Type: ${swapInfo.swapType}`);
                  }
                }

                return (
                  <td
                    key={slotKey}
                    onClick={(e) => {
                      // Regular click opens teacher selection popup
                      onLessonClick(lesson, cls.name);
                    }}
                    className={`
                      relative p-1 border cursor-pointer transition-all
                      ${colorScheme.bg} ${colorScheme.border}
                      ${isSelected ? 'ring-2 ring-indigo-500 ring-inset' : ''}
                      ${coverage.status === 'absent-uncovered' ? 'ring-2 ring-rose-500 ring-offset-1' : ''}
                      ${coverage.status === 'absent-covered' ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}
                      hover:shadow-lg hover:scale-105 hover:z-10
                      group
                    `}
                    title={`${lesson.subject} - ${teacher?.name || 'غير معروف'} - حصة ${period}`}
                  >
                    {/* Available Substitutes Badge */}
                    {coverage.status !== 'normal' && (
                      <AvailableSubsBadge count={availableSubsCount} />
                    )}

                    {/* Main Content */}
                    <div className="flex flex-col gap-0.5">
                      {/* Subject with icon */}
                      <div className={`flex items-center gap-1 text-[9px] font-bold ${colorScheme.text}`}>
                        {subjectLabel.icon && (
                          <subjectLabel.icon size={10} className={subjectLabel.color} />
                        )}
                        <span className="truncate">{subjectLabel.text}</span>
                      </div>

                      {/* Teacher name */}
                      <div className="text-[8px] text-gray-700 font-medium truncate">
                        {getTeacherShortName(teacher)}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-0.5">
                        {/* Teacher role badge */}
                        {colorScheme.badge && (
                          <div
                            className={`
                              text-[7px] px-1 py-0.5 rounded font-bold
                              ${colorScheme.badgeBg} ${colorScheme.text}
                            `}
                          >
                            {colorScheme.badge}
                          </div>
                        )}

                        {/* Shared lesson badge */}
                        {isShared && <SharedLessonBadge />}
                      </div>

                      {/* Absence status */}
                      {coverage.status !== 'normal' && (
                        <div
                          className={`
                            text-[8px] font-bold flex items-center gap-1
                            ${coverage.color}
                          `}
                        >
                          <span>{coverage.icon}</span>
                          <span>{coverage.label}</span>
                        </div>
                      )}

                      {/* NEW: Smart Swap Button */}
                      {hasSwapOpportunity && swapInfo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLessonClick(lesson, cls.name);
                          }}
                          className="w-full mt-1 px-1.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-md text-[7px] font-black flex items-center justify-center gap-1 transition-all shadow-sm hover:shadow-md"
                        >
                          <RefreshCw size={9} />
                          <span>تبديل ذكي متاح</span>
                          <span className="bg-white/20 px-1 rounded">حصة {swapInfo.lastPeriod}</span>
                        </button>
                      )}

                      {/* Manual assignments (substitutes) */}
                      {localAssignments.length > 0 && (
                        <div className="space-y-0.5 mt-1 pt-1 border-t border-gray-300">
                          {localAssignments.map(assign => {
                            const substitute = employees.find(e => e.id === assign.teacherId);
                            return (
                              <div
                                key={assign.teacherId}
                                className="text-[7px] bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded font-bold flex items-center gap-1"
                              >
                                <span>↪</span>
                                <span className="truncate">
                                  {getTeacherShortName(substitute)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Auto distribution substitute */}
                      {distributionSlot && !localAssignments.length && (
                        <div className="text-[7px] bg-blue-100 text-blue-900 px-1 py-0.5 rounded font-bold flex items-center gap-1 mt-1">
                          <span>🤖</span>
                          <span className="truncate">{distributionSlot.substituteName}</span>
                        </div>
                      )}
                    </div>

                    {/* Tooltip */}
                    <LessonTooltip
                      lesson={lesson}
                      teacher={teacher}
                      classInfo={{
                        name: cls.name,
                        gradeLevel: cls.gradeLevel
                      }}
                      availableSubstitutes={coverage.status !== 'normal' ? availableSubsCount : undefined}
                      coverage={coverage}
                      teacherWorkload={teacherWorkload}
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default DistributionTable;
