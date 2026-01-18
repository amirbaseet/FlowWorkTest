import React, { useState, useMemo } from 'react';
import { Search, X, Filter, UserX, CheckCircle2, AlertCircle } from 'lucide-react';

interface FilterBarProps {
  employees: any[];
  onSearchChange: (teacherId: number | null) => void;
  onFilterChange: (filters: FilterState) => void;
  currentFilters: FilterState;
}

export interface FilterState {
  showAbsencesOnly: boolean;
  showCoveredOnly: boolean;
  showUncoveredOnly: boolean;
  searchTeacherId: number | null;
}

const FilterBar: React.FC<FilterBarProps> = ({
  employees,
  onSearchChange,
  onFilterChange,
  currentFilters
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return employees
      .filter(emp => emp.name.toLowerCase().includes(query))
      .slice(0, 8); // Limit to 8 results
  }, [searchQuery, employees]);

  const handleSelectTeacher = (teacherId: number, teacherName: string) => {
    setSearchQuery(teacherName);
    setShowDropdown(false);
    onSearchChange(teacherId);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowDropdown(false);
    onSearchChange(null);
  };

  const toggleFilter = (filterKey: keyof FilterState) => {
    onFilterChange({
      ...currentFilters,
      [filterKey]: !currentFilters[filterKey]
    });
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm border-b border-indigo-200 px-3 py-2 shrink-0">
      <div className="flex items-center gap-3">
        {/* Search Box */}
        <div className="relative flex-1 max-w-xs">
          <div className="relative">
            <Search
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="🔍 بحث عن معلم..."
              className="w-full pr-10 pl-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={12} className="text-gray-500" />
              </button>
            )}
          </div>

          {/* Dropdown Results */}
          {showDropdown && filteredEmployees.length > 0 && (
            <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {filteredEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleSelectTeacher(emp.id, emp.name)}
                  className="w-full text-right px-3 py-2 hover:bg-indigo-50 transition-colors text-sm border-b border-gray-100 last:border-0"
                >
                  <div className="font-medium text-gray-900">{emp.name}</div>
                  {emp.addons?.educator && (
                    <div className="text-xs text-indigo-600 mt-0.5">
                      🏫 مربي الصف
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-bold flex items-center gap-1">
            <Filter size={12} />
            تصفية:
          </span>

          {/* Show Absences Only */}
          <button
            onClick={() => toggleFilter('showAbsencesOnly')}
            className={`
              px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1
              ${
                currentFilters.showAbsencesOnly
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <UserX size={12} />
            الغيابات فقط
          </button>

          {/* Show Covered Only */}
          <button
            onClick={() => toggleFilter('showCoveredOnly')}
            className={`
              px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1
              ${
                currentFilters.showCoveredOnly
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <CheckCircle2 size={12} />
            المغطى فقط
          </button>

          {/* Show Uncovered Only */}
          <button
            onClick={() => toggleFilter('showUncoveredOnly')}
            className={`
              px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1
              ${
                currentFilters.showUncoveredOnly
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <AlertCircle size={12} />
            غير المغطى فقط
          </button>

          {/* Active Filters Count */}
          {Object.values(currentFilters).filter(Boolean).length > 0 && (
            <div className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded-full text-[10px] font-black">
              {Object.values(currentFilters).filter(Boolean).length} فعّال
            </div>
          )}
        </div>

        {/* Clear All Filters */}
        {Object.values(currentFilters).filter(Boolean).length > 0 && (
          <button
            onClick={() => {
              onFilterChange({
                showAbsencesOnly: false,
                showCoveredOnly: false,
                showUncoveredOnly: false,
                searchTeacherId: null
              });
              handleClearSearch();
            }}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-colors"
          >
            إلغاء الكل
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
