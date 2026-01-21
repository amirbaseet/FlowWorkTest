// src/components/absence/hooks/useAbsenceForm.ts

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Employee, Lesson, ClassItem, ScheduleConfig, CalendarEvent, EngineContext, SubstitutionLog, ModeConfig } from '@/types';
import { normalizeArabic, generateSubstitutionOptions } from '@/utils';
import { getDatesInRange, getSafeDayName } from '../utils/absenceHelpers';
import { DAYS_AR } from '@/constants';
import { AvailabilityChecker } from '../utils/availability';
import { SUBSTITUTION_LIMITS } from '@/constants/substitution';

export interface SelectedTeacherState {
    id: number;
    startDate: string;
    endDate: string;
    type: 'FULL' | 'PARTIAL';
    affectedPeriods: number[];
    reason: string;
}

interface UseAbsenceFormProps {
    initialDate: string;
    initialStep?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    preSelectedPool?: number[];
    employees: Employee[];
    lessons: Lesson[];
    classes: ClassItem[];
    scheduleConfig: ScheduleConfig;
    initialData?: any;
    existingAbsences?: any[];
    substitutionLogs?: any[];
    singleStageMode?: boolean;
    engineContext: EngineContext;
    events: CalendarEvent[];
    addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onAddSubstitution?: (sub: any) => void;
    onRemoveSubstitution?: (absentTeacherId: number, period: number, date: string) => void;
    onSubmit?: () => void | Promise<void>;
    onClose?: () => void;
}

export const useAbsenceForm = ({
    initialDate,
    initialStep = 1,
    preSelectedPool = [],
    employees,
    lessons,
    classes,
    scheduleConfig,
    initialData,
    existingAbsences = [],
    substitutionLogs = [],
    singleStageMode = false,
    engineContext,
    events,
    addToast,
    onAddSubstitution,
    onRemoveSubstitution,
    onSubmit,
    onClose
}: UseAbsenceFormProps) => {
    // Steps
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(initialStep as any);
    
    // Teacher Selection (Step 1 & 2)
    const [selectedTeachers, setSelectedTeachers] = useState<SelectedTeacherState[]>([]);
    const [globalStartDate, setGlobalStartDate] = useState(initialDate);
    const [globalEndDate, setGlobalEndDate] = useState(initialDate);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pool Management (Step 3)
    const [activeExternalIds, setActiveExternalIds] = useState<number[]>(preSelectedPool);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
    
    // Modes (Step 4)
    const [selectedModeIds, setSelectedModeIds] = useState<string[]>([]);
    
    // Gaps (Step 5)
    const [detectedGaps, setDetectedGaps] = useState<any[]>([]);
    const [gapSolutions, setGapSolutions] = useState<Record<string, number>>({});
    
    // Distribution (Step 6)
    const [substitutions, setSubstitutions] = useState<any[]>([]);
    const [assistantCoverage, setAssistantCoverage] = useState<Record<string, boolean>>({});
    const [classMerges, setClassMerges] = useState<Record<string, any>>({});
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);
    
    // Assignments (Board View)
    const [assignments, setAssignments] = useState<Record<string, number>>({});
    const [assignmentVersion, setAssignmentVersion] = useState(0);

    // Board view
    const [boardViewDate, setBoardViewDate] = useState<string>(initialDate);
    
    // Filtered employees for selection
    const filteredEmployees = useMemo(() => {
        const dayName = DAYS_AR[new Date(globalStartDate).getDay()];
        const normDay = normalizeArabic(dayName);
        
        return employees.filter(e => {
            if (e.constraints.isExternal) return false;
            
            const validTeacherRoles = ['teacher', 'teachers', 'معلم', 'معلمة'];
            if (!validTeacherRoles.includes(e.baseRoleId?.toLowerCase() || '')) {
                if (!e.subjects || e.subjects.length === 0) return false;
            }
            
            const hasLessonsToday = lessons.some(l =>
                l.teacherId === e.id &&
                normalizeArabic(l.day) === normDay
            );
            if (!hasLessonsToday) return false;
            
            if (searchTerm && !e.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            
            return true;
        });
    }, [employees, lessons, globalStartDate, searchTerm]);

    // Initial Load
    useEffect(() => {
        if (initialData) {
            const targetDate = initialData.date;
            const sameDayAbsences = existingAbsences.filter(a => a.date === targetDate);
            const teachersToLoad = sameDayAbsences.length > 0 ? sameDayAbsences : [initialData];

            const mappedTeachers: SelectedTeacherState[] = teachersToLoad.map(abs => ({
                id: abs.teacherId,
                startDate: abs.date,
                endDate: abs.date,
                type: abs.type,
                affectedPeriods: abs.affectedPeriods || [],
                reason: abs.reason
            }));

            setSelectedTeachers(mappedTeachers);
            setGlobalStartDate(targetDate);
            setGlobalEndDate(targetDate);
            setBoardViewDate(targetDate);

            const teacherIds = teachersToLoad.map(t => t.teacherId);
            const existingLogs = substitutionLogs.filter(log =>
                log.date === targetDate && teacherIds.includes(log.absentTeacherId)
            );
            setSubstitutions(existingLogs);
            setStep(3);
        } else if (singleStageMode && (initialStep === 6 || initialStep === 3 || initialStep === 2)) {
            const targetDate = initialDate;
            const todayAbsences = existingAbsences.filter(a => a.date === targetDate);

            if (todayAbsences.length > 0) {
                const mappedTeachers: SelectedTeacherState[] = todayAbsences.map(abs => ({
                    id: abs.teacherId,
                    startDate: abs.date,
                    endDate: abs.date,
                    type: abs.type,
                    affectedPeriods: abs.affectedPeriods || [],
                    reason: abs.reason
                }));
                setSelectedTeachers(mappedTeachers);
                setGlobalStartDate(targetDate);
                setGlobalEndDate(targetDate);
                setBoardViewDate(targetDate);

                const teacherIds = todayAbsences.map(t => t.teacherId);
                const existingLogs = substitutionLogs.filter(log =>
                    log.date === targetDate && teacherIds.includes(log.absentTeacherId)
                );
                setSubstitutions(existingLogs);
            }
        } else {
            setBoardViewDate(globalStartDate);
        }
    }, [initialData, existingAbsences, substitutionLogs, singleStageMode, initialStep, initialDate, globalStartDate]);

    // Sync assignments
    useEffect(() => {
        const filtered = substitutions.filter(sub => sub.date === boardViewDate);
        const newAssignments = filtered.reduce((acc, sub) => {
            acc[`${sub.absentTeacherId}-${sub.period}`] = sub.substituteId;
            return acc;
        }, {} as Record<string, number>);
        setAssignments(newAssignments);
        setAssignmentVersion(v => v + 1);
    }, [substitutions, boardViewDate]);

    // Memos
    const selectedList = useMemo(() =>
        selectedTeachers.map(t => employees.find(e => e.id === t.id)).filter(Boolean) as Employee[],
        [selectedTeachers, employees]
    );

    const availableList = useMemo(() =>
        filteredEmployees.filter(e => !selectedTeachers.some(t => t.id === e.id)),
        [filteredEmployees, selectedTeachers]
    );

    const preAbsentIds = useMemo(() => {
        const ids = new Set<number>();
        existingAbsences.filter(a => a.date === globalStartDate)
            .forEach(a => ids.add(a.teacherId));
        return ids;
    }, [existingAbsences, globalStartDate]);

    const preAbsentTeachers = useMemo(() =>
        Array.from(preAbsentIds).map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[],
        [preAbsentIds, employees]
    );

    const affectedLessons = useMemo(() => {
        const dayName = getSafeDayName(globalStartDate);
        const normDay = normalizeArabic(dayName);

        return lessons.filter(l =>
            selectedTeachers.some(t => {
                if (t.id !== l.teacherId) return false;
                if (normalizeArabic(l.day) !== normDay) return false;
                if (t.type === 'FULL') return true;
                return t.affectedPeriods.includes(l.period);
            })
        );
    }, [selectedTeachers, lessons, globalStartDate]);

    const boardViewLessons = useMemo(() => {
        const dayName = getSafeDayName(boardViewDate);
        const normDay = normalizeArabic(dayName);
        return affectedLessons.filter(l => normalizeArabic(l.day) === normDay);
    }, [affectedLessons, boardViewDate]);

    const availableExternals = useMemo(() =>
        employees.filter(e => e.constraints.isExternal),
        [employees]
    );

    const availableInternalCandidates = useMemo(() => {
        const dayName = getSafeDayName(globalStartDate);
        const normDay = normalizeArabic(dayName);

        return employees.filter(e => {
            if (e.constraints.isExternal) return false;
            if (selectedTeachers.some(t => t.id === e.id)) return false;

            const teacherLessons = lessons.filter(l =>
                l.teacherId === e.id && normalizeArabic(l.day) === normDay
            );

            return teacherLessons.length < scheduleConfig.periodsPerDay;
        }).map(emp => ({
            emp,
            status: 'PARTIAL' as const,
            label: 'متاح جزئياً',
            subLabel: 'لديه فراغ',
            details: ''
        }));
    }, [employees, selectedTeachers, lessons, globalStartDate, scheduleConfig]);

    const activeReservePool = useMemo(() =>
        employees.filter(e => activeExternalIds.includes(e.id)),
        [employees, activeExternalIds]
    );

    const externalSubstitutesFromActiveIds = useMemo(() =>
        employees.filter(e => e.constraints.isExternal && activeExternalIds.includes(e.id)),
        [employees, activeExternalIds]
    );

    const derivedEngineContext = useMemo(() => {
        const context = { ...engineContext };
        events.forEach(event => {
            if (event.opContext) {
                context[event.opContext.id] = event.opContext;
            }
        });
        return context;
    }, [engineContext, events]);

    const activeEvents = useMemo(() =>
        events.filter(e => e.date === globalStartDate && e.opContext?.isActive),
        [events, globalStartDate]
    );

    const isHolidayCheck = useMemo(() => {
        const dayName = getSafeDayName(globalStartDate);
        const normDay = normalizeArabic(dayName);
        return scheduleConfig.holidays.some(h => normalizeArabic(h) === normDay);
    }, [globalStartDate, scheduleConfig]);

    const periods = useMemo(() => 
        Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1),
        [scheduleConfig.periodsPerDay]
    );

    const handleBatchAutoAssign = useCallback(() => {
        //  حساب الحصص المتأثرة بناءً على boardViewDate
        const dayName = getSafeDayName(boardViewDate);
        const normDay = normalizeArabic(dayName);
        
        const currentAffectedLessons = lessons.filter(l =>
            selectedTeachers.some(t => {
                if (t.id !== l.teacherId) return false;
                if (normalizeArabic(l.day) !== normDay) return false;
                if (t.type === 'FULL') return true;
                return t.affectedPeriods.includes(l.period);
            })
        );
        
        if (currentAffectedLessons.length === 0) {
            addToast('⚠️ لا توجد حصص متأثرة في هذا اليوم', 'warning');
            return;
        }
        
        if (!activeExternalIds || activeExternalIds.length === 0) {
            const hasEducators = employees.some(e => e.addons?.educator);
            if (!hasEducators) {
                addToast('⚠️ يرجى تحديد معلمين بدلاء في بنك الاحتياط', 'warning');
                return;
            }
        }
        
        setIsAutoAssigning(true);
        
        type TempSubLog = Pick<SubstitutionLog, 'date' | 'period' | 'substituteId'>;
        
        const currentBatchAbsentIds = selectedTeachers.map(t => t.id);
        const allModes = Object.values(derivedEngineContext) as ModeConfig[];
        const activeMode = allModes.find(m => m.isActive) || 
                          allModes.find(m => m.id === 'normalMode') || 
                          { 
                              id: 'normalMode', 
                              name: 'الوضع الاعتيادي', 
                              isActive: true,
                              target: 'all',
                              affectedGradeLevels: [],
                              affectedClassIds: [],
                              affectedPeriods: [],
                              affectedBreaks: [],
                              breakAction: 'none',
                              mergeStrategy: 'advance_second',
                              goldenRules: [],
                              policyRules: [],
                              priorityLadder: []
                          };
        
        setTimeout(() => {
            try {
                let assignedCount = 0;
                const newSubs = [...substitutions];
                const tempLogs: TempSubLog[] = substitutions.map(s => ({
                    date: s.date,
                    period: s.period,
                    substituteId: s.substituteId
                }));
                
                const dailyLoadTracker: Record<string, Record<number, number>> = {};
                const uniqueDates = [boardViewDate];
                
                uniqueDates.forEach(d => {
                    const dName = getSafeDayName(d);
                    const normDay = normalizeArabic(dName);
                    dailyLoadTracker[d] = {};
                    employees.forEach(e => {
                        const scheduleLoad = lessons.filter(l => 
                            l.teacherId === e.id && 
                            normalizeArabic(l.day) === normDay && 
                            l.type !== 'duty'
                        ).length;
                        const subLoad = substitutions.filter(s => 
                            s.date === d && 
                            s.substituteId === e.id
                        ).length;
                        dailyLoadTracker[d][e.id] = scheduleLoad + subLoad;
                    });
                });
                
                const batchAssignments: Record<string, number[]> = {};
                
                //  استخدام currentAffectedLessons
                currentAffectedLessons.forEach(l => {
                    const isNonCoverable = 
                        l.type === 'stay' || 
                        l.type === 'individual' || 
                        l.subject.includes('مشترك') || 
                        l.type === 'duty';
                    
                    if (isNonCoverable) return;
                    
                    // Add date to lesson for availability checker
                    const lessonWithDate = { ...l, date: boardViewDate };
                    
                    if (newSubs.some(s => 
                        s.period === l.period && 
                        s.classId === l.classId && 
                        s.date === boardViewDate
                    )) {
                        return;
                    }
                    
                    const periodKey = `${boardViewDate}-${l.period}`;
                    if (!batchAssignments[periodKey]) {
                        batchAssignments[periodKey] = [];
                    }
                    
                    const checker = new AvailabilityChecker({
                        lesson: lessonWithDate,
                        employees,
                        lessons,
                        tempLogs: tempLogs as any,
                        events,
                        dailyLoadTracker,
                        currentBatchAbsentIds,
                        batchAssignments
                    });
                    
                    const checkAvailability = (empId: number) => checker.isAvailable(empId);
                    
                    let bestCandidate = null;
                    
                    const allCandidates = employees.filter(e =>
                        activeExternalIds.includes(e.id) ||
                        (e.addons?.educator && e.addons.educatorClassId === l.classId)
                    );
                    
                    allCandidates.sort((a, b) => {
                        const isAEducator = a.addons?.educator && a.addons.educatorClassId === l.classId;
                        const isBEducator = b.addons?.educator && b.addons.educatorClassId === l.classId;
                        
                        if (isAEducator && !isBEducator) return -1;
                        if (!isAEducator && isBEducator) return 1;
                        
                        const loadA = dailyLoadTracker[boardViewDate]?.[a.id] || 0;
                        const loadB = dailyLoadTracker[boardViewDate]?.[b.id] || 0;
                        return loadA - loadB;
                    });
                    
                    for (const cand of allCandidates) {
                        if (checkAvailability(cand.id)) {
                            const lessonType = lessons.find(les =>
                                les.teacherId === cand.id &&
                                normalizeArabic(les.day) === normDay &&
                                les.period === l.period
                            )?.type;
                            
                            const normalizedLessonType = lessonType?.toLowerCase();
                            
                            if (cand.addons?.educator && cand.addons.educatorClassId === l.classId) {
                                bestCandidate = {
                                    teacherId: cand.id,
                                    teacherName: cand.name,
                                    type: cand.constraints.isExternal ? 'assign_external' : 'assign_internal',
                                    reason: 'مربي الصف'
                                };
                                break;
                            } else if (normalizedLessonType === 'stay' || normalizedLessonType === 'makooth') {
                                if (!bestCandidate) {
                                    bestCandidate = {
                                        teacherId: cand.id,
                                        teacherName: cand.name,
                                        type: cand.constraints.isExternal ? 'assign_external' : 'assign_internal',
                                        reason: 'معلم مكوث'
                                    };
                                }
                            } else if (normalizedLessonType === 'individual') {
                                if (!bestCandidate || bestCandidate.reason.includes('مكوث')) {
                                    bestCandidate = {
                                        teacherId: cand.id,
                                        teacherName: cand.name,
                                        type: cand.constraints.isExternal ? 'assign_external' : 'assign_internal',
                                        reason: 'معلم فردي'
                                    };
                                }
                            } else {
                                bestCandidate = {
                                    teacherId: cand.id,
                                    teacherName: cand.name,
                                    type: cand.constraints.isExternal ? 'assign_external' : 'assign_internal',
                                    reason: 'معلم متاح'
                                };
                                break;
                            }
                        }
                    }
                    
                    if (!bestCandidate) {
                        const options = generateSubstitutionOptions(
                            l.teacherId, l.period, boardViewDate, 
                            employees, lessons, classes, scheduleConfig, 
                            tempLogs as any, events, [], derivedEngineContext
                        );
                        const validOptions = options.filter(o => checkAvailability(o.teacherId));
                        if (validOptions.length > 0) {
                            const top = validOptions[0];
                            bestCandidate = {
                                teacherId: top.teacherId,
                                teacherName: top.teacherName,
                                type: top.decisionType,
                                reason: top.reason + ' (AI)'
                            };
                        }
                    }
                    
                    if (bestCandidate) {
                        newSubs.push({
                            date: boardViewDate,
                            period: l.period,
                            classId: l.classId,
                            absentTeacherId: l.teacherId,
                            substituteId: bestCandidate.teacherId,
                            substituteName: bestCandidate.teacherName,
                            type: bestCandidate.type as any,
                            reason: bestCandidate.reason,
                            modeContext: activeMode.name
                        });
                        tempLogs.push({ date: boardViewDate, period: l.period, substituteId: bestCandidate.teacherId });
                        batchAssignments[periodKey].push(bestCandidate.teacherId);
                        if (dailyLoadTracker[boardViewDate]) {
                            dailyLoadTracker[boardViewDate][bestCandidate.teacherId] = 
                                (dailyLoadTracker[boardViewDate][bestCandidate.teacherId] || 0) + 1;
                        }
                        assignedCount++;
                    }
                });
                
                setSubstitutions(newSubs);
                
                //  تحديث Board
                const boardSubs = newSubs.filter(s => s.date === boardViewDate);
                const newAssignments = boardSubs.reduce((acc, sub) => {
                    acc[`${sub.absentTeacherId}-${sub.period}`] = sub.substituteId;
                    return acc;
                }, {} as Record<string, number>);
                
                setAssignments(newAssignments);
                setAssignmentVersion(v => v + 1);
                
                if (assignedCount > 0) {
                    addToast(` تم توزيع ${assignedCount} حصة بنجاح`, 'success');
                } else {
                    addToast('⚠️ لم يتم العثور على بدلاء متاحين', 'warning');
                }
                
            } catch (error) {
                console.error('Error in auto-assignment:', error);
                addToast(`❌ حدث خطأ: ${error instanceof Error ? error.message : ''}`, 'error');
            } finally {
                setIsAutoAssigning(false);
            }
        }, SUBSTITUTION_LIMITS.AUTO_ASSIGN_DELAY_MS);
        
    }, [
        boardViewDate,
        lessons,
        selectedTeachers,
        activeExternalIds,
        employees,
        substitutions,
        derivedEngineContext,
        events,
        scheduleConfig,
        classes,
        addToast
    ]);

    const handleTeacherToggle = useCallback((teacherId: number) => {
        setSelectedTeachers(prev => {
            const exists = prev.find(t => t.id === teacherId);
            if (exists) {
                return prev.filter(t => t.id !== teacherId);
            } else {
                return [...prev, {
                    id: teacherId,
                    startDate: globalStartDate,
                    endDate: globalEndDate,
                    type: 'FULL' as const,
                    affectedPeriods: [],
                    reason: scheduleConfig.absenceReasons[0] || 'مرضي'
                }];
            }
        });
    }, [globalStartDate, globalEndDate, scheduleConfig]);

    const updateTeacherConfig = useCallback((
        teacherId: number,
        field: keyof SelectedTeacherState,
        value: any
    ) => {
        setSelectedTeachers(prev =>
            prev.map(t => t.id === teacherId ? { ...t, [field]: value } : t)
        );
    }, []);

    const applyGlobalDatesToAll = useCallback((start: string, end: string) => {
        setGlobalStartDate(start);
        setGlobalEndDate(end);
        setSelectedTeachers(prev => prev.map(t => ({
            ...t,
            startDate: start,
            endDate: end
        })));
    }, []);

    const handleApplyToAllDetails = useCallback(() => {
        if (selectedTeachers.length === 0) return;

        const template = selectedTeachers[0];
        setSelectedTeachers(prev => prev.map(t => ({
            ...t,
            type: template.type,
            affectedPeriods: [...template.affectedPeriods],
            reason: template.reason
        })));

        addToast(' تم تطبيق التفاصيل على جميع المعلمين', 'success');
    }, [selectedTeachers, addToast]);

    const handleBoardAssign = useCallback((slotKey: string, substituteId: number | null) => {
        setAssignments(prev => {
            const updated = { ...prev };
            if (substituteId === null) {
                delete updated[slotKey];
            } else {
                updated[slotKey] = substituteId;
            }
            return updated;
        });
        setAssignmentVersion(v => v + 1);
    }, []);

    const handleBoardBulkAssign = useCallback((absentTeacherId: number, substituteId: number) => {
        const absentTeacher = selectedTeachers.find(t => t.id === absentTeacherId);
        if (!absentTeacher) return;
        
        const periodsToAssign = absentTeacher.type === 'FULL' 
            ? periods 
            : absentTeacher.affectedPeriods;
        
        const dayName = getSafeDayName(boardViewDate);
        const normDay = normalizeArabic(dayName);
        
        const teacherLessons = lessons.filter(l =>
            l.teacherId === absentTeacherId &&
            normalizeArabic(l.day) === normDay &&
            periodsToAssign.includes(l.period) &&
            l.type !== 'stay' &&
            l.type !== 'individual'
        );
        
        const newSubs = teacherLessons.map(lesson => ({
            date: boardViewDate,
            period: lesson.period,
            classId: lesson.classId,
            absentTeacherId: absentTeacherId,
            substituteId: substituteId,
            substituteName: employees.find(e => e.id === substituteId)?.name || '',
            type: 'assign_bulk' as any,
            reason: 'Bulk Assignment',
            modeContext: 'Manual Bulk Assignment'
        }));
        
        setSubstitutions(prev => {
            const filtered = prev.filter(s => 
                !(s.date === boardViewDate && 
                  s.absentTeacherId === absentTeacherId && 
                  periodsToAssign.includes(s.period))
            );
            return [...filtered, ...newSubs];
        });
        
        setAssignmentVersion(v => v + 1);
        
        addToast(
            ` تم تعيين ${newSubs.length} حصة بشكل جماعي`,
            'success'
        );
    }, [selectedTeachers, periods, boardViewDate, lessons, employees, addToast]);

    const handleToggleAssistantCoverage = useCallback((slotKey: string) => {
        setAssistantCoverage(prev => ({ ...prev, [slotKey]: !prev[slotKey] }));
    }, []);

    const handleToggleClassMerge = useCallback((slotKey: string) => {
        setClassMerges(prev => {
            const updated = { ...prev };
            
            if (prev[slotKey]) {
                delete updated[slotKey];
            } else {
                const [teacherIdStr, periodStr] = slotKey.split('-');
                const teacherId = Number(teacherIdStr);
                const period = Number(periodStr);
                
                const dayName = getSafeDayName(boardViewDate);
                const normDay = normalizeArabic(dayName);
                
                const lesson = lessons.find(l =>
                    l.teacherId === teacherId &&
                    l.period === period &&
                    normalizeArabic(l.day) === normDay
                );
                
                if (lesson) {
                    updated[slotKey] = {
                        mergedClasses: [lesson.classId],
                        targetClassId: lesson.classId
                    };
                } else {
                    updated[slotKey] = {
                        mergedClasses: [],
                        targetClassId: ''
                    };
                }
            }
            
            return updated;
        });
    }, [boardViewDate, lessons]);

    const handleBoardUnassign = useCallback((slotKey: string) => {
        setAssignments(prev => {
            const updated = { ...prev };
            delete updated[slotKey];
            return updated;
        });
        setAssignmentVersion(v => v + 1);
    }, []);

    const handleAssignSubstitute = useCallback((absentId: number, period: number, date: string, substitute: any) => {
        const slotKey = `${absentId}-${period}`;
        setAssignments(prev => ({ ...prev, [slotKey]: substitute.id }));
        setAssignmentVersion(v => v + 1);
    }, []);

    const toggleWizardSelection = useCallback((id: number) => {
        setActiveExternalIds(prev => 
            prev.includes(id) 
                ? prev.filter(x => x !== id) 
                : [...prev, id]
        );
    }, []);

    const handleWizardNext = useCallback(() => {
        if (wizardStep < 3) {
            setWizardStep(prev => (prev + 1) as 1 | 2 | 3);
        } else {
            setIsWizardOpen(false);
            addToast('تم تجهيز قائمة البدلاء والأولويات بنجاح', 'success');
        }
    }, [wizardStep, addToast]);

    const goToNextStep = useCallback(() => {
        if (step < 7) setStep((prev) => (prev + 1) as any);
    }, [step]);
    
    const goToPrevStep = useCallback(() => {
        if (step > 1) setStep((prev) => (prev - 1) as any);
    }, [step]);
    
    const goToStep = useCallback((newStep: 1 | 2 | 3 | 4 | 5 | 6 | 7) => {
        setStep(newStep);
    }, []);
    
    /**
     * Validates the current step data
     */
    const validateCurrentStep = useCallback(() => {
        switch (step) {
            case 1:
                // Step 1: Must have at least one teacher selected
                if (selectedTeachers.length === 0) {
                    return { valid: false, message: 'يجب اختيار معلم واحد على الأقل' };
                }
                return { valid: true };
            
            case 2:
                // Step 2: All teachers must have valid configuration
                for (const teacher of selectedTeachers) {
                    if (!teacher.startDate || !teacher.endDate) {
                        return { valid: false, message: 'يجب تحديد تواريخ الغياب لجميع المعلمين' };
                    }
                    if (teacher.type === 'PARTIAL' && teacher.affectedPeriods.length === 0) {
                        return { valid: false, message: 'يجب تحديد حصة واحدة على الأقل للغياب الجزئي' };
                    }
                    if (!teacher.reason) {
                        return { valid: false, message: 'يجب تحديد سبب الغياب لجميع المعلمين' };
                    }
                }
                return { valid: true };
            
            case 3:
            case 4:
            case 5:
            case 6:
                // Optional steps - always valid
                return { valid: true };
            
            default:
                return { valid: true };
        }
    }, [step, selectedTeachers]);

    /**
     * Save without navigating to next step
     */
    const handleSaveWithoutNext = useCallback(async () => {
        // Validate current step
        const validation = validateCurrentStep();
        if (!validation.valid) {
            addToast(validation.message || 'يرجى إكمال البيانات المطلوبة', 'error');
            return false;
        }

        // Call the submit handler (same as final submit)
        try {
            if (onSubmit) {
                await onSubmit();
            }
            addToast('تم حفظ التغييرات بنجاح', 'success');
            return true;
        } catch (error) {
            addToast('حدث خطأ أثناء الحفظ', 'error');
            console.error('Save error:', error);
            return false;
        }
    }, [validateCurrentStep, onSubmit, addToast]);

    /**
     * Save and close the form (optional variant)
     */
    const handleSaveAndClose = useCallback(async () => {
        const success = await handleSaveWithoutNext();
        if (success && onClose) {
            onClose();
        }
    }, [handleSaveWithoutNext, onClose]);
    
    return {
        step, setStep,
        selectedTeachers, setSelectedTeachers,
        globalStartDate, setGlobalStartDate,
        globalEndDate, setGlobalEndDate,
        searchTerm, setSearchTerm,
        activeExternalIds, setActiveExternalIds,
        selectedModeIds, setSelectedModeIds,
        detectedGaps, setDetectedGaps,
        gapSolutions, setGapSolutions,
        substitutions, setSubstitutions,
        assistantCoverage, setAssistantCoverage,
        classMerges, setClassMerges,
        isAutoAssigning, setIsAutoAssigning,
        boardViewDate, setBoardViewDate,
        filteredEmployees,
        isWizardOpen, setIsWizardOpen,
        wizardStep, setWizardStep,
        assignments, setAssignments,
        assignmentVersion, setAssignmentVersion,
        selectedList,
        availableList,
        preAbsentIds,
        preAbsentTeachers,
        affectedLessons,
        boardViewLessons,
        availableExternals,
        availableInternalCandidates,
        externalSubstitutesFromActiveIds,
        activeReservePool,
        derivedEngineContext,
        activeEvents,
        isHolidayCheck,
        periods,
        handleTeacherToggle,
        updateTeacherConfig,
        applyGlobalDatesToAll,
        handleApplyToAllDetails,
        handleBatchAutoAssign,
        handleBoardAssign,
        handleBoardBulkAssign,
        handleToggleAssistantCoverage,
        handleToggleClassMerge,
        handleBoardUnassign,
        handleAssignSubstitute,
        toggleWizardSelection,
        handleWizardNext,
        goToNextStep,
        goToPrevStep,
        goToStep,
        handleSaveWithoutNext,
        handleSaveAndClose,
        validateCurrentStep
    };
};