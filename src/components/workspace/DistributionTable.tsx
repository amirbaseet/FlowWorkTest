// src/components/workspace/DistributionTable.tsx

import React from 'react';
import { Employee, ClassItem, Lesson, AbsenceRecord, SubstitutionLog, CalendarEvent } from '@/types';
import { normalizeArabic } from '@/utils';

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
  onLessonClick: (lesson: Lesson) => void;
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
  dayName,
  onToggleClass,
  onTogglePeriod,
  onLessonClick
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
                const lesson = findLesson(cls.id, period);
                const cellAssignments = getAssignments(cls.id, period);
                const distributionData = distributionGrid[`${cls.id}-${period}`];
                const isInSelection =
                  selectedMode &&
                  selectedClasses.includes(cls.id) &&
                  selectedPeriods.includes(period);

                return (
                  <td
                    key={`${cls.id}-${period}`}
                    onClick={() => lesson && onLessonClick(lesson)}
                    className={`border border-gray-200 p-1 text-center cursor-pointer hover:bg-indigo-50 transition-colors ${
                      isInSelection ? 'bg-amber-50 ring-2 ring-amber-400' : 'bg-white'
                    }`}
                  >
                    {lesson ? (
                      <div className="flex flex-col gap-1">
                        {/* Original Lesson */}
                        <div className="text-[8px] font-bold text-gray-700">
                          {lesson.subject}
                        </div>
                        <div className="text-[7px] text-gray-500">
                          {employees.find(e => e.id === lesson.teacherId)?.name || '?'}
                        </div>

                        {/* Assignments */}
                        {cellAssignments.length > 0 && (
                          <div className="bg-emerald-100 border border-emerald-300 rounded p-1 text-[7px]">
                            {cellAssignments.map((a, i) => (
                              <div key={i} className="text-emerald-700 font-bold">
                                {employees.find(e => e.id === a.teacherId)?.name || '?'}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Distribution */}
                        {distributionData && (
                          <div className="bg-blue-100 border border-blue-300 rounded p-1 text-[7px] text-blue-700 font-bold">
                            {distributionData.substituteName}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-300 text-[8px]">—</div>
                    )}
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
