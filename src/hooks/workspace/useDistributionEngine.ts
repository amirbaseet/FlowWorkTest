// src/hooks/workspace/useDistributionEngine.ts

import { useMemo, useCallback } from 'react';
import { Employee, Lesson, ClassItem, EngineContext, SubstitutionLog } from '@/types';
import { toLocalISOString, normalizeArabic } from '@/utils';
import { applyModeRulesToDistribution, DistributionContext } from '@/utils/policyEngine';

export interface DistributionSlot {
  originalTeacher: number;
  substituteId: number | null;
  substituteName: string;
  score: number;
  reason: string;
  breakdown?: any;
  modes: string[];
  type: 'automatic';
}

export interface UseDistributionEngineReturn {
  grid: Record<string, DistributionSlot>;
  handleAutoDistribute: (templateIndex?: number) => void;
}

export interface UseDistributionEngineProps {
  confirmedModes: Array<{ modeId: string; classes: string[]; periods: number[] }>;
  activeDistributionIndex: number | null;
  showDistribution: boolean;
  engineContext: EngineContext;
  dayName: string;
  lessons: Lesson[];
  employees: Employee[];
  classes: ClassItem[];
  viewDate: Date;
  substitutionLogs: SubstitutionLog[];
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onBulkAssign: (assignments: Array<{
    classId: string;
    period: number;
    teacherId: number;
    reason: string;
  }>) => void;
  setActiveDistributionIndex: (index: number | null) => void;
  setShowDistribution: (show: boolean) => void;
}

export const useDistributionEngine = ({
  confirmedModes,
  activeDistributionIndex,
  showDistribution,
  engineContext,
  dayName,
  lessons,
  employees,
  classes,
  viewDate,
  substitutionLogs,
  addToast,
  onBulkAssign,
  setActiveDistributionIndex,
  setShowDistribution
}: UseDistributionEngineProps): UseDistributionEngineReturn => {

  // Computed: Distribution grid (auto-calculation via useMemo)
  const grid = useMemo(() => {
    if (!showDistribution || confirmedModes.length === 0) return {};

    console.log('=== LIVE DISTRIBUTION RECALCULATION ===');
    console.log('activeDistributionIndex:', activeDistributionIndex);
    
    const normDay = normalizeArabic(dayName);
    const newDistribution: Record<string, DistributionSlot> = {};
    const newAssignments: Array<{
      classId: string;
      period: number;
      teacherId: number;
      reason: string;
    }> = [];

    // Determine which modes to process
    const modesToProcess = activeDistributionIndex !== null
      ? [confirmedModes[activeDistributionIndex]]
      : confirmedModes;

    modesToProcess.forEach(template => {
      if (!template) return;

      const modeConfig = engineContext[template.modeId as keyof EngineContext] as any;
      if (!modeConfig) return;

      console.log('=== MODE CONFIG DEBUG ===');
      console.log('Mode ID:', template.modeId);
      console.log('Mode Name:', modeConfig.name);
      console.log('Golden Rules:', modeConfig.goldenRules?.length || 0);
      console.log('Priority Ladder:', modeConfig.priorityLadder?.length || 0);
      console.log('Conditions:', modeConfig.conditions?.length || 0);
      console.log('========================');

      console.log('Recalculating for mode:', modeConfig.name);

      template.classes.forEach(cls => {
        template.periods.forEach(period => {
          const originalLesson = lessons.find(l =>
            l.classId === cls &&
            l.period === period &&
            normalizeArabic(l.day) === normDay
          );

          console.log(`--- Slot: ${cls} - حصة ${period} ---`);
          console.log('Original Lesson:', originalLesson ? `${originalLesson.subject} - معلم #${originalLesson.teacherId}` : '❌ لا توجد حصة');

          if (!originalLesson) {
            console.log('⚠️ Skipped: No lesson found for this slot');
            return;
          }

          const context: DistributionContext = {
            date: toLocalISOString(viewDate),
            period,
            classId: cls,
            originalTeacherId: originalLesson.teacherId,
            educatorId: employees.find(e =>
              e.addons?.educator &&
              String(e.addons.educatorClassId) === String(cls)
            )?.id,
            modeType: modeConfig.linkedEventType,
            allLessons: lessons,
            allClasses: classes,
            substitutionLogs
          };

          const rankedCandidates = applyModeRulesToDistribution(
            modeConfig,
            employees,
            context
          );

          console.log(`🎯 Candidates found: ${rankedCandidates.length}`);
          if (rankedCandidates.length > 0) {
            console.log('Top 3:');
            rankedCandidates.slice(0, 3).forEach((c, i) => {
              console.log(`  ${i + 1}. ${c.employee.name} - Score: ${c.score} - ${c.reason}`);
            });
          }

          const best = rankedCandidates[0];
          const slotKey = `${cls}-${period}`;

          if (best && best.score > 0) {
            console.log(`✅ Selected: ${best.employee.name} (Score: ${best.score})`);
            newDistribution[slotKey] = {
              originalTeacher: originalLesson.teacherId,
              substituteId: best.employee.id,
              substituteName: best.employee.name,
              score: best.score,
              reason: best.reason,
              breakdown: best.breakdown,
              modes: [modeConfig.id],
              type: 'automatic'
            };

            // Add to assignments for bulk assign
            newAssignments.push({
              classId: cls,
              period,
              teacherId: best.employee.id,
              reason: best.reason
            });
          } else {
            console.log('❌ No suitable candidate found (score = 0 or no candidates)');
            newDistribution[slotKey] = {
              originalTeacher: originalLesson.teacherId,
              substituteId: null,
              substituteName: 'لا يوجد بديل',
              score: 0,
              reason: 'لا يوجد مرشح مناسب',
              modes: [modeConfig.id],
              type: 'automatic'
            };
          }
        });
      });
    });

    // Auto-assign if we have new assignments
    if (newAssignments.length > 0) {
      onBulkAssign(newAssignments);
    }

    console.log(`✅ Live distribution: ${Object.keys(newDistribution).length} slots`);
    return newDistribution;
  }, [
    showDistribution,
    confirmedModes,
    activeDistributionIndex,
    engineContext,
    dayName,
    lessons,
    employees,
    classes,
    viewDate,
    substitutionLogs,
    onBulkAssign
  ]);

  // Handler: Auto distribute
  const handleAutoDistribute = useCallback((templateIndex?: number) => {
    if (confirmedModes.length === 0) {
      addToast('⚠️ يرجى تثبيت نمط أولاً', 'warning');
      return;
    }

    // Set which mode(s) to distribute
    if (templateIndex !== undefined) {
      setActiveDistributionIndex(templateIndex);
    } else {
      setActiveDistributionIndex(null); // null = all modes
    }

    // Trigger recalculation by toggling showDistribution
    setShowDistribution(true);

    // If templateIndex provided, distribute only for that mode
    if (templateIndex !== undefined) {
      const template = confirmedModes[templateIndex];
      if (!template) return;

      const modeInfo = [
        { id: 'examMode', name: 'امتحانات' },
        { id: 'normalMode', name: 'نشاط' },
        { id: 'tripMode', name: 'رحلة' },
        { id: 'rainyMode', name: 'مطر' },
        { id: 'emergencyMode', name: 'طوارئ' },
        { id: 'holidayMode', name: 'عطلة' },
      ].find(m => m.id === template.modeId);

      addToast(`⚙️ جاري التوزيع لـ ${modeInfo?.name || 'نمط'}...`, 'info');
    } else {
      addToast('⚙️ جاري التوزيع الآلي...', 'info');
    }
  }, [confirmedModes, addToast, setActiveDistributionIndex, setShowDistribution]);

  return {
    grid,
    handleAutoDistribute
  };
};
