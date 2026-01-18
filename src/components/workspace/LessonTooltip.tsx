import React from 'react';
import { Clock, Users, Calendar, Award, BookOpen } from 'lucide-react';

interface LessonTooltipProps {
  lesson: any;
  teacher: any;
  classInfo: {
    name: string;
    gradeLevel: number;
  };
  availableSubstitutes?: number;
  coverage?: {
    status: string;
    label: string;
  };
  teacherWorkload?: number;
}

const LessonTooltip: React.FC<LessonTooltipProps> = ({
  lesson,
  teacher,
  classInfo,
  availableSubstitutes,
  coverage,
  teacherWorkload
}) => {
  if (!teacher) return null;

  const isEducator = teacher.addons?.educator && teacher.addons.educatorClassId === lesson.classId;

  return (
    <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 bg-slate-800 text-white rounded-xl shadow-2xl p-3 min-w-[200px] max-w-[280px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      {/* Arrow */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 rotate-45" />

      {/* Content */}
      <div className="relative space-y-2">
        {/* Subject */}
        <div className="flex items-center gap-2 border-b border-slate-600 pb-2">
          <BookOpen size={14} className="text-cyan-400" />
          <span className="font-bold text-sm">{lesson.subject}</span>
        </div>

        {/* Teacher Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users size={12} className="text-emerald-400" />
            <span className="text-xs font-medium">{teacher.name}</span>
          </div>

          {isEducator && (
            <div className="flex items-center gap-1 text-xs text-emerald-300">
              <Award size={10} />
              <span>مربي {classInfo.name}</span>
            </div>
          )}

          {teacherWorkload !== undefined && teacherWorkload > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-300">
              <Clock size={10} />
              <span>{teacherWorkload} حصة اليوم</span>
            </div>
          )}
        </div>

        {/* Class Info */}
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Calendar size={10} />
          <span>{classInfo.name} - حصة {lesson.period}</span>
        </div>

        {/* Lesson Type */}
        {lesson.type && lesson.type !== 'actual' && (
          <div className="text-xs px-2 py-1 bg-slate-700 rounded">
            نوع: {getLessonTypeLabel(lesson.type)}
          </div>
        )}

        {/* Coverage Status */}
        {coverage && coverage.status !== 'normal' && (
          <div
            className={`text-xs px-2 py-1 rounded font-bold ${
              coverage.status === 'absent-covered'
                ? 'bg-emerald-900/50 text-emerald-300'
                : 'bg-rose-900/50 text-rose-300'
            }`}
          >
            {coverage.label}
          </div>
        )}

        {/* Available Substitutes */}
        {availableSubstitutes !== undefined && availableSubstitutes > 0 && (
          <div className="text-xs px-2 py-1 bg-indigo-900/50 text-indigo-300 rounded">
            {availableSubstitutes} بديل متاح
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function
function getLessonTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'stay': 'مكوث',
    'makooth': 'مكوث',
    'individual': 'فردي',
    'shared': 'مشترك',
    'computerized': 'محوسب',
    'differential': 'تفريقي'
  };
  return labels[type] || type;
}

export default LessonTooltip;
