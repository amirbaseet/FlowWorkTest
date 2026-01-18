
import {
  Employee, ClassItem, Lesson, SubstitutionLog, AbsenceRecord,
  SimulationResult, SimulationPoint, ScheduleConfig, AcademicYear, DayPattern, CalendarHoliday, DayOverride, CalendarEvent, ResolvedDay, EngineContext, PeriodSlot, ModeConfig, GoldenRule
} from '@/types';
import { DAYS_AR } from '@/constants';
import { validateModeSafety, evaluatePolicyV2 } from './policyEngine';

// --- MODE OVERLAY DISTRIBUTION SYSTEM ---
export interface ModeOverlayParams {
  examSubject?: string;
  examType?: string;
  tripClasses?: string[];
  studentDismissAfterPeriod?: number;
  escortCount?: number;
  escortSelectionPolicy?: string;
  mergedClassCount?: number;
  gradesIncluded?: string[];
  dismissalPolicy?: string;
  dateRange?: { from: string; to: string };
  excludedGrades?: string[];
  holidayType?: string;
  absentThreshold?: number;
  relaxationProfile?: string;
}

export interface OverlaySlot {
  period: number;
  subject: string;
  className: string;
  originalTeacherId: number;
  isAffected: boolean;
  isReleased: boolean;
  frozen: boolean;
  context?: any;
}

export interface CandidateRanking {
  teacherId: number;
  score: number;
  reason: string;
  conflictWarnings?: string[];
  priorityOrder: number;
}

export interface ModeOverlayResult {
  affectedSlots: OverlaySlot[];
  releasedResources: Employee[];
  candidateRankings: CandidateRanking[];
  distributionGrid: Record<string, any>;
}

export const createModeOverlay = (
  modeType: 'EXAM' | 'TRIP' | 'RAINY' | 'HOLIDAY' | 'SHORTAGE',
  params: ModeOverlayParams,
  dateStr: string,
  employees: Employee[],
  lessons: Lesson[],
  classes: ClassItem[],
  config: ScheduleConfig,
  logs: SubstitutionLog[] = [],
  events: CalendarEvent[] = []
): ModeOverlayResult => {
  const dayName = DAYS_AR[new Date(dateStr).getDay()];

  // 1. Determine affected slots based on mode parameters
  const affectedSlots: OverlaySlot[] = [];

  // Get all lessons for the target day
  const dayLessons = lessons.filter(l => l.day === dayName);

  // Determine which classes/periods are affected
  let targetClasses: string[] = [];
  let targetPeriods: number[] = [];

  switch (modeType) {
    case 'EXAM':
      if (params.examSubject) {
        targetClasses = params.gradesIncluded || [];
        targetPeriods = params.dateRange ? [] : Array.from({ length: config.periodsPerDay }, (_, i) => i + 1);
      }
      break;
    case 'TRIP':
      targetClasses = params.tripClasses || [];
      targetPeriods = params.dateRange ? [] : Array.from({ length: config.periodsPerDay }, (_, i) => i + 1);
      break;
    case 'RAINY':
      targetClasses = params.gradesIncluded || [];
      targetPeriods = params.dateRange ? [] : Array.from({ length: config.periodsPerDay }, (_, i) => i + 1);
      break;
    case 'HOLIDAY':
      // Convert grade numbers to class IDs for excluded grades
      const excludedClassIds = params.excludedGrades ?
        classes.filter(c => params.excludedGrades?.includes(c.gradeLevel.toString())).map(c => c.id) : [];
      targetClasses = classes.filter(c => !excludedClassIds.includes(c.id)).map(c => c.id);
      targetPeriods = params.dateRange ? [] : Array.from({ length: config.periodsPerDay }, (_, i) => i + 1);
      break;
    case 'SHORTAGE':
      // This is handled differently, doesn't affect specific slots
      break;
  }

  // Build affected slots
  dayLessons.forEach(lesson => {
    const isClassAffected = targetClasses.length === 0 || targetClasses.includes(lesson.classId);
    const isPeriodAffected = targetPeriods.length === 0 || targetPeriods.includes(lesson.period);

    if (isClassAffected && isPeriodAffected) {
      affectedSlots.push({
        period: lesson.period,
        subject: lesson.subject,
        className: classes.find(c => c.id === lesson.classId)?.name || '',
        originalTeacherId: lesson.teacherId,
        isAffected: true,
        isReleased: true, // In overlay mode, affected slots release original teacher
        frozen: false,
        context: {
          originalLesson: lesson,
          modeType,
          params
        }
      });
    } else {
      affectedSlots.push({
        period: lesson.period,
        subject: lesson.subject,
        className: classes.find(c => c.id === lesson.classId)?.name || '',
        originalTeacherId: lesson.teacherId,
        isAffected: false,
        isReleased: false,
        frozen: false,
        context: {
          originalLesson: lesson
        }
      });
    }
  });

  // 2. Identify released resources (teachers whose slots are affected)
  const releasedResourceIds = Array.from(new Set(affectedSlots.filter(slot => slot.isReleased).map(slot => slot.originalTeacherId)));
  const releasedResources = employees.filter(emp => releasedResourceIds.includes(emp.id));

  // 3. Generate candidate rankings based on mode-specific algorithms
  const candidateRankings: CandidateRanking[] = [];

  employees.forEach(emp => {
    if (emp.id === -1) return; // Skip special entries

    // Skip if already assigned to this slot
    if (logs.some(log => log.date === dateStr && log.substituteId === emp.id &&
      affectedSlots.some(slot => slot.period === log.period && slot.isAffected))) {
      return;
    }

    let score = 0;
    let reason = '';
    let conflictWarnings: string[] = [];
    let priorityOrder = 0;

    // Mode-specific ranking algorithm
    switch (modeType) {
      case 'EXAM':
        // Exam mode priorities
        if (params.examSubject) {
          // 1. Subject specialists
          if (emp.subjects.some(s => s.includes(params.examSubject!) || params.examSubject!.includes(s))) {
            score += 300;
            reason = 'Subject Specialist';
            priorityOrder = 1;
          }
          // 2. Homeroom teachers
          else if (emp.addons.educator && targetClasses.includes(emp.addons.educatorClassId)) {
            score += 200;
            reason = 'Homeroom Teacher';
            priorityOrder = 2;
          }
          // 3. Released teachers
          else if (releasedResourceIds.includes(emp.id)) {
            score += 100;
            reason = 'Released Teacher';
            priorityOrder = 3;
          }
          // 4. Others
          else {
            score += 50;
            reason = 'General Availability';
            priorityOrder = 4;
          }
        }
        break;

      case 'TRIP':
        // Trip mode priorities
        if (params.tripClasses) {
          // Calculate attachment level to trip classes
          const attachmentScore = calculateTripAttachment(emp, params.tripClasses, dateStr, lessons);
          score += attachmentScore;

          if (attachmentScore >= 200) {
            reason = 'High Attachment to Trip Classes';
            priorityOrder = 1;
          } else if (attachmentScore >= 100) {
            reason = 'Medium Attachment to Trip Classes';
            priorityOrder = 2;
          } else {
            reason = 'Low Attachment - Selected by Policy';
            priorityOrder = 3;
          }

          // Check for conflicts (should not have solo assignments)
          const soloAssignment = lessons.filter(l => l.teacherId === emp.id && l.day === dayName && l.period === params.studentDismissAfterPeriod && l.type === 'individual');
          if (soloAssignment.length > 0) {
            conflictWarnings.push('Has solo assignment after dismissal period');
          }
        }
        break;

      case 'RAINY':
        // Rainy mode priorities
        if (params.mergedClassCount && params.gradesIncluded) {
          const gradeTeachers = employees.filter(e =>
            lessons.some(l => l.teacherId === e.id && params.gradesIncluded?.includes(classes.find(c => c.id === l.classId)?.gradeLevel.toString() || ''))
          );

          // Calculate adjusted load
          const teachersInGradeAdjusted = gradeTeachers.length;
          const targetLoadPerTeacher = params.mergedClassCount / teachersInGradeAdjusted;

          // Fairness calculation
          const currentLoad = logs.filter(l => l.substituteId === emp.id && l.date === dateStr).length;
          const loadDifference = Math.abs(targetLoadPerTeacher - currentLoad);

          // Lower load difference = higher priority
          score += Math.max(0, 100 - (loadDifference * 10));
          reason = `Fair Load Distribution (${currentLoad}/${targetLoadPerTeacher})`;
          priorityOrder = 1;
        }
        break;

      case 'HOLIDAY':
        // Holiday mode - internal teachers become available
        if (!emp.constraints.isExternal && targetClasses.includes(emp.id.toString())) {
          score += 200;
          reason = 'Holiday Substitute Pool';
          priorityOrder = 1;
        } else {
          score += 50;
          reason = 'General Availability';
          priorityOrder = 2;
        }
        break;

      case 'SHORTAGE':
        // Shortage mode - relaxed constraints
        score += 100;
        reason = 'Shortage Mode - Relaxed Constraints';
        priorityOrder = 1;
        break;
    }

    // Apply fairness and conflict checks
    const dailyLoad = logs.filter(l => l.substituteId === emp.id && l.date === dateStr).length;
    if (dailyLoad > 6) {
      score -= 50;
      conflictWarnings.push('High daily load');
    }

    // Add to rankings if score is positive
    if (score > 0) {
      candidateRankings.push({
        teacherId: emp.id,
        score,
        reason,
        conflictWarnings,
        priorityOrder
      });
    }
  });

  // Sort by score descending
  candidateRankings.sort((a, b) => {
    if (a.priorityOrder !== b.priorityOrder) {
      return a.priorityOrder - b.priorityOrder;
    }
    return b.score - a.score;
  });

  // 4. Build distribution grid
  const distributionGrid: Record<string, any> = {};
  affectedSlots.forEach(slot => {
    const slotKey = `${slot.period}-${slot.className}`;
    distributionGrid[slotKey] = {
      slot,
      candidates: candidateRankings
        .filter(c => {
          // Filter candidates based on availability for this specific slot
          const emp = employees.find(e => e.id === c.teacherId);
          if (!emp) return false;

          // Check if candidate has conflicting assignment in same period
          const hasConflict = logs.some(log =>
            log.date === dateStr &&
            log.period === slot.period &&
            log.substituteId === c.teacherId
          );

          return !hasConflict;
        })
        .map(c => ({
          ...c,
          teacherName: employees.find(e => e.id === c.teacherId)?.name || 'Unknown'
        }))
    };
  });

  return {
    affectedSlots,
    releasedResources,
    candidateRankings,
    distributionGrid
  };
};

// Helper function for trip attachment calculation
const calculateTripAttachment = (emp: Employee, tripClasses: string[], dateStr: string, lessons: Lesson[]): number => {
  const dayName = DAYS_AR[new Date(dateStr).getDay()];

  // Calculate how much the teacher is linked to trip classes
  const linkedLessons = lessons.filter(l =>
    l.teacherId === emp.id &&
    l.day === dayName &&
    tripClasses.includes(l.classId)
  );

  // Higher score for more attachment to trip classes
  const attachmentScore = linkedLessons.length * 100;

  // Also consider class diversity (if they teach multiple trip classes)
  const uniqueClasses = new Set(linkedLessons.map(l => l.classId)).size;
  const diversityBonus = uniqueClasses > 1 ? 50 : 0;

  // Consider fairness (lower if already assigned many periods)
  const existingAssignments = linkedLessons.length;
  const loadPenalty = Math.max(0, existingAssignments - 3) * 10;

  return Math.max(0, attachmentScore + diversityBonus - loadPenalty);
};

// --- END MODE OVERLAY DISTRIBUTION SYSTEM ---

export const getSchoolDaysInWeek = (date: Date | string): Date[] => {
  const current = new Date(date);
  const day = current.getDay(); // 0 = Sunday
  const diff = current.getDate() - day; // Adjust to Sunday
  const sunday = new Date(current);
  sunday.setDate(diff);

  const days: Date[] = [];
  for (let i = 0; i < 5; i++) { // Sun (0) to Thu (4)
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push(d);
  }
  return days;
};

// --- NEW HELPER: Get Local Date ISO String (YYYY-MM-DD) ---
export const toLocalISOString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- HELPER FUNCTIONS ---
export const getSafeDayName = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return DAYS_AR[d.getDay()];
};

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const normalizeArabic = (text: string): string => {
  if (!text) return "";
  let res = text.trim();
  res = res.replace(/ـ/g, "");
  res = res.replace(/[\u064B-\u065F]/g, "");
  res = res.replace(/[أإآ]/g, "ا");
  res = res.replace(/ة/g, "ه");
  res = res.replace(/ى/g, "ي");
  res = res.replace(/\s+/g, " ");
  return res.toLowerCase();
};

export const detectGradeFromTitle = (title: string): number => {
  const t = normalizeArabic(title);

  // 1. Explicit Arabic Words (Highest Priority)
  if (t.includes('ثاني عشر')) return 12;
  if (t.includes('حادي عشر')) return 11;

  if (t.includes('عاشر')) return 10;
  if (t.includes('تاسع')) return 9;
  if (t.includes('ثامن')) return 8;
  if (t.includes('سابع')) return 7;
  if (t.includes('سادس')) return 6;
  if (t.includes('خامس')) return 5;
  if (t.includes('رابع')) return 4;
  if (t.includes('ثالث')) return 3;
  if (t.includes('ثاني')) return 2;
  if (t.includes('اول') || t.includes('أول')) return 1;

  // 2. Pattern Matching "Grade-Section"
  const compositeMatch = t.match(/(?:^|\s)(\d+)\s*[-/\\,:]\s*\d+/);
  if (compositeMatch) {
    return parseInt(compositeMatch[1]);
  }

  // 3. Pattern Matching "Grade SectionLetter"
  const numberLetterMatch = t.match(/(?:^|\s)(\d+)\s+[^\d]/);
  if (numberLetterMatch) {
    return parseInt(numberLetterMatch[1]);
  }

  // 4. Exact or Start Number
  const exactMatch = t.match(/^(\d+)$/);
  if (exactMatch) {
    return parseInt(exactMatch[1]);
  }

  // 5. Fallback
  const firstNumMatch = t.match(/(\d+)/);
  if (firstNumMatch) {
    return parseInt(firstNumMatch[1]);
  }

  return 0; // Unknown
};

export const timeToMins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const minsToTime = (m: number) => {
  const hours = (Math.floor(m / 60)) % 24;
  const mins = m % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const generatePatternFromConfig = (config: ScheduleConfig): DayPattern => {
  const periods: PeriodSlot[] = [];
  let currentMins = timeToMins(config.schoolStartTime);

  for (let i = 1; i <= config.periodsPerDay; i++) {
    const pDur = config.customPeriodDurations?.[i] ?? config.periodDuration ?? 45;
    periods.push({
      period: i,
      start: minsToTime(currentMins),
      end: minsToTime(currentMins + pDur),
      name: `الحصة ${i}`,
      break: false
    });
    currentMins += pDur;

    const bType = config.breakTypes?.[i] ?? 'none';
    if (bType !== 'none') {
      const bDur = config.breakDurations?.[i] ?? (bType === 'long' ? 20 : 5);
      periods.push({
        period: i,
        start: minsToTime(currentMins),
        end: minsToTime(currentMins + bDur),
        name: bType === 'long' ? "استراحة طويلة" : "استراحة قصيرة",
        break: true
      });
      currentMins += bDur;
    }
  }

  return { id: 'DYNAMIC_FLOW', name: 'Dynamic Flow Pattern', periods };
};

export const applySmartModeToPattern = (pattern: DayPattern, context: EngineContext, config: ScheduleConfig, dayEvents: CalendarEvent[], classId?: string): DayPattern => {
  let activeConfigs: ModeConfig[] = (Object.values(context) as ModeConfig[]).filter(m => m.isActive);
  dayEvents.forEach(evt => { if (evt.opContext?.isActive) activeConfigs.push(evt.opContext); });

  let newPattern: DayPattern = JSON.parse(JSON.stringify(pattern));

  activeConfigs.forEach(cfg => {
    if (cfg.breakAction === 'internal') {
      newPattern.periods.forEach((p: PeriodSlot) => {
        if (p.break && cfg.affectedBreaks.includes(p.period || 0)) {
          p.isInternal = true;
          p.name = "استراحة داخلية (إشراف صفي)";
        }
      });
    }

    if (cfg.breakAction === 'merge' && cfg.affectedBreaks.length >= 2) {
      const bIdxs = cfg.affectedBreaks.sort((a, b) => a - b);
      const firstB = bIdxs[0];
      const secondB = bIdxs[1];

      let firstSlot = newPattern.periods.find(p => p.break && p.period === firstB);
      let secondSlot = newPattern.periods.find(p => p.break && p.period === secondB);

      if (firstSlot && secondSlot) {
        const dur1 = timeToMins(firstSlot.end) - timeToMins(firstSlot.start);
        const dur2 = timeToMins(secondSlot.end) - timeToMins(secondSlot.start);

        if (cfg.mergeStrategy === 'advance_second') {
          firstSlot.end = minsToTime(timeToMins(firstSlot.start) + dur1 + dur2);
          firstSlot.name = "استراحة مدمجة (كبرى)";
          secondSlot.isMerged = true;
          secondSlot.start = secondSlot.end;
        } else {
          firstSlot.isMerged = true;
          firstSlot.end = firstSlot.start;
          secondSlot.start = minsToTime(timeToMins(secondSlot.end) - (dur1 + dur2));
          secondSlot.name = "استراحة مدمجة (متأخرة)";
        }
      }
    }
  });

  let currentMins = timeToMins(newPattern.periods[0].start);
  newPattern.periods.forEach((p: PeriodSlot) => {
    const originalDur = timeToMins(p.end) - timeToMins(p.start);
    if (originalDur > 0) {
      p.originalStart = p.start;
      p.start = minsToTime(currentMins);
      p.end = minsToTime(currentMins + originalDur);
      currentMins += originalDur;
    } else {
      p.start = minsToTime(currentMins);
      p.end = minsToTime(currentMins);
    }
  });

  return newPattern;
};

export const calculatePeriodTimeRange = (targetPeriod: number, config: ScheduleConfig): string => {
  const dynamicPattern = generatePatternFromConfig(config);
  const slot = dynamicPattern.periods.find(p => !p.break && p.period === targetPeriod);
  return slot ? `${slot.start} - ${slot.end}` : "";
};

export interface SchoolLiveStatus {
  state: 'BEFORE_SCHOOL' | 'IN_PERIOD' | 'IN_BREAK' | 'AFTER_SCHOOL' | 'HOLIDAY';
  currentPeriod?: number;
  currentBreak?: 'short' | 'long';
  minsRemainingInSlot: number;
  minsToEndOfDay: number;
  totalDayMins: number;
  currentMinsFromStart: number;
  minsToNextBreak1: number | null;
}

export const getLiveSchoolStatus = (config: ScheduleConfig): SchoolLiveStatus => {
  const now = new Date();
  const dayName = DAYS_AR[now.getDay()];
  const normDayName = normalizeArabic(dayName);
  const isHoliday = (config.holidays || []).some(h => normalizeArabic(h) === normDayName);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const dynamicPattern = generatePatternFromConfig(config);
  if (isHoliday || dynamicPattern.periods.length === 0) return { state: 'HOLIDAY', minsRemainingInSlot: 0, minsToEndOfDay: 0, totalDayMins: 0, currentMinsFromStart: 0, minsToNextBreak1: null };

  const schoolStartMins = timeToMins(dynamicPattern.periods[0].start);
  const schoolEndMins = timeToMins(dynamicPattern.periods[dynamicPattern.periods.length - 1].end);
  const totalDayMins = schoolEndMins - schoolStartMins;

  const nextBreak = dynamicPattern.periods.find(p => p.break && timeToMins(p.start) > nowMins);
  const minsToNextBreak1 = nextBreak ? timeToMins(nextBreak.start) - nowMins : null;

  if (nowMins < schoolStartMins) return { state: 'BEFORE_SCHOOL', minsRemainingInSlot: schoolStartMins - nowMins, minsToEndOfDay: schoolEndMins - nowMins, totalDayMins, currentMinsFromStart: 0, minsToNextBreak1 };
  if (nowMins >= schoolEndMins) return { state: 'AFTER_SCHOOL', minsRemainingInSlot: 0, minsToEndOfDay: 0, totalDayMins, currentMinsFromStart: totalDayMins, minsToNextBreak1: null };

  const currentSlot = dynamicPattern.periods.find(p => nowMins >= timeToMins(p.start) && nowMins < timeToMins(p.end));
  return {
    state: currentSlot?.break ? 'IN_BREAK' : 'IN_PERIOD',
    currentPeriod: !currentSlot?.break ? currentSlot?.period : undefined,
    minsRemainingInSlot: currentSlot ? timeToMins(currentSlot.end) - nowMins : 0,
    minsToEndOfDay: schoolEndMins - nowMins,
    totalDayMins,
    currentMinsFromStart: nowMins - schoolStartMins,
    minsToNextBreak1
  };
};

export const getSortedDays = (startDay: string = "الأحد"): string[] => {
  const startIndex = DAYS_AR.indexOf(startDay);
  return startIndex === -1 ? DAYS_AR : [...DAYS_AR.slice(startIndex), ...DAYS_AR.slice(0, startIndex)];
};

export const resolveDay = (date: Date, academicYear: AcademicYear, patterns: DayPattern[], holidays: CalendarHoliday[], overrides: DayOverride[], events: CalendarEvent[], config?: ScheduleConfig): ResolvedDay => {
  // FIX: Use local date string generation to prevent UTC shifts
  const dateStr = toLocalISOString(date);
  const dayOfWeek = DAYS_AR[date.getDay()];
  const basePattern = config ? generatePatternFromConfig(config) : patterns[0];
  return {
    date: dateStr,
    dayOfWeek,
    isSchoolDay: config ? !config.holidays.some(h => normalizeArabic(h) === normalizeArabic(dayOfWeek)) : true,
    pattern: JSON.parse(JSON.stringify(basePattern)),
    events: events.filter(e => e.date === dateStr),
    type: 'REGULAR'
  };
};

// --- LEGACY COMPLIANCE (For V1 Modes) ---
export const evaluateGoldenRuleCompliance = (
  candidate: Employee,
  rule: GoldenRule,
  lessons: Lesson[],
  dayName: string,
  period: number,
  modeId: string
): { compliant: boolean; allowedViaSwap: boolean; reason?: string } => {

  if (!rule.isActive) return { compliant: true, allowedViaSwap: false };

  const isEnforced = Math.random() * 100 <= rule.compliancePercentage;

  if (rule.action?.type === 'BLOCK_STAY_FOR_COVERAGE') {
    const isStay = lessons.some(l => l.teacherId === candidate.id && l.day === dayName && l.period === period && l.type === 'stay');

    if (!isStay) return { compliant: true, allowedViaSwap: false };

    const hasIndividualSameDay = lessons.some(l => l.teacherId === candidate.id && l.day === dayName && l.type === 'individual');

    if (isEnforced) {
      if (hasIndividualSameDay) {
        return { compliant: false, allowedViaSwap: true, reason: 'Allowed only via Stay<->Individual Swap' };
      }
      return { compliant: false, allowedViaSwap: false, reason: 'Strict prohibition of Stay coverage' };
    } else {
      if (hasIndividualSameDay) return { compliant: true, allowedViaSwap: true, reason: 'Swap recommended (Relaxed)' };
      return { compliant: true, allowedViaSwap: false, reason: 'Flexible enforcement allowed (Relaxed)' };
    }
  }

  if (rule.conditions && rule.conditions.length > 0) {
    for (const cond of rule.conditions) {
      if (cond.key === 'teacherType') {
        const isExternal = candidate.constraints.isExternal;
        if (cond.operator === 'equals' && cond.value === 'internal' && isExternal) return { compliant: false, allowedViaSwap: false, reason: 'External not allowed' };
        if (cond.operator === 'equals' && cond.value === 'external' && !isExternal) return { compliant: false, allowedViaSwap: false, reason: 'Internal not allowed' };
      }
    }
  }

  return { compliant: true, allowedViaSwap: false };
};

export const calculateRainyFairSplit = (
  employees: Employee[],
  mergedClassesCount: number,
  multiGradeFactor: number = 0.7
): Record<number, number> => {
  if (mergedClassesCount <= 0 || employees.length === 0) return {};

  const quotas: Record<number, number> = {};
  const weights = employees.map(e => ({ id: e.id, weight: 1.0 }));
  const totalWeight = weights.reduce((acc, w) => acc + w.weight, 0);

  let distributed = 0;
  weights.forEach(w => {
    const share = Math.floor(mergedClassesCount * (w.weight / totalWeight));
    quotas[w.id] = share;
    distributed += share;
  });

  let remainder = mergedClassesCount - distributed;
  let idx = 0;
  while (remainder > 0) {
    quotas[weights[idx % weights.length].id]++;
    remainder--;
    idx++;
  }

  return quotas;
};

export const validateModeActivation = (config: ModeConfig): { valid: boolean; error?: string } => {
  // Use new engine validator
  const check = validateModeSafety(config);
  if (!check.valid) return { valid: false, error: check.errors[0] };
  return { valid: true };
};

export const generateSubstitutionOptions = (
  absentTeacherId: number,
  period: number,
  dateStr: string,
  employees: Employee[],
  lessons: Lesson[],
  classes: ClassItem[],
  config: ScheduleConfig,
  logs: SubstitutionLog[] = [],
  events: CalendarEvent[] = [],
  absences: AbsenceRecord[] = [],
  engineContext?: EngineContext
): any[] => {
  const dayName = DAYS_AR[new Date(dateStr).getDay()];
  const targetLesson = lessons.find(l => l.teacherId === absentTeacherId && l.period === period && l.day === dayName);

  if (!targetLesson) return [];

  // --- DETERMINE ACTIVE MODE ---
  // Priority: 
  // 1. Specific EVENT OpContext (Exam, Trip) for this class/period
  // 2. Global Engine Context (Rainy Mode, etc.)

  let activeMode: ModeConfig | undefined = undefined;

  // Check for targeted event first (Exam/Trip for specific class)
  const targetedEvent = events.find(e =>
    e.date === dateStr &&
    e.appliesTo.periods.includes(period) &&
    e.appliesTo.classes.includes(targetLesson.classId) &&
    e.opContext?.isActive
  );

  if (targetedEvent && targetedEvent.opContext) {
    activeMode = targetedEvent.opContext;
  } else if (engineContext) {
    // Fallback to global mode
    activeMode = (Object.values(engineContext) as ModeConfig[]).filter(m => m.isActive)[0];
  }

  if (!activeMode && engineContext?.normalMode) activeMode = engineContext.normalMode;

  if (activeMode && activeMode.policyVersion === 'v2') {
    const safetyCheck = validateModeSafety(activeMode);
    if (!safetyCheck.valid) {
      console.error("CRITICAL: Active Mode Failed Validation", safetyCheck.errors);
      activeMode = engineContext?.normalMode;
    }
  }

  const candidates: any[] = [];

  // V2 ENGINE PATH
  if (activeMode?.policyVersion === 'v2') {
    employees.forEach(emp => {
      if (emp.id === absentTeacherId) return;
      if (logs.some(l => l.date === dateStr && l.period === period && l.substituteId === emp.id)) return;

      // --- EVENT CHECK (CRITICAL: Respect Calendar Events) ---
      // Check if this employee is involved in an event at this specific time
      const isBusyWithEvent = events.some(evt =>
        evt.date === dateStr &&
        evt.appliesTo.periods.includes(period) &&
        (evt.plannerId === emp.id || evt.participants.some(p => p.userId === emp.id))
      );

      if (isBusyWithEvent) {
        return; // Skip this teacher, they are busy with an event
      }

      // --- STRICT OFF-DUTY CHECK ---
      // Check if teacher is physically present in school for this period
      const dayLessons = lessons.filter(l => l.teacherId === emp.id && l.day === dayName).map(l => l.period);

      if (!emp.constraints.isExternal) {
        if (dayLessons.length === 0) {
          // No lessons today => Off Duty => Can only be called manually (Treat as External)
          return;
        }
        const startP = Math.min(...dayLessons);
        const endP = Math.max(...dayLessons);

        if (period < startP || period > endP) {
          // Before first lesson or After last lesson => Off Duty => Manual Only
          return;
        }
      }

      // Updated V2 Engine Call (Including substitutionLogs for continuity/immunity checks)
      const trace = evaluatePolicyV2(emp, targetLesson, activeMode!, lessons, classes, logs);

      if (trace.allowed) {
        candidates.push({
          teacherId: emp.id,
          name: emp.name,
          teacherName: emp.name,
          score: trace.score,
          decisionType: emp.constraints.isExternal ? 'assign_external' : 'assign_internal',
          reason: trace.breakdown[0] || 'Approved by V2 Engine'
        });
      }
    });

    // --- SCENARIO 1: SPLIT STRATEGY (Distribution) ---
    const allowSplit = activeMode.settings?.class?.allowSplitStrategy || true;
    const hasStrongCandidate = candidates.some(c => c.score > 80);

    if (allowSplit && !hasStrongCandidate) {
      candidates.push({
        teacherId: -999, // Special ID for Split
        name: "تفتيت الصف (توزيع الطلبة)",
        teacherName: "توزيع على الشعب",
        score: 50, // Mid-level fallback score
        decisionType: 'assign_distribution',
        reason: 'Last Resort: Split Strategy'
      });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  // LEGACY V1 PATH (Fallback)
  employees.forEach(emp => {
    if (emp.id === absentTeacherId) return;
    if (logs.some(l => l.date === dateStr && l.period === period && l.substituteId === emp.id)) return;

    // --- EVENT CHECK (Legacy) ---
    const isBusyWithEvent = events.some(evt =>
      evt.date === dateStr &&
      evt.appliesTo.periods.includes(period) &&
      (evt.plannerId === emp.id || evt.participants.some(p => p.userId === emp.id))
    );
    if (isBusyWithEvent) return;

    // --- STRICT OFF-DUTY CHECK (Legacy) ---
    const dayLessons = lessons.filter(l => l.teacherId === emp.id && l.day === dayName).map(l => l.period);
    if (!emp.constraints.isExternal) {
      if (dayLessons.length === 0) return; // Off Duty
      const startP = Math.min(...dayLessons);
      const endP = Math.max(...dayLessons);
      if (period < startP || period > endP) return; // Out of bounds
    }

    const empOriginalLesson = lessons.find(l => l.teacherId === emp.id && l.day === dayName && l.period === period);

    let slotState: 'free' | 'stay' | 'actual' | 'individual' | 'released' = 'free';
    if (empOriginalLesson) {
      slotState = empOriginalLesson.type as any;
    }

    let isBlocked = false;
    let ruleReason = '';

    if (engineContext?.normalMode?.goldenRules) {
      const globalRules = engineContext.normalMode.goldenRules.filter(r => r.isGlobal);
      for (const rule of globalRules) {
        const check = evaluateGoldenRuleCompliance(emp, rule, lessons, dayName, period, 'normalMode');
        if (!check.compliant) {
          isBlocked = true;
          ruleReason = check.reason || 'Global Rule Block';
          break;
        }
      }
    }

    if (isBlocked) return;

    if (activeMode?.goldenRules) {
      for (const rule of activeMode.goldenRules) {
        const check = evaluateGoldenRuleCompliance(emp, rule, lessons, dayName, period, activeMode.id);
        if (!check.compliant) {
          isBlocked = true;
          ruleReason = check.reason || `Mode Rule Block (${activeMode.name})`;
          break;
        }
      }
    }

    if (isBlocked) return;

    let score = 0;
    let decisionReason = 'Default';

    if (activeMode?.priorityLadder) {
      for (const step of activeMode.priorityLadder) {
        if (!step.enabled) continue;

        let match = true;
        const criteria = step.criteria;

        if (criteria.teacherType !== 'any') {
          const isExt = emp.constraints.isExternal;
          if (criteria.teacherType === 'internal' && isExt) match = false;
          if (criteria.teacherType === 'external' && !isExt) match = false;
        }

        if (match && criteria.slotState !== 'any') {
          if (criteria.slotState !== slotState) match = false;
        }

        if (match && criteria.relationship === 'same_subject') {
          if (!emp.subjects.includes(targetLesson.subject)) match = false;
        }

        if (match) {
          const baseStepScore = (100 - step.order * 10);
          const weightScore = step.weightPercentage;
          const randomFactor = (Math.random() * step.probabilityBias);

          score += baseStepScore + weightScore + randomFactor;
          decisionReason = step.label;
          break;
        }
      }
    } else {
      if (slotState === 'free') score += 150;
      else if (slotState === 'stay') score += 100;
    }

    if (score > 0) {
      candidates.push({
        teacherId: emp.id,
        name: emp.name,
        teacherName: emp.name,
        score,
        decisionType: emp.constraints.isExternal ? 'assign_external' : 'assign_internal',
        reason: decisionReason
      });
    }
  });

  return candidates.sort((a, b) => b.score - a.score);
};

export const runAnnualSimulation = (employees: Employee[], lessons: Lesson[], classes: ClassItem[], config: ScheduleConfig): SimulationResult => {
  return { points: [], totalAbsences: 400, totalUncovered: 0, criticalDates: [], avgEfficiency: 100 };
};

export const downloadCSV = (data: any[], headers: string[], filename: string) => {
  const csvContent = "data:text/csv;charset=utf-8," + (headers.length > 0 ? headers.join(",") + "\n" : "") + data.map(e => Object.values(e).join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
};

export const parseCSV = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n");
      const headers = lines[0].split(",");
      const result = lines.slice(1).filter(l => l).map(line => {
        const obj: any = {};
        const currentline = line.split(",");
        headers.forEach((h, i) => { obj[h.trim()] = currentline[i]?.trim(); });
        return obj;
      });
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// --- PERMISSION CHECKING UTILITY ---
import { Role } from '@/types';

export type PermissionId = 'view_all' | 'edit_absences' | 'manage_staff' | 'override_engine' | 'system_admin';

/**
 * Check if a user has a specific permission based on their role
 */
export const hasPermission = (
  user: Employee | null | undefined,
  permission: PermissionId,
  roles: Role[]
): boolean => {
  if (!user) return false;
  const userRole = roles.find(r => r.id === user.baseRoleId);
  if (!userRole) return false;
  return userRole.permissions.includes(permission as any);
};

/**
 * Check if user is an admin (principal or vice principal)
 */
export const isUserAdmin = (user: Employee | null | undefined): boolean => {
  if (!user) return false;
  return user.baseRoleId === 'principal' || user.baseRoleId === 'vice_principal';
};

/**
 * Get all permissions for a user
 */
export const getUserPermissions = (
  user: Employee | null | undefined,
  roles: Role[]
): string[] => {
  if (!user) return [];
  const userRole = roles.find(r => r.id === user.baseRoleId);
  return userRole?.permissions || [];
};
