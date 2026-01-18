
import React, { useMemo, useState, useEffect, memo, useRef } from 'react';
import { 
  Clock, CloudRain, Sun, CloudSun, CloudFog, CloudLightning, 
  UserX, Coffee, CalendarRange, LayoutList, Bell, Zap, Edit3, Plus,
  ChevronDown, CheckCircle2, Menu
} from 'lucide-react';
import { 
  Employee, Lesson, ScheduleConfig, AbsenceRecord, 
  EngineContext, SubstitutionLog, SystemAlert, ViewState,
  CalendarEvent, ModeConfig, ClassItem
} from '@/types';
import { DAYS_AR } from '@/constants';
import { getLiveSchoolStatus, generatePatternFromConfig, timeToMins } from '@/utils';

// --- LIVE CHRONOMETER COMPONENT ---
interface LiveChronometerProps {
  scheduleConfig: ScheduleConfig;
  engineContext: EngineContext;
  absences: AbsenceRecord[];
  substitutionLogs: SubstitutionLog[];
  employees: Employee[];
  systemAlerts: SystemAlert[];
  events: CalendarEvent[];
  onNavigateToView: (view: ViewState) => void;
  onNavigateToSchedule: (mode: 'class' | 'teacher' | 'subject', id: string | number) => void;
}

const LiveChronometer = memo(({ 
  scheduleConfig, 
  engineContext,
  absences,
  substitutionLogs,
  employees,
  systemAlerts,
  events,
  onNavigateToView,
  onNavigateToSchedule
}: LiveChronometerProps) => {
  const [time, setTime] = useState(new Date());
  // Default to a generic sunny day to look good if fetch fails
  const [weather, setWeather] = useState({ temp: 24, condition: 'صافي', code: 0, wind: 10 });
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch Live Weather (Robust Error Handling)
  useEffect(() => {
      const fetchWeather = async () => {
          try {
              const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=31.7683&longitude=35.2137&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto');
              if (!res.ok) return; // Silently fail on network error
              
              const data = await res.json();
              if (data && data.current) {
                  const temp = Math.round(data.current.temperature_2m);
                  const code = data.current.weather_code;
                  const wind = Math.round(data.current.wind_speed_10m);
                  let condition = 'صافي';
                  if (code > 0 && code <= 3) condition = 'غائم جزئياً';
                  if (code >= 45 && code <= 48) condition = 'ضبابي';
                  if (code >= 51 && code <= 67) condition = 'ماطر';
                  if (code >= 71 && code <= 77) condition = 'ثلجي';
                  if (code >= 80 && code <= 82) condition = 'زخات مطر';
                  if (code >= 95) condition = 'عاصف';
                  setWeather({ temp, condition, code, wind });
              }
          } catch (e) {
              // Suppress error logging to avoid console noise
          }
      };
      fetchWeather();
      const wTimer = setInterval(fetchWeather, 30 * 60 * 1000);
      return () => clearInterval(wTimer);
  }, []);

  const todayStr = time.toISOString().split('T')[0];
  const liveStatus = useMemo(() => getLiveSchoolStatus(scheduleConfig), [scheduleConfig, time.getMinutes()]);
  const todayAbsences = absences.filter(a => a.date === todayStr);
  
  // Future Events Logic (Next 3)
  const upcomingEvents = useMemo(() => {
      return events
        .filter(e => e.date >= todayStr) 
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3);
  }, [events, todayStr]);
  
  // Calculate Timeline
  const timeline = useMemo(() => {
      const pattern = generatePatternFromConfig(scheduleConfig);
      return pattern.periods;
  }, [scheduleConfig]);

  // Auto-scroll timeline to active period
  useEffect(() => {
      if (timelineRef.current && liveStatus.currentPeriod) {
          const activeEl = timelineRef.current.querySelector('[data-active="true"]');
          if (activeEl) {
              activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  }, [liveStatus.currentPeriod, timelineRef.current]);

  // Slot Progress %
  let slotProgress = 0;
  if (liveStatus.state === 'BEFORE_SCHOOL') slotProgress = 100;
  else if (liveStatus.state === 'AFTER_SCHOOL' || liveStatus.state === 'HOLIDAY') slotProgress = 0;
  else {
      const currentSlotTotalMins = timeline.find(p => p.period === liveStatus.currentPeriod && !!p.break === (liveStatus.state === 'IN_BREAK'))
        ? timeToMins(timeline.find(p => p.period === liveStatus.currentPeriod && !!p.break === (liveStatus.state === 'IN_BREAK'))!.end) - timeToMins(timeline.find(p => p.period === liveStatus.currentPeriod && !!p.break === (liveStatus.state === 'IN_BREAK'))!.start)
        : 45;
      slotProgress = Math.min(100, Math.max(0, ((currentSlotTotalMins - liveStatus.minsRemainingInSlot) / currentSlotTotalMins) * 100));
  }

  const radius = 110; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (slotProgress / 100) * circumference;

  const getTimerLabel = () => {
      switch (liveStatus.state) {
          case 'BEFORE_SCHOOL': return 'باقي لبداية الدوام';
          case 'AFTER_SCHOOL': return 'انتهى الدوام المدرسي';
          case 'HOLIDAY': return 'عطلة رسمية';
          case 'IN_BREAK': return 'نهاية الاستراحة';
          default: return 'نهاية الحصة';
      }
  };

  const getStatusColor = () => {
      if (liveStatus.state === 'IN_BREAK') return 'text-amber-400';
      if (liveStatus.state === 'BEFORE_SCHOOL') return 'text-emerald-400';
      if (liveStatus.state === 'AFTER_SCHOOL') return 'text-slate-400';
      if (liveStatus.state === 'HOLIDAY') return 'text-rose-400';
      return 'text-indigo-400';
  };

  const getRingColor = () => {
      if (liveStatus.state === 'IN_BREAK') return '#f59e0b';
      if (liveStatus.state === 'BEFORE_SCHOOL') return '#10b981';
      if (liveStatus.state === 'AFTER_SCHOOL') return '#64748b';
      if (liveStatus.state === 'HOLIDAY') return '#fb7185';
      return '#6366f1';
  };

  const WeatherIcon = useMemo(() => {
      const code = weather.code;
      if (code >= 95) return CloudLightning;
      if (code >= 51) return CloudRain;
      if (code >= 45) return CloudFog;
      if (code > 0 && code <= 3) return CloudSun;
      return Sun;
  }, [weather.code]);

  return (
    <div className="bg-slate-900 text-white rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden h-full border border-slate-800 group transition-all duration-500 w-full animate-fade-in flex flex-col">
       
       {/* Background Ambient Effects (Z-0) */}
       <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[2rem] md:rounded-[3.5rem]">
           <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse-slow"></div>
           <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[120px]"></div>
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
       </div>

       {/* MAIN LAYOUT GRID (Z-20) */}
       <div className="relative z-20 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6 lg:p-8 h-full min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar">
          
          {/* --- RIGHT COLUMN: STATUS & TASKS (Col 1-3) --- */}
          <div className="lg:col-span-3 flex flex-col gap-4 order-2 lg:order-1">
             {/* Status Cards */}
             <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 shrink-0">
                <div className="flex items-center gap-4 bg-rose-500/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-rose-500/20 shadow-lg">
                    <div className="p-2.5 bg-rose-500/20 rounded-full text-rose-400"><UserX size={18} /></div>
                    <div className="flex flex-col">
                       <span className="text-xl font-black leading-none text-rose-400 tabular-nums">{todayAbsences.length}</span>
                       <span className="text-[8px] text-rose-200/60 font-bold uppercase tracking-widest mt-1">غياب اليوم</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-amber-500/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-amber-500/20 shadow-lg">
                    <div className="p-2.5 bg-amber-500/20 rounded-full text-amber-400"><Coffee size={18} /></div>
                    <div className="flex flex-col">
                       <span className="text-xl font-black leading-none text-amber-400 tabular-nums">
                          {liveStatus.minsToNextBreak1 !== null ? `${liveStatus.minsToNextBreak1}د` : '--'}
                       </span>
                       <span className="text-[8px] text-amber-200/60 font-bold uppercase tracking-widest mt-1">للاستراحة</span>
                    </div>
                </div>
             </div>

             {/* Upcoming Tasks */}
             <div className="flex-1 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 p-4 flex flex-col min-h-[200px] overflow-hidden relative">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Zap size={14} className="text-indigo-400"/> المهام القادمة</h4>
                <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2.5 pr-1">
                    {upcomingEvents.length > 0 ? upcomingEvents.map((evt, idx) => (
                        <div key={idx} className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 hover:bg-slate-700 transition-colors group cursor-pointer">
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${
                                  evt.eventType === 'EXAM' ? 'bg-rose-500/20 text-rose-300' :
                                  evt.eventType === 'TRIP' ? 'bg-emerald-500/20 text-emerald-300' :
                                  'bg-indigo-500/20 text-indigo-300'
                               }`}>{evt.eventType}</span>
                               <span className="text-[8px] font-mono text-slate-500">{new Date(evt.date).getDate()} {DAYS_AR[new Date(evt.date).getDay()]}</span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-200 leading-snug group-hover:text-white transition-colors">{evt.title}</p>
                        </div>
                    )) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                            <CheckCircle2 size={32} strokeWidth={1} />
                            <span className="text-[10px] font-bold mt-2">لا مهام قريبة</span>
                        </div>
                    )}
                </div>
             </div>
          </div>

          {/* --- CENTER COLUMN: CLOCK (Col 4-9) --- */}
          <div className="lg:col-span-6 flex flex-col items-center justify-start lg:justify-center relative order-1 lg:order-2 py-4 lg:py-0">
             
             {/* Date Display */}
             <div className="mb-6 lg:mb-8 text-center">
                <span className="block text-5xl md:text-6xl font-black tracking-tighter leading-none text-white drop-shadow-2xl">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <span className="block text-xs md:text-sm text-indigo-300 font-bold uppercase tracking-[0.2em] mt-2 opacity-80">{DAYS_AR[time.getDay()]} {time.toLocaleDateString('en-GB')}</span>
             </div>

             {/* The Reactor */}
             <div className="relative w-[18rem] h-[18rem] md:w-[22rem] md:h-[22rem] flex items-center justify-center mb-6 lg:mb-0">
                
                {/* Satellites (Desktop: Absolute / Mobile: Hidden to Grid below) */}
                <div className="hidden lg:block">
                    <button onClick={() => onNavigateToView('calendar')} className="absolute -top-6 -right-20 bg-slate-800/80 hover:bg-indigo-600 backdrop-blur-md p-4 rounded-2xl border border-slate-700 hover:border-indigo-400 flex flex-col items-center gap-1 transition-all hover:scale-110 shadow-2xl z-30 group">
                        <CalendarRange size={20} className="text-indigo-300 group-hover:text-white" />
                        <span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-white">الرزنامة</span>
                    </button>

                    <button onClick={() => onNavigateToView('substitutions')} className="absolute -top-6 -left-20 bg-slate-800/80 hover:bg-rose-600 backdrop-blur-md p-4 rounded-2xl border border-slate-700 hover:border-rose-400 flex flex-col items-center gap-1 transition-all hover:scale-110 shadow-2xl z-30 group">
                        <UserX size={20} className="text-rose-300 group-hover:text-white" />
                        <span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-white">الغياب</span>
                    </button>

                    <button onClick={() => onNavigateToSchedule('teacher', 0)} className="absolute -bottom-6 -right-20 bg-slate-800/80 hover:bg-emerald-600 backdrop-blur-md p-4 rounded-2xl border border-slate-700 hover:border-emerald-400 flex flex-col items-center gap-1 transition-all hover:scale-110 shadow-2xl z-30 group">
                        <LayoutList size={20} className="text-emerald-300 group-hover:text-white" />
                        <span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-white">الجدول</span>
                    </button>

                    <button className="absolute -bottom-6 -left-20 bg-slate-800/80 hover:bg-amber-600 backdrop-blur-md p-4 rounded-2xl border border-slate-700 hover:border-amber-400 flex flex-col items-center gap-1 transition-all hover:scale-110 shadow-2xl z-30 group">
                        <Bell size={20} className="text-amber-300 group-hover:text-white" />
                        <span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-white">تنبيهات</span>
                        {systemAlerts.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>}
                    </button>
                </div>

                {/* SVG Ring (Responsive) */}
                <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_50px_rgba(99,102,241,0.2)]" viewBox="0 0 240 240">
                    <circle cx="120" cy="120" r={radius} stroke="#1e293b" strokeWidth="16" fill="none" className="opacity-50" />
                    <circle cx="120" cy="120" r={radius} stroke={getRingColor()} strokeWidth="16" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
                </svg>

                {/* Inner Info */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
                    <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest mb-1 ${getStatusColor()}`}>{getTimerLabel()}</span>
                    {liveStatus.state === 'AFTER_SCHOOL' ? (
                        <span className="text-4xl md:text-5xl font-black text-slate-600">مغلق</span>
                    ) : liveStatus.state === 'HOLIDAY' ? (
                        <span className="text-4xl md:text-5xl font-black text-slate-600">عطلة</span>
                    ) : (
                        <div className="flex items-baseline leading-none">
                            <span className="text-[5rem] md:text-[7rem] font-black tabular-nums tracking-tighter text-white drop-shadow-lg">
                                {liveStatus.minsRemainingInSlot}
                            </span>
                            <span className="text-xl md:text-2xl font-bold text-slate-500 ml-1">د</span>
                        </div>
                    )}
                    <div className="mt-2 md:mt-4 px-3 md:px-4 py-1 bg-slate-800/80 rounded-full border border-slate-700 backdrop-blur-sm">
                        <span className="text-[9px] md:text-[10px] font-black text-slate-300">
                            {liveStatus.state === 'IN_PERIOD' ? `الحصة الدراسية ${liveStatus.currentPeriod}` : 
                            liveStatus.state === 'IN_BREAK' ? 'وقت الاستراحة' : 
                            liveStatus.state === 'BEFORE_SCHOOL' ? 'لم يبدأ الدوام' : 
                            liveStatus.state === 'HOLIDAY' ? 'عطلة رسمية' :
                            'نهاية اليوم'}
                        </span>
                    </div>
                </div>
             </div>

             {/* MOBILE SATELLITES GRID (Visible only on mobile) */}
             <div className="grid grid-cols-4 gap-3 w-full lg:hidden mb-4">
                <button onClick={() => onNavigateToView('calendar')} className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 flex flex-col items-center gap-1 active:bg-indigo-600 active:text-white transition-colors">
                    <CalendarRange size={18} />
                    <span className="text-[8px] font-black">الرزنامة</span>
                </button>
                <button onClick={() => onNavigateToView('substitutions')} className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 flex flex-col items-center gap-1 active:bg-rose-600 active:text-white transition-colors">
                    <UserX size={18} />
                    <span className="text-[8px] font-black">الغياب</span>
                </button>
                <button onClick={() => onNavigateToSchedule('teacher', 0)} className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 flex flex-col items-center gap-1 active:bg-emerald-600 active:text-white transition-colors">
                    <LayoutList size={18} />
                    <span className="text-[8px] font-black">الجدول</span>
                </button>
                <button className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 flex flex-col items-center gap-1 active:bg-amber-600 active:text-white transition-colors relative">
                    <Bell size={18} />
                    <span className="text-[8px] font-black">تنبيهات</span>
                    {systemAlerts.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>}
                </button>
             </div>
          </div>

          {/* --- LEFT COLUMN: WEATHER & VERTICAL TIMELINE (Col 10-12) --- */}
          <div className="lg:col-span-3 flex flex-col gap-4 order-3 h-auto lg:h-full">
             
             {/* Weather Widget */}
             <div className="bg-white/5 backdrop-blur-md p-4 rounded-[2rem] border border-white/10 flex items-center justify-between shadow-lg shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-full text-amber-400 shadow-inner">
                        <WeatherIcon size={20} />
                    </div>
                    <div>
                        <span className="block text-xl font-black leading-none">{weather.temp}°</span>
                        <span className="text-[9px] text-slate-400 font-bold">{weather.condition}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase">الرياح</span>
                    <span className="block text-xs font-black text-indigo-300">{weather.wind} km/h</span>
                </div>
             </div>

             {/* VERTICAL TIMELINE (Fixed Height on Desktop, Scrollable on Mobile) */}
             <div className="flex-1 bg-slate-800/40 rounded-[2rem] border border-white/5 backdrop-blur-md relative overflow-hidden flex flex-col shadow-inner min-h-[250px] lg:min-h-0">
                {/* Connector Line */}
                <div className="absolute top-4 bottom-4 right-[2.35rem] w-0.5 bg-slate-700/50 rounded-full z-0"></div>
                
                <div className="overflow-y-auto custom-scrollbar flex-1 p-4 space-y-6 relative z-10" ref={timelineRef}>
                   {timeline.map((slot, idx) => {
                       const slotStartMins = timeToMins(slot.start);
                       const slotEndMins = timeToMins(slot.end);
                       const nowMins = time.getHours() * 60 + time.getMinutes();
                       const isCurrent = nowMins >= slotStartMins && nowMins < slotEndMins;
                       const isPassed = nowMins >= slotEndMins;

                       return (
                           <div key={idx} className={`flex items-center gap-4 group ${isPassed ? 'opacity-50 grayscale' : 'opacity-100'}`} data-active={isCurrent}>
                               
                               {/* Circle Node */}
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all relative z-10 ${isCurrent ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-110' : slot.break ? 'bg-slate-800 border-amber-500/50 text-amber-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                                   {slot.break ? <Coffee size={16} /> : <span className="font-black text-base">{slot.period}</span>}
                                   {isCurrent && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>}
                               </div>

                               {/* Info */}
                               <div className={`flex-1 p-2.5 rounded-xl border transition-all ${isCurrent ? 'bg-white/10 border-indigo-500/30' : 'bg-transparent border-transparent group-hover:bg-white/5'}`}>
                                   <div className="flex justify-between items-center mb-0.5">
                                       <span className={`text-[10px] font-black ${isCurrent ? 'text-white' : slot.break ? 'text-amber-400' : 'text-slate-300'}`}>
                                           {slot.break ? 'استراحة' : `الحصة ${slot.period}`}
                                       </span>
                                       {isCurrent && <span className="text-[8px] font-bold text-emerald-400 animate-pulse">جارية</span>}
                                   </div>
                                   <span className={`text-[9px] font-mono block ${isCurrent ? 'text-indigo-200' : 'text-slate-500'}`}>{slot.start} - {slot.end}</span>
                               </div>
                           </div>
                       );
                   })}
                </div>
                
                {/* Scroll Indicator Fade */}
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
             </div>

          </div>

       </div>
    </div>
  );
});

interface DashboardProps {
  // Simplified props for dedicated Chronometer
  employees: Employee[];
  classes: ClassItem[];
  lessons: Lesson[];
  scheduleConfig: ScheduleConfig;
  absences: AbsenceRecord[];
  engineContext: EngineContext;
  substitutionLogs: SubstitutionLog[];
  systemAlerts: SystemAlert[];
  events: CalendarEvent[];
  onNavigateToView: (view: ViewState) => void;
  onNavigateToSchedule: (mode: 'class' | 'teacher' | 'subject', id: string | number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  employees, classes, lessons, scheduleConfig, absences, engineContext, 
  onNavigateToView, onNavigateToSchedule, substitutionLogs, events, systemAlerts
}) => {
  
  // Dashboard is now exclusively the Live Chronometer in Full Screen Mode
  return (
    <div className="h-[calc(100vh-120px)] w-full pb-4 md:pb-6" dir="rtl">
        <LiveChronometer 
            scheduleConfig={scheduleConfig} 
            engineContext={engineContext}
            absences={absences}
            substitutionLogs={substitutionLogs}
            employees={employees}
            systemAlerts={systemAlerts}
            events={events}
            onNavigateToView={onNavigateToView}
            onNavigateToSchedule={onNavigateToSchedule}
        />
    </div>
  );
};

export default Dashboard;
