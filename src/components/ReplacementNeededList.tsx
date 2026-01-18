import React, { useState, useMemo } from 'react';
import {
  UserMinus, Clock, User, Check, X, AlertCircle,
  ChevronDown, BookOpen, Search, Filter, Briefcase
} from 'lucide-react';
import {
  CoverageRequest, Employee, Lesson, ScheduleConfig, ClassItem,
  AbsenceRecord, DailyPool, CoverageAssignment
} from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { calculatePeriodTimeRange, normalizeArabic } from '@/utils';

interface ReplacementNeededListProps {
  coverageRequests: CoverageRequest[];
  employees: Employee[];
  lessons: Lesson[];
  classes: ClassItem[];
  scheduleConfig: ScheduleConfig;
  absences: AbsenceRecord[];
  dailyPools: DailyPool[];
  onAssignSubstitute: (
    coverageRequestId: string,
    substituteId: number
  ) => void;
  onCancelRequest: (coverageRequestId: string) => void;
  date?: string; // Filter by specific date
}

const ReplacementNeededList: React.FC<ReplacementNeededListProps> = ({
  coverageRequests,
  employees,
  lessons,
  classes,
  scheduleConfig,
  absences,
  dailyPools,
  onAssignSubstitute,
  onCancelRequest,
  date,
}) => {
  const { addToast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'ASSIGNED'>('PENDING');

  // Filter requests
  const filteredRequests = useMemo(() => {
    let filtered = [...coverageRequests];

    // Filter by date if specified
    if (date) {
      filtered = filtered.filter(r => r.date === date);
    }

    // Filter by status
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Sort by date and period
    return filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.periodId - b.periodId;
    });
  }, [coverageRequests, date, filterStatus]);

  // Get available substitutes for a specific request
  const getAvailableSubstitutes = (request: CoverageRequest) => {
    const dayName = new Date(request.date).toLocaleDateString('ar-SA', { weekday: 'long' });

    return employees.filter(emp => {
      // Skip external substitutes initially
      if (emp.constraints.isExternal) return false;

      // Skip the absent teacher
      if (emp.id === request.absentTeacherId) return false;

      // Check if teacher has a lesson in this period
      const hasLesson = lessons.some(l =>
        l.teacherId === emp.id &&
        l.period === request.periodId &&
        normalizeArabic(l.day) === normalizeArabic(dayName)
      );

      if (hasLesson) return false;

      // Check if teacher is already assigned to another coverage in this period
      const hasOtherAssignment = coverageRequests.some(r =>
        r.id !== request.id &&
        r.date === request.date &&
        r.periodId === request.periodId &&
        r.assignedSubstituteId === emp.id &&
        r.status === 'ASSIGNED'
      );

      if (hasOtherAssignment) return false;

      return true;
    });
  };

  // Get pool members for the date
  const getPoolMembers = (requestDate: string) => {
    const pool = dailyPools.find(p => p.date === requestDate);
    if (!pool) return [];

    return pool.poolEntries
      .map(entry => employees.find(e => e.id === entry.teacherId))
      .filter(Boolean) as Employee[];
  };

  // Get teacher info
  const getTeacher = (teacherId: number) => employees.find(e => e.id === teacherId);
  const getClass = (classId: string) => classes.find(c => c.id === classId);
  const getAbsence = (absenceId: number) => absences.find(a => a.id === absenceId);

  // Handle substitute selection
  const handleSelectSubstitute = (requestId: string, substituteId: number) => {
    onAssignSubstitute(requestId, substituteId);
    setSelectedRequest(null);
    addToast('تم تعيين البديل بنجاح', 'success');
  };

  // Render substitute selection popup
  const renderSubstituteSelector = (request: CoverageRequest) => {
    const availableSubstitutes = getAvailableSubstitutes(request);
    const poolMembers = getPoolMembers(request.date);

    // Combine and prioritize: Pool members first, then others
    const sortedSubstitutes = [
      ...poolMembers.filter(p => availableSubstitutes.some(a => a.id === p.id)),
      ...availableSubstitutes.filter(a => !poolMembers.some(p => p.id === a.id))
    ];

    // Filter by search
    const filtered = sortedSubstitutes.filter(emp =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.subjects.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-200 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث عن بديل..."
              className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:border-indigo-400 outline-none"
            />
          </div>
          <button
            onClick={() => setSelectedRequest(null)}
            className="p-2 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
          {filtered.length > 0 ? filtered.map(emp => {
            const isPoolMember = poolMembers.some(p => p.id === emp.id);

            return (
              <button
                key={emp.id}
                onClick={() => handleSelectSubstitute(request.id, emp.id)}
                className={`w-full p-2 rounded-lg border transition-all flex items-center gap-2 text-right ${isPoolMember
                    ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-white border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isPoolMember ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                  {emp.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-slate-800 truncate">{emp.name}</p>
                  <p className="text-[9px] text-slate-500 truncate">
                    {emp.subjects.slice(0, 2).join('، ')}
                    {isPoolMember && <span className="text-indigo-600 font-bold mr-1">• احتياط</span>}
                  </p>
                </div>
                <Check size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100" />
              </button>
            );
          }) : (
            <div className="text-center py-4 text-slate-400 text-xs">
              لا يوجد بدلاء متاحين
            </div>
          )}
        </div>
      </div>
    );
  };

  // Group requests by date
  const requestsByDate = useMemo(() => {
    const groups: Record<string, CoverageRequest[]> = {};
    filteredRequests.forEach(req => {
      if (!groups[req.date]) groups[req.date] = [];
      groups[req.date].push(req);
    });
    return groups;
  }, [filteredRequests]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-orange-50 to-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Briefcase size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800">طلبات التغطية</h3>
              <p className="text-[10px] text-slate-500 font-bold">
                {filteredRequests.filter(r => r.status === 'PENDING').length} طلب بانتظار التعيين
              </p>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {(['PENDING', 'ASSIGNED', 'ALL'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${filterStatus === status
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {status === 'PENDING' ? 'قيد الانتظار' : status === 'ASSIGNED' ? 'تم التعيين' : 'الكل'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {Object.keys(requestsByDate).length > 0 ? (
          Object.entries(requestsByDate).map(([dateKey, requests]: [string, CoverageRequest[]]) => (
            <div key={dateKey} className="mb-4 last:mb-0">
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-2">
                <Clock size={12} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {new Date(dateKey).toLocaleDateString('ar-SA', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              {/* Requests */}
              <div className="space-y-2">
                {requests.map(request => {
                  const absentTeacher = getTeacher(request.absentTeacherId);
                  const assignedSubstitute = request.assignedSubstituteId
                    ? getTeacher(request.assignedSubstituteId)
                    : null;
                  const cls = getClass(request.classId);
                  const timeRange = calculatePeriodTimeRange(request.periodId, scheduleConfig);

                  return (
                    <div
                      key={request.id}
                      className={`p-3 rounded-xl border transition-all ${request.status === 'ASSIGNED'
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-white border-slate-200 hover:border-orange-300'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Period Badge */}
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${request.status === 'ASSIGNED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-orange-100 text-orange-700'
                          }`}>
                          <span className="font-black text-lg">{request.periodId}</span>
                          <span className="text-[8px] font-bold opacity-70">{timeRange.split('-')[0]}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm text-slate-800">
                              {request.subject || 'حصة'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {cls?.name}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="flex items-center gap-1 text-rose-600 font-bold">
                              <UserMinus size={10} />
                              غائب: {absentTeacher?.name}
                            </span>

                            {assignedSubstitute && (
                              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                <User size={10} />
                                البديل: {assignedSubstitute.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {request.status === 'PENDING' ? (
                            <>
                              <button
                                onClick={() => setSelectedRequest(
                                  selectedRequest === request.id ? null : request.id
                                )}
                                className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-1"
                              >
                                <User size={10} />
                                اختر بديل
                              </button>
                              <button
                                onClick={() => onCancelRequest(request.id)}
                                className="p-1.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                                title="إلغاء"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-lg flex items-center gap-1">
                              <Check size={10} />
                              تم التعيين
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Substitute Selector */}
                      {selectedRequest === request.id && renderSubstituteSelector(request)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-4">
              <Check size={32} />
            </div>
            <p className="text-slate-400 font-bold text-sm">لا توجد طلبات تغطية</p>
            <p className="text-slate-300 text-xs mt-1">
              {filterStatus === 'PENDING' ? 'جميع الحصص مغطاة' : 'لا توجد طلبات'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReplacementNeededList;
