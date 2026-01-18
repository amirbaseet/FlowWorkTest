
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, Loader2, Wand2, BrainCircuit, Activity } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useToast } from '@/contexts/ToastContext';
import { Lesson, Employee, ClassItem, SubstitutionLog, AbsenceRecord, ScheduleConfig } from '@/types';
import { useLessons } from '@/hooks/useLessons';
import { useSubstitutions } from '@/hooks/useSubstitutions';
import { useAbsences } from '@/hooks/useAbsences';

interface AiAssistantProps {
  employees: Employee[];
  classes: ClassItem[];
  scheduleConfig: ScheduleConfig;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ employees, classes, scheduleConfig }) => {
  const { addToast } = useToast();
  const { lessons } = useLessons();
  const { substitutionLogs } = useSubstitutions();
  const { absences } = useAbsences();
  const schoolName = scheduleConfig.schoolInfo?.name || "مدرستي";

  const [messages, setMessages] = useState<any[]>([
    { id: 'welcome', role: 'model', content: `أهلاً بك في العقل المركزي لـ "${schoolName}". أنا مطلع على حالة الطاقم والرزنامة اليومية وهيكلية الحصص (${scheduleConfig.periodsPerDay} حصص). كيف يمكنني دعم اتخاذ القرار اليوم؟` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const generateResponse = async (prompt: string) => {
    if (!process.env.API_KEY) return;
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // حقن "الوعي الميداني" في التعليمات
      const fieldAwareness = `
        Context Awareness:
        - School Name: ${schoolName}
        - Daily Periods: ${scheduleConfig.periodsPerDay}
        - Current Date: ${new Date().toLocaleDateString('ar-EG')}
        - Active Absences Today: ${absences.filter(a => a.date === new Date().toISOString().split('T')[0]).length}
        - Completed Substitutions: ${substitutionLogs.filter(l => l.date === new Date().toISOString().split('T')[0]).length}
        - Staff Reliability: ${employees.length} teachers active.
        
        Recent Activity Logs:
        ${substitutionLogs.slice(-5).map(l => `- ${l.substituteName} covered for ${l.absentTeacherId} in period ${l.period}`).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: `You are the Strategic Brain of ${schoolName} System. ${fieldAwareness} Answer with deep logic, considering the current operational status. Always prioritize educational stability.`,
        },
      });

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: response.text }]);
    } catch (error) {
      addToast("عذراً، المحرك الذكي منشغل حالياً", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-fade-in">
      <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl shadow-slate-200"><BrainCircuit size={28} /></div>
          <div><h2 className="font-black text-2xl text-slate-800 tracking-tight">المساعد الاستراتيجي</h2><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">ربط البيانات بالقرار الذكي</p></div>
        </div>
        <div className="flex items-center gap-3 bg-emerald-50 text-emerald-600 px-5 py-2 rounded-2xl border border-emerald-100 font-black text-[10px] uppercase tracking-widest">
          <Activity size={14} className="animate-pulse" /> متصل بالرزنامة الحية
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-slide-up`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 border border-slate-100'}`}>
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className={`max-w-[75%] p-6 rounded-[2rem] text-sm leading-relaxed font-bold shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && <div className="flex items-center gap-3 text-slate-400 font-black text-xs animate-pulse mr-14"><Loader2 className="animate-spin" size={16} /> جاري تحليل الرزنامة الزمنية...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-8 bg-white border-t border-slate-100">
        <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-[2.5rem] border border-slate-100 shadow-inner focus-within:bg-white focus-within:border-indigo-400 transition-all">
          <input className="flex-1 bg-transparent border-none outline-none px-6 py-3 font-bold text-slate-700 placeholder:text-slate-400" placeholder="اسأل عن أي تعارض أو اطلب تحليل غيابات الأسبوع..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !isLoading && (generateResponse(input), setMessages(p => [...p, { role: 'user', content: input }]), setInput(''))} />
          <button onClick={() => { generateResponse(input); setMessages(p => [...p, { role: 'user', content: input }]); setInput(''); }} disabled={isLoading || !input.trim()} className="bg-slate-900 hover:bg-indigo-600 text-white p-5 rounded-[1.75rem] transition-all shadow-xl disabled:bg-slate-200 btn-press">
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;
