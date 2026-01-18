/**
 * Rollback System - نظام التراجع والاستعادة
 * 
 * يوفر نقاط تراجع آمنة لحماية البيانات الحساسة
 * Version: 1.0.0
 * Created: 2026-01-10
 */

import { EngineContext, Employee, Lesson, ClassItem, ScheduleConfig, AbsenceRecord, SubstitutionLog } from '@/types';

// ────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────

export interface RollbackPoint {
  id: string;
  timestamp: number;
  dateCreated: string;
  label: string;
  description?: string;
  snapshot: {
    engineContext: EngineContext;
    employees: Employee[];
    lessons: Lesson[];
    classes: ClassItem[];
    scheduleConfig: ScheduleConfig;
    absences: AbsenceRecord[];
    substitutionLogs: SubstitutionLog[];
  };
  metadata: {
    createdBy: string;
    version: string;
    totalSize: number;
  };
}

export interface RollbackManager {
  points: RollbackPoint[];
  maxPoints: number;
  autoSaveInterval: number; // in minutes
}

// ────────────────────────────────────────────────────────────────────
// STORAGE KEYS
// ────────────────────────────────────────────────────────────────────

const ROLLBACK_STORAGE_KEY = 'classflow_rollback_points';
const ROLLBACK_CONFIG_KEY = 'classflow_rollback_config';

// ────────────────────────────────────────────────────────────────────
// CORE FUNCTIONS
// ────────────────────────────────────────────────────────────────────

/**
 * إنشاء نقطة تراجع جديدة
 */
export const createRollbackPoint = (
  label: string,
  snapshot: RollbackPoint['snapshot'],
  createdBy: string = 'System',
  description?: string
): RollbackPoint => {
  const point: RollbackPoint = {
    id: `RP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    dateCreated: new Date().toISOString(),
    label,
    description,
    snapshot,
    metadata: {
      createdBy,
      version: '2.0.0',
      totalSize: JSON.stringify(snapshot).length
    }
  };

  return point;
};

/**
 * حفظ نقطة التراجع في LocalStorage
 */
export const saveRollbackPoint = (point: RollbackPoint): { success: boolean; error?: string } => {
  try {
    // Get existing points
    const existing = getRollbackPoints();
    
    // Add new point at the beginning
    const updated = [point, ...existing];
    
    // Get max points limit (default: 10)
    const config = getRollbackConfig();
    const maxPoints = config.maxPoints || 10;
    
    // Keep only the latest N points
    const trimmed = updated.slice(0, maxPoints);
    
    // Save to storage
    localStorage.setItem(ROLLBACK_STORAGE_KEY, JSON.stringify(trimmed));
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save rollback point:', error);
    return { 
      success: false, 
      error: error.message || 'فشل حفظ نقطة التراجع' 
    };
  }
};

/**
 * استرجاع جميع نقاط التراجع
 */
export const getRollbackPoints = (): RollbackPoint[] => {
  try {
    const stored = localStorage.getItem(ROLLBACK_STORAGE_KEY);
    if (!stored) return [];
    
    const points = JSON.parse(stored) as RollbackPoint[];
    
    // Sort by timestamp (newest first)
    return points.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to get rollback points:', error);
    return [];
  }
};

/**
 * استعادة من نقطة تراجع
 */
export const restoreFromRollbackPoint = (pointId: string): {
  success: boolean;
  snapshot?: RollbackPoint['snapshot'];
  error?: string;
} => {
  try {
    const points = getRollbackPoints();
    const point = points.find(p => p.id === pointId);
    
    if (!point) {
      return { 
        success: false, 
        error: 'نقطة التراجع غير موجودة' 
      };
    }
    
    // Return the snapshot for restoration
    return {
      success: true,
      snapshot: point.snapshot
    };
  } catch (error: any) {
    console.error('Failed to restore rollback point:', error);
    return {
      success: false,
      error: error.message || 'فشل استعادة نقطة التراجع'
    };
  }
};

/**
 * حذف نقطة تراجع
 */
export const deleteRollbackPoint = (pointId: string): { success: boolean; error?: string } => {
  try {
    const points = getRollbackPoints();
    const filtered = points.filter(p => p.id !== pointId);
    
    localStorage.setItem(ROLLBACK_STORAGE_KEY, JSON.stringify(filtered));
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete rollback point:', error);
    return {
      success: false,
      error: error.message || 'فشل حذف نقطة التراجع'
    };
  }
};

/**
 * حذف جميع نقاط التراجع
 */
export const clearAllRollbackPoints = (): { success: boolean; error?: string } => {
  try {
    localStorage.removeItem(ROLLBACK_STORAGE_KEY);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to clear rollback points:', error);
    return {
      success: false,
      error: error.message || 'فشل مسح نقاط التراجع'
    };
  }
};

/**
 * الحصول على إعدادات نظام التراجع
 */
export const getRollbackConfig = (): RollbackManager => {
  try {
    const stored = localStorage.getItem(ROLLBACK_CONFIG_KEY);
    if (!stored) {
      // Default config
      return {
        points: [],
        maxPoints: 10,
        autoSaveInterval: 30 // 30 minutes
      };
    }
    
    return JSON.parse(stored) as RollbackManager;
  } catch (error) {
    console.error('Failed to get rollback config:', error);
    return {
      points: [],
      maxPoints: 10,
      autoSaveInterval: 30
    };
  }
};

/**
 * تحديث إعدادات نظام التراجع
 */
export const updateRollbackConfig = (config: Partial<RollbackManager>): { success: boolean; error?: string } => {
  try {
    const current = getRollbackConfig();
    const updated = { ...current, ...config };
    
    localStorage.setItem(ROLLBACK_CONFIG_KEY, JSON.stringify(updated));
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update rollback config:', error);
    return {
      success: false,
      error: error.message || 'فشل تحديث إعدادات التراجع'
    };
  }
};

/**
 * تصدير نقطة تراجع كملف JSON
 */
export const exportRollbackPoint = (pointId: string): void => {
  const points = getRollbackPoints();
  const point = points.find(p => p.id === pointId);
  
  if (!point) {
    throw new Error('نقطة التراجع غير موجودة');
  }
  
  const dataStr = JSON.stringify(point, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `rollback_${point.label.replace(/\s+/g, '_')}_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * استيراد نقطة تراجع من ملف JSON
 */
export const importRollbackPoint = (file: File): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const point = JSON.parse(content) as RollbackPoint;
        
        // Validate structure
        if (!point.snapshot || !point.id || !point.timestamp) {
          resolve({
            success: false,
            error: 'صيغة ملف غير صحيحة'
          });
          return;
        }
        
        // Save the imported point
        const result = saveRollbackPoint(point);
        resolve(result);
      } catch (error: any) {
        resolve({
          success: false,
          error: error.message || 'فشل قراءة الملف'
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
 * الحصول على حجم التخزين المستخدم
 */
export const getStorageUsage = (): {
  used: number;
  usedMB: number;
  percentage: number;
} => {
  try {
    let totalSize = 0;
    
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    
    const usedMB = totalSize / (1024 * 1024);
    const quota = 10; // Approximate 10MB limit for localStorage
    const percentage = (usedMB / quota) * 100;
    
    return {
      used: totalSize,
      usedMB: parseFloat(usedMB.toFixed(2)),
      percentage: parseFloat(percentage.toFixed(2))
    };
  } catch (error) {
    console.error('Failed to calculate storage usage:', error);
    return {
      used: 0,
      usedMB: 0,
      percentage: 0
    };
  }
};

/**
 * دالة مساعدة: تنسيق الحجم بشكل قابل للقراءة
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * دالة مساعدة: تنسيق التاريخ بشكل قابل للقراءة
 */
export const formatRollbackDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ────────────────────────────────────────────────────────────────────
// AUTO-SAVE FUNCTIONALITY
// ────────────────────────────────────────────────────────────────────

let autoSaveInterval: number | null = null;

/**
 * تفعيل الحفظ التلقائي
 */
export const enableAutoSave = (
  getSnapshotFn: () => RollbackPoint['snapshot'],
  intervalMinutes: number = 30
): void => {
  // Clear existing interval
  if (autoSaveInterval) {
    window.clearInterval(autoSaveInterval);
  }
  
  // Set new interval
  autoSaveInterval = window.setInterval(() => {
    try {
      const snapshot = getSnapshotFn();
      const point = createRollbackPoint(
        `حفظ تلقائي`,
        snapshot,
        'AutoSave',
        `تم الحفظ تلقائياً في ${new Date().toLocaleTimeString('ar-SA')}`
      );
      
      saveRollbackPoint(point);
      console.log('✅ Auto-save successful:', point.id);
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
    }
  }, intervalMinutes * 60 * 1000);
  
  console.log(`🔄 Auto-save enabled (every ${intervalMinutes} minutes)`);
};

/**
 * تعطيل الحفظ التلقائي
 */
export const disableAutoSave = (): void => {
  if (autoSaveInterval) {
    window.clearInterval(autoSaveInterval);
    autoSaveInterval = null;
    console.log('🛑 Auto-save disabled');
  }
};
