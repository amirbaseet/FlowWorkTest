export type Permission =
    // Core & Dashboard
    | 'VIEW_DASHBOARD'
    | 'VIEW_ANALYTICS'

    // Schedule Management
    | 'VIEW_SCHEDULE'
    | 'EDIT_SCHEDULE'      // Full edit access
    | 'MANAGE_OWN_SCHEDULE' // Teacher specific

    // Substitution & Absence
    | 'VIEW_SUBSTITUTIONS'
    | 'MANAGE_SUBSTITUTIONS' // Create/Assign substitutions
    | 'APPROVE_REQUESTS'     // Approve coverage requests

    // User Management
    | 'VIEW_EMPLOYEES'
    | 'MANAGE_EMPLOYEES'   // Add/Edit employees
    | 'MANAGE_ROLES'

    // Settings & System
    | 'VIEW_SETTINGS'
    | 'MANAGE_SETTINGS'    // System-wide settings
    | 'CONFIGURE_MODES'    // Emergency/Ramadan modes

    // Reports
    | 'VIEW_REPORTS'
    | 'EXPORT_DATA'

    // Duty Management
    | 'VIEW_DUTY'
    | 'MANAGE_DUTY';

export const PERMISSIONS: Record<string, Permission> = {
    // Navigation
    DASHBOARD: 'VIEW_DASHBOARD',
    SCHEDULE: 'VIEW_SCHEDULE',
    SUBSTITUTIONS: 'VIEW_SUBSTITUTIONS',
    EMPLOYEES: 'VIEW_EMPLOYEES',
    REPORTS: 'VIEW_REPORTS',
    SETTINGS: 'VIEW_SETTINGS',
    DUTY: 'VIEW_DUTY',

    // Actions
    EDIT_SCHEDULE_FULL: 'EDIT_SCHEDULE',
    MANAGE_SUBS: 'MANAGE_SUBSTITUTIONS',
    MANAGE_USERS: 'MANAGE_EMPLOYEES',
    SYSTEM_CONFIG: 'MANAGE_SETTINGS',
};
