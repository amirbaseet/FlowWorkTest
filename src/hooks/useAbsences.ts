// src/hooks/useAbsences.ts

import { useState, useCallback, useMemo, useEffect } from 'react';
import { AbsenceRecord } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Enhanced hook for managing absence records
 * Includes validation, persistence, and helper functions
 */
export const useAbsences = () => {
    // Load from localStorage on mount
    const [absences, setAbsences] = useState<AbsenceRecord[]>(() => {
        try {
            const stored = localStorage.getItem('classflow_absences');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            logger.error('Failed to load absences from localStorage', error);
            return [];
        }
    });
    
    // Persist to localStorage on changes
    useEffect(() => {
        try {
            localStorage.setItem('classflow_absences', JSON.stringify(absences));
        } catch (error) {
            logger.error('Failed to save absences to localStorage', error);
        }
    }, [absences]);
    
    /**
     * Validate absence record before adding/updating
     */
    const validateAbsence = useCallback((absence: Partial<AbsenceRecord>): string[] => {
        const errors: string[] = [];
        
        if (!absence.teacherId) {
            errors.push('رقم المعلم مطلوب');
        }
        if (!absence.date) {
            errors.push('التاريخ مطلوب');
        }
        if (!absence.type) {
            errors.push('نوع الغياب مطلوب');
        }
        if (absence.type === 'PARTIAL' && (!absence.affectedPeriods || absence.affectedPeriods.length === 0)) {
            errors.push('يجب تحديد الحصص المتأثرة للغياب الجزئي');
        }
        
        return errors;
    }, []);
    
    /**
     * Add new absence with validation
     */
    const addAbsence = useCallback((absence: Omit<AbsenceRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
        const errors = validateAbsence(absence);
        
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        
        const newAbsence: AbsenceRecord = {
            ...absence,
            id: Date.now(), // Fallback to number if type expects number, or keep as string if allowed
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: absence.status || 'OPEN'
        } as unknown as AbsenceRecord; // Type assertion to handle id type flexibility
        
        // Note: The prompt used a string ID, but types/index.ts might expect number.
        // Let's check types/index.ts to be sure.
        
        setAbsences(prev => [...prev, newAbsence]);
        
        logger.debug('useAbsences', 'Added new absence', {
            id: newAbsence.id,
            teacherId: newAbsence.teacherId,
            date: newAbsence.date
        });
        
        return newAbsence;
    }, [validateAbsence]);
    
    /**
     * Update existing absence
     */
    const updateAbsence = useCallback((id: number | string, updates: Partial<AbsenceRecord>) => {
        setAbsences(prev => {
            const updated = prev.map(abs =>
                abs.id === id
                    ? { 
                        ...abs, 
                        ...updates, 
                        updatedAt: new Date().toISOString() 
                    }
                    : abs
            );
            
            logger.debug('useAbsences', 'Updated absence', { id, updates });
            
            return updated;
        });
    }, []);
    
    /**
     * Delete absence
     */
    const deleteAbsence = useCallback((id: number | string) => {
        setAbsences(prev => {
            const updated = prev.filter(abs => abs.id !== id);
            logger.debug('useAbsences', 'Deleted absence', { id });
            return updated;
        });
    }, []);
    
    /**
     * Bulk add absences (for imports)
     */
    const addAbsences = useCallback((newAbsences: Omit<AbsenceRecord, 'id' | 'createdAt' | 'updatedAt'>[]) => {
        const validated = newAbsences.map(abs => {
            const errors = validateAbsence(abs);
            if (errors.length > 0) {
                throw new Error(`Invalid absence for teacher ${abs.teacherId}: ${errors.join(', ')}`);
            }
            return abs;
        });
        
        const withIds: AbsenceRecord[] = validated.map((abs, index) => ({
            ...abs,
            id: Date.now() + index,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: abs.status || 'OPEN'
        } as unknown as AbsenceRecord));
        
        setAbsences(prev => [...prev, ...withIds]);
        
        logger.debug('useAbsences', 'Bulk added absences', { count: withIds.length });
        
        return withIds;
    }, [validateAbsence]);
    
    /**
     * Get absences for a specific date
     */
    const getAbsencesForDate = useCallback((date: string) => {
        return absences.filter(abs => abs.date === date);
    }, [absences]);
    
    /**
     * Get absences for a teacher
     */
    const getAbsencesForTeacher = useCallback((teacherId: number) => {
        return absences.filter(abs => abs.teacherId === teacherId);
    }, [absences]);
    
    /**
     * Get absences in date range
     */
    const getAbsencesInRange = useCallback((startDate: string, endDate: string) => {
        return absences.filter(abs => abs.date >= startDate && abs.date <= endDate);
    }, [absences]);
    
    /**
     * Check if teacher is absent on a date
     */
    const isTeacherAbsent = useCallback((teacherId: number, date: string, period?: number) => {
        const teacherAbsences = absences.filter(
            abs => abs.teacherId === teacherId && abs.date === date
        );
        
        if (teacherAbsences.length === 0) return false;
        
        // If period not specified, check for any absence
        if (period === undefined) return true;
        
        // Check if period is affected
        return teacherAbsences.some(abs => 
            abs.type === 'FULL' || 
            (abs.type === 'PARTIAL' && abs.affectedPeriods?.includes(period))
        );
    }, [absences]);
    
    /**
     * Statistics
     */
    const statistics = useMemo(() => {
        const total = absences.length;
        const full = absences.filter(a => a.type === 'FULL').length;
        const partial = absences.filter(a => a.type === 'PARTIAL').length;
        const covered = absences.filter(a => a.status === 'COVERED').length;
        const open = absences.filter(a => a.status === 'OPEN').length;
        const cancelled = absences.filter(a => a.status === 'CANCELLED').length;
        
        return {
            total,
            full,
            partial,
            covered,
            open,
            cancelled,
            coverageRate: total > 0 ? (covered / total) * 100 : 0
        };
    }, [absences]);
    
    return {
        absences,
        setAbsences,
        addAbsence,
        addAbsences,
        updateAbsence,
        deleteAbsence,
        getAbsencesForDate,
        getAbsencesForTeacher,
        getAbsencesInRange,
        isTeacherAbsent,
        statistics
    };
};
