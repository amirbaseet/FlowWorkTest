import React, { createContext } from 'react';
import { Lesson, AbsenceRecord, SubstitutionLog, CoverageRequest, CoverageAssignment, DailyPool } from '@/types';

export interface OperationDataContextType {
    lessons: Lesson[];
    setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
    absences: AbsenceRecord[];
    setAbsences: React.Dispatch<React.SetStateAction<AbsenceRecord[]>>;
    substitutionLogs: SubstitutionLog[];
    setSubstitutionLogs: React.Dispatch<React.SetStateAction<SubstitutionLog[]>>;
    coverageRequests: CoverageRequest[];
    setCoverageRequests: React.Dispatch<React.SetStateAction<CoverageRequest[]>>;
    coverageAssignments: CoverageAssignment[];
    setCoverageAssignments: React.Dispatch<React.SetStateAction<CoverageAssignment[]>>;
    dailyPools: DailyPool[];
    setDailyPools: React.Dispatch<React.SetStateAction<DailyPool[]>>;
}

export const OperationDataContext = createContext<OperationDataContextType | undefined>(undefined);
