// src/components/workspace/AbsenceProtocolCard.tsx

import React from 'react';
import { X, Clock } from 'lucide-react';

interface AbsenceProtocolCardProps {
  isVisible: boolean;
  onClose: () => void;
  activeStage: 1 | 2 | 3 | 6 | null;
  onStageClick: (stage: 1 | 2 | 3 | 6) => void;
  poolCount: number;
}

/**
 * AbsenceProtocolCard - Absence documentation protocol UI (4 stages)
 */
const AbsenceProtocolCard: React.FC<AbsenceProtocolCardProps> = ({
  isVisible,
  onClose,
  activeStage,
  onStageClick,
  poolCount
}) => {
  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-l-xl shadow-lg border border-gray-200 p-2 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[10px] font-black text-gray-800">📋 بروتوكول توثيق الغياب</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
        >
          <X size={14} />
        </button>
      </div>

      <div className="text-[9px] text-gray-600 mb-1.5">
        المراحل: <span className="font-bold">1 - 2 - 3 - 6</span> (مستثنى: 4، 5، 7)
      </div>

      {/* Interactive Stages */}
      <div className="grid grid-cols-4 gap-1.5">
        {/* Stage 1: تحديد الغائبين */}
        <button
          onClick={() => onStageClick(1)}
          className={`border rounded p-1.5 text-right transition-all cursor-pointer hover:scale-105 ${
            activeStage === 1
              ? 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300'
              : 'border-indigo-200 bg-indigo-50 hover:border-indigo-400'
          }`}
        >
          <div className="text-[8px] font-black text-indigo-900 flex items-center gap-1">
            <span>1️⃣</span> تحديد الغائبين
          </div>
          <div className="text-[6px] text-indigo-600 mt-0.5">← اختر المعلمين</div>
        </button>

        {/* Stage 2: فترة الغياب */}
        <button
          onClick={() => onStageClick(2)}
          className={`border rounded p-1.5 text-right transition-all cursor-pointer hover:scale-105 ${
            activeStage === 2
              ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-300'
              : 'border-purple-200 bg-purple-50 hover:border-purple-400'
          }`}
        >
          <div className="text-[8px] font-black text-purple-900 flex items-center gap-1">
            <span>2️⃣</span> فترة الغياب
          </div>
          <div className="text-[6px] text-purple-600 mt-0.5">← حدد الحصص</div>
        </button>

        {/* Stage 3: بنك الاحتياط */}
        <button
          onClick={() => onStageClick(3)}
          className={`border rounded p-1.5 text-right transition-all cursor-pointer hover:scale-105 ${
            activeStage === 3
              ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-300'
              : 'border-blue-200 bg-blue-50 hover:border-blue-400'
          }`}
        >
          <div className="text-[8px] font-black text-blue-900 flex items-center gap-1">
            <span>3️⃣</span> بنك الاحتياط
          </div>
          <div className="text-[6px] text-blue-600 mt-0.5">← {poolCount} معلم</div>
        </button>

        {/* Stage 6: التوزيع الآلي */}
        <button
          onClick={() => onStageClick(6)}
          className={`border rounded p-1.5 text-right transition-all cursor-pointer hover:scale-105 ${
            activeStage === 6
              ? 'border-green-500 bg-green-100 ring-2 ring-green-300'
              : 'border-green-200 bg-green-50 hover:border-green-400'
          }`}
        >
          <div className="text-[8px] font-black text-green-900 flex items-center gap-1">
            <span>6️⃣</span> التوزيع الآلي
          </div>
          <div className="text-[6px] text-green-600 mt-0.5">← المعالجة</div>
        </button>
      </div>

      {/* Progress Indicator */}
      {activeStage && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1 text-[8px] text-gray-500">
            <Clock size={10} />
            <span>المرحلة الحالية: </span>
            <span className="font-black text-indigo-600">
              {activeStage === 1 && 'تحديد الغائبين'}
              {activeStage === 2 && 'فترة الغياب'}
              {activeStage === 3 && 'بنك الاحتياط'}
              {activeStage === 6 && 'التوزيع الآلي'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbsenceProtocolCard;
