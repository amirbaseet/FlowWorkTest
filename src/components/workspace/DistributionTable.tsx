// src/components/workspace/DistributionTable.tsx

import React, { useMemo } from 'react';
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
import { RefreshCw, AlertCircle, GraduationCap, Undo2 } from 'lucide-react';

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
  onUndoClassSwap?: (classId: string, cancelledPeriod: number) => void;
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
  hasActiveFilters,
  onUndoClassSwap
}) => {
  const normDay = normalizeArabic(dayName);

  // Detect active class swaps (CORRECTED: Focus on CLASS ending, not teacher leaving)
  const classSwaps = useMemo(() => {
    const swaps: Record<string, {
      originalPeriod: number;
      swappedPeriod: number;
      teacherId: number;
      teacherName: string;
      classEndPeriod: number; // Period after which CLASS ends (CORRECTED variable name)
    }> = {};

    console.log('🔍 [DistributionTable] Detecting class swaps...', {
      totalAssignments: Object.keys(assignments).length,
      assignments
    });

    // Check all assignments for class-based swaps
    Object.entries(assignments).forEach(([key, assignList]: [string, Array<{ teacherId: number; reason: string }>]) => {
      assignList.forEach(assign => {
        console.log('📝 [DistributionTable] Checking assignment:', { key, reason: assign.reason });
        // Check if reason indicates a class-based swap
        if (assign.reason.includes('تبديل صفي')) {
          console.log('✅ [DistributionTable] Found class swap!');
          // Parse: "بديل مع تبديل صفي - محمد (تغطية حصة 7 بدلاً من 2)"
          const match = assign.reason.match(/تغطية حصة (\d+) بدلاً من (\d+)/);
          if (match) {
            const swappedPeriod = parseInt(match[1]); // 7 (cancelled period)
            const originalPeriod = parseInt(match[2]); // 2 (covered period)
            // FIX: Extract classId properly - everything except the last part (period)
            const parts = key.split('-');
            const periodPart = parts[parts.length - 1]; // Last part is the period
            const classId = parts.slice(0, -1).join('-'); // Everything else is classId
            const teacher = employees.find(e => e.id === assign.teacherId);
            
            console.log('🎓 [DistributionTable] Adding swap:', {
              classId,
              key,
              parts,
              periodPart,
              swappedPeriod,
              originalPeriod,
              classEndPeriod: swappedPeriod - 1
            });
            
            swaps[classId] = {
              originalPeriod,
              swappedPeriod,
              teacherId: assign.teacherId,
              teacherName: teacher?.name || 'معلم',
              classEndPeriod: swappedPeriod - 1 // Class ends BEFORE the cancelled period
            };
          }
        }
      });
    });

    console.log('📊 [DistributionTable] Final classSwaps:', swaps);
    return swaps;
  }, [assignments, employees]);

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
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="overflow-auto flex-1">
        <table className="w-full text-[9px] border-collapse">
          <thead className="sticky top-0 bg-indigo-100 z-20 shadow-sm">
            <tr>
              {/* Class Label (sticky left corner) */}
              <th className="sticky right-0 z-30 bg-indigo-200 border border-indigo-300 p-2 text-[10px] font-black text-indigo-900 w-32">
                الصف
              </th>

          {/* Period Headers */}
          {periods.map(period => {
            const isPeriodSelected = selectedPeriods.includes(period);
            return (
              <th
                key={period}
                className="border border-indigo-300 p-1 min-w-[100px] relative"
              >
                <div className="flex flex-col gap-1 items-center">
                  <div className="text-[10px] font-bold text-indigo-900">
                    <span>حصة {period}</span>
                  </div>
                  {selectedMode && (
                    <button
                      onClick={() => onTogglePeriod(period)}
                      className={`w-full px-2 py-0.5 rounded text-[7px] font-bold transition-all ${
                        isPeriodSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-indigo-50'
                      }`}
                    >
                      {isPeriodSelected ? '✓ محدد' : 'اختيار'}
                    </button>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {classes.map(cls => {
          const isSelected = selectedClasses.includes(cls.id);
          const classSwap = classSwaps[cls.id];
          return (
            <tr key={cls.id} className="border-b border-indigo-200">
              {/* Class Name (sticky left) */}
              <td className="sticky right-0 z-10 bg-indigo-100 border border-indigo-300 p-2 text-center font-black text-indigo-900">
                <div className="flex flex-col items-center gap-1">
                  {/* Early dismissal banner */}
                  {classSwap && (
                    <div className="w-full mb-1">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-1 rounded text-[7px] font-black flex items-center justify-center gap-1 shadow-lg whitespace-nowrap">
                        <GraduationCap size={10} />
                        <span>🎓 ينتهي بعد حصة {classSwap.classEndPeriod}</span>
                      </div>
                    </div>
                  )}
                  <div className="text-[10px] font-bold text-indigo-900 flex flex-wrap items-center justify-center gap-1">
                    <span className="whitespace-nowrap">{cls.name}</span>
                    {classSwap && (
                      <span 
                        className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 text-white rounded text-[6px] font-black shadow-sm animate-pulse whitespace-nowrap"
                        title={`الصف ينتهي بعد حصة ${classSwap.classEndPeriod}`}
                      >
                        <GraduationCap size={8} />
                        <span>مغادرة مبكرة</span>
                      </span>
                    )}
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
              </td>

              {/* Lesson Cells */}
              {periods.map(period => {
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

                // CORRECTED: Check if this period is the cancelled period (due to class swap)
                const classSwap = classSwaps[cls.id];
                const isCancelledPeriod = classSwap && period === classSwap.swappedPeriod;

                // If this is a cancelled period, show cancellation notice (CORRECTED TEXT)
                if (isCancelledPeriod && classSwap) {
                  // Tooltip content
                  const tooltipText = `الحصة ملغاة بسبب التبديل الذكي\nالحصة ${period} تم تبديلها مع حصة ${classSwap.originalPeriod}\n🎓 الصف يغادر مبكراً بعد حصة ${classSwap.classEndPeriod}`;

                  return (
                    <td
                      key={slotKey}
                      className="relative p-1 border bg-amber-50 border-amber-200 cursor-help group"
                      title={tooltipText}
                    >
                      <div className="flex flex-col items-center justify-center gap-1 py-2">
                        <AlertCircle size={16} className="text-amber-600" />
                        <div className="text-[7px] font-black text-amber-800 text-center">
                          ❌ حصة ملغاة
                        </div>
                        <div className="text-[6px] text-amber-700 text-center">
                          مبدلة مع حصة {classSwap.originalPeriod}
                        </div>
                        <div className="text-[6px] text-gray-600 text-center mt-1">
                          {classSwap.teacherName}
                        </div>
                        <div className="text-[6px] font-bold text-emerald-700 text-center mt-1 bg-emerald-100 px-2 py-0.5 rounded">
                          🎓 الصف يغادر مبكراً
                        </div>
                        {/* NEW: Undo Button */}
                        {onUndoClassSwap && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Pass the cancelled period (swappedPeriod), which is the current period
                              onUndoClassSwap(cls.id, period);
                            }}
                            className="mt-2 flex items-center gap-1 px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded text-[7px] font-bold transition-all shadow-sm hover:shadow-md opacity-0 group-hover:opacity-100"
                            title="التراجع عن التبديل"
                          >
                            <Undo2 size={10} />
                            <span>تراجع</span>
                          </button>
                        )}
                      </div>
                    </td>
                  );
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
                            // Check if this is a class-based swap
                            const isClassSwap = assign.reason.includes('تبديل صفي');
                            return (
                              <div key={assign.teacherId} className="space-y-0.5">
                                {/* Substitute name */}
                                <div className="text-[7px] bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded font-bold flex items-center gap-1">
                                  <span>↪</span>
                                  <span className="truncate">
                                    {getTeacherShortName(substitute)}
                                  </span>
                                </div>
                                {/* NEW: Swap Indicator for Class-Based Swaps */}
                                {isClassSwap && (
                                  <div className="flex items-center gap-1 px-1 py-0.5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded text-[6px] font-black text-blue-700">
                                    <RefreshCw size={8} className="text-blue-500" />
                                    <span>🔄 تبديل ذكي</span>
                                  </div>
                                )}
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
      </div>
    </div>
  );
};

export default DistributionTable;
