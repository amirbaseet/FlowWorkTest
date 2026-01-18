
import React, { useMemo } from 'react';
import { 
  X, Plus, Users, User, ChevronDown, MessageCircle, Settings2, CheckCircle2, Bell, 
  ArrowRightLeft, Coffee, GraduationCap, Target, FileText, Calendar as CalendarIcon, 
  Clock, ChevronsLeft, ChevronsRight, Info, Zap, Layers, Maximize, CheckSquare, BrainCircuit,
  Briefcase, BookOpen, AlertTriangle
} from 'lucide-react';
import { Employee, ClassItem, CalendarEvent, BreakMergeStrategy } from '../types';
import { GRADES_AR } from '../constants';
import { detectGradeFromTitle } from '../utils';

interface UnifiedEventFormProps {
  data: {
    title: string;
    date: string;
    type: 'ACTIVITY' | 'EXAM' | 'TRIP' | 'ADMIN' | 'OTHER' | 'RAINY' | 'EMERGENCY' | 'HOLIDAY';
    description: string;
    targetClassIds: string[];
    targetPeriods: number[];
    targetBreaks: number[];
    partners: { id: string; userIds: string[]; expectations: string }[];
    opAction: 'internal' | 'merge' | 'none';
    mergeStrategy: BreakMergeStrategy;
  };
  setData: (data: any) => void;
  employees: Employee[];
  classes: ClassItem[];
  onCancel: () => void;
  onSave: () => void;
  titlePrefix?: string;
  enableSmartMode: boolean;
  setEnableSmartMode: (val: boolean) => void;
  isEditing?: boolean;
  children?: React.ReactNode;
}

const UnifiedEventForm: React.FC<UnifiedEventFormProps> = ({ 
  data, setData, employees, classes, onCancel, onSave, titlePrefix = "إنشاء فعالية ذكية",
  enableSmartMode, setEnableSmartMode, isEditing = false, children
}) => {
  const updateData = (updates: any) => setData((prev: any) => ({ ...prev, ...updates }));
  
  const addPartner = () => updateData({ partners: [...data.partners, { id: Date.now().toString(), userIds: [], expectations: '' }] });
  
  const removePartner = (id: string) => updateData({ partners: data.partners.filter(p => p.id !== id) });
  
  const updatePartner = (id: string, updates: any) => updateData({ partners: data.partners.map(p => p.id === id ? { ...p, ...updates } : p) });

  const addUserToPartner = (partnerId: string, userId: string) => {
      const partner = data.partners.find(p => p.id === partnerId);
      if (partner && !partner.userIds.includes(userId)) {
          updatePartner(partnerId, { userIds: [...partner.userIds, userId] });
      }
  };

  const removeUserFromPartner = (partnerId: string, userId: string) => {
      const partner = data.partners.find(p => p.id === partnerId);
      if (partner) {
          updatePartner(partnerId, { userIds: partner.userIds.filter(id => id !== userId) });
      }
  };

  // --- Bulk Group Logic ---
  const allSubjects = useMemo(() => {
      const subjects = new Set<string>();
      employees.forEach(e => e.subjects?.forEach(s => subjects.add(s)));
      return Array.from(subjects).sort();
  }, [employees]);

  const addGroupToPartner = (partnerId: string, criteria: string) => {
      const partner = data.partners.find(p => p.id === partnerId);
      if (!partner) return;

      let targetEmployees: Employee[] = [];

      if (criteria === 'educators') {
          targetEmployees = employees.filter(e => e.addons.educator);
      } else if (criteria === 'coordinators') {
          targetEmployees = employees.filter(e => e.baseRoleId === 'coordinator' || (e.addons.coordinators && e.addons.coordinators.length > 0));
      } else if (criteria === 'management') {
          targetEmployees = employees.filter(e => ['principal', 'vice_principal'].includes(e.baseRoleId));
      } else if (criteria.startsWith('subj_')) {
          const subj = criteria.replace('subj_', '');
          targetEmployees = employees.filter(e => e.subjects.includes(subj));
      }

      const newIds = targetEmployees.map(e => String(e.id));
      // Merge and remove duplicates
      const mergedIds = [...new Set([...partner.userIds, ...newIds])];
      updatePartner(partnerId, { userIds: mergedIds });
  };

  // --- Compute Active Grades (Strictly Name Based) ---
  const activeGrades = useMemo(() => {
    const grades = new Set<number>();
    classes.forEach(c => {
        const g = detectGradeFromTitle(c.name);
        if (!isNaN(g) && g > 0) grades.add(g);
    });
    return Array.from(grades).sort((a, b) => a - b);
  }, [classes]);

  // --- Sorted Classes for Display ---
  const sortedClasses = useMemo(() => {
      return [...classes].sort((a, b) => {
          const gA = detectGradeFromTitle(a.name);
          const gB = detectGradeFromTitle(b.name);
          
          if (gA !== gB) return gA - gB;
          return a.name.localeCompare(b.name, 'ar');
      });
  }, [classes]);

  // --- Bulk Selection Logic ---
  const handleSelectAll = () => {
    if (data.targetClassIds.length === classes.length) {
      updateData({ targetClassIds: [] }); // Deselect all
    } else {
      updateData({ targetClassIds: classes.map(c => c.id) }); // Select all
    }
  };

  const handleSelectGrade = (gradeLevel: number) => {
    // 1. Identify all class IDs belonging to this SPECIFIC grade (Detected)
    const gradeClassIds = classes
        .filter(c => detectGradeFromTitle(c.name) === gradeLevel)
        .map(c => c.id);
    
    if (gradeClassIds.length === 0) return;

    // 2. Check if all of THEM are currently selected
    const allSelected = gradeClassIds.every(id => data.targetClassIds.includes(id));
    
    let newIds = [...data.targetClassIds];
    
    if (allSelected) {
      // Toggle OFF: Remove only these IDs
      newIds = newIds.filter(id => !gradeClassIds.includes(id));
    } else {
      // Toggle ON: Add missing IDs from this grade
      gradeClassIds.forEach(id => {
        if (!newIds.includes(id)) newIds.push(id);
      });
    }
    
    updateData({ targetClassIds: newIds });
  };

  const getRecommendation = (actionId: string) => {
      if (data.type === 'EXAM' && actionId === 'none') return true;
      if (data.type === 'ACTIVITY' && actionId === 'internal') return true;
      if (data.type === 'TRIP' && actionId === 'none') return true;
      if (data.type === 'RAINY' && actionId === 'internal') return true;
      return false;
  };

  return (
    <div className="bg-white w-full max-w-6xl rounded-[3rem] md:rounded-[4rem] shadow-2xl flex flex-col border border-white/20 animate-scale-up overflow-hidden max-h-[95vh]" dir="rtl">
       <div className="p-6 md:p-10 border-b border-slate-100 flex justify-between bg-slate-50/50 items-center shrink-0">
          <div>
            <h3 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900">{isEditing ? 'تعديل الفعالية' : titlePrefix}</h3>
            <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 md:mt-2 uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} className="text-indigo-500" /> البروتوكول الموحد للتنسيق
            </p>
          </div>
          <button onClick={onCancel} className="p-3 md:p-4 bg-white text-slate-300 hover:text-rose-600 rounded-[2rem] transition-all shadow-sm active:scale-90"><X size={24} /></button>
       </div>
       
       <div className="p-6 md:p-10 grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-12 overflow-y-auto custom-scrollbar flex-1">
          <div className="xl:col-span-4 space-y-6 md:space-y-10">
              <div className="space-y-3"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mr-3">مسمى الفعالية والهدف</label><input className="w-full p-4 md:p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-lg md:text-xl text-slate-800 shadow-inner outline-none focus:bg-white focus:border-indigo-500 transition-all" value={data.title} onChange={e => updateData({ title: e.target.value })} placeholder="اسم النشاط..." /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div className="space-y-3"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mr-3">التاريخ</label><input type="date" className="w-full p-4 md:p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-slate-800 shadow-inner outline-none focus:bg-white" value={data.date} onChange={e => updateData({ date: e.target.value })} /></div>
                 <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mr-3">التصنيف (النمط)</label>
                    <select className="w-full p-4 md:p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-slate-800 shadow-inner outline-none cursor-pointer" value={data.type} onChange={e => updateData({ type: e.target.value })}>
                        <option value="EXAM">امتحانات</option>
                        <option value="TRIP">رحلة تعليمية</option>
                        <option value="ACTIVITY">نشاط مدرسي</option>
                        <option value="RAINY">يوم ماطر (بروتوكول شتوي)</option>
                        <option value="EMERGENCY">حالة طوارئ</option>
                        <option value="HOLIDAY">عطلة / مناسبة</option>
                        <option value="ADMIN">إداري / اجتماع</option>
                        <option value="OTHER">آخر</option>
                    </select>
                 </div>
              </div>
              
              {/* SMART MODE TOGGLE */}
              <div className={`p-4 md:p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between cursor-pointer ${enableSmartMode ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`} onClick={() => setEnableSmartMode(!enableSmartMode)}>
                 <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${enableSmartMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}><BrainCircuit size={20}/></div>
                    <div>
                       <span className={`font-black text-sm block ${enableSmartMode ? 'text-indigo-900' : 'text-slate-500'}`}>تفعيل الأنماط الذكية</span>
                       <span className="text-[9px] font-bold text-slate-400">تطبيق قواعد {data.type === 'EXAM' ? 'المراقبة' : data.type === 'TRIP' ? 'المرافقة' : data.type === 'RAINY' ? 'المناوبة الداخلية' : 'الإشغال'} تلقائياً</span>
                    </div>
                 </div>
                 <div className={`w-12 h-7 rounded-full p-1 transition-all ${enableSmartMode ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${enableSmartMode ? '-translate-x-5' : 'translate-x-0'}`}></div>
                 </div>
              </div>

              <div className="space-y-3"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mr-3">التعليمات اللوجستية</label><textarea className="w-full p-4 md:p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-medium text-slate-700 min-h-[120px] shadow-inner outline-none focus:bg-white" value={data.description} onChange={e => updateData({ description: e.target.value })} placeholder="ما هو مطلوب من الطاقم..." /></div>
          </div>

          <div className="xl:col-span-8 space-y-8 md:space-y-12">
             <div className="bg-slate-50 p-6 md:p-12 rounded-[3rem] border border-slate-100 shadow-inner space-y-8 md:space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                   <div className="space-y-4">
                      <div className="flex justify-between items-center mr-2">
                         <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">نطاق الاستهداف (الصفوف)</label>
                         <button onClick={handleSelectAll} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-all">
                            {data.targetClassIds.length === classes.length && classes.length > 0 ? 'إلغاء الكل' : 'تحديد الكل'}
                         </button>
                      </div>
                      
                      {/* Grade Level Quick Select */}
                      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                         {activeGrades.map((gradeLevel) => {
                            const gradeName = GRADES_AR[gradeLevel - 1] || `Grade ${gradeLevel}`;
                            const gradeClassIds = classes
                                .filter(c => detectGradeFromTitle(c.name) === gradeLevel)
                                .map(c => c.id);
                            const isGradeSelected = gradeClassIds.length > 0 && gradeClassIds.every(id => data.targetClassIds.includes(id));
                            
                            return (
                               <button 
                                 key={gradeLevel} 
                                 onClick={() => handleSelectGrade(gradeLevel)}
                                 className={`px-3 py-1.5 rounded-xl text-[9px] font-black whitespace-nowrap border transition-all ${isGradeSelected ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                               >
                                 {gradeName}
                               </button>
                            )
                         })}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm custom-scrollbar">
                        {sortedClasses.length > 0 ? sortedClasses.map(c => {
                          const isS = data.targetClassIds.includes(c.id);
                          return (<button key={c.id} onClick={() => updateData({ targetClassIds: isS ? data.targetClassIds.filter(id => id !== c.id) : [...data.targetClassIds, c.id] })} className={`px-2 py-3 rounded-xl text-[10px] font-black transition-all border btn-press truncate ${isS ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 border-transparent text-slate-400'}`}>{c.name}</button>);
                        }) : (
                            <div className="col-span-full text-center text-slate-400 text-xs font-bold py-10 italic">لا توجد صفوف معرفة في النظام</div>
                        )}
                      </div>
                   </div>
                   <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mr-4">الحصص المتأثرة</label>
                        <div className="flex flex-wrap gap-2.5 p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                          {[1,2,3,4,5,6,7,8].map(p => (
                            <button key={p} onClick={() => { const isS = data.targetPeriods.includes(p); updateData({ targetPeriods: isS ? data.targetPeriods.filter(x => x !== p) : [...data.targetPeriods, p] }); }} className={`w-10 h-10 rounded-xl font-black text-sm transition-all border btn-press ${data.targetPeriods.includes(p) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{p}</button>
                          ))}
                        </div>
                      </div>
                   </div>
                </div>

                {/* --- RESTORED SECTION: OPERATIONAL ADAPTATION --- */}
                <div className="pt-8 md:pt-12 border-t border-slate-200 space-y-6 md:space-y-8 animate-fade-in">
                    <div className="flex items-center gap-3 mb-4 mr-4">
                        <label className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">التكييف التشغيلي للجدول (نمط الدوام)</label>
                        {data.type && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[8px] font-bold">بناءً على: {data.type === 'EXAM' ? 'امتحان' : data.type === 'TRIP' ? 'رحلة' : 'نشاط'}</span>}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                        {[
                            { id: 'none', label: 'بدون تكييف (اعتيادي)', icon: CheckCircle2, desc: 'الجدول يبقى كما هو مع تبديل المعلمين.' },
                            { id: 'internal', label: 'استراحة داخلية', icon: Bell, desc: 'إلغاء خروج الطلاب للساحات (طقس/فعالية).' },
                            { id: 'merge', label: 'دمج استراحات', icon: ArrowRightLeft, desc: 'تغيير أوقات الأجراس ودمج الفسح.' }
                        ].map(action => {
                            const isRecommended = getRecommendation(action.id);
                            return (
                                <button key={action.id} onClick={() => updateData({ opAction: action.id })} className={`p-6 md:p-8 rounded-[2.5rem] border-2 transition-all font-black text-sm flex flex-col items-center gap-3 md:gap-4 text-center btn-press relative overflow-hidden ${data.opAction === action.id ? `bg-white border-indigo-600 text-indigo-600 shadow-xl ring-4 ring-slate-100` : 'bg-white border-slate-100 text-slate-400'}`}>
                                {isRecommended && <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[8px] px-2 py-0.5 rounded-br-lg font-bold shadow-sm">موصى به</div>}
                                <action.icon size={28} className={data.opAction === action.id ? 'text-indigo-600' : isRecommended ? 'text-emerald-500' : 'text-slate-300'} /> 
                                <div>
                                    <span>{action.label}</span>
                                    <p className="text-[9px] font-bold opacity-60 mt-1">{action.desc}</p>
                                </div>
                                </button>
                            )
                        })}
                    </div>
                    
                    {data.opAction === 'merge' && (
                        <div className="bg-amber-50/50 p-6 md:p-8 rounded-[2.5rem] border border-amber-200 space-y-6 animate-slide-down">
                            <h5 className="text-[10px] font-black text-amber-600 flex items-center gap-2"><AlertTriangle size={14}/> خيارات الدمج</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <button onClick={() => updateData({ mergeStrategy: 'advance_second' })} className={`p-6 rounded-3xl border-2 transition-all flex flex-col gap-3 text-right btn-press ${data.mergeStrategy === 'advance_second' ? 'bg-white border-amber-500 shadow-lg' : 'bg-white/50 border-slate-200 text-slate-400'}`}><span className="font-black text-xs">تقديم الاستراحة الثانية</span><p className="text-[10px] font-bold opacity-70">يتم إلغاء الاستراحات المتأخرة وجمع وقتها في الأولى.</p></button>
                            <button onClick={() => updateData({ mergeStrategy: 'delay_first' })} className={`p-6 rounded-3xl border-2 transition-all flex flex-col gap-3 text-right btn-press ${data.mergeStrategy === 'delay_first' ? 'bg-white border-amber-500 shadow-lg' : 'bg-white/50 border-slate-200 text-slate-400'}`}><span className="font-black text-xs">تأخير الاستراحة الأولى</span><p className="text-[10px] font-bold opacity-70">يتم إلغاء الاستراحات المبكرة وجمع وقتها في الأخيرة.</p></button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-8 md:pt-12 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
                    <h4 className="text-lg md:text-xl font-black text-indigo-950 tracking-tighter flex items-center gap-3"><Users size={20}/> الشركاء والمسؤوليات</h4>
                    <button onClick={addPartner} className="bg-white border-2 border-indigo-100 text-indigo-600 px-5 py-3 rounded-2xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all btn-press shadow-sm w-full sm:w-auto"><Plus size={16} /> إضافة مجموعة</button>
                    </div>
                    <div className="space-y-4">
                    {data.partners.map((partner, pIdx) => (
                        <div key={partner.id} className="bg-white p-5 md:p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative group animate-slide-down">
                        <button onClick={() => removePartner(partner.id)} className="absolute -left-2 -top-2 p-2 bg-rose-50 text-rose-400 rounded-full hover:bg-rose-500 hover:text-white transition-all shadow-lg"><X size={16} /></button>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                            <div className="md:col-span-4 relative space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 block px-2">المعلمون الشركاء</label>
                                <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl min-h-[50px] items-center">
                                    {partner.userIds.map(uid => {
                                        const emp = employees.find(e => e.id.toString() === uid);
                                        return (
                                            <span key={uid} className="bg-white border border-slate-200 text-indigo-800 text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                                {emp?.name.split(' ')[0]}
                                                <button onClick={() => removeUserFromPartner(partner.id, uid)} className="text-slate-400 hover:text-rose-500"><X size={10}/></button>
                                            </span>
                                        )
                                    })}
                                    
                                    <select 
                                        className="bg-transparent text-[10px] font-bold outline-none w-full text-slate-500 cursor-pointer py-1" 
                                        onChange={(e) => {
                                            if(e.target.value) addUserToPartner(partner.id, e.target.value);
                                            e.target.value = "";
                                        }}
                                    >
                                        <option value="">+ إضافة</option>
                                        {employees.filter(e => !partner.userIds.includes(e.id.toString())).map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative">
                                    <select 
                                        className="w-full bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-[10px] font-black text-indigo-700 outline-none appearance-none cursor-pointer hover:bg-indigo-100 transition-colors"
                                        onChange={(e) => {
                                            if(e.target.value) addGroupToPartner(partner.id, e.target.value);
                                            e.target.value = "";
                                        }}
                                    >
                                        <option value="">✨ إضافة مجموعة</option>
                                        <optgroup label="المناصب">
                                            <option value="educators">جميع المربين</option>
                                            <option value="coordinators">جميع المركزين</option>
                                            <option value="management">الإدارة</option>
                                        </optgroup>
                                        {allSubjects.length > 0 && (
                                            <optgroup label="الطواقم التدريسية">
                                                {allSubjects.map(subj => (
                                                    <option key={subj} value={`subj_${subj}`}>طاقم {subj}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
                                        <Layers size={14} />
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-8">
                                <label className="text-[10px] font-bold text-slate-400 block mb-2 px-2">المهام المطلوبة</label>
                                <input 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-medium text-xs outline-none focus:bg-white focus:border-indigo-400 transition-all" 
                                    placeholder="وصف الدور..." 
                                    value={partner.expectations} 
                                    onChange={e => updatePartner(partner.id, { expectations: e.target.value })} 
                                />
                            </div>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
             </div>
          </div>
          
          {/* RENDER INJECTED CHILDREN (MANUAL DISTRIBUTION GRID) INSIDE THE SCROLL AREA */}
          {children && (
              <div className="xl:col-span-12 pt-8 border-t border-slate-200 animate-slide-down pb-10">
                    {children}
              </div>
          )}
       </div>

       <div className="p-6 md:p-10 border-t bg-slate-50/50 flex flex-col md:flex-row justify-end gap-4 md:gap-6 shrink-0">
          <button onClick={onCancel} className="w-full md:w-auto px-10 py-4 md:py-6 bg-white border border-slate-200 text-slate-600 rounded-[2.5rem] font-black hover:bg-slate-100 transition-all btn-press">إلغاء</button>
          <button onClick={onSave} className="w-full md:w-auto px-12 md:px-16 py-4 md:py-6 bg-slate-900 text-white rounded-[2.5rem] font-black shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 btn-press glow-primary"><CheckCircle2 size={20} /> {isEditing ? 'حفظ التعديلات' : 'اعتماد وتعميم'}</button>
       </div>
    </div>
  );
};

export default UnifiedEventForm;