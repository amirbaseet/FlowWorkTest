
import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
    Plus, Users, Calendar as CalendarIcon, X,
    UserPlus, Bus, Siren, FileText, LayoutGrid, GraduationCap,
    ArrowRightLeft, Wand2, AlertCircle, CheckCircle2, CheckSquare, Unlock, Briefcase, Coffee, Clock, CloudRain,
    AlertTriangle, TrendingUp, BarChart3
} from 'lucide-react';
import { Employee, CalendarEvent, ClassItem, Lesson, SubstitutionLog, EngineContext, ModeConfig, ScheduleConfig } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import UnifiedEventForm from './UnifiedEventForm';
import { DAYS_AR } from '@/constants';
import { normalizeArabic } from '@/utils';
import { applyModeRulesToDistribution, findLinkedMode, DistributionContext } from '@/utils/policyEngine';
import { getOperationalScope } from '@/utils/accessControl';

// --- HELPER: Parse Key correctly handling hyphens in Class IDs ---
const parseKey = (key: string) => {
    const lastDash = key.lastIndexOf('-');
    if (lastDash === -1) return { classId: key, period: 0 };
    return {
        classId: key.substring(0, lastDash),
        period: parseInt(key.substring(lastDash + 1)) || 0
    };
};

// --- COMPONENT: Manual Distribution Grid ---
interface ManualDistributionProps {
    classes: ClassItem[];
    allClasses: ClassItem[];
    periods: number[];
    lessons: Lesson[];
    employees: Employee[];
    date: string;
    assignments: Record<string, { teacherId: number, reason: string }[]>;
    onAssign: (classId: string, period: number, teacherId: number, reason: string) => void;
    onRemove: (classId: string, period: number, teacherId: number) => void;
    onBulkAssign?: (assignments: { classId: string, period: number, teacherId: number, reason: string }[]) => void;
    modeType: string;
    poolIds?: number[];
    externalPartners?: { id: string; userIds: string[] }[];
    engineContext?: EngineContext;
    substitutionLogs?: SubstitutionLog[];
    scheduleConfig: ScheduleConfig;
}

const ManualDistributionGrid: React.FC<ManualDistributionProps> = ({
    classes, allClasses, periods = [], lessons, employees, date, assignments = {}, onAssign, onRemove, onBulkAssign, modeType, poolIds = [], externalPartners = [], engineContext = {}, substitutionLogs = [], scheduleConfig
}) => {
    const { addToast } = useToast();
    const [activeSlot, setActiveSlot] = useState<{ classId: string, period: number } | null>(null);

    // Trip Logic States
    const [showTripRecommendations, setShowTripRecommendations] = useState(false);
    const [tripCandidates, setTripCandidates] = useState<{ emp: Employee, score: number, gradeCount: number, mainClassId: string }[]>([]);
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
    const [viewPhase, setViewPhase] = useState<'SELECTION' | 'COVERAGE'>('SELECTION');

    // NEW: Trip companion per class (one companion for all periods of each class)
    const [tripClassCompanions, setTripClassCompanions] = useState<Record<string, number>>({});

    // NEW: Rainy mode - Class merging configuration (changed to track specific class IDs)
    const [rainyMergeGroups, setRainyMergeGroups] = useState<Record<string, string[]>>({}); // gradeLevel-type -> [classIds]
    const [showRainyMergeModal, setShowRainyMergeModal] = useState(false);

    const dayName = DAYS_AR[new Date(date).getDay()];
    const normDay = normalizeArabic(dayName);

    // === FEATURE FLAG: Mode Engine Integration ===
    // Set to true to use the new pattern-based distribution engine
    // Set to false to use the legacy hardcoded logic
    const USE_MODE_ENGINE = true; // ← ENABLED: Using Mode-Based Distribution! 🚀

    const getModeMeta = () => {
        switch (modeType) {
            case 'TRIP': return { label: 'المرافقين', action: 'تعيين مرافق', role: 'مرافق', icon: Bus, color: 'emerald', desc: 'الأولوية للأكثر ارتباطاً بالطبقة' };
            case 'RAINY': return { label: 'المناوبين (داخلي)', action: 'تعيين مناوب', role: 'مناوب داخلي', icon: CloudRain, color: 'cyan', desc: 'توزيع عادل حسب العبء اليومي' };
            case 'HOLIDAY': return { label: 'المنظمين', action: 'تعيين منظم', role: 'منظم', icon: CheckSquare, color: 'violet', desc: 'استغلال المعلمين المتفرغين' };
            case 'EMERGENCY': return { label: 'فريق الطوارئ', action: 'تعيين مساند', role: 'مساند طوارئ', icon: Siren, color: 'rose', desc: 'تغطية النقص الحاد في الطاقم' };
            case 'EXAM': default: return { label: 'المراقبين', action: 'تعيين مراقب', role: 'مراقب', icon: FileText, color: 'violet', desc: 'أولوية للمربي ومعلمي التخصص' };
        }
    };

    const meta = getModeMeta();

    // Helper: Find all educators for the currently selected trip classes
    const tripEducators = useMemo(() => {
        return employees.filter(e => e.addons.educator && classes.some(c => String(c.id) === String(e.addons.educatorClassId)));
    }, [employees, classes]);

    // Calculate Trip Participants (Educators vs Companions) for Display
    // IMPORTANT: Only calculate for TRIP mode
    const tripParticipants = useMemo(() => {
        const participantIds = new Set<number>();

        // Only calculate trip participants in TRIP mode
        if (modeType === 'TRIP') {
            // 1. From Grid Assignments (Target Trip Classes)
            Object.entries(assignments).forEach(([key, list]) => {
                const { classId } = parseKey(key);
                const isTripClass = classes.some(c => String(c.id) === String(classId));
                if (isTripClass) {
                    (list as { teacherId: number, reason: string }[]).forEach(a => participantIds.add(a.teacherId));
                }
            });

            // 2. From Form Partners (The "Companions" selected in the top form)
            externalPartners.forEach(p => {
                p.userIds.forEach(uid => participantIds.add(Number(uid)));
            });
        }

        const participants = Array.from(participantIds).map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[];

        const educators: Employee[] = [];
        const companions: Employee[] = [];

        participants.forEach(p => {
            const isTripEducator = classes.some(c => String(c.id) === String(p.addons.educatorClassId));
            if (isTripEducator) educators.push(p);
            else companions.push(p);
        });

        return { educators, companions, allIds: participantIds };
    }, [assignments, employees, classes, externalPartners]);

    // Get Candidates Logic (REACTIVE - updates when assignments change)
    const getSlotCandidates = useCallback((targetClassId: string, period: number) => {
        const targetClass = allClasses.find(c => c.id === targetClassId);
        const targetEducator = employees.find(e => e.addons.educator && String(e.addons.educatorClassId) === String(targetClassId));

        console.log(`[getSlotCandidates] targetClassId: "${targetClassId}", targetEducator: ${targetEducator?.name || 'NOT FOUND'}`);
        if (targetEducator) {
            console.log(`  educatorClassId: "${targetEducator.addons.educatorClassId}" (match: ${String(targetEducator.addons.educatorClassId) === String(targetClassId)})`);
        }

        const assignedElsewhereMap = new Map<number, string>();
        Object.entries(assignments).forEach(([key, valArray]: [string, { teacherId: number, reason: string }[]]) => {
            const entries = valArray;
            const { classId, period: p } = parseKey(key);

            // Mark teachers assigned in THIS period (any class)
            if (p === period) {
                const clsName = allClasses.find(c => c.id === classId)?.name || 'مهمة أخرى';
                entries.forEach(a => {
                    // Only mark as "assigned elsewhere" if NOT the current slot we're filling
                    if (classId !== targetClassId) {
                        assignedElsewhereMap.set(a.teacherId, clsName);
                    }
                });
            }
        });

        const assignedInThisSlot = new Set<number>();
        const currentSlotAssignments = assignments[`${targetClassId}-${period}`] || [];
        currentSlotAssignments.forEach(a => assignedInThisSlot.add(a.teacherId));

        // EXCLUSION: Trip Participants
        const tripParticipantsIds = tripParticipants.allIds;

        const releasedTeachers = new Set<number>();

        // TRIP Mode: Teachers released because their classes are on trip
        if (modeType === 'TRIP') {
            lessons.filter(l =>
                l.period === period &&
                normalizeArabic(l.day) === normDay &&
                classes.some(tripC => tripC.id === l.classId)
            ).forEach(l => releasedTeachers.add(l.teacherId));
        }

        // ALL Modes: Teachers released because educator took their place
        // Check all assignments in this period
        Object.entries(assignments).forEach(([key, valArray]: [string, { teacherId: number, reason: string }[]]) => {
            const { classId, period: p } = parseKey(key);
            if (p === period) {
                valArray.forEach(assignment => {
                    const assignedTeacher = employees.find(e => e.id === assignment.teacherId);
                    const classEducator = employees.find(e => e.addons.educator && String(e.addons.educatorClassId) === String(classId));

                    // If educator was assigned to cover this class
                    if (assignedTeacher && classEducator && assignedTeacher.id === classEducator.id) {
                        // Find the original teacher of this class in this period
                        const originalLesson = lessons.find(l =>
                            l.classId === classId &&
                            l.period === period &&
                            normalizeArabic(l.day) === normDay
                        );

                        if (originalLesson && originalLesson.teacherId !== assignedTeacher.id) {
                            // This teacher was released
                            releasedTeachers.add(originalLesson.teacherId);
                        }
                    }
                });
            }
        });

        console.log(`[getSlotCandidates] Starting - employees count: ${employees.length}, educators: ${employees.filter(e => e.addons?.educator).length}`);

        const poolCandidates: any[] = [];
        const educatorCandidates: any[] = [];
        const supportCandidates: any[] = [];

        employees.forEach(emp => {
            // Debug: Log all educators
            if (emp.addons?.educator) {
                console.log(`[forEach] Educator: ${emp.name}, educatorClassId: "${emp.addons.educatorClassId}", targetClassId: "${targetClassId}", match: ${String(emp.addons.educatorClassId) === String(targetClassId)}`);
            }

            // Skip trip participants only (allow all teachers to reappear after manual removal)
            if (tripParticipantsIds.has(emp.id)) {
                if (emp.addons?.educator) console.log(`[SKIP] Educator ${emp.name} - trip participant`);
                return; // Exclude trip staff from coverage
            }

            const isInPool = poolIds.includes(emp.id);
            const isTargetEducator = targetEducator?.id === emp.id;
            const assignedToClass = assignedElsewhereMap.get(emp.id);
            const isEducator = emp.addons.educator;

            // EXCLUSION: Off-Duty (BUT educators already handled above)
            if (!emp.constraints.isExternal && !isInPool && !isEducator) {
                const dayLessons = lessons.filter(l => l.teacherId === emp.id && normalizeArabic(l.day) === normDay).map(l => l.period);
                if (dayLessons.length === 0) return;
                const startP = Math.min(...dayLessons);
                const endP = Math.max(...dayLessons);
                if (period < startP || period > endP) return;
            }

            const lesson = lessons.find(l => l.teacherId === emp.id && l.period === period && normalizeArabic(l.day) === normDay);

            let statusType = 'FREE';
            let statusLabel = 'فراغ (نافذة)';
            let isReleased = false;
            let priority = 50;

            if (releasedTeachers.has(emp.id)) {
                statusType = 'RELEASED_BY_TRIP';
                statusLabel = modeType === 'TRIP' ? 'حر (بسبب الرحلة)' : 'حر (بسبب التبديل)';
                isReleased = true;
                priority = 1;
            } else if (lesson) {
                const lType = lesson.type ? lesson.type.toLowerCase() : '';
                if (lType === 'stay') {
                    statusType = 'STAY';
                    statusLabel = `مكوث (${lesson.subject})`;
                } else if (lType === 'individual') {
                    statusType = 'INDIVIDUAL';
                    statusLabel = `فردي (${lesson.subject})`;
                } else {
                    const isTeachingTargetClass = String(lesson.classId) === String(targetClassId);
                    if (isTeachingTargetClass) {
                        statusType = 'RELEASED';
                        statusLabel = `معلم الحصة (${lesson.subject})`;
                        isReleased = true;
                    } else {
                        statusType = 'ACTUAL';
                        statusLabel = `فعلي: ${lesson.subject}`;
                    }
                }
            }

            if (assignedToClass) {
                statusLabel = `مشغول في: ${assignedToClass}`;
                priority = 999;
            }

            if (statusType === 'RELEASED_BY_TRIP') priority = 0;
            else if (isTargetEducator) priority = 2; // Educator has high priority
            else if (statusType === 'INDIVIDUAL') priority = 10;
            else if (statusType === 'STAY') priority = 15;
            else if (statusType === 'FREE') priority = 20;
            else priority = 50;

            if (isInPool && statusType !== 'ACTUAL' && !assignedToClass) {
                poolCandidates.push({ emp, label: emp.constraints.isExternal ? 'بديل خارجي' : `احتياط: ${statusLabel}`, type: 'POOL', priority: 0 });
                return;
            }

            // CRITICAL: Add ALL educators (not just target) and ALWAYS show them
            if (emp.addons?.educator) {
                const displayLabel = assignedToClass && !isTargetEducator ?
                    `${statusLabel} - موزع في ${assignedToClass}` : statusLabel;
                educatorCandidates.push({
                    emp,
                    label: displayLabel,
                    type: statusType,
                    priority,
                    isTarget: isTargetEducator,
                    isAssigned: false // ALWAYS false to ensure visibility
                });
                console.log(`[ADDED Educator] ${emp.name}, isTarget: ${isTargetEducator}, label: ${displayLabel}`);
                return;
            }

            // Exclude regular teachers/support staff already assigned in this period (but NOT educators)
            if (assignedToClass && !emp.addons.educator) {
                return; // Don't show in candidate list if assigned elsewhere
            }

            // Include support staff (only if not assigned)
            supportCandidates.push({ emp, label: statusLabel, type: statusType, priority, isAssigned: false });
        });

        return {
            poolCandidates: poolCandidates.sort((a, b) => a.priority - b.priority),
            educatorCandidates: educatorCandidates.sort((a, b) => a.priority - b.priority),
            supportCandidates: supportCandidates.sort((a, b) => a.priority - b.priority)
        };
    }, [assignments, employees, allClasses, lessons, poolIds, tripParticipants, modeType, normDay]);

    // --- AUTO DISTRIBUTION LOGIC ---
    const handleAutoDistribute = () => {
        if (!onBulkAssign) return;

        console.log('=== AUTO DISTRIBUTE START ===');
        console.log('USE_MODE_ENGINE:', USE_MODE_ENGINE);
        console.log('engineContext:', engineContext);
        console.log('modeType:', modeType);

        // === NEW: Mode Engine Integration (Feature Flag) ===
        if (USE_MODE_ENGINE && engineContext) {
            const linkedMode = findLinkedMode(engineContext, modeType as any);
            console.log('linkedMode found:', linkedMode);

            if (linkedMode) {
                console.log('Using mode:', linkedMode.name, 'with', linkedMode.priorityLadder?.length || 0, 'priorities');
                addToast(`⚙️ استخدام نمط: ${linkedMode.name}`, 'info');

                // Build distribution context
                const newAssignments: any[] = [];

                classes.forEach(cls => {
                    periods.forEach(period => {
                        // Skip if already assigned
                        const existing = assignments[`${cls.id}-${period}`];
                        if (existing && existing.length > 0) return;

                        // Get original teacher
                        const originalLesson = lessons.find(l =>
                            l.classId === cls.id &&
                            l.period === period &&
                            normalizeArabic(l.day) === normDay
                        );

                        const context: DistributionContext = {
                            date,
                            period,
                            classId: cls.id,
                            originalTeacherId: originalLesson?.teacherId,
                            educatorId: employees.find(e =>
                                e.addons?.educator &&
                                String(e.addons.educatorClassId) === String(cls.id)
                            )?.id,
                            modeType: modeType as any,
                            allLessons: lessons,
                            allClasses: allClasses,
                            substitutionLogs: substitutionLogs
                        };

                        // Apply mode rules
                        const rankedCandidates = applyModeRulesToDistribution(
                            linkedMode,
                            employees,
                            context
                        );

                        // Pick the best candidate
                        const best = rankedCandidates[0];
                        if (best && best.score > 0) {
                            newAssignments.push({
                                classId: cls.id,
                                period,
                                teacherId: best.employee.id,
                                reason: best.reason
                            });
                        }
                    });
                });

                if (newAssignments.length > 0) {
                    onBulkAssign(newAssignments);
                    addToast(` تم توزيع ${newAssignments.length} مهمة باستخدام ${linkedMode.name}`, 'success');
                } else {
                    addToast('⚠️ لا يوجد مرشحين مناسبين', 'warning');
                }
                return; // Exit early - don't use legacy logic
            } else {
                addToast(`⚠️ لا يوجد نمط مرتبط بـ ${modeType} - استخدام المنطق القديم`, 'info');
            }
        }

        // === LEGACY LOGIC (Original) ===
        // This code remains unchanged for backward compatibility

        // Special logic for TRIP mode (companion selection)
        if (modeType === 'TRIP') {
            const tripTargetClasses = classes.map(c => c.id);
            const tripEducatorIds = tripEducators.map(e => e.id);

            const teacherStats: Record<number, { count: number, classCounts: Record<string, number> }> = {};

            lessons.forEach(l => {
                if (normalizeArabic(l.day) === normDay && !tripEducatorIds.includes(l.teacherId)) {
                    if (tripTargetClasses.includes(l.classId)) {
                        if (!teacherStats[l.teacherId]) {
                            teacherStats[l.teacherId] = { count: 0, classCounts: {} };
                        }
                        teacherStats[l.teacherId].count++;
                        teacherStats[l.teacherId].classCounts[l.classId] = (teacherStats[l.teacherId].classCounts[l.classId] || 0) + 1;
                    }
                }
            });

            const candidates = Object.entries(teacherStats).map(([tid, stats]) => {
                const emp = employees.find(e => e.id === Number(tid));
                if (!emp) return null;
                const mainClassId = Object.keys(stats.classCounts).sort((a, b) => stats.classCounts[b] - stats.classCounts[a])[0];
                return { emp, score: stats.count, gradeCount: stats.count, mainClassId: mainClassId || tripTargetClasses[0] };
            }).filter(Boolean) as any[];

            candidates.sort((a, b) => b.score - a.score);
            setTripCandidates(candidates);
            setSelectedCandidateIds([]);
            setShowTripRecommendations(true);
            return; // Exit after showing trip recommendations
        }

        // NEW: Special logic for RAINY mode with class merging
        if (modeType === 'RAINY') {
            const newAssignments: any[] = [];
            const allWarnings: string[] = []; // NEW: Track all warnings across groups
            let totalUncoveredSlots = 0; // NEW: Track total uncovered slots

            // Group classes by grade level AND type (general/special)
            const gradeGroups: Record<string, ClassItem[]> = {};
            classes.forEach(cls => {
                const grade = cls.gradeLevel || 'غير محدد';
                const classType = cls.type || 'general';
                const groupKey = `${grade}-${classType}`; // Separate: "1-general", "1-special"
                if (!gradeGroups[groupKey]) gradeGroups[groupKey] = [];
                gradeGroups[groupKey].push(cls);
            });

            // Process each grade+type group
            Object.entries(gradeGroups).forEach(([groupKey, gradeClasses]) => {
                const [gradeStr, classType] = groupKey.split('-');
                const grade = gradeStr;
                const mergedClassIds = rainyMergeGroups[groupKey] || [];
                const mergeCount = mergedClassIds.length;

                // NEW: If no merging (no classes selected), keep original schedule as much as possible
                if (mergeCount <= 1) {
                    // Keep original teachers, only redistribute if teacher teaches multiple grades
                    gradeClasses.forEach(cls => {
                        periods.forEach(period => {
                            const originalLesson = lessons.find(l =>
                                l.classId === cls.id &&
                                l.period === period &&
                                normalizeArabic(l.day) === normDay
                            );

                            if (originalLesson) {
                                const originalTeacher = employees.find(e => e.id === originalLesson.teacherId);
                                if (originalTeacher) {
                                    // Check if this teacher teaches multiple grades today
                                    const teacherGrades = new Set<string>();
                                    lessons.forEach(l => {
                                        if (l.teacherId === originalTeacher.id && normalizeArabic(l.day) === normDay) {
                                            const lessonClass = allClasses.find(c => c.id === l.classId);
                                            if (lessonClass) {
                                                teacherGrades.add(String(lessonClass.gradeLevel));
                                            }
                                        }
                                    });

                                    // Keep original teacher assignment
                                    newAssignments.push({
                                        classId: cls.id,
                                        period,
                                        teacherId: originalTeacher.id,
                                        reason: teacherGrades.size > 1 ? `أصلي (يعلم ${teacherGrades.size} طبقات)` : 'أصلي'
                                    });
                                }
                            }
                        });
                    });
                    return; // Skip fair distribution for non-merged classes
                }

                // Get all teachers for this grade with their lesson info
                // NEW: Only process MERGED classes (selected in checkboxes)
                const mergedClasses = gradeClasses.filter(cls => mergedClassIds.includes(cls.id));
                if (mergedClasses.length === 0) return; // No classes selected for merging

                // NEW: Build teacher map with conflict detection
                const gradeTeachersMap = new Map<number, {
                    emp: Employee,
                    totalLessons: number,
                    totalLessonsInMerged: number,
                    firstPeriod: number,
                    lastPeriod: number,
                    assignedCount: number,
                    conflictPeriods: Set<number>, // NEW: Periods where teacher has lessons in OTHER grades
                    teachesMultipleGrades: boolean // NEW: Flag if teacher teaches non-merged grades
                }>();

                const mergedClassIdsSet = new Set(mergedClassIds);

                mergedClasses.forEach(cls => {
                    lessons.forEach(l => {
                        if (l.classId === cls.id && normalizeArabic(l.day) === normDay) {
                            if (!gradeTeachersMap.has(l.teacherId)) {
                                const emp = employees.find(e => e.id === l.teacherId);
                                if (emp && !emp.constraints.isExternal) { // NEW: Exclude external teachers
                                    // Count total lessons for this teacher today (ALL grades)
                                    const teacherLessons = lessons.filter(tl =>
                                        tl.teacherId === l.teacherId &&
                                        normalizeArabic(tl.day) === normDay
                                    );

                                    // NEW: Count lessons ONLY in merged classes
                                    const lessonsInMerged = teacherLessons.filter(tl =>
                                        mergedClassIdsSet.has(tl.classId)
                                    );

                                    // NEW: Detect conflict periods (lessons in OTHER grades)
                                    const conflictPeriods = new Set<number>();
                                    teacherLessons.forEach(tl => {
                                        if (!mergedClassIdsSet.has(tl.classId)) {
                                            conflictPeriods.add(tl.period);
                                        }
                                    });

                                    // NEW: Check if teacher teaches multiple grades
                                    const teacherGradesSet = new Set<string>();
                                    teacherLessons.forEach(tl => {
                                        const lessonClass = allClasses.find(c => c.id === tl.classId);
                                        if (lessonClass) {
                                            teacherGradesSet.add(String(lessonClass.gradeLevel));
                                        }
                                    });

                                    const firstPeriod = Math.min(...teacherLessons.map(tl => tl.period));
                                    const lastPeriod = Math.max(...teacherLessons.map(tl => tl.period));

                                    gradeTeachersMap.set(l.teacherId, {
                                        emp,
                                        totalLessons: teacherLessons.length,
                                        totalLessonsInMerged: lessonsInMerged.length,
                                        firstPeriod,
                                        lastPeriod,
                                        assignedCount: 0,
                                        conflictPeriods,
                                        teachesMultipleGrades: teacherGradesSet.size > 1
                                    });
                                }
                            }
                        }
                    });
                });

                const teachersList = Array.from(gradeTeachersMap.values());
                if (teachersList.length === 0) return;

                // NEW: Calculate fair distribution with conflict awareness
                const totalPeriods = mergedClasses.length * periods.length;
                const avgPeriodsPerTeacher = Math.ceil(totalPeriods / teachersList.length);

                // Shuffle for variety
                const shuffledTeachers = [...teachersList].sort(() => Math.random() - 0.5);

                // Assign periods fairly with CONFLICT DETECTION
                mergedClasses.forEach(cls => {
                    periods.forEach(period => {
                        // NEW: Find eligible teachers with STRICT conflict filtering
                        const eligibleTeachers = shuffledTeachers.filter(t => {
                            // CRITICAL: Check for direct conflict (teacher has lesson in OTHER grade at same period)
                            if (t.conflictPeriods.has(period)) {
                                return false; // ❌ BLOCKED: Teacher is in another grade at this time!
                            }

                            // Check: assigned count < total lessons in MERGED classes only
                            // NEW: Use totalLessonsInMerged instead of totalLessons
                            if (t.assignedCount >= t.totalLessonsInMerged) return false;

                            // Check: period >= first period (don't assign before work starts)
                            if (period < t.firstPeriod) return false;

                            // Check: period <= last period (don't assign after work hours)
                            if (period > t.lastPeriod) return false;

                            // Check: fair distribution (not too many assignments)
                            if (t.assignedCount >= avgPeriodsPerTeacher) return false;

                            return true;
                        });

                        // Sort by: least assigned first
                        eligibleTeachers.sort((a, b) => a.assignedCount - b.assignedCount);

                        if (eligibleTeachers.length === 0) {
                            // NEW: Enhanced Fallback with conflict-aware logic
                            const fallbackTeachers = shuffledTeachers.filter(t => {
                                // CRITICAL: Still respect conflict periods (NEVER assign if conflicted)
                                if (t.conflictPeriods.has(period)) return false;

                                // Relax workload constraint slightly (+1)
                                if (t.assignedCount >= t.totalLessonsInMerged + 1) return false;

                                // Still respect work hours
                                if (period < t.firstPeriod || period > t.lastPeriod) return false;

                                return true;
                            });

                            if (fallbackTeachers.length > 0) {
                                fallbackTeachers.sort((a, b) => a.assignedCount - b.assignedCount);
                                const selected = fallbackTeachers[0];

                                // NEW: Add warning badge for multi-grade teachers
                                const reasonSuffix = selected.teachesMultipleGrades ? ` ⚠️ (يُدرّس طبقات متعددة)` : '';

                                newAssignments.push({
                                    classId: cls.id,
                                    period,
                                    teacherId: selected.emp.id,
                                    reason: `دمج ${mergeCount} صف - عادل${reasonSuffix}`
                                });
                                selected.assignedCount++;
                            } else {
                                // NEW: Track uncovered slots
                                totalUncoveredSlots++;
                                const className = allClasses.find(c => c.id === cls.id)?.name || cls.id;
                                allWarnings.push(`${className} - ح${period}: لا معلم متاح (تعارض أو خارج الدوام)`);
                            }
                            return;
                        }

                        // Select teacher with least assignments
                        const selectedTeacher = eligibleTeachers[0];

                        // NEW: Add warning badge for multi-grade teachers
                        const gradeWarning = selectedTeacher.teachesMultipleGrades ? ` ⚠️ (يُدرّس ${selectedTeacher.conflictPeriods.size > 0 ? 'طبقات أخرى' : 'طبقات متعددة'})` : '';

                        newAssignments.push({
                            classId: cls.id,
                            period,
                            teacherId: selectedTeacher.emp.id,
                            reason: `دمج ${mergeCount} صف - توزيع عادل (${selectedTeacher.assignedCount + 1}/${selectedTeacher.totalLessonsInMerged})${gradeWarning}`
                        });

                        selectedTeacher.assignedCount++;
                    });
                });
            });

            // NEW: Show comprehensive summary with warnings
            if (newAssignments.length > 0) {
                onBulkAssign(newAssignments);

                let summaryMessage = `تم توزيع ${newAssignments.length} حصة بشكل عادل`;

                if (totalUncoveredSlots > 0) {
                    summaryMessage += ` | ⚠️ ${totalUncoveredSlots} حصة تحتاج تغطية يدوية`;
                }

                addToast(summaryMessage, totalUncoveredSlots > 0 ? 'warning' : 'success');

                // Show detailed warnings if any
                if (allWarnings.length > 0 && allWarnings.length <= 5) {
                    allWarnings.forEach(w => addToast(w, 'warning'));
                } else if (allWarnings.length > 5) {
                    addToast(`${allWarnings.length} فجوة تحتاج مراجعة يدوية - افتح الجدول للتفاصيل`, 'warning');
                }
            } else {
                addToast('لا يمكن التوزيع - تحقق من إعدادات الدمج وعدد المعلمين', 'error');
            }
            return;
        }

        // Enhanced Auto-Distribution for all modes (EXAM, etc.)
        const newAssignments: any[] = [];
        const batchAssignments: Record<string, number[]> = {};

        classes.forEach(cls => {
            const educator = employees.find(e => e.addons.educator && String(e.addons.educatorClassId) === String(cls.id));

            periods.forEach(period => {
                const periodKey = `${date}-${period}`;
                if (!batchAssignments[periodKey]) {
                    batchAssignments[periodKey] = [];
                }

                // Skip if already assigned
                const existing = assignments[`${cls.id}-${period}`];
                if (existing && existing.length > 0) return;

                // Get original lesson teacher for this class/period
                const originalLesson = lessons.find(l =>
                    l.classId === cls.id &&
                    l.period === period &&
                    normalizeArabic(l.day) === normDay
                );

                const originalTeacher = originalLesson ? employees.find(e => e.id === originalLesson.teacherId) : null;

                // Get available candidates from ALL employees
                const availableCandidates = employees.filter(e => {
                    // Exclude external employees (they should not be auto-distributed)
                    if (e.constraints.isExternal) return false;
                    // Exclude internal support staff (baseRoleId: support, counselor, etc.)
                    if (['support', 'counselor', 'librarian', 'lab_tech'].includes(e.baseRoleId)) return false;
                    return true;
                });

                // Priority ranking
                const rankedCandidates = availableCandidates.map(cand => {
                    // Check if already assigned in this period
                    if (batchAssignments[periodKey]?.includes(cand.id)) {
                        return { ...cand, priority: -1, reason: 'معيّن بالفعل', lessonType: null };
                    }

                    // Check lesson type
                    const candLesson = lessons.find(l =>
                        l.teacherId === cand.id &&
                        normalizeArabic(l.day) === normDay &&
                        l.period === period
                    );

                    const lessonType = candLesson?.type?.toLowerCase();

                    // EXCLUDE: Stay/Makooth (manual only - not available for auto-distribution)
                    // Check this FIRST before any priority
                    if (lessonType === 'stay' || lessonType === 'makooth') {
                        return { ...cand, priority: -1, reason: 'حصة مكوث (يدوي فقط)', lessonType: 'makooth' };
                    }

                    // Priority 1: Educator for this class (HIGHEST - even if has individual/actual lesson)
                    if (educator && cand.id === educator.id) {
                        const typeLabel = lessonType === 'individual' ? 'فردي' : candLesson ? 'فعلي' : 'فارغ';
                        return { ...cand, priority: 1, reason: `مربي الصف (${typeLabel})`, lessonType };
                    }

                    // Priority 2: Original teacher of this class/period (if not educator)
                    if (originalTeacher && cand.id === originalTeacher.id) {
                        const typeLabel = lessonType === 'individual' ? 'فردي' : 'فعلي';
                        return { ...cand, priority: 2, reason: `معلم الحصة الأصلي (${typeLabel})`, lessonType };
                    }

                    // Priority 3: Available (no lesson)
                    if (!candLesson) {
                        return { ...cand, priority: 3, reason: 'متاح - فراغ', lessonType: null };
                    }

                    // Priority 4: Individual lesson
                    if (lessonType === 'individual') {
                        return { ...cand, priority: 4, reason: 'حصة فردية', lessonType: 'individual' };
                    }

                    // Default: has regular lesson
                    return { ...cand, priority: 5, reason: 'لديه حصة' };
                }).filter(c => c.priority > 0 && c.priority <= 4); // Only: Educator, Original Teacher, Available, Individual

                // Sort by priority
                rankedCandidates.sort((a, b) => a.priority - b.priority);

                // Assign best candidate
                if (rankedCandidates.length > 0) {
                    const best = rankedCandidates[0];
                    newAssignments.push({
                        classId: cls.id,
                        period,
                        teacherId: best.id,
                        reason: best.reason
                    });
                    batchAssignments[periodKey].push(best.id);
                } else {
                    // No suitable candidates - check why
                    // Check if educator has makooth lesson
                    const educatorLesson = educator ? lessons.find(l =>
                        l.teacherId === educator.id &&
                        normalizeArabic(l.day) === normDay &&
                        l.period === period
                    ) : null;

                    if (educatorLesson) {
                        const lessonType = educatorLesson.type?.toLowerCase();
                        if (lessonType === 'stay' || lessonType === 'makooth') {
                            // Keep original teacher - educator has makooth
                            if (originalTeacher) {
                                newAssignments.push({
                                    classId: cls.id,
                                    period,
                                    teacherId: originalTeacher.id,
                                    reason: 'المربي لديه مكوث - لم يتم التبديل'
                                });
                            }
                        }
                    }
                }
            });
        });

        if (newAssignments.length > 0) {
            onBulkAssign(newAssignments);
            addToast(`تم توزيع ${newAssignments.length} مهمة تلقائياً`, "success");
        } else {
            addToast('لم يتم العثور على مرشحين متاحين', 'warning');
        }
    };

    const handleConfirmSelectedCompanions = () => {
        if (!onBulkAssign || selectedCandidateIds.length === 0) return;
        const newAssignments: any[] = [];
        selectedCandidateIds.forEach(id => {
            const candidate = tripCandidates.find(c => c.emp.id === id);
            if (!candidate) return;
            periods.forEach(p => {
                const existingAssignments = assignments[`${candidate.mainClassId}-${p}`] || [];
                const isAlreadyInSlot = existingAssignments.some(a => a.teacherId === candidate.emp.id);
                if (!isAlreadyInSlot) {
                    newAssignments.push({ classId: candidate.mainClassId, period: p, teacherId: candidate.emp.id, reason: `مرافق رحلة` });
                }
            });
        });
        if (newAssignments.length > 0) {
            onBulkAssign(newAssignments);
            addToast(`تم إضافة ${selectedCandidateIds.length} مرافقين`, "success");
        }
        setShowTripRecommendations(false);
        setSelectedCandidateIds([]);
    };

    const handleRemoveCompanion = (teacherId: number) => {
        let removedCount = 0;
        classes.forEach(cls => {
            periods.forEach(p => {
                const key = `${cls.id}-${p}`;
                const slotAssigns = assignments[key];
                if (slotAssigns && slotAssigns.some(a => a.teacherId === teacherId)) {
                    onRemove(cls.id, p, teacherId);
                    removedCount++;
                }
            });
        });
        if (removedCount > 0) addToast("تم حذف المرافق وإلغاء مهامه", "success");
    };

    // NEW: Assign companion to all periods of a specific class
    const handleAssignCompanionToClass = (classId: string, companionId: number) => {
        if (!onBulkAssign) return;

        // Update state
        setTripClassCompanions(prev => ({ ...prev, [classId]: companionId }));

        // Create assignments for all target periods
        const newAssignments: any[] = [];
        periods.forEach(p => {
            const key = `${classId}-${p}`;
            const existingAssignments = assignments[key] || [];

            // Remove old companion if exists
            const oldCompanionId = tripClassCompanions[classId];
            if (oldCompanionId) {
                onRemove(classId, p, oldCompanionId);
            }

            // Check if new companion already assigned
            const isAlreadyInSlot = existingAssignments.some(a => a.teacherId === companionId);
            if (!isAlreadyInSlot) {
                newAssignments.push({ classId, period: p, teacherId: companionId, reason: `مرافق رحلة` });
            }
        });

        if (newAssignments.length > 0) {
            onBulkAssign(newAssignments);
            const companion = employees.find(e => e.id === companionId);
            addToast(`تم تعيين ${companion?.name} مرافقاً لكل الحصص`, "success");
        }
    };

    const handleAssignEducators = () => {
        if (!onBulkAssign) return;
        const newAssignments: any[] = [];
        tripEducators.forEach(educator => {
            const clsId = educator.addons.educatorClassId!;
            periods.forEach(p => {
                const existing = assignments[`${clsId}-${p}`] || [];
                if (!existing.some(a => a.teacherId === educator.id)) {
                    newAssignments.push({ classId: clsId, period: p, teacherId: educator.id, reason: `مربي الصف` });
                }
            });
        });
        if (newAssignments.length > 0) onBulkAssign(newAssignments);
    };

    // Calculate Impact (Merged Logic)
    const impactedSlots = useMemo(() => {
        if (modeType !== 'TRIP') return [];
        // Use the merged participant list (Assignments + Form Partners)
        const tripTeacherIds = tripParticipants.allIds;

        const impacts: any[] = [];
        tripTeacherIds.forEach(tid => {
            const emp = employees.find(e => e.id === tid);
            if (!emp) return;
            lessons.filter(l => l.teacherId === tid && normalizeArabic(l.day) === normDay).forEach(l => {
                // If the lesson is NOT for a trip class, it's a gap (impact)
                if (!classes.some(c => c.id === l.classId)) {
                    impacts.push({ period: l.period, lesson: l, originalTeacher: emp });
                }
            });
        });
        return impacts.sort((a, b) => a.period - b.period);
    }, [assignments, modeType, lessons, classes, normDay, employees, tripParticipants]);

    const impactedClasses = useMemo(() => {
        const classIds = Array.from(new Set(impactedSlots.map(s => s.lesson.classId)));
        return allClasses.filter(c => classIds.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
    }, [impactedSlots, allClasses]);

    return (
        <div className="space-y-4 animate-fade-in flex flex-col h-full min-h-[400px]">
            {/* Visual Status Legend */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-3 rounded-xl border border-slate-200">
                <h5 className="text-[10px] font-black text-slate-700 mb-2 flex items-center gap-2">
                    <AlertCircle size={12} /> دليل حالة المعلمين
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-emerald-200">
                        <div className="w-6 h-6 rounded bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-emerald-700">متاح</p>
                            <p className="text-[7px] text-slate-500">أولوية عالية</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-blue-200">
                        <div className="w-6 h-6 rounded bg-blue-100 border border-blue-300 flex items-center justify-center">
                            <GraduationCap size={12} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-blue-700">مربي</p>
                            <p className="text-[7px] text-slate-500">أولوية قصوى</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-purple-200">
                        <div className="w-6 h-6 rounded bg-purple-100 border border-purple-300 flex items-center justify-center">
                            <Users size={12} className="text-purple-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-purple-700">فردي</p>
                            <p className="text-[7px] text-slate-500">متوسطة</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-orange-200">
                        <div className="w-6 h-6 rounded bg-orange-100 border border-orange-300 flex items-center justify-center">
                            <Coffee size={12} className="text-orange-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-orange-700">مكوث</p>
                            <p className="text-[7px] text-slate-500">منخفضة</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-red-200">
                        <div className="w-6 h-6 rounded bg-red-100 border border-red-300 flex items-center justify-center">
                            <Unlock size={12} className="text-red-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-red-700">مشغول</p>
                            <p className="text-[7px] text-slate-500">غير متاح</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Header Controls */}
            <div className="flex justify-between items-center mb-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                    <div>
                        <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <LayoutGrid size={18} className={`text-${meta.color}-600`} />
                            توزيع {meta.label}
                        </h4>
                        {(() => {
                            // Find teachers with actual lessons who are NOT assigned yet
                            const unassignedTeachers = new Set<number>();

                            classes.forEach(cls => {
                                periods.forEach(p => {
                                    const originalLesson = lessons.find(l =>
                                        l.classId === cls.id &&
                                        l.period === p &&
                                        normalizeArabic(l.day) === normDay
                                    );

                                    if (originalLesson) {
                                        // Check if this slot has been assigned
                                        const slotAssignments = assignments[`${cls.id}-${p}`] || [];

                                        // If not assigned OR assigned to same teacher, count as unassigned
                                        if (slotAssignments.length === 0 ||
                                            slotAssignments.every(a => a.teacherId === originalLesson.teacherId)) {
                                            unassignedTeachers.add(originalLesson.teacherId);
                                        }
                                    }
                                });
                            });

                            const unassignedList = Array.from(unassignedTeachers)
                                .map(id => employees.find(e => e.id === id))
                                .filter(Boolean) as Employee[];

                            if (unassignedList.length > 0) {
                                return (
                                    <p className="text-[9px] text-slate-500 mt-0.5">
                                        متبقين ({unassignedList.length}): {unassignedList.map(t => t.name.split(' ').slice(0, 2).join(' ')).join('، ')}
                                    </p>
                                );
                            } else {
                                return (
                                    <p className="text-[9px] text-emerald-600 mt-0.5 font-bold">
                                        ✔ تم توزيع جميع الحصص
                                    </p>
                                );
                            }
                        })()}
                    </div>

                    {(modeType === 'TRIP' || modeType === 'EXAM' || modeType === 'RAINY') && (
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <button onClick={() => setViewPhase('SELECTION')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewPhase === 'SELECTION' ? (modeType === 'TRIP' ? 'bg-emerald-100 text-emerald-700' : modeType === 'EXAM' ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700') : 'text-slate-500 hover:bg-slate-50'}`}>
                                1. {modeType === 'TRIP' ? 'اختيار المرافقين' : modeType === 'EXAM' ? 'توزيع المراقبين' : 'توزيع الحصص'}
                            </button>
                            <ArrowRightLeft size={14} className="mx-1 text-slate-300 self-center" />
                            <button onClick={() => setViewPhase('COVERAGE')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewPhase === 'COVERAGE' ? 'bg-rose-100 text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                                2. سد الفجوات ({impactedSlots.length})
                            </button>
                        </div>
                    )}
                </div>

                {onBulkAssign && (viewPhase === 'SELECTION' || (modeType !== 'TRIP' && modeType !== 'EXAM')) && (
                    <div className="flex gap-2">
                        {modeType === 'TRIP' && (
                            <button onClick={handleAssignEducators} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border border-indigo-200">
                                <GraduationCap size={14} /> تثبيت المربين
                            </button>
                        )}
                        {modeType === 'RAINY' && (
                            <button onClick={() => setShowRainyMergeModal(true)} className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border border-cyan-200">
                                <LayoutGrid size={14} /> إعدادات الدمج
                            </button>
                        )}
                        <button onClick={handleAutoDistribute} className={`bg-${meta.color}-50 hover:bg-${meta.color}-100 text-${meta.color}-700 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border border-${meta.color}-200 shadow-sm`}>
                            <Wand2 size={14} /> {modeType === 'TRIP' ? 'اقتراح مرافقين' : 'توزيع آلي'}
                        </button>
                    </div>
                )}
            </div>

            {/* NEW: Trip Class Companion Assignment (appears after "اقتراح مرافقين" is clicked) */}
            {modeType === 'TRIP' && tripCandidates.length > 0 && classes.length > 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border-2 border-emerald-200 mb-4">
                    <h5 className="font-black text-lg text-emerald-900 mb-4 flex items-center gap-2">
                        <Bus size={20} className="text-emerald-600" />
                        تعيين مرافق لكل صف (لجميع الحصص)
                    </h5>
                    <div className="space-y-4">
                        {classes.map(cls => {
                            const educator = tripEducators.find(e => String(e.addons.educatorClassId) === String(cls.id));
                            const selectedCompanionId = tripClassCompanions[cls.id];
                            const selectedCompanion = selectedCompanionId ? employees.find(e => e.id === selectedCompanionId) : null;

                            // FIXED: Get only SELECTED companions (from اعتماد button)
                            const availableCompanions = tripCandidates.filter(c =>
                                selectedCandidateIds.includes(c.emp.id) && // Only selected ones
                                (c.mainClassId === String(cls.id) || !Object.values(tripClassCompanions).includes(c.emp.id))
                            );

                            return (
                                <div key={cls.id} className="bg-white p-4 rounded-xl border-2 border-emerald-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <h6 className="font-black text-sm text-slate-800">{cls.name}</h6>
                                        <span className="text-[10px] font-bold text-slate-500">كل الحصص المستهدفة</span>
                                    </div>

                                    {/* Educator */}
                                    {educator && (
                                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 mb-3">
                                            <div className="flex items-center gap-2">
                                                <GraduationCap size={16} className="text-indigo-600" />
                                                <div className="flex-1">
                                                    <span className="text-[10px] font-bold text-indigo-500">مربي الصف</span>
                                                    <p className="font-black text-sm text-indigo-900">{educator.name}</p>
                                                </div>
                                                <div className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black">مربي</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Companion Selector */}
                                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                                        <label className="flex items-center gap-2 mb-2">
                                            <Bus size={16} className="text-emerald-600" />
                                            <span className="text-[10px] font-bold text-emerald-700">مرافق لكل الحصص</span>
                                        </label>
                                        {availableCompanions.length > 0 ? (
                                            <select
                                                value={selectedCompanionId || ''}
                                                onChange={(e) => {
                                                    const companionId = Number(e.target.value);
                                                    if (companionId) {
                                                        handleAssignCompanionToClass(String(cls.id), companionId);
                                                    }
                                                }}
                                                className="w-full p-2 rounded-lg border-2 border-emerald-300 bg-white font-bold text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition-all"
                                            >
                                                <option value="">اختر مرافق...</option>
                                                {availableCompanions.map(cand => (
                                                    <option key={cand.emp.id} value={cand.emp.id}>
                                                        {cand.emp.name} ({cand.gradeCount} حصص)
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">لا توجد مرشحين متاحين</p>
                                        )}
                                        {selectedCompanion && (
                                            <div className="mt-2 flex items-center justify-between bg-white p-2 rounded-lg border border-emerald-300">
                                                <span className="text-xs font-black text-emerald-900">{selectedCompanion.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Remove companion from all periods
                                                        periods.forEach(p => onRemove(String(cls.id), p, selectedCompanionId));
                                                        setTripClassCompanions(prev => {
                                                            const updated = { ...prev };
                                                            delete updated[cls.id];
                                                            return updated;
                                                        });
                                                    }}
                                                    className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition-all"
                                                    title="إزالة المرافق"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="overflow-auto custom-scrollbar rounded-3xl border border-slate-200 shadow-sm flex-1 bg-white relative">
                {viewPhase === 'SELECTION' ? (
                    <table className="w-full text-xs font-bold text-center border-collapse">
                        <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
                            <tr>
                                <th className="p-4 w-40 border-l border-slate-700 text-right">الصف / الحصة</th>
                                {periods.map(p => <th key={p} className="p-4 min-w-[140px] border-l border-slate-700">حصة {p}</th>)}
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {classes.map((cls, index) => {
                                const educator = employees.find(e => e.addons.educator && String(e.addons.educatorClassId) === String(cls.id));

                                // NEW: Check if this class is part of a merged group
                                const grade = cls.gradeLevel || 'غير محدد';
                                const classType = cls.type || 'general';
                                const groupKey = `${grade}-${classType}`;
                                const mergedClassIds = rainyMergeGroups[groupKey] || [];
                                const isMerged = modeType === 'RAINY' && mergedClassIds.includes(cls.id);

                                return (
                                    <tr key={cls.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                        <td className="p-4 bg-slate-50 font-black text-slate-800 border-l border-slate-200 text-right sticky right-0 z-10">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">{cls.name}</span>
                                                    {isMerged && (
                                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-100 border border-cyan-300">
                                                            <LayoutGrid size={10} className="text-cyan-600" />
                                                            <span className="text-[8px] font-black text-cyan-700">دمج {mergedClassIds.length}</span>
                                                        </div>
                                                    )}
                                                    {classType === 'special' && (
                                                        <span className="text-[8px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-black">خاصة</span>
                                                    )}
                                                </div>
                                                {educator && <span className="text-[9px] text-slate-400 font-normal mt-1">{educator.name.split(' ').slice(0, 2).join(' ')}</span>}
                                            </div>
                                        </td>
                                        {periods.map(p => {
                                            const slotAssignments = assignments[`${cls.id}-${p}`] || [];
                                            const assignedTeachers = slotAssignments.map(a => employees.find(e => e.id === a.teacherId)).filter(Boolean) as Employee[];
                                            const originalLesson = lessons.find(l => l.classId === cls.id && l.period === p && normalizeArabic(l.day) === normDay);

                                            let cellStyle = 'bg-slate-50';

                                            // Check educator's lesson type first (for visual coding)
                                            if (educator) {
                                                const educatorLesson = lessons.find(l =>
                                                    l.teacherId === educator.id &&
                                                    normalizeArabic(l.day) === normDay &&
                                                    l.period === p
                                                );

                                                if (educatorLesson) {
                                                    const lessonType = educatorLesson.type?.toLowerCase();
                                                    if (lessonType === 'individual') {
                                                        cellStyle = 'bg-pink-50 border border-pink-300';
                                                    } else if (lessonType === 'stay' || lessonType === 'makooth') {
                                                        cellStyle = 'bg-orange-50 border border-orange-200';
                                                    } else if (assignedTeachers.length === 0) {
                                                        // Regular lesson but not assigned yet
                                                        cellStyle = 'bg-slate-100 border border-slate-200';
                                                    }
                                                } else if (assignedTeachers.length === 0) {
                                                    // Educator is free and not assigned
                                                    cellStyle = 'bg-emerald-50 border border-emerald-200';
                                                }
                                            }

                                            // Override only if assigned and NOT individual/makooth
                                            if (assignedTeachers.length > 0) {
                                                const assignedEducator = educator && assignedTeachers.find(t => t.id === educator.id);

                                                // Check if educator has individual or makooth lesson
                                                const educatorLesson = educator ? lessons.find(l =>
                                                    l.teacherId === educator.id &&
                                                    normalizeArabic(l.day) === normDay &&
                                                    l.period === p
                                                ) : null;

                                                const lessonType = educatorLesson?.type?.toLowerCase();
                                                const keepColor = lessonType === 'individual' || lessonType === 'stay' || lessonType === 'makooth';

                                                // Only change color if NOT individual/makooth
                                                if (!keepColor) {
                                                    if (assignedEducator) cellStyle = `bg-${meta.color}-100 border border-${meta.color}-300`;
                                                    else cellStyle = 'bg-white border border-slate-200';
                                                }
                                            }

                                            return (
                                                <td key={p} className="p-2 border-l border-slate-100 relative h-28 align-top">
                                                    <div className={`flex flex-col h-full gap-1 rounded-xl p-1.5 transition-all relative group ${cellStyle}`}>
                                                        <div className="flex flex-col gap-0.5 px-1 mb-1">
                                                            <span className="text-[9px] text-slate-600 font-bold truncate">{originalLesson ? originalLesson.subject : 'فراغ'}</span>
                                                            {originalLesson && (() => {
                                                                const originalTeacher = employees.find(e => e.id === originalLesson.teacherId);
                                                                return originalTeacher ? (
                                                                    <span className="text-[8px] text-slate-400 font-normal truncate">{originalTeacher.name}</span>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                        <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                                                            {assignedTeachers.map(teacher => {
                                                                const isEd = educator?.id === teacher.id;

                                                                // Get teacher's lesson type in this period
                                                                const teacherLesson = lessons.find(l =>
                                                                    l.teacherId === teacher.id &&
                                                                    normalizeArabic(l.day) === normDay &&
                                                                    l.period === p
                                                                );
                                                                const lessonType = teacherLesson?.type?.toLowerCase();

                                                                // Determine visual style based on lesson type
                                                                let badgeStyle = '';
                                                                let iconElement = null;
                                                                let lessonTypeLabel = '';

                                                                if (isEd) {
                                                                    // Educator: Blue - add lesson type
                                                                    badgeStyle = 'bg-blue-500 text-white border-blue-600';
                                                                    iconElement = <GraduationCap size={10} />;
                                                                    if (lessonType === 'individual') {
                                                                        lessonTypeLabel = 'مربي (فردي)';
                                                                    } else if (lessonType === 'stay' || lessonType === 'makooth') {
                                                                        lessonTypeLabel = 'مربي (مكوث)';
                                                                    } else if (teacherLesson) {
                                                                        lessonTypeLabel = 'مربي (فعلي)';
                                                                    } else {
                                                                        lessonTypeLabel = 'مربي (فارغ)';
                                                                    }
                                                                } else if (!teacherLesson) {
                                                                    // Available/Free: Green
                                                                    badgeStyle = 'bg-emerald-500 text-white border-emerald-600';
                                                                    iconElement = <CheckCircle2 size={10} />;
                                                                    lessonTypeLabel = 'فارغ';
                                                                } else if (lessonType === 'individual') {
                                                                    // Individual: Pink
                                                                    badgeStyle = 'bg-pink-500 text-white border-pink-600';
                                                                    iconElement = <Users size={10} />;
                                                                    lessonTypeLabel = 'فردي';
                                                                } else if (lessonType === 'stay' || lessonType === 'makooth') {
                                                                    // Stay/Makooth: Orange
                                                                    badgeStyle = 'bg-orange-500 text-white border-orange-600';
                                                                    iconElement = <Coffee size={10} />;
                                                                    lessonTypeLabel = 'مكوث';
                                                                } else {
                                                                    // Regular lesson: Grey
                                                                    badgeStyle = 'bg-slate-500 text-white border-slate-600';
                                                                    lessonTypeLabel = teacherLesson?.subject || 'حصة';
                                                                }

                                                                return (
                                                                    <div key={teacher.id} className={`flex items-center justify-between p-1.5 rounded-lg text-[9px] font-black shadow-sm border ${badgeStyle}`}>
                                                                        <div className="flex items-center gap-1 truncate">
                                                                            {iconElement}
                                                                            <span className="truncate">{teacher.name.split(' ').slice(0, 2).join(' ')}</span>
                                                                            <span className="text-[7px] opacity-75">({lessonTypeLabel})</span>
                                                                        </div>
                                                                        <button onClick={(e) => { e.stopPropagation(); onRemove(cls.id, p, teacher.id); }} className="p-0.5 rounded-full hover:bg-white/20 transition-colors"><X size={10} /></button>
                                                                    </div>
                                                                )
                                                            })}
                                                            <div className="mt-auto">
                                                                <button onClick={() => setActiveSlot({ classId: cls.id, period: p })} className={`w-full flex items-center justify-center gap-1 p-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-${meta.color}-600 hover:bg-${meta.color}-50 transition-all text-[9px] font-bold`}>
                                                                    <Plus size={10} /> إضافة
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : modeType === 'EXAM' ? (
                    // EXAM COVERAGE VIEW
                    <div className="flex flex-col h-full">
                        <div className="bg-emerald-50 border-b-2 border-emerald-200 p-4 shrink-0">
                            <h5 className="font-bold text-sm text-emerald-800 flex items-center gap-2 mb-3">
                                <CheckCircle2 size={18} className="text-emerald-600" />
                                معلمون متاحون (محررون بسبب الامتحان)
                            </h5>
                            {(() => {
                                const releasedTeachers: any[] = [];

                                employees.forEach(emp => {
                                    const isAssignedAsProctor = Object.values(assignments).some((list: any) =>
                                        list.some((a: any) => a.teacherId === emp.id)
                                    );

                                    if (!isAssignedAsProctor) {
                                        periods.forEach(p => {
                                            const lesson = lessons.find(l =>
                                                l.teacherId === emp.id &&
                                                l.period === p &&
                                                normalizeArabic(l.day) === normDay
                                            );

                                            if (lesson) {
                                                const lessonClass = allClasses.find(c => c.id === lesson.classId);
                                                const type = lesson.type?.toLowerCase();
                                                const isExamClass = classes.some(examC => examC.id === lesson.classId);

                                                if ((type === 'actual' || !type || type === 'individual') && isExamClass) {
                                                    releasedTeachers.push({
                                                        emp,
                                                        period: p,
                                                        originalClass: lessonClass?.name || 'غير معروف',
                                                        originalSubject: lesson.subject,
                                                        type: type === 'individual' ? 'فردي' : 'فعلي',
                                                        reason: `${lessonClass?.name} ممتحن`
                                                    });
                                                }
                                            }
                                        });
                                    }
                                });

                                return releasedTeachers.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {releasedTeachers.map((t, idx) => (
                                            <div key={idx} className="text-[10px] font-bold bg-white px-3 py-2 rounded-lg border-2 border-emerald-200 shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-emerald-900">{t.emp.name}</span>
                                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px]">ح{t.period}</span>
                                                </div>
                                                <div className="text-[8px] text-slate-500 mt-1">
                                                    كان: {t.type} ({t.originalSubject} - {t.originalClass})
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-emerald-600 italic">لا يوجد معلمون محررون</p>
                                );
                            })()}
                        </div>

                        {(() => {
                            const gaps: any[] = [];

                            allClasses.forEach(cls => {
                                periods.forEach(p => {
                                    const originalLesson = lessons.find(l =>
                                        l.classId === cls.id &&
                                        l.period === p &&
                                        normalizeArabic(l.day) === normDay
                                    );

                                    if (originalLesson) {
                                        const originalTeacher = employees.find(e => e.id === originalLesson.teacherId);
                                        const isAssignedAsProctor = Object.values(assignments).some((list: any) =>
                                            list.some((a: any) => a.teacherId === originalTeacher?.id)
                                        );
                                        const currentSlotAssignments = assignments[`${cls.id}-${p}`] || [];
                                        const isCovered = currentSlotAssignments.length > 0;

                                        if (isAssignedAsProctor && !isCovered) {
                                            gaps.push({
                                                classId: cls.id,
                                                period: p,
                                                className: cls.name,
                                                originalTeacher: originalTeacher?.name || 'غير معروف',
                                                originalSubject: originalLesson.subject,
                                                reason: 'المعلم موزّع كمراقب',
                                                isExamClass: classes.some(examC => examC.id === cls.id)
                                            });
                                        }
                                    }
                                });
                            });

                            if (gaps.length === 0) {
                                return (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-60">
                                        <CheckCircle2 size={48} className="mb-4 text-emerald-500" />
                                        <p className="font-bold text-lg">لا توجد فجوات! كل الصفوف مغطاة ✓</p>
                                    </div>
                                );
                            }

                            const classesWithGaps = [...new Set(gaps.map(g => g.classId))];

                            return (
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-xs font-bold text-center border-collapse">
                                        <thead className="bg-rose-900 text-white sticky top-0 z-10">
                                            <tr>
                                                <th className="p-4 w-40 border-l border-rose-800 text-right">الصف</th>
                                                {periods.map(p => (
                                                    <th key={p} className="p-4 min-w-[140px] border-l border-rose-800">
                                                        حصة {p}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {classesWithGaps.map(classId => {
                                                const cls = allClasses.find(c => c.id === classId);
                                                if (!cls) return null;

                                                return (
                                                    <tr key={classId} className="border-b border-slate-100 hover:bg-rose-50/30 transition-colors">
                                                        <td className="p-4 bg-slate-50 font-black text-slate-800 border-l border-slate-200 text-right sticky left-0 z-10">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm">{cls.name}</span>
                                                                {gaps.find(g => g.classId === classId)?.isExamClass && (
                                                                    <span className="text-[8px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-black mt-1 w-fit">ممتحن</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {periods.map(p => {
                                                            const gap = gaps.find(g => g.classId === classId && g.period === p);

                                                            if (gap) {
                                                                const currentAssignments = assignments[`${classId}-${p}`] || [];

                                                                return (
                                                                    <td key={p} className="p-4 border border-slate-200 bg-rose-50/50">
                                                                        <div className="flex flex-col gap-2 items-center">
                                                                            <div className="text-[9px] text-rose-600 font-black flex items-center gap-1">
                                                                                <AlertCircle size={12} />
                                                                                فجوة
                                                                            </div>
                                                                            <div className="text-[8px] text-slate-600 text-center">
                                                                                <div>{gap.originalTeacher}</div>
                                                                                <div className="text-slate-400">{gap.originalSubject}</div>
                                                                            </div>

                                                                            {currentAssignments.length > 0 ? (
                                                                                <div className="w-full bg-white p-2 rounded-lg border border-emerald-200">
                                                                                    {currentAssignments.map((a: any) => {
                                                                                        const teacher = employees.find(e => e.id === a.teacherId);
                                                                                        return (
                                                                                            <div key={a.teacherId} className="flex items-center justify-between gap-1">
                                                                                                <span className="text-[9px] font-black text-emerald-700 truncate">
                                                                                                    {teacher?.name.split(' ').slice(0, 2).join(' ')}
                                                                                                </span>
                                                                                                <button
                                                                                                    onClick={() => onRemove(classId, p, a.teacherId)}
                                                                                                    className="text-rose-400 hover:text-rose-600"
                                                                                                >
                                                                                                    <X size={12} />
                                                                                                </button>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => setActiveSlot({ classId, period: p })}
                                                                                    className="w-full py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-black text-[9px] transition-all flex items-center justify-center gap-1 shadow-sm"
                                                                                >
                                                                                    <UserPlus size={12} /> تعيين بديل
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            } else {
                                                                return (
                                                                    <td key={p} className="p-4 bg-slate-50/30 border border-slate-100"></td>
                                                                );
                                                            }
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>
                ) : modeType === 'RAINY' ? (
                    // RAINY COVERAGE VIEW (Gap Analysis)
                    <div className="flex flex-col h-full">
                        <div className="bg-amber-50 border-b-2 border-amber-200 p-4 shrink-0">
                            <h5 className="font-bold text-sm text-amber-800 flex items-center gap-2 mb-3">
                                <AlertTriangle size={18} className="text-amber-600" />
                                تحليل الفجوات في التوزيع
                            </h5>
                            {(() => {
                                // 1. Calculate uncovered slots (no assignments)
                                const uncoveredSlots: any[] = [];

                                // 2. Calculate teacher workload (assignments count per teacher)
                                const teacherWorkload = new Map<number, { name: string, count: number, classes: string[] }>();

                                // Check all merged classes
                                Object.entries(rainyMergeGroups).forEach(([groupKey, mergedClassIds]: [string, string[]]) => {
                                    if (mergedClassIds.length > 1) {
                                        mergedClassIds.forEach(classId => {
                                            const cls = allClasses.find(c => c.id === classId);
                                            if (!cls) return;

                                            periods.forEach(p => {
                                                const slotKey = `${classId}-${p}`;
                                                const slotAssignments = assignments[slotKey] || [];

                                                if (slotAssignments.length === 0) {
                                                    // Uncovered slot
                                                    uncoveredSlots.push({
                                                        className: cls.name,
                                                        classId,
                                                        period: p,
                                                        groupKey
                                                    });
                                                } else {
                                                    // Count teacher workload
                                                    slotAssignments.forEach((a: any) => {
                                                        if (!teacherWorkload.has(a.teacherId)) {
                                                            const emp = employees.find(e => e.id === a.teacherId);
                                                            teacherWorkload.set(a.teacherId, {
                                                                name: emp?.name || '?',
                                                                count: 0,
                                                                classes: []
                                                            });
                                                        }
                                                        const data = teacherWorkload.get(a.teacherId)!;
                                                        data.count++;
                                                        if (!data.classes.includes(cls.name)) {
                                                            data.classes.push(cls.name);
                                                        }
                                                    });
                                                }
                                            });
                                        });
                                    }
                                });

                                // 3. Calculate average and find overloaded teachers
                                const workloadArray = Array.from(teacherWorkload.values());
                                const avgWorkload = workloadArray.length > 0 ? workloadArray.reduce((sum, t) => sum + t.count, 0) / workloadArray.length : 0;
                                const overloadedTeachers = workloadArray.filter(t => t.count > avgWorkload * 1.3); // 30% above average

                                return (
                                    <div className="space-y-4">
                                        {/* Uncovered Slots Warning */}
                                        {uncoveredSlots.length > 0 && (
                                            <div className="bg-white border-2 border-rose-200 rounded-xl p-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertTriangle size={14} className="text-rose-600" />
                                                    <span className="text-[11px] font-black text-rose-700">
                                                        {uncoveredSlots.length} حصة غير مغطاة
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {uncoveredSlots.slice(0, 10).map((slot, idx) => (
                                                        <div key={idx} className="text-[9px] font-bold bg-rose-50 text-rose-700 px-2 py-1 rounded border border-rose-200">
                                                            {slot.className} - ح{slot.period}
                                                        </div>
                                                    ))}
                                                    {uncoveredSlots.length > 10 && (
                                                        <div className="text-[9px] font-bold text-rose-500 px-2 py-1">
                                                            +{uncoveredSlots.length - 10} أخرى...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Overloaded Teachers Warning */}
                                        {overloadedTeachers.length > 0 && (
                                            <div className="bg-white border-2 border-amber-200 rounded-xl p-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <TrendingUp size={14} className="text-amber-600" />
                                                    <span className="text-[11px] font-black text-amber-700">
                                                        معلمون بحصص أكثر من المتوسط (متوسط: {Math.round(avgWorkload)} حصة)
                                                    </span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {overloadedTeachers.map((t, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-amber-900">{t.name}</span>
                                                                <span className="text-[8px] text-amber-600">({t.classes.join(', ')})</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[11px] font-black text-amber-700">{t.count}</span>
                                                                <span className="text-[8px] text-amber-500">حصة</span>
                                                                <span className="text-[9px] font-bold text-rose-600 ml-2">+{Math.round(((t.count - avgWorkload) / avgWorkload) * 100)}%</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* All Teacher Workload */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BarChart3 size={14} className="text-slate-600" />
                                                <span className="text-[11px] font-black text-slate-700">
                                                    توزيع العبء (جميع المعلمين)
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {workloadArray.sort((a, b) => b.count - a.count).map((t, idx) => {
                                                    const percentage = avgWorkload > 0 ? (t.count / avgWorkload) * 100 : 100;
                                                    const colorClass = percentage > 130 ? 'bg-rose-400' : percentage > 110 ? 'bg-amber-400' : percentage < 80 ? 'bg-blue-400' : 'bg-emerald-400';

                                                    return (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <span className="text-[9px] font-bold text-slate-600 w-28 truncate">{t.name}</span>
                                                            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                                                                <div className={`h-full ${colorClass} transition-all`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                                                                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-slate-700">
                                                                    {t.count} حصة
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {uncoveredSlots.length === 0 && overloadedTeachers.length === 0 && (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                                                <CheckCircle2 size={24} className="text-emerald-600 mx-auto mb-2" />
                                                <p className="text-[11px] font-black text-emerald-700">توزيع متوازن وعادل ✨</p>
                                                <p className="text-[9px] text-emerald-600 mt-1">جميع الحصص مغطاة والعبء موزع بشكل متساوي</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                ) : (
                    // TRIP COVERAGE VIEW
                    <div className="flex flex-col h-full">
                        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 flex flex-col gap-3">
                            <h5 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                <Users size={18} className="text-indigo-600" /> الطاقم المشارك في الرحلة (المرافقون)
                            </h5>
                            <div className="flex flex-wrap gap-4 items-start">
                                {tripParticipants.educators.length > 0 && (
                                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
                                        <div className="p-1 bg-white rounded-lg text-indigo-600 shadow-sm"><GraduationCap size={14} /></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-indigo-400">المربون</span>
                                            <div className="flex flex-wrap gap-1">
                                                {tripParticipants.educators.map(e => <span key={e.id} className="text-[10px] font-black text-indigo-900 bg-white px-1.5 rounded border border-indigo-100">{e.name.split(' ').slice(0, 2).join(' ')}</span>)}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {tripParticipants.companions.length > 0 && (
                                    <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                                        <div className="p-1 bg-white rounded-lg text-emerald-600 shadow-sm"><Bus size={14} /></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-emerald-400">المرافقون</span>
                                            <div className="flex flex-wrap gap-1">
                                                {tripParticipants.companions.map(e => (
                                                    <span key={e.id} className="text-[10px] font-black text-emerald-900 bg-white px-1.5 rounded border border-emerald-100 flex items-center gap-1 group cursor-pointer">
                                                        {e.name.split(' ').slice(0, 2).join(' ')}
                                                        {/* Only allow removal if not from form partner list (complex to sync back) */}
                                                        {!externalPartners.some(p => p.userIds.includes(String(e.id))) && (
                                                            <button onClick={(ev) => { ev.stopPropagation(); handleRemoveCompanion(e.id); }} className="text-rose-400 hover:text-rose-600 bg-white hover:bg-rose-50 rounded-full p-0.5 transition-colors"><X size={10} /></button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {tripParticipants.allIds.size === 0 && (
                                    <div className="text-slate-400 text-[10px] font-bold italic py-2">لم يتم تحديد أي مرافقين بعد.</div>
                                )}
                            </div>
                        </div>

                        {impactedClasses.length > 0 ? (
                            <table className="w-full text-xs font-bold text-center border-collapse">
                                <thead className="bg-rose-900 text-white sticky top-0 z-10 shadow-md">
                                    <tr>
                                        <th className="p-4 w-40 border-l border-rose-800 text-right">الصف</th>
                                        {periods.map(p => <th key={p} className="p-4 min-w-[140px] border-l border-rose-800">حصة {p}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {impactedClasses.map(cls => (
                                        <tr key={cls.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 bg-slate-50 font-black text-slate-800 border-l border-slate-200 text-right sticky right-0 z-10">{cls.name}</td>
                                            {periods.map(p => {
                                                const impact = impactedSlots.find(s => s.lesson.classId === cls.id && s.period === p);
                                                const slotKey = `${cls.id}-${p}`;
                                                const currentSlotAssignments = assignments[slotKey] || [];
                                                const subTeacher = currentSlotAssignments.length > 0 ? employees.find(e => e.id === currentSlotAssignments[0].teacherId) : null;

                                                return (
                                                    <td key={p} className="p-2 border-l border-slate-100 relative h-28 align-top">
                                                        {impact ? (
                                                            <div className={`flex flex-col h-full gap-1 rounded-xl p-2 transition-all border-2 ${subTeacher ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                                                <span className="text-[10px] font-black text-slate-800 truncate">{impact.lesson.subject}</span>
                                                                <div className="flex items-center gap-1 text-[9px] text-rose-500 font-bold mb-2">
                                                                    <span className="opacity-60">بدل:</span>
                                                                    <span className="truncate">{impact.originalTeacher.name.split(' ')[0]}</span>
                                                                </div>
                                                                {subTeacher ? (
                                                                    <div className="mt-auto bg-white p-1.5 rounded-lg border border-emerald-100 flex justify-between items-center shadow-sm">
                                                                        <span className="text-[9px] font-black text-emerald-600 truncate">{subTeacher.name.split(' ').slice(0, 2).join(' ')}</span>
                                                                        <button onClick={() => onRemove(cls.id, p, subTeacher.id)} className="text-rose-400 hover:text-rose-600"><X size={12} /></button>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => setActiveSlot({ classId: cls.id, period: p })} className="mt-auto w-full py-1.5 bg-white hover:bg-rose-100 text-rose-600 rounded-lg font-black text-[9px] border border-rose-200 transition-all flex items-center justify-center gap-1 shadow-sm"><UserPlus size={12} /> بديل</button>
                                                                )}
                                                            </div>
                                                        ) : <div className="w-full h-full bg-slate-50/30 rounded-xl"></div>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <CheckCircle2 size={48} className="mb-4 text-emerald-500" />
                                <p className="font-bold text-lg">لا توجد حصص متأثرة (فجوات)</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Recommendation Modal */}
            {showTripRecommendations && (
                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-6 animate-scale-up max-h-[85vh] flex flex-col border border-white/20">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h5 className="font-black text-slate-800 text-lg flex items-center gap-2"><Bus size={20} className="text-emerald-500" /> المرشحون للمرافقة</h5>
                            <button onClick={() => setShowTripRecommendations(false)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-4">
                            {tripCandidates.length > 0 ? tripCandidates.map((cand, idx) => {
                                const isSelected = selectedCandidateIds.includes(cand.emp.id);
                                return (
                                    <div key={cand.emp.id} onClick={() => setSelectedCandidateIds(prev => prev.includes(cand.emp.id) ? prev.filter(x => x !== cand.emp.id) : [...prev, cand.emp.id])} className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-md' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-600'}`}>{idx + 1}</div>
                                            <div><p className="font-black text-sm text-slate-800">{cand.emp.name}</p></div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-600">{cand.gradeCount} حصص</span>
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>{isSelected && <CheckSquare size={14} className="text-white" />}</div>
                                        </div>
                                    </div>
                                );
                            }) : <div className="text-center py-8 text-slate-400 italic font-bold">لا يوجد مرشحين إضافيين</div>}
                        </div>
                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center bg-white sticky bottom-0">
                            <span className="text-xs font-bold text-slate-500">تم تحديد {selectedCandidateIds.length}</span>
                            <button onClick={handleConfirmSelectedCompanions} disabled={selectedCandidateIds.length === 0} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50">اعتماد</button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Rainy Merge Configuration Modal */}
            {showRainyMergeModal && (
                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl p-6 animate-scale-up max-h-[85vh] flex flex-col border border-white/20">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h5 className="font-black text-slate-800 text-lg flex items-center gap-2"><CloudRain size={20} className="text-cyan-500" /> إعدادات دمج الصفوف</h5>
                            <button onClick={() => setShowRainyMergeModal(false)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all"><X size={20} /></button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">حدد عدد الصفوف المدمجة لكل طبقة (معلم واحد يراقبهم)</p>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-4">
                            {(() => {
                                // Group classes by grade level AND type (general/special)
                                const gradeGroups: Record<string, ClassItem[]> = {};
                                classes.forEach(cls => {
                                    const grade = cls.gradeLevel || 'غير محدد';
                                    const classType = cls.type || 'general';
                                    const groupKey = `${grade}-${classType}`;
                                    if (!gradeGroups[groupKey]) gradeGroups[groupKey] = [];
                                    gradeGroups[groupKey].push(cls);
                                });

                                return Object.entries(gradeGroups).map(([groupKey, gradeClasses]) => {
                                    const [gradeStr, classType] = groupKey.split('-');
                                    const grade = gradeStr;
                                    const typeLabel = classType === 'special' ? 'تربية خاصة' : 'تربية عامة';
                                    const bgColor = classType === 'special' ? 'bg-purple-50 border-purple-200' : 'bg-cyan-50 border-cyan-200';
                                    const textColor = classType === 'special' ? 'text-purple-700' : 'text-cyan-700';
                                    const mergedIds = rainyMergeGroups[groupKey] || [];

                                    return (
                                        <div key={groupKey} className={`p-4 rounded-xl border ${bgColor}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h6 className="font-black text-sm text-slate-800">الطبقة: {grade} - {typeLabel}</h6>
                                                    <p className="text-[10px] text-slate-500">عدد الصفوف: {gradeClasses.length}</p>
                                                </div>
                                                <div className="px-3 py-1 bg-white rounded-lg border-2 border-slate-200">
                                                    <span className="text-xs font-black text-slate-700">مدمج: {mergedIds.length}</span>
                                                </div>
                                            </div>

                                            {/* Checkboxes for each class */}
                                            <div className="space-y-2 mt-3">
                                                {gradeClasses.map(cls => {
                                                    const isChecked = mergedIds.includes(cls.id);
                                                    return (
                                                        <label
                                                            key={cls.id}
                                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-all group"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    const newMerged = e.target.checked
                                                                        ? [...mergedIds, cls.id]
                                                                        : mergedIds.filter(id => id !== cls.id);
                                                                    setRainyMergeGroups(prev => ({ ...prev, [groupKey]: newMerged }));
                                                                }}
                                                                className="w-4 h-4 rounded border-2 border-slate-300 checked:bg-cyan-600 checked:border-cyan-600 cursor-pointer"
                                                            />
                                                            <span className={`text-sm font-bold flex-1 ${isChecked ? textColor : 'text-slate-600'}`}>
                                                                {cls.name}
                                                            </span>
                                                            {isChecked && (
                                                                <span className="text-[9px] px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded font-black opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    ✓ مدمج
                                                                </span>
                                                            )}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end items-center bg-white">
                            <button
                                onClick={() => {
                                    setShowRainyMergeModal(false);
                                    addToast('تم حفظ إعدادات الدمج', 'success');
                                }}
                                className="px-6 py-3 bg-cyan-600 text-white rounded-xl text-xs font-black hover:bg-cyan-700 transition-all shadow-lg"
                            >
                                حفظ وإغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Candidate Popup */}
            {activeSlot && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-6 animate-scale-up max-h-[85vh] flex flex-col border border-white/20">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h5 className="font-black text-slate-800 text-lg">{viewPhase === 'COVERAGE' ? 'سد الفجوة (تغطية)' : `اختيار ${meta.role}`}</h5>
                                <p className="text-xs text-slate-500 font-bold mt-1">حصة {activeSlot.period}</p>
                            </div>
                            <button onClick={() => setActiveSlot(null)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                            {(() => {
                                console.log('[Popup Render] activeSlot:', activeSlot, 'assignments keys:', Object.keys(assignments).length);
                                const { poolCandidates, educatorCandidates, supportCandidates } = getSlotCandidates(activeSlot.classId, activeSlot.period);
                                const availableSupport = supportCandidates.filter(c => !c.isAssigned);

                                console.log(`[Popup] educatorCandidates (${educatorCandidates.length}):`, educatorCandidates.map(c => `${c.emp.name} (isTarget: ${c.isTarget}, isAssigned: ${c.isAssigned})`));

                                // Show ONLY target educator (not all educators)
                                // This keeps the list clean and focused
                                const allEducators = educatorCandidates.filter(c => c.isTarget);

                                console.log(`[Popup] allEducators (target only) (${allEducators.length}):`, allEducators.map(c => c.emp.name));

                                const releasedTeachers = availableSupport.filter(c => c.type === 'RELEASED_BY_TRIP' || c.type === 'RELEASED');
                                const individualTeachers = availableSupport.filter(c => c.type === 'INDIVIDUAL');
                                const stayTeachers = availableSupport.filter(c => c.type === 'STAY');
                                const freeTeachers = availableSupport.filter(c => c.type === 'FREE');

                                // Add educators with STAY to stayTeachers list (for manual selection)
                                const educatorsWithStay = educatorCandidates.filter(c => c.type === 'STAY');
                                const allStayTeachers = [...stayTeachers, ...educatorsWithStay];

                                const renderBtn = (cand: any, styleClass: string) => (
                                    <button key={cand.emp.id} onClick={() => { onAssign(activeSlot.classId, activeSlot.period, cand.emp.id, 'assignment'); setActiveSlot(null); }} className={`w-full p-3 rounded-xl border transition-all flex justify-between items-center group shadow-sm ${styleClass}`}>
                                        <span className="font-bold text-xs">{cand.emp.name}</span>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded opacity-80 bg-white/50">{cand.label}</span>
                                    </button>
                                );

                                return (
                                    <>
                                        {allEducators.length > 0 && (
                                            <div className="space-y-2 bg-blue-50 p-3 rounded-2xl border border-blue-200">
                                                <h6 className="text-[10px] font-black text-blue-700 uppercase flex items-center gap-2"><GraduationCap size={14} /> مربو الصفوف</h6>
                                                <div className="grid gap-2">
                                                    {allEducators.map(c => renderBtn(c, 'bg-white border-blue-600 text-blue-900 hover:bg-blue-100 font-black shadow-md'))}
                                                </div>
                                            </div>
                                        )}
                                        {releasedTeachers.length > 0 && (
                                            <div className="space-y-2 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                                                <h6 className="text-[10px] font-black text-emerald-700 uppercase flex items-center gap-2"><Unlock size={14} /> معلمون محررون</h6>
                                                <div className="grid gap-2">{releasedTeachers.map(c => renderBtn(c, 'bg-white border-emerald-200 text-emerald-900 hover:bg-emerald-100'))}</div>
                                            </div>
                                        )}
                                        {individualTeachers.length > 0 && (
                                            <div className="space-y-2 bg-pink-50 p-3 rounded-2xl border border-pink-200">
                                                <h6 className="text-[10px] font-black text-pink-700 uppercase flex items-center gap-2"><Users size={14} /> حصص فردي</h6>
                                                <div className="grid gap-2">{individualTeachers.map(c => renderBtn(c, 'bg-white border-pink-300 text-pink-900 hover:bg-pink-100'))}</div>
                                            </div>
                                        )}
                                        {allStayTeachers.length > 0 && (
                                            <div className="space-y-2 bg-orange-50 p-3 rounded-2xl border border-orange-200">
                                                <h6 className="text-[10px] font-black text-orange-700 uppercase flex items-center gap-2"><Coffee size={14} /> مكوث (يدوي فقط)</h6>
                                                <div className="grid gap-2">{allStayTeachers.map(c => renderBtn(c, 'bg-white border-orange-300 text-orange-900 hover:bg-orange-100'))}</div>
                                            </div>
                                        )}
                                        {freeTeachers.length > 0 && (
                                            <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                <h6 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Clock size={14} /> فراغ (نافذة)</h6>
                                                <div className="grid gap-2">{freeTeachers.map(c => renderBtn(c, 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'))}</div>
                                            </div>
                                        )}
                                        {poolCandidates.length > 0 && (
                                            <div className="space-y-2">
                                                <h6 className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2"><Briefcase size={14} /> بنك الاحتياط</h6>
                                                <div className="grid gap-2">{poolCandidates.map(c => renderBtn(c, 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'))}</div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN WRAPPER: CALENDAR REQUEST FORM ---
interface CalendarRequestFormProps {
    employees: Employee[];
    classes: ClassItem[];
    setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
    onClose: () => void;
    prefill?: any;
    currentUser?: Employee | null;
    lessons: Lesson[];
    setSubstitutionLogs?: React.Dispatch<React.SetStateAction<SubstitutionLog[]>>;
    substitutionLogs?: SubstitutionLog[];
    engineContext?: EngineContext;
    scheduleConfig?: ScheduleConfig;
}

const CalendarRequestForm: React.FC<CalendarRequestFormProps> = ({
    employees, classes, setEvents, onClose, prefill, currentUser, lessons, setSubstitutionLogs, substitutionLogs = [], engineContext = {}, scheduleConfig
}) => {
    const { addToast } = useToast();

    // --- SCOPED ACCESS CONTROL ---
    const { visibleClasses, visibleEmployees } = useMemo(() => {
        return getOperationalScope(currentUser || null, classes, employees);
    }, [currentUser, classes, employees]);

    // Initialize form data from prefill (handle both new event and existing CalendarEvent)
    const [formData, setFormData] = useState(() => {
        // If prefill is an existing CalendarEvent (has eventType property)
        const isExistingEvent = prefill && 'eventType' in prefill;

        if (isExistingEvent) {
            // Map CalendarEvent structure to form data structure
            const event = prefill as any; // CalendarEvent

            // Transform participants to partners format
            const partnersMap = new Map<string, { userIds: string[], expectations: string }>();
            event.participants?.forEach((p: any) => {
                const role = p.role || 'partner';
                if (!partnersMap.has(role)) {
                    partnersMap.set(role, { userIds: [], expectations: p.expectations || '' });
                }
                partnersMap.get(role)!.userIds.push(String(p.userId));
            });

            const partners = Array.from(partnersMap.entries()).map(([role, data], idx) => ({
                id: `${idx}-${role}`,
                userIds: data.userIds,
                expectations: data.expectations
            }));

            return {
                title: event.title || '',
                date: event.date || new Date().toISOString().split('T')[0],
                type: event.eventType || 'ACTIVITY',
                description: event.description || '',
                targetClassIds: event.appliesTo?.classes || [],
                targetPeriods: event.appliesTo?.periods || [],
                targetBreaks: [],
                partners: partners,
                opAction: event.opContext?.mode ? 'internal' : 'none',
                mergeStrategy: 'advance_second'
            };
        }

        // New event: use prefill directly or defaults
        return {
            title: prefill?.title || '',
            date: prefill?.date || new Date().toISOString().split('T')[0],
            type: prefill?.type || 'ACTIVITY',
            description: prefill?.description || '',
            targetClassIds: prefill?.targetClassIds || [],
            targetPeriods: prefill?.targetPeriods || [],
            targetBreaks: [],
            partners: [],
            opAction: 'none',
            mergeStrategy: 'advance_second'
        };
    });

    // Initialize smart mode and assignments from prefill if editing
    const [enableSmartMode, setEnableSmartMode] = useState(() => {
        const isExistingEvent = prefill && 'eventType' in prefill;
        return isExistingEvent && (prefill as any).opContext ? true : false;
    });

    const [assignments, setAssignments] = useState<Record<string, { teacherId: number, reason: string }[]>>(() => {
        const isExistingEvent = prefill && 'eventType' in prefill;
        if (isExistingEvent && (prefill as any).opContext?.assignments) {
            return (prefill as any).opContext.assignments;
        }
        return {};
    });

    const handleAssign = (classId: string, period: number, teacherId: number, reason: string) => {
        const isLocked = Object.entries(assignments).some(([k, v]) => {
            const { classId: c, period: p } = parseKey(k);
            return p === period && c !== classId && (v as { teacherId: number, reason: string }[]).some(t => t.teacherId === teacherId);
        });

        if (isLocked) {
            addToast("هذا المعلم معين بالفعل في حصة أخرى في نفس التوقيت", "error");
            return;
        }

        const key = `${classId}-${period}`;
        setAssignments(prev => {
            const current = prev[key] || [];
            if (current.some(a => a.teacherId === teacherId)) return prev;
            return { ...prev, [key]: [...current, { teacherId, reason }] };
        });
    };

    const handleRemove = (classId: string, period: number, teacherId: number) => {
        const key = `${classId}-${period}`;
        setAssignments(prev => {
            const current = prev[key] || [];
            return { ...prev, [key]: current.filter(a => a.teacherId !== teacherId) };
        });
    };

    const handleBulkAssign = (newAssignments: { classId: string, period: number, teacherId: number, reason: string }[]) => {
        setAssignments(prev => {
            const next = { ...prev };
            newAssignments.forEach(a => {
                const key = `${a.classId}-${a.period}`;
                const current = next[key] || [];
                if (!current.some(existing => existing.teacherId === a.teacherId)) {
                    next[key] = [...current, { teacherId: a.teacherId, reason: a.reason }];
                }
            });
            return next;
        });
        addToast(`تم توزيع ${newAssignments.length} مهمة تلقائياً`, "success");
    };

    const handleSave = () => {
        if (!formData.title || !formData.date) {
            addToast("يرجى ملء البيانات الأساسية", "error");
            return;
        }

        // Check if editing existing event
        const isEditing = prefill && 'eventType' in prefill && (prefill as any).id;

        const eventData: CalendarEvent = {
            id: isEditing ? (prefill as any).id : `EVT-${Date.now()}`,
            title: formData.title,
            description: formData.description,
            date: formData.date,
            eventType: formData.type as any,
            status: isEditing ? (prefill as any).status : 'CONFIRMED',
            plannerId: isEditing ? (prefill as any).plannerId : (currentUser?.id || 0),
            plannerName: isEditing ? (prefill as any).plannerName : (currentUser?.name || 'Admin'),
            patternId: 'DYNAMIC',
            appliesTo: {
                grades: [],
                classes: formData.targetClassIds,
                periods: formData.targetPeriods
            },
            participants: formData.partners.flatMap((p: { id: string; userIds: string[]; expectations: string }) =>
                p.userIds.map(uid => ({ userId: Number(uid), role: 'PARTNER', expectations: p.expectations }))
            ),
        };

        // Add opContext when smart mode is enabled
        if (enableSmartMode) {
            eventData.opContext = {
                id: isEditing && (prefill as any).opContext?.id ? (prefill as any).opContext.id : `MODE-${Date.now()}`,
                name: formData.title,
                mode: formData.type as any,
                isActive: true,
                target: 'all',
                affectedGradeLevels: [],
                affectedClassIds: formData.targetClassIds,
                affectedPeriods: formData.targetPeriods,
                affectedBreaks: [],
                breakAction: 'none',
                mergeStrategy: 'advance_second',
                goldenRules: [],
                policyRules: [],
                priorityLadder: [],
                assignments: assignments, // Include assignments
            } as any;
        } else if (prefill?.autoSmartMode) {
            // Legacy auto smart mode support
            eventData.opContext = {
                id: `MODE-${Date.now()}`,
                name: formData.title,
                isActive: true,
                target: 'all',
                affectedGradeLevels: [],
                affectedClassIds: formData.targetClassIds,
                affectedPeriods: formData.targetPeriods,
                affectedBreaks: [],
                breakAction: 'none',
                mergeStrategy: 'advance_second',
                goldenRules: [],
                policyRules: [],
                priorityLadder: [],
            } as any;
        }

        // Update or create event
        if (isEditing) {
            setEvents(prev => prev.map(e => e.id === eventData.id ? eventData : e));
            addToast("تم تحديث الفعالية بنجاح", "success");
        } else {
            setEvents(prev => [...prev, eventData]);
            addToast("تم حفظ الفعالية بنجاح", "success");
        }

        // Handle substitution logs
        if (setSubstitutionLogs && enableSmartMode) {
            const newLogs: SubstitutionLog[] = [];
            Object.entries(assignments).forEach(([key, valArray]) => {
                const { classId, period } = parseKey(key);
                (valArray as { teacherId: number, reason: string }[]).forEach(assignment => {
                    const sub = employees.find(e => e.id === assignment.teacherId);
                    if (sub) {
                        newLogs.push({
                            id: `LOG-${Date.now()}-${Math.random()}`,
                            date: formData.date,
                            period: period,
                            classId: classId,
                            absentTeacherId: 0,
                            substituteId: sub.id,
                            substituteName: sub.name,
                            type: sub.constraints.isExternal ? 'assign_external' : 'assign_distribution',
                            reason: assignment.reason || `Event: ${formData.title}`,
                            modeContext: formData.type,
                            timestamp: Date.now()
                        });
                    }
                });
            });

            if (newLogs.length > 0) {
                // If editing, remove old logs for this event and add new ones
                if (isEditing) {
                    setSubstitutionLogs(prev => {
                        const filtered = prev.filter(log =>
                            !(log.date === formData.date && log.modeContext === formData.type)
                        );
                        return [...filtered, ...newLogs];
                    });
                } else {
                    setSubstitutionLogs(prev => [...prev, ...newLogs]);
                }
                addToast(`تم تسجيل ${newLogs.length} تكليفاً بنجاح`, "success");
            }
        }

        onClose();
    };

    // Check if editing existing event
    const isEditing = useMemo(() => {
        return prefill && 'eventType' in prefill && (prefill as any).id;
    }, [prefill]);

    // Filter classes based on selection (for Phase 1 - Trip)
    const selectedClasses = useMemo(() => {
        return classes.filter(c => formData.targetClassIds.includes(c.id));
    }, [classes, formData.targetClassIds]);

    // --- HOLIDAY DETECTION ---
    const isHoliday = useMemo(() => {
        const dayName = DAYS_AR[new Date(formData.date).getDay()];
        const normDay = normalizeArabic(dayName);
        return (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normDay);
    }, [formData.date, scheduleConfig.holidays]);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <UnifiedEventForm
                data={formData}
                setData={setFormData}
                employees={visibleEmployees}
                classes={visibleClasses}
                onCancel={onClose}
                onSave={handleSave}
                enableSmartMode={enableSmartMode}
                setEnableSmartMode={setEnableSmartMode}
                isEditing={isEditing}
                titlePrefix={isEditing ? "تعديل الفعالية" : "إنشاء فعالية ذكية"}
            >
                {/* HOLIDAY WARNING */}
                {isHoliday && (
                    <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-4 animate-bounce-short">
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-rose-100">
                            <Coffee size={24} className="text-rose-500" />
                        </div>
                        <div>
                            <h4 className="font-black text-rose-800 text-sm">تنبيه: يوم عطلة رسمية</h4>
                            <p className="text-xs font-bold text-rose-600/80">
                                التاريخ المحدد ({new Date(formData.date).toLocaleDateString('ar-EG')}) هو عطلة رسمية. تأكد من صحة اختيارك.
                            </p>
                        </div>
                    </div>
                )}

                {/* INJECT MANUAL DISTRIBUTION GRID */}
                {formData.targetClassIds.length > 0 && formData.targetPeriods.length > 0 ? (
                    <div className="mt-8 border-t border-slate-200 pt-8 animate-slide-down">
                        <ManualDistributionGrid
                            classes={selectedClasses} // Phase 1: Only selected classes
                            allClasses={classes}      // Phase 2: Needs ALL classes to show non-trip impacts
                            periods={formData.targetPeriods}
                            lessons={lessons}
                            employees={visibleEmployees}
                            date={formData.date}
                            assignments={assignments}
                            onAssign={handleAssign}
                            onRemove={handleRemove}
                            onBulkAssign={handleBulkAssign}
                            modeType={formData.type}
                            poolIds={prefill?.poolIds || []}
                            externalPartners={formData.partners} // Pass form partners to grid
                            engineContext={engineContext}
                            substitutionLogs={substitutionLogs}
                        />
                    </div>
                ) : (
                    <div className="mt-8 p-10 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center gap-3">
                        <div className="p-4 bg-white rounded-full shadow-sm text-slate-300"><LayoutGrid size={32} /></div>
                        <h4 className="text-sm font-black text-slate-400">بانتظار تحديد النطاق</h4>
                        <p className="text-xs font-bold text-slate-300">يرجى اختيار الصفوف والحصص المستهدفة أعلاه لإظهار جدول التوزيع والمرافقين.</p>
                    </div>
                )}
            </UnifiedEventForm>
        </div>
    );
};

export default CalendarRequestForm;
