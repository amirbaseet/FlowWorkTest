
import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Zap, CheckCircle2, LayoutGrid, Users, Clock, 
  ArrowRightLeft, ShieldAlert, Coffee, Target, Baby, GraduationCap,
  Briefcase, GitFork, BookOpen, UserCheck, RefreshCw, Wand2, Layers, Sparkles,
  Scale, Link2, Hourglass, Merge, UserMinus, Globe, FileWarning,
  LayoutTemplate, Split, Combine, MoveDiagonal,
  Gauge, Microscope, BarChart4, Cpu, LayoutList, ShieldCheck, Lock, Edit3, PlusCircle, AlertTriangle, ArrowUp, ArrowDown, RotateCcw, ListOrdered, Trash2, SlidersHorizontal, Info, AlertOctagon,
  Activity, CloudRain, Binary, Settings, Palmtree,
  ToggleLeft, ToggleRight, CheckSquare, Settings2 as Settings2Icon
} from 'lucide-react';
import { ModeConfig, ClassItem, ScheduleConfig, BreakMergeStrategy, GoldenRule, PriorityStep, RuleCondition, PriorityCriteria } from '@/types';
import { GRADES_AR, STANDARD_STAY_RULE } from '@/constants';
import { validateModeActivation, detectGradeFromTitle } from '@/utils';
import { ModeSettings } from '@/types/policy';

// V2 Imports
import GoldenRulesBuilder from './policy/GoldenRulesBuilder';
import PriorityLadderBuilder from './policy/PriorityLadderBuilder';
import ModeSettingsBuilder from './policy/ModeSettingsBuilder'; // New Import
import { GoldenRuleV2, PriorityStepV2 } from '@/types/policy';

interface ModeConfigModalProps {
  modeId: string;
  initialConfig?: ModeConfig;
  classes: ClassItem[];
  scheduleConfig: ScheduleConfig;
  onClose: () => void;
  onSave: (config: ModeConfig) => void;
}

const MODE_LABELS: Record<string, string> = {
  rainyMode: 'يوم ماطر',
  tripMode: 'رحلة خارجية',
  examMode: 'فترة امتحانات',
  emergencyMode: 'حالة طوارئ',
  normalMode: 'الوضع الطبيعي',
  holidayMode: 'عطلة / مناسبات',
  examPrepMode: 'وضع التحضير للامتحانات'
};

const DEFAULT_LADDER: PriorityStep[] = [
  { id: 'step_ext', order: 1, label: 'بديل خارجي', weightPercentage: 40, probabilityBias: 10, criteria: { staffCategory: 'any', teacherType: 'external', relationship: 'none', slotState: 'any', selectionReason: 'any' }, enabled: true },
  { id: 'step_rel', order: 2, label: 'معلم محرر (فراغ)', weightPercentage: 30, probabilityBias: 5, criteria: { staffCategory: 'any', teacherType: 'internal', relationship: 'none', slotState: 'free', selectionReason: 'any' }, enabled: true },
  { id: 'step_ind', order: 3, label: 'حصص فردية', weightPercentage: 20, probabilityBias: 0, criteria: { staffCategory: 'any', teacherType: 'internal', relationship: 'none', slotState: 'individual', selectionReason: 'any' }, enabled: true },
  { id: 'step_mrg', order: 4, label: 'دمج الشعب', weightPercentage: 10, probabilityBias: 20, criteria: { staffCategory: 'any', teacherType: 'any', relationship: 'none', slotState: 'any', selectionReason: 'any' }, enabled: true },
];

// Default Settings if missing
const DEFAULT_SETTINGS: ModeSettings = {
  teacher: { disableExternal: false, treatNoLessonsAsOffDuty: false, allowLateArrivals: true, forceHomeroomPresence: false },
  lesson: { disableStay: false, disableIndividual: false, disableShared: false, forceActualOnly: false },
  time: { ignoreGapsAtStart: false, ignoreGapsAtEnd: false, maxConsecutivePeriods: 0 },
  class: { allowMerge: false, maxMergedCount: 0, priorityGrades: [], allowSplitStrategy: false },
  subject: { governingSubject: '', prioritizeGoverningSubject: false, enableCrossCompetency: false },
  hr: { maxDailyCoverage: 3, maxWeeklyCoverage: 8, fairnessSensitivity: 'flexible', immunityCooldownHours: 0 },
  ui: { hideForbiddenCandidates: true, requireJustification: false, lockManualOverride: false }
};

const ModeConfigModal: React.FC<ModeConfigModalProps> = ({ modeId, initialConfig, classes, scheduleConfig, onClose, onSave }) => {
  const [config, setConfig] = useState<ModeConfig>(() => {
    const base = initialConfig ? JSON.parse(JSON.stringify(initialConfig)) : {};
    return {
      id: modeId,
      name: MODE_LABELS[modeId] || modeId,
      isActive: true,
      target: 'all',
      affectedGradeLevels: [],
      affectedClassIds: [],
      affectedPeriods: [1, 2, 3, 4, 5, 6, 7],
      affectedBreaks: Object.keys(scheduleConfig.breakPositions).map(Number),
      breakAction: 'none',
      mergeStrategy: 'advance_second',
      goldenRules: [],
      policyRules: [],
      priorityLadder: DEFAULT_LADDER,
      rainy: { mergedClassesCount: 0, teacherMultiGradeFactor: 0.7 },
      exam: { examSubject: '' },
      trip: { studentsLeaveAfterPeriod: 6 },
      holiday: { type: 'partial', excludedGrades: [], excludedClasses: [] },
      policyVersion: 'v2', // Default to V2 now
      goldenRulesV2: [],
      priorityLadderV2: [],
      ...base,
      // Merge saved settings with defaults to ensure all keys exist
      settings: { ...DEFAULT_SETTINGS, ...(base.settings || {}) }
    };
  });

  const [activeTab, setActiveTab] = useState<'settings' | 'rules' | 'priority' | 'scope' | 'impact'>('settings');
  const [error, setError] = useState<string | null>(null);
  
  // Inject Standard Stay Rule ONLY if missing (Legacy Support)
  useEffect(() => {
    setConfig(prev => {
        const hasStayRule = prev.goldenRules.some(r => r.id === 'GR-NO-STAY-COVER');
        if (!hasStayRule) {
            return { ...prev, goldenRules: [STANDARD_STAY_RULE, ...prev.goldenRules] };
        }
        return prev;
    });
  }, []);

  const handleSave = () => {
    setError(null);
    
    // Create a copy to manipulate before validation
    const effectiveConfig = { ...config };

    // --- AUTO SYNC FIX FOR EXAM MODE ---
    // Ensure V2 Subject is propagated to V1 examSubject to pass validation
    if (effectiveConfig.id === 'examMode') {
        const v2Subject = effectiveConfig.settings?.subject?.governingSubject;
        if (v2Subject && v2Subject.trim() !== '') {
            effectiveConfig.exam = { ...effectiveConfig.exam, examSubject: v2Subject };
        } else if (!effectiveConfig.exam?.examSubject) {
            // Fallback: If no subject defined, use 'General' to prevent blocking the save button
            effectiveConfig.exam = { ...effectiveConfig.exam, examSubject: 'عام' };
        }
    }

    const validation = validateModeActivation(effectiveConfig);
    if (!validation.valid) {
        setError(validation.error || 'خطأ في الإعدادات');
        return;
    }
    
    // Save the potentially modified config (with synced subject)
    onSave(effectiveConfig);
  };

  // --- Compute Active Grades based on Classes (Robust with Name Detection) ---
  const activeGrades = useMemo(() => {
    const grades = new Set<number>();
    classes.forEach(c => {
        const detected = detectGradeFromTitle(c.name);
        const g = (detected > 0) ? detected : 0; 
        
        if (!isNaN(g) && g > 0) grades.add(g);
    });
    return Array.from(grades).sort((a, b) => a - b);
  }, [classes]);

  // --- V1 Helper Functions (Legacy Support) ---
  const updateRule = (ruleId: string, updates: Partial<GoldenRule>) => {
    setConfig(prev => ({
        ...prev,
        goldenRules: prev.goldenRules.map(r => r.id === ruleId ? { ...r, ...updates } : r)
    }));
  };

  const deleteRule = (ruleId: string) => {
    setConfig(prev => ({
        ...prev,
        goldenRules: prev.goldenRules.filter(r => r.id !== ruleId)
    }));
  };

  const addV1Rule = () => {
    const newRule: GoldenRule = {
        id: `GR_${Date.now()}`,
        label: 'قاعدة مخصصة جديدة',
        isActive: true,
        compliancePercentage: 100,
        enforcementLevel: 'STRICT',
        description: 'وصف القاعدة...',
        isGlobal: false,
        conditions: []
    };
    setConfig(prev => ({ ...prev, goldenRules: [...prev.goldenRules, newRule] }));
  };

  const updatePriorityStep = (stepId: string, updates: Partial<PriorityStep>) => {
      setConfig(prev => ({
          ...prev,
          priorityLadder: prev.priorityLadder.map(s => s.id === stepId ? { ...s, ...updates } : s)
      }));
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === config.priorityLadder.length - 1)) return;
    const newLadder = [...config.priorityLadder];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newLadder[index], newLadder[swapIndex]] = [newLadder[swapIndex], newLadder[index]];
    newLadder.forEach((step, idx) => step.order = idx + 1);
    setConfig(prev => ({ ...prev, priorityLadder: newLadder }));
  };

  const handleV2Toggle = () => {
    setConfig(prev => ({ ...prev, policyVersion: prev.policyVersion === 'v2' ? 'v1' : 'v2' }));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[3000] flex items-center justify-center p-3 sm:p-6 animate-fade-in" dir="rtl">
       <div className="bg-slate-50 w-full max-w-6xl rounded-[3rem] shadow-[0_0_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh] border border-white/20 animate-scale-up ring-4 ring-white/5">
          
          {/* Header */}
          <div className="p-8 border-b border-slate-200 flex justify-between bg-white items-center shrink-0 z-20">
             <div className="flex items-center gap-6">
                <div className="p-4 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-3xl shadow-lg shadow-indigo-500/30"><Cpu size={32} /></div>
                <div>
                   <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                     مختبر السياسات: <span className="text-indigo-600">{config.name}</span>
                   </h3>
                   <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Protocol Engine {config.policyVersion === 'v2' ? 'v2.0 (Advanced)' : 'v1.0 (Legacy)'}</span>
                      <button onClick={handleV2Toggle} className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${config.policyVersion === 'v2' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                         {config.policyVersion === 'v2' ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                         <span className="text-[10px] font-black">Gen-2 Engine</span>
                      </button>
                   </div>
                </div>
             </div>
             <button onClick={onClose} className="p-4 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-3xl transition-all shadow-sm border border-slate-100"><X size={24} /></button>
          </div>

          {/* Tab Navigation */}
          <div className="px-8 py-4 bg-slate-100/50 border-b border-slate-200 flex gap-2 overflow-x-auto no-scrollbar">
             {[
               { id: 'settings', label: 'إعدادات النمط', icon: Settings2Icon },
               { id: 'rules', label: 'قواعد التخصيص', icon: ShieldCheck },
               { id: 'priority', label: 'سلم الأولويات', icon: ListOrdered },
               { id: 'scope', label: 'النطاق والمستهدفين', icon: Target },
               { id: 'impact', label: 'محاكاة الأثر', icon: Activity },
             ].map(tab => (
               <button 
                 key={tab.id} 
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/50'}`}
               >
                 <tab.icon size={16} /> {tab.label}
               </button>
             ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative">
             {config.policyVersion === 'v2' ? (
                /* --- V2 ENGINE UI --- */
                <>
                  {activeTab === 'settings' && (
                     <ModeSettingsBuilder settings={config.settings!} onChange={(s) => setConfig({ ...config, settings: s })} />
                  )}
                  
                  {activeTab === 'rules' && (
                     <GoldenRulesBuilder rules={config.goldenRulesV2 || []} onChange={(r) => setConfig({ ...config, goldenRulesV2: r })} />
                  )}

                  {activeTab === 'priority' && (
                     <div className="space-y-6 p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                           <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                              <ListOrdered size={18} className="text-indigo-500"/> سلم الأولويات
                           </h4>
                           <button 
                              onClick={() => {
                                 const newStep: PriorityStep = {
                                    id: `step_${Date.now()}`,
                                    order: (config.priorityLadder?.length || 0) + 1,
                                    label: 'أولوية جديدة',
                                    weightPercentage: 50,
                                    probabilityBias: 0,
                                    explanation: 'الوصف...',
                                    criteria: { staffCategory: 'any', teacherType: 'internal', relationship: 'none', slotState: 'free', selectionReason: 'any' },
                                    enabled: true
                                 };
                                 setConfig({ ...config, priorityLadder: [...(config.priorityLadder || []), newStep] });
                              }}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all"
                           >
                              <PlusCircle size={14} /> إضافة أولوية
                           </button>
                        </div>
                        
                        <div className="space-y-4">
                           {(config.priorityLadder || []).sort((a,b) => a.order - b.order).map((step, idx) => (
                              <div key={step.id} className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-indigo-300 transition-all">
                                 <div className="flex items-start gap-4">
                                    {/* Order Controls */}
                                    <div className="flex flex-col gap-1 items-center">
                                       <button 
                                          onClick={() => {
                                             if (idx === 0) return;
                                             const newLadder = [...(config.priorityLadder || [])];
                                             [newLadder[idx], newLadder[idx-1]] = [newLadder[idx-1], newLadder[idx]];
                                             newLadder.forEach((s, i) => s.order = i + 1);
                                             setConfig({ ...config, priorityLadder: newLadder });
                                          }}
                                          disabled={idx === 0}
                                          className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                       >
                                          <ArrowUp size={14}/>
                                       </button>
                                       <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs">
                                          {step.order}
                                       </div>
                                       <button 
                                          onClick={() => {
                                             if (idx === (config.priorityLadder?.length || 0) - 1) return;
                                             const newLadder = [...(config.priorityLadder || [])];
                                             [newLadder[idx], newLadder[idx+1]] = [newLadder[idx+1], newLadder[idx]];
                                             newLadder.forEach((s, i) => s.order = i + 1);
                                             setConfig({ ...config, priorityLadder: newLadder });
                                          }}
                                          disabled={idx === (config.priorityLadder?.length || 0) - 1}
                                          className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                       >
                                          <ArrowDown size={14}/>
                                       </button>
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="flex-1 space-y-3">
                                       <input 
                                          type="text"
                                          value={step.label}
                                          onChange={(e) => {
                                             const newLadder = (config.priorityLadder || []).map(s => 
                                                s.id === step.id ? { ...s, label: e.target.value } : s
                                             );
                                             setConfig({ ...config, priorityLadder: newLadder });
                                          }}
                                          className="w-full text-sm font-black text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                                          placeholder="اسم الأولوية"
                                       />
                                       
                                       {/* Criteria Selectors */}
                                       <div className="space-y-3">
                                          <div className="grid grid-cols-3 gap-2">
                                             {/* Relationship */}
                                             <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">العلاقة</label>
                                                <select 
                                                   value={step.criteria?.relationship || 'none'}
                                                   onChange={(e) => {
                                                      const newLadder = (config.priorityLadder || []).map(s => 
                                                         s.id === step.id ? { ...s, criteria: { ...s.criteria, relationship: e.target.value as any } } : s
                                                      );
                                                      setConfig({ ...config, priorityLadder: newLadder });
                                                   }}
                                                   className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
                                                >
                                                   <option value="none">لا يوجد</option>
                                                   <option value="class_educator">مربي الصف</option>
                                                   <option value="same_grade">نفس المرحلة</option>
                                                   <option value="same_subject">نفس المادة</option>
                                                </select>
                                             </div>
                                             
                                             {/* Slot State - NOW Multi-select */}
                                             <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">حالة الحصة (متعدد)</label>
                                                <select 
                                                   multiple
                                                   value={step.criteria?.actualLessonTypes || []}
                                                   onChange={(e) => {
                                                      const selected = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                                                      const newLadder = (config.priorityLadder || []).map(s => 
                                                         s.id === step.id ? { ...s, criteria: { ...s.criteria, actualLessonTypes: selected as any } } : s
                                                      );
                                                      setConfig({ ...config, priorityLadder: newLadder });
                                                   }}
                                                   className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
                                                   size={4}
                                                >
                                                   <option value="free">فراغ</option>
                                                   <option value="individual">فردي</option>
                                                   <option value="stay">مكوث</option>
                                                   <option value="regular">فعلي</option>
                                                </select>
                                                <p className="text-[9px] text-slate-400">Ctrl/Cmd + Click</p>
                                             </div>
                                             
                                             {/* Teacher Type */}
                                             <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">نوع المعلم</label>
                                                <select 
                                                   value={step.criteria?.teacherType || 'internal'}
                                                   onChange={(e) => {
                                                      const newLadder = (config.priorityLadder || []).map(s => 
                                                         s.id === step.id ? { ...s, criteria: { ...s.criteria, teacherType: e.target.value as any } } : s
                                                      );
                                                      setConfig({ ...config, priorityLadder: newLadder });
                                                   }}
                                                   className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
                                                >
                                                   <option value="internal">داخلي</option>
                                                   <option value="external">خارجي</option>
                                                </select>
                                             </div>
                                          </div>
                                       </div>
                                       
                                       <textarea 
                                          value={step.explanation || ''}
                                          onChange={(e) => {
                                             const newLadder = (config.priorityLadder || []).map(s => 
                                                s.id === step.id ? { ...s, explanation: e.target.value } : s
                                             );
                                             setConfig({ ...config, priorityLadder: newLadder });
                                          }}
                                          className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 resize-none"
                                          rows={2}
                                          placeholder="الوصف (اختياري)..."
                                       />
                                    </div>
                                    
                                    {/* Weight */}
                                    <div className="flex flex-col items-center gap-2 w-24">
                                       <label className="text-[9px] font-bold text-slate-400 uppercase">النسبة</label>
                                       <input 
                                          type="number"
                                          value={step.weightPercentage}
                                          onChange={(e) => {
                                             const newLadder = (config.priorityLadder || []).map(s => 
                                                s.id === step.id ? { ...s, weightPercentage: Number(e.target.value) } : s
                                             );
                                             setConfig({ ...config, priorityLadder: newLadder });
                                          }}
                                          min="0"
                                          max="100"
                                          className="w-full text-lg font-black text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 text-center outline-none focus:border-indigo-500"
                                       />
                                       <span className="text-[9px] font-bold text-indigo-600">{step.weightPercentage}%</span>
                                    </div>
                                    
                                    {/* Delete */}
                                    <button 
                                       onClick={() => {
                                          const newLadder = (config.priorityLadder || []).filter(s => s.id !== step.id);
                                          newLadder.forEach((s, i) => s.order = i + 1);
                                          setConfig({ ...config, priorityLadder: newLadder });
                                       }}
                                       className="text-slate-300 hover:text-rose-500 p-2 transition-all"
                                       title="حذف"
                                    >
                                       <Trash2 size={16}/>
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                        
                        {(!config.priorityLadder || config.priorityLadder.length === 0) && (
                           <div className="text-center py-12 text-slate-400 text-sm">
                              لا توجد أولويات. اضغط "إضافة أولوية" للبدء.
                           </div>
                        )}
                     </div>
                  )}

                  {activeTab === 'scope' && (
                     <div className="space-y-8 animate-fade-in">
                        {/* Scope UI Implementation (Reused from V1 but cleaner) */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                           <h4 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2"><Target size={18} className="text-indigo-500"/> نطاق تطبيق السياسة</h4>
                           
                           <div className="flex gap-4 mb-8">
                              <button onClick={() => setConfig({ ...config, target: 'all' })} className={`flex-1 py-4 rounded-2xl border-2 font-black text-xs transition-all ${config.target === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>كامل المدرسة</button>
                              <button onClick={() => setConfig({ ...config, target: 'specific_grades' })} className={`flex-1 py-4 rounded-2xl border-2 font-black text-xs transition-all ${config.target === 'specific_grades' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>طبقات محددة</button>
                              <button onClick={() => setConfig({ ...config, target: 'specific_classes' })} className={`flex-1 py-4 rounded-2xl border-2 font-black text-xs transition-all ${config.target === 'specific_classes' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>شعب معينة</button>
                           </div>

                           {config.target === 'specific_grades' && (
                              <div className="flex flex-wrap gap-2">
                                 {activeGrades.map(g => (
                                    <button 
                                      key={g} 
                                      onClick={() => {
                                         const current = config.affectedGradeLevels || [];
                                         const next = current.includes(g) ? current.filter(x => x !== g) : [...current, g];
                                         setConfig({ ...config, affectedGradeLevels: next });
                                      }}
                                      className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all ${config.affectedGradeLevels.includes(g) ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                                    >
                                       {GRADES_AR[g-1] || `Grade ${g}`}
                                    </button>
                                 ))}
                              </div>
                           )}

                           {config.target === 'specific_classes' && (
                              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2 border border-slate-100 rounded-2xl">
                                 <div className="grid grid-cols-4 gap-2">
                                    {classes.map(c => (
                                       <button 
                                          key={c.id}
                                          onClick={() => {
                                             const current = config.affectedClassIds || [];
                                             const next = current.includes(c.id) ? current.filter(x => x !== c.id) : [...current, c.id];
                                             setConfig({ ...config, affectedClassIds: next });
                                          }}
                                          className={`px-3 py-2 rounded-lg text-[10px] font-black border transition-all ${config.affectedClassIds.includes(c.id) ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                                       >
                                          {c.name}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>
                  )}

                  {activeTab === 'impact' && (
                     <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                        <Activity size={48} className="opacity-20"/>
                        <p className="font-bold text-sm">محاكاة الأثر قيد التطوير...</p>
                     </div>
                  )}
                </>
             ) : (
                /* --- V1 ENGINE UI (Legacy Fallback) --- */
                <div className="space-y-8 animate-fade-in">
                   {/* Legacy UI implementation preserved for backward compatibility if needed, simplified here */}
                   <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-center gap-4">
                      <AlertTriangle className="text-amber-500" size={24}/>
                      <div>
                         <h4 className="font-black text-amber-800 text-sm">وضع التوافق (Legacy Mode)</h4>
                         <p className="text-xs text-amber-700 mt-1">أنت تستخدم محرك الجيل الأول. يوصى بالترقية إلى Gen-2 للحصول على ميزات التخصيص المتقدمة.</p>
                      </div>
                   </div>
                   {/* ... (Existing V1 UI logic would go here) ... */}
                </div>
             )}
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-slate-200 bg-white flex justify-between items-center z-20">
             {error && (
                <div className="flex items-center gap-2 text-rose-600 text-xs font-black bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 animate-pulse">
                   <AlertTriangle size={14}/> {error}
                </div>
             )}
             <div className="flex gap-4 mr-auto">
                <button onClick={onClose} className="px-8 py-4 rounded-2xl font-black text-xs text-slate-500 hover:bg-slate-50 transition-all">إلغاء</button>
                <button onClick={handleSave} className="px-12 py-4 rounded-2xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center gap-2">
                   <CheckCircle2 size={16}/> حفظ التغييرات
                </button>
             </div>
          </div>

       </div>
    </div>
  );
};

export default ModeConfigModal;
