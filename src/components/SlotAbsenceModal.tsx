import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, UserMinus, Clock, Calendar, Check, AlertCircle, 
  ChevronDown, User, BookOpen, Timer, ArrowRight, Save
} from 'lucide-react';
import { 
  Employee, Lesson, ScheduleConfig, AbsenceRecord, AbsenceType, 
  CoverageRequest, ClassItem
} from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { calculatePeriodTimeRange, normalizeArabic } from '@/utils';

interface SlotAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Employee;
  date: string;
  period: number;
  dayName: string;
  lessons: Lesson[];
  scheduleConfig: ScheduleConfig;
  classes: ClassItem[];
  existingAbsence?: AbsenceRecord;
  onSave: (absence: Omit<AbsenceRecord, 'id'>, coverageRequests: Omit<CoverageRequest, 'id'>[]) => void;
}

const ABSENCE_TYPES: { value: AbsenceType; labelAr: string; icon: React.ReactNode; description: string }[] = [
  { value: 'FULL', labelAr: 'غياب كامل', icon: <UserMinus size={18} />, description: 'غياب طوال اليوم الدراسي' },
  { value: 'PARTIAL', labelAr: 'غياب جزئي', icon: <Clock size={18} />, description: 'غياب في حصص محددة' },
  { value: 'EARLY_DEPARTURE', labelAr: 'مغادرة مبكرة', icon: <ArrowRight size={18} />, description: 'مغادرة قبل نهاية الدوام' },
  { value: 'LATE_ARRIVAL', labelAr: 'تأخير', icon: <Timer size={18} />, description: 'وصول متأخر عن بداية الدوام' },
];

const SlotAbsenceModal: React.FC<SlotAbsenceModalProps> = ({
  isOpen,
  onClose,
  teacher,
  date,
  period,
  dayName,
  lessons,
  scheduleConfig,
  classes,
  existingAbsence,
  onSave,
}) => {
  const { addToast } = useToast();
  
  // Form state
  const [absenceType, setAbsenceType] = useState<AbsenceType>(existingAbsence?.type || 'FULL');
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>(existingAbsence?.affectedPeriods || [period]);
  const [reason, setReason] = useState(existingAbsence?.reason || '');
  const [effectiveFrom, setEffectiveFrom] = useState(existingAbsence?.effectiveFrom || '');
  const [effectiveTo, setEffectiveTo] = useState(existingAbsence?.effectiveTo || '');
  
  // Get all periods for the day
  const allPeriods = useMemo(() => {
    return Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1);
  }, [scheduleConfig.periodsPerDay]);
  
  // Get teacher's lessons for this day
  const teacherLessonsToday = useMemo(() => {
    const normDay = normalizeArabic(dayName);
    return lessons.filter(l => 
      l.teacherId === teacher.id && 
      normalizeArabic(l.day) === normDay
    );
  }, [lessons, teacher.id, dayName]);
  
  // Get periods where teacher has lessons
  const teacherPeriods = useMemo(() => {
    return teacherLessonsToday.map(l => l.period).sort((a, b) => a - b);
  }, [teacherLessonsToday]);
  
  // Initialize selected periods based on absence type
  useEffect(() => {
    if (absenceType === 'FULL') {
      setSelectedPeriods(teacherPeriods);
    } else if (!existingAbsence) {
      // For non-FULL types, start with clicked period
      setSelectedPeriods([period]);
    }
  }, [absenceType, teacherPeriods, period, existingAbsence]);
  
  // Toggle period selection
  const togglePeriod = (p: number) => {
    if (absenceType === 'FULL') return; // Can't toggle in FULL mode
    
    setSelectedPeriods(prev => {
      if (prev.includes(p)) {
        return prev.filter(x => x !== p);
      }
      return [...prev, p].sort((a, b) => a - b);
    });
  };
  
  // Get lesson info for a period
  const getLessonForPeriod = (p: number) => {
    return teacherLessonsToday.find(l => l.period === p);
  };
  
  // Validate form
  const isValid = useMemo(() => {
    if (selectedPeriods.length === 0) return false;
    if (!reason.trim()) return false;
    
    // For time-based types, validate time inputs
    if (absenceType === 'EARLY_DEPARTURE' && !effectiveFrom) return false;
    if (absenceType === 'LATE_ARRIVAL' && !effectiveTo) return false;
    
    return true;
  }, [selectedPeriods, reason, absenceType, effectiveFrom, effectiveTo]);
  
  // Handle save
  const handleSave = () => {
    if (!isValid) {
      addToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      return;
    }
    
    const now = new Date().toISOString();
    
    // Create absence record
    const absence: Omit<AbsenceRecord, 'id'> = {
      teacherId: teacher.id,
      date: date,
      type: absenceType,
      status: 'OPEN',
      affectedPeriods: selectedPeriods,
      reason: reason.trim(),
      effectiveFrom: effectiveFrom || undefined,
      effectiveTo: effectiveTo || undefined,
      createdAt: existingAbsence?.createdAt || now,
      updatedAt: now,
    };
    
    // Create coverage requests for each affected period with a lesson
    const coverageRequests: Omit<CoverageRequest, 'id'>[] = selectedPeriods
      .map(p => {
        const lesson = getLessonForPeriod(p);
        if (!lesson) return null;
        
        return {
          date: date,
          periodId: p,
          absentTeacherId: teacher.id,
          absenceId: existingAbsence?.id || 0, // Will be set after absence is saved
          classId: lesson.classId,
          subject: lesson.subject,
          status: 'PENDING' as const,
          createdAt: now,
          updatedAt: now,
        };
      })
      .filter(Boolean) as Omit<CoverageRequest, 'id'>[];
    
    onSave(absence, coverageRequests);
    addToast(`تم تسجيل غياب ${teacher.name} بنجاح`, 'success');
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-rose-50 to-white border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <UserMinus size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800">تسجيل غياب</h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {teacher.name} • {date} • الحصة {period}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Teacher Info Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xl">
                {teacher.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h4 className="font-black text-slate-800">{teacher.name}</h4>
                <div className="flex flex-wrap gap-2 mt-1">
                  {teacher.subjects.slice(0, 3).map((s, i) => (
                    <span key={i} className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-slate-600">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase">حصص اليوم</p>
                <p className="text-2xl font-black text-indigo-600">{teacherPeriods.length}</p>
              </div>
            </div>
          </div>
          
          {/* Absence Type Selection */}
          <div>
            <label className="block text-xs font-black text-slate-600 mb-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-rose-500" />
              نوع الغياب
            </label>
            <div className="grid grid-cols-2 gap-3">
              {ABSENCE_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setAbsenceType(type.value)}
                  className={`p-4 rounded-xl border-2 text-right transition-all ${
                    absenceType === type.value
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${absenceType === type.value ? 'bg-rose-100' : 'bg-slate-100'}`}>
                      {type.icon}
                    </div>
                    <div>
                      <p className="font-black text-sm">{type.labelAr}</p>
                      <p className="text-[10px] opacity-70 font-medium">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Time Range for Early Departure / Late Arrival */}
          {(absenceType === 'EARLY_DEPARTURE' || absenceType === 'LATE_ARRIVAL') && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
              <label className="block text-xs font-black text-amber-700 mb-3 flex items-center gap-2">
                <Clock size={14} />
                {absenceType === 'EARLY_DEPARTURE' ? 'وقت المغادرة' : 'وقت الوصول'}
              </label>
              <div className="flex gap-4">
                {absenceType === 'EARLY_DEPARTURE' ? (
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-amber-600 mb-1 block">غادر في الساعة</label>
                    <input
                      type="time"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-white text-slate-800 font-bold focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-amber-600 mb-1 block">وصل في الساعة</label>
                    <input
                      type="time"
                      value={effectiveTo}
                      onChange={(e) => setEffectiveTo(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-white text-slate-800 font-bold focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Period Selection */}
          <div>
            <label className="block text-xs font-black text-slate-600 mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-indigo-500" />
              الحصص المتأثرة
              {absenceType === 'FULL' && (
                <span className="text-[9px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                  جميع الحصص (غياب كامل)
                </span>
              )}
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {allPeriods.map(p => {
                const lesson = getLessonForPeriod(p);
                const hasLesson = !!lesson;
                const isSelected = selectedPeriods.includes(p);
                const isDisabled = absenceType === 'FULL' || !hasLesson;
                const timeRange = calculatePeriodTimeRange(p, scheduleConfig);
                const cls = classes.find(c => c.id === lesson?.classId);
                
                return (
                  <button
                    key={p}
                    onClick={() => !isDisabled && togglePeriod(p)}
                    disabled={isDisabled && absenceType !== 'FULL'}
                    className={`p-3 rounded-xl border-2 text-center transition-all relative ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : hasLesson
                        ? 'border-slate-200 hover:border-slate-300 text-slate-600'
                        : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    <p className="font-black text-lg">{p}</p>
                    <p className="text-[8px] font-mono opacity-60">{timeRange}</p>
                    {hasLesson && (
                      <p className="text-[9px] font-bold truncate mt-1 opacity-80">
                        {cls?.name || lesson?.subject}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Reason */}
          <div>
            <label className="block text-xs font-black text-slate-600 mb-3 flex items-center gap-2">
              <BookOpen size={14} className="text-emerald-500" />
              سبب الغياب
            </label>
            <div className="space-y-2">
              {/* Quick reasons */}
              <div className="flex flex-wrap gap-2">
                {scheduleConfig.absenceReasons?.slice(0, 5).map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setReason(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reason === r
                        ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="أدخل سبب الغياب..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                rows={2}
              />
            </div>
          </div>
          
          {/* Summary */}
          {selectedPeriods.length > 0 && (
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <h4 className="text-xs font-black text-indigo-700 mb-2">ملخص التسجيل</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold">عدد الحصص المتأثرة</p>
                  <p className="font-black text-indigo-800">{selectedPeriods.length} حصة</p>
                </div>
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold">طلبات التغطية</p>
                  <p className="font-black text-indigo-800">
                    {selectedPeriods.filter(p => getLessonForPeriod(p)).length} طلب
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-8 py-3 rounded-xl bg-rose-600 text-white font-black text-sm shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save size={16} />
            حفظ وإنشاء طلبات التغطية
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlotAbsenceModal;
