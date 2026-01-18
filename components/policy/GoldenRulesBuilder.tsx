
import React, { useState } from 'react';
import { ShieldCheck, Plus, Edit2, Trash2, AlertTriangle, Lock, Settings2, CheckCircle2 } from 'lucide-react';
import { GoldenRuleV2 } from '../../types/policy';
import { MANDATORY_RULES, createEmptyConditionGroup } from '../../utils/policyUtils';
import ConditionBuilder from './ConditionBuilder';

interface GoldenRulesBuilderProps {
  rules: GoldenRuleV2[];
  onChange: (rules: GoldenRuleV2[]) => void;
}

const GoldenRulesBuilder: React.FC<GoldenRulesBuilderProps> = ({ rules, onChange }) => {
  const [editingRule, setEditingRule] = useState<GoldenRuleV2 | null>(null);

  // Ensure Mandatory Rules Exist
  React.useEffect(() => {
    const currentIds = new Set(rules.map(r => r.id));
    const missing = MANDATORY_RULES.filter(m => !currentIds.has(m.id));
    if (missing.length > 0) {
      onChange([...missing, ...rules]);
    }
  }, []);

  const handleAddRule = () => {
    const newRule: GoldenRuleV2 = {
      id: `GR_${Date.now()}`,
      name: 'قاعدة مخصصة جديدة',
      description: 'وصف القاعدة...',
      isGlobal: false,
      isEnabled: true,
      compliancePercentage: 100,
      randomnessPercentage: 0,
      severity: 'SOFT',
      overrideAllowed: true,
      overrideRequiresReason: true,
      auditRequired: false,
      scope: { targetScope: 'all' },
      when: createEmptyConditionGroup(),
      then: [{ type: 'BLOCK_ASSIGNMENT' }],
      exceptions: []
    };
    onChange([...rules, newRule]);
    setEditingRule(newRule);
  };

  const updateRule = (updated: GoldenRuleV2) => {
    onChange(rules.map(r => r.id === updated.id ? updated : r));
    setEditingRule(updated);
  };

  const deleteRule = (id: string) => {
    if (MANDATORY_RULES.some(m => m.id === id)) return;
    onChange(rules.filter(r => r.id !== id));
    if (editingRule?.id === id) setEditingRule(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      {/* List */}
      <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[600px]">
        <button onClick={handleAddRule} className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
          <Plus size={16} /> إضافة قاعدة جديدة
        </button>
        
        {rules.map(rule => {
          const isMandatory = MANDATORY_RULES.some(m => m.id === rule.id);
          return (
            <div 
              key={rule.id} 
              onClick={() => setEditingRule(rule)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${editingRule?.id === rule.id ? 'border-indigo-500 bg-white shadow-md' : 'border-slate-200 bg-slate-50 hover:border-indigo-200'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isMandatory ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {isMandatory ? <Lock size={14} /> : <ShieldCheck size={14} />}
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800 line-clamp-1">{rule.name}</h5>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${rule.severity === 'HARD' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{rule.severity}</span>
                  </div>
                </div>
                {!isMandatory && (
                  <button onClick={(e) => { e.stopPropagation(); deleteRule(rule.id); }} className="text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[9px] font-bold text-slate-400">
                <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${rule.compliancePercentage}%` }}></div>
                </div>
                <span>{rule.compliancePercentage}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor */}
      <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm overflow-y-auto custom-scrollbar max-h-[700px]">
        {editingRule ? (
          <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-start">
              <div className="space-y-4 flex-1 ml-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">اسم القاعدة</label>
                  <input className="w-full text-xl font-black text-slate-800 bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none pb-1" value={editingRule.name} onChange={e => updateRule({...editingRule, name: e.target.value})} disabled={MANDATORY_RULES.some(m => m.id === editingRule.id)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">الوصف</label>
                  <textarea className="w-full text-xs font-bold text-slate-600 bg-slate-50 rounded-xl p-3 outline-none resize-none h-20" value={editingRule.description} onChange={e => updateRule({...editingRule, description: e.target.value})} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                 <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <input type="checkbox" className="accent-indigo-600" checked={editingRule.isEnabled} onChange={e => updateRule({...editingRule, isEnabled: e.target.checked})} />
                    <span className="text-[10px] font-black text-slate-600">مفعلة</span>
                 </label>
                 <select className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-[10px] font-black outline-none" value={editingRule.severity} onChange={e => updateRule({...editingRule, severity: e.target.value as any})}>
                    <option value="HARD">صارم (Hard)</option>
                    <option value="SOFT">مرن (Soft)</option>
                 </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
               <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-500">
                     <span>الامتثال (Compliance)</span>
                     <span className="text-indigo-600">{editingRule.compliancePercentage}%</span>
                  </div>
                  <input type="range" className="w-full accent-indigo-600" min="0" max="100" value={editingRule.compliancePercentage} onChange={e => updateRule({...editingRule, compliancePercentage: Number(e.target.value)})} />
                  <p className="text-[9px] text-slate-400">نسبة التطبيق الإلزامي للقاعدة.</p>
               </div>
               <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-500">
                     <span>العشوائية (Randomness)</span>
                     <span className="text-violet-600">{editingRule.randomnessPercentage}%</span>
                  </div>
                  <input type="range" className="w-full accent-violet-600" min="0" max="100" value={editingRule.randomnessPercentage} onChange={e => updateRule({...editingRule, randomnessPercentage: Number(e.target.value)})} />
                  <p className="text-[9px] text-slate-400">هامش المرونة العشوائي (Human-like bias).</p>
               </div>
            </div>

            <div className="space-y-4">
               <h4 className="font-black text-slate-800 text-sm flex items-center gap-2"><Settings2 size={16} className="text-emerald-500"/> شروط التطبيق (WHEN)</h4>
               <ConditionBuilder group={editingRule.when} onChange={(g) => updateRule({...editingRule, when: g})} />
            </div>

            <div className="space-y-4">
               <h4 className="font-black text-slate-800 text-sm flex items-center gap-2"><AlertTriangle size={16} className="text-rose-500"/> الإجراء (THEN)</h4>
               <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-4">
                  <select 
                    className="bg-white border border-rose-200 text-rose-800 text-xs font-black rounded-xl px-4 py-3 outline-none flex-1"
                    value={editingRule.then[0]?.type}
                    onChange={e => updateRule({...editingRule, then: [{ type: e.target.value as any }]})}
                  >
                     <option value="BLOCK_ASSIGNMENT">منع التعيين (Block)</option>
                     <option value="REQUIRE_SWAP">تطلب تبديل (Swap Required)</option>
                     <option value="PENALIZE_SCORE">خصم نقاط (Penalize)</option>
                     <option value="FORCE_INTERNAL_ONLY">حصر بالداخلي فقط</option>
                  </select>
                  <p className="text-[10px] font-bold text-rose-600 flex-1">سيتم تطبيق هذا الإجراء عند تحقق الشروط أعلاه.</p>
               </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
             <ShieldCheck size={64} className="opacity-20" />
             <p className="text-sm font-bold">اختر قاعدة من القائمة للتعديل</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoldenRulesBuilder;
