import { useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSchoolData } from '@/hooks/useSchoolData';
import {
    INITIAL_EMPLOYEES, INITIAL_CLASSES, INITIAL_LESSONS, INITIAL_SCHEDULE_CONFIG,
    INITIAL_ROLES, INITIAL_ABSENCES, INITIAL_ENGINE_CONTEXT, INITIAL_ACADEMIC_YEAR,
    INITIAL_DAY_PATTERNS, DEFAULT_DASHBOARD_LAYOUT
} from '@/constants';
import {
    Employee, ClassItem, Lesson, ScheduleConfig, Role, AbsenceRecord,
    EngineContext, SubstitutionLog, AcademicYear, DayPattern, CalendarHoliday,
    DayOverride, CalendarEvent, CalendarTask, EventComment, DashboardLayout,
    CoverageRequest, CoverageAssignment, DailyPool
} from '@/types';

export function useAppData() {
    // Phase 1 Context Migration: Core data from Context
    const {
        employees, setEmployees,
        classes, setClasses,
        roles, setRoles,
        scheduleConfig, setScheduleConfig
    } = useSchoolData();

    // Duty Management State
    const [dutyAssignments, setDutyAssignments] = useLocalStorage<any[]>('dutyAssignments', []);
    const [facilities, setFacilities] = useLocalStorage<any[]>('dutyFacilities', []);
    const [breakPeriods, setBreakPeriods] = useLocalStorage<any[]>('dutyBreakPeriods', []);
    const [dutyNotifications, setDutyNotifications] = useLocalStorage<any[]>('dutyNotifications', []);
    const [dutySwapRequests, setDutySwapRequests] = useLocalStorage<any[]>('dutySwapRequests', []);

    // Other State (engine, dashboard, calendar) - Restored
    const [engineContext, setEngineContext] = useLocalStorage<EngineContext>('engineContext', INITIAL_ENGINE_CONTEXT);
    const [dashboardConfig, setDashboardConfig] = useLocalStorage<DashboardLayout>('dashboardConfig', DEFAULT_DASHBOARD_LAYOUT);

    // Calendar & Scheduler Config
    const [academicYear] = useLocalStorage<AcademicYear>('academicYear', INITIAL_ACADEMIC_YEAR);
    const [dayPatterns] = useLocalStorage<DayPattern[]>('dayPatterns', INITIAL_DAY_PATTERNS);

    const [holidays, setHolidays] = useLocalStorage<CalendarHoliday[]>('holidays', []);
    const [overrides, setOverrides] = useLocalStorage<DayOverride[]>('overrides', []);
    const [events, setEvents] = useLocalStorage<CalendarEvent[]>('events', []);
    const [tasks, setTasks] = useLocalStorage<CalendarTask[]>('tasks', []);
    const [comments, setComments] = useLocalStorage<EventComment[]>('comments', []);

    // Force reload listeners - Simplified for remaining state
    useEffect(() => {
        // ... listeners for remaining state if any
    }, []);

    return {
        employees, setEmployees,
        classes, setClasses,
        scheduleConfig, setScheduleConfig,
        roles, setRoles,
        engineContext, setEngineContext,
        dashboardConfig, setDashboardConfig,
        academicYear,
        dayPatterns,
        holidays, setHolidays,
        overrides, setOverrides,
        events, setEvents,
        tasks, setTasks,
        comments, setComments,
        dutyAssignments, setDutyAssignments,
        facilities, setFacilities,
        breakPeriods, setBreakPeriods,
        dutyNotifications, setDutyNotifications,
        dutySwapRequests, setDutySwapRequests,
    };
}
