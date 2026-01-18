import React from 'react';
import { X, GraduationCap, Users, User, Coffee, CheckCircle2, RefreshCw } from 'lucide-react';
import type { AvailableTeacherInfo } from '@/utils/workspace/getAvailableTeachers';

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
  };
  onSelectTeacher: (teacherId: number, swapWithLast?: boolean) => void;
}

const AvailableTeachersPopup: React.FC<AvailableTeachersPopupProps> = ({
  isOpen,
  onClose,
  lesson,
  availableTeachers,
  onSelectTeacher
}) => {
  if (!isOpen) return null;

  const {
    educatorCandidates,
    sharedCandidates,
    individualCandidates,
    stayCandidates,
    availableCandidates
  } = availableTeachers;

  const totalCount =
    educatorCandidates.length +
    sharedCandidates.length +
    individualCandidates.length +
    stayCandidates.length +
    availableCandidates.length;

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

            {!teacher.currentLesson && teacher.category === 'available' && (
              <div className="text-xs text-green-600 font-medium">
                ✓ فراغ - متاح تماماً
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
              onClick={() => onSelectTeacher(teacher.teacherId, true)}
              className="w-full flex items-center gap-2 p-2 bg-white border-2 border-indigo-300 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <RefreshCw size={14} className="text-indigo-600" />
              <div className="flex-1 text-right">
                <div className="text-xs font-bold text-indigo-900">
                  🔄 تبديل مع الحصة الأخيرة
                </div>
                <div className="text-[10px] text-indigo-700">
                  يمكن للمعلم المغادرة مبكراً بعد حصة {teacher.swapInfo.currentPeriod}
                </div>
              </div>
            </button>
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
          {/* Educators */}
          {educatorCandidates.length > 0 && (
            <div className="border-b-4 border-emerald-200">
              <div className="bg-emerald-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-emerald-900 flex items-center gap-2">
                  <GraduationCap size={16} />
                  مربو الصفوف ({educatorCandidates.length})
                </h4>
              </div>
              {educatorCandidates.map(renderTeacherCard)}
            </div>
          )}

          {/* Shared */}
          {sharedCandidates.length > 0 && (
            <div className="border-b-4 border-blue-200">
              <div className="bg-blue-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-blue-900 flex items-center gap-2">
                  <Users size={16} />
                  معلمو الحصص المشتركة ({sharedCandidates.length})
                </h4>
              </div>
              {sharedCandidates.map(renderTeacherCard)}
            </div>
          )}

          {/* Individual */}
          {individualCandidates.length > 0 && (
            <div className="border-b-4 border-purple-200">
              <div className="bg-purple-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-purple-900 flex items-center gap-2">
                  <User size={16} />
                  معلمو الحصص الفردية ({individualCandidates.length})
                </h4>
              </div>
              {individualCandidates.map(renderTeacherCard)}
            </div>
          )}

          {/* Stay */}
          {stayCandidates.length > 0 && (
            <div className="border-b-4 border-amber-200">
              <div className="bg-amber-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-amber-900 flex items-center gap-2">
                  <Coffee size={16} />
                  معلمو حصص المكوث ({stayCandidates.length})
                </h4>
              </div>
              {stayCandidates.map(renderTeacherCard)}
            </div>
          )}

          {/* Available */}
          {availableCandidates.length > 0 && (
            <div>
              <div className="bg-green-50 px-4 py-2 sticky top-0 z-10">
                <h4 className="text-sm font-black text-green-900 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  المتاحون ({availableCandidates.length})
                </h4>
              </div>
              {availableCandidates.map(renderTeacherCard)}
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
    </div>
  );
};

export default AvailableTeachersPopup;
