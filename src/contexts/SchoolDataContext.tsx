import React, { createContext } from 'react';
import { Employee, ClassItem, Role, ScheduleConfig } from '@/types';

export interface SchoolDataContextType {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    classes: ClassItem[];
    setClasses: React.Dispatch<React.SetStateAction<ClassItem[]>>;
    roles: Role[];
    setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    scheduleConfig: ScheduleConfig;
    setScheduleConfig: React.Dispatch<React.SetStateAction<ScheduleConfig>>;
}

export const SchoolDataContext = createContext<SchoolDataContextType | undefined>(undefined);
