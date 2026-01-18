
import { GoldenRuleV2, PriorityStepV2, ModeSettings } from './types/policy';

export type ViewState = 'dashboard' | 'employees' | 'schedule' | 'substitutions' | 'reports' | 'calendar' | 'partner-portal' | 'ai-assistant' | 'settings' | 'calendar-request' | 'bulletin-board';

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
    coordinators: string[];
  };
  constraints: {
    cannotCoverAlone: boolean;
    isExternal: boolean;
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

export interface Lesson {
  id: string;
  day: string;
  period: number;
  teacherId: number;
  classId: string;
  subject: string;
  type: LessonType | string;
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
  structure: {
    activeStages: SchoolStage[];
    generalCounts: number[];
    specialCounts: number[];
    lowerStageEnd: number;
    namingConvention: 'alpha' | 'numeric';
    mergeSpecialNaming: boolean;
  };
  absenceReasons: string[];
}

export interface Role {
  id: string;
  label: string;
  defaultHours: number;
  permissions: string[];
  workloadDetails: {
    actual: number;
    individual: number;
    stay: number;
  };
}

export interface AbsenceRecord {
  id: number;
  teacherId: number;
  date: string;
  reason: string;
  type: 'FULL' | 'PARTIAL';
  affectedPeriods: number[];
  isJustified?: boolean;
  substitutionPreference?: string;
  partialAbsenceType?: 'LATE' | 'LEAVE_AND_RETURN' | 'LEAVE_UNTIL_END';
  partialAbsenceLabelAr?: string;
  partialAbsencePattern?: 'CONTIGUOUS' | 'NON_CONTIGUOUS';
}

export interface SubstitutionLog {
  id: string;
  date: string;
  period: number;
  classId: string;
  absentTeacherId: number;
  substituteTeacherId: number;
  substituteName: string;
  type: 'assign_internal' | 'assign_external' | 'merge' | 'dismissal' | 'assign_distribution';
  reason: string;
  modeContext: string;
  timestamp: number;
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
}

export interface ImportResult {
  teachers: any[];
  timetable: TimetableImportRecord[];
  errors: string[];
  stats: {
    totalRows: number;
    teachersFound: number;
    lessonsFound: number;
    classesDetected: number;
  };
}

export type ScheduleFilter = { mode: 'class' | 'teacher' | 'subject', id: string | number } | null;
