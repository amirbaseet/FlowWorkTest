// src/components/workspace/DateNavigator.tsx

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateNavigatorProps {
  viewDate: Date;
  onDateChange: (date: Date) => void;
  onToday: () => void;
  onTomorrow: () => void;
}

/**
 * DateNavigator - Date selection controls with Arabic formatting
 */
const DateNavigator: React.FC<DateNavigatorProps> = ({
  viewDate,
  onDateChange,
  onToday,
  onTomorrow
}) => {
  const handlePrevDay = () => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      onDateChange(newDate);
    }
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onDateChange(tomorrow);
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm border-b border-indigo-200 px-3 py-2 shrink-0 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Navigation Arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevDay}
            className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-700 hover:text-indigo-900"
            title="اليوم السابق"
          >
            <ChevronRight size={20} />
          </button>

          {/* Date Display & Picker */}
          <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
            <Calendar size={16} className="text-indigo-600" />
            <input
              type="date"
              value={viewDate.toISOString().split('T')[0]}
              onChange={handleDateInputChange}
              className="bg-transparent text-sm font-bold text-indigo-900 border-none outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleNextDay}
            className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-700 hover:text-indigo-900"
            title="اليوم التالي"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Center: Current Date Display (Arabic) */}
        <div className="flex-1 text-center">
          <div className="text-sm font-black text-indigo-900">
            {viewDate.toLocaleDateString('ar-EG', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>

        {/* Right: Quick Shortcuts */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToday}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            اليوم
          </button>
          <button
            onClick={handleTomorrow}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            غداً
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateNavigator;
