
export type LogicOp = 'AND' | 'OR' | 'NAND';

export interface Condition {
  id: string;
  teacherType: 'internal' | 'external' | 'any';
  lessonType: 'actual' | 'individual' | 'stay' | 'shared' | 'any';
  subject: string;
  timeContext: 'same_day_stay' | 'before_end' | 'after_end' | 'emergency' | 'during_school' | 'is_immune_period' | 'any';
  relationship: 'same_class' | 'same_grade' | 'same_homeroom' | 'is_homeroom' | 'same_subject' | 'same_domain' | 'continuity_match' | 'any';
}

export interface ConditionGroup {
  id: string;
  op: LogicOp;
  conditions: Array<Condition | ConditionGroup>;
}

export interface Effect {
  type: 'BLOCK_ASSIGNMENT' | 'REQUIRE_SWAP' | 'PENALIZE_SCORE' | 'BOOST_SCORE' | 'REQUIRE_CO_TAUGHT' | 'LIMIT_DAILY_COVER' | 'LIMIT_WEEKLY_COVER' | 'FORCE_INTERNAL_ONLY' | 'FORCE_NO_EXTERNAL' | 'RELEASE_SLOTS' | 'END_DAY_AT_PERIOD' | 'SUGGEST_SPLIT';
  params?: any;
}

export interface ExceptionRule {
  id: string;
  when: ConditionGroup;
  then: Effect[];
}

export interface GoldenRuleV2 {
  id: string;
  name: string;
  description: string;
  isGlobal: boolean;
  isEnabled: boolean;
  compliancePercentage: number;
  randomnessPercentage: number;
  severity: 'HARD' | 'SOFT' | 'CRITICAL';
  overrideAllowed: boolean;
  overrideRequiresReason: boolean;
  auditRequired: boolean;
  scope: {
    targetScope: 'all' | 'grades' | 'classes';
    grades?: number[];
    classIds?: string[];
    days?: string[];
    periods?: number[];
  };
  when: ConditionGroup;
  then: Effect[];
  exceptions: ExceptionRule[];
  tags?: string[];
}

export type ScoreOperation = 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'SET_TO';

export interface ScoreModifier {
  id: string;
  when: ConditionGroup;
  operation: ScoreOperation;
  value: number; 
  label: string;
}

export interface PriorityStepV2 {
  id: string;
  label: string;
  order: number;
  isEnabled: boolean;
  compliancePercentage: number;
  randomnessPercentage: number;
  weightPercentage: number;
  stopOnMatch: boolean;
  scope?: GoldenRuleV2['scope'];
  filters: ConditionGroup;
  scoring: {
    baseScore: number;
    modifiers: ScoreModifier[];
  };
  explanation: string;
}

// --- NEW: MODE SETTINGS ENGINE DOMAINS ---

export interface TeacherSettings {
  disableExternal: boolean;
  treatNoLessonsAsOffDuty: boolean;
  allowLateArrivals: boolean;
  forceHomeroomPresence: boolean;
}

export interface LessonSettings {
  disableStay: boolean;
  disableIndividual: boolean;
  disableShared: boolean;
  forceActualOnly: boolean;
}

export interface TimeSettings {
  ignoreGapsAtStart: boolean;
  ignoreGapsAtEnd: boolean;
  maxConsecutivePeriods: number;
}

export interface ClassSettings {
  allowMerge: boolean;
  maxMergedCount: number;
  priorityGrades: number[];
  allowSplitStrategy: boolean;
}

export interface SubjectSettings {
  governingSubject: string;
  prioritizeGoverningSubject: boolean;
  enableCrossCompetency: boolean;
}

export interface HRSettings {
  maxDailyCoverage: number;
  maxWeeklyCoverage: number;
  fairnessSensitivity: 'strict' | 'flexible' | 'off';
  immunityCooldownHours: number;
}

export interface UISettings {
  hideForbiddenCandidates: boolean;
  requireJustification: boolean;
  lockManualOverride: boolean;
}

export interface ModeSettings {
  teacher: TeacherSettings;
  lesson: LessonSettings;
  time: TimeSettings;
  class: ClassSettings;
  subject: SubjectSettings;
  hr: HRSettings;
  ui: UISettings;
}

export interface DecisionTrace {
  auditTrailId: string;
  timestamp: number;
  activeModeId: string;
  allowed: boolean;
  score: number;
  rawScore: number;
  
  goldenRulesApplied: string[];
  goldenRulesViolated: string[];
  goldenRulesBlocked: string[];
  
  priorityStepsMatched: string[];
  priorityStepsSkipped: string[];
  
  metricsSnapshot: Record<string, any>;
  parametersUsed: Record<string, any>;
  
  breakdown: string[];
  finalDecision: 'APPROVED' | 'REJECTED' | 'FLAGGED';
}
