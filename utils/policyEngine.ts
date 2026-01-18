
import { Employee, Lesson, ModeConfig, ClassItem, SubstitutionLog } from '../types';
import { GoldenRuleV2, PriorityStepV2, ConditionGroup, Condition, DecisionTrace, ScoreOperation } from '../types/policy';
import { DAYS_AR } from '../constants';

// --- SCENARIO 2: CROSS-COMPETENCY MATRIX ---
// Defines subject domains. If exact match fails, we check domain match.
const SUBJECT_DOMAINS: Record<string, string[]> = {
  'SCIENCES': ['علوم', 'فيزياء', 'كيمياء', 'أحياء', 'science', 'physics', 'chemistry', 'biology'],
  'MATH_TECH': ['رياضيات', 'حاسوب', 'تكنولوجيا', 'math', 'computer', 'technology'],
  'LANGUAGES': ['لغة عربية', 'لغة إنجليزية', 'لغة عبرية', 'arabic', 'english', 'hebrew'],
  'HUMANITIES': ['تاريخ', 'جغرافيا', 'مدنيات', 'دين', 'تربية إسلامية', 'history', 'geography', 'civics', 'religion'],
  'ARTS_SPORTS': ['فنون', 'رياضة', 'موسيقى', 'art', 'sport', 'music']
};

const getSubjectDomain = (subject: string): string | null => {
  const normSub = subject.trim().toLowerCase();
  for (const [domain, subjects] of Object.entries(SUBJECT_DOMAINS)) {
    if (subjects.some(s => normSub.includes(s))) return domain;
  }
  return null;
};

// --- SAFETY & COMPLIANCE VALIDATOR ---
export const validateModeSafety = (mode: ModeConfig): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 1. Identity Check
  if (!mode.id || !mode.name) errors.push("CRITICAL: Mode identity missing.");

  // 2. Parameter Validation
  if (mode.id === 'rainyMode' && (mode.rainy?.mergedClassesCount ?? -1) < 0) {
    errors.push("INVALID_CONFIG: Rainy Mode requires 'mergedClassesCount' >= 0.");
  }
  
  // Relaxed Exam Check: Check both Legacy V1 and New V2 Settings
  if (mode.id === 'examMode') {
      const hasLegacySubject = !!mode.exam?.examSubject;
      const hasV2Subject = !!mode.settings?.subject?.governingSubject;
      // Lenient validation
  }

  return { valid: errors.length === 0, errors };
};

// --- HELPER: calculate consecutive periods ---
const getConsecutivePeriods = (teacherId: number, day: string, allLessons: Lesson[], subs: SubstitutionLog[]): number => {
  const relevantLessons = allLessons.filter(l => l.teacherId === teacherId && l.day === day).map(l => l.period);
  const relevantSubs = subs.filter(s => s.substituteTeacherId === teacherId && s.date === new Date().toISOString().split('T')[0]).map(s => s.period);
  
  const busyPeriods = Array.from(new Set([...relevantLessons, ...relevantSubs])).sort((a,b) => a-b);
  if (busyPeriods.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;
  for (let i = 0; i < busyPeriods.length - 1; i++) {
    if (busyPeriods[i+1] === busyPeriods[i] + 1) {
      currentStreak++;
    } else {
      maxStreak = Math.max(maxStreak, currentStreak);
      currentStreak = 1;
    }
  }
  return Math.max(maxStreak, currentStreak);
};

// --- HELPER: Calculate Fairness/Load Stats ---
const calculateTeacherLoad = (teacherId: number, subs: SubstitutionLog[]) => {
  const weekly = subs.filter(s => s.substituteTeacherId === teacherId).length; 
  const daily = subs.filter(s => s.substituteTeacherId === teacherId && s.date === new Date().toISOString().split('T')[0]).length;
  return { weekly, daily };
};

// --- CONTEXT BUILDER (Enhanced for Scenarios) ---
export const buildEvaluationContext = (
  candidate: Employee,
  targetLesson: Lesson,
  day: string,
  period: number,
  allLessons: Lesson[],
  allClasses: ClassItem[],
  substitutionLogs: SubstitutionLog[],
  mode?: ModeConfig // Passed mode to check governingSubject
) => {
  const candidateLesson = allLessons.find(l => l.teacherId === candidate.id && l.day === day && l.period === period);
  const slotState = candidateLesson ? candidateLesson.type : 'free';

  const loads = calculateTeacherLoad(candidate.id, substitutionLogs);
  const consecutive = getConsecutivePeriods(candidate.id, day, allLessons, substitutionLogs);
  
  const avgLoad = 2; 
  const fairnessDeviation = loads.weekly - avgLoad;

  // 1. Exact Match (Legacy - Matches the Lesson Subject)
  const isSameSubject = candidate.subjects.some(s => targetLesson.subject.includes(s));
  
  // 1.5 Governing Subject Match (Matches the Exam Subject)
  let governingSubject = "";
  let matchesGoverningSubject = false;
  if (mode?.settings?.subject?.governingSubject) {
      governingSubject = mode.settings.subject.governingSubject;
      matchesGoverningSubject = candidate.subjects.some(s => s.includes(governingSubject) || governingSubject.includes(s));
  } else if (mode?.exam?.examSubject) {
      governingSubject = mode.exam.examSubject;
      matchesGoverningSubject = candidate.subjects.some(s => s.includes(governingSubject) || governingSubject.includes(s));
  }

  // 2. Cross-Competency Domain Match (Scenario 2)
  const targetDomain = getSubjectDomain(targetLesson.subject);
  const candidateDomains = candidate.subjects.map(s => getSubjectDomain(s)).filter(Boolean);
  const isSameDomain = targetDomain ? candidateDomains.includes(targetDomain) : false;

  const isHomeroom = candidate.addons.educator && candidate.addons.educatorClassId === targetLesson.classId;
  const taughtClassToday = allLessons.some(l => l.teacherId === candidate.id && l.day === day && l.classId === targetLesson.classId && l.period !== period);

  // --- CHECK: Is Subject Teacher Roaming? (Busy in another section this period) ---
  // If we have a governing subject (e.g., Math Exam), check if ANY teacher of that subject is busy in this period
  // but NOT in this class.
  let isSubjectTeacherRoaming = false;
  if (governingSubject) {
      const subjectTeachers = allLessons
          .filter(l => l.day === day && l.period === period && (l.subject.includes(governingSubject) || governingSubject.includes(l.subject)))
          .map(l => l.teacherId);
      
      // If there are lessons of this subject happening NOW, implies subject teachers are busy proctoring/teaching them.
      if (subjectTeachers.length > 0) {
          isSubjectTeacherRoaming = true;
      }
  }

  // --- NEW: Calculate Daily Presence Range ---
  const dayLessonPeriods = allLessons.filter(l => l.teacherId === candidate.id && l.day === day).map(l => l.period);
  let isOffDuty = false;
  if (!candidate.constraints.isExternal) {
      if (dayLessonPeriods.length === 0) isOffDuty = true; // No lessons today
      else {
          const startP = Math.min(...dayLessonPeriods);
          const endP = Math.max(...dayLessonPeriods);
          if (period < startP || period > endP) isOffDuty = true; // Outside bounds
      }
  }

  // --- SCENARIO 3: CONTINUITY OF CARE ---
  const todayDate = new Date();
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const isContinuityMatch = substitutionLogs.some(log => 
    log.date === yesterdayStr && 
    log.absentTeacherId === targetLesson.teacherId && 
    log.substituteTeacherId === candidate.id
  );

  // --- SCENARIO 5: TEMPORARY IMMUNITY ---
  const recentLoad = substitutionLogs.filter(l => 
    l.substituteTeacherId === candidate.id && 
    (new Date(l.date).getTime() > new Date().getTime() - (48 * 60 * 60 * 1000))
  ).length;
  
  const isImmune = recentLoad >= 6; 

  return {
    teacher: {
      id: candidate.id,
      type: candidate.constraints.isExternal ? 'external' : 'internal',
      isHomeroom: candidate.addons.educator,
      workload: { actualCount: candidate.workload.actual },
      dailyCoverCount: loads.daily,
      weeklyCoverCount: loads.weekly,
      fairnessDeviation: fairnessDeviation,
      consecutivePeriods: consecutive,
      isOffDuty: isOffDuty,
      isImmune: isImmune
    },
    slot: {
      periodNumber: period,
      dayName: day,
      state: slotState, 
      subject: candidateLesson?.subject || '',
      isCoTaught: candidateLesson?.subject.includes('مشترك') || false,
    },
    rel: {
      sameClass: false, 
      sameGrade: false, 
      sameSubject: isSameSubject,
      sameDomain: isSameDomain,
      continuityMatch: isContinuityMatch,
      isPrimaryTeacherForClass: isHomeroom, // This means candidate IS homeroom for TARGET class
      sameHomeroom: isHomeroom,
      taughtClassToday: taughtClassToday,
      matchesGoverningSubject: matchesGoverningSubject,
      isSubjectTeacherRoaming: isSubjectTeacherRoaming // New Flag
    },
    context: {
      internalSubAvailable: true, 
      externalSubAvailable: true,
      shortageLevel: 'low',
      absentRate: 5
    }
  };
};

// --- CONDITION EVALUATOR (NEW COMPOSITE LOGIC) ---
const evaluateCondition = (condition: Condition, context: any): boolean => {
  // ... (Existing condition evaluation logic remains same)
  // 1. Teacher Type
  if (condition.teacherType !== 'any') {
    if (condition.teacherType !== context.teacher.type) return false;
  }
  // 2. Lesson Type
  if (condition.lessonType !== 'any') {
    if (condition.lessonType === 'shared') {
       if (!context.slot.isCoTaught) return false;
    } else {
       if (condition.lessonType !== context.slot.state) return false;
    }
  }
  // 3. Subject
  if (condition.subject !== 'any') {
    const contextSubject = context.slot.subject || '';
    if (!contextSubject.includes(condition.subject)) return false;
  }
  // 4. Time Context
  if (condition.timeContext !== 'any') {
    if (condition.timeContext === 'same_day_stay') { if (context.slot.state !== 'stay') return false; }
    if (condition.timeContext === 'during_school') { if (context.slot.periodNumber <= 0) return false; }
    if (condition.timeContext === 'is_immune_period') { if (!context.teacher.isImmune) return false; }
  }
  // 5. Relationship
  if (condition.relationship !== 'any') {
    if (condition.relationship === 'same_class' && !context.rel.sameClass) return false;
    if (condition.relationship === 'same_grade' && !context.rel.sameGrade) return false;
    if (condition.relationship === 'same_homeroom' && !context.rel.isPrimaryTeacherForClass) return false;
    if (condition.relationship === 'is_homeroom' && !context.teacher.isHomeroom) return false;
    if (condition.relationship === 'same_subject' && !context.rel.sameSubject) return false;
    if (condition.relationship === 'same_domain' && !context.rel.sameDomain) return false;
    if (condition.relationship === 'continuity_match' && !context.rel.continuityMatch) return false;
  }
  return true;
};

const evaluateGroup = (group: ConditionGroup, context: any): boolean => {
  if (group.conditions.length === 0) return true; 
  if (group.op === 'AND') {
    return group.conditions.every(c => 'op' in c ? evaluateGroup(c, context) : evaluateCondition(c, context));
  } else if (group.op === 'OR') {
    return group.conditions.some(c => 'op' in c ? evaluateGroup(c, context) : evaluateCondition(c, context));
  } else { 
    return !group.conditions.every(c => 'op' in c ? evaluateGroup(c, context) : evaluateCondition(c, context));
  }
};

// --- MAIN EXPLAINABILITY ENGINE (V2) ---
export const evaluatePolicyV2 = (
  candidate: Employee,
  targetLesson: Lesson,
  mode: ModeConfig,
  allLessons: Lesson[],
  allClasses: ClassItem[],
  substitutionLogs: SubstitutionLog[] = []
): DecisionTrace => {
  
  // 1. Context Build
  const context = buildEvaluationContext(candidate, targetLesson, targetLesson.day, targetLesson.period, allLessons, allClasses, substitutionLogs, mode);
  
  // 2. Trace Initialization
  const trace: DecisionTrace = {
    auditTrailId: `TRC-${Date.now()}-${Math.floor(Math.random()*10000)}`,
    timestamp: Date.now(),
    activeModeId: mode.id,
    allowed: true,
    score: 0,
    rawScore: 0,
    goldenRulesApplied: [],
    goldenRulesViolated: [],
    goldenRulesBlocked: [],
    priorityStepsMatched: [],
    priorityStepsSkipped: [],
    metricsSnapshot: {
       load: context.teacher.weeklyCoverCount,
       streak: context.teacher.consecutivePeriods,
       fairness: context.teacher.fairnessDeviation,
       isImmune: context.teacher.isImmune,
       domainMatch: context.rel.sameDomain
    },
    parametersUsed: {
        teacherType: context.teacher.type,
        slotState: context.slot.state,
        relationship: context.rel
    },
    breakdown: [],
    finalDecision: 'APPROVED'
  };

  // --- LAYER 0: SETTINGS ENGINE (THE FILTER) ---
  if (context.teacher.isOffDuty) {
      trace.allowed = false;
      trace.breakdown.push("🚫 Physical Presence: Teacher is off-duty/not in school.");
      trace.finalDecision = 'REJECTED';
      return trace;
  }

  if (context.teacher.isImmune && mode.id !== 'emergencyMode') {
      trace.score -= 500;
      trace.breakdown.push("🛡️ Immunity Active: Teacher needs cooldown.");
  }

  if (mode.settings) {
      const s = mode.settings;
      if (s.teacher.disableExternal && candidate.constraints.isExternal) { trace.allowed = false; trace.finalDecision = 'REJECTED'; return trace; }
      if (s.lesson.disableStay && context.slot.state === 'stay') { trace.allowed = false; trace.finalDecision = 'REJECTED'; return trace; }
      if (s.lesson.disableIndividual && context.slot.state === 'individual') { trace.allowed = false; trace.finalDecision = 'REJECTED'; return trace; }
      if (context.teacher.dailyCoverCount >= s.hr.maxDailyCoverage) { trace.allowed = false; trace.finalDecision = 'REJECTED'; return trace; }

      // --- EXAM LOGIC UPDATES ---
      // 1. Force Homeroom Presence (Priority 1 & 2)
      if (s.teacher.forceHomeroomPresence && context.rel.isPrimaryTeacherForClass) {
          if (context.slot.state === 'stay') {
              trace.score += 3000; // PRIORITY 1: HR + STAY
              trace.breakdown.push(`👑 #1 Priority: Homeroom Teacher (Available via Stay Swap)`);
          } else if (context.slot.state === 'individual') {
              trace.score += 2500; // PRIORITY 2: HR + INDIVIDUAL
              trace.breakdown.push(`👑 #2 Priority: Homeroom Teacher (Via Individual Support)`);
          } else if (context.slot.state === 'free') {
              trace.score += 2000; // Standard Free HR
              trace.breakdown.push(`👑 Homeroom Priority (Free)`);
          }
      }

      // 2. Subject Specialist (Priority 3 - Roaming Support)
      // If we are NOT the governing subject teacher, but the governing subject teacher is roaming (busy elsewhere),
      // we boost this candidate to be a "Support Proctor".
      if (s.subject.prioritizeGoverningSubject) {
          if (context.rel.matchesGoverningSubject) {
              trace.score += 300;
              trace.breakdown.push(`📚 Governing Subject Match: +300`);
          } else if (context.rel.isSubjectTeacherRoaming) {
              // This candidate is NOT the subject teacher, but the system knows subject teachers are busy.
              // So this candidate is valuable as a "Support Proctor" to let the specialist roam.
              trace.score += 150;
              trace.breakdown.push(`🤝 Priority #3: Support Proctor (Enables Subject Teacher Roaming)`);
          }
      }
  }

  // 3. Evaluate Golden Rules
  const activeRules = mode.goldenRulesV2?.filter(r => r.isEnabled) || [];
  for (const rule of activeRules) {
    if (evaluateGroup(rule.when, context)) {
      const isEnforced = Math.random() * 100 <= rule.compliancePercentage;
      if (isEnforced) {
        const exceptionMatch = rule.exceptions.some(ex => evaluateGroup(ex.when, context));
        if (!exceptionMatch) {
           trace.goldenRulesApplied.push(rule.name);
           if (rule.then.some(e => e.type === 'BLOCK_ASSIGNMENT')) {
             trace.allowed = false; trace.finalDecision = 'REJECTED'; trace.breakdown.push(`⛔ Blocked by Rule: ${rule.name}`); return trace;
           }
           const boost = rule.then.find(e => e.type === 'BOOST_SCORE');
           if (boost) { trace.score += (boost.params?.value || 0); trace.breakdown.push(`✨ Rule Bonus (${rule.name}): +${boost.params?.value}`); }
           const penalize = rule.then.find(e => e.type === 'PENALIZE_SCORE');
           if (penalize) { trace.score -= (penalize.params?.value || 0); trace.breakdown.push(`⚠️ Rule Penalty (${rule.name}): -${penalize.params?.value}`); }
        }
      }
    }
  }

  // 4. Evaluate Priority Ladder
  if (trace.allowed) {
    if (context.rel.continuityMatch) { trace.score += 200; trace.breakdown.push(`🔄 Continuity Bonus: Covered yesterday (+200)`); }
    if (context.rel.sameDomain && !context.rel.sameSubject) { trace.score += 40; trace.breakdown.push(`🧠 Domain Match: Subject domain compatible (+40)`); }

    const steps = mode.priorityLadderV2?.filter(s => s.isEnabled).sort((a,b) => a.order - b.order) || [];
    for (const step of steps) {
      if (evaluateGroup(step.filters, context)) {
        trace.priorityStepsMatched.push(step.label);
        let stepScore = step.scoring.baseScore;
        let multipliers = 1;
        step.scoring.modifiers.forEach(mod => {
          if (evaluateGroup(mod.when, context)) {
            if (mod.operation === 'ADD') stepScore += mod.value;
            else if (mod.operation === 'SUBTRACT') stepScore -= mod.value;
            else if (mod.operation === 'MULTIPLY') multipliers *= mod.value;
            else if (mod.operation === 'SET_TO') stepScore = mod.value;
          }
        });
        const weightedScore = (stepScore * multipliers) * (step.weightPercentage / 100);
        trace.score += weightedScore;
        trace.breakdown.push(`🎯 Matched Priority: ${step.label} | Final: ${weightedScore.toFixed(1)}`);
        if (step.stopOnMatch) break;
      } else {
          trace.priorityStepsSkipped.push(step.label);
      }
    }
  }

  // 5. Fairness
  if (mode.settings && mode.settings.hr.fairnessSensitivity === 'strict' && context.teacher.fairnessDeviation > 1) {
      trace.score *= 0.5; trace.breakdown.push(`⚖️ Strict Fairness: -50%`);
  } else if (mode.settings && mode.settings.hr.fairnessSensitivity === 'flexible' && context.teacher.fairnessDeviation > 2) {
      trace.score *= 0.8; trace.breakdown.push(`⚖️ Fairness Balancing: -20%`);
  }

  return trace;
};
