import { useContext } from 'react';
import { OperationDataContext } from '@/contexts/OperationDataContext';

export function useCoverage() {
    const context = useContext(OperationDataContext);
    if (!context) {
        throw new Error('useCoverage must be used within an OperationDataProvider');
    }
    const {
        coverageRequests, setCoverageRequests,
        coverageAssignments, setCoverageAssignments,
        dailyPools, setDailyPools
    } = context;

    return {
        coverageRequests, setCoverageRequests,
        coverageAssignments, setCoverageAssignments,
        dailyPools, setDailyPools
    };
}
