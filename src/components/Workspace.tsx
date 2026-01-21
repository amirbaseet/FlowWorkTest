// src/components/Workspace.tsx
// Refactored from 2073 lines to ~260 lines

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Atomic Hooks
import { useLessons } from '@/hooks/useLessons';
import { useSubstitutions } from '@/hooks/useSubstitutions';
import { useAbsences } from '@/hooks/useAbsences';
import { useCoverage } from '@/hooks/useCoverage';
import { useToast } from '@/contexts/ToastContext';

// Workspace Hooks
import {
  useWorkspaceView,
  useWorkspaceMode,
  useManualAssignments,
  useDistributionEngine,
  getSlotCandidates,
  useGapDetection,
  useCalendarIntegration,
  useWorkspaceModals,
  useWorkspaceFilters
} from '@/hooks/workspace';

// UI Components
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader';
import DateNavigator from '@/components/workspace/DateNavigator';
import AbsenceProtocolCard from '@/components/workspace/AbsenceProtocolCard';
import FilterBar from '@/components/workspace/FilterBar';
import FilterSummary from '@/components/workspace/FilterSummary';
import ModeSelectionPanel from '@/components/workspace/ModeSelectionPanel';
import TeacherStatusLegend from '@/components/workspace/TeacherStatusLegend';
import DistributionTable from '@/components/workspace/DistributionTable';
import ActionBar from '@/components/workspace/ActionBar';
import HolidayDisplay from '@/components/workspace/HolidayDisplay';
import AvailableTeachersPopup from '@/components/workspace/AvailableTeachersPopup';
import { UndoRedoToolbar } from '@/components/workspace/UndoRedoToolbar';

// Other Components
import AbsenceForm from './AbsenceForm';

// Types
import {
  Employee,
  ClassItem,
  ScheduleConfig,
  EngineContext,
  CalendarEvent
} from '@/types';

// Utils
import { toLocalISOString, normalizeArabic } from '@/utils';
import { getAvailableTeachers } from '@/utils/workspace/getAvailableTeachers';
import { useActionHistory } from '@/hooks/useActionHistory';

interface WorkspaceProps {
  employees: Employee[];
  classes: ClassItem[];
  scheduleConfig: ScheduleConfig;
  engineContext: EngineContext;
  events?: CalendarEvent[];
  setEvents?: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
}

const Workspace: React.FC<WorkspaceProps> = ({
  employees,
  classes: classesData,
  scheduleConfig,
  engineContext,
  events = [],
  setEvents
}) => {
  // ==========================================================================
  // ATOMIC HOOKS
  // ==========================================================================
  const { addToast } = useToast();
  const { lessons } = useLessons();
  const { substitutionLogs, setSubstitutionLogs } = useSubstitutions();
  const { absences, setAbsences } = useAbsences();
  const { dailyPools } = useCoverage();

  // ==========================================================================
  // ACTION HISTORY (UNDO/REDO)
  // ==========================================================================
  const actionHistory = useActionHistory(addToast);

  // ==========================================================================
  // WORKSPACE CUSTOM HOOKS
  // ==========================================================================
  const workspaceView = useWorkspaceView({ lessons, events, scheduleConfig });
  
  const workspaceMode = useWorkspaceMode({
    scheduleConfig,
    engineContext,
    addToast
  });
  
  const manualAssignments = useManualAssignments({
    employees,
    lessons,
    viewDate: workspaceView.viewDate,
    dayName: workspaceView.selectedDay,
    absences,
    setAbsences,
    substitutionLogs,
    setSubstitutionLogs,
    addToast
  });
  
  const distribution = useDistributionEngine({
    confirmedModes: workspaceMode.confirmedModes,
    activeDistributionIndex: workspaceMode.activeDistributionIndex,
    showDistribution: workspaceMode.showDistribution,
    engineContext,
    dayName: workspaceView.selectedDay,
    lessons,
    employees,
    classes: classesData,
    viewDate: workspaceView.viewDate,
    substitutionLogs,
    addToast,
    onBulkAssign: manualAssignments.handleBulkAssign,
    setActiveDistributionIndex: workspaceMode.setActiveDistributionIndex,
    setShowDistribution: workspaceMode.setShowDistribution
  });
  
  const { impactedSlots, gapCount } = useGapDetection({
    showDistribution: workspaceMode.showDistribution,
    assignments: manualAssignments.assignments,
    confirmedModes: workspaceMode.confirmedModes,
    lessons,
    classes: classesData,
    employees,
    dayName: workspaceView.selectedDay
  });
  
  const calendar = useCalendarIntegration({
    confirmedModes: workspaceMode.confirmedModes,
    assignments: manualAssignments.assignments,
    viewDate: workspaceView.viewDate,
    employees,
    setEvents,
    setSubstitutionLogs,
    addToast,
    onSuccess: () => {
      workspaceMode.setShowDistribution(false);
      workspaceMode.clearSelections();
      modals.closeSaveModal();
    }
  });
  
  const modals = useWorkspaceModals();

  // Build assignments from substitutionLogs for current date
  const currentDateAssignments = useMemo(() => {
    const dateStr = toLocalISOString(workspaceView.viewDate);
    const normDay = normalizeArabic(workspaceView.selectedDay);
    const result: Record<string, Array<{ teacherId: number; reason: string }>> = {};

    console.log('🔄 [Workspace] Building currentDateAssignments', {
      dateStr,
      normDay,
      totalLogs: substitutionLogs.length,
      manualAssignmentsCount: Object.keys(manualAssignments.assignments).length
    });

    // Get substitution logs for current date
    const todayLogs = substitutionLogs.filter(log => log.date === dateStr);
    
    console.log('📊 [Workspace] Today logs:', todayLogs.length);
    
    todayLogs.forEach(log => {
      const key = `${log.classId}-${log.period}`;
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push({
        teacherId: log.substituteId,
        reason: log.reason || ''
      });
    });

    // Merge with manual assignments from hook
    Object.entries(manualAssignments.assignments).forEach(([key, assigns]) => {
      if (!result[key]) {
        result[key] = [];
      }
      assigns.forEach(assign => {
        // Only add if not already in the list
        if (!result[key].some(a => a.teacherId === assign.teacherId)) {
          result[key].push(assign);
        }
      });
    });

    console.log(' [Workspace] Final currentDateAssignments:', {
      totalSlots: Object.keys(result).length,
      assignments: result
    });

    return result;
  }, [substitutionLogs, manualAssignments.assignments, workspaceView.viewDate, workspaceView.selectedDay]);

  const workspaceFilters = useWorkspaceFilters({
    lessons,
    employees,
    absences,
    assignments: currentDateAssignments,
    substitutionLogs,
    viewDate: workspaceView.viewDate,
    dayName: workspaceView.selectedDay
  });

  // ==========================================================================
  // LOCAL STATE
  // ==========================================================================
  const [localPoolIds, setLocalPoolIds] = useState<number[]>([]);
  const [sortedClasses, setSortedClasses] = useState<ClassItem[]>([]);
  const [periods, setPeriods] = useState<number[]>([]);
  const [saveForm, setSaveForm] = useState({ title: '', description: '' });
  const [showAbsenceFormModal, setShowAbsenceFormModal] = useState(false);
  const [showEarlyDismissalSummary, setShowEarlyDismissalSummary] = useState(true);
  const [showAbsenceProtocol, setShowAbsenceProtocol] = useState(true);
  const [showModeSelection, setShowModeSelection] = useState(true);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================
  useEffect(() => {
    const dateStr = toLocalISOString(workspaceView.viewDate);
    const todayPool = dailyPools.find(p => p.date === dateStr);
    setLocalPoolIds(todayPool ? todayPool.teachers.map(t => t.teacherId) : []);
  }, [dailyPools, workspaceView.viewDate]);

  useEffect(() => {
    const sorted = [...classesData].sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
      return a.name.localeCompare(b.name, 'ar');
    });
    setSortedClasses(sorted);
  }, [classesData]);

  useEffect(() => {
    const p = Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1);
    setPeriods(p);
  }, [scheduleConfig.periodsPerDay]);

  useEffect(() => {
    const closeMenu = () => modals.closeContextMenu();
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [modals]);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================
  const availableTeachers = manualAssignments.selectedLesson
    ? getAvailableTeachers({
        period: manualAssignments.selectedLesson.period,
        classId: manualAssignments.selectedLesson.classId,
        day: manualAssignments.selectedLesson.day,
        employees,
        lessons,
        absentTeacherIds: absences
          .filter(a => a.date === toLocalISOString(workspaceView.viewDate))
          .map(a => a.teacherId),
        alreadyAssignedIds: substitutionLogs
          .filter(
            s =>
              s.date === toLocalISOString(workspaceView.viewDate) &&
              s.period === manualAssignments.selectedLesson!.period
          )
          .map(s => s.substituteId),
        scheduleConfig: scheduleConfig,
        reservePoolIds: localPoolIds //  NEW: Pass reserve pool IDs
      })
    : {
        educatorCandidates: [],
        sharedCandidates: [],
        individualCandidates: [],
        stayCandidates: [],
        availableCandidates: [],
        onCallCandidates: [] //  NEW: Include onCallCandidates in fallback
      };

  const slotCandidates = manualAssignments.activeSlot
    ? getSlotCandidates(
        manualAssignments.activeSlot.classId,
        manualAssignments.activeSlot.period,
        workspaceView.selectedDay,
        employees,
        lessons,
        manualAssignments.assignments,
        localPoolIds
      )
    : { poolCandidates: [], educatorCandidates: [], supportCandidates: [] };

  // Detect classes with early dismissal due to smart swaps
  const earlyDismissalClasses = useMemo(() => {
    const dateStr = toLocalISOString(workspaceView.viewDate);
    const normDay = normalizeArabic(workspaceView.selectedDay);
    const result: Array<{
      classId: string;
      className: string;
      classEndPeriod: number;
      cancelledPeriod: number;
      teacherName: string;
    }> = [];

    console.log('🔍 Checking for early dismissals...', {
      totalAssignments: Object.keys(currentDateAssignments).length,
      assignments: currentDateAssignments
    });

    Object.entries(currentDateAssignments).forEach(
      ([key, assignList]: [string, Array<{ teacherId: number; reason: string }>]) => {
        assignList.forEach(assign => {
          console.log('📝 Assignment reason:', assign.reason);
          if (assign.reason.includes('تبديل صفي')) {
            console.log(' Found class swap!');
            const match = assign.reason.match(/تغطية حصة (\d+) بدلاً من (\d+)/);
            if (match) {
              const swappedPeriod = parseInt(match[1]);
              const originalPeriod = parseInt(match[2]);
              // FIX: Extract classId properly - everything except the last part (period)
              const parts = key.split('-');
              const periodPart = parts[parts.length - 1]; // Last part is the period
              const classId = parts.slice(0, -1).join('-'); // Everything else is classId

              // Only add if this key matches the LAST PERIOD (where assignment was made)
              if (parseInt(periodPart) === swappedPeriod) {
                const cls = classesData.find(c => c.id === classId);
                const teacher = employees.find(e => e.id === assign.teacherId);
                if (cls && teacher) {
                  console.log('🎓 Adding early dismissal:', {
                    className: cls.name,
                    classEndPeriod: swappedPeriod - 1,
                    cancelledPeriod: swappedPeriod,
                    originalPeriod: originalPeriod
                  });
                  result.push({
                    classId,
                    className: cls.name,
                    classEndPeriod: swappedPeriod - 1,
                    cancelledPeriod: swappedPeriod,
                    teacherName: teacher.name
                  });
                }
              }
            }
          }
        });
      }
    );

    console.log('📊 Early dismissal classes:', result);
    return result;
  }, [currentDateAssignments, classesData, employees, workspaceView.viewDate, workspaceView.selectedDay]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handlePoolUpdate = useCallback((poolIds: number[]) => {
    setLocalPoolIds(poolIds);
  }, []);

  const handleReset = () => {
    workspaceMode.setShowDistribution(false);
    workspaceMode.clearSelections();
  };

  const handleAbsenceStageClick = (stage: 1 | 2 | 3 | 6) => {
    modals.openAbsenceForm(stage);
    setShowAbsenceFormModal(true);
  };

  const handleUndoClassSwap = useCallback((classId: string, cancelledPeriod: number) => {
    console.log('🔄 [Undo] Starting undo for class swap:', { classId, cancelledPeriod });
    
    const dateStr = toLocalISOString(workspaceView.viewDate);
    
    // Find the substitution log entry for this swap
    const swapLog = substitutionLogs.find(log => 
      log.classId === classId &&
      log.period === cancelledPeriod &&
      log.date === dateStr &&
      log.reason && log.reason.includes('تبديل صفي')
    );
    
    console.log('🔍 [Undo] Looking for swap log:', swapLog);
    
    if (!swapLog) {
      console.error('❌ [Undo] No swap log found');
      addToast('❌ لم يتم العثور على التبديل', 'error');
      return;
    }

    console.log(' [Undo] Found swap log, removing:', swapLog);
    
    // 1. Remove from substitutionLogs (persistent storage)
    if (setSubstitutionLogs) {
      setSubstitutionLogs(prev => prev.filter(log => log.id !== swapLog.id));
      console.log(' [Undo] Removed from substitutionLogs');
    }
    
    // 2. Remove from manual assignments (in-memory)
    const key = `${classId}-${cancelledPeriod}`;
    const assignmentsForKey = manualAssignments.assignments[key];
    if (assignmentsForKey) {
      const swapAssignment = assignmentsForKey.find(a => a.reason.includes('تبديل صفي'));
      if (swapAssignment) {
        manualAssignments.handleRemove(classId, cancelledPeriod, swapAssignment.teacherId);
        console.log(' [Undo] Removed from manual assignments');
      }
    }
    
    // 3. Update absence record - remove the cancelled period from affected periods
    if (setAbsences && swapLog.absentTeacherId) {
      setAbsences(prev => prev.map(absence => {
        if (
          absence.teacherId === swapLog.absentTeacherId &&
          absence.date === dateStr &&
          absence.type === 'PARTIAL' &&
          absence.affectedPeriods?.includes(cancelledPeriod)
        ) {
          const updatedPeriods = absence.affectedPeriods.filter(p => p !== cancelledPeriod);
          console.log(' [Undo] Updated absence periods:', { before: absence.affectedPeriods, after: updatedPeriods });
          
          // If no periods left, we could remove the absence entirely
          if (updatedPeriods.length === 0) {
            // Return null to signal removal (we'll filter it out below)
            return null as any;
          }
          
          return {
            ...absence,
            affectedPeriods: updatedPeriods,
            updatedAt: new Date().toISOString()
          };
        }
        return absence;
      }).filter(Boolean)); // Remove null entries
    }
    
    addToast(' تم التراجع عن التبديل بنجاح', 'success');
    console.log(' [Undo] Undo completed successfully');
  }, [workspaceView.viewDate, substitutionLogs, setSubstitutionLogs, manualAssignments, setAbsences, addToast]);

  // ==========================================================================
  // UNDO/REDO HANDLERS
  // ==========================================================================
  const handleUndo = useCallback(() => {
    const action = actionHistory.undo();
    if (!action) return;

    console.log('↶ [Workspace] Processing undo:', action.type);

    // Restore state based on action type
    switch (action.type) {
      case 'CONFIRM_MODE':
        // Restore previous confirmed modes state
        if (action.beforeState.confirmedModes) {
          workspaceMode.setConfirmedModes(action.beforeState.confirmedModes);
        }
        break;
      
      case 'REMOVE_MODE':
        // Restore the removed mode
        if (action.afterState.confirmedModes) {
          workspaceMode.setConfirmedModes(action.afterState.confirmedModes);
        }
        break;

      default:
        console.warn('[Workspace] Unknown action type for undo:', action.type);
    }

    // Reset flag after state updates complete
    setTimeout(() => actionHistory.resetUndoingFlag(), 0);
  }, [actionHistory, workspaceMode]);

  const handleRedo = useCallback(() => {
    const action = actionHistory.redo();
    if (!action) return;

    console.log('↷ [Workspace] Processing redo:', action.type);

    // Restore state based on action type
    switch (action.type) {
      case 'CONFIRM_MODE':
        // Reapply the mode confirmation
        if (action.afterState.confirmedModes) {
          workspaceMode.setConfirmedModes(action.afterState.confirmedModes);
        }
        break;
      
      case 'REMOVE_MODE':
        // Re-remove the mode
        if (action.beforeState.confirmedModes) {
          workspaceMode.setConfirmedModes(action.beforeState.confirmedModes);
        }
        break;

      default:
        console.warn('[Workspace] Unknown action type for redo:', action.type);
    }

    // Reset flag after state updates complete
    setTimeout(() => actionHistory.resetUndoingFlag(), 0);
  }, [actionHistory, workspaceMode]);

  // Wrap mode confirmation to record action
  const handleConfirmModeWithHistory = useCallback(() => {
    const beforeState = {
      confirmedModes: [...workspaceMode.confirmedModes]
    };

    const modeToConfirm = workspaceMode.selectedMode;
    const classCount = workspaceMode.selectedClasses.length;
    const periodCount = workspaceMode.selectedPeriods.length;

    // Call original handler
    workspaceMode.handleConfirmMode();

    // Record action after state change (with small delay to capture new state)
    setTimeout(() => {
      const afterState = {
        confirmedModes: [...workspaceMode.confirmedModes]
      };

      actionHistory.recordAction({
        type: 'CONFIRM_MODE',
        description: `تثبيت نمط: ${modeToConfirm}`,
        beforeState,
        afterState,
        metadata: {
          modeId: modeToConfirm,
          classCount,
          periodCount
        }
      });

      console.log('✅ [Workspace] Action recorded:', {
        type: 'CONFIRM_MODE',
        modeId: modeToConfirm,
        before: beforeState.confirmedModes.length,
        after: afterState.confirmedModes.length
      });
    }, 150);
  }, [workspaceMode, actionHistory]);

  // Wrap remove mode to record action
  const handleRemoveModeWithHistory = useCallback((index: number) => {
    const beforeState = {
      confirmedModes: workspaceMode.confirmedModes
    };

    const removedMode = workspaceMode.confirmedModes[index];

    // Call original handler
    workspaceMode.removeConfirmedMode(index);

    // Record action
    setTimeout(() => {
      actionHistory.recordAction({
        type: 'REMOVE_MODE',
        description: `إزالة نمط: ${removedMode.modeId}`,
        beforeState,
        afterState: {
          confirmedModes: workspaceMode.confirmedModes
        },
        metadata: {
          modeId: removedMode.modeId,
          index
        }
      });
    }, 100);
  }, [workspaceMode, actionHistory]);

  // ==========================================================================
  // KEYBOARD SHORTCUTS
  // ==========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+Y or Cmd+Y: Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div
      className="h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex flex-col"
      dir="rtl"
    >
      <WorkspaceHeader />
      
      {/* Undo/Redo Toolbar */}
      <UndoRedoToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={actionHistory.canUndo}
        canRedo={actionHistory.canRedo}
        undoCount={actionHistory.undoCount}
        redoCount={actionHistory.redoCount}
      />
      
      <DateNavigator
        viewDate={workspaceView.viewDate}
        onDateChange={workspaceView.setViewDate}
        onToday={workspaceView.goToToday}
        onTomorrow={workspaceView.goToNextDay}
      />

      <div className="flex-1 overflow-hidden flex flex-col py-0.5 gap-1">
        {/* Toggle Button for Absence Protocol */}
        <div className="mx-2">
          <button
            onClick={() => setShowAbsenceProtocol(!showAbsenceProtocol)}
            className="w-full px-3 py-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 border border-purple-300 rounded-lg shadow-sm transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-purple-800 flex items-center gap-1">
                <span className="text-base">📋</span>
                <span>بروتوكول توثيق الغياب</span>
                {localPoolIds.length > 0 && (
                  <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-black">
                    {localPoolIds.length}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1 text-purple-700">
              <span className="text-[9px] font-bold">
                {showAbsenceProtocol ? 'إخفاء' : 'إظهار'}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${
                  showAbsenceProtocol ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </div>

        {showAbsenceProtocol && (
          <AbsenceProtocolCard
            isVisible={modals.showAbsenceProtocol}
            onClose={modals.closeAbsenceProtocol}
            activeStage={modals.activeProtocolStage}
            onStageClick={handleAbsenceStageClick}
            poolCount={localPoolIds.length}
          />
        )}

        {!workspaceView.isSchoolDay.isSchool ? (
          <HolidayDisplay
            reason={workspaceView.isSchoolDay.reason}
            onToday={workspaceView.goToToday}
            onNextDay={workspaceView.goToNextDay}
          />
        ) : (
          <>
            <FilterBar
              employees={employees}
              onSearchChange={(teacherId) => {
                workspaceFilters.setFilters({
                  ...workspaceFilters.filters,
                  searchTeacherId: teacherId
                });
              }}
              onFilterChange={workspaceFilters.setFilters}
              currentFilters={workspaceFilters.filters}
            />

            {workspaceFilters.hasActiveFilters && (
              <FilterSummary
                filters={workspaceFilters.filters}
                resultCount={workspaceFilters.filteredLessons.length}
                teacherName={
                  workspaceFilters.filters.searchTeacherId !== null
                    ? employees.find(e => e.id === workspaceFilters.filters.searchTeacherId)?.name
                    : undefined
                }
                onClear={() => {
                  workspaceFilters.setFilters({
                    showAbsencesOnly: false,
                    showCoveredOnly: false,
                    showUncoveredOnly: false,
                    searchTeacherId: null
                  });
                }}
              />
            )}

            {/* NEW: Early Dismissal Summary Box */}
            {earlyDismissalClasses.length > 0 && (
              <div className="mx-2 mb-2">
                {/* Toggle Button */}
                <button
                  onClick={() => setShowEarlyDismissalSummary(!showEarlyDismissalSummary)}
                  className="w-full mb-1 px-3 py-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 hover:from-emerald-200 hover:to-teal-200 border border-emerald-300 rounded-lg shadow-sm transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-emerald-800 flex items-center gap-1">
                      <span className="text-base">🎓</span>
                      <span>صندوق المغادرة المبكرة</span>
                      <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-black">
                        {earlyDismissalClasses.length}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-700">
                    <span className="text-[9px] font-bold">
                      {showEarlyDismissalSummary ? 'إخفاء' : 'إظهار'}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${
                        showEarlyDismissalSummary ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Summary Content */}
                {showEarlyDismissalSummary && (
                  <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-xl shadow-md animate-in slide-in-from-top duration-200">
                    <div className="flex flex-wrap gap-2">
                      {earlyDismissalClasses.map((item, idx) => (
                        <div
                          key={`${item.classId}-${idx}`}
                          className="flex items-center gap-2 px-2 py-1.5 bg-white border border-emerald-200 rounded-lg shadow-sm"
                        >
                          <span className="text-[10px] font-black text-emerald-900">{item.className}</span>
                          <span className="text-emerald-500 text-[9px]">→</span>
                          <span className="text-[9px] font-bold text-emerald-700">
                            ينتهي بعد حصة {item.classEndPeriod}
                          </span>
                          <span className="text-[8px] text-gray-500 italic">
                            (الحصة {item.cancelledPeriod} ملغاة)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Toggle Button for Mode Selection */}
            <div className="mx-2">
              <button
                onClick={() => setShowModeSelection(!showModeSelection)}
                className="w-full px-3 py-1.5 bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 border border-blue-300 rounded-lg shadow-sm transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-blue-800 flex items-center gap-1">
                    <span className="text-base">🎯</span>
                    <span>اختر النمط</span>
                    {workspaceMode.confirmedModes.length > 0 && (
                      <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-black">
                        {workspaceMode.confirmedModes.length}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-blue-700">
                  <span className="text-[9px] font-bold">
                    {showModeSelection ? 'إخفاء' : 'إظهار'}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      showModeSelection ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
            </div>

            {showModeSelection && (
              <ModeSelectionPanel
                selectedMode={workspaceMode.selectedMode}
                confirmedModes={workspaceMode.confirmedModes}
                onModeToggle={workspaceMode.handleModeToggle}
                onAutoDistribute={distribution.handleAutoDistribute}
              />
            )}

            {workspaceMode.selectedMode && <TeacherStatusLegend isVisible={true} />}

            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-l-xl border border-indigo-400 shadow-2xl flex flex-col min-h-0">
              {/* Enhanced Table Header */}
              <div className="p-3 border-b-2 border-indigo-300 bg-gradient-to-r from-indigo-100 via-blue-100 to-purple-100 backdrop-blur-sm shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-[13px] font-black text-indigo-900">
                        📊 جدول التوزيع التفاعلي
                      </h2>
                      <p className="text-[9px] text-indigo-600 font-medium flex items-center gap-1">
                        <span>عرض شامل لجدول الحصص والغيابات</span>
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[7px] font-bold">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>مرر فوق التعيين للتراجع</span>
                        </span>
                      </p>
                    </div>
                  </div>
                  {/* Status indicators */}
                  <div className="flex items-center gap-2">
                    {/* Auto-save indicator */}
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-[9px] font-bold shadow-sm border border-green-300">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>حفظ تلقائي</span>
                    </div>
                    {workspaceMode.confirmedModes.length > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded-lg text-[9px] font-bold shadow-sm">
                        <span>🎯</span>
                        <span>{workspaceMode.confirmedModes.length} نمط مفعّل</span>
                      </div>
                    )}
                    {earlyDismissalClasses.length > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-bold shadow-sm">
                        <span>🎓</span>
                        <span>{earlyDismissalClasses.length} مغادرة مبكرة</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <DistributionTable
                  classes={sortedClasses}
                  periods={periods}
                  lessons={lessons}
                  employees={employees}
                  selectedClasses={workspaceMode.selectedClasses}
                  selectedPeriods={workspaceMode.selectedPeriods}
                  selectedMode={workspaceMode.selectedMode}
                  assignments={currentDateAssignments}
                  distributionGrid={distribution.grid}
                  absences={absences}
                  substitutionLogs={substitutionLogs}
                  events={events}
                  viewDate={workspaceView.viewDate}
                  dayName={workspaceView.selectedDay}
                  onToggleClass={workspaceMode.toggleClass}
                  onTogglePeriod={workspaceMode.togglePeriod}
                  onLessonClick={manualAssignments.handleLessonClick}
                  isSlotVisible={workspaceFilters.isSlotVisible}
                  hasActiveFilters={workspaceFilters.hasActiveFilters}
                  onUndoClassSwap={handleUndoClassSwap}
                  onRemoveAssignment={manualAssignments.handleRemove}
                />
              </div>

              <ActionBar
                selectedClassesCount={workspaceMode.selectedClasses.length}
                selectedPeriodsCount={workspaceMode.selectedPeriods.length}
                confirmedModes={workspaceMode.confirmedModes}
                engineContext={engineContext}
                selectedMode={workspaceMode.selectedMode}
                canConfirm={workspaceMode.canConfirm}
                showDistribution={workspaceMode.showDistribution}
                onConfirmMode={handleConfirmModeWithHistory}
                onSaveToCalendar={modals.openSaveModal}
                onReset={handleReset}
              />
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      <AvailableTeachersPopup
        isOpen={manualAssignments.isPopupOpen}
        onClose={manualAssignments.closePopup}
        lesson={
          manualAssignments.selectedLesson || {
            period: 0,
            classId: '',
            className: '',
            subject: ''
          }
        }
        availableTeachers={availableTeachers}
        activeExternalIds={localPoolIds} //  NEW: Pass reserve pool IDs
        employees={employees} //  NEW: Pass employees for lookup
        onSelectTeacher={(teacherId, swapWithLast, swapType, classSwapInfo) => {
          if (swapType === 'substitute-based' && swapWithLast) {
            // Handle substitute-based swap - teacher swaps their own lessons
            manualAssignments.handleSwapWithLast(teacherId, scheduleConfig);
          } else if (swapType === 'class-based' && classSwapInfo) {
            // Handle class-based swap - swap absence with class's last period
            manualAssignments.handleClassBasedSwap(teacherId, classSwapInfo);
          } else {
            // Regular assignment (no swap)
            manualAssignments.handleSelectTeacher(teacherId);
          }
        }}
      />

      {modals.showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl shadow-2xl w-[500px] p-6">
            <h3 className="text-xl font-black text-gray-800 mb-4">
              💾 حفظ في الرزنامة
            </h3>
            <input
              type="text"
              placeholder="عنوان الفعالية"
              value={saveForm.title}
              onChange={e => setSaveForm({ ...saveForm, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
            />
            <textarea
              placeholder="وصف (اختياري)"
              value={saveForm.description}
              onChange={e => setSaveForm({ ...saveForm, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 h-24"
            />
            <div className="flex gap-3">
              <button
                onClick={() => calendar.handleSaveToCalendar(saveForm.title, saveForm.description)}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
              >
                حفظ
              </button>
              <button
                onClick={modals.closeSaveModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbsenceFormModal && modals.activeProtocolStage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] h-[95vh] max-w-6xl overflow-hidden flex flex-col">
            <AbsenceForm
              employees={employees}
              classes={classesData}
              lessons={lessons}
              scheduleConfig={scheduleConfig}
              date={toLocalISOString(workspaceView.viewDate)}
              dayOfWeek={workspaceView.selectedDay}
              engineContext={engineContext}
              existingAbsences={absences}
              substitutionLogs={substitutionLogs}
              events={events}
              preSelectedPool={localPoolIds}
              onPoolUpdate={handlePoolUpdate}
              initialStep={modals.activeProtocolStage}
              singleStageMode={true}
              onSave={(newAbsences, newSubs) => {
                if (setAbsences && setSubstitutionLogs) {
                  setAbsences(prev => [
                    ...prev,
                    ...newAbsences.map((a, i) => ({ ...a, id: Date.now() + i }))
                  ]);
                  setSubstitutionLogs(prev => [
                    ...prev,
                    ...newSubs.map((s, i) => ({
                      ...s,
                      id: `log-${Date.now()}-${i}`,
                      timestamp: Date.now()
                    }))
                  ]);
                }
                addToast(' تم الحفظ بنجاح', 'success');
                setShowAbsenceFormModal(false);
              }}
              onCancel={() => setShowAbsenceFormModal(false)}
              onStageSave={(stage, data) => {
                if (stage === 3 && data.poolIds) {
                  setLocalPoolIds(data.poolIds);
                }
                addToast(` تم حفظ المرحلة ${stage}`, 'success');
                setShowAbsenceFormModal(false);
              }}
              onOpenRequestForm={() => {
                addToast('📅 طلب إضافة فعالية', 'info');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Workspace;
