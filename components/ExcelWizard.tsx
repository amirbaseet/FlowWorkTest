
import React, { useState, useMemo } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, ShieldAlert, ArrowLeft, RotateCcw, Save, Loader2, Database, AlertCircle, FileWarning, Eye, BrainCircuit, Info, Users, Calendar, Link2, Trash2 } from 'lucide-react';
import { parseSchoolData, WizardPayload } from '../utils/excelWizardParser';
import { useToast } from '../contexts/ToastContext';
import { Employee, ClassItem, Lesson, ScheduleConfig } from '../types';
import { normalizeArabic, detectGradeFromTitle } from '../utils';

interface ExcelWizardProps {
  onClose: () => void;
  // Setters from App
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  setClasses: React.Dispatch<React.SetStateAction<ClassItem[]>>;
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  // Schedule Config
  scheduleConfig?: ScheduleConfig;
  setScheduleConfig?: React.Dispatch<React.SetStateAction<ScheduleConfig>>;
  // Current state for Backup
  currentEmployees: Employee[];
  currentClasses: ClassItem[];
  currentLessons: Lesson[];
}

const ExcelWizard: React.FC<ExcelWizardProps> = ({ 
  onClose, setEmployees, setClasses, setLessons, 
  scheduleConfig, setScheduleConfig,
  currentEmployees, currentClasses, currentLessons 
}) => {
  const { addToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<WizardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Separate state for files
  const [teachersFile, setTeachersFile] = useState<File | null>(null);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);

  const handleProcessFiles = async () => {
    if (!scheduleFile) {
        setError("يجب رفع ملف الجدول الدراسي على الأقل للمتابعة.");
        return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Pass both files to the parser
      const result = await parseSchoolData(teachersFile, scheduleFile);
      setPayload(result);
      setStep(2);
    } catch (err: any) {
      setError(err?.toString() || "فشل في تحليل الملفات");
    } finally {
      setLoading(false);
    }
  };

  const applyChanges = () => {
    if (!payload) return;

    // 1. Backup
    const backup = {
      employees: currentEmployees,
      classes: currentClasses,
      lessons: currentLessons,
      timestamp: Date.now()
    };
    localStorage.setItem('classflow_backup_last_import', JSON.stringify(backup));

    // 2. Sync Schedule Config (Periods Count)
    if (scheduleConfig && setScheduleConfig && payload.schoolStats.periodCount > 0) {
       // Only update if import has MORE periods, or if we want strict sync
       // Here we force sync to match imported structure
       if (payload.schoolStats.periodCount !== scheduleConfig.periodsPerDay) {
           setScheduleConfig(prev => ({
               ...prev,
               periodsPerDay: payload.schoolStats.periodCount
           }));
           addToast(`تم تحديث هيكلية اليوم إلى ${payload.schoolStats.periodCount} حصص`, "info");
       }
    }

    // 3. Merge Employees
    const nextEmployees = [...currentEmployees];
    payload.teachers.forEach((wt, idx) => {
      // Use normalization to find existing employee to avoid duplicates
      const existingIdx = nextEmployees.findIndex(e => normalizeArabic(e.name) === normalizeArabic(wt.name));
      
      // Determine subjects (merge existing with new detected ones if needed, or overwrite)
      const existingSubjects = existingIdx > -1 ? nextEmployees[existingIdx].subjects : [];
      // Combine detected subjects with any manually entered subjects, ensuring uniqueness
      const finalSubjects = Array.from(new Set([...existingSubjects, ...wt.detectedSubjects]));

      if (existingIdx > -1) {
        // Update existing
        nextEmployees[existingIdx] = {
          ...nextEmployees[existingIdx],
          nationalId: wt.nationalId || nextEmployees[existingIdx].nationalId, // Update ID if found in new file
          phoneNumber: wt.phoneNumber || nextEmployees[existingIdx].phoneNumber,
          contractedHours: wt.declaredWeeklyTotal || wt.computed.total, // Prefer declared from HR file
          workload: {
            actual: wt.computed.actual,
            individual: wt.computed.individual,
            stay: wt.computed.stay
          },
          addons: { ...nextEmployees[existingIdx].addons, educator: wt.role === 'homeroom' },
          constraints: { ...nextEmployees[existingIdx].constraints, isExternal: wt.role === 'external-sub' },
          subjects: finalSubjects
        };
      } else {
        // Create new - Generate INTEGER ID
        nextEmployees.push({
          id: Math.floor(Date.now() + Math.random() * 10000) + idx, // Ensure integer ID
          name: wt.name,
          nationalId: wt.nationalId || String(Date.now()).slice(-9),
          phoneNumber: wt.phoneNumber,
          baseRoleId: 'teachers',
          contractedHours: wt.declaredWeeklyTotal || wt.computed.total,
          workload: { actual: wt.computed.actual, individual: wt.computed.individual, stay: wt.computed.stay },
          addons: { educator: wt.role === 'homeroom', coordinators: [] },
          constraints: { cannotCoverAlone: false, isExternal: wt.role === 'external-sub' },
          subjects: finalSubjects
        });
      }
    });

    // 4. Merge Classes
    const nextClasses = [...currentClasses];
    payload.classes.forEach(wc => {
      const exists = nextClasses.find(c => c.name === wc.key);
      if (!exists) {
        // DETECT GRADE FROM TITLE FOR BETTER GROUPING
        const detectedGrade = detectGradeFromTitle(wc.displayName);
        
        nextClasses.push({
          id: wc.key,
          name: wc.displayName,
          gradeLevel: detectedGrade > 0 ? detectedGrade : 1, // Default to 1 only if detection fails
          type: 'general',
          requiresAssistant: detectedGrade > 0 && detectedGrade <= 3 // Smart assistant rule
        });
      }
    });

    // 5. Merge Entries (Lessons)
    const importedClassKeys = new Set(payload.classes.map(c => c.key));
    // Remove old lessons ONLY for the classes being imported to avoid duplicates, keep others
    let nextLessons = currentLessons.filter(l => {
      const cls = nextClasses.find(c => c.id === l.classId);
      return !cls || !importedClassKeys.has(cls.name);
    });

    payload.entries.forEach(entry => {
      const cls = nextClasses.find(c => c.name === entry.classKey);
      // Use normalization to find teacher
      const teacher = nextEmployees.find(e => normalizeArabic(e.name) === normalizeArabic(entry.teacherName));
      
      // IMPORTANT: STAY/INDIVIDUAL/DUTY lessons might not have a valid class (NO_CLASS key)
      // We allow them if the teacher is found.
      const isStayOrInd = entry.lessonType === 'STAY' || entry.lessonType === 'INDIVIDUAL' || entry.lessonType === 'DUTY' || entry.classKey === 'NO_CLASS';

      if ((cls || isStayOrInd) && teacher) {
        nextLessons.push({
          id: `IMP-${Date.now()}-${Math.random()}`,
          classId: cls ? cls.id : "", // Empty classId for non-class lessons
          teacherId: teacher.id,
          day: entry.day,
          period: entry.period,
          subject: entry.subject,
          type: entry.lessonType === 'STAY' ? 'stay' : entry.lessonType === 'INDIVIDUAL' ? 'individual' : entry.lessonType === 'DUTY' ? 'duty' : 'actual'
        });
      }
    });

    // Link Educators
    payload.classes.forEach(wc => {
      if (wc.homeroomTeacherName) {
        const tIdx = nextEmployees.findIndex(e => normalizeArabic(e.name) === normalizeArabic(wc.homeroomTeacherName || ''));
        const c = nextClasses.find(cl => cl.name === wc.key);
        if (tIdx > -1 && c) {
          nextEmployees[tIdx].addons.educator = true;
          nextEmployees[tIdx].addons.educatorClassId = c.id;
        }
      }
    });

    setEmployees(nextEmployees);
    setClasses(nextClasses);
    setLessons(nextLessons);
    
    setStep(3);
    addToast("تم استيراد البيانات وتحديث النظام بنجاح");
  };

  const classificationStats = useMemo(() => {
      if (!payload) return { actual: 0, stay: 0, individual: 0, duty: 0 };
      let actual = 0, stay = 0, individual = 0, duty = 0;
      payload.entries.forEach(e => {
          if (e.lessonType === 'ACTUAL') actual++;
          else if (e.lessonType === 'STAY') stay++;
          else if (e.lessonType === 'INDIVIDUAL') individual++;
          else if (e.lessonType === 'DUTY') duty++;
      });
      return { actual, stay, individual, duty };
  }, [payload]);

  // Helper to find class assigned to a teacher based on parsed classes
  const findAssignedClass = (teacherName: string) => {
      if (!payload) return null;
      const foundClass = payload.classes.find(c => normalizeArabic(c.homeroomTeacherName || '') === normalizeArabic(teacherName));
      return foundClass ? foundClass.displayName : null;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="bg-slate-50 w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10">
        
        {/* Header */}
        <div className="p-8 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <Database size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">معالج دمج البيانات الذكي</h2>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Smart Data Fusion Wizard v4.0</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
          {step === 1 && (
            <div className="flex flex-col h-full space-y-8">
               <div className="text-center max-w-2xl mx-auto space-y-4">
                  <h3 className="text-2xl font-black text-slate-800">تغذية النظام بالبيانات (Dual Ingestion)</h3>
                  <p className="text-sm font-bold text-slate-500 leading-relaxed">
                    للحصول على أفضل النتائج، يفضل رفع ملف المعلمين (HR) وملف الجدول الدراسي (Matrix) معاً. سيقوم النظام بدمج البيانات وتحديث الهيكلية الزمنية تلقائياً.
                  </p>
               </div>

               {error && (
                 <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl flex items-center gap-3 max-w-lg mx-auto">
                    <AlertCircle size={20} />
                    <span className="font-bold text-sm">{error}</span>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
                  {/* Teachers File Upload */}
                  <div className={`p-8 rounded-[2.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-4 relative group ${teachersFile ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                      <div className={`p-4 rounded-full shadow-sm ${teachersFile ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <Users size={32} />
                      </div>
                      <div>
                          <h4 className="font-black text-slate-800 text-lg">ملف المعلمين (اختياري)</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">يحتوي على: الأسماء، الهويات، الوظائف، أرقام الهواتف</p>
                      </div>
                      
                      {teachersFile ? (
                          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-indigo-100">
                              <span className="text-xs font-bold text-indigo-700 truncate max-w-[150px]">{teachersFile.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); setTeachersFile(null); }} className="text-rose-500 hover:text-rose-700"><Trash2 size={14}/></button>
                          </div>
                      ) : (
                          <label className="absolute inset-0 cursor-pointer">
                              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => setTeachersFile(e.target.files?.[0] || null)} disabled={loading} />
                          </label>
                      )}
                      {!teachersFile && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg pointer-events-none">اضغط لرفع ملف HR</span>}
                  </div>

                  {/* Schedule File Upload */}
                  <div className={`p-8 rounded-[2.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-4 relative group ${scheduleFile ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                      <div className={`p-4 rounded-full shadow-sm ${scheduleFile ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <Calendar size={32} />
                      </div>
                      <div>
                          <h4 className="font-black text-slate-800 text-lg">ملف الجدول الدراسي (مطلوب)</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">يحتوي على: المصفوفة الزمنية، الشعب، توزيع الحصص</p>
                      </div>

                      {scheduleFile ? (
                          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-emerald-100">
                              <span className="text-xs font-bold text-emerald-700 truncate max-w-[150px]">{scheduleFile.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); setScheduleFile(null); }} className="text-rose-500 hover:text-rose-700"><Trash2 size={14}/></button>
                          </div>
                      ) : (
                          <label className="absolute inset-0 cursor-pointer">
                              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => setScheduleFile(e.target.files?.[0] || null)} disabled={loading} />
                          </label>
                      )}
                      {!scheduleFile && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg pointer-events-none">اضغط لرفع ملف المصفوفة</span>}
                  </div>
               </div>

               <div className="flex justify-center pt-8">
                   {loading ? (
                       <div className="flex flex-col items-center gap-4 animate-pulse">
                           <Loader2 size={48} className="text-indigo-600 animate-spin" />
                           <span className="font-black text-indigo-900">جاري دمج وتحليل البيانات...</span>
                       </div>
                   ) : (
                       <button 
                           onClick={handleProcessFiles}
                           disabled={!scheduleFile}
                           className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black text-sm shadow-2xl hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-4 btn-press"
                       >
                           <Link2 size={20} /> بدء عملية الدمج والتحليل
                       </button>
                   )}
               </div>
            </div>
          )}

          {step === 2 && payload && (
            <div className="space-y-10 animate-slide-up">
               {/* Stats Overview */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 text-center">
                     <span className="block text-3xl font-black text-indigo-600 mb-1">{payload.schoolStats.teacherCount}</span>
                     <span className="text-[10px] font-black text-slate-400 uppercase">معلم تم رصده</span>
                  </div>
                  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 text-center">
                     <span className="block text-3xl font-black text-emerald-600 mb-1">{payload.schoolStats.classCount}</span>
                     <span className="text-[10px] font-black text-slate-400 uppercase">شعبة دراسية</span>
                  </div>
                  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 text-center">
                     <span className="block text-3xl font-black text-amber-600 mb-1">{payload.schoolStats.entryCount}</span>
                     <span className="text-[10px] font-black text-slate-400 uppercase">حصة مجدولة</span>
                  </div>
                  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 text-center">
                     <span className="block text-3xl font-black text-slate-700 mb-1">{payload.schoolStats.periodCount}</span>
                     <span className="text-[10px] font-black text-slate-400 uppercase">فترات يومية</span>
                  </div>
               </div>

               {/* Classification Breakdown */}
               <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8">
                  <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600"><BrainCircuit size={32}/></div>
                  <div className="flex-1 space-y-4 w-full">
                     <div className="flex justify-between items-end">
                        <h4 className="font-black text-slate-800">تصنيف الحصص (Strict Policy)</h4>
                        <span className="text-xs font-bold text-slate-400">Total: {payload.schoolStats.entryCount}</span>
                     </div>
                     <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-indigo-500" style={{ width: `${(classificationStats.actual / payload.schoolStats.entryCount) * 100}%` }} title={`Actual: ${classificationStats.actual}`}></div>
                        <div className="h-full bg-amber-500" style={{ width: `${(classificationStats.stay / payload.schoolStats.entryCount) * 100}%` }} title={`Stay: ${classificationStats.stay}`}></div>
                        <div className="h-full bg-emerald-500" style={{ width: `${(classificationStats.individual / payload.schoolStats.entryCount) * 100}%` }} title={`Individual: ${classificationStats.individual}`}></div>
                        <div className="h-full bg-slate-400" style={{ width: `${(classificationStats.duty / payload.schoolStats.entryCount) * 100}%` }} title={`Duty: ${classificationStats.duty}`}></div>
                     </div>
                     <div className="flex gap-4 text-[10px] font-bold flex-wrap">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> فعلي ({classificationStats.actual})</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> مكوث ({classificationStats.stay})</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> فردي ({classificationStats.individual})</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400"></div> مناوبة (خارج النصاب) ({classificationStats.duty})</span>
                     </div>
                  </div>
               </div>

               {/* ERRORS & WARNINGS SECTION */}
               {(payload.errors.cellErrors.length > 0 || payload.errors.sheetErrors.length > 0) && (
                  <div className="space-y-4 animate-pulse-slow">
                     <h4 className="font-black text-rose-600 flex items-center gap-2"><ShieldAlert size={20}/> أخطاء حرجة تمنع الاستيراد المثالي</h4>
                     
                     {payload.errors.sheetErrors.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-6">
                           <h5 className="font-bold text-rose-800 mb-2 flex items-center gap-2"><FileWarning size={16}/> أخطاء في الصفحات ({payload.errors.sheetErrors.length})</h5>
                           <ul className="list-disc list-inside space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                              {payload.errors.sheetErrors.map((err, i) => (
                                 <li key={i} className="text-xs text-rose-700 font-medium">{err}</li>
                              ))}
                           </ul>
                        </div>
                     )}

                     {payload.errors.cellErrors.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-6">
                           <h5 className="font-bold text-rose-800 mb-2 flex items-center gap-2"><AlertTriangle size={16}/> أخطاء تنسيق الخلايا ({payload.errors.cellErrors.length})</h5>
                           <p className="text-[10px] text-rose-500 font-bold mb-3">الخلايا يجب أن تحتوي على سطرين: (المادة) ثم (المعلم). الأسطر الزائدة أو الناقصة تسبب هذا الخطأ.</p>
                           <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                              {payload.errors.cellErrors.map((err, i) => (
                                 <li key={i} className="text-xs text-rose-700 font-mono bg-white/50 p-2 rounded-lg border border-rose-100">{err}</li>
                              ))}
                           </ul>
                        </div>
                     )}
                  </div>
               )}

               {/* Warnings */}
               {payload.errors.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6">
                     <h5 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><Info size={16}/> تحذيرات غير حرجة ({payload.errors.warnings.length})</h5>
                     <ul className="list-disc list-inside space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {payload.errors.warnings.map((warn, i) => (
                           <li key={i} className="text-xs text-amber-700 font-medium">{warn}</li>
                        ))}
                     </ul>
                  </div>
               )}

               {/* Teacher Table with Diagnostics */}
               <div className="space-y-4">
                  <h5 className="font-black text-slate-700 flex items-center gap-2"><Database size={18}/> تحليل المعلمين المتقدم</h5>
                  <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden max-h-60 overflow-y-auto custom-scrollbar shadow-inner">
                     <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 font-black text-slate-500 sticky top-0 z-10">
                           <tr>
                              <th className="p-4">اسم المعلم</th>
                              <th className="p-4">الهوية (المكتشفة)</th>
                              <th className="p-4">حالة المربي</th>
                              <th className="p-4">أوراق مدمجة</th>
                              <th className="p-4">تكرار محذوف</th>
                              <th className="p-4">الإشغال</th>
                           </tr>
                        </thead>
                        <tbody className="text-slate-700 font-bold divide-y divide-slate-50">
                           {payload.teachers.slice(0, 30).map((t, i) => {
                              const assignedClass = findAssignedClass(t.name);
                              return (
                                <tr key={i} className="hover:bg-slate-50/50">
                                   <td className="p-4 text-indigo-700">{t.name}</td>
                                   <td className="p-4 font-mono">{t.nationalId || '-'}</td>
                                   <td className="p-4">
                                      {t.role === 'homeroom' || assignedClass ? (
                                          <span className="bg-violet-100 text-violet-700 px-2 py-1 rounded text-[9px] font-black">
                                              {assignedClass || 'مربي'}
                                          </span>
                                      ) : (
                                          <span className="text-slate-300">-</span>
                                      )}
                                   </td>
                                   <td className="p-4">{t.diagnostics?.mergedSheetsCount || 1}</td>
                                   <td className="p-4">{t.diagnostics?.duplicatesCount || 0}</td>
                                   <td className="p-4 text-[9px] text-slate-500">
                                      A: {t.computed.actual} | S: {t.computed.stay} | I: {t.computed.individual}
                                   </td>
                                </tr>
                              )
                           })}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
          )}

          {step === 3 && (
             <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                   <CheckCircle2 size={64} />
                </div>
                <h3 className="text-3xl font-black text-slate-800">تم الاستيراد بنجاح!</h3>
                <p className="text-slate-500 font-bold max-w-md">تم تحديث قاعدة البيانات المركزية. يمكنك الآن إدارة الجدول والإشغال بناءً على البيانات الجديدة.</p>
                <button onClick={onClose} className="bg-slate-900 text-white px-10 py-4 rounded-[2rem] font-black text-sm shadow-xl hover:bg-slate-800 transition-all">العودة للرئيسية</button>
             </div>
          )}
        </div>

        {/* Footer Actions */}
        {step === 2 && (
           <div className="p-8 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all">
                 <ArrowLeft size={18} /> إعادة الرفع
              </button>
              <button 
                 onClick={applyChanges} 
                 disabled={payload?.errors.cellErrors.length !== 0 || payload?.schoolStats.entryCount === 0}
                 className="bg-indigo-600 text-white px-10 py-4 rounded-[2rem] font-black text-sm shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                 <Save size={18} /> اعتماد البيانات وتحديث النظام
              </button>
           </div>
        )}
      </div>
    </div>
  );
};

export default ExcelWizard;
