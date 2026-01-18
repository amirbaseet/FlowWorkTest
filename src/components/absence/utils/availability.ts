// src/components/absence/utils/availability.ts

import { Employee, Lesson, CalendarEvent } from '@/types';
import { SUBSTITUTION_LIMITS } from '@/constants/substitution';
import { normalizeArabic } from '@/utils';
import { DAYS_AR } from '@/constants';

// Internal helper instead of circular import from utils/index.ts
const getSafeDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return DAYS_AR[d.getDay()];
};

interface AvailabilityContext {
    lesson: any; // Using any for lesson to avoid strict typing issues with augmented properties
    employees: Employee[];
    lessons: Lesson[];
    tempLogs: Array<{ date: string; period: number; substituteId: number }>;
    events: CalendarEvent[];
    dailyLoadTracker: Record<string, Record<number, number>>;
    currentBatchAbsentIds: number[];
    batchAssignments: Record<string, number[]>;
}

/**
 * Class to check if a teacher is available for substitution
 */
export class AvailabilityChecker {
    constructor(private context: AvailabilityContext) {}
    
    /**
     * Check if teacher is currently absent
     */
    private isAbsent(empId: number): boolean {
        return this.context.currentBatchAbsentIds.includes(empId);
    }
    
    /**
     * Check if teacher has exceeded daily substitution limit
     */
    private hasExceededDailyLimit(empId: number): boolean {
        const load = this.context.dailyLoadTracker[this.context.lesson.date]?.[empId] || 0;
        return load >= SUBSTITUTION_LIMITS.MAX_DAILY_SUBSTITUTIONS;
    }
    
    /**
     * Check if teacher is already assigned in this period
     */
    private isAlreadyAssigned(empId: number): boolean {
        const periodKey = `${this.context.lesson.date}-${this.context.lesson.period}`;
        return this.context.batchAssignments[periodKey]?.includes(empId) || false;
    }
    
    /**
     * Check if teacher has a scheduled lesson at this time
     */
    private hasScheduleConflict(empId: number): boolean {
        const emp = this.context.employees.find(e => e.id === empId);
        if (!emp || emp.constraints.isExternal) return false;
        
        const dayName = getSafeDayName(this.context.lesson.date);
        const normDay = normalizeArabic(dayName);
        
        return this.context.lessons.some(les =>
            les.teacherId === empId &&
            normalizeArabic(les.day) === normDay &&
            les.period === this.context.lesson.period
        );
    }
    
    /**
     * Check if teacher is already assigned as substitute elsewhere
     */
    private hasSubstitutionConflict(empId: number): boolean {
        return this.context.tempLogs.some(s =>
            s.substituteId === empId &&
            s.period === this.context.lesson.period &&
            s.date === this.context.lesson.date
        );
    }
    
    /**
     * Check if teacher is busy with an event
     */
    private hasEventConflict(empId: number): boolean {
        const emp = this.context.employees.find(e => e.id === empId);
        if (!emp) return false;
        
        return this.context.events.some(e =>
            e.date === this.context.lesson.date &&
            e.appliesTo.periods.includes(this.context.lesson.period) &&
            (e.plannerId === empId || e.participants.some(p => p.userId === emp.id))
        );
    }
    
    /**
     * Main availability check
     * @returns true if teacher is available, false otherwise
     */
    public isAvailable(empId: number): boolean {
        if (this.isAbsent(empId)) return false;
        if (this.hasExceededDailyLimit(empId)) return false;
        if (this.isAlreadyAssigned(empId)) return false;
        if (this.hasScheduleConflict(empId)) return false;
        if (this.hasSubstitutionConflict(empId)) return false;
        if (this.hasEventConflict(empId)) return false;
        
        return true;
    }
    
    /**
     * Get the reason why a teacher is unavailable (for debugging)
     * @returns Arabic reason string or null if available
     */
    public getUnavailabilityReason(empId: number): string | null {
        if (this.isAbsent(empId)) return 'المعلم غائب';
        if (this.hasExceededDailyLimit(empId)) return 'تجاوز الحد اليومي للبدلاء';
        if (this.isAlreadyAssigned(empId)) return 'معين بالفعل في هذه الفترة';
        if (this.hasScheduleConflict(empId)) return 'تعارض مع الجدول الأساسي';
        if (this.hasSubstitutionConflict(empId)) return 'معين كبديل في نفس الفترة';
        if (this.hasEventConflict(empId)) return 'مشغول بفعالية أو نشاط';
        
        return null;
    }
}
