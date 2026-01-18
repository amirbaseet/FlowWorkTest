
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Employee, ClassItem, Lesson, ScheduleConfig, AcademicYear,
    Facility, BreakPeriod, DutyAssignment, DutySettings,
    TeacherWorkload, FacilityPressure, TeacherSuggestion,
    SubLocation
} from '@/types';
import { FACILITY_TYPES, DEFAULT_FACILITIES, GRADES_AR } from '@/constants';
import { timeToMins, minsToTime, toLocalISOString, normalizeArabic } from '@/utils';

interface UseDutyProps {
    employees: Employee[];
    lessons: Lesson[];
    classes: ClassItem[];
    scheduleConfig: ScheduleConfig;
    initialFacilities?: Facility[];
    initialAssignments?: DutyAssignment[];
    initialBreakPeriods?: BreakPeriod[];
}

export const useDuty = ({
    employees,
    lessons,
    classes,
    scheduleConfig,
    initialFacilities = [],
    initialAssignments = [],
    initialBreakPeriods = []
}: UseDutyProps) => {
    // --- STATE ---
    const [facilities, setFacilities] = useState<Facility[]>(initialFacilities.length > 0 ? initialFacilities : DEFAULT_FACILITIES);
    const [dutyAssignments, setDutyAssignments] = useState<DutyAssignment[]>(initialAssignments);
    const [breakPeriods, setBreakPeriods] = useState<BreakPeriod[]>(initialBreakPeriods);
    const [dutySettings, setDutySettings] = useState<DutySettings>({
        dailyDutyCount: 3,
        linkedToSchedule: true,
        autoExtractBreaks: true,
        availableGrades: []
    });

    // --- DERIVED STATE: Teacher Workloads ---
    const teacherWorkloads = useMemo<TeacherWorkload[]>(() => {
        return employees.map(teacher => {
            const actual = lessons.filter(l => l.teacherId === teacher.id && l.type === 'actual').length;
            const individual = lessons.filter(l => l.teacherId === teacher.id && l.type === 'individual').length;
            const stay = lessons.filter(l => l.teacherId === teacher.id && l.type === 'stay').length;
            const total = actual + individual + stay;
            const capacity = teacher.contractedHours - total;

            let availability: 'available' | 'loaded' | 'overloaded';
            if (capacity > 2) availability = 'available';
            else if (capacity >= 0) availability = 'loaded';
            else availability = 'overloaded';

            // Simple scoring: more capacity = higher score
            const score = Math.max(0, capacity * 10 + 50);

            return {
                teacher,
                actual,
                individual,
                stay,
                total,
                capacity,
                availability,
                score
            };
        });
    }, [employees, lessons]);

    // --- DERIVED STATE: Break Periods Calculations ---
    // Sync break periods with scheduleConfig settings
    useEffect(() => {
        if (!dutySettings.autoExtractBreaks) return;

        const periods: BreakPeriod[] = [];
        let order = 1;
        let currentMins = timeToMins(scheduleConfig.schoolStartTime);

        // Morning Break
        const morningBreak = scheduleConfig.morningBreak;
        if (morningBreak?.enabled && morningBreak.duration > 0) {
            const existingBreak = breakPeriods.find(bp => bp.id === 'morning_break');
            periods.push({
                id: 'morning_break',
                name: 'استراحة صباحية (مناوبة)',
                startTime: minsToTime(currentMins),
                endTime: minsToTime(currentMins + morningBreak.duration),
                order: order++,
                breakType: 'external',
                isAutoLinked: true,
                sourceType: 'schedule',
                internalTargetGrades: existingBreak?.internalTargetGrades || [],
                externalTargetGrades: existingBreak?.externalTargetGrades || []
            });
            currentMins += morningBreak.duration;
        }

        // Standard Breaks
        for (let i = 1; i <= scheduleConfig.periodsPerDay; i++) {
            const pDur = scheduleConfig.customPeriodDurations?.[i] || scheduleConfig.periodDuration;
            currentMins += pDur;

            const bType = scheduleConfig.breakTypes?.[i] || 'none';
            if (bType !== 'none') {
                const bDur = scheduleConfig.breakDurations?.[i] || (bType === 'long' ? 20 : 5);
                const breakStart = minsToTime(currentMins);
                const breakEnd = minsToTime(currentMins + bDur);
                const breakId = `break${i}`;

                const existingBreak = breakPeriods.find(bp => bp.id === breakId);

                periods.push({
                    id: breakId,
                    name: bType === 'long'
                        ? `الاستراحة ${['الأولى', 'الثانية', 'الثالثة', 'الرابعة'][order - 1] || `#${order}`} (رئيسية)`
                        : `استراحة قصيرة بعد ح ${i}`,
                    startTime: breakStart,
                    endTime: breakEnd,
                    order: order++,
                    breakType: bType === 'long' ? 'external' : 'internal',
                    isAutoLinked: true,
                    sourceType: 'schedule',
                    internalTargetGrades: existingBreak?.internalTargetGrades || [],
                    externalTargetGrades: existingBreak?.externalTargetGrades || []
                });
                currentMins += bDur;
            }
        }

        // Only update if different to avoid infinite loops
        if (JSON.stringify(periods) !== JSON.stringify(breakPeriods)) {
            setBreakPeriods(periods);
        }

    }, [scheduleConfig, dutySettings.autoExtractBreaks]);

    // --- DERIVED STATE: Facility Pressure ---
    const facilitiesPressure = useMemo<FacilityPressure[]>(() => {
        return facilities.map(facility => {
            const requiredTeachers = Math.ceil(facility.capacity / 50);
            const coverageRatio = facility.assignedTeachers.length / requiredTeachers;

            let pressureStatus: 'overcrowded' | 'loaded' | 'balanced';
            if (coverageRatio < 0.7) pressureStatus = 'overcrowded';
            else if (coverageRatio < 1.0) pressureStatus = 'loaded';
            else pressureStatus = 'balanced';

            return {
                ...facility,
                coverageRatio,
                pressureStatus,
                requiredTeachers
            };
        });
    }, [facilities]);

    // --- DERIVED STATE: KPIs ---
    const kpis = useMemo(() => {
        const totalTeachers = employees.length;
        const fullTime = employees.filter(e => !e.constraints?.isHalfTime).length;
        const halfTime = employees.filter(e => e.constraints?.isHalfTime).length;
        const external = employees.filter(e => e.constraints?.isExternal).length;
        const internal = totalTeachers - external;
        const available = teacherWorkloads.filter(t => t.availability === 'available').length;
        const overloaded = teacherWorkloads.filter(t => t.availability === 'overloaded').length;

        const totalLessons = lessons.length;
        const actualLessons = lessons.filter(l => l.type === 'actual').length;
        const individualLessons = lessons.filter(l => l.type === 'individual').length;
        const stayLessons = lessons.filter(l => l.type === 'stay').length;
        const averageLoad = totalTeachers > 0 ? (totalLessons / totalTeachers).toFixed(1) : '0';

        const totalFacilities = facilities.length;
        const overcrowdedFacilities = facilitiesPressure.filter(f => f.pressureStatus === 'overcrowded').length;
        const balancedFacilities = facilitiesPressure.filter(f => f.pressureStatus === 'balanced').length;

        return {
            totalTeachers, fullTime, halfTime, external, internal,
            available, overloaded,
            totalLessons, actualLessons, individualLessons, stayLessons, averageLoad,
            totalFacilities, overcrowdedFacilities, balancedFacilities
        };
    }, [employees, lessons, teacherWorkloads, facilities, facilitiesPressure]);

    // --- ACTIONS ---

    const handleAssignDuty = (teacherId: string, facilityId: string, breakPeriodId: string, date: string, subLocationId?: string) => {
        const newAssignment: DutyAssignment = {
            id: `duty-${Date.now()}-${Math.random()}`,
            teacherId,
            facilityId,
            breakPeriodId,
            date,
            subLocationId
        };
        setDutyAssignments(prev => [...prev, newAssignment]);
    };

    const handleRemoveAssignment = (assignmentId: string) => {
        setDutyAssignments(prev => prev.filter(a => a.id !== assignmentId));
    };

    const handleSwapDuty = (assignmentId: string, newTeacherId: string) => {
        setDutyAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, teacherId: newTeacherId } : a
        ));
    };

    // --- SMART SUGGESTIONS ---
    const getSuggestedTeachers = (facility: Facility, breakPeriod: BreakPeriod, date: string, limit: number = 5): TeacherSuggestion[] => {
        const suggestions: TeacherSuggestion[] = [];
        const targetClassIds = facility.targetClasses || [];

        // Helper to check availability for the specific day
        // TODO: Add day-specific availability check logic if needed

        // Logic similar to component:
        // 1. Class Educators
        targetClassIds.forEach(classId => {
            const educator = employees.find(e => e.addons?.educator && e.addons?.educatorClassId === classId);
            if (educator) {
                suggestions.push({
                    teacher: educator,
                    workload: teacherWorkloads.find(tw => tw.teacher.id === educator.id)!,
                    score: 100,
                    reasons: [`مربي صف ${classes.find(c => c.id === classId)?.name}`]
                });
            }
        });

        // 2. Teachers of target grades/classes
        // ... Implement logic similar to component ...
        // For now, returning top available teachers based on workload score
        const available = teacherWorkloads
            .filter(t => t.availability !== 'overloaded')
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        available.forEach(tw => {
            if (!suggestions.find(s => s.teacher.id === tw.teacher.id)) {
                suggestions.push({
                    teacher: tw.teacher,
                    workload: tw,
                    score: tw.score,
                    reasons: ['عبء عمل منخفض', 'متاح']
                });
            }
        });

        return suggestions.slice(0, limit);
    };

    return {
        facilities, setFacilities,
        dutyAssignments, setDutyAssignments,
        breakPeriods, setBreakPeriods,
        dutySettings, setDutySettings,
        teacherWorkloads,
        facilitiesPressure,
        kpis,
        handleAssignDuty,
        handleRemoveAssignment,
        handleSwapDuty,
        getSuggestedTeachers
    };
};
