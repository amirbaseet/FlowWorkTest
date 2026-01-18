
import React, { useMemo } from 'react';
import { UserCheck, Minus, Trash2, X, Briefcase, User, Edit, GraduationCap, Check, Shield } from 'lucide-react';
import { AbsenceRecord, SubstitutionLog, Employee, Lesson, ClassItem } from '../types';
import { DAYS_AR } from '../constants';
import { normalizeArabic } from '../utils';

interface DailyAbsenceSubstitutionGridProps {
  absences: AbsenceRecord[];
  substitutions: SubstitutionLog[];
  employees: Employee[];
  lessons: Lesson[];
  classes: ClassItem[];
  maxPeriod?: number;
  date: string;
  onCancelAbsence?: (teacherId: number) => void;
  onEditAbsence?: (teacherId: number) => void;
  onUnassign?: (logId: string) => void;
  events?: any[];
  activeExternalIds?: number[]; // Added prop
}

// Robust Day Name Getter (Mirrors AbsenceForm)
const getSafeDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00'); 
    return DAYS_AR[d.getDay()];
};

const DailyAbsenceSubstitutionGrid: React.FC<DailyAbsenceSubstitutionGridProps> = ({
  absences,
  substitutions,
  employees,
  lessons,
  classes,
  maxPeriod = 7,
  date,
  onCancelAbsence,
  onEditAbsence,
  onUnassign,
  activeExternalIds = [],
  events = []
}) => {
  const dayName = getSafeDayName(date);
  const normalizedDayName = normalizeArabic(dayName);

  // 1. Process Absentees (Right Side)
  const absentColumns = useMemo(() => {
    const map = new Map<number, { id: number; name: string; periods: Record<number, { subject: string; className: string }> }>();
    
    absences.forEach(abs => {
      const teacher = employees.find(e => e.id === abs.teacherId);
      if (!teacher) return;
      
      if (!map.has(teacher.id)) {
        map.set(teacher.id, { id: teacher.id, name: teacher.name, periods: {} });
      }
      const entry = map.get(teacher.id)!;
      
      // Determine affected periods (Full day or specific)
      const periodsToProcess = abs.type === 'FULL' 
        ? Array.from({ length: maxPeriod }, (_, i) => i + 1)
        : abs.affectedPeriods;

      periodsToProcess.forEach(p => {
         // Apply Normalization to Day matching
         const lesson = lessons.find(l => 
             l.teacherId === abs.teacherId && 
             l.period === p && 
             normalizeArabic(l.day) === normalizedDayName
         );

         if (lesson) {
             entry.periods[p] = {
                 subject: lesson.subject,
                 className: classes.find(c => c.id === lesson.classId)?.name || ''
             };
         } else {
             // Mark as empty slot (free period) but still affected if full day
             entry.periods[p] = { subject: '-', className: '' };
         }
      });
    });
    return Array.from(map.values());
  }, [absences, employees, lessons, classes, maxPeriod, normalizedDayName]);

  // 2. Process Substitutes (Left Side) - INCLUDES ORIGINAL SCHEDULE
  const subColumns = useMemo(() => {
    // Get unique substitutes for this day
    const uniqueSubIds = Array.from(new Set(substitutions.map(s => s.substituteTeacherId)));
    
    return uniqueSubIds.map(subId => {
       const teacher = employees.find(e => e.id === subId);
       if (!teacher) return null;

       const periodsData: Record<number, { 
           text: string; 
           subText: string; 
           type: 'COVERAGE' | 'ORIGINAL' | 'FREE'; 
           meta?: any 
       }> = {};

       // Loop through all periods to build the full schedule
       for (let p = 1; p <= maxPeriod; p++) {
           // A. Check for Substitution Assignment (Priority)
           const assignment = substitutions.find(s => s.substituteTeacherId === subId && s.period === p);
           
           // B. Check for Original Lesson
           const originalLesson = lessons.find(l => 
               l.teacherId === subId && 
               l.period === p && 
               normalizeArabic(l.day) === normalizedDayName
           );

           if (assignment) {
               periodsData[p] = {
                   text: classes.find(c => c.id === assignment.classId)?.name || '?',
                   subText: 'تغطية',
                   type: 'COVERAGE',
                   meta: assignment
               };
           } else if (originalLesson) {
               periodsData[p] = {
                   text: originalLesson.subject,
                   subText: classes.find(c => c.id === originalLesson.classId)?.name || (originalLesson.type === 'stay' ? 'مكوث' : 'عام'),
                   type: 'ORIGINAL'
               };
           } else {
               periodsData[p] = {
                   text: '-',
                   subText: '',
                   type: 'FREE'
               };
           }
       }

       return {
           id: teacher.id,
           name: teacher.name,
           isExternal: teacher.constraints.isExternal,
           periods: periodsData
       };
    }).filter(Boolean) as { id: number; name: string; isExternal: boolean; periods: any }[];
  }, [substitutions, employees, classes, lessons, maxPeriod, normalizedDayName]);

  // 3. Layout & Scaling Logic
  const totalCols = absentColumns.length + subColumns.length;
  
  // Smart Sizing
  const colWidthClass = totalCols > 8 ? 'min-w-[90px]' : 'min-w-[120px]';
  const fontSizeClass = totalCols > 12 ? 'text-[9px]' : totalCols > 8 ? 'text-[10px]' : 'text-xs';
  const cellHeightClass = 'h-14'; 

  const renderLessonCell = (teacherId: number, period: number, isAbsentColumn: boolean) => {
      if (isAbsentColumn) {
          const lesson = lessons.find(l => l.teacherId === teacherId && l.period === period && normalizeArabic(l.day) === normalizedDayName);
          if (!lesson) return <div className="flex items-center justify-center h-full w-full opacity-20"><Minus size={12}/></div>;

          // Find substitute from substitutions array directly
          const assignment = substitutions.find(s => s.absentTeacherId === teacherId && s.period === period);
          const substituteId = assignment?.substituteTeacherId;
          const substitute = substituteId ? employees.find(e => e.id === substituteId) : null;
          const isUncovered = !substitute;
          
          const baseStyle = isUncovered 
            ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" 
            : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100";

          return (
              <div 
                  onClick={() => onEditAbsence && onEditAbsence(teacherId)}
                  className={`w-full h-full rounded-lg border flex flex-col items-center justify-center p-1 cursor-pointer transition-all relative ${baseStyle}`}
              >
                  <span className="text-[9px] font-black truncate w-full text-center">{lesson.subject}</span>
                  <span className="text-[8px] font-bold opacity-70 truncate w-full text-center">{classes.find(c => c.id === lesson.classId)?.name}</span>
                  {substitute && (
                      <div className="absolute -bottom-1 -right-1 bg-white border border-emerald-200 text-emerald-600 text-[7px] font-black px-1.5 py-0.5 rounded-tl-lg shadow-sm z-10">{substitute.name.split(' ')[0]}</div>
                  )}
                  {isUncovered && <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>}
              </div>
          );
      } else {
          // Substitute Cell
          const assignment = substitutions.find(s => s.substituteTeacherId === teacherId && s.period === period);
          
          if (assignment) {
              const absentId = assignment.absentTeacherId;
              const coveredLesson = lessons.find(l => l.teacherId === absentId && l.period === period && normalizeArabic(l.day) === normalizedDayName);
              const teacher = employees.find(e => e.id === teacherId);
              
              if (!teacher || !coveredLesson) return null;

              const isExternal = teacher.constraints.isExternal;
              
              // --- ROLE DETECTION FOR BADGE ---
              let roleBadge = null;
              let extraStyle = isExternal ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800";

              // 1. Check if Educator
              const isEducator = teacher.addons.educator && teacher.addons.educatorClassId === coveredLesson.classId;
              
              // 2. Check if Exam Mode Subject Specialist
              const isSpecialist = teacher.subjects.some(s => coveredLesson.subject.includes(s) || s.includes(coveredLesson.subject));

              // 3. Support Proctor Logic
              const isExamTime = events.some(e => 
                  e.date === date && 
                  e.appliesTo.periods.includes(period) && 
                  e.appliesTo.classes.includes(coveredLesson.classId) &&
                  e.eventType === 'EXAM'
              );

              if (isEducator) {
                  roleBadge = <div className="absolute top-0 left-0 bg-violet-600 text-white text-[7px] px-1 rounded-br-md font-black flex items-center gap-0.5"><GraduationCap size={8}/> مربي</div>;
                  extraStyle = "bg-violet-50 border-violet-200 text-violet-800";
              } else if (isSpecialist && isExamTime) {
                  roleBadge = <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[7px] px-1 rounded-br-md font-black flex items-center gap-0.5"><Check size={8}/> تخصص</div>;
                  extraStyle = "bg-indigo-50 border-indigo-200 text-indigo-800";
              } else if (isExamTime) {
                  roleBadge = <div className="absolute top-0 left-0 bg-orange-500 text-white text-[7px] px-1 rounded-br-md font-black flex items-center gap-0.5"><Shield size={8}/> مساند</div>;
                  extraStyle = "bg-orange-50 border-orange-200 text-orange-800";
              }

              return (
                  <div className={`w-full h-full rounded-lg border flex flex-col items-center justify-center p-1 relative group/cell ${extraStyle}`}>
                        {roleBadge}
                        {onUnassign && (
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnassign(assignment.id); }} className="absolute -top-1 -right-1 p-0.5 bg-white text-rose-500 rounded-full opacity-0 group-hover/cell:opacity-100 transition-all z-20 hover:bg-rose-500 hover:text-white shadow-sm border border-rose-100 cursor-pointer"><X size={10} /></button>
                        )}
                      <span className="text-[9px] font-black truncate w-full text-center mt-1">{classes.find(c => c.id === coveredLesson?.classId)?.name}</span>
                      <span className="text-[7px] font-bold opacity-70 truncate w-full text-center">{isExamTime && !isEducator && !isSpecialist ? 'مراقبة' : 'تغطية'}</span>
                  </div>
              );
          }
          const originalLesson = lessons.find(l => l.teacherId === teacherId && l.period === period && normalizeArabic(l.day) === normalizedDayName);
          if (originalLesson) {
              return (
                  <div className="w-full h-full rounded-lg border border-slate-100 bg-slate-50 flex flex-col items-center justify-center p-1 opacity-60">
                      <span className="text-[9px] font-bold text-slate-500 truncate w-full text-center">{originalLesson.subject}</span>
                      <span className="text-[7px] font-medium text-slate-400 truncate w-full text-center">{classes.find(c => c.id === originalLesson.classId)?.name}</span>
                  </div>
              );
          }
          return <div className="flex items-center justify-center h-full w-full opacity-10"><Minus size={12}/></div>;
      }
  };

  if (absentColumns.length === 0 && subColumns.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
            <UserCheck size={48} className="text-emerald-200 mb-4" />
            <span className="text-slate-400 font-bold">لا توجد عمليات رصد لهذا اليوم</span>
        </div>
      );
  }

  return (
    <div className="w-full overflow-x-auto custom-scrollbar bg-white border border-slate-200 rounded-[2.5rem] shadow-sm relative p-2">
       <div className="flex min-w-fit">
          
          {/* RIGHT SIDE: ABSENT TEACHERS */}
          {absentColumns.length > 0 && (
            <div className="flex-shrink-0 flex divide-x divide-x-reverse divide-slate-100 border-l border-slate-200 bg-rose-50/30">
                {/* Section Header (Vertical) */}
                <div className="w-10 bg-rose-50 border-l border-rose-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest writing-vertical-rl rotate-180 py-4" style={{writingMode: 'vertical-rl'}}>
                    المعلمون الغائبون
                    </span>
                </div>

                {absentColumns.map((col, idx) => (
                    <div key={`abs-${idx}`} className={`flex flex-col border-l border-slate-50 ${colWidthClass} group/col`}>
                    {/* Column Header */}
                    <div className="h-16 p-2 text-center border-b border-rose-100 bg-white flex flex-col items-center justify-center gap-1 relative group/header">
                        
                        {/* Action Buttons Container */}
                        <div className="absolute top-1 right-1 flex gap-1 z-[100] opacity-0 group-hover/header:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-0.5 shadow-sm">
                            {onEditAbsence && (
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onEditAbsence(col.id);
                                    }}
                                    className="p-1 bg-white text-indigo-500 rounded-md hover:bg-indigo-500 hover:text-white border border-indigo-100 cursor-pointer shadow-sm"
                                    title="تعديل الغياب"
                                >
                                    <Edit size={10} />
                                </button>
                            )}
                            {onCancelAbsence && (
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onCancelAbsence(col.id);
                                    }}
                                    className="p-1 bg-white text-rose-500 rounded-md hover:bg-rose-500 hover:text-white border border-rose-100 cursor-pointer shadow-sm"
                                    title="إلغاء الغياب"
                                >
                                    <Trash2 size={10} />
                                </button>
                            )}
                        </div>

                        <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black">{col.name.charAt(0)}</div>
                        <span className={`font-black text-slate-800 ${fontSizeClass} truncate w-full`} title={col.name}>{col.name.split(' ').slice(0,2).join(' ')}</span>
                    </div>
                    
                    {/* Periods */}
                    {Array.from({length: maxPeriod}).map((_, pIdx) => {
                        const p = pIdx + 1;
                        return (
                            <div key={p} className={`${cellHeightClass} border-b border-slate-100/50 flex items-center justify-center p-1 relative group hover:bg-white transition-colors`}>
                                <span className="absolute top-0.5 right-1 text-[7px] text-slate-300 font-mono select-none">{p}</span>
                                {renderLessonCell(col.id, p, true)}
                            </div>
                        );
                    })}
                    </div>
                ))}
            </div>
          )}

          {/* LEFT SIDE: SUBSTITUTE TEACHERS */}
          {subColumns.length > 0 && (
            <div className="flex-shrink-0 flex divide-x divide-x-reverse divide-slate-100 bg-emerald-50/10">
                {/* Section Header */}
                <div className="w-10 bg-emerald-50 border-r border-l border-emerald-100 flex items-center justify-center">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest writing-vertical-rl rotate-180 py-4" style={{writingMode: 'vertical-rl'}}>
                    برنامج البدلاء
                    </span>
                </div>

                {subColumns.map((col, idx) => (
                    <div key={`sub-${idx}`} className={`flex flex-col border-l border-slate-50 ${colWidthClass}`}>
                        {/* Column Header */}
                        <div className={`h-16 p-2 text-center border-b ${col.isExternal ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-white'} flex flex-col items-center justify-center gap-1`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${col.isExternal ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}>{col.isExternal ? <Briefcase size={12}/> : <User size={12}/>}</div>
                            <span className={`font-black ${col.isExternal ? 'text-amber-800' : 'text-slate-800'} ${fontSizeClass} truncate w-full`} title={col.name}>{col.name.split(' ').slice(0,2).join(' ')}</span>
                        </div>

                        {/* Periods */}
                        {Array.from({length: maxPeriod}).map((_, pIdx) => {
                            const p = pIdx + 1;
                            return (
                                <div key={p} className={`${cellHeightClass} border-b border-slate-100/50 flex items-center justify-center p-0.5 relative group hover:bg-white transition-colors`}>
                                    {idx === 0 && <span className="absolute top-0.5 right-1 text-[7px] text-slate-300 font-mono select-none">{p}</span>}
                                    {renderLessonCell(col.id, p, false)}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
          )}

       </div>
    </div>
  );
};

export default DailyAbsenceSubstitutionGrid;
