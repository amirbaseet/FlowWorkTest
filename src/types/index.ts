
import { GoldenRuleV2, PriorityStepV2, ModeSettings } from './policy';

export type ViewState = 'dashboard' | 'employees' | 'schedule' | 'substitutions' | 'reports' | 'calendar' | 'partner-portal' | 'ai-assistant' | 'settings' | 'calendar-request' | 'bulletin-board' | 'workspace' | 'duty-management' | 'duty-reports';

export type EnforcementLevel = 'STRICT' | 'FLEXIBLE' | 'EMERGENCY_ONLY' | 'SOFT';

export type LessonType = 'actual' | 'stay' | 'individual' | 'duty';

export interface Employee {
  id: number;
  name: string;
  nationalId: string;
  baseRoleId: string;
  phoneNumber?: string;
  contractedHours: number;
  workload: {
    actual: number;
    individual: number;
    stay: number;
  };
  addons: {
    educator: boolean;
    educatorClassId?: string;
    assistantClassId?: string; // For classroom assistants
    coordinators: string[]; // Deprecate in favor of coordinatorRoles? Or keep for backward compat?
    // We will keep it for now but populate it consistently, OR switch to new field.
    // Plan says "Deprecate coordinators: string[]".
    // Let's make it optional or keep it synced. To avoid breaking everything immediately, 
    // I will add the new field and we can sync them or just use the new one.
    // Actually, safer to keep `coordinators` as a derived simple list for legacy checks, 
    // and `coordinatorDetails` for the new rich structure.
    coordinatorRoles?: CoordinatorRole[];
  };
  constraints: {
    cannotCoverAlone: boolean;
    isExternal: boolean;
    isHalfTime?: boolean; // نصف نصاب
  };
  dutySettings?: {
    employmentRatio: 'full' | 'partial'; // نسبة الوظيفة: كامل / جزئي
    fullDutyDay?: string; // اليوم المحدد للمناوبة الكاملة
    halfDutyDay?: string; // اليوم المحدد لنصف نوبة
    exemptFromDuty: boolean; // معفي من المناوبة
  };
  subjects: string[];
}

export interface ClassItem {
  id: string;
  name: string;
  gradeLevel: number;
  type: 'general' | 'special';
  requiresAssistant: boolean;
}

export interface CoordinatorRole {
  id: string; // UUID
  typeId: string; // matches COORDINATOR_TYPES.id
  scopeValue: string; // e.g. "Grade 10", "Math"
  targetAudience: 'students' | 'teachers' | 'coordinators' | 'educators';
}

export interface Lesson {
  id: string;
  day: string;
  period: number;
  teacherId: number;
  classId: string;
  subject: string;
  type: LessonType | string;
  teacherRole?: 'primary' | 'secondary';
}

export interface AffectedLesson extends Lesson {
  date: string;
  teacherName: string;
  className: string;
  dayName: string;
}

export type BreakType = 'none' | 'short' | 'long';
export type SchoolStage = 'primary' | 'middle' | 'secondary';

export interface ScheduleConfig {
  schoolInfo?: { name: string; logo?: string };
  weekStartDay: string;
  schoolStartTime: string;
  periodDuration: number;
  customPeriodDurations?: Record<number, number>;
  periodsPerDay: number;
  holidays: string[];
  breakPositions: Record<number, 'main' | 'transit'>;
  breakTypes?: Record<number, BreakType>;
  breakDurations?: Record<number, number>;
  // NEW: Morning break before first period (for morning duty supervision)
  morningBreak?: {
    enabled: boolean;
    duration: number; // in minutes
    type: BreakType; // 'short' | 'long'
  };
  structure: {
    activeStages: SchoolStage[];
    generalCounts: number[];
    specialCounts: number[];
    lowerStageEnd: number;
    namingConvention: 'alpha' | 'numeric';
    mergeSpecialNaming: boolean;
    classAssistants?: Record<string, boolean>; // Class ID -> has assistant
    separateSpecialClasses?: boolean; // Separate special education classes into own section
  };
  absenceReasons: string[];
}

import { Permission } from './permissions';

export interface Role {
  id: string;
  label: string;
  defaultHours: number;
  permissions: Permission[];
  workloadDetails: {
    actual: number;
    individual: number;
    stay: number;
  };
}

export type AbsenceType = 'FULL' | 'PARTIAL' | 'EARLY_DEPARTURE' | 'LATE_ARRIVAL';
export type AbsenceStatus = 'OPEN' | 'COVERED' | 'CANCELLED';

export interface AbsenceRecord {
  id: number;
  teacherId: number;
  date: string;
  reason: string;
  type: AbsenceType;
  status: AbsenceStatus;
  affectedPeriods: number[];
  effectiveFrom?: string; // HH:mm for time-based absences
  effectiveTo?: string;   // HH:mm for time-based absences
  isJustified?: boolean;
  substitutionPreference?: string;
  partialAbsenceType?: 'LATE' | 'LEAVE_AND_RETURN' | 'LEAVE_UNTIL_END';
  partialAbsenceLabelAr?: string;
  partialAbsencePattern?: 'CONTIGUOUS' | 'NON_CONTIGUOUS';
  createdAt: string;
  updatedAt: string;
}

// Coverage Request - represents a period that needs a substitute
export type CoverageRequestStatus = 'PENDING' | 'ASSIGNED' | 'CANCELLED';

export interface CoverageRequest {
  id: string;
  date: string;
  periodId: number;
  absentTeacherId: number;
  absenceId: number;
  classId: string;
  subject?: string;
  requiredRole?: string;
  status: CoverageRequestStatus;
  assignedSubstituteId?: number;
  createdAt: string;
  updatedAt: string;
}

// Assignment - links a substitute to a coverage request
export interface CoverageAssignment {
  id: string;
  coverageRequestId: string;
  substituteId: number;
  date: string;
  periodId: number;
  absentTeacherId: number;
  absenceId: number;
  classId: string;
  assignedAt: string;
  assignedBy?: number; // User who made the assignment
}

// Daily Pool - maintains daily substitute availability
export type PoolEntrySource = 'SUBSTITUTE_ASSIGNMENT' | 'MANUAL_ADD' | 'EXTERNAL_POOL';

export interface DailyPoolEntry {
  teacherId: number;
  source: PoolEntrySource;
  periodId?: number;
  assignmentId?: string;
  timestamp: string;
}

export interface DailyPool {
  date: string;
  poolEntries: DailyPoolEntry[];
}

export interface SubstitutionLog {
  id: string;
  date: string;
  period: number;
  classId: string;
  absentTeacherId: number;
  substituteId: number;
  substituteName: string;
  type: 'assign_internal' | 'assign_external' | 'merge' | 'dismissal' | 'assign_distribution' | 'assistant_coverage' | 'class_merge';
  reason: string;
  modeContext: string;
  timestamp: number;
  // New fields for assistant coverage and class merge
  assistantCoverage?: {
    assistantName?: string;
    coveredByAssistant: boolean;
  };
  classMerge?: {
    mergedClasses: string[]; // List of class IDs that were merged
    targetClassId: string; // The class where students were merged into
    studentCount?: number; // Optional: number of students after merge
  };
  // NEW: Transparency & Reasoning (Option B)
  reasoning?: {
    score: number;
    factors: string[]; // e.g., ["Same Subject (+20)", "Free Period (+50)"]
    alternatives: { substituteId: number; name: string; score: number }[];
  };
}

// NEW: Override Log (Option B: Mandatory Documentation)
export interface OverrideLog {
  id: string;
  originalSuggestionId: string; // Links to SubstitutionLog
  managerId: string; // Who overrode it
  previousSubstituteId: number;
  newSubstituteId: number;
  reason: string;
  timestamp: string;
}

export type BreakMergeStrategy = 'advance_second' | 'delay_first';

export interface RuleCondition {
  id: string;
  key: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface GoldenRule {
  id: string;
  label: string;
  isActive: boolean;
  compliancePercentage: number;
  enforcementLevel: EnforcementLevel;
  isGlobal?: boolean;
  auditRequired?: boolean;
  systemCritical?: boolean;
  description: string;
  action?: { type: string };
  conditions?: RuleCondition[];
}

export interface PolicyRule {
  id: string;
  label: string;
  isActive: boolean;
  description?: string;
}

export type SlotState = 'free' | 'stay' | 'actual' | 'individual' | 'released' | 'any';
export type CandidateType = 'internal' | 'external' | 'any';

export interface PriorityCriteria {
  staffCategory: string;
  teacherType: CandidateType;
  relationship: 'none' | 'same_grade' | 'class_educator' | 'same_subject';
  slotState: SlotState;
  actualLessonTypes?: ('individual' | 'stay' | 'makooth' | 'deficit' | 'regular')[]; // NEW: Multi-select for lesson types
  selectionReason: string;
}

export interface PriorityStep {
  id: string;
  order: number;
  label: string;
  weightPercentage: number;
  probabilityBias: number;
  explanation?: string;
  criteria: PriorityCriteria;
  enabled: boolean;
}

export interface ModeConfig {
  id: string;
  name: string;
  isActive: boolean;
  target: 'all' | 'specific_grades' | 'specific_classes';
  affectedGradeLevels: number[];
  affectedClassIds: string[];
  affectedPeriods: number[];
  affectedBreaks: number[];
  breakAction: 'none' | 'internal' | 'merge';
  mergeStrategy: BreakMergeStrategy;
  goldenRules: GoldenRule[];
  policyRules: PolicyRule[];
  priorityLadder: PriorityStep[];

  // V2 ENGINE EXTENSIONS
  policyVersion?: string;
  goldenRulesV2?: GoldenRuleV2[];
  priorityLadderV2?: PriorityStepV2[];

  // NEW: Settings Engine (The Generator)
  settings?: ModeSettings;

  // NEW: Event Type Binding (Auto-Distribution Integration)
  // Links this mode to a specific event type for automatic distribution
  linkedEventType?: 'EXAM' | 'TRIP' | 'RAINY' | 'EMERGENCY' | 'HOLIDAY' | null;

  // NEW: Manual Assignments (Half-Manual Mode)
  // Allows the user to pre-set specific teachers for specific slots manually
  lockedAssignments?: { classId: string; period: number; teacherId: number; reason?: string }[];

  simulationMode?: boolean;
  autoTriggerThreshold?: number;
  enforcementProfile?: { [goldenRuleId: string]: number };
  rainy?: {
    mergedClassesCount?: number;
    teacherMultiGradeFactor?: number;
    rainyCoverageQuotaByTeacherId?: Record<number, number>;
  };
  exam?: {
    examSubject?: string;
    examPeriods?: number[];
  };
  trip?: {
    studentsLeaveAfterPeriod?: number;
  };
  holiday?: {
    type: 'full' | 'partial';
    excludedGrades?: number[];
    excludedClasses?: string[];
  };
}

export interface EngineContext {
  [modeId: string]: ModeConfig;
}

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  detail?: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  timezone: string;
  startDate: string;
  endDate: string;
  defaultWeekdays: string[];
}

export interface PeriodSlot {
  period: number;
  start: string;
  end: string;
  name?: string;
  break?: boolean;
  isInternal?: boolean;
  isMerged?: boolean;
  originalStart?: string;
}

export interface DayPattern {
  id: string;
  name: string;
  periods: PeriodSlot[];
}

export interface CalendarHoliday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'PUBLIC' | 'SCHOOL';
}

export interface DayOverride {
  date: string;
  patternId: string;
  reason: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  eventType: 'ACTIVITY' | 'EXAM' | 'TRIP' | 'ADMIN' | 'OTHER';
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  plannerId: number;
  plannerName: string;
  plannerRole?: string;
  plannerRoleDetail?: string;
  patternId: string;
  appliesTo: {
    grades: number[];
    classes: string[];
    periods: number[];
  };
  providedSubstituteId?: number;
  opContext?: ModeConfig;
  participants: { userId: number; role: string; expectations: string }[];
  audience?: { // NEW: Visibility & Notification Scope
    roles?: string[]; // e.g., 'teachers', 'educators', 'coordinators'
    departments?: string[]; // e.g., 'math', 'science' (using subject names)
    gradeLevels?: number[]; // e.g., 10, 11 (for grade-specific staff events)
    isPrivate?: boolean; // if true, only planner + participants see it
  };
}

export type DayType = 'REGULAR' | 'HOLIDAY' | 'EVENT' | 'EXAM';

export interface ResolvedDay {
  date: string;
  dayOfWeek: string;
  isSchoolDay: boolean;
  pattern: DayPattern;
  events: CalendarEvent[];
  type: DayType;
}

export interface CalendarTask {
  id: string;
  title: string;
  dueDate: string;
  status: 'PENDING' | 'DONE';
}

export interface EventComment {
  id: string;
  eventId: string;
  authorName: string;
  content: string;
  category: 'STRATEGIC' | 'OPERATIONAL' | 'RISK';
  status: 'COMPLETED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  impactScore: number;
  timestamp: number;
}

export type MissionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type MissionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DashboardWidget {
  id: string;
  title: string;
  visible: boolean;
  size: 'small' | 'medium' | 'large';
  order: number;
}

export type DashboardLayout = DashboardWidget[];

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface SimulationPoint {
  date: string;
  pressure: number;
  fatigue: number;
}

export interface SimulationResult {
  points: SimulationPoint[];
  totalAbsences: number;
  totalUncovered: number;
  criticalDates: { date: string; risk: string }[];
  avgEfficiency: number;
}

export interface TeacherImportRecord {
  name: string;
  subject?: string;
}

export interface TimetableImportRecord {
  teacherName: string;
  day: string;
  period: number;
  className: string;
  subject: string;
  type: LessonType;
  rawText: string;
  teacherRole?: 'primary' | 'secondary';
}

export interface SharedLesson {
  subject1: string;
  teacher1: string;
  subject2: string;
  teacher2: string;
  day: string;
  period: number;
  className: string;
  cellContent: string;
}

export interface ImportResult {
  teachers: any[];
  timetable: TimetableImportRecord[];
  sharedLessons: SharedLesson[];
  errors: string[];
  stats: {
    totalRows: number;
    teachersFound: number;
    lessonsFound: number;
    classesDetected: number;
  };
}

export type ScheduleFilter = { mode: 'class' | 'teacher' | 'subject', id: string | number } | null;

// Duty Management Types
export interface DutyNotification {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  relatedIds?: string[];
}

export interface DutySwapRequest {
  id: string;
  requesterId: number;
  targetTeacherId: number;
  requesterAssignmentId: string;
  targetAssignmentId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
  notes?: string;
}

// --- DUTY MANAGEMENT CORE TYPES ---

export interface SubLocation {
  id: string;
  name: string;
  capacity: number;
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  capacity: number;
  assignedTeachers: string[];
  subLocations?: SubLocation[];
  locationType?: 'internal' | 'external';
  targetClasses?: string[];
  linkedBreaks?: string[];
  facilitySubType?: string;
}

export interface FacilityPressure extends Facility {
  coverageRatio: number;
  pressureStatus: 'overcrowded' | 'loaded' | 'balanced';
  requiredTeachers: number;
}

export interface BreakPeriod {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  breakType?: 'internal' | 'external' | 'mixed';
  targetGrades?: string[];
  linkedFacilities?: {
    internal: string[];
    external: string[];
  };
  internalTargetGrades?: string[];
  externalTargetGrades?: string[];
  isAutoLinked?: boolean;
  sourceType?: 'schedule' | 'manual';
}

export interface DutyAssignment {
  id: string;
  breakPeriodId: string;
  facilityId: string;
  subLocationId?: string;
  teacherId: string;
  date: string;
}

export interface TeacherWorkload {
  teacher: Employee;
  actual: number;
  individual: number;
  stay: number;
  total: number;
  capacity: number;
  availability: 'available' | 'loaded' | 'overloaded';
  score: number;
}

export interface DutySettings {
  dailyDutyCount: number;
  linkedToSchedule: boolean;
  autoExtractBreaks: boolean;
  availableGrades: string[];
}

export interface TeacherSuggestion {
  teacher: Employee;
  workload: TeacherWorkload;
  score: number;
  reasons: string[];
}

export interface SuggestionDropdown {
  breakPeriodId: string;
  facilityId: string;
  position: { x: number; y: number };
}

export interface AutoFillProgress {
  current: number;
  total: number;
  isRunning: boolean;
  currentBreak?: string;
  currentFacility?: string;
}

export interface CoordinatorType {
  id: string;
  label: string;
  scopeType: 'grade' | 'subject' | 'class' | 'custom' | 'global';
}
