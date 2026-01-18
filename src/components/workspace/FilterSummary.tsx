import React from 'react';
import { Filter, X } from 'lucide-react';
import type { FilterState } from '@/hooks/workspace/useWorkspaceFilters';

interface FilterSummaryProps {
  filters: FilterState;
  resultCount: number;
  teacherName?: string;
  onClear: () => void;
}

const FilterSummary: React.FC<FilterSummaryProps> = ({
  filters,
  resultCount,
  teacherName,
  onClear
}) => {
  const activeCount = Object.values(filters).filter(v =>
    typeof v === 'boolean' ? v : v !== null
  ).length;

  if (activeCount === 0) return null;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-indigo-600" />
          <span className="text-xs font-bold text-indigo-900">
            فلاتر نشطة: {activeCount}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-indigo-700">
            النتائج: <span className="font-black">{resultCount}</span> حصة
          </div>
          <button
            onClick={onClear}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 transition-colors"
          >
            <X size={12} />
            إلغاء
          </button>
        </div>
      </div>

      {/* Active filter details */}
      <div className="mt-2 flex flex-wrap gap-1">
        {teacherName && (
          <div className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
            🔍 {teacherName}
          </div>
        )}
        {filters.showAbsencesOnly && (
          <div className="bg-rose-100 text-rose-900 px-2 py-1 rounded text-[10px] font-bold">
            الغيابات فقط
          </div>
        )}
        {filters.showCoveredOnly && (
          <div className="bg-emerald-100 text-emerald-900 px-2 py-1 rounded text-[10px] font-bold">
            المغطى فقط
          </div>
        )}
        {filters.showUncoveredOnly && (
          <div className="bg-orange-100 text-orange-900 px-2 py-1 rounded text-[10px] font-bold">
            غير المغطى فقط
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterSummary;
