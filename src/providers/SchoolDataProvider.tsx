import React, { useEffect } from 'react';
import { SchoolDataContext } from '@/contexts/SchoolDataContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
    INITIAL_EMPLOYEES, INITIAL_CLASSES, INITIAL_SCHEDULE_CONFIG, INITIAL_ROLES
} from '@/constants';
import { Employee, ClassItem, Role, ScheduleConfig } from '@/types';

export const SchoolDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Core Data State
    const [employees, setEmployees] = useLocalStorage<Employee[]>('employees', INITIAL_EMPLOYEES, true);
    const [classes, setClasses] = useLocalStorage<ClassItem[]>('classes', INITIAL_CLASSES, true);
    const [roles, setRoles] = useLocalStorage<Role[]>('roles', INITIAL_ROLES, true);
    const [scheduleConfig, setScheduleConfig] = useLocalStorage<ScheduleConfig>('scheduleConfig', INITIAL_SCHEDULE_CONFIG, true);

    // Auto-fix roles (Ensure 'assistant' role exists)
    useEffect(() => {
        const hasAssistant = roles.some(r => r.id === 'assistant');
        if (!hasAssistant) {
            const assistantRole = INITIAL_ROLES.find(r => r.id === 'assistant');
            if (assistantRole) {
                setRoles(prev => [...prev, assistantRole]);
            }
        }
    }, [roles, setRoles]);

    const value = {
        employees, setEmployees,
        classes, setClasses,
        roles, setRoles,
        scheduleConfig, setScheduleConfig
    };

    return (
        <SchoolDataContext.Provider value={value}>
            {children}
        </SchoolDataContext.Provider>
    );
};
