
import React, { useState, useMemo } from 'react';
import {
   Settings as SettingsIcon, Clock, Plus, Trash2, Check, Layout, Briefcase,
   ArrowUp, ArrowDown, ListPlus, Users, Layers, GraduationCap,
   Edit3, Coffee, Timer, School, Zap, CheckCircle2,
   X, Target, Palette, Globe, User, ShieldCheck, AlertTriangle,
   PlusCircle, ChevronDown, Hash, Type, Baby, Sparkles, HeartHandshake,
   Shield, Landmark, Scale, Info, Percent, Database, AlertOctagon,
   RefreshCcw, Save, CalendarDays, Binary, UserPlus, TableProperties,
   PlusSquare, MinusSquare, ChevronRight, GripVertical, Settings2, Eye,
   Lock, LayoutDashboard, ShieldAlert, FileBarChart2, Share2, Key,
   SlidersHorizontal, Box, Wand2, Fingerprint, Network, GitFork,
   BrainCircuit, LayoutTemplate, Microscope, Settings2 as LogicIcon, BookOpen,
   ArrowRightLeft, ListTree, Activity, Gem, Command, Siren, Upload, Image as ImageIcon,
   CloudRain, Bus, FileText, EyeOff, ShieldQuestion, UserX, Cpu, Radio, Terminal, BarChart3, Sun,
   Dna, Boxes, Workflow, ShieldAlert as PolicyIcon, ToggleLeft, ToggleRight, ListOrdered, ArrowRightLeft as SwapIcon,
   RefreshCw, Layers2, ShieldCheck as RuleIcon, UserCog, ShieldCheck as ShieldIcon, KeyRound, Circle,
   LayoutGrid, Construction, Shapes, Calendar, Trash, MoreVertical, Edit, Sparkle,
   Waves, ListTodo, ChevronLeft as ChevronLeftIcon, RotateCcw, FileSignature, FlaskConical,
   FileSpreadsheet, MonitorPlay, Gauge
} from 'lucide-react';
import {
   ScheduleConfig, Role, ClassItem, EngineContext, ModeConfig, BreakMergeStrategy, GoldenRule, PolicyRule, PriorityStep, CandidateType, EnforcementLevel, PriorityCriteria, SlotState, BreakType,
   Employee, Lesson, ImportResult, SchoolStage
} from '@/types';
import { Permission } from '@/types/permissions';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useLessons } from '@/hooks/useLessons';
import { useToast } from '@/contexts/ToastContext';
import { DAYS_AR, GRADES_AR } from '@/constants';
import { timeToMins, minsToTime, normalizeArabic } from '@/utils';
import ImportExcelModal from './ImportExcelModal';
import ModeConfigModal from './ModeConfigModal';

interface SettingsProps {
   engineContext: EngineContext;
   setEngineContext: React.Dispatch<React.SetStateAction<EngineContext>>;
}

const PERMISSION_OPTIONS: { id: Permission, label: string }[] = [
   { id: 'VIEW_SCHEDULE', label: 'عرض الجداول الشاملة' },
   { id: 'MANAGE_SUBSTITUTIONS', label: 'توثيق الغياب' },
   { id: 'MANAGE_EMPLOYEES', label: 'إدارة شؤون الموظفين' },
   { id: 'CONFIGURE_MODES', label: 'تجاوز قرارات المحرك' },
   { id: 'MANAGE_SETTINGS', label: 'إدارة إعدادات النظام' }
];

// Clean Arabic Ordinals for Class Naming
const ARABIC_ORDINALS = [
   "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس",
   "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"
];

const Settings: React.FC<SettingsProps> = ({
   engineContext, setEngineContext
}) => {
   // Hooks
   const {
      scheduleConfig, setScheduleConfig,
      roles, setRoles,
      classes, setClasses,
      setEmployees
   } = useSchoolData();
   const { lessons, setLessons } = useLessons();

   // Internal Validation Logic
   const validateDeleteClass = (classId: string): { canDelete: boolean; reason?: string } => {
      const hasLessons = lessons.some(l => l.classId === classId);
      if (hasLessons) return { canDelete: false, reason: 'يوجد حصص مرتبطة بهذا الصف' };
      return { canDelete: true };
   };

   const validateDeleteRole = (roleId: string): { canDelete: boolean; reason?: string } => {
      // Basic check - modify as needed
      return { canDelete: true };
   };
   const { addToast } = useToast();
   const [activeTab, setActiveTab] = useState<'identity' | 'structure' | 'roles' | 'protocol' | 'import'>('identity');
   const [editingModeId, setEditingModeId] = useState<string | null>(null);
   const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
   const [isGenerating, setIsGenerating] = useState(false);
   const [showImportModal, setShowImportModal] = useState(false);

   // --- Handlers ---
   const updateConfig = (updates: Partial<ScheduleConfig>) => setScheduleConfig(prev => ({ ...prev, ...updates }));

   const updatePeriodDuration = (pNum: number, duration: number) => {
      const next = { ...scheduleConfig.customPeriodDurations };
      next[pNum] = duration;
      updateConfig({ customPeriodDurations: next });
   };

   const updateBreakDuration = (pNum: number, duration: number) => {
      const nextDurs = { ...scheduleConfig.breakDurations };
      nextDurs[pNum] = duration;
      updateConfig({ breakDurations: nextDurs });
   };

   const updateBreakType = (pNum: number, type: BreakType) => {
      const nextTypes = { ...(scheduleConfig.breakTypes || {}) };
      nextTypes[pNum] = type;
      const nextDurs = { ...scheduleConfig.breakDurations };
      if (type === 'short') nextDurs[pNum] = 5;
      else if (type === 'long') nextDurs[pNum] = 20;
      else delete nextDurs[pNum];
      const nextPositions = { ...scheduleConfig.breakPositions };
      if (type !== 'none') nextPositions[pNum] = type === 'long' ? 'main' : 'transit';
      else delete nextPositions[pNum];
      updateConfig({ breakTypes: nextTypes, breakDurations: nextDurs, breakPositions: nextPositions });
   };

   const updateSchoolInfo = (info: Partial<ScheduleConfig['schoolInfo']>) => setScheduleConfig(prev => ({ ...prev, schoolInfo: { ...(prev.schoolInfo || { name: '' }), ...info } }));

   const toggleHoliday = (day: string) => {
      const current = scheduleConfig.holidays;
      updateConfig({ holidays: current.includes(day) ? current.filter(d => d !== day) : [...current, day] });
   };

   const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
            updateSchoolInfo({ logo: reader.result as string });
         };
         reader.readAsDataURL(file);
      }
   };

   // Complex Time Flow Calculation
   const calculatedTimeline = useMemo(() => {
      const timeline: { type: 'period' | 'break' | 'morning_break'; id: number; start: string; end: string; duration: number; bType?: BreakType }[] = [];
      let currentMins = timeToMins(scheduleConfig.schoolStartTime);

      // NEW: Add morning break before first period (if enabled)
      const morningBreak = scheduleConfig.morningBreak;
      if (morningBreak?.enabled && morningBreak.duration > 0) {
         timeline.push({
            type: 'morning_break',
            id: 0,
            start: minsToTime(currentMins),
            end: minsToTime(currentMins + morningBreak.duration),
            duration: morningBreak.duration,
            bType: morningBreak.type || 'short'
         });
         currentMins += morningBreak.duration;
      }

      for (let i = 1; i <= scheduleConfig.periodsPerDay; i++) {
         // 1. Period
         const pDur = scheduleConfig.customPeriodDurations?.[i] || scheduleConfig.periodDuration;
         timeline.push({ type: 'period', id: i, start: minsToTime(currentMins), end: minsToTime(currentMins + pDur), duration: pDur });
         currentMins += pDur;

         // 2. Break (after period)
         const bType = scheduleConfig.breakTypes?.[i] || 'none';
         const bDur = scheduleConfig.breakDurations?.[i] || (bType === 'long' ? 20 : 5);

         // Always push break entry to maintain slot in visualizer, even if type is 'none' (duration 0 effectively)
         timeline.push({ type: 'break', id: i, start: minsToTime(currentMins), end: minsToTime(currentMins + (bType === 'none' ? 0 : bDur)), duration: bType === 'none' ? 0 : bDur, bType });
         if (bType !== 'none') currentMins += bDur;
      }
      return timeline;
   }, [scheduleConfig]);

   const updateStructure = (updates: Partial<ScheduleConfig['structure']>) => setScheduleConfig(prev => ({ ...prev, structure: { ...prev.structure, ...updates } }));

   const toggleStage = (stage: SchoolStage) => {
      const current = scheduleConfig.structure.activeStages || ['primary'];
      const next = current.includes(stage) ? current.filter(s => s !== stage) : [...current, stage];
      updateStructure({ activeStages: next.length > 0 ? next : ['primary'] });
   };

   const handleRebuildStructure = () => {
      if (!window.confirm("تحذير: سيقوم هذا الإجراء بمسح كافة الفصول الحالية وإعادة إنشائها بناءً على الإعدادات الجديدة. هل أنت متأكد؟")) return;
      setIsGenerating(true);
      setTimeout(() => {
         const newClasses: ClassItem[] = [];
         const { generalCounts, specialCounts, namingConvention, mergeSpecialNaming, activeStages } = scheduleConfig.structure;

         const getSuffix = (idx: number, type: 'alpha' | 'numeric') => {
            return type === 'alpha' ? ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"][idx] : (idx + 1).toString();
         }

         const enabledIndices: number[] = [];
         if (activeStages.includes('primary')) enabledIndices.push(0, 1, 2, 3, 4, 5);
         if (activeStages.includes('middle')) enabledIndices.push(6, 7, 8);
         if (activeStages.includes('secondary')) enabledIndices.push(9, 10, 11);

         for (let g = 1; g <= 12; g++) {
            const index = g - 1;
            if (!enabledIndices.includes(index)) continue;

            const genCount = generalCounts[index] || 0;
            const specCount = specialCounts[index] || 0;

            // Use Clean Arabic Name (e.g., الأول, الثاني) - FIX: Use pure ordinal name for ALL grades
            const gradeName = ARABIC_ORDINALS[index] || GRADES_AR[index];

            let currentSuffixIdx = 0;

            for (let i = 0; i < genCount; i++) {
               const suffix = getSuffix(currentSuffixIdx, namingConvention);
               newClasses.push({
                  id: `${g}-${suffix}`, // Technical ID
                  name: `${gradeName} ${suffix}`, // Display Name: الأول أ (Clean)
                  gradeLevel: g,
                  type: 'general',
                  requiresAssistant: g <= scheduleConfig.structure.lowerStageEnd
               });
               currentSuffixIdx++;
            }

            for (let i = 0; i < specCount; i++) {
               let name = "";
               let idSuffix = "";

               if (mergeSpecialNaming) {
                  const suffix = getSuffix(currentSuffixIdx, namingConvention);
                  name = `${gradeName} ${suffix}`;
                  idSuffix = `${g}-${suffix}`;
                  currentSuffixIdx++;
               } else {
                  const suffix = (i + 1).toString();
                  name = `${gradeName} (خاص ${suffix})`;
                  idSuffix = `${g}-S${suffix}`;
               }

               newClasses.push({
                  id: idSuffix,
                  name: name,
                  gradeLevel: g,
                  type: 'special',
                  requiresAssistant: true
               });
            }
         }
         setClasses(newClasses);
         setIsGenerating(false);
         addToast("تم تحديث هيكلية المدرسة واعتماد أسماء الصفوف الجديدة", "success");
      }, 800);
   };

   const handleAddRole = () => {
      const newRole: Role = { id: `role_${Date.now()}`, label: 'منصب جديد', defaultHours: 36, permissions: ['VIEW_SCHEDULE'], workloadDetails: { actual: 26, individual: 5, stay: 5 } };
      setRoles(prev => [...prev, newRole]);
      setEditingRoleId(newRole.id);
   };

   const updateRole = (roleId: string, updates: Partial<Role>) => setRoles(prev => prev.map(r => r.id === roleId ? { ...r, ...updates } : r));

   const togglePermission = (roleId: string, permId: string) => {
      const role = roles.find(r => r.id === roleId);
      if (!role) return;
      updateRole(roleId, { permissions: role.permissions.includes(permId) ? role.permissions.filter(p => p !== permId) : [...role.permissions, permId] });
   };

   const handleAddWeightedMode = () => {
      const id = `mode_${Date.now()}`;
      const newMode: ModeConfig = {
         id, name: 'نمط احتمالي مخصص', isActive: false, target: 'all', affectedGradeLevels: [], affectedClassIds: [],
         affectedPeriods: [1, 2, 3, 4, 5, 6, 7], affectedBreaks: [], breakAction: 'none', mergeStrategy: 'advance_second',
         simulationMode: false, policyVersion: '1.0',
         goldenRules: [], policyRules: [],
         priorityLadder: [
            { id: `step_${Date.now()}`, order: 1, label: 'الطبقة الأساسية', weightPercentage: 100, probabilityBias: 0, criteria: { staffCategory: 'any', teacherType: 'any', relationship: 'none', slotState: 'any', selectionReason: 'any' }, enabled: true }
         ]
      };
      setEngineContext(prev => ({ ...prev, [id]: newMode }));
      setEditingModeId(id);
      addToast("تم إنشاء نمط احتمالي جديد مع مصفوفة أوزان");
   };

   const handleImportSave = (result: ImportResult) => {
      if (!setEmployees || !setLessons) {
         addToast("وظيفة الاستيراد غير مفعلة حالياً في هذا السياق", "error");
         return;
      }

      const { teachers, timetable } = result;

      setEmployees(prev => {
         const newEmployees = [...prev];
         let addedCount = 0;
         let duplicateCount = 0;

         teachers.forEach((t) => {
            // Robust Check: Normalize name AND check for ID collision
            const normName = normalizeArabic(t.name);
            const exists = newEmployees.some(e =>
               normalizeArabic(e.name) === normName ||
               (t.nationalId && e.nationalId === t.nationalId)
            );

            if (!exists) {
               newEmployees.push({
                  id: Date.now() + Math.random(),
                  nationalId: t.nationalId || String(Date.now() + Math.random()).slice(-9),
                  name: t.name,
                  baseRoleId: 'teachers',
                  contractedHours: 36,
                  workload: { actual: 0, individual: 0, stay: 0 },
                  addons: { educator: false, coordinators: [] },
                  constraints: { cannotCoverAlone: false, isExternal: t.isExternal || false },
                  subjects: t.subject ? [t.subject] : []
               });
               addedCount++;
            } else {
               duplicateCount++;
            }
         });

         if (addedCount > 0) addToast(`تم تسجيل ${addedCount} معلم جديد في النظام`, "success");
         if (duplicateCount > 0) addToast(`تم تجاهل ${duplicateCount} سجل لوجود تطابق مسبق`, "warning");

         return newEmployees;
      });

      setLessons(prevLessons => {
         let updatedLessons = [...prevLessons];
         const importedClassNames = new Set(timetable.map(t => t.className));

         updatedLessons = updatedLessons.filter(l => {
            const cls = classes.find(c => c.id === l.classId);
            return !cls || !importedClassNames.has(cls.name);
         });

         timetable.forEach(record => {
            const cls = classes.find(c => c.name === record.className);
            if (!cls) return;

            const newLesson: Lesson = {
               id: `L-${Date.now()}-${Math.random()}`,
               day: record.day,
               period: record.period,
               teacherId: 0,
               classId: cls.id,
               subject: record.subject,
               type: record.type,
               teacherRole: record.teacherRole
            };

            updatedLessons.push(newLesson);
         });

         return updatedLessons;
      });

      addToast(`تم معالجة الجدول. يرجى مراجعة صفحة "الجدول الدراسي" لربط المعلمين الجدد.`, "info");
   };

   const handleClearData = () => {
      if (window.confirm("تحذير أمني: هل أنت متأكد من رغبتك في حذف كافة بيانات المعلمين والحصص الدراسية؟\n\nهذا الإجراء لا يمكن التراجع عنه ويستخدم عادة قبل استيراد ملفات جديدة بالكامل.")) {
         if (setEmployees) setEmployees([]);
         if (setLessons) setLessons([]);
         addToast("تم حذف سجلات المعلمين والجداول بنجاح. النظام جاهز للاستيراد.", "success");
      }
   };

   return (
      <div className="space-y-10 animate-fade-in pb-20 max-w-7xl mx-auto" dir="rtl">
         {/* 🚀 ELITE SETTINGS HEADER */}
         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-10 lg:p-12 rounded-[4rem] border border-slate-100 shadow-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-indigo-600/5 rounded-bl-[20rem] -mr-40 -mt-40 group-hover:scale-105 transition-transform duration-1000"></div>
            <div className="relative z-10">
               <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter flex items-center gap-6">
                  <div className="p-5 bg-indigo-600 text-white rounded-[2.5rem] shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50"><SettingsIcon size={40} /></div>
                  مركز السياسات المدرسية
               </h2>
               <p className="text-slate-400 mt-4 font-bold text-lg md:text-xl md:mr-24 italic leading-relaxed max-w-lg">
                  هندسة الرتب الوظيفية، ضبط التدفق الزمني، والتحكم بخوارزميات الأنماط التشغيلية.
               </p>
            </div>
            <div className="flex p-3 bg-slate-100 rounded-[3rem] shadow-inner gap-2 relative z-10 overflow-x-auto custom-scrollbar max-w-full pb-4 md:pb-3 w-full lg:w-auto">
               {[
                  { id: 'identity', label: 'الهوية والزمن', icon: Landmark },
                  { id: 'structure', label: 'باني الهيكلية', icon: ListTree },
                  { id: 'roles', label: 'المناصب والوصول', icon: ShieldIcon },
                  { id: 'protocol', label: 'محرك البروتوكول', icon: Cpu },
                  { id: 'import', label: 'استيراد البيانات', icon: FileSpreadsheet }
               ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-4 px-6 md:px-8 py-4 md:py-5 rounded-[2rem] font-black text-sm transition-all whitespace-nowrap btn-press ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-2xl scale-105 ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                     <tab.icon size={20} /> {tab.label}
                  </button>
               ))}
            </div>
         </div>

         {/* 🏛️ TAB 1: IDENTITY & TIME FLOW ENGINEERING */}
         {activeTab === 'identity' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-slide-up">
               {/* Column 1: Identity & Calendar */}
               <div className="xl:col-span-1 space-y-8">
                  <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8">
                     <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><School size={24} className="text-indigo-600" /> الهوية الرقمية</h3>
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">اسم المؤسسة</label>
                           <input className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-slate-800 focus:bg-white focus:border-indigo-500 transition-all outline-none shadow-inner" value={scheduleConfig.schoolInfo?.name} onChange={e => updateSchoolInfo({ name: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">شعار المؤسسة</label>
                           <div className="flex gap-4 items-center">
                              {scheduleConfig.schoolInfo?.logo && (
                                 <div className="w-20 h-20 rounded-[1.5rem] border-2 border-slate-100 p-2 bg-white shadow-sm flex items-center justify-center overflow-hidden relative group shrink-0">
                                    <img src={scheduleConfig.schoolInfo.logo} alt="School Logo" className="max-w-full max-h-full object-contain" />
                                    <button
                                       onClick={() => updateSchoolInfo({ logo: undefined })}
                                       className="absolute inset-0 bg-rose-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                                    >
                                       <Trash2 size={20} />
                                    </button>
                                 </div>
                              )}
                              <label className="flex-1 cursor-pointer">
                                 <div className="w-full p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 group">
                                    <Upload size={24} className="group-hover:scale-110 transition-transform mb-1" />
                                    <span className="text-[10px] font-black text-center">اضغط لرفع صورة الشعار (من الجهاز)</span>
                                 </div>
                                 <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                              </label>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8">
                     <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><CalendarDays size={24} className="text-indigo-600" /> ضبط التقويم</h3>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
                           <span className="text-xs font-black text-slate-500 mr-2">بداية الأسبوع</span>
                           <select
                              className="bg-white px-4 py-2 rounded-xl text-xs font-black text-indigo-700 outline-none border border-slate-200"
                              value={scheduleConfig.weekStartDay}
                              onChange={(e) => updateConfig({ weekStartDay: e.target.value })}
                           >
                              {DAYS_AR.map(d => <option key={d} value={d}>{d}</option>)}
                           </select>
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">أيام العطلة الرسمية</label>
                           <div className="flex flex-wrap gap-2">
                              {DAYS_AR.map(d => (
                                 <button key={d} onClick={() => toggleHoliday(d)} className={`px-4 py-3 rounded-2xl text-[10px] font-black border-2 transition-all ${scheduleConfig.holidays.includes(d) ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>{d}</button>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Column 2 & 3: Time Flow Engineering */}
               <div className="xl:col-span-2 bg-slate-900 p-10 rounded-[4rem] shadow-2xl relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-bl-[10rem] pointer-events-none blur-3xl"></div>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 relative z-10 gap-6">
                     <div>
                        <h3 className="text-2xl md:text-3xl font-black text-white flex items-center gap-4"><Workflow size={32} className="text-emerald-400" /> هندسة التدفق الزمني</h3>
                        <p className="text-slate-400 mt-2 font-bold text-sm">Time Flow Engineering Matrix</p>
                     </div>
                     <div className="flex items-center gap-4 bg-white/5 p-2 rounded-[2rem] border border-white/10 backdrop-blur-md self-start md:self-auto">
                        <div className="flex flex-col items-center px-4 border-l border-white/10">
                           <span className="text-[9px] font-black text-slate-400 uppercase">بداية الدوام</span>
                           <input type="time" className="bg-transparent text-white font-black text-lg outline-none w-24 text-center" value={scheduleConfig.schoolStartTime} onChange={e => updateConfig({ schoolStartTime: e.target.value })} />
                        </div>
                        <div className="flex flex-col items-center px-4 border-l border-white/10">
                           <span className="text-[9px] font-black text-slate-400 uppercase">عدد الحصص</span>
                           <div className="flex items-center gap-2">
                              <button onClick={() => updateConfig({ periodsPerDay: Math.max(1, scheduleConfig.periodsPerDay - 1) })} className="text-slate-400 hover:text-white"><MinusSquare size={16} /></button>
                              <span className="text-white font-black text-lg">{scheduleConfig.periodsPerDay}</span>
                              <button onClick={() => updateConfig({ periodsPerDay: scheduleConfig.periodsPerDay + 1 })} className="text-slate-400 hover:text-white"><PlusSquare size={16} /></button>
                           </div>
                        </div>
                        {/* Morning Break Toggle */}
                        <div className="flex flex-col items-center px-4">
                           <span className="text-[9px] font-black text-slate-400 uppercase">استراحة صباحية</span>
                           <button
                              onClick={() => updateConfig({
                                 morningBreak: {
                                    enabled: !scheduleConfig.morningBreak?.enabled,
                                    duration: scheduleConfig.morningBreak?.duration || 15,
                                    type: scheduleConfig.morningBreak?.type || 'short'
                                 }
                              })}
                              className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${scheduleConfig.morningBreak?.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                           >
                              {scheduleConfig.morningBreak?.enabled ? '✅ مفعّل' : 'معطّل'}
                           </button>
                        </div>
                     </div>
                  </div>

                  {/* The Matrix Vertical Flow */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative z-10 space-y-2">
                     {calculatedTimeline.map((slot, idx) => (
                        <div key={`${slot.type}-${slot.id}`} className={`flex items-center gap-6 transition-all group ${slot.type === 'break' && slot.bType === 'none' ? 'opacity-30 hover:opacity-100' : ''}`}>
                           {/* Time Label */}
                           <div className="w-24 text-right">
                              <span className="block text-white font-black text-sm ltr font-mono">{slot.start}</span>
                              <span className="block text-[10px] text-slate-500 font-bold ltr font-mono">{slot.end}</span>
                           </div>

                           {/* Timeline Node */}
                           <div className="relative flex flex-col items-center">
                              <div className={`w-4 h-4 rounded-full border-2 z-10 ${slot.type === 'period' ? 'bg-indigo-500 border-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]' :
                                 slot.type === 'morning_break' ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                    slot.bType !== 'none' ? 'bg-amber-500 border-amber-300' : 'bg-slate-700 border-slate-600'
                                 }`}></div>
                              {idx !== calculatedTimeline.length - 1 && <div className="w-0.5 h-16 bg-white/10 absolute top-4"></div>}
                           </div>

                           {/* Card Config */}
                           <div className={`flex-1 p-4 rounded-[2rem] border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 ${slot.type === 'period' ? 'bg-white/5 border-white/10 hover:bg-white/10' :
                              slot.type === 'morning_break' ? 'bg-emerald-500/10 border-emerald-500/30' :
                                 slot.bType !== 'none' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-transparent border-transparent hover:bg-white/5'
                              }`}>
                              <div className="flex items-center gap-4">
                                 <div className={`p-3 rounded-2xl ${slot.type === 'period' ? 'bg-indigo-600 text-white' :
                                    slot.type === 'morning_break' ? 'bg-emerald-600 text-white' :
                                       'bg-slate-800 text-slate-400'
                                    }`}>
                                    {slot.type === 'period' ? <span className="font-black text-sm">{slot.id}</span> :
                                       slot.type === 'morning_break' ? <Sun size={16} /> : <Coffee size={16} />}
                                 </div>
                                 <div>
                                    <span className={`text-sm font-black block ${slot.type === 'period' ? 'text-white' :
                                       slot.type === 'morning_break' ? 'text-emerald-400' :
                                          'text-amber-400'
                                       }`}>
                                       {slot.type === 'period' ? `الحصة ${slot.id}` :
                                          slot.type === 'morning_break' ? 'استراحة صباحية (مناوبة)' :
                                             slot.bType === 'long' ? 'استراحة رئيسية' : slot.bType === 'short' ? 'استراحة قصيرة' : 'فاصل زمني'}
                                    </span>
                                    {slot.type === 'period' && <span className="text-[10px] text-slate-500 font-bold">مدة تعليمية</span>}
                                    {slot.type === 'morning_break' && <span className="text-[10px] text-emerald-500 font-bold">قبل الحصة الأولى</span>}
                                 </div>
                              </div>

                              <div className="flex items-center gap-4 self-end md:self-auto">
                                 {slot.type === 'period' ? (
                                    <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/5">
                                       <input
                                          type="number"
                                          className="bg-transparent text-white font-black text-center w-12 outline-none text-sm"
                                          value={slot.duration}
                                          onChange={(e) => updatePeriodDuration(slot.id, parseInt(e.target.value))}
                                       />
                                       <span className="text-[9px] text-slate-500 font-bold px-2 border-r border-white/10">دقيقة</span>
                                    </div>
                                 ) : slot.type === 'morning_break' ? (
                                    /* Morning Break Controls */
                                    <div className="flex items-center gap-2">
                                       <div className="flex bg-slate-800 p-1 rounded-xl">
                                          <button onClick={() => updateConfig({ morningBreak: { ...scheduleConfig.morningBreak!, type: 'short' } })} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${slot.bType === 'short' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>قصيرة</button>
                                          <button onClick={() => updateConfig({ morningBreak: { ...scheduleConfig.morningBreak!, type: 'long' } })} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${slot.bType === 'long' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>طويلة</button>
                                       </div>
                                       <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/5 w-16">
                                          <input
                                             type="number"
                                             className="bg-transparent text-white font-black text-center w-full outline-none text-xs"
                                             value={slot.duration}
                                             onChange={(e) => updateConfig({ morningBreak: { ...scheduleConfig.morningBreak!, duration: parseInt(e.target.value) || 0 } })}
                                          />
                                          <span className="text-[9px] text-slate-500 font-bold px-1 border-r border-white/10">د</span>
                                       </div>
                                    </div>
                                 ) : (
                                    <div className="flex items-center gap-2">
                                       <div className="flex bg-slate-800 p-1 rounded-xl">
                                          <button onClick={() => updateBreakType(slot.id, 'none')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${slot.bType === 'none' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>لا يوجد</button>
                                          <button onClick={() => updateBreakType(slot.id, 'short')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${slot.bType === 'short' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>قصيرة</button>
                                          <button onClick={() => updateBreakType(slot.id, 'long')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${slot.bType === 'long' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>طويلة</button>
                                       </div>
                                       {slot.bType !== 'none' && (
                                          <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/5 w-16">
                                             <input
                                                type="number"
                                                className="bg-transparent text-white font-black text-center w-full outline-none text-xs"
                                                value={slot.duration}
                                                onChange={(e) => updateBreakDuration(slot.id, parseInt(e.target.value) || 0)}
                                             />
                                             <span className="text-[9px] text-slate-500 font-bold px-1 border-r border-white/10">د</span>
                                          </div>
                                       )}
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         )}

         {/* 🏗️ STRUCTURE BUILDER */}
         {activeTab === 'structure' && (
            <div className="space-y-10 animate-slide-up">
               <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-emerald-50 to-transparent pointer-events-none"></div>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 relative z-10 gap-6">
                     <div>
                        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Layers size={28} className="text-emerald-600" /> باني الهيكلية الصفية</h3>
                        <p className="text-slate-400 font-bold mt-2">Class Structure Generator Engine</p>
                     </div>
                     <div className="flex flex-col gap-4 items-end">
                        <div className="flex bg-slate-100 p-1.5 rounded-[2rem] shadow-inner">
                           <button onClick={() => updateStructure({ namingConvention: 'alpha' })} className={`px-6 py-3 rounded-[1.5rem] text-xs font-black transition-all ${scheduleConfig.structure.namingConvention === 'alpha' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>نظام أبجدي (أ، ب)</button>
                           <button onClick={() => updateStructure({ namingConvention: 'numeric' })} className={`px-6 py-3 rounded-[1.5rem] text-xs font-black transition-all ${scheduleConfig.structure.namingConvention === 'numeric' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>نظام رقمي (1، 2)</button>
                        </div>
                        <label className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 cursor-pointer">
                           <input
                              type="checkbox"
                              className="w-4 h-4 accent-emerald-600"
                              checked={scheduleConfig.structure.mergeSpecialNaming}
                              onChange={(e) => updateStructure({ mergeSpecialNaming: e.target.checked })}
                           />
                           <span className="text-[10px] font-black text-slate-600">دمج تسلسل التربية الخاصة</span>
                        </label>
                     </div>
                  </div>

                  {/* School Stages Selection */}
                  <div className="mb-10 relative z-10 space-y-4">
                     <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Target size={14} /> نطاق المراحل الدراسية</h4>
                     <div className="flex flex-wrap gap-4">
                        <button
                           onClick={() => toggleStage('primary')}
                           className={`px-6 py-3 rounded-2xl border-2 transition-all font-black text-xs flex items-center gap-2 ${scheduleConfig.structure.activeStages?.includes('primary') ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200'}`}
                        >
                           <Baby size={16} /> الابتدائية (1-6)
                        </button>
                        <button
                           onClick={() => toggleStage('middle')}
                           className={`px-6 py-3 rounded-2xl border-2 transition-all font-black text-xs flex items-center gap-2 ${scheduleConfig.structure.activeStages?.includes('middle') ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-200'}`}
                        >
                           <School size={16} /> الإعدادية (7-9)
                        </button>
                        <button
                           onClick={() => toggleStage('secondary')}
                           className={`px-6 py-3 rounded-2xl border-2 transition-all font-black text-xs flex items-center gap-2 ${scheduleConfig.structure.activeStages?.includes('secondary') ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-200 text-slate-400 hover:border-amber-200'}`}
                        >
                           <GraduationCap size={16} /> الثانوية (10-12)
                        </button>
                     </div>
                  </div>

                  {/* Lower Stage Selector */}
                  <div className="mb-10 relative z-10 flex flex-wrap items-center gap-4 bg-emerald-50/50 p-4 rounded-[2rem] border border-emerald-100">
                     <span className="text-xs font-black text-emerald-800">نهاية الطفولة المبكرة / الطبقة الصغرى:</span>
                     <div className="flex gap-2">
                        {[1, 2, 3, 4, 5, 6].map(g => (
                           <button
                              key={g}
                              onClick={() => updateStructure({ lowerStageEnd: g })}
                              className={`w-8 h-8 rounded-lg text-xs font-black transition-all border ${scheduleConfig.structure.lowerStageEnd === g ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                           >
                              {g}
                           </button>
                        ))}
                     </div>
                     <span className="text-[10px] font-bold text-emerald-600 mr-2 w-full md:w-auto">
                        (الصفوف حتى {GRADES_AR[scheduleConfig.structure.lowerStageEnd - 1]} تتطلب وجود مساعد)
                     </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                     {GRADES_AR.map((grade, idx) => {
                        const isPrimary = idx >= 0 && idx <= 5;
                        const isMiddle = idx >= 6 && idx <= 8;
                        const isSecondary = idx >= 9 && idx <= 11;
                        const activeStages = scheduleConfig.structure.activeStages || ['primary'];

                        if (isPrimary && !activeStages.includes('primary')) return null;
                        if (isMiddle && !activeStages.includes('middle')) return null;
                        if (isSecondary && !activeStages.includes('secondary')) return null;

                        return (
                           <div key={grade} className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all group animate-slide-up">
                              <div className="flex justify-between items-center mb-6">
                                 <span className="font-black text-slate-800 text-xl">{grade}</span>
                                 <span className={`text-[9px] font-black px-3 py-1 rounded-full border shadow-sm ${idx < scheduleConfig.structure.lowerStageEnd ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-400 border-slate-100'}`}>
                                    {idx < scheduleConfig.structure.lowerStageEnd ? 'طبقة صغرى' : `Grade ${idx + 1}`}
                                 </span>
                              </div>

                              <div className="space-y-4">
                                 <div className="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm group-hover:border-emerald-100 transition-all">
                                    <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-2"><Users size={14} /> تربية عادية</span>
                                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1">
                                       <button onClick={() => { const newCounts = [...scheduleConfig.structure.generalCounts]; newCounts[idx] = Math.max(0, (newCounts[idx] || 0) - 1); updateStructure({ generalCounts: newCounts }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 shadow-sm flex items-center justify-center transition-all"><MinusSquare size={16} /></button>
                                       <span className="font-black text-emerald-600 w-6 text-center text-lg">{scheduleConfig.structure.generalCounts[idx] || 0}</span>
                                       <button onClick={() => { const newCounts = [...scheduleConfig.structure.generalCounts]; newCounts[idx] = (newCounts[idx] || 0) + 1; updateStructure({ generalCounts: newCounts }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-emerald-500 shadow-sm flex items-center justify-center transition-all"><PlusSquare size={16} /></button>
                                    </div>
                                 </div>

                                 <div className="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm group-hover:border-emerald-100 transition-all">
                                    <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-2"><HeartHandshake size={14} /> تربية خاصة</span>
                                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1">
                                       <button onClick={() => { const newCounts = [...scheduleConfig.structure.specialCounts]; newCounts[idx] = Math.max(0, (newCounts[idx] || 0) - 1); updateStructure({ specialCounts: newCounts }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 shadow-sm flex items-center justify-center transition-all"><MinusSquare size={16} /></button>
                                       <span className="font-black text-indigo-600 w-6 text-center text-lg">{scheduleConfig.structure.specialCounts[idx] || 0}</span>
                                       <button onClick={() => { const newCounts = [...scheduleConfig.structure.specialCounts]; newCounts[idx] = (newCounts[idx] || 0) + 1; updateStructure({ specialCounts: newCounts }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-emerald-500 shadow-sm flex items-center justify-center transition-all"><PlusSquare size={16} /></button>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>

                  <div className="mt-12 pt-8 border-t border-slate-100 flex justify-end relative z-10">
                     <button
                        onClick={handleRebuildStructure}
                        disabled={isGenerating}
                        className="bg-slate-900 text-white px-10 py-5 rounded-[2.5rem] font-black text-sm shadow-2xl hover:bg-emerald-600 hover:shadow-emerald-200 transition-all flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed btn-press"
                     >
                        {isGenerating ? <RefreshCcw className="animate-spin" size={20} /> : <Wand2 size={20} />}
                        {isGenerating ? 'جاري بناء قاعدة البيانات...' : 'إعادة توليد الهيكلية المدرسية'}
                     </button>
                  </div>

                  {/* QUICK CLASS TYPE EDITOR */}
                  {classes.length > 0 && (
                     <div className="mt-8 pt-8 border-t border-slate-100 relative z-10">
                        <h4 className="text-sm font-black text-slate-600 mb-4 flex items-center gap-2">
                           <ListTree size={16} /> إدارة الصفوف ({classes.length} صف)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                           {classes.map(cls => (
                              <button
                                 key={cls.id}
                                 onClick={() => {
                                    const newClasses = classes.map(c =>
                                       c.id === cls.id
                                          ? { ...c, type: c.type === 'special' ? 'general' : 'special' }
                                          : c
                                    );
                                    setClasses(newClasses);
                                    addToast(`تم تغيير ${cls.name} إلى ${cls.type === 'special' ? 'عادي' : 'خاص'}`, 'success');
                                 }}
                                 className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border-2 ${cls.type === 'special'
                                    ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                              >
                                 {cls.name}
                                 {cls.type === 'special' && <span className="mr-1 text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded">خاص</span>}
                              </button>
                           ))}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-2">اضغط على الصف للتبديل بين عادي/خاص</p>
                     </div>
                  )}
               </div>

               {/* CLASS ASSISTANTS CONFIGURATION */}
               <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-48 h-48 bg-blue-50 rounded-br-[6rem] -mt-10 -ml-10"></div>
                  <div className="relative z-10">
                     <div className="flex items-center justify-between mb-8">
                        <div>
                           <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                              <User size={28} className="text-blue-600" /> المساعدون في الصفوف
                           </h3>
                           <p className="text-slate-400 font-bold mt-2">تحديد الصفوف التي تحتوي على مساعدين</p>
                        </div>
                        <div className="flex gap-2 text-xs font-black">
                           <button
                              onClick={() => {
                                 const newAssistants = { ...(scheduleConfig.structure.classAssistants || {}) };
                                 classes.forEach(c => { newAssistants[c.id] = true; });
                                 updateStructure({ classAssistants: newAssistants });
                              }}
                              className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all"
                           >
                              ✓ تحديد الكل
                           </button>
                           <button
                              onClick={() => updateStructure({ classAssistants: {} })}
                              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all"
                           >
                              ✕ إلغاء الكل
                           </button>
                        </div>
                     </div>

                     {/* Toggle: Separate Special Classes */}
                     <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <label className="flex items-center gap-3 cursor-pointer">
                           <input
                              type="checkbox"
                              className="w-5 h-5 accent-amber-600"
                              checked={scheduleConfig.structure.separateSpecialClasses || false}
                              onChange={(e) => updateStructure({ separateSpecialClasses: e.target.checked })}
                           />
                           <div>
                              <span className="text-sm font-black text-amber-700">فصل صفوف التربية الخاصة في قسم منفصل</span>
                              <p className="text-[10px] text-amber-600 mt-0.5">عند التفعيل: تظهر صلوف التربية الخاصة في قسم خاص بها</p>
                           </div>
                        </label>
                     </div>

                     {/* Group by Stage */}
                     {(() => {
                        const lowerEnd = scheduleConfig.structure.lowerStageEnd || 6;
                        const separateSpecial = scheduleConfig.structure.separateSpecialClasses || false;

                        // Sort classes: general first, then special
                        const sortByType = (a: any, b: any) => {
                           if (a.type === 'general' && b.type === 'special') return -1;
                           if (a.type === 'special' && b.type === 'general') return 1;
                           return 0;
                        };

                        const lowerClasses = separateSpecial
                           ? classes.filter(c => c.type === 'general' && (c.gradeLevel || 0) <= lowerEnd)
                           : classes.filter(c => (c.gradeLevel || 0) <= lowerEnd).sort(sortByType);

                        const upperClasses = separateSpecial
                           ? classes.filter(c => c.type === 'general' && (c.gradeLevel || 0) > lowerEnd)
                           : classes.filter(c => (c.gradeLevel || 0) > lowerEnd).sort(sortByType);

                        const specialClasses = separateSpecial
                           ? classes.filter(c => c.type === 'special')
                           : [];

                        return (
                           <div className="space-y-6">
                              {/* Lower Stage */}
                              {lowerClasses.length > 0 && (
                                 <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-200">
                                    <div className="flex items-center justify-between mb-4">
                                       <h4 className="text-sm font-black text-emerald-700 flex items-center gap-2">
                                          <Baby size={16} /> الطبقة الصغرى (1-{lowerEnd})
                                       </h4>
                                       <button
                                          onClick={() => {
                                             const newAssistants = { ...(scheduleConfig.structure.classAssistants || {}) };
                                             const allChecked = lowerClasses.every(cls => newAssistants[cls.id]);
                                             lowerClasses.forEach(cls => {
                                                if (allChecked) {
                                                   delete newAssistants[cls.id];
                                                } else {
                                                   newAssistants[cls.id] = true;
                                                }
                                             });
                                             updateStructure({ classAssistants: newAssistants });
                                          }}
                                          className="text-[10px] font-bold px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
                                       >
                                          {lowerClasses.every(cls => scheduleConfig.structure.classAssistants?.[cls.id]) ? '✕ إلغاء الكل' : '✓ تحديد الكل'}
                                       </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                       {lowerClasses.map(cls => (
                                          <label key={cls.id} className={`flex items-center gap-2 bg-white p-3 rounded-xl border ${cls.type === 'special' ? 'border-green-300 bg-green-50' : 'border-emerald-100'} hover:border-emerald-300 cursor-pointer transition-all group`}>
                                             <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-emerald-600"
                                                checked={scheduleConfig.structure.classAssistants?.[cls.id] || false}
                                                onChange={(e) => {
                                                   const newAssistants = { ...(scheduleConfig.structure.classAssistants || {}) };
                                                   if (e.target.checked) {
                                                      newAssistants[cls.id] = true;
                                                   } else {
                                                      delete newAssistants[cls.id];
                                                   }
                                                   updateStructure({ classAssistants: newAssistants });
                                                }}
                                             />
                                             <span className={`text-xs font-bold ${cls.type === 'special' ? 'text-green-700' : 'text-slate-700'} group-hover:text-emerald-700 transition-all`}>{cls.name}</span>
                                          </label>
                                       ))}
                                    </div>
                                 </div>
                              )}

                              {/* Upper Stage */}
                              {upperClasses.length > 0 && (
                                 <div className="bg-indigo-50 p-6 rounded-[2.5rem] border border-indigo-200">
                                    <div className="flex items-center justify-between mb-4">
                                       <h4 className="text-sm font-black text-indigo-700 flex items-center gap-2">
                                          <GraduationCap size={16} /> الطبقة الكبرى ({lowerEnd + 1}+)
                                       </h4>
                                       <button
                                          onClick={() => {
                                             const newAssistants = { ...(scheduleConfig.structure.classAssistants || {}) };
                                             const allChecked = upperClasses.every(cls => newAssistants[cls.id]);
                                             upperClasses.forEach(cls => {
                                                if (allChecked) {
                                                   delete newAssistants[cls.id];
                                                } else {
                                                   newAssistants[cls.id] = true;
                                                }
                                             });
                                             updateStructure({ classAssistants: newAssistants });
                                          }}
                                          className="text-[10px] font-bold px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                                       >
                                          {upperClasses.every(cls => scheduleConfig.structure.classAssistants?.[cls.id]) ? '✕ إلغاء الكل' : '✓ تحديد الكل'}
                                       </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                       {upperClasses.map(cls => (
                                          <label key={cls.id} className={`flex items-center gap-2 bg-white p-3 rounded-xl border ${cls.type === 'special' ? 'border-green-300 bg-green-50' : 'border-indigo-100'} hover:border-indigo-300 cursor-pointer transition-all group`}>
                                             <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-indigo-600"
                                                checked={scheduleConfig.structure.classAssistants?.[cls.id] || false}
                                                onChange={(e) => {
                                                   const newAssistants = { ...(scheduleConfig.structure.classAssistants || {}) };
                                                   if (e.target.checked) {
                                                      newAssistants[cls.id] = true;
                                                   } else {
                                                      delete newAssistants[cls.id];
                                                   }
                                                   updateStructure({ classAssistants: newAssistants });
                                                }}
                                             />
                                             <span className={`text-xs font-bold ${cls.type === 'special' ? 'text-green-700' : 'text-slate-700'} group-hover:text-indigo-700 transition-all`}>{cls.name}</span>
                                          </label>
                                       ))}
                                    </div>
                                 </div>
                              )}

                              {/* Special Education (Separate Section) */}
                              {specialClasses.length > 0 && (
                                 <div className="bg-amber-50 p-6 rounded-[2.5rem] border border-amber-200">
                                    <div className="flex items-center justify-between mb-4">
                                       <h4 className="text-sm font-black text-amber-700 flex items-center gap-2">
                                          <HeartHandshake size={16} /> التربية الخاصة
                                       </h4>
                                       <button
                                          onClick={() => {
                                             const newAssistants = { ...(scheduleConfig.structure.classAssistants || {}) };
                                             const allChecked = specialClasses.every(cls => newAssistants[cls.id]);
                                             specialClasses.forEach(cls => {
                                                if (allChecked) {
                                                   delete newAssistants[cls.id];
                                                } else {
                                                   newAssistants[cls.id] = true;
                                                }
                                             });
                                             updateStructure({ classAssistants: newAssistants });
                                          }}
                                          className="text-[10px] font-bold px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all"
                                       >
                                          {specialClasses.every(cls => scheduleConfig.structure.classAssistants?.[cls.id]) ? '✕ إلغاء الكل' : '✓ تحديد الكل'}
                                       </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                       {specialClasses.map(cls => (
                                          <label key={cls.id} className="flex items-center gap-2 bg-white p-3 rounded-xl border border-amber-100 hover:border-amber-300 cursor-pointer transition-all group">
                                             <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-amber-600"
                                                checked={scheduleConfig.structure.classAssistants?.[cls.id] || false}
                                                onChange={(e) => {
                                                   const newAssistants = { ...(scheduleConfig.structure.classAssistants || {}) };
                                                   if (e.target.checked) {
                                                      newAssistants[cls.id] = true;
                                                   } else {
                                                      delete newAssistants[cls.id];
                                                   }
                                                   updateStructure({ classAssistants: newAssistants });
                                                }}
                                             />
                                             <span className="text-xs font-bold text-slate-700 group-hover:text-amber-700 transition-all">{cls.name}</span>
                                          </label>
                                       ))}
                                    </div>
                                 </div>
                              )}
                           </div>
                        );
                     })()}
                  </div>
               </div>
            </div>
         )}

         {/* 🔐 TAB 3: ROLES & PERMISSIONS */}
         {activeTab === 'roles' && (
            <div className="space-y-10 animate-slide-up">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {roles.map(role => (
                     <div key={role.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[6rem] -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10 flex justify-between items-start mb-8">
                           <div className="p-4 bg-white rounded-[1.5rem] text-indigo-600 shadow-md border border-indigo-50"><ShieldCheck size={28} /></div>
                           <div className="flex gap-2">
                              <button onClick={() => setEditingRoleId(role.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl hover:bg-indigo-50 transition-all"><Edit3 size={18} /></button>
                              <button onClick={() => { const check = validateDeleteRole(role.id); if (check.canDelete) setRoles(prev => prev.filter(r => r.id !== role.id)); else addToast(check.reason || "Cannot delete", "error"); }} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-2xl hover:bg-rose-50 transition-all"><Trash2 size={18} /></button>
                           </div>
                        </div>
                        <div className="mb-8">
                           {editingRoleId === role.id ? (
                              <input className="w-full p-3 bg-indigo-50/50 border border-indigo-200 rounded-2xl font-black text-xl text-slate-800 outline-none focus:bg-white text-center" value={role.label} onChange={e => updateRole(role.id, { label: e.target.value })} autoFocus />
                           ) : (
                              <h4 className="text-2xl font-black text-slate-800 text-center">{role.label}</h4>
                           )}
                        </div>
                        <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 space-y-4 mb-6">
                           <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                              <span className="text-[10px] font-black text-slate-400 uppercase">ساعات العقد</span>
                              {editingRoleId === role.id ? (
                                 <input type="number" className="w-16 bg-white border border-slate-200 rounded-lg text-center font-black text-sm" value={role.defaultHours} onChange={e => updateRole(role.id, { defaultHours: parseInt(e.target.value) })} />
                              ) : (
                                 <span className="font-black text-indigo-600">{role.defaultHours}</span>
                              )}
                           </div>
                           <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                 <span className="block text-[8px] font-bold text-slate-400 mb-1">فعلي</span>
                                 {editingRoleId === role.id ? (
                                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg text-center font-bold text-xs" value={role.workloadDetails.actual} onChange={e => updateRole(role.id, { workloadDetails: { ...role.workloadDetails, actual: parseInt(e.target.value) } })} />
                                 ) : <span className="font-bold text-slate-700">{role.workloadDetails.actual}</span>}
                              </div>
                              <div>
                                 <span className="block text-[8px] font-bold text-slate-400 mb-1">فردي</span>
                                 {editingRoleId === role.id ? (
                                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg text-center font-bold text-xs" value={role.workloadDetails.individual} onChange={e => updateRole(role.id, { workloadDetails: { ...role.workloadDetails, individual: parseInt(e.target.value) } })} />
                                 ) : <span className="font-bold text-slate-700">{role.workloadDetails.individual}</span>}
                              </div>
                              <div>
                                 <span className="block text-[8px] font-bold text-slate-400 mb-1">مكوث</span>
                                 {editingRoleId === role.id ? (
                                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg text-center font-bold text-xs" value={role.workloadDetails.stay} onChange={e => updateRole(role.id, { workloadDetails: { ...role.workloadDetails, stay: parseInt(e.target.value) } })} />
                                 ) : <span className="font-bold text-slate-700">{role.workloadDetails.stay}</span>}
                              </div>
                           </div>
                        </div>
                        <div className="flex-1">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">صلاحيات الوصول</p>
                           <div className="flex flex-wrap justify-center gap-2">
                              {PERMISSION_OPTIONS.map(perm => {
                                 const isActive = role.permissions.includes(perm.id);
                                 return (
                                    <button key={perm.id} onClick={() => editingRoleId === role.id && togglePermission(role.id, perm.id)} disabled={editingRoleId !== role.id} className={`px-3 py-1.5 rounded-xl text-[9px] font-bold transition-all border ${isActive ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-300 border-slate-100'} ${editingRoleId === role.id ? 'cursor-pointer hover:border-indigo-300' : 'cursor-default opacity-80'}`}>{perm.label}</button>
                                 )
                              })}
                           </div>
                        </div>
                        {editingRoleId === role.id && (
                           <button onClick={() => setEditingRoleId(null)} className="mt-6 w-full py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-emerald-600 transition-all">حفظ التغييرات</button>
                        )}
                     </div>
                  ))}
                  <button onClick={handleAddRole} className="bg-slate-50 p-8 rounded-[3.5rem] border-4 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-6 group min-h-[500px]">
                     <div className="w-24 h-24 bg-white rounded-3xl shadow-sm flex items-center justify-center text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all"><Plus size={48} /></div>
                     <span className="font-black text-slate-400 group-hover:text-indigo-600 text-xl">تعريف منصب جديد</span>
                  </button>
               </div>
            </div>
         )}

         {/* 🔮 TAB 4: PROTOCOL ENGINE (UPDATED DASHBOARD) */}
         {activeTab === 'protocol' && (
            <div className="space-y-12 animate-slide-up pb-20">

               {/* Global Policy Block */}
               <div className="bg-indigo-900 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-bl-[100px] pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-tr-[100px] pointer-events-none"></div>

                  <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                     <div>
                        <h3 className="text-2xl font-black text-white flex items-center gap-4"><Globe size={32} className="text-emerald-400" /> السياسات المدرسية العليا (Standard Policies)</h3>
                        <p className="text-indigo-200 font-bold mt-2 max-w-2xl text-sm leading-relaxed">
                           القواعد القياسية المعتمدة في النظام. يتم حقن هذه القواعد تلقائياً داخل كل نمط تشغيلي لضمان الحد الأدنى من المعايير التربوية، مع إتاحة المجال للتخصيص حسب الحاجة.
                        </p>
                     </div>
                     <div className="flex gap-4">
                        <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/10 text-white font-black text-xs flex items-center gap-2">
                           <ShieldCheck size={16} className="text-emerald-400" /> مفعلة كقالب قياسي
                        </div>
                     </div>
                  </div>

                  {/* Standard Rule Info Card */}
                  <div className="mt-10 bg-white/10 backdrop-blur-md rounded-[2.5rem] p-8 flex items-center gap-6 border border-white/10">
                     <div className="p-4 bg-white/20 text-white rounded-2xl shrink-0"><AlertOctagon size={24} /></div>
                     <div className="flex-1">
                        <h4 className="text-lg font-black text-white mb-1">منع استغلال حصة المكوث (Standard Rule)</h4>
                        <p className="text-xs font-bold text-indigo-200 opacity-80">تم إدراج هذه القاعدة في جميع الأنماط بشكل افتراضي. يمكنك تعديل نسبة الصرامة الخاصة بها من داخل إعدادات النمط.</p>
                     </div>
                  </div>
               </div>

               {/* Modes Grid (Enhanced Cards) */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {(Object.values(engineContext) as ModeConfig[]).map((mode) => (
                     <div key={mode.id} className={`p-8 rounded-[3.5rem] border-2 transition-all relative overflow-hidden group flex flex-col ${mode.isActive ? 'bg-white border-indigo-500 shadow-2xl ring-4 ring-indigo-50' : 'bg-slate-50 border-slate-200 opacity-90 hover:opacity-100 hover:bg-white hover:shadow-lg'}`}>

                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[5rem] transition-all ${mode.isActive ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                           <div className="absolute top-6 right-6 text-white"><Cpu size={32} className={mode.isActive ? 'opacity-100' : 'opacity-40'} /></div>
                        </div>

                        <div className="relative z-10 pt-16 mb-6">
                           <h4 className="text-2xl font-black text-slate-900 mb-2">{mode.name}</h4>
                           <div className="flex gap-2">
                              <span className={`px-3 py-1 rounded-lg text-[10px] font-black border ${mode.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{mode.isActive ? 'نشط حالياً' : 'غير مفعل'}</span>
                              <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-white border border-slate-200 text-slate-500">v{mode.policyVersion || '1.0'}</span>
                           </div>
                        </div>

                        <div className="space-y-4 mb-8 flex-1">
                           {/* Event Type Binding Section */}
                           <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200">
                              <div className="flex items-center gap-2 mb-3">
                                 <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <ArrowRightLeft size={14} className="text-white" />
                                 </div>
                                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                    ربط التوزيع الآلي
                                 </label>
                              </div>
                              <select
                                 value={mode.linkedEventType || 'NONE'}
                                 onChange={(e) => {
                                    const newValue = e.target.value === 'NONE' ? null : e.target.value;
                                    // Check for duplicates
                                    const isDuplicate = Object.values(engineContext).some(
                                       (m: any) => m.id !== mode.id && m.linkedEventType === newValue && newValue !== null
                                    );
                                    if (isDuplicate) {
                                       addToast(`نوع الفعالية "${newValue}" مرتبط بالفعل بنمط آخر`, 'warning');
                                       return;
                                    }
                                    setEngineContext(prev => ({
                                       ...prev,
                                       [mode.id]: { ...mode, linkedEventType: newValue as any }
                                    }));
                                    addToast('تم تحديث الربط بنجاح', 'success');
                                 }}
                                 className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-[11px] text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                              >
                                 <option value="NONE">⚪ غير مرتبط (لا يستخدم في التوزيع)</option>
                                 <option value="EXAM">📝 EXAM - امتحانات ومراقبة</option>
                                 <option value="TRIP">🚌 TRIP - رحلة مدرسية</option>
                                 <option value="RAINY">🌧️ RAINY - مناوبة داخلية</option>
                                 <option value="EMERGENCY">🚨 EMERGENCY - طوارئ</option>
                                 <option value="HOLIDAY">🎉 HOLIDAY - عطلة/احتفال</option>
                              </select>
                              {mode.linkedEventType && (
                                 <div className="mt-2 flex items-center gap-2 text-[9px] font-bold text-emerald-600">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                    عند إنشاء فعالية من هذا النوع، سيطبق هذا النمط تلقائياً
                                 </div>
                              )}
                           </div>

                           <div className="flex justify-between text-xs font-bold text-slate-500 border-b border-slate-100 pb-2">
                              <span>القواعد الذهبية ({mode.goldenRules.length})</span>
                           </div>
                           {/* Enhanced Rule Display */}
                           <div className="space-y-2">
                              {mode.goldenRules.slice(0, 3).map(rule => (
                                 <div key={rule.id} className={`p-3 rounded-2xl border transition-all ${rule.id === 'GR-NO-STAY-COVER' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                       <span className={`text-[10px] font-black truncate flex-1 ${rule.id === 'GR-NO-STAY-COVER' ? 'text-indigo-700' : 'text-slate-600'}`} title={rule.label}>{rule.label}</span>
                                       <span className="text-[8px] font-bold opacity-70 ml-2">{rule.compliancePercentage}%</span>
                                    </div>
                                    <div className="h-1 flex-1 bg-white rounded-full overflow-hidden mt-2 border border-slate-100">
                                       <div
                                          className={`h-full ${rule.compliancePercentage >= 90 ? 'bg-emerald-500' : rule.compliancePercentage >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                          style={{ width: `${rule.compliancePercentage}%` }}
                                       ></div>
                                    </div>
                                 </div>
                              ))}
                              {mode.goldenRules.length > 3 && <p className="text-[9px] text-center text-slate-400 italic">+{mode.goldenRules.length - 3} المزيد...</p>}
                           </div>

                           <div className="mt-4 pt-2 border-t border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">وزن الأولويات (Logic Weight)</p>
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                 {mode.priorityLadder.slice(0, 3).map((step, idx) => (
                                    <div key={step.id} className={`h-full ${idx === 0 ? 'bg-indigo-500' : idx === 1 ? 'bg-violet-500' : 'bg-amber-500'}`} style={{ width: `${step.weightPercentage}%` }} title={step.label}></div>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="flex gap-3 mt-auto">
                           <button
                              onClick={() => setEngineContext(prev => ({ ...prev, [mode.id]: { ...mode, isActive: !mode.isActive } }))}
                              className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${mode.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                           >
                              {mode.isActive ? 'تعطيل' : 'تفعيل'}
                           </button>
                           <button onClick={() => setEditingModeId(mode.id)} className="flex-1 py-4 rounded-2xl font-black text-xs bg-slate-900 text-white hover:bg-indigo-600 transition-all shadow-lg flex items-center justify-center gap-2">
                              <Settings2 size={16} /> تخصيص
                           </button>
                        </div>
                     </div>
                  ))}

                  <button onClick={handleAddWeightedMode} className="bg-white p-8 rounded-[3.5rem] border-4 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-4 group min-h-[400px]">
                     <div className="w-20 h-20 bg-slate-50 rounded-3xl shadow-sm flex items-center justify-center text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all"><Plus size={40} /></div>
                     <span className="font-black text-slate-400 group-hover:text-indigo-600 text-lg">بناء بروتوكول جديد</span>
                  </button>
               </div>
            </div>
         )}

         {/* 📥 DATA IMPORT (ACTIVE) */}
         {/* ... (Import Implementation - Same as before) ... */}
         {activeTab === 'import' && (
            <div className="space-y-12 animate-slide-up pb-20">
               <div className="flex flex-col md:flex-row justify-between items-center bg-white p-12 rounded-[4rem] shadow-xl border border-slate-100 relative overflow-hidden">
                  <div className="relative z-10">
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4"><FileSpreadsheet size={32} className="text-emerald-600" /> استيراد البيانات الشامل</h3>
                     <p className="text-slate-400 font-bold mt-2 text-lg">محرك تحليل المصفوفات المدرسية (Class Matrix Engine)</p>
                  </div>
                  <button
                     onClick={() => setShowImportModal(true)}
                     className="relative z-10 bg-emerald-600 text-white px-10 py-5 rounded-[2rem] font-black text-sm flex items-center gap-4 shadow-xl hover:bg-emerald-700 transition-all btn-press ring-4 ring-emerald-50 mt-4 md:mt-0"
                  >
                     <Upload size={20} /> رفع ملف Excel
                  </button>

                  <div className="absolute right-0 top-0 w-64 h-full bg-emerald-50/50 skew-x-12 pointer-events-none"></div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-200 shadow-inner">
                     <h4 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-2"><Info size={20} className="text-indigo-500" /> تعليمات ملف المصفوفة</h4>
                     <ul className="space-y-5 text-sm font-bold text-slate-500">
                        <li className="flex gap-4 items-start">
                           <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-500"><TableProperties size={16} /></div>
                           <span className="leading-relaxed">يجب أن يكون كل صف (شعبة) في ورقة عمل (Sheet) منفصلة.</span>
                        </li>
                        <li className="flex gap-4 items-start">
                           <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-500"><LayoutGrid size={16} /></div>
                           <span className="leading-relaxed">الصف الأول للعناوين، العمود الأول لرقم الحصة. الخلايا تحتوي على "المادة" و "المعلم" في أسطر منفصلة.</span>
                        </li>
                        <li className="flex gap-4 items-start">
                           <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-500"><BrainCircuit size={16} /></div>
                           <span className="leading-relaxed">سيتم تصنيف الحصص (مكوث/فردي/فعلي) بدقة حسب النص ونوع المعلم بناءً على السياسات المعتمدة.</span>
                        </li>
                     </ul>
                  </div>

                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-lg flex flex-col items-center justify-center text-center group hover:border-emerald-200 transition-all">
                     <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform"><Database size={48} /></div>
                     <p className="font-black text-slate-800 text-xl">تحديث قاعدة البيانات</p>
                     <p className="text-xs font-bold text-slate-400 mt-2 max-w-xs">سيتم دمج البيانات الجديدة مع السجلات الحالية بذكاء لضمان استمرارية العمل.</p>
                  </div>
               </div>

               {/* Clear Data Section */}
               <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100 shadow-inner flex flex-col md:flex-row items-center justify-between gap-8">
                  <div>
                     <h4 className="font-black text-rose-800 text-xl flex items-center gap-3"><Trash2 size={24} /> تصفير النظام (Factory Reset)</h4>
                     <p className="text-sm font-bold text-rose-600 mt-2 max-w-xl leading-relaxed">
                        يمكنك حذف جميع بيانات المعلمين والجداول الحالية لتهيئة النظام لاستيراد نظيف من الصفر. هذا الإجراء لا يحذف إعدادات الهيكلية أو القواعد.
                     </p>
                  </div>
                  <button
                     onClick={handleClearData}
                     className="bg-rose-600 text-white px-8 py-4 rounded-[2rem] font-black text-xs shadow-lg hover:bg-rose-700 transition-all flex items-center gap-3 btn-press shrink-0"
                  >
                     <RotateCcw size={18} /> تصفير البيانات
                  </button>
               </div>
            </div>
         )}

         {/* IMPORT MODAL */}
         {showImportModal && (
            <ImportExcelModal
               onClose={() => setShowImportModal(false)}
               onSave={handleImportSave}
            />
         )}

         {/* MODE CONFIG MODAL (Deep Editor) */}
         {editingModeId && (
            <ModeConfigModal
               modeId={editingModeId}
               initialConfig={engineContext[editingModeId]} // Added initialConfig prop
               classes={classes}
               scheduleConfig={scheduleConfig}
               onClose={() => setEditingModeId(null)}
               onSave={(newConfig) => {
                  setEngineContext(prev => ({ ...prev, [newConfig.id]: newConfig }));
                  setEditingModeId(null);
                  addToast("تم تحديث بروتوكول النمط بنجاح", "success");
               }}
            />
         )}
      </div>
   );
};

export default Settings;
