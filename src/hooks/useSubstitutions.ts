// src/hooks/useSubstitutions.ts

import { useState, useCallback, useMemo, useEffect } from 'react';
import { SubstitutionLog } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Enhanced hook for managing substitution logs
 * Includes persistence, helper functions, and statistics
 */
export const useSubstitutions = () => {
    // Load from localStorage on mount
    const [substitutionLogs, setSubstitutionLogs] = useState<SubstitutionLog[]>(() => {
        try {
            const stored = localStorage.getItem('classflow_substitutions');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            logger.error('Failed to load substitutions from localStorage', error);
            return [];
        }
    });
    
    // Persist to localStorage on changes
    useEffect(() => {
        try {
            localStorage.setItem('classflow_substitutions', JSON.stringify(substitutionLogs));
        } catch (error) {
            logger.error('Failed to save substitutions to localStorage', error);
        }
    }, [substitutionLogs]);
    
    /**
     * Add new substitution
     */
    const addSubstitution = useCallback((sub: Omit<SubstitutionLog, 'id' | 'timestamp'>) => {
        const newLog: SubstitutionLog = {
            ...sub,
            id: `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        };
        
        setSubstitutionLogs(prev => [...prev, newLog]);
        
        logger.debug('useSubstitutions', 'Added new substitution', {
            id: newLog.id,
            absentTeacherId: newLog.absentTeacherId,
            substituteId: newLog.substituteId,
            date: newLog.date,
            period: newLog.period
        });
        
        return newLog;
    }, []);
    
    /**
     * Update existing substitution
     */
    const updateSubstitution = useCallback((id: string, updates: Partial<SubstitutionLog>) => {
        setSubstitutionLogs(prev => {
            const updated = prev.map(log =>
                log.id === id
                    ? { ...log, ...updates, timestamp: Date.now() }
                    : log
            );
            
            logger.debug('useSubstitutions', 'Updated substitution', { id, updates });
            
            return updated;
        });
    }, []);
    
    /**
     * Delete substitution
     */
    const deleteSubstitution = useCallback((id: string) => {
        setSubstitutionLogs(prev => {
            const updated = prev.filter(log => log.id !== id);
            logger.debug('useSubstitutions', 'Deleted substitution', { id });
            return updated;
        });
    }, []);
    
    /**
     * Get substitutions for a specific date
     */
    const getSubstitutionsForDate = useCallback((date: string) => {
        return substitutionLogs.filter(log => log.date === date);
    }, [substitutionLogs]);
    
    /**
     * Get substitutions for a teacher (either as absent or substitute)
     */
    const getSubstitutionsForTeacher = useCallback((teacherId: number, role: 'absent' | 'substitute' = 'substitute') => {
        return substitutionLogs.filter(log => 
            role === 'absent' ? log.absentTeacherId === teacherId : log.substituteId === teacherId
        );
    }, [substitutionLogs]);
    
    /**
     * Get substitutions for a class
     */
    const getSubstitutionsForClass = useCallback((classId: string, date?: string) => {
        return substitutionLogs.filter(log => 
            log.classId === classId && (date ? log.date === date : true)
        );
    }, [substitutionLogs]);
    
    /**
     * Check if a slot is already covered
     */
    const isSlotCovered = useCallback((date: string, period: number, classId: string) => {
        return substitutionLogs.some(log => 
            log.date === date && log.period === period && log.classId === classId
        );
    }, [substitutionLogs]);
    
    /**
     * Statistics
     */
    const statistics = useMemo(() => {
        const total = substitutionLogs.length;
        
        // Count by type
        const byType = substitutionLogs.reduce((acc, log) => {
            acc[log.type] = (acc[log.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        // Most active substitutes
        const substituteCounts = substitutionLogs.reduce((acc, log) => {
            acc[log.substituteId] = (acc[log.substituteId] || 0) + 1;
            return acc;
        }, {} as Record<number, number>);
        
        return {
            total,
            byType,
            substituteCounts
        };
    }, [substitutionLogs]);
    
    return {
        substitutionLogs,
        setSubstitutionLogs,
        addSubstitution,
        updateSubstitution,
        deleteSubstitution,
        getSubstitutionsForDate,
        getSubstitutionsForTeacher,
        getSubstitutionsForClass,
        isSlotCovered,
        statistics
    };
};
