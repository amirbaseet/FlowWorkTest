// src/components/absence/hooks/useAutoDistribution.ts

import { useState, useCallback } from 'react';
import { Employee, Lesson, ClassItem, ScheduleConfig, CalendarEvent, EngineContext, SubstitutionLog, AffectedLesson } from '@/types';
import { AvailabilityChecker } from '../utils/availability';
import { SUBSTITUTION_LIMITS } from '@/constants/substitution';
import { getSafeDayName, normalizeArabic } from '@/utils';
import { useToast } from '@/contexts/ToastContext';

interface UseAutoDistributionProps {
    affectedLessons: AffectedLesson[];
    selectedTeachers: any[];
    activeExternalIds: number[];
    substitutions: any[];
    employees: Employee[];
    lessons: Lesson[];
    classes: ClassItem[];
    scheduleConfig: ScheduleConfig;
    events: CalendarEvent[];
    derivedEngineContext: EngineContext;
}

export const useAutoDistribution = ({
    affectedLessons,
    selectedTeachers,
    activeExternalIds,
    substitutions,
    employees,
    lessons,
    classes,
    scheduleConfig,
    events,
    derivedEngineContext
}: UseAutoDistributionProps) => {
    const { addToast } = useToast();
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);
    
    const handleBatchAutoAssign = useCallback(() => {
        // Validation
        if (affectedLessons.length === 0) {
            addToast('لا توجد حصص تحتاج تغطية', 'info');
            return;
        }
        
        if (!activeExternalIds || activeExternalIds.length === 0) {
            addToast('⚠️ يرجى تحديد معلمين بدلاء متاحين أولاً', 'warning');
            return;
        }
        
        setIsAutoAssigning(true);
        
        const currentBatchAbsentIds = selectedTeachers.map(t => t.id);
        const allModes = Object.values(derivedEngineContext);
        const activeMode = allModes.find((m: any) => m.isActive) || 
                          allModes.find((m: any) => m.id === 'normalMode') || 
                          { 
                              id: 'normalMode', 
                              name: 'الوضع الاعتيادي', 
                              isActive: true 
                          };
        
        setTimeout(() => {
            try {
                let assignedCount = 0;
                const newSubs = [...substitutions];
                const tempLogs = [...substitutions];
                
                const dailyLoadTracker: Record<string, Record<number, number>> = {};
                const uniqueDates = Array.from(new Set(affectedLessons.map(l => l.date)));
                
                // Initialize daily load tracker
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
                
                // Process each affected lesson
                affectedLessons.forEach(l => {
                    const isNonCoverable = l.type === 'stay' || 
                                         l.type === 'individual' || 
                                         l.subject.includes('مشترك') || 
                                         l.type === 'duty';
                    
                    if (isNonCoverable) return;
                    if (newSubs.some(s => s.period === l.period && s.classId === l.classId && s.date === l.date)) {
                        return;
                    }
                    
                    const periodKey = `${l.date}-${l.period}`;
                    if (!batchAssignments[periodKey]) {
                        batchAssignments[periodKey] = [];
                    }
                    
                    // Create availability checker
                    const checker = new AvailabilityChecker({
                        lesson: l,
                        employees,
                        lessons,
                        tempLogs,
                        events,
                        dailyLoadTracker,
                        currentBatchAbsentIds,
                        batchAssignments
                    });
                    
                    let bestCandidate = null;
                    
                    // Get candidates
                    const allCandidates = employees.filter(e =>
                        activeExternalIds.includes(e.id) ||
                        (e.addons.educator && e.addons.educatorClassId === l.classId)
                    );
                    
                    // Sort by priority
                    allCandidates.sort((a, b) => {
                        const isAEducator = a.addons.educator && a.addons.educatorClassId === l.classId;
                        const isBEducator = b.addons.educator && b.addons.educatorClassId === l.classId;
                        
                        if (isAEducator && !isBEducator) return -1;
                        if (!isAEducator && isBEducator) return 1;
                        
                        const loadA = dailyLoadTracker[l.date]?.[a.id] || 0;
                        const loadB = dailyLoadTracker[l.date]?.[b.id] || 0;
                        return loadA - loadB;
                    });
                    
                    // Find best available candidate
                    for (const cand of allCandidates) {
                        if (checker.isAvailable(cand.id)) {
                            bestCandidate = {
                                teacherId: cand.id,
                                teacherName: cand.name,
                                type: cand.constraints.isExternal ? 'assign_external' : 'assign_internal',
                                reason: cand.addons.educator && cand.addons.educatorClassId === l.classId
                                    ? 'مربي الصف (أولوية قصوى)'
                                    : 'معلم متاح'
                            };
                            break;
                        }
                    }
                    
                    // Assign if found
                    if (bestCandidate) {
                        newSubs.push({
                            date: l.date,
                            period: l.period,
                            classId: l.classId,
                            absentTeacherId: l.teacherId,
                            substituteId: bestCandidate.teacherId,
                            substituteName: bestCandidate.teacherName,
                            type: bestCandidate.type,
                            reason: bestCandidate.reason,
                            modeContext: (activeMode as any).name
                        });
                        
                        tempLogs.push({ 
                            date: l.date, 
                            period: l.period, 
                            substituteId: bestCandidate.teacherId 
                        });
                        
                        batchAssignments[periodKey].push(bestCandidate.teacherId);
                        
                        if (dailyLoadTracker[l.date]) {
                            dailyLoadTracker[l.date][bestCandidate.teacherId] = 
                                (dailyLoadTracker[l.date][bestCandidate.teacherId] || 0) + 1;
                        }
                        
                        assignedCount++;
                    }
                });
                
                // Success
                if (assignedCount > 0) {
                    addToast(
                        `✅ تم توزيع ${assignedCount} حصة بنجاح`,
                        'success'
                    );
                } else {
                    addToast(
                        '⚠️ لم يتم العثور على بدلاء مناسبين',
                        'warning'
                    );
                }
                
                return newSubs;
                
            } catch (error) {
                console.error('Error in auto-assignment:', error);
                
                const message = error instanceof Error 
                    ? error.message 
                    : 'حدث خطأ أثناء التوزيع التلقائي';
                    
                addToast(`❌ ${message}`, 'error');
                
                return substitutions;
                
            } finally {
                setIsAutoAssigning(false);
            }
        }, SUBSTITUTION_LIMITS.AUTO_ASSIGN_DELAY_MS);
    }, [
        affectedLessons,
        selectedTeachers,
        activeExternalIds,
        substitutions,
        employees,
        lessons,
        events,
        derivedEngineContext,
        addToast
    ]);
    
    return {
        handleBatchAutoAssign,
        isAutoAssigning
    };
};
