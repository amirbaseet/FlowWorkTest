
import React, { useState, useMemo } from 'react';
import { 
  UserCheck, Minus, Trash2, X, Briefcase, User, Edit, LayoutList, 
  UserMinus, BriefcaseBusiness, Check, RotateCcw, AlertCircle, Eye, EyeOff, CalendarDays,
  ShieldAlert, Zap, Lock, FileText, Layers, GraduationCap, Unlock, Split, ArrowRightLeft, HeartHandshake, Shield,
  Star
} from 'lucide-react';
import { Employee, ClassItem, Lesson, ScheduleConfig, CalendarEvent, EngineContext, ModeConfig } from '../types';

interface GroupAbsenceBoardProps {
  selectedTeacherIds: number[];
  employees: Employee[];
  assignments: Record<string, number>;
  onAssign: (slotKey: string, substituteId: number | null) => void;
  onUnassign?: (absentTeacherId: number, period: number) => void;
  onBulkAssign: (absentTeacherId: number, substituteId: number) => void;
  activeExternalIds: number[];
  uncoveredLessons: any[];
  classes: ClassItem[];
  lessons: Lesson[];
  scheduleConfig: ScheduleConfig;
  dayName: string;
  onEditAbsence?: (teacherId: number) => void;
  events?: CalendarEvent[]; 
  date?: string; 
  engineContext?: EngineContext;
}

const normalize = (text: string) => {
    if (!text) return "";
    return text.replace(/(أ|إ|آ)/g, 'ا').trim();
};

const GroupAbsenceBoard: React.FC<GroupAbsenceBoardProps> = ({ 
  selectedTeacherIds, 
  employees, 
  assignments = {}, 
  onAssign, 
  onUnassign,
  onBulkAssign,
  activeExternalIds, // This prop contains the IDs of EVERYONE in the Pool (External + Selected Internal)
  uncoveredLessons,
  classes,
  lessons,
  scheduleConfig,
  dayName,
  onEditAbsence,
  events = [],
  date,
  engineContext
}) => {
  const [editingSlot, setEditingSlot] = useState<{tid: number, p: number, lesson: any} | null>(null); // Lesson type generalized
  const [bulkAssignTarget, setBulkAssignTarget] = useState<number | null>(null);
  const [popupFilter, setPopupFilter] = useState<'RECOMMENDED' | 'ALL'>('RECOMMENDED');

  const maxPeriod = scheduleConfig.periodsPerDay;

  // 1. Get Absent Teachers List (RIGHT SIDE)
  const absentees = useMemo(() => {
    return selectedTeacherIds.map(tid => employees.find(e => e.id === tid)).filter(Boolean) as Employee[];
  }, [selectedTeacherIds, employees]);

  // 2. Get Assigned Substitutes List (Unique) (LEFT SIDE)
  const substitutes = useMemo(() => {
    const subIds = Array.from(new Set(Object.values(assignments)));
    return subIds.map(sid => employees.find(e => e.id === sid)).filter(Boolean) as Employee[];
  }, [assignments, employees]);

  const absentColumns = useMemo(() => absentees.map(e => ({ id: e.id, name: e.name })), [absentees]);
  const subColumns = useMemo(() => substitutes.map(e => ({ id: e.id, name: e.name, isExternal: e.constraints.isExternal })), [substitutes]);

  // Active Mode Detection Helper
  const getActiveModeForPeriod = (period: number): ModeConfig | undefined => {
      if (!engineContext) return undefined;
      return (Object.values(engineContext) as ModeConfig[]).find(m => m.isActive && m.affectedPeriods.includes(period));
  };

  // Filter Pool Members for Bulk Assign (ONLY Active Ones)
  const poolCandidates = useMemo(() => {
      return employees.filter(e => activeExternalIds.includes(e.id));
  }, [employees, activeExternalIds]);

  // Helper to generate candidates for the popover
  const getCandidates = (period: number, absentTeacherId: number) => {
      // 1. Determine if this slot is part of an EXAM
      const originalLesson = lessons.find(l => l.teacherId === absentTeacherId && normalize(l.day) === normalize(dayName) && l.period === period);
      
      let examSubject: string | null = null;
      let isExamSlot = false;
      let targetClassId = originalLesson?.classId;

      if (originalLesson) {
          const relevantEvent = events.find(e => 
              e.date === date && 
              e.appliesTo.periods.includes(period) && 
              e.appliesTo.classes.includes(originalLesson.classId) &&
              e.eventType === 'EXAM' &&
              e.opContext?.isActive
          );
          if (relevantEvent) {
              isExamSlot = true;
              examSubject = relevantEvent.opContext?.exam?.examSubject || relevantEvent.opContext?.settings?.subject?.governingSubject || null;
          }
      }

      // Check if any teacher of the exam subject is busy in another section (Roaming Scenario)
      let isSubjectTeacherRoaming = false;
      if (examSubject) {
          const busySpecialists = lessons.filter(l => 
              normalize(l.day) === normalize(dayName) && 
              l.period === period && 
              (l.subject.includes(examSubject!) || examSubject!.includes(l.subject))
          );
          if (busySpecialists.length > 0) isSubjectTeacherRoaming = true;
      }

      const allCandidates = employees.map(emp => {
          if (selectedTeacherIds.includes(emp.id)) return null;

          const isAssignedElsewhere = Object.entries(assignments).some(([key, subId]) => {
              const [_, pStr] = key.split('-');
              return subId === emp.id && Number(pStr) === period;
          });
          
          // --- LAYER LOGIC FOR CANDIDATES ---
          
          // Layer 1: Base Lesson
          const baseLesson = lessons.find(l => l.teacherId === emp.id && normalize(l.day) === normalize(dayName) && l.period === period);
          
          // Layer 2: Event Overlay (Check if this teacher is involved in an event/exam)
          const isBusyWithEvent = date && events.some(e => 
              e.date === date && 
              e.appliesTo.periods.includes(period) &&
              (e.plannerId === emp.id || e.participants.some(p => p.userId === emp.id))
          );

          // Layer 3: Displacement Check (Released by Exam)
          let isDisplaced = false;
          if (baseLesson && !isBusyWithEvent && !isAssignedElsewhere) {
              const classHasExam = events.some(e => 
                  e.date === date &&
                  e.appliesTo.periods.includes(period) &&
                  e.appliesTo.classes.includes(baseLesson.classId) &&
                  e.eventType === 'EXAM'
              );
              if (classHasExam) isDisplaced = true;
          }

          // Determine Status
          let status = 'FREE';
          let label = 'فراغ (متواجد)';
          let priority = 10; // Default lower priority
          let details = '';

          // --- PRIORITY 0: THE POOL (Absolute Priority) ---
          // This overrides everything else. If they are in the pool, they are ready.
          if (activeExternalIds.includes(emp.id) && !isAssignedElsewhere) {
              status = 'POOL_READY';
              priority = 0;
              label = emp.constraints.isExternal ? 'بديل خارجي (مفعل)' : 'داخلي (بنك الاحتياط)';
              details = 'تم تفعيله يدوياً لليوم';
              
              // Only block if busy with an event, otherwise Pool assumes override/availability
              if (isBusyWithEvent) {
                  status = 'BUSY_EVENT'; // Pool member but busy with event
                  priority = 30;
              }
          } 
          else {
              // --- PRIORITY LOGIC FOR EXAMS (Strict Hierarchy) ---
              const isEducator = targetClassId && emp.addons.educator && emp.addons.educatorClassId === targetClassId;
              const isSpecialist = examSubject && emp.subjects.some(s => s.includes(examSubject!));

              if (isExamSlot) {
                  // 1. TOP PRIORITY: Homeroom Teacher (Educator) of THIS class
                  if (isEducator) {
                      if (!isAssignedElsewhere && !isBusyWithEvent) {
                          // PRIORITY 1: HR with Stay (Available)
                          if (baseLesson && baseLesson.type === 'stay') {
                              priority = 1; // High Priority (After Pool)
                              label = 'مربي الصف (تبديل مكوث)';
                              details = `يغطي مكان مكوثه ليكون مع صفه`;
                              status = 'PRIORITY_STAY_SWAP';
                          } 
                          // PRIORITY 2: HR with Individual (Available with Support)
                          else if (baseLesson && baseLesson.type === 'individual') {
                              priority = 2; // High Priority
                              label = 'مربي الصف (دعم فردي)';
                              details = `بحاجة لمساعد ليغطي الفردي`;
                              status = 'PRIORITY_INDIVIDUAL_SUPPORT';
                          }
                          // Standard Available HR
                          else if (!baseLesson) {
                              priority = 1; 
                              label = 'مربي الصف (متوفر)';
                              details = `مسؤول عن ${classes.find(c => c.id === targetClassId)?.name}`;
                          } else {
                              // Busy with Actual Lesson
                              priority = 25; // Blocked but visible
                              status = 'BUSY';
                              label = 'المربي (مشغول بحصة)';
                          }
                      } else {
                          // Educator is busy elsewhere (Conflict!)
                          priority = 30; // Blocked
                          status = 'BUSY_HOMEROOM_CONFLICT';
                          label = 'المربي (مشغول)';
                          details = 'المربي يراقب في مكان آخر!';
                      }
                  }
                  // 2. SECONDARY PRIORITY: Subject Specialist
                  else if (isSpecialist) {
                      if (!isAssignedElsewhere && !isBusyWithEvent) {
                          priority = 3; // High Priority
                          label = 'مراقب (تخصص)';
                          details = `مادة: ${examSubject}`;
                      } else {
                          // Specialist is busy elsewhere
                          priority = 25; // Visible but low priority
                          status = 'BUSY_SPECIALIST';
                          label = 'معلم المادة (محجوز)';
                          details = 'يراقب امتحان شعبة أخرى';
                      }
                  }
                  // 3. PRIORITY 3: SUPPORT PROCTOR (When Subject Teacher is Roaming)
                  else if (isSubjectTeacherRoaming && !isAssignedElsewhere && !isBusyWithEvent && (!baseLesson || isDisplaced)) {
                      priority = 4; // Good Priority
                      label = 'مراقب مساند (لتنقل معلم المادة)';
                      details = `يغطي مكان معلم المادة ليتنقل`;
                      status = 'SUPPORT_PROCTOR';
                  }
              }

              // Fallback priorities if not set by Exam Logic or Pool
              if (priority === 10) { // Still default
                  if (isAssignedElsewhere && status !== 'BUSY_HOMEROOM_CONFLICT' && status !== 'BUSY_SPECIALIST') {
                      status = 'BUSY_COVERAGE';
                      label = 'مشغول (تغطية)';
                      priority = 20;
                      details = 'مكلف بتغطية أخرى';
                  }
                  else if (isBusyWithEvent) {
                      status = 'BUSY_EVENT';
                      label = 'مشغول (فعالية/امتحان)';
                      priority = 30; 
                      details = 'مرتبط بنشاط في الرزنامة';
                  }
                  else if (isDisplaced) {
                      status = 'RELEASED';
                      label = 'متاح (حصة ملغاة)';
                      const clsName = classes.find(c => c.id === baseLesson?.classId)?.name || '';
                      details = `تحرر من ${clsName} (بسبب امتحان)`;
                      priority = 5; 
                  }
                  else if (emp.constraints.isExternal) {
                      // External NOT in active Pool
                      status = 'EXTERNAL_INACTIVE';
                      label = 'خارجي (غير مفعل)';
                      priority = 15;
                  } 
                  else if (!baseLesson) {
                      const empDailyLessons = lessons
                        .filter(l => l.teacherId === emp.id && normalize(l.day) === normalize(dayName))
                        .map(l => l.period)
                        .sort((a,b) => a-b);
                        
                      const firstPeriod = empDailyLessons.length > 0 ? empDailyLessons[0] : null;
                      const lastPeriod = empDailyLessons.length > 0 ? empDailyLessons[empDailyLessons.length - 1] : null;

                      if (firstPeriod === null || period < firstPeriod || period > lastPeriod) {
                          status = 'OFF_DUTY';
                          label = 'خارج الدوام';
                          priority = 99;
                      } else {
                          status = 'FREE';
                          label = 'فراغ (نافذة)';
                          priority = 6;
                      }
                  } else if (baseLesson.type === 'stay') {
                      status = 'STAY';
                      label = `مكوث`;
                      details = baseLesson.subject;
                      priority = 7;
                  } else if (baseLesson.type === 'individual') {
                      status = 'INDIVIDUAL';
                      label = `فردي`;
                      details = baseLesson.subject;
                      priority = 8;
                  } else {
                      if (baseLesson.subject.includes('دعم') || baseLesson.subject.includes('مشترك')) {
                          status = 'SUPPORT';
                          label = `مشترك`;
                          details = baseLesson.subject;
                          priority = 9;
                      } else {
                          status = 'BUSY';
                          label = 'مشغول';
                          const clsName = classes.find(c => c.id === baseLesson.classId)?.name || '';
                          details = `${baseLesson.subject} (${clsName})`;
                          priority = 20;
                      }
                  }
              }
          }

          return { emp, status, label, priority, details };
      }).filter(Boolean) as { emp: Employee, status: string, label: string, priority: number, details: string }[];

      const sorted = allCandidates.sort((a, b) => a.priority - b.priority);

      if (popupFilter === 'RECOMMENDED') {
          // Show recommended AND occupied specialists (to let user see they are busy)
          return sorted.filter(c => c.priority < 15 || c.status.startsWith('BUSY_')); 
      }
      return sorted;
  };

  // ... (Layout Constants & Render Logic same as previous) ...
  const colWidthClass = "min-w-[110px] w-full";
  const cellHeightClass = "h-14";

  const renderLessonCell = (teacherId: number, period: number, isAbsentColumn: boolean) => {
      if (isAbsentColumn) {
          const lesson = lessons.find(l => l.teacherId === teacherId && l.period === period && normalize(l.day) === normalize(dayName));
          if (!lesson) return <div className="flex items-center justify-center h-full w-full opacity-20"><Minus size={12}/></div>;

          const slotKey = `${teacherId}-${period}`;
          const substituteId = assignments[slotKey];
          const substitute = substituteId ? employees.find(e => e.id === substituteId) : null;
          const isUncovered = !substitute;
          
          const baseStyle = isUncovered 
            ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" 
            : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100";

          return (
              <div 
                  onClick={() => setEditingSlot({ tid: teacherId, p: period, lesson })}
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
          const assignmentEntry = Object.entries(assignments).find(([key, subId]) => subId === teacherId && Number(key.split('-')[1]) === period);
          if (assignmentEntry) {
              const absentId = Number(assignmentEntry[0].split('-')[0]);
              const coveredLesson = lessons.find(l => l.teacherId === absentId && l.period === period && normalize(l.day) === normalize(dayName));
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
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnassign(absentId, period); }} className="absolute -top-1 -right-1 p-0.5 bg-white text-rose-500 rounded-full opacity-0 group-hover/cell:opacity-100 transition-all z-20 hover:bg-rose-500 hover:text-white shadow-sm border border-rose-100 cursor-pointer"><X size={10} /></button>
                        )}
                      <span className="text-[9px] font-black truncate w-full text-center mt-1">{classes.find(c => c.id === coveredLesson?.classId)?.name}</span>
                      <span className="text-[7px] font-bold opacity-70 truncate w-full text-center">{isExamTime && !isEducator && !isSpecialist ? 'مراقبة' : 'تغطية'}</span>
                  </div>
              );
          }
          const originalLesson = lessons.find(l => l.teacherId === teacherId && l.period === period && normalize(l.day) === normalize(dayName));
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
                    <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest writing-vertical-rl rotate-180 py-4" style={{writingMode: 'vertical-rl'}}>الغائبون</span>
                </div>
                {absentColumns.map((col, idx) => (
                    <div key={`abs-${idx}`} className={`flex flex-col border-l border-slate-50 ${colWidthClass} group/col`}>
                        <div className="h-14 p-1 text-center border-b border-rose-100 bg-white flex flex-col items-center justify-center gap-0.5 relative group/header sticky top-0 z-10 shadow-sm">
                            <button onClick={() => setBulkAssignTarget(col.id)} className="absolute top-0.5 right-0.5 p-0.5 bg-white text-indigo-500 rounded opacity-0 group-hover/header:opacity-100 transition-all z-[100] hover:bg-indigo-500 hover:text-white shadow-sm border border-indigo-100 cursor-pointer"><BriefcaseBusiness size={10} /></button>
                            {onEditAbsence && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditAbsence(col.id); }} className="absolute top-0.5 left-0.5 p-0.5 bg-white text-slate-400 rounded opacity-0 group-hover/header:opacity-100 transition-all z-[100] hover:text-indigo-600 shadow-sm border border-slate-100 cursor-pointer"><Edit size={10} /></button>}
                            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[9px] font-black">{col.name.charAt(0)}</div>
                            <span className={`font-black text-slate-800 text-[9px] truncate w-full`} title={col.name}>{col.name.split(' ').slice(0,2).join(' ')}</span>
                        </div>
                        {Array.from({length: maxPeriod}).map((_, pIdx) => {
                            const p = pIdx + 1;
                            const mode = getActiveModeForPeriod(p);
                            return (
                                <div key={p} className={`${cellHeightClass} border-b border-slate-100/50 flex items-center justify-center p-0.5 relative group hover:bg-white transition-colors`}>
                                    <span className={`absolute top-0.5 right-0.5 text-[6px] font-mono select-none ${mode ? 'text-indigo-500 font-bold' : 'text-slate-300'}`}>{p} {mode ? '★' : ''}</span>
                                    {renderLessonCell(col.id, p, true)}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
          )}
          {/* LEFT SIDE: SUBSTITUTES */}
          {subColumns.length > 0 && (
            <div className="flex-shrink-0 flex divide-x divide-x-reverse divide-slate-100 bg-emerald-50/10">
                <div className="w-8 bg-emerald-50 border-r border-l border-emerald-100 flex items-center justify-center">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest writing-vertical-rl rotate-180 py-4" style={{writingMode: 'vertical-rl'}}>البدلاء</span>
                </div>
                {subColumns.map((col, idx) => (
                    <div key={`sub-${idx}`} className={`flex flex-col border-l border-slate-50 ${colWidthClass}`}>
                        <div className={`h-14 p-1 text-center border-b ${col.isExternal ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-white'} flex flex-col items-center justify-center gap-0.5 sticky top-0 z-10 shadow-sm`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${col.isExternal ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}>{col.isExternal ? <Briefcase size={10}/> : <User size={10}/>}</div>
                            <span className={`font-black ${col.isExternal ? 'text-amber-800' : 'text-slate-800'} text-[9px] truncate w-full`} title={col.name}>{col.name.split(' ').slice(0,2).join(' ')}</span>
                        </div>
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

       {/* Popups */}
       {editingSlot && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm rounded-[2.5rem] animate-fade-in p-4">
                <div className="bg-white p-4 rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-sm animate-scale-up">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                        <div>
                            <h5 className="font-black text-slate-800 text-xs flex items-center gap-1"><BriefcaseBusiness size={14} className="text-indigo-600"/> تعيين بديل لكامل اليوم</h5>
                            <p className="text-[9px] text-slate-500 font-bold mt-0.5">للمعلم: {employees.find(e => e.id === bulkAssignTarget)?.name}</p>
                        </div>
                        <button onClick={() => setBulkAssignTarget(null)} className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all"><X size={14}/></button>
                    </div>
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">بنك الاحتياط اليومي (Pool)</p>
                        {poolCandidates.length > 0 ? poolCandidates.map(cand => (
                             <button
                                key={cand.id}
                                onClick={() => { onBulkAssign(bulkAssignTarget, cand.id); setBulkAssignTarget(null); }}
                                className="w-full p-2 rounded-xl border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-all flex items-center gap-3 group"
                             >
                                <div className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center font-black text-xs shadow-sm">{cand.name.charAt(0)}</div>
                                <div className="text-right">
                                    <p className="font-black text-[10px] text-slate-800">{cand.name}</p>
                                    <p className="text-[8px] font-bold text-slate-500">{cand.constraints.isExternal ? 'بديل خارجي' : 'احتياط داخلي'}</p>
                                </div>
                                <Check size={14} className="mr-auto text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"/>
                             </button>
                        )) : (
                            <div className="text-center py-4 text-slate-400 text-[10px] font-bold italic border border-dashed border-slate-200 rounded-xl">
                                لا يوجد بدلاء في بنك الاحتياط اليوم
                            </div>
                        )}
                    </div>
                </div>
            </div>
       )}
    </div>
  );
};

export default GroupAbsenceBoard;
