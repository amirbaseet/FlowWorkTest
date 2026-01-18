// src/components/workspace/HolidayDisplay.tsx

import React from 'react';
import { Calendar, ArrowLeft, Sun } from 'lucide-react';

interface HolidayDisplayProps {
  reason: string;
  onToday: () => void;
  onNextDay: () => void;
}

/**
 * HolidayDisplay - Display non-school day message with navigation
 */
const HolidayDisplay: React.FC<HolidayDisplayProps> = ({
  reason,
  onToday,
  onNextDay
}) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-amber-200 p-8 max-w-md">
        <div className="text-center">
          <div className="mb-4">
            <Calendar size={64} className="mx-auto text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">
            يوم غير دراسي
          </h2>
          <p className="text-lg text-gray-600 mb-6">{reason}</p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={onToday}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all flex items-center gap-2"
            >
              <Sun size={18} />
              العودة لليوم
            </button>
            <button
              onClick={onNextDay}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-all flex items-center gap-2"
            >
              اليوم التالي
              <ArrowLeft size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayDisplay;
