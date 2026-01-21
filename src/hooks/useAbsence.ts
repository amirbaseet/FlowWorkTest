import { useAbsences } from './useAbsences';
import { useCoverage } from './useCoverage';
import { AbsenceRecord, CoverageRequest, CoverageAssignment, DailyPool } from '@/types';

export function useAbsence() {
    const { absences, setAbsences } = useAbsences();
    const { coverageRequests, setCoverageRequests, setCoverageAssignments, setDailyPools } = useCoverage();

    const handleCreateAbsence = (
        absence: Omit<AbsenceRecord, 'id'>,
        newCoverageRequests: Omit<CoverageRequest, 'id'>[]
    ) => {
        const now = Date.now();

        // Create/update absence record
        const existingIndex = absences.findIndex(
            a => a.teacherId === absence.teacherId && a.date === absence.date
        );

        let absenceId: number;

        if (existingIndex >= 0) {
            // Update existing absence
            absenceId = absences[existingIndex].id;
            setAbsences(prev => prev.map((a, i) =>
                i === existingIndex
                    ? { ...a, ...absence, id: absenceId, updatedAt: new Date().toISOString() }
                    : a
            ));
        } else {
            // Add new absence
            absenceId = now;
            const newAbsence: AbsenceRecord = { ...absence, id: absenceId } as AbsenceRecord;
            setAbsences(prev => [...prev, newAbsence]);
        }

        // Remove existing coverage requests for this teacher+date
        const filteredRequests = coverageRequests.filter(
            r => !(r.absentTeacherId === absence.teacherId && r.date === absence.date)
        );

        // Create new coverage requests
        const createdRequests: CoverageRequest[] = newCoverageRequests.map((r, i) => ({
            ...r,
            id: `cr-${now}-${i}`,
            absenceId: absenceId,
        }));

        setCoverageRequests([...filteredRequests, ...createdRequests]);

        console.log(` Created absence for teacher ${absence.teacherId} with ${createdRequests.length} coverage requests`);
    };

    const handleAssignSubstitute = (coverageRequestId: string, substituteId: number) => {
        const now = new Date().toISOString();

        // Find the coverage request
        const request = coverageRequests.find(r => r.id === coverageRequestId);
        if (!request) {
            console.error('Coverage request not found:', coverageRequestId);
            return;
        }

        // Update the coverage request
        setCoverageRequests(prev => prev.map(r =>
            r.id === coverageRequestId
                ? { ...r, status: 'ASSIGNED' as const, assignedSubstituteId: substituteId, updatedAt: now }
                : r
        ));

        // Create an assignment record
        const newAssignment: CoverageAssignment = {
            id: `assign-${Date.now()}`,
            coverageRequestId,
            substituteId,
            date: request.date,
            periodId: request.periodId,
            absentTeacherId: request.absentTeacherId,
            absenceId: request.absenceId,
            classId: request.classId,
            assignedAt: now,
        };

        setCoverageAssignments(prev => [...prev, newAssignment]);

        // Add to daily pool
        setDailyPools(prev => {
            const existingPool = prev.find(p => p.date === request.date);

            const newEntry = {
                teacherId: substituteId,
                source: 'SUBSTITUTE_ASSIGNMENT' as const,
                periodId: request.periodId,
                assignmentId: newAssignment.id,
                timestamp: now,
            };

            if (existingPool) {
                // Check for duplicate
                const isDuplicate = existingPool.poolEntries.some(
                    e => e.teacherId === substituteId &&
                        e.periodId === request.periodId &&
                        e.assignmentId === newAssignment.id
                );

                if (!isDuplicate) {
                    return prev.map(p =>
                        p.date === request.date
                            ? { ...p, poolEntries: [...p.poolEntries, newEntry] }
                            : p
                    );
                }
                return prev;
            } else {
                // Create new daily pool
                return [...prev, { date: request.date, poolEntries: [newEntry] }];
            }
        });

        // Check if all coverage requests for this absence are now assigned
        const absenceRequests = coverageRequests.filter(r => r.absenceId === request.absenceId);
        // Note: We need to include the current one being assigned which is updated in state logic but variable 'request' is stale?
        // Actually we check if OTHER are assigned.
        // The current one IS assigned in this atomic operation logic.
        // But 'coverageRequests' variable here is from closure.
        // So we check:
        const allAssigned = absenceRequests.every(r =>
            r.id === coverageRequestId || r.status === 'ASSIGNED'
        );
        // If current is the last one pending, allAssigned will be true (since r.id === coverageRequestId passes).

        if (allAssigned) {
            // Update absence status to COVERED
            setAbsences(prev => prev.map(a =>
                a.id === request.absenceId
                    ? { ...a, status: 'COVERED' as const, updatedAt: now }
                    : a
            ));
        }

        console.log(` Assigned substitute ${substituteId} to coverage request ${coverageRequestId}`);
    };

    const handleCancelCoverageRequest = (coverageRequestId: string) => {
        setCoverageRequests(prev => prev.map(r =>
            r.id === coverageRequestId
                ? { ...r, status: 'CANCELLED' as const, updatedAt: new Date().toISOString() }
                : r
        ));
        console.log(`❌ Cancelled coverage request ${coverageRequestId}`);
    };

    return {
        handleCreateAbsence,
        handleAssignSubstitute,
        handleCancelCoverageRequest
    };
}
