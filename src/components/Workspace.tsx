// src/components/Workspace.tsx
// Refactored from 2073 lines to ~260 lines

import React, { useState, useEffect, useCallback } from 'react';

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
import { toLocalISOString } from '@/utils';
import { getAvailableTeachers } from '@/utils/workspace/getAvailableTeachers';

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

  const workspaceFilters = useWorkspaceFilters({
    lessons,
    employees,
    absences,
    assignments: manualAssignments.assignments,
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
        scheduleConfig: scheduleConfig
      })
    : {
        educatorCandidates: [],
        sharedCandidates: [],
        individualCandidates: [],
        stayCandidates: [],
        availableCandidates: []
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

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div
      className="h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex flex-col"
      dir="rtl"
    >
      <WorkspaceHeader />
      
      <DateNavigator
        viewDate={workspaceView.viewDate}
        onDateChange={workspaceView.setViewDate}
        onToday={workspaceView.goToToday}
        onTomorrow={workspaceView.goToNextDay}
      />

      <div className="flex-1 overflow-hidden flex flex-col py-0.5 gap-1">
        <AbsenceProtocolCard
          isVisible={modals.showAbsenceProtocol}
          onClose={modals.closeAbsenceProtocol}
          activeStage={modals.activeProtocolStage}
          onStageClick={handleAbsenceStageClick}
          poolCount={localPoolIds.length}
        />

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

            <ModeSelectionPanel
              selectedMode={workspaceMode.selectedMode}
              confirmedModes={workspaceMode.confirmedModes}
              onModeToggle={workspaceMode.handleModeToggle}
              onAutoDistribute={distribution.handleAutoDistribute}
            />

            {workspaceMode.selectedMode && <TeacherStatusLegend isVisible={true} />}

            <div className="flex-1 bg-white/70 backdrop-blur-md rounded-l-xl border border-indigo-400 shadow-2xl flex flex-col min-h-0">
              <div className="p-2 border-b border-gray-200 bg-indigo-50/80 backdrop-blur-sm shrink-0">
                <h2 className="text-[10px] font-black text-gray-800">
                  📊 جدول التوزيع التفاعلي
                </h2>
              </div>

              <div className="flex-1 overflow-auto">
                <DistributionTable
                  classes={sortedClasses}
                  periods={periods}
                  lessons={lessons}
                  employees={employees}
                  selectedClasses={workspaceMode.selectedClasses}
                  selectedPeriods={workspaceMode.selectedPeriods}
                  selectedMode={workspaceMode.selectedMode}
                  assignments={manualAssignments.assignments}
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
                onConfirmMode={workspaceMode.handleConfirmMode}
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
        onSelectTeacher={(teacherId, swapWithLast) => {
          if (swapWithLast) {
            // Handle swap logic - teacher will be assigned and can leave early
            manualAssignments.handleSwapWithLast(teacherId, scheduleConfig);
          } else {
            // Regular assignment
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
                addToast('✅ تم الحفظ بنجاح', 'success');
                setShowAbsenceFormModal(false);
              }}
              onCancel={() => setShowAbsenceFormModal(false)}
              onStageSave={(stage, data) => {
                if (stage === 3 && data.poolIds) {
                  setLocalPoolIds(data.poolIds);
                }
                addToast(`✅ تم حفظ المرحلة ${stage}`, 'success');
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
