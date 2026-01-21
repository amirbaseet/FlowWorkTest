import React, { useState, useEffect } from 'react';
import { Shield, Download, Upload, Trash2, Clock, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import {
  getAllRollbackPoints,
  createRollbackPoint,
  saveRollbackPoint,
  deleteRollbackPoint,
  clearAllRollbackPoints,
  restoreFromRollbackPoint,
  exportRollbackPoint,
  importRollbackPoint,
  getStorageUsage,
  compareRollbackPoints,
  cleanupOldRollbackPoints,
  enableAutoSave,
  disableAutoSave,
  RollbackPoint
} from '@/utils/rollbackSystem';
import { EngineContext, Employee, Lesson, ClassItem, ScheduleConfig, AbsenceRecord, SubstitutionLog, User } from '@/types';

interface RollbackManagerProps {
  currentUser: User | null;
  engineContext: EngineContext;
  employees: Employee[];
  lessons: Lesson[];
  classes: ClassItem[];
  scheduleConfig: ScheduleConfig;
  absences: AbsenceRecord[];
  substitutionLogs: SubstitutionLog[];
  onRestore: (snapshot: RollbackPoint['snapshot']) => void;
  onClose: () => void;
}

const RollbackManager: React.FC<RollbackManagerProps> = ({
  currentUser,
  engineContext,
  employees,
  lessons,
  classes,
  scheduleConfig,
  absences,
  substitutionLogs,
  onRestore,
  onClose
}) => {
  const [points, setPoints] = useState<RollbackPoint[]>([]);
  const [storageUsage, setStorageUsage] = useState(getStorageUsage());
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPointLabel, setNewPointLabel] = useState('');
  const [newPointDescription, setNewPointDescription] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState<string | null>(null);
  const [showConfirmClearAll, setShowConfirmClearAll] = useState(false);

  useEffect(() => {
    loadPoints();
  }, []);

  const loadPoints = () => {
    const allPoints = getAllRollbackPoints();
    setPoints(allPoints);
    setStorageUsage(getStorageUsage());
  };

  const handleCreatePoint = () => {
    if (!newPointLabel.trim()) {
      alert('الرجاء إدخال اسم لنقطة التراجع');
      return;
    }

    const snapshot = {
      engineContext,
      employees,
      lessons,
      classes,
      scheduleConfig,
      absences,
      substitutionLogs
    };

    const point = createRollbackPoint(
      newPointLabel,
      snapshot,
      currentUser?.name || 'مستخدم',
      newPointDescription || undefined
    );

    const saved = saveRollbackPoint(point);
    
    if (saved) {
      setNewPointLabel('');
      setNewPointDescription('');
      setShowCreateForm(false);
      loadPoints();
    }
  };

  const handleRestore = (pointId: string) => {
    const result = restoreFromRollbackPoint(pointId);
    
    if (result.success && result.snapshot) {
      onRestore(result.snapshot);
      setShowConfirmRestore(null);
    } else {
      alert(`فشل الاستعادة: ${result.error}`);
    }
  };

  const handleDelete = (pointId: string) => {
    const success = deleteRollbackPoint(pointId);
    
    if (success) {
      loadPoints();
      setShowConfirmDelete(null);
      if (selectedPoint === pointId) {
        setSelectedPoint(null);
      }
    }
  };

  const handleClearAll = () => {
    const success = clearAllRollbackPoints();
    
    if (success) {
      loadPoints();
      setShowConfirmClearAll(false);
      setSelectedPoint(null);
      setCompareWith(null);
    }
  };

  const handleExport = (pointId: string) => {
    exportRollbackPoint(pointId);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await importRollbackPoint(file);
    
    if (result.success) {
      loadPoints();
      alert(' تم استيراد نقطة التراجع بنجاح');
    } else {
      alert(`❌ فشل الاستيراد: ${result.error}`);
    }
    
    // Reset input
    event.target.value = '';
  };

  const handleToggleAutoSave = () => {
    if (autoSaveEnabled) {
      disableAutoSave();
      setAutoSaveEnabled(false);
    } else {
      enableAutoSave(() => ({
        engineContext,
        employees,
        lessons,
        classes,
        scheduleConfig,
        absences,
        substitutionLogs
      }), 30);
      setAutoSaveEnabled(true);
    }
  };

  const handleCleanup = () => {
    const deletedCount = cleanupOldRollbackPoints(7);
    loadPoints();
    alert(`تم حذف ${deletedCount} نقطة تراجع قديمة`);
  };

  const getComparison = () => {
    if (!selectedPoint || !compareWith) return null;
    return compareRollbackPoints(selectedPoint, compareWith);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} كيلوبايت`;
    return `${(kb / 1024).toFixed(2)} ميجابايت`;
  };

  const selectedPointData = selectedPoint ? points.find(p => p.id === selectedPoint) : null;
  const comparison = getComparison();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield size={28} />
              <h2 className="text-2xl font-bold">إدارة نقاط التراجع</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            >
              <XCircle size={24} />
            </button>
          </div>
          
          {/* Storage Usage */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>استخدام التخزين</span>
              <span>{storageUsage.used.toFixed(2)} / 5.00 ميجابايت ({storageUsage.percentage.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
              <div
                className={`h-full rounded-full transition-all ${
                  storageUsage.percentage > 80 ? 'bg-red-400' :
                  storageUsage.percentage > 50 ? 'bg-yellow-400' :
                  'bg-green-400'
                }`}
                style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 p-4 border-b flex flex-wrap gap-2">
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Shield size={18} />
            إنشاء نقطة تراجع جديدة
          </button>
          
          <label className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 cursor-pointer">
            <Upload size={18} />
            استيراد نقطة تراجع
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          
          <button
            onClick={handleToggleAutoSave}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              autoSaveEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            <Clock size={18} />
            {autoSaveEnabled ? 'إيقاف الحفظ التلقائي' : 'تفعيل الحفظ التلقائي'}
          </button>
          
          <button
            onClick={handleCleanup}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
          >
            <Trash2 size={18} />
            تنظيف القديمة
          </button>
          
          <button
            onClick={() => setShowConfirmClearAll(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Trash2 size={18} />
            حذف الكل
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {points.length === 0 ? (
            <div className="text-center py-12">
              <Shield size={64} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">لا توجد نقاط تراجع محفوظة</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                إنشاء نقطة تراجع الأولى
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {points.map((point) => (
                <div
                  key={point.id}
                  className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                    selectedPoint === point.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPoint(point.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800">{point.label}</h3>
                      <p className="text-sm text-gray-500">{formatDate(point.timestamp)}</p>
                    </div>
                    {point.metadata.createdBy === 'AutoSave' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        تلقائي
                      </span>
                    )}
                  </div>
                  
                  {point.description && (
                    <p className="text-sm text-gray-600 mb-3">{point.description}</p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                    <div>موظفين: {point.snapshot.employees.length}</div>
                    <div>صفوف: {point.snapshot.classes.length}</div>
                    <div>حصص: {point.snapshot.lessons.length}</div>
                    <div>غيابات: {point.snapshot.absences.length}</div>
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-3">
                    <div>الحجم: {formatSize(point.metadata.totalSize)}</div>
                    <div>بواسطة: {point.metadata.createdBy}</div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirmRestore(point.id);
                      }}
                      className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center justify-center gap-1"
                    >
                      <CheckCircle size={16} />
                      استعادة
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(point.id);
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Download size={16} />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirmDelete(point.id);
                      }}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">إنشاء نقطة تراجع جديدة</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم نقطة التراجع *
                </label>
                <input
                  type="text"
                  value={newPointLabel}
                  onChange={(e) => setNewPointLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="مثال: قبل التعديل الكبير"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  وصف (اختياري)
                </label>
                <textarea
                  value={newPointDescription}
                  onChange={(e) => setNewPointDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="وصف مختصر للتغييرات المتوقعة..."
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreatePoint}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                إنشاء
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewPointLabel('');
                  setNewPointDescription('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Modal */}
      {showConfirmRestore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={32} className="text-orange-500" />
              <h3 className="text-xl font-bold">تأكيد الاستعادة</h3>
            </div>
            
            <p className="text-gray-700 mb-6">
              هل أنت متأكد من استعادة النظام إلى هذه النقطة؟ سيتم استبدال جميع البيانات الحالية.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(showConfirmRestore)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                استعادة
              </button>
              <button
                onClick={() => setShowConfirmRestore(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={32} className="text-red-500" />
              <h3 className="text-xl font-bold">تأكيد الحذف</h3>
            </div>
            
            <p className="text-gray-700 mb-6">
              هل أنت متأكد من حذف نقطة التراجع هذه؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(showConfirmDelete)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                حذف
              </button>
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear All Modal */}
      {showConfirmClearAll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={32} className="text-red-500" />
              <h3 className="text-xl font-bold">تأكيد حذف الكل</h3>
            </div>
            
            <p className="text-gray-700 mb-6">
              هل أنت متأكد من حذف جميع نقاط التراجع ({points.length})؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                حذف الكل
              </button>
              <button
                onClick={() => setShowConfirmClearAll(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RollbackManager;
