import React from 'react';
import { X, Award, Coffee, Users, UserCircle } from 'lucide-react';

interface Teacher {
  id: number;
  name: string;
  subjects?: string[];
  isExternal?: boolean;
}

interface CategorizedTeacher {
  teacher: Teacher;
  reason: string;
}

interface AvailableTeachers {
  educators: CategorizedTeacher[];
  stayLessonTeachers: CategorizedTeacher[];
  sharedSecondaryTeachers: CategorizedTeacher[];
  individualTeachers: CategorizedTeacher[];
}

interface AvailableTeachersPopupProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: {
    period: number;
    classId: string;
    className: string;
    subject: string;
  };
  availableTeachers: AvailableTeachers;
  onSelectTeacher: (teacherId: number) => void;
}

const AvailableTeachersPopup: React.FC<AvailableTeachersPopupProps> = ({
  isOpen,
  onClose,
  lesson,
  availableTeachers,
  onSelectTeacher,
}) => {
  if (!isOpen) return null;

  const handleSelectTeacher = (teacherId: number) => {
    onSelectTeacher(teacherId);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const totalTeachers =
    availableTeachers.educators.length +
    availableTeachers.stayLessonTeachers.length +
    availableTeachers.sharedSecondaryTeachers.length +
    availableTeachers.individualTeachers.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h2 className="text-2xl font-bold mb-1">المعلمون البدلاء المتاحون</h2>
            <p className="text-indigo-100 text-sm">
              {lesson.subject} • {lesson.className} • الحصة {lesson.period}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {totalTeachers === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <UserCircle className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">لا يوجد معلمون متاحون</p>
              <p className="text-sm mt-2">جميع المعلمين مشغولون في هذه الفترة</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Educators Section */}
              {availableTeachers.educators.length > 0 && (
                <TeacherSection
                  title="المربون (معلمو الصف)"
                  icon={<Award className="w-5 h-5" />}
                  teachers={availableTeachers.educators}
                  onSelectTeacher={handleSelectTeacher}
                  colorTheme="emerald"
                />
              )}

              {/* Stay Lesson Teachers Section */}
              {availableTeachers.stayLessonTeachers.length > 0 && (
                <TeacherSection
                  title="معلمو حصص البقاء"
                  icon={<Coffee className="w-5 h-5" />}
                  teachers={availableTeachers.stayLessonTeachers}
                  onSelectTeacher={handleSelectTeacher}
                  colorTheme="amber"
                />
              )}

              {/* Shared Secondary Teachers Section */}
              {availableTeachers.sharedSecondaryTeachers.length > 0 && (
                <TeacherSection
                  title="معلمو الحصص المشتركة الثانويون"
                  icon={<Users className="w-5 h-5" />}
                  teachers={availableTeachers.sharedSecondaryTeachers}
                  onSelectTeacher={handleSelectTeacher}
                  colorTheme="blue"
                />
              )}

              {/* Individual Teachers Section */}
              {availableTeachers.individualTeachers.length > 0 && (
                <TeacherSection
                  title="معلمو الحصص الفردية"
                  icon={<UserCircle className="w-5 h-5" />}
                  teachers={availableTeachers.individualTeachers}
                  onSelectTeacher={handleSelectTeacher}
                  colorTheme="purple"
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            💡 اختر معلماً من القائمة أعلاه لتعيينه كبديل لهذه الحصة
          </p>
        </div>
      </div>
    </div>
  );
};

interface TeacherSectionProps {
  title: string;
  icon: React.ReactNode;
  teachers: CategorizedTeacher[];
  onSelectTeacher: (teacherId: number) => void;
  colorTheme: 'emerald' | 'amber' | 'blue' | 'purple';
}

const TeacherSection: React.FC<TeacherSectionProps> = ({
  title,
  icon,
  teachers,
  onSelectTeacher,
  colorTheme,
}) => {
  const themeClasses = {
    emerald: {
      header: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: 'text-emerald-600',
      card: 'border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-100',
      badge: 'bg-emerald-100 text-emerald-700',
      externalBadge: 'bg-emerald-500',
    },
    amber: {
      header: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: 'text-amber-600',
      card: 'border-amber-200 hover:border-amber-400 hover:shadow-amber-100',
      badge: 'bg-amber-100 text-amber-700',
      externalBadge: 'bg-amber-500',
    },
    blue: {
      header: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: 'text-blue-600',
      card: 'border-blue-200 hover:border-blue-400 hover:shadow-blue-100',
      badge: 'bg-blue-100 text-blue-700',
      externalBadge: 'bg-blue-500',
    },
    purple: {
      header: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: 'text-purple-600',
      card: 'border-purple-200 hover:border-purple-400 hover:shadow-purple-100',
      badge: 'bg-purple-100 text-purple-700',
      externalBadge: 'bg-purple-500',
    },
  };

  const theme = themeClasses[colorTheme];

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${theme.header}`}>
        <span className={theme.icon}>{icon}</span>
        <h3 className="font-semibold text-base">
          {title} ({teachers.length})
        </h3>
      </div>

      {/* Teacher Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {teachers.map(({ teacher, reason }) => (
          <button
            key={teacher.id}
            onClick={() => onSelectTeacher(teacher.id)}
            className={`
              relative p-4 border-2 rounded-lg text-right
              transition-all duration-200
              hover:shadow-lg hover:scale-[1.02]
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
              ${theme.card}
            `}
          >
            {/* External Badge */}
            {teacher.isExternal && (
              <div
                className={`absolute top-2 left-2 w-2 h-2 rounded-full ${theme.externalBadge}`}
                title="معلم خارجي"
              />
            )}

            {/* Teacher Name */}
            <div className="font-bold text-gray-900 text-lg mb-2">{teacher.name}</div>

            {/* Reason/Status Label */}
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 ${theme.badge}`}>
              {reason}
            </div>

            {/* Subjects */}
            {teacher.subjects && teacher.subjects.length > 0 && (
              <div className="text-sm text-gray-600 mt-2">
                <span className="font-medium">المواد:</span> {teacher.subjects.join(', ')}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AvailableTeachersPopup;
