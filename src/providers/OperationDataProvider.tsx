import React from 'react';
import { OperationDataContext } from '@/contexts/OperationDataContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { INITIAL_LESSONS, INITIAL_ABSENCES } from '@/constants';
import { Lesson, AbsenceRecord, SubstitutionLog, CoverageRequest, CoverageAssignment, DailyPool } from '@/types';

export const OperationDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    console.log("OperationDataProvider Mounting");
    // Phase 2: Operational Data Migration
    const [lessons, setLessons] = useLocalStorage<Lesson[]>('lessons', INITIAL_LESSONS, true);
    const [absences, setAbsences] = useLocalStorage<AbsenceRecord[]>('absences', INITIAL_ABSENCES, true);
    const [substitutionLogs, setSubstitutionLogs] = useLocalStorage<SubstitutionLog[]>('substitutionLogs', [], true);

    const [coverageRequests, setCoverageRequests] = useLocalStorage<CoverageRequest[]>('coverageRequests', [], true);
    const [coverageAssignments, setCoverageAssignments] = useLocalStorage<CoverageAssignment[]>('coverageAssignments', [], true);
    const [dailyPools, setDailyPools] = useLocalStorage<DailyPool[]>('dailyPools', [], true);

    const value = {
        lessons, setLessons,
        absences, setAbsences,
        substitutionLogs, setSubstitutionLogs,
        coverageRequests, setCoverageRequests,
        coverageAssignments, setCoverageAssignments,
        dailyPools, setDailyPools
    };

    return (
        <OperationDataContext.Provider value={value}>
            {children}
        </OperationDataContext.Provider>
    );
};
