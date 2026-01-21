import React, { useState } from 'react';
import { X, GraduationCap, Users, User, Coffee, CheckCircle2, RefreshCw, PhoneCall, Briefcase, ArrowRightLeft, Clock, School } from 'lucide-react';
import type { AvailableTeacherInfo } from '@/utils/workspace/getAvailableTeachers';
import type { Employee } from '@/types';

interface AvailableTeachersPopupProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: {
    period: number;
    classId: string;
    className: string;
    subject: string;
  };
  availableTeachers: {
    educatorCandidates: AvailableTeacherInfo[];
    sharedCandidates: AvailableTeacherInfo[];
    individualCandidates: AvailableTeacherInfo[];
    stayCandidates: AvailableTeacherInfo[];
    availableCandidates: AvailableTeacherInfo[];
    onCallCandidates: AvailableTeacherInfo[]; //  NEW
  };
  onSelectTeacher: (teacherId: number, swapWithLast?: boolean, swapType?: 'substitute-based' | 'class-based', classSwapInfo?: any) => void;
  activeExternalIds?: number[]; //  NEW: Reserve pool IDs
  employees: Employee[]; //  NEW: To lookup missing pool teachers
}

const AvailableTeachersPopup: React.FC<AvailableTeachersPopupProps> = ({
  isOpen,
  onClose,
  lesson,
  availableTeachers,
  onSelectTeacher,
  activeExternalIds = [], //  NEW: Reserve pool IDs with default
  employees
}) => {
  // NEW: State for swap confirmation modal
  const [showSwapConfirmation, setShowSwapConfirmation] = useState(false);
  const [swapConfirmationData, setSwapConfirmationData] = useState<{
    teacher: AvailableTeacherInfo;
    swapType: 'substitute-based' | 'class-based';
    swapInfo: any;
  } | null>(null);

  if (!isOpen) return null;

  const {
    educatorCandidates,
    sharedCandidates,
    individualCandidates,
    stayCandidates,
    availableCandidates,
    onCallCandidates = [] //  NEW: Default to empty array for backward compatibility
  } = availableTeachers;

  //  NEW: Helper to check if teacher is in pool
  const isInPool = (teacherId: number): boolean => {
    return activeExternalIds.includes(teacherId);
  };

  //  NEW: Split all candidates into pool vs non-pool
  const poolTeachers: AvailableTeacherInfo[] = [];
  const poolTeacherIds = new Set(activeExternalIds); // For quick lookup
  const foundPoolIds = new Set<number>(); // Track which pool teachers we found
  
  const nonPoolTeachers = {
    educators: [] as AvailableTeacherInfo[],
    shared: [] as AvailableTeacherInfo[],
    individual: [] as AvailableTeacherInfo[],
    stay: [] as AvailableTeacherInfo[],
    available: [] as AvailableTeacherInfo[],
    onCall: [] as AvailableTeacherInfo[]
  };

  //  NEW: Separate pool teachers from all categories
  // Build collections by iterating through original category arrays
  educatorCandidates.forEach(teacher => {
    if (isInPool(teacher.teacherId)) {
      poolTeachers.push(teacher);
      foundPoolIds.add(teacher.teacherId);
    } else {
      nonPoolTeachers.educators.push(teacher);
    }
  });

  sharedCandidates.forEach(teacher => {
    if (isInPool(teacher.teacherId)) {
      poolTeachers.push(teacher);
      foundPoolIds.add(teacher.teacherId);
    } else {
      nonPoolTeachers.shared.push(teacher);
    }
  });

  individualCandidates.forEach(teacher => {
    if (isInPool(teacher.teacherId)) {
      poolTeachers.push(teacher);
      foundPoolIds.add(teacher.teacherId);
    } else {
      nonPoolTeachers.individual.push(teacher);
    }
  });

  stayCandidates.forEach(teacher => {
    if (isInPool(teacher.teacherId)) {
      poolTeachers.push(teacher);
      foundPoolIds.add(teacher.teacherId);
    } else {
      nonPoolTeachers.stay.push(teacher);
    }
  });

  availableCandidates.forEach(teacher => {
    if (isInPool(teacher.teacherId)) {
      poolTeachers.push(teacher);
      foundPoolIds.add(teacher.teacherId);
    } else {
      nonPoolTeachers.available.push(teacher);
    }
  });

  onCallCandidates.forEach(teacher => {
    if (isInPool(teacher.teacherId)) {
      poolTeachers.push(teacher);
      foundPoolIds.add(teacher.teacherId);
    } else {
      nonPoolTeachers.onCall.push(teacher);
    }
  });

  //  NEW: Add missing pool teachers (those who are busy/absent)
  // These teachers are in the pool but not in available candidates
  activeExternalIds.forEach(poolId => {
    if (!foundPoolIds.has(poolId)) {
      // Find teacher in employees list
      const employee = employees.find(e => e.id === poolId);
      if (employee) {
        // Add as unavailable pool teacher
        poolTeachers.push({
          teacherId: employee.id,
          teacherName: employee.name,
          category: 'available',
          priority: 99, // Low priority for unavailable
          canSwapWithLast: false,
          hasLessonsToday: false,
          isOnCall: false,
          isUnavailable: true // NEW FLAG
        } as any);
      }
    }
  });

  //  NEW: Sort pool teachers by priority
  poolTeachers.sort((a, b) => a.priority - b.priority);

  const totalCount =
    educatorCandidates.length +
    sharedCandidates.length +
    individualCandidates.length +
    stayCandidates.length +
    availableCandidates.length +
    onCallCandidates.length;

  //  NEW: Helper function for category-specific styling
  const getCategoryInfo = (category: string, isOnCall?: boolean) => {
    if (isOnCall) {
      return {
        label: 'مستدعى',
        icon: '📞',
        bgColor: '#FFF7ED',
        textColor: '#EA580C',
        badgeBg: '#FFEDD5',
        badgeColor: '#C2410C'
      };
    }
    switch (category) {
      case 'educator':
        return {
          label: 'مربي صف',
          icon: '🎓',
          bgColor: '#ECFDF5',
          textColor: '#059669',
          badgeBg: '#D1FAE5',
          badgeColor: '#047857'
        };
      case 'shared':
        return {
          label: 'حصة مشتركة',
          icon: '👥',
          bgColor: '#EFF6FF',
          textColor: '#2563EB',
          badgeBg: '#DBEAFE',
          badgeColor: '#1D4ED8'
        };
      case 'individual':
        return {
          label: 'حصة فردية',
          icon: '👤',
          bgColor: '#FAF5FF',
          textColor: '#9333EA',
          badgeBg: '#F3E8FF',
          badgeColor: '#7C3AED'
        };
      case 'stay':
        return {
          label: 'مكوث',
          icon: '☕',
          bgColor: '#FFF7ED',
          textColor: '#EA580C',
          badgeBg: '#FFEDD5',
          badgeColor: '#C2410C'
        };
      case 'available':
      default:
        return {
          label: 'متاح',
          icon: '',
          bgColor: '#ECFDF5',
          textColor: '#059669',
          badgeBg: '#D1FAE5',
          badgeColor: '#047857'
        };
    }
  };

  const renderTeacherCard = (teacher: AvailableTeacherInfo) => {
    const categoryInfo = {
      educator: { icon: GraduationCap, color: 'emerald', label: 'مربي الصف' },
      shared: { icon: Users, color: 'blue', label: 'حصة مشتركة' },
      individual: { icon: User, color: 'purple', label: 'حصة فردية' },
      stay: { icon: Coffee, color: 'amber', label: 'حصة مكوث' },
      available: { icon: CheckCircle2, color: 'green', label: 'متاح' }
    };

    const info = categoryInfo[teacher.category];
    const Icon = info.icon;

    return (
      <div key={teacher.teacherId} className="border-b border-gray-100 last:border-0">
        {/* Main selection button */}
        <button
          onClick={() => onSelectTeacher(teacher.teacherId, false)}
          className={`
            w-full text-right p-3 hover:bg-${info.color}-50 transition-colors flex items-start gap-3
          `}
        >
          {/* Icon */}
          <div
            className={`
              w-10 h-10 rounded-lg flex items-center justify-center shrink-0
              bg-${info.color}-100 border-2 border-${info.color}-300
            `}
          >
            <Icon size={20} className={`text-${info.color}-700`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <div className="font-bold text-gray-900 text-sm mb-1">
              {teacher.teacherName}
            </div>

            {/* Category badge */}
            <div
              className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mb-1
                bg-${info.color}-100 text-${info.color}-900
              `}
            >
              <Icon size={10} />
              <span>{info.label}</span>
            </div>

            {/* Current lesson info */}
            {teacher.currentLesson && (
              <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="font-medium">الآن:</span>
                  <span>{teacher.currentLesson.subject}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">في:</span>
                  <span>{teacher.currentLesson.className}</span>
                </div>
              </div>
            )}

            {!teacher.currentLesson && teacher.category === 'available' && !teacher.isOnCall && (
              <div className="text-xs text-green-600 font-medium">
                ✓ فراغ - متاح تماماً
              </div>
            )}

            {/*  NEW: On-call warning badge */}
            {teacher.isOnCall && (
              <div className="text-xs text-orange-600 font-bold bg-orange-100 px-2 py-1 rounded mt-1">
                📞 غير موجود في المدرسة - يحتاج استدعاء
              </div>
            )}
          </div>

          {/* Priority indicator */}
          <div
            className={`
              shrink-0 w-6 h-6 rounded-full flex items-center justify-center
              bg-${info.color}-200 text-${info.color}-900 text-xs font-black
            `}
          >
            {teacher.priority}
          </div>
        </button>

        {/* Swap option (if available) */}
        {teacher.canSwapWithLast && teacher.swapInfo && (
          <div className="bg-indigo-50 px-3 py-2 border-t border-indigo-200">
            <button
              onClick={() => onSelectTeacher(teacher.teacherId, true, 'substitute-based')}
              className="w-full flex items-center gap-2 p-2 bg-white border-2 border-indigo-300 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <ArrowRightLeft size={14} className="text-indigo-600" />
              <div className="flex-1 text-right">
                <div className="text-xs font-bold text-indigo-900">
                  🔄 تبديل حصصك الشخصية
                </div>
                <div className="text-[10px] text-indigo-700">
                  حصة {teacher.swapInfo.currentPeriod} ↔ حصة {teacher.swapInfo.lastPeriod}
                </div>
                <div className="text-[10px] font-bold text-indigo-800 mt-0.5">
                  🏃 مغادرة بعد حصة {teacher.swapInfo.lastPeriod - 1}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* NEW: Class-based swap option */}
        {teacher.classSwapOpportunity?.canSwap && (
          <div className="bg-emerald-50 px-3 py-2 border-t border-emerald-200">
            <button
              onClick={() => {
                setSwapConfirmationData({
                  teacher,
                  swapType: 'class-based',
                  swapInfo: teacher.classSwapOpportunity
                });
                setShowSwapConfirmation(true);
              }}
              className="w-full flex items-center gap-2 p-2 bg-white border-2 border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <RefreshCw size={14} className="text-emerald-600" />
              <div className="flex-1 text-right">
                <div className="text-xs font-bold text-emerald-900">
                  🔄 تبديل مع آخر حصة للصف
                </div>
                <div className="text-[10px] text-emerald-700">
                  تغطية حصة {teacher.classSwapOpportunity.lastPeriod} بدلاً من {lesson.period}
                </div>
                <div className="text-[9px] text-emerald-600 mt-0.5">
                  {teacher.classSwapOpportunity.swapType === 'gap' && '📭 آخر حصة: فراغ'}
                  {teacher.classSwapOpportunity.swapType === 'individual' && '👤 آخر حصة: فردي'}
                  {teacher.classSwapOpportunity.swapType === 'stay' && '☕ آخر حصة: مكوث'}
                </div>
                <div className="text-[10px] font-bold text-emerald-800 mt-0.5">
                  🎓 الصف ينتهي بعد حصة {teacher.classSwapOpportunity.earlyDismissalPeriod}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Show divider if both swaps available */}
        {teacher.canSwapWithLast && teacher.classSwapOpportunity?.canSwap && (
          <div className="bg-gray-50 px-3 py-1 text-center text-[10px] font-bold text-gray-500 border-t border-gray-200">
            أو
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-900">
              اختيار معلم بديل
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {lesson.className} - حصة {lesson.period} - {lesson.subject}
            </p>
            <div className="text-xs text-gray-500 mt-1">
              {totalCount} معلم متاح
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ============================================ */}
          {/*  NEW: RESERVE POOL SECTION */}
          {/* ============================================ */}
          {poolTeachers.length > 0 && (
            <div className="p-4">
              {/* Section Header */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-black text-amber-900 flex items-center gap-2">
                    <Briefcase size={18} className="text-amber-600" />
                    بنك الاحتياط ({poolTeachers.length})
                  </h4>
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded">
                    أولوية عالية
                  </span>
                </div>
                <p className="text-[11px] text-amber-700">
                  المعلمون المخصصون مسبقاً للتغطية - اختر منهم أولاً
                </p>
              </div>

              {/* Pool Teachers List */}
              <div className="space-y-2">
                {poolTeachers.map(teacher => {
                  const categoryInfo = getCategoryInfo(teacher.category, teacher.isOnCall);
                  
                  return (
                    <div key={teacher.teacherId} className="relative">
                      <button
                        onClick={() => !teacher.isUnavailable && onSelectTeacher(teacher.teacherId, false)}
                        disabled={teacher.isUnavailable}
                        className={`w-full p-4 border-2 rounded-xl transition-all text-right group ${
                          teacher.isUnavailable
                            ? 'bg-gray-50 border-gray-300 cursor-not-allowed opacity-60'
                            : 'bg-white border-amber-200 hover:border-amber-400 hover:shadow-lg'
                        }`}
                      >
                        {/* Pool Badge */}
                        <div className="absolute top-2 left-2 bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-1 rounded flex items-center gap-1">
                          <Briefcase size={10} />
                          في البنك
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {/* Avatar */}
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
                              style={{
                                backgroundColor: teacher.isUnavailable ? '#E5E7EB' : categoryInfo.bgColor,
                                color: teacher.isUnavailable ? '#6B7280' : categoryInfo.textColor
                              }}
                            >
                              {teacher.teacherName.charAt(0)}
                            </div>

                            {/* Teacher Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-black text-slate-800">
                                  {teacher.teacherName}
                                </p>
                                {/* Category Badge */}
                                {!teacher.isUnavailable && (
                                  <span
                                    className="text-[9px] font-black px-2 py-0.5 rounded"
                                    style={{
                                      backgroundColor: categoryInfo.badgeBg,
                                      color: categoryInfo.badgeColor
                                    }}
                                  >
                                    {categoryInfo.icon} {categoryInfo.label}
                                  </span>
                                )}
                              </div>

                              {/* Current Status */}
                              <p className="text-[11px] text-slate-600">
                                {teacher.isUnavailable ? (
                                  <>
                                    <span className="text-red-600 font-bold">❌ غير متاح (مشغول أو غائب)</span>
                                  </>
                                ) : teacher.currentLesson ? (
                                  <>
                                    الآن: {teacher.currentLesson.subject} في {teacher.currentLesson.className}
                                  </>
                                ) : teacher.isOnCall ? (
                                  <>
                                    📞 <span className="text-orange-600 font-bold">مستدعى - غير موجود في المدرسة</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-emerald-600 font-bold"> متاح تماماً</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Priority Number */}
                          {!teacher.isUnavailable && (
                            <span
                              className="text-lg font-black px-3 py-1 rounded-lg shrink-0"
                              style={{
                                backgroundColor: categoryInfo.badgeBg,
                                color: categoryInfo.badgeColor
                              }}
                            >
                              [{teacher.priority}]
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Swap Option */}
                      {!teacher.isUnavailable && teacher.canSwapWithLast && teacher.swapInfo && (
                        <button
                          onClick={() => onSelectTeacher(teacher.teacherId, true, 'substitute-based')}
                          className="mt-2 w-full px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-[10px] font-black text-purple-700 hover:bg-purple-100 transition-all flex items-center justify-center gap-1"
                        >
                          <ArrowRightLeft size={12} />
                          تبديل حصصك الشخصية - مغادرة باكراً بعد حصة {teacher.swapInfo.lastPeriod - 1}
                        </button>
                      )}

                      {/* NEW: Class-based swap option */}
                      {!teacher.isUnavailable && teacher.classSwapOpportunity?.canSwap && (
                        <button
                          onClick={() => {
                            setSwapConfirmationData({
                              teacher,
                              swapType: 'class-based',
                              swapInfo: teacher.classSwapOpportunity
                            });
                            setShowSwapConfirmation(true);
                          }}
                          className="mt-2 w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-black text-emerald-700 hover:bg-emerald-100 transition-all"
                        >
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <RefreshCw size={12} />
                            تبديل مع آخر حصة للصف
                          </div>
                          <div className="text-[9px]">
                            {teacher.classSwapOpportunity.swapType === 'gap' && '📭 فراغ'}
                            {teacher.classSwapOpportunity.swapType === 'individual' && '👤 فردي'}
                            {teacher.classSwapOpportunity.swapType === 'stay' && '☕ مكوث'}
                            {' - '}
                            🎓 الصف ينتهي بعد حصة {teacher.classSwapOpportunity.earlyDismissalPeriod}
                          </div>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-xs font-bold text-slate-400">معلمون آخرون متاحون</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* EXISTING CATEGORIES (for non-pool teachers) */}
          {/* ============================================ */}
          {/* Educators */}
          {nonPoolTeachers.educators.length > 0 && (
            <div className="border-b-4 border-emerald-200">
              <div className="bg-emerald-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-emerald-900 flex items-center gap-2">
                  <GraduationCap size={16} />
                  مربو الصفوف ({nonPoolTeachers.educators.length})
                </h4>
              </div>
              {nonPoolTeachers.educators.map(renderTeacherCard)}
            </div>
          )}

          {/* Shared */}
          {nonPoolTeachers.shared.length > 0 && (
            <div className="border-b-4 border-blue-200">
              <div className="bg-blue-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-blue-900 flex items-center gap-2">
                  <Users size={16} />
                  معلمو الحصص المشتركة ({nonPoolTeachers.shared.length})
                </h4>
              </div>
              {nonPoolTeachers.shared.map(renderTeacherCard)}
            </div>
          )}

          {/* Individual */}
          {nonPoolTeachers.individual.length > 0 && (
            <div className="border-b-4 border-purple-200">
              <div className="bg-purple-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-purple-900 flex items-center gap-2">
                  <User size={16} />
                  معلمو الحصص الفردية ({nonPoolTeachers.individual.length})
                </h4>
              </div>
              {nonPoolTeachers.individual.map(renderTeacherCard)}
            </div>
          )}

          {/* Stay */}
          {nonPoolTeachers.stay.length > 0 && (
            <div className="border-b-4 border-amber-200">
              <div className="bg-amber-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-amber-900 flex items-center gap-2">
                  <Coffee size={16} />
                  معلمو حصص المكوث ({nonPoolTeachers.stay.length})
                </h4>
              </div>
              {nonPoolTeachers.stay.map(renderTeacherCard)}
            </div>
          )}

          {/* Available */}
          {nonPoolTeachers.available.length > 0 && (
            <div className="border-b-4 border-green-200">
              <div className="bg-green-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-green-900 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  المتاحون ({nonPoolTeachers.available.length})
                </h4>
              </div>
              {nonPoolTeachers.available.map(renderTeacherCard)}
            </div>
          )}

          {/*  On-Call Teachers (lowest priority) */}
          {nonPoolTeachers.onCall.length > 0 && (
            <div className="border-b-4 border-orange-200">
              <div className="bg-orange-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-orange-900 flex items-center gap-2">
                  <PhoneCall size={16} />
                  معلمون تحت الطلب ({nonPoolTeachers.onCall.length})
                </h4>
                <p className="text-[10px] text-orange-700 mt-1">
                  ⚠️ معلمون غير موجودين في المدرسة - تم استدعاؤهم من البيت
                </p>
              </div>
              {nonPoolTeachers.onCall.map(renderTeacherCard)}
            </div>
          )}

          {/* Empty state */}
          {totalCount === 0 && (
            <div className="p-8 text-center text-gray-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold">لا يوجد معلمون متاحون</p>
            </div>
          )}
        </div>
      </div>

      {/* NEW: Swap Confirmation Modal */}
      {showSwapConfirmation && swapConfirmationData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <RefreshCw size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black">🔄 تبديل ذكي - إنهاء مبكر للصف</h3>
                  <p className="text-xs text-white/80 mt-1">
                    {swapConfirmationData.teacher.teacherName} سيغطي الحصة {lesson.period}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Class Info */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <School size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-blue-600 font-bold">🏫 الصف:</div>
                    <div className="text-sm font-black text-blue-900">{lesson.className}</div>
                  </div>
                </div>
              </div>

              {/* Class End Time (CORRECTED) */}
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <GraduationCap size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-green-600 font-bold">🎓 الصف ينتهي بعد:</div>
                    <div className="text-sm font-black text-green-900">
                      الحصة {swapConfirmationData.swapInfo.earlyDismissalPeriod || (swapConfirmationData.swapInfo.lastPeriod - 1)}
                    </div>
                    <div className="text-[10px] text-green-700 mt-0.5">
                      🎉 الطلاب يغادرون مبكراً
                    </div>
                  </div>
                </div>
              </div>

              {/* Swap Details (CORRECTED) */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <RefreshCw size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-amber-600 font-bold">🔄 التبديل:</div>
                    <div className="text-sm font-black text-amber-900">
                      تغطية حصة {lesson.period} + إلغاء حصة {swapConfirmationData.swapInfo.lastPeriod}
                    </div>
                    <div className="text-[10px] text-amber-700 mt-1">
                      {swapConfirmationData.swapInfo.swapType === 'gap' && '📭 الحصة الملغاة: فراغ'}
                      {swapConfirmationData.swapInfo.swapType === 'individual' && '👤 الحصة الملغاة: فردي'}
                      {swapConfirmationData.swapInfo.swapType === 'stay' && '☕ الحصة الملغاة: مكوث'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Action Buttons */}
            <div className="p-6 bg-gray-50 flex gap-3">
              {/* Cancel Button */}
              <button
                onClick={() => {
                  setShowSwapConfirmation(false);
                  setSwapConfirmationData(null);
                }}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-700 font-black text-sm hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
              >
                <X size={18} />
                <span>❌ لا، إلغاء</span>
              </button>

              {/* Confirm Button */}
              <button
                onClick={() => {
                  onSelectTeacher(
                    swapConfirmationData.teacher.teacherId,
                    swapConfirmationData.swapType === 'substitute-based',
                    swapConfirmationData.swapType,
                    swapConfirmationData.swapInfo
                  );
                  setShowSwapConfirmation(false);
                  setSwapConfirmationData(null);
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white font-black text-sm hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle2 size={18} />
                <span> نعم، موافق</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailableTeachersPopup;
