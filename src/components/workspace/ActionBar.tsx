// src/components/workspace/ActionBar.tsx

import React from 'react';
import { Check, Save, RotateCcw, AlertCircle } from 'lucide-react';
import { EngineContext } from '@/types';

interface ActionBarProps {
  selectedClassesCount: number;
  selectedPeriodsCount: number;
  confirmedModes: Array<{ modeId: string; classes: string[]; periods: number[] }>;
  engineContext: EngineContext;
  selectedMode: string;
  canConfirm: boolean;
  showDistribution: boolean;
  onConfirmMode: () => void;
  onSaveToCalendar: () => void;
  onReset: () => void;
}

/**
 * ActionBar - Bottom action bar with mode confirmation and save buttons
 */
const ActionBar: React.FC<ActionBarProps> = ({
  selectedClassesCount,
  selectedPeriodsCount,
  confirmedModes,
  selectedMode,
  canConfirm,
  showDistribution,
  onConfirmMode,
  onSaveToCalendar,
  onReset
}) => {
  return (
    <div className="p-2 border-t border-gray-200 bg-indigo-50/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Selection Status */}
        <div className="flex items-center gap-4 text-[10px]">
          <div className="bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
            <span className="font-bold text-gray-700">الصفوف: </span>
            <span className="font-black text-indigo-600">{selectedClassesCount}</span>
          </div>
          <div className="bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
            <span className="font-bold text-gray-700">الحصص: </span>
            <span className="font-black text-indigo-600">{selectedPeriodsCount}</span>
          </div>
          <div className="bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
            <span className="font-bold text-gray-700">الأنماط المثبتة: </span>
            <span className="font-black text-emerald-600">{confirmedModes.length}</span>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {selectedMode && (
            <button
              onClick={onConfirmMode}
              disabled={!canConfirm}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                canConfirm
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Check size={16} />
              تثبيت النمط
            </button>
          )}

          {showDistribution && confirmedModes.length > 0 && (
            <button
              onClick={onSaveToCalendar}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <Save size={16} />
              حفظ في الرزنامة
            </button>
          )}

          {(selectedMode || confirmedModes.length > 0) && (
            <button
              onClick={onReset}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-sm transition-all flex items-center gap-2"
            >
              <RotateCcw size={16} />
              إعادة تعيين
            </button>
          )}
        </div>
      </div>

      {/* Warning if no mode selected */}
      {!selectedMode && confirmedModes.length === 0 && (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2 text-[10px]">
          <AlertCircle size={14} className="text-amber-600" />
          <span className="text-amber-700 font-bold">
            اختر نمطاً من الأعلى، ثم حدد الصفوف والحصص في الجدول
          </span>
        </div>
      )}
    </div>
  );
};

export default ActionBar;
