// src/hooks/workspace/index.ts

export { useWorkspaceView } from './useWorkspaceView';
export type { UseWorkspaceViewReturn } from './useWorkspaceView';

export { useWorkspaceMode } from './useWorkspaceMode';
export type { UseWorkspaceModeReturn } from './useWorkspaceMode';

export { useManualAssignments } from './useManualAssignments';
export type { UseManualAssignmentsReturn } from './useManualAssignments';

export { useDistributionEngine } from './useDistributionEngine';
export type { UseDistributionEngineReturn, DistributionSlot } from './useDistributionEngine';

export { getSlotCandidates } from './useCandidateSelection';
export type { CandidateInfo, CandidateGroups } from './useCandidateSelection';

export { useGapDetection } from './useGapDetection';
export type { UseGapDetectionReturn } from './useGapDetection';

export { useCalendarIntegration } from './useCalendarIntegration';
export type { UseCalendarIntegrationProps, UseCalendarIntegrationReturn } from './useCalendarIntegration';

export { useWorkspaceModals } from './useWorkspaceModals';
export type { UseWorkspaceModalsReturn } from './useWorkspaceModals';

export { useWorkspaceFilters } from './useWorkspaceFilters';
export type { FilterState } from './useWorkspaceFilters';
