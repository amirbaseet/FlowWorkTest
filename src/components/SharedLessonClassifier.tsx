import React, { useState } from 'react';
import { Users, CheckCircle, Sparkles, RefreshCw, Info, BookOpen, Layers } from 'lucide-react';
import { normalizeArabic } from '@/utils';

interface SharedLesson {
  subject1: string;
  teacher1: string;
  subject2: string;
  teacher2: string;
  day: string;
  period: number;
  className: string;
  cellContent: string;
}

interface ClassificationPattern {
  subjectName: string;        // ONLY KEY for classification
  role: 'primary' | 'secondary';
}

interface SharedLessonClassifierProps {
  sharedLessons: SharedLesson[];
  onClassify: (classifications: Array<{
    index: number;
    primary: { subject: string; teacher: string };
    secondary: { subject: string; teacher: string; role?: 'primary' | 'secondary' };
  }>) => void;
  onSkip: () => void;
}

export const SharedLessonClassifier: React.FC<SharedLessonClassifierProps> = ({
  sharedLessons,
  onClassify,
  onSkip
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [classifications, setClassifications] = useState<any[]>([]);
  const [learnedPatterns, setLearnedPatterns] = useState<ClassificationPattern[]>([]);
  const [autoClassifiedCount, setAutoClassifiedCount] = useState(0);
  
  const currentLesson = sharedLessons[currentIndex];
  
  // CRITICAL: Pattern matching based on SUBJECT NAME ONLY
  const findMatchingPattern = (subject: string): 'primary' | 'secondary' | null => {
    const normalizedSubject = normalizeArabic(subject).toLowerCase().trim();
    
    // Find pattern based ONLY on subject name
    const match = learnedPatterns.find(p => 
      normalizeArabic(p.subjectName).toLowerCase().trim() === normalizedSubject
    );
    
    return match ? match.role : null;
  };
  
  // Auto-classify lesson if BOTH subjects are already learned OR match support keywords
  const autoClassifyLesson = (lesson: SharedLesson, index: number): { classification: any } | null => {
    let role1 = findMatchingPattern(lesson.subject1);
    let role2 = findMatchingPattern(lesson.subject2);
    
    // HEURISTIC: Check for "support" keywords if no pattern is learned yet
    const s1 = normalizeArabic(lesson.subject1);
    const s2 = normalizeArabic(lesson.subject2);
    const isSupport1 = s1.includes('فردي') || s1.includes('دعم');
    const isSupport2 = s2.includes('فردي') || s2.includes('دعم');

    // If one is support and the other is not, and we don't have patterns yet, suggest roles
    if (!role1 && !role2) {
        if (isSupport1 && !isSupport2) { role1 = 'secondary'; role2 = 'primary'; }
        else if (isSupport2 && !isSupport1) { role2 = 'secondary'; role1 = 'primary'; }
    } else if (role1 && !role2) {
        role2 = isSupport2 ? 'secondary' : 'primary';
    } else if (role2 && !role1) {
        role1 = isSupport1 ? 'secondary' : 'primary';
    }
    
    // Final check: if both roles are determined (either by pattern or heuristic)
    if (role1 && role2) {
      const classification = {
        index: index,
        primary: role1 === 'primary' 
          ? { subject: lesson.subject1, teacher: lesson.teacher1 }
          : { subject: lesson.subject2, teacher: lesson.teacher2 },
        secondary: role1 === 'secondary'
          ? { subject: lesson.subject1, teacher: lesson.teacher1 }
          : { subject: lesson.subject2, teacher: lesson.teacher2, role: (role1 === 'primary' && role2 === 'primary') ? 'primary' : 'secondary' }
      };
      
      return { classification };
    }
    
    return null;
  };
  
  const handleSelect = (primaryIndex: 0 | 1 | 'both') => {
    const lesson = currentLesson;
    
    let primarySubject: string;
    let primaryTeacher: string;
    let secondarySubject: string;
    let secondaryTeacher: string;
    
    if (primaryIndex === 'both') {
      // BOTH ARE PRIMARY - No secondary
      primarySubject = lesson.subject1; 
      primaryTeacher = lesson.teacher1;
      secondarySubject = lesson.subject2;
      secondaryTeacher = lesson.teacher2;
    } else {
      // One primary, one secondary
      primarySubject = primaryIndex === 0 ? lesson.subject1 : lesson.subject2;
      primaryTeacher = primaryIndex === 0 ? lesson.teacher1 : lesson.teacher2;
      secondarySubject = primaryIndex === 0 ? lesson.subject2 : lesson.subject1;
      secondaryTeacher = primaryIndex === 0 ? lesson.teacher2 : lesson.teacher1;
    }
    
    // LEARN PATTERN: Save SUBJECT ONLY (ignore teacher name)
    const newPatterns = [...learnedPatterns];
    
    const updatePattern = (subject: string, role: 'primary' | 'secondary') => {
        const existingIdx = newPatterns.findIndex(p => 
            normalizeArabic(p.subjectName).toLowerCase().trim() === 
            normalizeArabic(subject).toLowerCase().trim()
        );
        if (existingIdx === -1) {
            newPatterns.push({ subjectName: subject, role });
        }
    };

    if (primaryIndex === 'both') {
        updatePattern(primarySubject, 'primary');
        updatePattern(secondarySubject, 'primary');
    } else {
        updatePattern(primarySubject, 'primary');
        updatePattern(secondarySubject, 'secondary');
    }
    
    setLearnedPatterns(newPatterns);
    
    // Store classification
    const classification = {
      index: currentIndex,
      primary: { subject: primarySubject, teacher: primaryTeacher },
      secondary: primaryIndex === 'both' 
        ? { subject: secondarySubject, teacher: secondaryTeacher, role: 'primary' as const }
        : { subject: secondarySubject, teacher: secondaryTeacher }
    };
    
    let newClassifications = [...classifications, classification];
    
    // AUTO-CLASSIFY remaining lessons
    let nextIndex = currentIndex + 1;
    let newAutoCount = autoClassifiedCount;

    while (nextIndex < sharedLessons.length) {
      const nextLesson = sharedLessons[nextIndex];
      const autoResult = autoClassifyLesson(nextLesson, nextIndex);
      
      if (!autoResult) {
        break; // Need user input
      }
      
      newClassifications.push(autoResult.classification);
      newAutoCount++;
      nextIndex++;
    }
    
    setClassifications(newClassifications);
    setAutoClassifiedCount(newAutoCount);

    if (nextIndex < sharedLessons.length) {
      setCurrentIndex(nextIndex);
    } else {
      // All classified!
      onClassify(newClassifications);
    }
  };
  
  const resetPatterns = () => {
    setLearnedPatterns([]);
    setAutoClassifiedCount(0);
    setCurrentIndex(0);
    setClassifications([]);
  };
  
  if (!currentLesson) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[10000]" dir="rtl">
      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full mx-4 overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black">تصنيف الحصص المشتركة</h3>
              <p className="text-xs font-bold text-indigo-100 opacity-80 mt-1">تحديد المعلم الأساسي والمعلم المساند</p>
            </div>
          </div>
          <div className="text-left">
            <span className="text-sm font-black bg-white/20 px-4 py-2 rounded-full">
              {currentIndex + 1} / {sharedLessons.length}
            </span>
          </div>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Blue Info Box: Subject-Based Logic Explanation */}
            <div className="flex items-start gap-4 p-5 bg-blue-50 border border-blue-100 rounded-[2rem] text-blue-700 shadow-sm">
                <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0">
                    <BookOpen size={20} />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-black">ذكاء تصنيف المواد</h4>
                    <p className="text-[10px] font-bold opacity-80 leading-relaxed">
                        يعتمد النظام على **اسم المادة فقط** كمفتاح للتصنيف. بمجرد تحديد دور المادة (أساسي أو مساند)، سيتم تطبيقه تلقائياً على جميع المعلمين في هذا الاستيراد.
                    </p>
                </div>
            </div>

            {/* Progress Info */}
            {autoClassifiedCount > 0 && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 animate-pulse">
                    <Sparkles size={20} />
                    <span className="text-xs font-black">تم تصنيف {autoClassifiedCount} حصة تلقائياً بناءً على الأنماط المتعلمة!</span>
                </div>
            )}

            {/* Purple Patterns Box: Learned Subjects */}
            {learnedPatterns.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-widest px-2">
                        <Layers size={14} />
                        <span>الأنماط المتعلمة ({learnedPatterns.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2 p-4 bg-indigo-50/50 border border-indigo-100 rounded-[2rem]">
                        {learnedPatterns.map((p, i) => (
                            <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black ${
                                p.role === 'primary' 
                                ? 'bg-indigo-600 text-white border-indigo-700' 
                                : 'bg-white text-indigo-600 border-indigo-200 shadow-sm'
                            }`}>
                                <span>{p.subjectName}</span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${
                                    p.role === 'primary' ? 'bg-white/20' : 'bg-indigo-50'
                                }`}>
                                    {p.role === 'primary' ? 'أساسي' : 'مساند'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Current Lesson Info: Context Box */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 font-bold text-[10px] uppercase tracking-widest shadow-sm">
                    <Info size={14} />
                    <span>تفاصيل الحصة الحالية: <span className="text-amber-900 font-black">{currentLesson.className}</span> - {currentLesson.day} (الحصة {currentLesson.period})</span>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {/* Option 1: Teacher 1 is Primary */}
                    <button 
                        onClick={() => handleSelect(0)}
                        className="group flex items-center justify-between p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] hover:border-indigo-500 hover:bg-indigo-50 transition-all text-right w-full"
                    >
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">الخيار الأول: معلم أساسي</span>
                            <div className="text-lg font-black text-slate-800 group-hover:text-indigo-700">{currentLesson.teacher1}</div>
                            <div className="text-sm font-bold text-slate-500">{currentLesson.subject1}</div>
                        </div>
                        <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <CheckCircle size={24} />
                        </div>
                    </button>

                    {/* Option 2: Teacher 2 is Primary */}
                    <button 
                        onClick={() => handleSelect(1)}
                        className="group flex items-center justify-between p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] hover:border-indigo-500 hover:bg-indigo-50 transition-all text-right w-full"
                    >
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">الخيار الثاني: معلم أساسي</span>
                            <div className="text-lg font-black text-slate-800 group-hover:text-indigo-700">{currentLesson.teacher2}</div>
                            <div className="text-sm font-bold text-slate-500">{currentLesson.subject2}</div>
                        </div>
                        <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <CheckCircle size={24} />
                        </div>
                    </button>

                    {/* Option Both: Both are Primary */}
                    <button 
                        onClick={() => handleSelect('both')}
                        className="group flex items-center justify-between p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] hover:border-amber-500 hover:bg-amber-100 transition-all text-right w-full shadow-sm"
                    >
                        <div className="space-y-1 flex-1">
                            <span className="text-[10px] font-black text-amber-600 uppercase">خيار متقدم: كلاهما أساسي</span>
                            <div className="text-lg font-black text-amber-900">اعتبار المعلمين معاً كمعلمين أساسيين</div>
                            <p className="text-[10px] font-bold text-amber-700/70">يستخدم عندما يكون التدريس مشتركاً وفعليه من قبل الطرفين</p>
                        </div>
                        <div className="p-4 bg-white rounded-2xl shadow-sm border border-amber-200 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                            <Sparkles size={24} />
                        </div>
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button 
                    onClick={onSkip}
                    className="text-slate-400 hover:text-rose-500 font-bold text-sm transition-colors"
                >
                    تجاهل التصنيف (استيراد كحصص عادية)
                </button>
                
                <button 
                    onClick={resetPatterns}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold text-sm transition-colors"
                >
                    <RefreshCw size={16} />
                    إعادة تصفير الأنماط المتعلمة
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
