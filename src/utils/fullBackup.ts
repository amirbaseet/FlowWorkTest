/**
 * Full System Backup & Export
 * 
 * نظام النسخ الاحتياطي الكامل للتطبيق
 */

import { 
  EngineContext, Employee, Lesson, ClassItem, ScheduleConfig, 
  AbsenceRecord, SubstitutionLog, Role, AcademicYear, DayPattern,
  CalendarHoliday, DayOverride, CalendarEvent, CalendarTask, EventComment
} from '@/types';

// ────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────

export interface FullBackup {
  metadata: {
    backupId: string;
    version: string;
    timestamp: number;
    dateCreated: string;
    appVersion: string;
    totalSize: number;
    checksums: Record<string, string>;
  };
  
  core: {
    employees: Employee[];
    classes: ClassItem[];
    lessons: Lesson[];
    scheduleConfig: ScheduleConfig;
    roles: Role[];
  };
  
  operations: {
    absences: AbsenceRecord[];
    substitutionLogs: SubstitutionLog[];
    engineContext: EngineContext;
  };
  
  calendar: {
    academicYear: AcademicYear;
    dayPatterns: DayPattern[];
    holidays: CalendarHoliday[];
    overrides: DayOverride[];
    events: CalendarEvent[];
    tasks: CalendarTask[];
    comments: EventComment[];
  };
  
  localStorage: {
    keys: string[];
    data: Record<string, any>;
  };
}

// ────────────────────────────────────────────────────────────────────
// CORE FUNCTIONS
// ────────────────────────────────────────────────────────────────────

/**
 * إنشاء نسخة احتياطية كاملة من النظام
 */
export const createFullBackup = (data: {
  employees: Employee[];
  classes: ClassItem[];
  lessons: Lesson[];
  scheduleConfig: ScheduleConfig;
  roles: Role[];
  absences: AbsenceRecord[];
  substitutionLogs: SubstitutionLog[];
  engineContext: EngineContext;
  academicYear: AcademicYear;
  dayPatterns: DayPattern[];
  holidays: CalendarHoliday[];
  overrides: DayOverride[];
  events: CalendarEvent[];
  tasks: CalendarTask[];
  comments: EventComment[];
}): FullBackup => {
  
  // Collect all localStorage data
  const localStorageData: Record<string, any> = {};
  const localStorageKeys: string[] = [];
  
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      localStorageKeys.push(key);
      try {
        localStorageData[key] = JSON.parse(localStorage[key]);
      } catch {
        localStorageData[key] = localStorage[key];
      }
    }
  }
  
  const backup: FullBackup = {
    metadata: {
      backupId: `BACKUP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      version: '2.0.0',
      timestamp: Date.now(),
      dateCreated: new Date().toISOString(),
      appVersion: 'ClassFlow AI v2.0',
      totalSize: 0,
      checksums: {}
    },
    
    core: {
      employees: data.employees,
      classes: data.classes,
      lessons: data.lessons,
      scheduleConfig: data.scheduleConfig,
      roles: data.roles
    },
    
    operations: {
      absences: data.absences,
      substitutionLogs: data.substitutionLogs,
      engineContext: data.engineContext
    },
    
    calendar: {
      academicYear: data.academicYear,
      dayPatterns: data.dayPatterns,
      holidays: data.holidays,
      overrides: data.overrides,
      events: data.events,
      tasks: data.tasks,
      comments: data.comments
    },
    
    localStorage: {
      keys: localStorageKeys,
      data: localStorageData
    }
  };
  
  // Calculate total size
  const backupStr = JSON.stringify(backup);
  backup.metadata.totalSize = backupStr.length;
  
  // Calculate checksums for each section
  backup.metadata.checksums = {
    core: simpleHash(JSON.stringify(backup.core)),
    operations: simpleHash(JSON.stringify(backup.operations)),
    calendar: simpleHash(JSON.stringify(backup.calendar)),
    localStorage: simpleHash(JSON.stringify(backup.localStorage))
  };
  
  return backup;
};

/**
 * تصدير النسخة الاحتياطية كملف JSON
 */
export const exportFullBackup = (backup: FullBackup, filename?: string): void => {
  const defaultFilename = `ClassFlow_Backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
  const finalFilename = filename || defaultFilename;
  
  const dataStr = JSON.stringify(backup, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * استيراد نسخة احتياطية من ملف JSON
 */
export const importFullBackup = (file: File): Promise<{
  success: boolean;
  backup?: FullBackup;
  error?: string;
}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content) as FullBackup;
        
        // Validate structure
        if (!backup.metadata || !backup.core || !backup.operations || !backup.calendar) {
          resolve({
            success: false,
            error: 'صيغة ملف النسخة الاحتياطية غير صحيحة'
          });
          return;
        }
        
        // Validate version compatibility
        if (backup.metadata.version !== '2.0.0') {
          resolve({
            success: false,
            error: `إصدار غير متوافق (${backup.metadata.version}). الإصدار المطلوب: 2.0.0`
          });
          return;
        }
        
        // Verify checksums
        const coreChecksum = simpleHash(JSON.stringify(backup.core));
        if (coreChecksum !== backup.metadata.checksums.core) {
          console.warn('⚠️ Core data checksum mismatch');
        }
        
        resolve({
          success: true,
          backup
        });
      } catch (error: any) {
        resolve({
          success: false,
          error: error.message || 'فشل قراءة ملف النسخة الاحتياطية'
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        success: false,
        error: 'فشل قراءة الملف'
      });
    };
    
    reader.readAsText(file);
  });
};

/**
 * استعادة النظام من نسخة احتياطية كاملة
 */
export const restoreFromFullBackup = (
  backup: FullBackup,
  options: {
    restoreCore?: boolean;
    restoreOperations?: boolean;
    restoreCalendar?: boolean;
    restoreLocalStorage?: boolean;
  } = {
    restoreCore: true,
    restoreOperations: true,
    restoreCalendar: true,
    restoreLocalStorage: true
  }
): {
  success: boolean;
  restoredData?: any;
  error?: string;
} => {
  try {
    const restored: any = {};
    
    // Restore core data
    if (options.restoreCore) {
      restored.employees = backup.core.employees;
      restored.classes = backup.core.classes;
      restored.lessons = backup.core.lessons;
      restored.scheduleConfig = backup.core.scheduleConfig;
      restored.roles = backup.core.roles;
    }
    
    // Restore operations data
    if (options.restoreOperations) {
      restored.absences = backup.operations.absences;
      restored.substitutionLogs = backup.operations.substitutionLogs;
      restored.engineContext = backup.operations.engineContext;
    }
    
    // Restore calendar data
    if (options.restoreCalendar) {
      restored.academicYear = backup.calendar.academicYear;
      restored.dayPatterns = backup.calendar.dayPatterns;
      restored.holidays = backup.calendar.holidays;
      restored.overrides = backup.calendar.overrides;
      restored.events = backup.calendar.events;
      restored.tasks = backup.calendar.tasks;
      restored.comments = backup.calendar.comments;
    }
    
    // Restore localStorage (optional, can be dangerous)
    if (options.restoreLocalStorage && backup.localStorage) {
      for (const key of backup.localStorage.keys) {
        const value = backup.localStorage.data[key];
        try {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (error) {
          console.warn(`Failed to restore localStorage key: ${key}`, error);
        }
      }
    }
    
    return {
      success: true,
      restoredData: restored
    };
  } catch (error: any) {
    console.error('Restore failed:', error);
    return {
      success: false,
      error: error.message || 'فشل استعادة النسخة الاحتياطية'
    };
  }
};

/**
 * تحليل النسخة الاحتياطية (معاينة بدون تطبيق)
 */
export const analyzeBackup = (backup: FullBackup): {
  summary: {
    totalEmployees: number;
    totalClasses: number;
    totalLessons: number;
    totalAbsences: number;
    totalSubstitutions: number;
    totalEvents: number;
    activeModes: number;
  };
  sizeBreakdown: {
    core: number;
    operations: number;
    calendar: number;
    localStorage: number;
    total: number;
  };
  health: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
} => {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Validate checksums
  if (backup.metadata.checksums) {
    const coreChecksum = simpleHash(JSON.stringify(backup.core));
    if (coreChecksum !== backup.metadata.checksums.core) {
      warnings.push('Core data checksum mismatch - data may be corrupted');
    }
  }
  
  // Check for empty data
  if (backup.core.employees.length === 0) {
    warnings.push('No employees found in backup');
  }
  
  if (backup.core.lessons.length === 0) {
    warnings.push('No lessons found in backup');
  }
  
  // Calculate sizes
  const coreSize = JSON.stringify(backup.core).length;
  const operationsSize = JSON.stringify(backup.operations).length;
  const calendarSize = JSON.stringify(backup.calendar).length;
  const localStorageSize = JSON.stringify(backup.localStorage).length;
  
  return {
    summary: {
      totalEmployees: backup.core.employees.length,
      totalClasses: backup.core.classes.length,
      totalLessons: backup.core.lessons.length,
      totalAbsences: backup.operations.absences.length,
      totalSubstitutions: backup.operations.substitutionLogs.length,
      totalEvents: backup.calendar.events.length,
      activeModes: Object.values(backup.operations.engineContext).filter((m: any) => m.isActive).length
    },
    sizeBreakdown: {
      core: coreSize,
      operations: operationsSize,
      calendar: calendarSize,
      localStorage: localStorageSize,
      total: coreSize + operationsSize + calendarSize + localStorageSize
    },
    health: {
      isValid: errors.length === 0,
      warnings,
      errors
    }
  };
};

/**
 * مقارنة نسختين احتياطيتين
 */
export const compareBackups = (
  backup1: FullBackup,
  backup2: FullBackup
): {
  differences: {
    employees: { added: number; removed: number; modified: number };
    classes: { added: number; removed: number; modified: number };
    lessons: { added: number; removed: number; modified: number };
    absences: { added: number; removed: number; modified: number };
  };
  summary: string;
} => {
  const diff = {
    employees: compareLists(backup1.core.employees, backup2.core.employees),
    classes: compareLists(backup1.core.classes, backup2.core.classes),
    lessons: compareLists(backup1.core.lessons, backup2.core.lessons),
    absences: compareLists(backup1.operations.absences, backup2.operations.absences)
  };
  
  const totalChanges = 
    diff.employees.added + diff.employees.removed + diff.employees.modified +
    diff.classes.added + diff.classes.removed + diff.classes.modified +
    diff.lessons.added + diff.lessons.removed + diff.lessons.modified +
    diff.absences.added + diff.absences.removed + diff.absences.modified;
  
  const summary = totalChanges === 0 
    ? 'النسختان متطابقتان تماماً'
    : `${totalChanges} تغيير تم رصده`;
  
  return { differences: diff, summary };
};

// ────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ────────────────────────────────────────────────────────────────────

/**
 * Simple hash function for checksum
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Compare two lists and count differences
 */
function compareLists(list1: any[], list2: any[]): {
  added: number;
  removed: number;
  modified: number;
} {
  const ids1 = new Set(list1.map(item => item.id));
  const ids2 = new Set(list2.map(item => item.id));
  
  const added = list2.filter(item => !ids1.has(item.id)).length;
  const removed = list1.filter(item => !ids2.has(item.id)).length;
  
  // Count modified (simplified: items with same ID but different JSON)
  const commonIds = list1.filter(item => ids2.has(item.id)).map(item => item.id);
  let modified = 0;
  
  for (const id of commonIds) {
    const item1 = list1.find(item => item.id === id);
    const item2 = list2.find(item => item.id === id);
    
    if (JSON.stringify(item1) !== JSON.stringify(item2)) {
      modified++;
    }
  }
  
  return { added, removed, modified };
}

/**
 * Format size for display
 */
export const formatBackupSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
