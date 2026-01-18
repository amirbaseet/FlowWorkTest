
import { Employee, ClassItem, Role } from '@/types';
import { GRADES_AR, COORDINATOR_TYPES } from '@/constants';
import { detectGradeFromTitle } from '@/utils';

export interface OperationalScope {
    visibleClasses: ClassItem[];
    visibleEmployees: Employee[];
    isRestricted: boolean;
    restrictionType?: 'grade' | 'subject' | 'none';
    restrictionValue?: string;
}

export const getOperationalScope = (
    currentUser: Employee | null,
    allClasses: ClassItem[],
    allEmployees: Employee[]
): OperationalScope => {
    // 1. Default: Full Access (No User or Admin)
    if (!currentUser) {
        return { visibleClasses: allClasses, visibleEmployees: allEmployees, isRestricted: false };
    }

    const { baseRoleId, addons } = currentUser;

    // 2. Super Users (Principal, Vice Principal, Admin)
    if (['principal', 'vice_principal', 'sys_admin'].includes(baseRoleId)) {
        return { visibleClasses: allClasses, visibleEmployees: allEmployees, isRestricted: false };
    }

    // 3. Coordinator Logic (Advanced & Legacy Support)
    const coordinatorRoles = addons?.coordinatorRoles || [];
    const legacyCoordinators = addons?.coordinators || [];

    // Check if we have any roles (New or Legacy)
    if (coordinatorRoles.length > 0 || legacyCoordinators.length > 0) {
        // We will collect allowed IDs from ALL roles (Union of permissions)
        const allowedClassIds = new Set<string>();
        const allowedEmployeeIds = new Set<number>();
        let hasGlobalAccess = false;
        let hasClassRestriction = false;
        let hasEmployeeRestriction = false;

        // Helper to process a single role definition
        const processRole = (typeId: string, scopeValue: string, audience: string) => {
            const def = COORDINATOR_TYPES.find(d => d.id === typeId);
            if (!def) return;

            // GLOBAL
            if (def.scopeType === 'global') { hasGlobalAccess = true; return; }

            // GRADE
            if (def.scopeType === 'grade') {
                if (GRADES_AR.includes(scopeValue)) {
                    const gradeIndex = GRADES_AR.indexOf(scopeValue);
                    const targetGradeLevel = gradeIndex + 1;
                    const classesInGrade = allClasses.filter(c => detectGradeFromTitle(c.name) === targetGradeLevel);
                    classesInGrade.forEach(c => allowedClassIds.add(c.id));
                    hasClassRestriction = true;

                    // Base: Educators of this grade
                    const educators = allEmployees.filter(e => e.addons.educator && classesInGrade.some(c => c.id === e.addons.educatorClassId));
                    educators.forEach(e => allowedEmployeeIds.add(e.id));
                    hasEmployeeRestriction = true;
                }
            }

            // SUBJECT
            if (def.scopeType === 'subject') {
                if (scopeValue) {
                    // Teachers of this subject
                    const subjectTeachers = allEmployees.filter(e => e.subjects.some(s => s.trim() === scopeValue.trim() || s.includes(scopeValue)));
                    subjectTeachers.forEach(e => allowedEmployeeIds.add(e.id));
                    hasEmployeeRestriction = true;

                    // Subject Coordinators typically need access to ALL classes to schedule exams/events
                    // So we do NOT restrict classes for subject roles usually.
                }
            }
        };

        // Process NEW Roles
        coordinatorRoles.forEach(r => processRole(r.typeId, r.scopeValue, r.targetAudience));

        // Process LEGACY Roles (Fallback)
        if (coordinatorRoles.length === 0) {
            legacyCoordinators.forEach(roleStr => {
                const def = COORDINATOR_TYPES.find(d => roleStr.startsWith(d.label));
                if (def) {
                    let scope = '';
                    if (def.scopeType === 'grade' || def.scopeType === 'subject') scope = roleStr.split(':')[1]?.trim() || '';
                    processRole(def.id, scope, 'teachers'); // Default audience
                }
            });
        }

        // Return Final Scope
        if (hasGlobalAccess) return { visibleClasses: allClasses, visibleEmployees: allEmployees, isRestricted: false };

        // Logic: 
        // If hasClassRestriction is TRUE, we filter classes. If FALSE (e.g. only Subject role), we show ALL classes.
        // If hasEmployeeRestriction is TRUE, we filter employees.

        const finalVisibleClasses = hasClassRestriction
            ? allClasses.filter(c => allowedClassIds.has(c.id))
            : allClasses;

        const finalVisibleEmployees = hasEmployeeRestriction
            ? allEmployees.filter(e => e.id === currentUser.id || allowedEmployeeIds.has(e.id))
            : allEmployees;

        const isRestricted = hasClassRestriction || hasEmployeeRestriction;

        return {
            visibleClasses: finalVisibleClasses,
            visibleEmployees: finalVisibleEmployees,
            isRestricted,
            restrictionType: hasClassRestriction ? 'grade' : 'subject',
            restrictionValue: 'Mixed Scope'
        };
    }

    // 4. Regular Teacher (Unrestricted for now as per legacy requirements)
    return { visibleClasses: allClasses, visibleEmployees: allEmployees, isRestricted: false };
};
