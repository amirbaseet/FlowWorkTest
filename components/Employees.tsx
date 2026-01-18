
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Search, User, Briefcase, Clock, Award, School, Upload, FileDown, Layers, Target, ExternalLink, FileSpreadsheet, Fingerprint, BookOpen, Armchair, UserCheck, Phone, MessageCircle, Globe, Check, Filter, UserX, Trash2, X, CheckSquare, Square, Trash, RefreshCw, BarChart2, GraduationCap, Sparkles, PlusCircle } from 'lucide-react';
import { Employee, ClassItem, Role, Lesson } from '../types';
import { COORDINATOR_TYPES } from '../constants';
import { useToast } from '../contexts/ToastContext';
import { downloadCSV, parseCSV, normalizeArabic } from '../utils';

interface EmployeesProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  classes: ClassItem[];
  roles: Role[];
  onNavigateToSchedule: (mode: 'class' | 'teacher' | 'subject', id: string | number) => void;
  lessons: Lesson[];
}

const Employees: React.FC<EmployeesProps> = ({ employees, setEmployees, classes, roles, onNavigateToSchedule, lessons = [] }) => {
  const { addToast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Bulk Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const [viewFilter, setViewFilter] = useState<'all' | 'internal' | 'external' | 'educators' | 'coordinators'>('all');
  
  // State for new coordinator input
  const [newCoordinatorInput, setNewCoordinatorInput] = useState('');

  // --- DATA SANITIZER (Auto-Fix IDs) ---
  useEffect(() => {
    const ids = new Set();
    let hasDuplicates = false;
    employees.forEach(e => {
        if (ids.has(e.id)) hasDuplicates = true;
        ids.add(e.id);
    });

    if (hasDuplicates) {
        console.warn("Duplicate IDs detected. Sanitizing...");
        setEmployees(prev => prev.map((e, idx) => ({
            ...e,
            id: Number(Date.now() + idx + Math.floor(Math.random() * 1000))
        })));
        addToast("تم إصلاح تعارض في معرفات البيانات تلقائياً", "info");
    }
  }, []);

  const emptyForm: Omit<Employee, 'id'> = {
    nationalId: "",
    name: "",
    baseRoleId: "",
    phoneNumber: "",
    contractedHours: 0,
    workload: { actual: 0, individual: 0, stay: 0 },
    addons: { educator: false, educatorClassId: "", coordinators: [] },
    constraints: { cannotCoverAlone: false, isExternal: false },
    subjects: []
  };

  const [form, setForm] = useState(emptyForm);

  // Filter available classes for the dropdown (exclude classes that already have an educator, unless it's the current user's class)
  const availableEducatorClasses = useMemo(() => {
    const takenClassIds = employees
      .filter(e => e.addons.educator && e.addons.educatorClassId && e.id !== editing?.id)
      .map(e => e.addons.educatorClassId);
    
    return classes.filter(c => !takenClassIds.includes(c.id));
  }, [classes, employees, editing]);

  // --- SMART SUGGESTION LOGIC ---
  const suggestedHomeroom = useMemo(() => {
      if (!editing || !lessons.length) return null;
      
      const keywords = ['مهارات', 'تربية', 'حياة', 'توجيه', 'مربي', 'فعاليات', 'تواصل'];
      const teacherLessons = lessons.filter(l => l.teacherId === editing.id);
      
      const candidateClasses: Record<string, number> = {};
      
      teacherLessons.forEach(l => {
          const subj = normalizeArabic(l.subject);
          if (keywords.some(k => subj.includes(k))) {
              candidateClasses[l.classId] = (candidateClasses[l.classId] || 0) + 1;
          }
      });
      
      const sortedCandidates = Object.keys(candidateClasses).sort((a, b) => candidateClasses[b] - candidateClasses[a]);
      
      if (sortedCandidates.length > 0) {
          const classId = sortedCandidates[0];
          // Check if this class is already taken by someone else (optional, but good for UI)
          const isTaken = employees.some(e => e.addons.educator && e.addons.educatorClassId === classId && e.id !== editing.id);
          const cls = classes.find(c => c.id === classId);
          
          if (cls && !isTaken) {
              return { id: cls.id, name: cls.name };
          }
      }
      return null;
  }, [editing, lessons, classes, employees]);

  const handleRoleChange = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      setForm({
        ...form,
        baseRoleId: roleId,
        contractedHours: role.defaultHours,
        workload: role.workloadDetails || { actual: role.defaultHours, individual: 0, stay: 0 }
      });
    } else {
       setForm({ ...form, baseRoleId: roleId });
    }
  };

  const handleAddCoordinator = () => {
      if (!newCoordinatorInput.trim()) return;
      if (form.addons.coordinators.includes(newCoordinatorInput.trim())) {
          addToast("هذا التركيز مضاف بالفعل", "warning");
          return;
      }
      setForm(prev => ({
          ...prev,
          addons: {
              ...prev.addons,
              coordinators: [...(prev.addons.coordinators || []), newCoordinatorInput.trim()]
          }
      }));
      setNewCoordinatorInput('');
  };

  const handleRemoveCoordinator = (coordToRemove: string) => {
      setForm(prev => ({
          ...prev,
          addons: {
              ...prev.addons,
              coordinators: prev.addons.coordinators.filter(c => c !== coordToRemove)
          }
      }));
  };

  const handleSave = () => {
    if (!form.name || !form.baseRoleId || !form.nationalId) {
      addToast("يرجى ملء الاسم، الهوية، والوظيفة", "error");
      return;
    }
    
    if (form.nationalId.length < 8) {
       addToast("رقم الهوية غير صحيح", "error");
       return;
    }

    const idExists = employees.some(e => e.nationalId === form.nationalId && e.id !== editing?.id);
    if (idExists) {
        addToast("رقم الهوية مستخدم بالفعل لموظف آخر", "error");
        return;
    }

    const nameExists = employees.some(e => normalizeArabic(e.name) === normalizeArabic(form.name) && e.id !== editing?.id);
    if (nameExists) {
        addToast("اسم الموظف موجود بالفعل", "error");
        return;
    }

    if (form.addons.educator && !form.addons.educatorClassId) {
      addToast("يرجى تحديد الشعبة الصفية للمربي", "error");
      return;
    }
    
    // Ensure if educator is unchecked, classId is cleared
    const cleanForm = {
        ...form,
        addons: {
            ...form.addons,
            educatorClassId: form.addons.educator ? form.addons.educatorClassId : undefined
        }
    };

    const record: Employee = {
      id: editing ? editing.id : Date.now(),
      ...cleanForm,
    };

    setEmployees((prev) =>
      editing
        ? prev.map((e) => (e.id === record.id ? record : e))
        : [...prev, record]
    );

    setForm(emptyForm);
    setNewCoordinatorInput('');
    setEditing(null);
    setIsFormOpen(false);
    addToast(editing ? "تم تحديث بيانات الموظف" : "تم إضافة موظف جديد");
  };

  const handleDelete = (id: number) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;

    if (window.confirm(`هل أنت متأكد من حذف الموظف "${emp.name}"؟\nسيتم إزالة جميع البيانات المرتبطة به نهائياً.`)) {
        setEmployees(prev => prev.filter(e => e.id !== id));
        addToast("تم حذف الموظف بنجاح", "success");

        if (isFormOpen && editing?.id === id) {
            setIsFormOpen(false);
            setEditing(null);
            setForm(emptyForm);
        }
    }
  };

  // --- Bulk Actions ---
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds([]); 
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    const allVisibleIds = filteredEmployees.map(e => e.id);
    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allVisibleIds.includes(id)));
    } else {
      setSelectedIds(prev => {
         const newSet = new Set(prev);
         allVisibleIds.forEach(id => newSet.add(id));
         return Array.from(newSet);
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    if (window.confirm(`تحذير: أنت على وشك حذف ${selectedIds.length} موظف دفعة واحدة. هل أنت متأكد؟`)) {
        const idsToDelete = new Set(selectedIds);
        setEmployees(prev => prev.filter(e => !idsToDelete.has(e.id)));
        addToast(`تم حذف ${selectedIds.length} موظف`, "success");
        setSelectedIds([]);
        setIsSelectionMode(false);
    }
  };

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.nationalId.includes(searchTerm);
    if (!matchesSearch) return false;
    if (viewFilter === 'internal') return !e.constraints?.isExternal;
    if (viewFilter === 'external') return e.constraints?.isExternal;
    if (viewFilter === 'educators') return e.addons.educator;
    if (viewFilter === 'coordinators') return e.addons.coordinators && e.addons.coordinators.length > 0;
    return true;
  });

  const areAllVisibleSelected = filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.includes(e.id));

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">طاقم العمل</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">إدارة مركزية للمعلمين</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
           <button onClick={toggleSelectionMode} className={`px-4 py-2.5 rounded-xl font-black text-[10px] flex items-center gap-2 transition-all ${isSelectionMode ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
             <CheckSquare size={16} /> <span className="hidden sm:inline">{isSelectionMode ? 'إنهاء التحديد' : 'تحديد متعدد'}</span>
           </button>
           <button onClick={() => { setEditing(null); setForm(emptyForm); setNewCoordinatorInput(''); setIsFormOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] flex items-center gap-2 shadow-lg btn-press">
            <Plus size={16} /> إضافة موظف
          </button>
        </div>
      </div>

      {isSelectionMode && (
        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl flex flex-wrap justify-between items-center animate-slide-down border border-slate-700 sticky top-4 z-[100]">
           <div className="flex items-center gap-4 px-2">
              <span className="font-black text-xs">تم تحديد {selectedIds.length}</span>
              <button onClick={selectAllFiltered} className="text-[10px] font-bold text-indigo-300 hover:text-white">{areAllVisibleSelected ? 'إلغاء الكل' : 'تحديد الكل'}</button>
           </div>
           {selectedIds.length > 0 && (
             <button onClick={handleBulkDelete} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-black text-[10px] flex items-center gap-2">
                <Trash size={14} /> حذف ({selectedIds.length})
             </button>
           )}
        </div>
      )}

      <div className="bg-white p-4 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex p-1 bg-slate-100 rounded-xl shadow-inner w-full md:w-auto overflow-x-auto">
             <button onClick={() => setViewFilter('all')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>الكل</button>
             <button onClick={() => setViewFilter('internal')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewFilter === 'internal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>الرسمي</button>
             <button onClick={() => setViewFilter('external')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewFilter === 'external' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'}`}>بدلاء</button>
             <button onClick={() => setViewFilter('educators')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewFilter === 'educators' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500'}`}>المربون</button>
             <button onClick={() => setViewFilter('coordinators')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewFilter === 'coordinators' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500'}`}>المركزون</button>
        </div>
        <div className="relative flex-1 w-full">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="بحث سريع..." className="w-full pl-6 pr-12 py-3 rounded-2xl bg-slate-50 focus:bg-white text-slate-700 font-bold text-xs focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredEmployees.map((e) => {
          const isSelected = selectedIds.includes(e.id);
          const isExternal = e.constraints?.isExternal;
          const isEducator = e.addons.educator;
          const coordinators = e.addons.coordinators || [];
          const role = roles.find(r => r.id === e.baseRoleId);
          const roleLabel = role?.label || e.baseRoleId;
          const educatorClassName = isEducator ? classes.find(c => c.id === e.addons.educatorClassId)?.name : '';
          
          return (
            <div key={e.id} onClick={() => isSelectionMode && toggleSelection(e.id)} className={`bg-white p-5 rounded-[2rem] border shadow-md hover:shadow-xl transition-all duration-300 relative group cursor-pointer ${isSelectionMode ? (isSelected ? 'border-indigo-500 ring-2 ring-indigo-50 bg-indigo-50/10' : 'border-slate-200') : (isExternal ? 'border-amber-200' : 'border-slate-100')}`}>
               {isSelectionMode && (
                 <div className="absolute top-4 left-4 z-30">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-slate-300'}`}>
                        {isSelected && <Check size={14} />}
                    </div>
                 </div>
               )}

               <div className="flex justify-between items-start mb-4 relative z-20">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${isExternal ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                    {e.name.charAt(0)}
                  </div>
                  {!isSelectionMode && (
                    <div className="flex gap-1"> 
                      <button onClick={(ev) => { ev.stopPropagation(); onNavigateToSchedule('teacher', e.id); }} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-xl transition-all" title="الجدول"><ExternalLink size={16} /></button>
                      <button onClick={(ev) => { ev.stopPropagation(); setEditing(e); setForm(e); setIsFormOpen(true); }} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-xl transition-all" title="تعديل"><Edit2 size={16} /></button>
                      <button onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }} className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-all" title="حذف"><Trash2 size={16} /></button>
                    </div>
                  )}
               </div>
               
               <h3 className="font-black text-sm text-slate-900 mb-1 truncate">{e.name}</h3>
               
               <div className="flex flex-wrap gap-1 mb-3">
                  <div className="text-slate-400 text-[9px] font-bold flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100"><Fingerprint size={10}/> {e.nationalId}</div>
                  {isExternal && <div className="text-amber-600 text-[9px] font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">بديل</div>}
               </div>

               {/* Role & Educator Status Display */}
               <div className="space-y-3 pt-3 border-t border-slate-50">
                  {/* Primary Role */}
                  <div className="flex flex-wrap gap-1 justify-center">
                      <div className="text-center bg-slate-50/80 px-3 py-1 rounded-lg border border-dashed border-slate-200 flex-grow">
                          <span className="text-[10px] font-bold text-slate-600">{roleLabel}</span>
                      </div>
                      
                      {/* Educator Badge */}
                      {isEducator && educatorClassName && (
                          <div className="text-center bg-violet-50 px-3 py-1 rounded-lg border border-violet-100 flex-grow flex items-center justify-center gap-1">
                              <GraduationCap size={12} className="text-violet-500" />
                              <span className="text-[10px] font-black text-violet-700 truncate" title={`مربي صف ${educatorClassName}`}>{educatorClassName}</span>
                          </div>
                      )}
                  </div>

                  {/* Coordinators Badges */}
                  {coordinators.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center">
                          {coordinators.map((c, i) => (
                              <div key={i} className="text-center bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100 flex items-center justify-center gap-1">
                                  <Layers size={10} className="text-cyan-500" />
                                  <span className="text-[9px] font-bold text-cyan-700 truncate max-w-[80px]">{c}</span>
                              </div>
                          ))}
                      </div>
                  )}

                  {!isExternal && (
                      <div className="space-y-2 mt-2">
                          <div className="flex justify-between items-center text-[10px] font-bold px-1">
                              <span className="text-slate-400 flex items-center gap-1"><Clock size={10}/> المجموع:</span>
                              <span className="text-indigo-600 font-black">{e.contractedHours} حصة</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                              <div className="bg-slate-50 rounded-lg p-1.5 text-center border border-slate-100">
                                  <span className="block text-[8px] font-black text-slate-400 uppercase mb-0.5">فعلية</span>
                                  <span className="block text-xs font-black text-slate-800">{e.workload.actual}</span>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-1.5 text-center border border-slate-100">
                                  <span className="block text-[8px] font-black text-slate-400 uppercase mb-0.5">فردية</span>
                                  <span className="block text-xs font-black text-slate-800">{e.workload.individual}</span>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-1.5 text-center border border-slate-100">
                                  <span className="block text-[8px] font-black text-slate-400 uppercase mb-0.5">مكوث</span>
                                  <span className="block text-xs font-black text-slate-800">{e.workload.stay}</span>
                              </div>
                          </div>
                      </div>
                  )}
               </div>
            </div>
          );
        })}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-6 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up border border-white/20">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-xl text-slate-900">{editing ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="p-3 bg-white text-slate-300 hover:text-rose-500 rounded-2xl shadow-sm"><X size={20} /></button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">الاسم الكامل</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">رقم الهوية</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
                  </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">المسمى الوظيفي الأساسي</label>
                <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" value={form.baseRoleId} onChange={(e) => handleRoleChange(e.target.value)}>
                  <option value="">-- اختر --</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>

              {/* Coordinator Management Section */}
              <div className="bg-cyan-50/50 p-5 rounded-[2rem] border border-cyan-100">
                  <label className="text-[10px] font-black text-cyan-600 uppercase mb-2 block flex items-center gap-2"><Layers size={14}/> مهام التركيز (Coordinators)</label>
                  <div className="flex gap-2 mb-3">
                      <input 
                        type="text" 
                        className="flex-1 p-3 bg-white border border-cyan-200 rounded-xl font-bold text-sm text-cyan-900 outline-none focus:ring-2 focus:ring-cyan-200"
                        placeholder="أدخل مسمى التركيز (مثال: لغة عربية، حوسبة...)"
                        value={newCoordinatorInput}
                        onChange={(e) => setNewCoordinatorInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCoordinator())}
                      />
                      <button 
                        onClick={(e) => { e.preventDefault(); handleAddCoordinator(); }}
                        className="bg-cyan-600 text-white p-3 rounded-xl hover:bg-cyan-700 transition-colors shadow-sm"
                      >
                          <Plus size={20} />
                      </button>
                  </div>
                  
                  {form.addons.coordinators && form.addons.coordinators.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                          {form.addons.coordinators.map((coord, idx) => (
                              <span key={idx} className="bg-white border border-cyan-200 text-cyan-700 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 shadow-sm animate-scale-up">
                                  {coord}
                                  <button onClick={() => handleRemoveCoordinator(coord)} className="text-cyan-400 hover:text-rose-500 transition-colors"><X size={14}/></button>
                              </span>
                          ))}
                      </div>
                  ) : (
                      <p className="text-[10px] text-cyan-400 font-bold italic">لا توجد مهام تركيز مضافة.</p>
                  )}
              </div>

              {/* Educator / Homeroom Logic */}
              <div className={`p-5 rounded-[2rem] border-2 transition-all ${form.addons.educator ? 'bg-violet-50 border-violet-200' : 'bg-white border-slate-100'}`}>
                  <div className="flex justify-between items-center mb-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${form.addons.educator ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300'}`}>
                              {form.addons.educator && <Check size={14} />}
                          </div>
                          <input type="checkbox" className="hidden" checked={form.addons.educator} onChange={(e) => setForm({...form, addons: { ...form.addons, educator: e.target.checked }})} />
                          <span className={`font-black text-sm ${form.addons.educator ? 'text-violet-800' : 'text-slate-600'}`}>تكليف كمربي صف</span>
                      </label>
                      
                      {/* Suggestion Badge */}
                      {!form.addons.educator && suggestedHomeroom && (
                          <button 
                            onClick={() => setForm({ ...form, addons: { ...form.addons, educator: true, educatorClassId: suggestedHomeroom.id } })}
                            className="text-[9px] font-bold bg-violet-100 text-violet-600 px-3 py-1 rounded-full animate-pulse flex items-center gap-1 hover:bg-violet-200 transition-colors"
                          >
                              <Sparkles size={10} /> مقترح: {suggestedHomeroom.name}
                          </button>
                      )}
                  </div>

                  {form.addons.educator && (
                      <div className="animate-slide-down">
                          <label className="text-[10px] font-bold text-violet-500 block mb-2">اختر الصف المسؤول عنه</label>
                          <select 
                              className="w-full p-3 bg-white border border-violet-200 rounded-xl font-bold text-sm text-violet-900 outline-none focus:ring-2 focus:ring-violet-200"
                              value={form.addons.educatorClassId || ""}
                              onChange={(e) => setForm({...form, addons: { ...form.addons, educatorClassId: e.target.value }})}
                          >
                              <option value="">-- اختر الصف --</option>
                              {/* Include currently selected class even if taken, plus available classes */}
                              {editing?.addons.educatorClassId && (
                                  <option value={editing.addons.educatorClassId}>{classes.find(c => c.id === editing.addons.educatorClassId)?.name}</option>
                              )}
                              {availableEducatorClasses.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                          </select>
                      </div>
                  )}
              </div>

              {/* Workload Inputs */}
              {!form.constraints?.isExternal && (
                  <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-200 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                          <BarChart2 size={16} className="text-indigo-500"/>
                          <span className="text-xs font-black text-slate-700">توزيع الحصص</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                          <div>
                              <label className="text-[9px] font-bold text-slate-400 block mb-1 text-center">فعلية</label>
                              <input type="number" className="w-full p-2 text-center rounded-xl border border-slate-200 font-bold text-sm" value={form.workload.actual} onChange={e => setForm({...form, workload: {...form.workload, actual: Number(e.target.value)}})} />
                          </div>
                          <div>
                              <label className="text-[9px] font-bold text-slate-400 block mb-1 text-center">فردية</label>
                              <input type="number" className="w-full p-2 text-center rounded-xl border border-slate-200 font-bold text-sm" value={form.workload.individual} onChange={e => setForm({...form, workload: {...form.workload, individual: Number(e.target.value)}})} />
                          </div>
                          <div>
                              <label className="text-[9px] font-bold text-slate-400 block mb-1 text-center">مكوث</label>
                              <input type="number" className="w-full p-2 text-center rounded-xl border border-slate-200 font-bold text-sm" value={form.workload.stay} onChange={e => setForm({...form, workload: {...form.workload, stay: Number(e.target.value)}})} />
                          </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500">إجمالي الساعات المحتسب:</span>
                          <span className={`text-xs font-black ${(form.workload.actual + form.workload.individual + form.workload.stay) !== form.contractedHours ? 'text-amber-500' : 'text-emerald-600'}`}>
                              {form.workload.actual + form.workload.individual + form.workload.stay} / {form.contractedHours}
                          </span>
                      </div>
                  </div>
              )}

              <div onClick={() => setForm({...form, constraints: { ...form.constraints, isExternal: !form.constraints?.isExternal }})} className={`p-4 rounded-[2rem] border-2 cursor-pointer flex items-center gap-4 ${form.constraints?.isExternal ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-100'}`}>
                 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.constraints?.isExternal ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'}`}>{form.constraints?.isExternal && <Check size={12} />}</div>
                 <span className="font-black text-xs text-slate-800">موظف خارجي (بديل)</span>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50/50 flex gap-4">
              {editing && (
                  <button onClick={() => handleDelete(editing.id)} className="px-6 bg-rose-50 text-rose-600 hover:bg-rose-100 border-2 border-rose-100 py-3 rounded-2xl font-black text-xs transition-all">
                    <Trash2 size={18} />
                  </button>
              )}
              <button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-black text-sm shadow-lg">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
