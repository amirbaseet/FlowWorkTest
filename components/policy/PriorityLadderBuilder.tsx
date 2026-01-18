
import React, { useState } from 'react';
import { ListOrdered, Plus, Trash2, ArrowUp, ArrowDown, Target, Zap, Play } from 'lucide-react';
import { PriorityStepV2 } from '../../types/policy';
import { createEmptyConditionGroup } from '../../utils/policyUtils';
import ConditionBuilder from './ConditionBuilder';

interface PriorityLadderBuilderProps {
  steps: PriorityStepV2[];
  onChange: (steps: PriorityStepV2[]) => void;
}

const PriorityLadderBuilder: React.FC<PriorityLadderBuilderProps> = ({ steps, onChange }) => {
  const [editingStep, setEditingStep] = useState<PriorityStepV2 | null>(null);

  const handleAddStep = () => {
    const newStep: PriorityStepV2 = {
      id: `STEP_${Date.now()}`,
      label: 'معيار أولوية جديد',
      order: steps.length + 1,
      isEnabled: true,
      compliancePercentage: 100,
      randomnessPercentage: 0,
      weightPercentage: 50,
      stopOnMatch: false,
      filters: createEmptyConditionGroup(),
      scoring: { baseScore: 100, modifiers: [] },
      explanation: 'شرح المعيار...'
    };
    onChange([...steps, newStep]);
    setEditingStep(newStep);
  };

  const updateStep = (updated: PriorityStepV2) => {
    onChange(steps.map(s => s.id === updated.id ? updated : s));
    setEditingStep(updated);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;
    const newSteps = [...steps];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
    newSteps.forEach((s, i) => s.order = i + 1);
    onChange(newSteps);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      {/* Steps List */}
      <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[600px]">
        <button onClick={handleAddStep} className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
          <Plus size={16} /> إضافة معيار جديد
        </button>
        
        {steps.sort((a,b) => a.order - b.order).map((step, idx) => (
          <div 
            key={step.id} 
            onClick={() => setEditingStep(step)}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative group ${editingStep?.id === step.id ? 'border-indigo-500 bg-white shadow-md' : 'border-slate-200 bg-slate-50 hover:border-indigo-200'}`}
          >
            <div className="flex gap-4 items-center">
               <div className="flex flex-col gap-1 items-center justify-center bg-slate-100 rounded-lg p-1 w-8">
                  <button onClick={(e) => { e.stopPropagation(); moveStep(idx, 'up'); }} className="text-slate-400 hover:text-indigo-600"><ArrowUp size={12}/></button>
                  <span className="text-[10px] font-black text-slate-600">{step.order}</span>
                  <button onClick={(e) => { e.stopPropagation(); moveStep(idx, 'down'); }} className="text-slate-400 hover:text-indigo-600"><ArrowDown size={12}/></button>
               </div>
               <div className="flex-1">
                  <h5 className="text-xs font-black text-slate-800">{step.label}</h5>
                  <div className="flex gap-2 mt-2">
                     <span className="text-[8px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">Weight: {step.weightPercentage}</span>
                     {step.stopOnMatch && <span className="text-[8px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded">Stop</span>}
                  </div>
               </div>
               <button onClick={(e) => { e.stopPropagation(); onChange(steps.filter(s => s.id !== step.id)); if (editingStep?.id === step.id) setEditingStep(null); }} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>

      {/* Step Editor */}
      <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm overflow-y-auto custom-scrollbar max-h-[700px]">
         {editingStep ? (
            <div className="space-y-8 animate-fade-in">
               <div className="space-y-4">
                  <div className="flex gap-4">
                     <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">عنوان المعيار</label>
                        <input className="w-full text-lg font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500" value={editingStep.label} onChange={e => updateStep({...editingStep, label: e.target.value})} />
                     </div>
                     <div className="w-32 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">نقاط الأساس</label>
                        <input type="number" className="w-full text-lg font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl p-3 outline-none text-center" value={editingStep.scoring.baseScore} onChange={e => updateStep({...editingStep, scoring: {...editingStep.scoring, baseScore: Number(e.target.value)}})} />
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={editingStep.isEnabled} onChange={e => updateStep({...editingStep, isEnabled: e.target.checked})} />
                        <span className="text-xs font-bold text-slate-600">مفعل</span>
                     </label>
                     <div className="w-px h-6 bg-slate-200"></div>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="accent-rose-600 w-4 h-4" checked={editingStep.stopOnMatch} onChange={e => updateStep({...editingStep, stopOnMatch: e.target.checked})} />
                        <span className="text-xs font-bold text-slate-600">توقف عند المطابقة (Stop)</span>
                     </label>
                     <div className="w-px h-6 bg-slate-200"></div>
                     <div className="flex items-center gap-2 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Weight</span>
                        <input type="range" className="flex-1 accent-indigo-600" min="0" max="100" value={editingStep.weightPercentage} onChange={e => updateStep({...editingStep, weightPercentage: Number(e.target.value)})} />
                        <span className="text-xs font-black text-indigo-600 w-8">{editingStep.weightPercentage}</span>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2"><Target size={16} className="text-indigo-500"/> شروط الفلترة (Matching Filters)</h4>
                  <p className="text-[10px] text-slate-400 font-bold">يجب أن تتحقق هذه الشروط ليتم احتساب النقاط لهذا المعيار.</p>
                  <ConditionBuilder group={editingStep.filters} onChange={(g) => updateStep({...editingStep, filters: g})} />
               </div>

               <div className="space-y-4">
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2"><Zap size={16} className="text-amber-500"/> المحاكاة (Simulation Preview)</h4>
                  <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden flex items-center justify-between">
                     <div>
                        <p className="text-xs font-bold opacity-80 mb-1">النتيجة المتوقعة</p>
                        <h5 className="text-2xl font-black text-emerald-400">+{editingStep.scoring.baseScore + (editingStep.weightPercentage / 2)} نقطة</h5>
                     </div>
                     <button className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all border border-white/10">
                        <Play fill="currentColor" size={20} />
                     </button>
                  </div>
               </div>
            </div>
         ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
               <ListOrdered size={64} className="opacity-20" />
               <p className="text-sm font-bold">اختر معياراً للتعديل</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default PriorityLadderBuilder;
