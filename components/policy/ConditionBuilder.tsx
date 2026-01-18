
import React from 'react';
import { Plus, Trash2, GitMerge } from 'lucide-react';
import { ConditionGroup, Condition } from '../../types/policy';
import { COMPONENT_OPTIONS, getSubjectOptions, createEmptyCondition, createEmptyConditionGroup } from '../../utils/policyUtils';

interface ConditionBuilderProps {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  depth?: number;
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ group, onChange, depth = 0 }) => {
  
  const handleAddCondition = () => {
    onChange({ ...group, conditions: [...group.conditions, createEmptyCondition()] });
  };

  const handleAddGroup = () => {
    onChange({ ...group, conditions: [...group.conditions, createEmptyConditionGroup()] });
  };

  const handleRemove = (index: number) => {
    const next = [...group.conditions];
    next.splice(index, 1);
    onChange({ ...group, conditions: next });
  };

  const handleConditionChange = (index: number, changes: Partial<Condition>) => {
    const next = [...group.conditions];
    // @ts-ignore
    next[index] = { ...next[index], ...changes };
    onChange({ ...group, conditions: next });
  };

  const handleGroupChange = (index: number, updatedGroup: ConditionGroup) => {
    const next = [...group.conditions];
    next[index] = updatedGroup;
    onChange({ ...group, conditions: next });
  };

  return (
    <div className={`p-4 rounded-2xl border-2 ${depth === 0 ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 ml-4 mt-2'}`}>
      <div className="flex items-center gap-3 mb-3">
        {depth > 0 && <GitMerge size={16} className="text-slate-400" />}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => onChange({ ...group, op: 'AND' })} className={`px-3 py-1 rounded-md text-xs font-black transition-all ${group.op === 'AND' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}>AND (و)</button>
          <button onClick={() => onChange({ ...group, op: 'OR' })} className={`px-3 py-1 rounded-md text-xs font-black transition-all ${group.op === 'OR' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}>OR (أو)</button>
        </div>
        <div className="flex gap-2 mr-auto">
          <button onClick={handleAddCondition} className="text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 font-bold flex items-center gap-1"><Plus size={12}/> إضافة شرط</button>
          <button onClick={handleAddGroup} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 font-bold flex items-center gap-1"><Plus size={12}/> مجموعة فرعية</button>
        </div>
      </div>

      <div className="space-y-2">
        {group.conditions.map((item, idx) => {
          if ('op' in item) {
            // It's a group
            return (
              <div key={item.id} className="relative group">
                <ConditionBuilder group={item} onChange={(g) => handleGroupChange(idx, g)} depth={depth + 1} />
                <button onClick={() => handleRemove(idx)} className="absolute top-4 left-4 p-1.5 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
              </div>
            );
          } else {
            // It's a condition (Row with 5 Selects)
            return (
              <div key={item.id} className="flex flex-col xl:flex-row items-center gap-2 bg-white border border-slate-100 p-3 rounded-xl shadow-sm hover:border-indigo-200 transition-all">
                
                {/* 1. Teacher Type */}
                <div className="flex-1 w-full xl:w-auto">
                   <label className="block text-[8px] font-bold text-slate-400 mb-1">نوع المعلم</label>
                   <select 
                      className="w-full bg-slate-50 text-[10px] font-bold p-2 rounded-lg outline-none border border-slate-200 focus:border-indigo-300"
                      value={item.teacherType}
                      onChange={(e) => handleConditionChange(idx, { teacherType: e.target.value as any })}
                   >
                      {COMPONENT_OPTIONS.teacherType.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                   </select>
                </div>

                {/* 2. Lesson Type */}
                <div className="flex-1 w-full xl:w-auto">
                   <label className="block text-[8px] font-bold text-slate-400 mb-1">نوع الحصة</label>
                   <select 
                      className="w-full bg-slate-50 text-[10px] font-bold p-2 rounded-lg outline-none border border-slate-200 focus:border-indigo-300"
                      value={item.lessonType}
                      onChange={(e) => handleConditionChange(idx, { lessonType: e.target.value as any })}
                   >
                      {COMPONENT_OPTIONS.lessonType.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                   </select>
                </div>

                {/* 3. Subject */}
                <div className="flex-1 w-full xl:w-auto">
                   <label className="block text-[8px] font-bold text-slate-400 mb-1">الموضوع</label>
                   <select 
                      className="w-full bg-slate-50 text-[10px] font-bold p-2 rounded-lg outline-none border border-slate-200 focus:border-indigo-300"
                      value={item.subject}
                      onChange={(e) => handleConditionChange(idx, { subject: e.target.value as any })}
                   >
                      {getSubjectOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                   </select>
                </div>

                {/* 4. Time Context */}
                <div className="flex-1 w-full xl:w-auto">
                   <label className="block text-[8px] font-bold text-slate-400 mb-1">الزمن</label>
                   <select 
                      className="w-full bg-slate-50 text-[10px] font-bold p-2 rounded-lg outline-none border border-slate-200 focus:border-indigo-300"
                      value={item.timeContext}
                      onChange={(e) => handleConditionChange(idx, { timeContext: e.target.value as any })}
                   >
                      {COMPONENT_OPTIONS.timeContext.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                   </select>
                </div>

                {/* 5. Relationship */}
                <div className="flex-1 w-full xl:w-auto">
                   <label className="block text-[8px] font-bold text-slate-400 mb-1">العلاقة</label>
                   <select 
                      className="w-full bg-slate-50 text-[10px] font-bold p-2 rounded-lg outline-none border border-slate-200 focus:border-indigo-300"
                      value={item.relationship}
                      onChange={(e) => handleConditionChange(idx, { relationship: e.target.value as any })}
                   >
                      {COMPONENT_OPTIONS.relationship.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                   </select>
                </div>

                <button onClick={() => handleRemove(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors mt-3 xl:mt-0"><Trash2 size={16}/></button>
              </div>
            );
          }
        })}
        {group.conditions.length === 0 && <div className="text-center py-2 text-[10px] text-slate-400 italic">لا توجد شروط (يطبق دائماً)</div>}
      </div>
    </div>
  );
};

export default ConditionBuilder;
