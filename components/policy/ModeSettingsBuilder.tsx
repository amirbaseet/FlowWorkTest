
import React from 'react';
import { 
  Users, BookOpen, Clock, Layers, Briefcase, Scale, Layout, 
  ToggleLeft, ToggleRight, Info, AlertTriangle, Shield
} from 'lucide-react';
import { ModeSettings } from '../../types/policy';

interface ModeSettingsBuilderProps {
  settings: ModeSettings;
  onChange: (settings: ModeSettings) => void;
}

const ModeSettingsBuilder: React.FC<ModeSettingsBuilderProps> = ({ settings, onChange }) => {
  
  const updateDomain = <K extends keyof ModeSettings>(domain: K, updates: Partial<ModeSettings[K]>) => {
    onChange({ ...settings, [domain]: { ...settings[domain], ...updates } });
  };

  const Section = ({ title, icon: Icon, color, children }: any) => (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 hover:shadow-md transition-all">
      <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
        <div className={`p-2 rounded-xl ${color} bg-opacity-10 text-current`}>
          <Icon size={20} className={color.replace('bg-', 'text-')} />
        </div>
        <h4 className="font-black text-slate-800 text-sm">{title}</h4>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );

  const Toggle = ({ label, checked, onChange, desc }: any) => (
    <div className="flex justify-between items-start gap-4">
      <div className="flex-1">
        <p className={`text-xs font-bold ${checked ? 'text-indigo-900' : 'text-slate-600'}`}>{label}</p>
        {desc && <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => onChange(!checked)} className={`text-2xl transition-colors ${checked ? 'text-indigo-600' : 'text-slate-300'}`}>
        {checked ? <ToggleRight /> : <ToggleLeft />}
      </button>
    </div>
  );

  const NumberInput = ({ label, value, onChange, min = 0, suffix }: any) => (
    <div className="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
      <span className="text-[10px] font-bold text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          min={min} 
          className="w-12 bg-transparent text-center font-black text-slate-800 outline-none" 
          value={value} 
          onChange={e => onChange(Number(e.target.value))} 
        />
        {suffix && <span className="text-[9px] text-slate-400">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
      
      {/* 1. Teacher Settings */}
      <Section title="إعدادات المعلمين (Teachers)" icon={Users} color="bg-blue-600">
        <Toggle 
          label="تعطيل الكادر الخارجي" 
          desc="إخفاء جميع البدلاء الخارجيين من قائمة الترشيح."
          checked={settings.teacher.disableExternal} 
          onChange={(v: boolean) => updateDomain('teacher', { disableExternal: v })} 
        />
        <Toggle 
          label="احتساب الفراغ كخروج" 
          desc="المعلم الذي لا يملك حصصًا يعتبر خارج الدوام."
          checked={settings.teacher.treatNoLessonsAsOffDuty} 
          onChange={(v: boolean) => updateDomain('teacher', { treatNoLessonsAsOffDuty: v })} 
        />
        <Toggle 
          label="إلزام مربي الصف" 
          desc="إجبار المربي على التواجد إذا كان صفه مستهدفاً."
          checked={settings.teacher.forceHomeroomPresence} 
          onChange={(v: boolean) => updateDomain('teacher', { forceHomeroomPresence: v })} 
        />
      </Section>

      {/* 2. Lesson Settings */}
      <Section title="إعدادات الحصص (Lessons)" icon={BookOpen} color="bg-emerald-600">
        <Toggle 
          label="حظر حصص المكوث" 
          desc="عدم استخدام حصص المكوث للتغطية نهائياً."
          checked={settings.lesson.disableStay} 
          onChange={(v: boolean) => updateDomain('lesson', { disableStay: v })} 
        />
        <Toggle 
          label="حظر الحصص الفردية" 
          desc="حماية الحصص الفردية من الإلغاء."
          checked={settings.lesson.disableIndividual} 
          onChange={(v: boolean) => updateDomain('lesson', { disableIndividual: v })} 
        />
        <div className="pt-2 border-t border-slate-100">
           <Toggle 
            label="وضع المبادلة فقط (Swap Only)" 
            desc="السماح فقط بتبديل الحصص الفعلية."
            checked={settings.lesson.forceActualOnly} 
            onChange={(v: boolean) => updateDomain('lesson', { forceActualOnly: v })} 
          />
        </div>
      </Section>

      {/* 3. Time Settings */}
      <Section title="إعدادات الزمن (Time)" icon={Clock} color="bg-amber-500">
        <Toggle 
          label="تجاهل فراغ بداية اليوم" 
          checked={settings.time.ignoreGapsAtStart} 
          onChange={(v: boolean) => updateDomain('time', { ignoreGapsAtStart: v })} 
        />
        <Toggle 
          label="تجاهل فراغ نهاية اليوم" 
          checked={settings.time.ignoreGapsAtEnd} 
          onChange={(v: boolean) => updateDomain('time', { ignoreGapsAtEnd: v })} 
        />
        <NumberInput 
          label="الحد الأقصى للتتابع" 
          value={settings.time.maxConsecutivePeriods} 
          onChange={(v: number) => updateDomain('time', { maxConsecutivePeriods: v })}
          suffix="حصص"
        />
      </Section>

      {/* 4. Class Settings */}
      <Section title="الصفوف والطبقات (Classes)" icon={Layers} color="bg-indigo-600">
        <Toggle 
          label="السماح بالدمج الصفي" 
          checked={settings.class.allowMerge} 
          onChange={(v: boolean) => updateDomain('class', { allowMerge: v })} 
        />
        {settings.class.allowMerge && (
          <NumberInput 
            label="أقصى عدد للدمج" 
            value={settings.class.maxMergedCount} 
            onChange={(v: number) => updateDomain('class', { maxMergedCount: v })}
            suffix="شعب"
          />
        )}
      </Section>

      {/* 5. Subject Settings */}
      <Section title="الموضوع الحاكم (Subject)" icon={Briefcase} color="bg-violet-600">
        <div className="space-y-2">
           <label className="text-[10px] font-bold text-slate-500">الموضوع الأساسي للنمط</label>
           <input 
             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
             placeholder="مثال: رياضيات (للامتحانات)"
             value={settings.subject.governingSubject}
             onChange={e => updateDomain('subject', { governingSubject: e.target.value })}
           />
        </div>
        <Toggle 
          label="أولوية مطلقة للموضوع" 
          desc="تفضيل معلمي هذا الموضوع على الجميع."
          checked={settings.subject.prioritizeGoverningSubject} 
          onChange={(v: boolean) => updateDomain('subject', { prioritizeGoverningSubject: v })} 
        />
      </Section>

      {/* 6. HR & Fairness */}
      <Section title="الموارد البشرية (HR)" icon={Scale} color="bg-rose-500">
        <NumberInput 
          label="الحد الأقصى اليومي" 
          value={settings.hr.maxDailyCoverage} 
          onChange={(v: number) => updateDomain('hr', { maxDailyCoverage: v })}
          suffix="حصص"
        />
        <div className="space-y-2 pt-2">
           <label className="text-[10px] font-bold text-slate-500">حساسية العدالة</label>
           <select 
             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
             value={settings.hr.fairnessSensitivity}
             onChange={e => updateDomain('hr', { fairnessSensitivity: e.target.value as any })}
           >
              <option value="strict">صارمة (Strict)</option>
              <option value="flexible">مرنة (Flexible)</option>
              <option value="off">معطلة (Off)</option>
           </select>
        </div>
      </Section>

      {/* 7. UI Behavior */}
      <Section title="واجهة المستخدم (UI)" icon={Layout} color="bg-slate-600">
        <Toggle 
          label="إخفاء المرشحين المحظورين" 
          desc="عدم إظهار المعلمين غير المتاحين في القائمة."
          checked={settings.ui.hideForbiddenCandidates} 
          onChange={(v: boolean) => updateDomain('ui', { hideForbiddenCandidates: v })} 
        />
        <Toggle 
          label="قفل التجاوز اليدوي" 
          desc="منع المدير من اختيار معلم محظور."
          checked={settings.ui.lockManualOverride} 
          onChange={(v: boolean) => updateDomain('ui', { lockManualOverride: v })} 
        />
        <Toggle 
          label="طلب تبرير إلزامي" 
          desc="طلب سبب عند مخالفة النظام."
          checked={settings.ui.requireJustification} 
          onChange={(v: boolean) => updateDomain('ui', { requireJustification: v })} 
        />
      </Section>

      <div className="md:col-span-2 lg:col-span-3 bg-indigo-50 p-6 rounded-[2.5rem] border border-indigo-100 flex items-start gap-4">
         <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm"><Info size={20}/></div>
         <div>
            <h4 className="font-black text-indigo-900 text-sm">كيف يعمل محرك الإعدادات؟</h4>
            <p className="text-xs font-bold text-indigo-700/80 mt-1 leading-relaxed max-w-3xl">
               تعمل هذه الإعدادات كمرشح أولي (Pre-Filter) لتجهيز بيئة العمل قبل تطبيق القواعد. الخيارات التي يتم تعطيلها هنا لن تظهر في الحسابات ولن تحتاج إلى قواعد لمنعها، مما يسرع عملية المعالجة ويقلل التعقيد.
            </p>
         </div>
      </div>

    </div>
  );
};

export default ModeSettingsBuilder;
