
import React, { useState } from 'react';
import { 
  Share2, ArrowRight, Zap, ShieldCheck, Globe, CalendarPlus, 
  Send, CheckCircle, Info, X, School, Sparkles, Plus, 
  UserCheck, HeartHandshake, Briefcase
} from 'lucide-react';
import { Employee, ClassItem, CalendarEvent } from '../types';
import CalendarRequestForm from './CalendarRequestForm';

interface PartnerPortalProps {
  employees: Employee[];
  classes: ClassItem[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onBack: () => void;
  currentUser?: Employee | null; // Pass user context
}

const PartnerPortal: React.FC<PartnerPortalProps> = ({ employees, classes, setEvents, onBack, currentUser }) => {
  const [step, setStep] = useState<'landing' | 'form'>('landing');

  if (step === 'form') {
    return <CalendarRequestForm 
      employees={employees} 
      classes={classes} 
      setEvents={setEvents} 
      onClose={() => setStep('landing')} 
      currentUser={currentUser} // Pass undefined or null if external
    />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 animate-fade-in font-sans" dir="rtl">
      <div className="fixed top-10 flex items-center gap-4">
        <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-200">
           <School className="text-white" size={24} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tighter">
          نظام مدرستي <span className="text-indigo-600">الذكي</span>
        </h1>
      </div>

      <div className="max-w-4xl w-full bg-white rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/5 rounded-bl-[8rem] -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-700"></div>
        
        <div className="p-16 relative z-10 flex flex-col items-center text-center">
          <div className="w-28 h-28 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-inner">
             <Share2 size={56} />
          </div>

          <div className="space-y-4 mb-12">
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter">بوابة التعاون التشاركي</h2>
            <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.3em]">External Expert & Event Integration</p>
          </div>

          <p className="text-slate-500 font-bold text-xl leading-relaxed max-w-2xl mb-14">
            من خلال هذه الواجهة، لا تقتصر مساهمتكم على جدولة الفعاليات فحسب، بل يمكنكم عرض **خبير ميداني** من مركزكم ليتولى مهام الإشغال والتدريس المتخصص.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-16">
            <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 flex flex-col items-center text-center group/card hover:bg-white hover:border-indigo-500 hover:shadow-2xl transition-all cursor-pointer" onClick={() => setStep('form')}>
               <div className="p-5 bg-white rounded-2xl text-indigo-600 shadow-sm mb-6 group-hover/card:scale-110 transition-transform"><CalendarPlus size={36}/></div>
               <span className="font-black text-slate-900 text-xl mb-3">فعالية + كادر متخصص</span>
               <p className="text-sm text-slate-400 font-bold leading-relaxed">أضف فعالية مبرمجة مع ترشيح خبير من مركزكم للتنفيذ أو التغطية.</p>
            </div>
            
            <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 flex flex-col items-center text-center group/card hover:bg-white hover:border-amber-500 hover:shadow-2xl transition-all opacity-60">
               <div className="p-5 bg-white rounded-2xl text-amber-600 shadow-sm mb-6 group-hover/card:scale-110 transition-transform"><HeartHandshake size={36}/></div>
               <span className="font-black text-slate-900 text-xl mb-3">دعم الطوارئ (قريباً)</span>
               <p className="text-sm text-slate-400 font-bold leading-relaxed">إبلاغ المدرسة بجاهزية كادركم للمساندة في حالات غياب المعلمين المفاجئة.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 w-full">
            <button 
              onClick={() => setStep('form')} 
              className="flex-1 bg-slate-900 text-white py-7 rounded-[2rem] font-black text-lg shadow-2xl hover:bg-indigo-600 transition-all btn-press flex items-center justify-center gap-4 group/btn"
            >
              <Zap size={28} className="text-amber-400" />
              ابدأ عملية التنسيق الميداني
            </button>
            <button 
              onClick={onBack} 
              className="px-10 py-7 bg-white border-2 border-slate-100 text-slate-500 rounded-[2rem] font-black hover:bg-slate-50 transition-all btn-press"
            >
              العودة للرزنامة
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 flex items-center gap-3 text-slate-400 font-black text-[10px] uppercase tracking-widest">
        <Briefcase size={14} /> نظام الأشغال المتكامل v2.8
      </div>
    </div>
  );
};

export default PartnerPortal;
