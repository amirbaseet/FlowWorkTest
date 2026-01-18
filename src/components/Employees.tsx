
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Search, User, Briefcase, Clock, Award, School, Upload, FileDown, Layers, Target, ExternalLink, FileSpreadsheet, Fingerprint, Eye, EyeOff, BookOpen, Armchair, UserCheck, Phone, MessageCircle, Globe, Check, Filter, UserX, Trash2, X, CheckSquare, Square, Trash, RefreshCw, BarChart2, GraduationCap, Sparkles, PlusCircle, Users } from 'lucide-react';
import { Employee, ClassItem, Role, Lesson, CoordinatorRole } from '@/types';
import { COORDINATOR_TYPES, GRADES_AR, SUBJECT_PRIORITY_FOR_INDIVIDUAL, COORDINATOR_RELATIONSHIPS } from '@/constants';
import { useToast } from '@/contexts/ToastContext';
import { useEmployees } from '@/hooks/useEmployees';
import { useLessons } from '@/hooks/useLessons';
import { useClasses } from '@/hooks/useClasses';
import { useRoles } from '@/hooks/useRoles';
import { downloadCSV, parseCSV, normalizeArabic, generateUUID } from '@/utils';

// ... (existing code top)

interface EmployeesProps {
  // core data removed props
  onNavigateToSchedule: (mode: 'class' | 'teacher' | 'subject', id: string | number) => void;
}

const Employees: React.FC<EmployeesProps> = ({ onNavigateToSchedule }) => {
  const { employees, setEmployees } = useEmployees();
  const { lessons } = useLessons();
  const { classes } = useClasses();
  const { roles } = useRoles();
  const { addToast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showIds, setShowIds] = useState<Record<number, boolean>>({});

  const toggleIdVisibility = (id: number) => {
    setShowIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [searchTerm, setSearchTerm] = useState('');

  // Bulk Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [viewFilter, setViewFilter] = useState<'all' | 'internal' | 'external' | 'educators' | 'coordinators'>('all');

  // --- SMART SUBJECT extraction ---
  const availableSubjects = useMemo(() => {
    const fromLessons = new Set(lessons.map(l => normalizeArabic(l.subject)));
    SUBJECT_PRIORITY_FOR_INDIVIDUAL.forEach(s => fromLessons.add(normalizeArabic(s)));
    return Array.from(fromLessons).sort();
  }, [lessons]);

  const [activeCoordType, setActiveCoordType] = useState(COORDINATOR_TYPES[0]?.id || 'grade');
  const [selectedScopeValue, setSelectedScopeValue] = useState('');

  // Helper to get current scope type
  const currentCoordType = useMemo(() =>
    COORDINATOR_TYPES.find(c => c.id === activeCoordType) || COORDINATOR_TYPES[0]
    , [activeCoordType]);

  const handleAddSmartCoordinator = () => {
    if (!selectedScopeValue.trim()) return;

    // Format: "Role Label: Scope Value" or just "Role Label" if global
    let valueToAdd = '';

    if (currentCoordType.scopeType === 'grade') {
      valueToAdd = `${currentCoordType.label}: ${selectedScopeValue}`;
    } else if (currentCoordType.scopeType === 'subject') {
      valueToAdd = `${currentCoordType.label}: ${selectedScopeValue}`;
    } else if (currentCoordType.scopeType === 'custom') {
      valueToAdd = selectedScopeValue; // Custom just takes the input
    } else {
      // Global or others
      valueToAdd = currentCoordType.label;
    }

    if (form.addons.coordinators.includes(valueToAdd)) {
      addToast("هذا الدور مضاف بالفعل", "warning");
      return;
    }

    setForm(prev => ({
      ...prev,
      addons: {
        ...prev.addons,
        coordinators: [...(prev.addons.coordinators || []), valueToAdd]
      }
    }));

    // Reset inputs
    setSelectedScopeValue('');
  };
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
    addons: { educator: false, educatorClassId: "", assistantClassId: "", coordinators: [] },
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


  // --- MIGRATION & SYNC HELPERS ---
  const handleRoleChange = (roleId: string) => {
    // console.log('Role changed to:', roleId); 
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

  const syncStringsToCoordinatorRoles = (coords: string[]): CoordinatorRole[] => {
    return coords.map(c => {
      // Try to parse "Label: Value"
      let typeId = 'custom';
      let scopeValue = c;
      let foundType = COORDINATOR_TYPES.find(t => c.startsWith(t.label));

      if (foundType) {
        typeId = foundType.id;
        const parts = c.split(':');
        if (parts.length > 1) {
          scopeValue = parts[1].trim();
        } else {
          // If global, scopeValue might be empty or same as label
          scopeValue = '';
        }
      }

      return {
        id: generateUUID(),
        typeId: typeId,
        scopeValue: scopeValue,
        targetAudience: 'teachers' // Default for legacy
      };
    });
  };

  const syncCoordinatorRolesToStrings = (roles: CoordinatorRole[]): string[] => {
    return roles.map(r => {
      const typeDef = COORDINATOR_TYPES.find(t => t.id === r.typeId);
      if (!typeDef) return r.scopeValue;

      if (typeDef.scopeType === 'grade' || typeDef.scopeType === 'subject') {
        return `${typeDef.label}: ${r.scopeValue}`;
      } else if (typeDef.scopeType === 'custom') {
        return r.scopeValue;
      } else {
        // Global
        return typeDef.label;
      }
    });
  };

  const handleAddNewRole = () => {
    const newRole: CoordinatorRole = {
      id: generateUUID(),
      typeId: 'layer', // Default
      scopeValue: '',
      targetAudience: 'students' // Default
    };
    setForm(prev => ({
      ...prev,
      addons: {
        ...prev.addons,
        coordinatorRoles: [...(prev.addons.coordinatorRoles || []), newRole]
      }
    }));
  };

  const handleUpdateRole = (id: string, field: keyof CoordinatorRole, value: string) => {
    setForm(prev => ({
      ...prev,
      addons: {
        ...prev.addons,
        coordinatorRoles: prev.addons.coordinatorRoles?.map(r =>
          r.id === id ? { ...r, [field]: value } : r
        )
      }
    }));
  };

  const handleRemoveRole = (id: string) => {
    setForm(prev => ({
      ...prev,
      addons: {
        ...prev.addons,
        coordinatorRoles: prev.addons.coordinatorRoles?.filter(r => r.id !== id)
      }
    }));
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

    // Validate that name doesn't look like a class name
    const suspiciousPatterns = [/^الصف/, /^صف/, /^class/i, /^grade/i, /^مرحلة/];
    if (suspiciousPatterns.some(pattern => pattern.test(form.name))) {
      addToast("الاسم غير صحيح - يبدو كاسم صف وليس معلم", "error");
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

    // Sync fields before save
    const finalCoordinatorRoles = form.addons.coordinatorRoles || [];
    // Ensure we keep legacy strings synced
    const syncedCoordinators = syncCoordinatorRolesToStrings(finalCoordinatorRoles);

    const cleanForm = {
      ...form,
      addons: {
        ...form.addons,
        educatorClassId: form.addons.educator ? form.addons.educatorClassId : undefined,
        coordinators: syncedCoordinators,
        coordinatorRoles: finalCoordinatorRoles
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
    setSelectedScopeValue('');
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
    // Validate that this is actually an employee/teacher, not class data
    // Check for valid baseRoleId (should be a role, not empty)
    if (!e.baseRoleId || e.baseRoleId.trim() === '') return false;

    // Filter out any entries that look like class names (common patterns)
    const suspiciousPatterns = [/^الصف/, /^صف/, /^class/i, /^grade/i, /^مرحلة/];
    if (suspiciousPatterns.some(pattern => pattern.test(e.name))) return false;

    // Ensure it has a valid name (not just numbers or special characters)
    if (!e.name || e.name.trim().length < 2) return false;

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
          <button onClick={() => { setEditing(null); setForm(emptyForm); setSelectedScopeValue(''); setIsFormOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] flex items-center gap-2 shadow-lg btn-press">
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
                    <button onClick={(ev) => {
                      ev.stopPropagation();
                      setEditing(e);
                      // Auto-Migrate on Edit if needed
                      const roles = e.addons.coordinatorRoles || syncStringsToCoordinatorRoles(e.addons.coordinators || []);
                      setForm({ ...e, addons: { ...e.addons, coordinatorRoles: roles } });
                      setIsFormOpen(true);
                    }} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-xl transition-all" title="تعديل"><Edit2 size={16} /></button>
                    <button onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }} className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-all" title="حذف"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>

              <h3 className="font-black text-sm text-slate-900 mb-1 truncate">{e.name}</h3>

              <div className="flex flex-wrap gap-1 mb-3">
                <div className="flex items-center gap-2">
                  <div className="text-slate-400 text-[9px] font-bold flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                    <Fingerprint size={10} />
                    {showIds[e.id] ? e.nationalId : `•••••${e.nationalId.slice(-4)}`}
                  </div>
                  <button
                    onClick={(ev) => { ev.stopPropagation(); toggleIdVisibility(e.id); }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-500 transition-colors"
                    title={showIds[e.id] ? "إخفاء الرقم" : "إظهار الرقم"}
                  >
                    {showIds[e.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
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
                      <span className="text-slate-400 flex items-center gap-1"><Clock size={10} /> المجموع:</span>
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

              {/* Coordinator Management Section (Advanced & Detailed) */}
              <div className="bg-cyan-50/50 p-5 rounded-[2rem] border border-cyan-100">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-black text-cyan-600 uppercase flex items-center gap-2">
                    <Layers size={14} /> مهام التركيز (Coordinators)
                  </label>
                </div>

                {/* Master Toggle */}
                <div className="mb-4">
                  <label className="block text-[9px] text-slate-400 font-bold mb-1">هل المعلم مركز؟</label>
                  <select
                    className="w-full p-3 bg-white border border-cyan-200 rounded-xl font-bold text-sm text-cyan-900 outline-none focus:ring-2 focus:ring-cyan-200"
                    value={(form.addons.coordinatorRoles && form.addons.coordinatorRoles.length > 0) ? 'yes' : 'no'}
                    onChange={(e) => {
                      if (e.target.value === 'yes') {
                        // If switching to yes, add a default role if empty
                        if (!form.addons.coordinatorRoles || form.addons.coordinatorRoles.length === 0) {
                          handleAddNewRole();
                        }
                      } else {
                        // If switching to no, clear roles (maybe warn?)
                        if (window.confirm("تحذير: سيتم حذف جميع مهام التركيز لهذا المعلم. هل أنت متأكد؟")) {
                          setForm(prev => ({
                            ...prev,
                            addons: { ...prev.addons, coordinatorRoles: [] }
                          }));
                        }
                      }
                    }}
                  >
                    <option value="no">غير مركز (افتراضي)</option>
                    <option value="yes">مركز</option>
                  </select>
                </div>

                {/* Roles List - Only show if has roles */}
                {form.addons.coordinatorRoles && form.addons.coordinatorRoles.length > 0 && (
                  <div className="space-y-3 animate-slide-down">
                    {form.addons.coordinatorRoles?.map((role, idx) => {
                      // Find definition from constants or fallback
                      const typeDef = COORDINATOR_TYPES.find(t => t.id === role.typeId) || COORDINATOR_TYPES[0];

                      return (
                        <div key={role.id} className="bg-white p-3 rounded-xl border border-cyan-200 shadow-sm animate-scale-up grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                          {/* Type */}
                          <div className="md:col-span-3">
                            <label className="block text-[9px] text-slate-400 font-bold mb-1">نوع التركيز</label>
                            <select
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                              value={role.typeId}
                              onChange={(e) => {
                                handleUpdateRole(role.id, 'typeId', e.target.value);
                                handleUpdateRole(role.id, 'scopeValue', ''); // Reset scope on type change
                              }}
                            >
                              {COORDINATOR_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          </div>

                          {/* Scope */}
                          <div className="md:col-span-4">
                            <label className="block text-[9px] text-slate-400 font-bold mb-1">نطاق التركيز (Scope)</label>
                            {typeDef.scopeType === 'grade' ? (
                              <select
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                value={role.scopeValue}
                                onChange={(e) => handleUpdateRole(role.id, 'scopeValue', e.target.value)}
                              >
                                <option value="">-- اختر الطبقة --</option>
                                {GRADES_AR.map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                            ) : typeDef.scopeType === 'subject' ? (
                              <select
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                value={role.scopeValue}
                                onChange={(e) => handleUpdateRole(role.id, 'scopeValue', e.target.value)}
                              >
                                <option value="">-- اختر الموضوع --</option>
                                {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            ) : typeDef.scopeType === 'custom' ? (
                              <input
                                type="text"
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                placeholder="أدخل المسمى..."
                                value={role.scopeValue}
                                onChange={(e) => handleUpdateRole(role.id, 'scopeValue', e.target.value)}
                              />
                            ) : (
                              <div className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-400 italic text-center">
                                دور عام
                              </div>
                            )}
                          </div>

                          {/* Relationship */}
                          <div className="md:col-span-4">
                            <label className="block text-[9px] text-slate-400 font-bold mb-1">العلاقة (Audience)</label>
                            <select
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                              value={role.targetAudience}
                              onChange={(e) => handleUpdateRole(role.id, 'targetAudience', e.target.value as any)}
                            >
                              {COORDINATOR_RELATIONSHIPS.map(rel => (
                                <option key={rel.id} value={rel.id}>{rel.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Remove */}
                          <div className="md:col-span-1 flex justify-center pt-4 md:pt-0">
                            <button onClick={() => handleRemoveRole(role.id)} className="text-slate-300 hover:text-rose-500 transition"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                )}
              </div>

              {/* Educator / Homeroom Logic */}
              <div className={`p-5 rounded-[2rem] border-2 transition-all ${form.addons.educator ? 'bg-violet-50 border-violet-200' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-center mb-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${form.addons.educator ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300'}`}>
                      {form.addons.educator && <Check size={14} />}
                    </div>
                    <input type="checkbox" className="hidden" checked={form.addons.educator} onChange={(e) => setForm({ ...form, addons: { ...form.addons, educator: e.target.checked } })} />
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
                      onChange={(e) => setForm({ ...form, addons: { ...form.addons, educatorClassId: e.target.value } })}
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

              {/* Assistant / Classroom Assistant Logic */}
              <div className={`p-5 rounded-[2rem] border-2 transition-all ${form.baseRoleId === 'assistant' && form.addons.assistantClassId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${form.baseRoleId === 'assistant' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-200 border-slate-300 text-slate-400'}`}>
                      <User size={14} />
                    </div>
                    <span className={`font-black text-sm ${form.baseRoleId === 'assistant' ? 'text-blue-800' : 'text-slate-400'}`}>تخصيص صف للمساعد/ة</span>
                  </div>
                  {/* Debug Info */}
                  <span className="text-[8px] text-slate-400">(baseRoleId: {form.baseRoleId || 'empty'})</span>
                </div>

                {form.baseRoleId === 'assistant' && (
                  <div className="animate-slide-down">
                    <label className="text-[10px] font-bold text-blue-500 block mb-2">اختر الصف المخصص</label>
                    <select
                      className="w-full p-3 bg-white border border-blue-200 rounded-xl font-bold text-sm text-blue-900 outline-none focus:ring-2 focus:ring-blue-200"
                      value={form.addons.assistantClassId || ""}
                      onChange={(e) => setForm({ ...form, addons: { ...form.addons, assistantClassId: e.target.value } })}
                    >
                      <option value="">-- اختر الصف --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-blue-400 font-bold mt-2 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      سيتم تعيين المساعد/ة تلقائياً عند غياب مربي هذا الصف
                    </p>
                  </div>
                )}

                {form.baseRoleId !== 'assistant' && (
                  <p className="text-[9px] text-slate-400 font-bold italic">هذا الخيار متاح فقط عند اختيار المسمى الوظيفي "مساعد/ة"</p>
                )}
              </div>

              {/* Workload Inputs */}
              {!form.constraints?.isExternal && (
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart2 size={16} className="text-indigo-500" />
                    <span className="text-xs font-black text-slate-700">توزيع الحصص</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-1 text-center">فعلية</label>
                      <input type="number" className="w-full p-2 text-center rounded-xl border border-slate-200 font-bold text-sm" value={form.workload.actual} onChange={e => setForm({ ...form, workload: { ...form.workload, actual: Number(e.target.value) } })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-1 text-center">فردية</label>
                      <input type="number" className="w-full p-2 text-center rounded-xl border border-slate-200 font-bold text-sm" value={form.workload.individual} onChange={e => setForm({ ...form, workload: { ...form.workload, individual: Number(e.target.value) } })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-1 text-center">مكوث</label>
                      <input type="number" className="w-full p-2 text-center rounded-xl border border-slate-200 font-bold text-sm" value={form.workload.stay} onChange={e => setForm({ ...form, workload: { ...form.workload, stay: Number(e.target.value) } })} />
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

              <div onClick={() => setForm({ ...form, constraints: { ...form.constraints, isExternal: !form.constraints?.isExternal } })} className={`p-4 rounded-[2rem] border-2 cursor-pointer flex items-center gap-4 ${form.constraints?.isExternal ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-100'}`}>
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
