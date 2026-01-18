import React from 'react';
import { Users, Zap, AlertTriangle } from 'lucide-react';

interface LessonBadgesProps {
  availableSubstitutes?: number;
  hasConflict?: boolean;
  isReassigned?: boolean;
  lessonType?: string;
}

export const AvailableSubsBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  return (
    <div className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[8px] font-bold shadow-lg border-2 border-white animate-pulse">
      {count}
    </div>
  );
};

export const ConflictBadge: React.FC = () => (
  <div className="flex items-center gap-0.5 text-[7px] text-orange-700 bg-orange-100 px-1 py-0.5 rounded font-bold">
    <AlertTriangle size={8} />
    <span>تعارض</span>
  </div>
);

export const ReassignedBadge: React.FC = () => (
  <div className="flex items-center gap-0.5 text-[7px] text-purple-700 bg-purple-100 px-1 py-0.5 rounded font-bold">
    <Zap size={8} />
    <span>معاد تعيين</span>
  </div>
);

export const SharedLessonBadge: React.FC = () => (
  <div className="flex items-center gap-0.5 text-[7px] text-blue-700 bg-blue-100 px-1 py-0.5 rounded font-bold">
    <Users size={8} />
    <span>مشترك</span>
  </div>
);
