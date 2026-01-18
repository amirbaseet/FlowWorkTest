
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
  const [weather, setWeather] = useState({ temp: 24, condition: 'صافي', code: 0, wind: 10 });
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Dashboard Pagination State
  const [page, setPage] = useState<1 | 2>(1);
  const [touchStart, setTouchStart] = useState(0);

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
  
  // Swipe Detection
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
      const diff = touchStart - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 75) {
          if (diff > 0 && page === 1) setPage(2);
          else if (diff < 0 && page === 2) setPage(1);
      }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 text-white rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden h-full border border-indigo-700 group transition-all duration-500 w-full animate-fade-in flex flex-col" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
       
       {/* Background Ambient Effects (Z-0) */}
       <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[2rem] md:rounded-[3.5rem]">
           <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-300/30 rounded-full blur-[150px] animate-pulse-slow"></div>
           <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-700/20 rounded-full blur-[120px]"></div>
           <div className="absolute inset-0 bg-indigo-900/10"></div>
       </div>
       
       {/* Page Indicator */}
       <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-50">
           <button onClick={() => setPage(1)} className={`h-2 rounded-full transition-all ${page === 1 ? 'bg-indigo-500 w-8' : 'bg-slate-600 w-2'}`} />
           <button onClick={() => setPage(2)} className={`h-2 rounded-full transition-all ${page === 2 ? 'bg-indigo-500 w-8' : 'bg-slate-600 w-2'}`} />
       </div>

       {/* MAIN LAYOUT GRID (Z-20) */}
       <div className="relative z-20 flex-1 overflow-hidden" style={{ width: '200%', transform: `translateX(${page === 1 ? '0' : '-50%'})`, transition: 'transform 0.3s ease-out' }}>
           <div className="flex h-full" style={{ width: '100%' }}>
               {/* PAGE 1 */}
               <div className="w-1/2 h-full p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
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
             <div className="flex-1 bg-white/10 backdrop-blur-md rounded-[2rem] border border-white/20 p-4 flex flex-col min-h-[200px] overflow-hidden relative shadow-lg">
                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2"><Zap size={14} className="text-indigo-200"/> المهام القادمة</h4>
                <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2.5 pr-1">
                    {upcomingEvents.length > 0 ? upcomingEvents.map((evt, idx) => (
                        <div key={idx} className="bg-white/10 p-2.5 rounded-xl border border-white/20 hover:bg-white/20 transition-colors group cursor-pointer">
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${
                                  evt.eventType === 'EXAM' ? 'bg-rose-500/20 text-rose-300' :
                                  evt.eventType === 'TRIP' ? 'bg-emerald-500/20 text-emerald-300' :
                                  'bg-indigo-500/20 text-indigo-300'
                               }`}>{evt.eventType}</span>
                               <span className="text-[8px] font-mono text-indigo-200">{new Date(evt.date).getDate()} {DAYS_AR[new Date(evt.date).getDay()]}</span>
                            </div>
                            <p className="text-[10px] font-bold text-white leading-snug group-hover:text-indigo-100 transition-colors">{evt.title}</p>
                        </div>
                    )) : (
                        <div className="h-full flex flex-col items-center justify-center text-indigo-200/60 opacity-50">
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
                    <button onClick={() => onNavigateToView('calendar')} className="absolute -top-6 -right-20 bg-white/20 hover:bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/30 hover:border-white/50 flex flex-col items-center gap-1 transition-all hover:scale-110 shadow-2xl z-30 group">
                        <CalendarRange size={20} className="text-white group-hover:text-indigo-100" />
                        <span className="text-[8px] font-black uppercase text-white group-hover:text-indigo-100">الرزنامة</span>
                    </button>

                    <button onClick={() => onNavigateToView('substitutions')} className="absolute -top-6 -left-20 bg-white/20 hover:bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/30 hover:border-white/50 flex flex-col items-center gap-1 transition-all hover:scale-110 shadow-2xl z-30 group">
                        <UserX size={20} className="text-white group-hover:text-rose-200" />
                        <span className="text-[8px] font-black uppercase text-white group-hover:text-rose-200">الغياب</span>
                    </button>

                    <button onClick={() => onNavigateToSchedule('teacher', 0)} className="absolute -bottom-6 -right-20 bg-white/20 hover:bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/30 hover:border-white/50 flex flex-col items-center gap-1 transition-all hover:scale-110 shadow-2xl z-30 group">
                        <LayoutList size={20} className="text-white group-hover:text-emerald-200" />
                        <span className="text-[8px] font-black uppercase text-white group-hover:text-emerald-200">الجدول</span>
                    </button>

                    <button className="absolute -bottom-6 -left-20 bg-white/20 hover:bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/30 hover:border-white/50 flex flex-col items-center gap-1 transition-all hover:scale-110 shadow-2xl z-30 group">
                        <Bell size={20} className="text-white group-hover:text-amber-200" />
                        <span className="text-[8px] font-black uppercase text-white group-hover:text-amber-200">تنبيهات</span>
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
                    <div className="mt-2 md:mt-4 px-3 md:px-4 py-1 bg-white/20 rounded-full border border-white/30 backdrop-blur-sm">
                        <span className="text-[9px] md:text-[10px] font-black text-white">
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
                <button onClick={() => onNavigateToView('calendar')} className="bg-white/15 p-3 rounded-xl border border-white/30 flex flex-col items-center gap-1 active:bg-white/30 active:text-white transition-colors text-white">
                    <CalendarRange size={18} />
                    <span className="text-[8px] font-black">الرزنامة</span>
                </button>
                <button onClick={() => onNavigateToView('substitutions')} className="bg-white/15 p-3 rounded-xl border border-white/30 flex flex-col items-center gap-1 active:bg-white/30 active:text-white transition-colors text-white">
                    <UserX size={18} />
                    <span className="text-[8px] font-black">الغياب</span>
                </button>
                <button onClick={() => onNavigateToSchedule('teacher', 0)} className="bg-white/15 p-3 rounded-xl border border-white/30 flex flex-col items-center gap-1 active:bg-white/30 active:text-white transition-colors text-white">
                    <LayoutList size={18} />
                    <span className="text-[8px] font-black">الجدول</span>
                </button>
                <button className="bg-white/15 p-3 rounded-xl border border-white/30 flex flex-col items-center gap-1 active:bg-white/30 active:text-white transition-colors relative text-white">
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
             <div className="flex-1 bg-white/10 rounded-[2rem] border border-white/20 backdrop-blur-md relative overflow-hidden flex flex-col shadow-inner min-h-[250px] lg:min-h-0">
                {/* Connector Line */}
                <div className="absolute top-4 bottom-4 right-[2.35rem] w-0.5 bg-white/20 rounded-full z-0"></div>
                
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
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all relative z-10 ${isCurrent ? 'bg-white border-indigo-300 text-indigo-600 shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-110' : slot.break ? 'bg-white/15 border-amber-400 text-amber-300' : 'bg-white/10 border-white/30 text-white'}`}>
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
               
               {/* PAGE 2: Tasks & Timeline */}
               <div className="w-1/2 h-full p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
                   <div className="max-w-2xl mx-auto space-y-6">
                       
                       {/* Page Title */}
                       <div className="text-center mb-8">
                           <h2 className="text-4xl font-black text-white mb-2">📅 المهام والجدول</h2>
                           <p className="text-slate-400 text-sm">تفاصيل اليوم والمهام القادمة</p>
                       </div>
                       
                       {/* Upcoming Tasks */}
                       <div className="bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 p-6">
                           <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                               <Zap size={16} className="text-indigo-400"/> المهام القادمة
                           </h4>
                           <div className="space-y-3">
                               {upcomingEvents.length > 0 ? upcomingEvents.map((evt, idx) => (
                                   <div key={idx} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:bg-slate-700 transition-colors group cursor-pointer">
                                       <div className="flex justify-between items-start mb-1.5">
                                           <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${
                                             evt.eventType === 'EXAM' ? 'bg-rose-500/20 text-rose-300' :
                                             evt.eventType === 'TRIP' ? 'bg-emerald-500/20 text-emerald-300' :
                                             'bg-indigo-500/20 text-indigo-300'
                                          }`}>{evt.eventType}</span>
                                          <span className="text-xs font-mono text-slate-500">{new Date(evt.date).getDate()} {DAYS_AR[new Date(evt.date).getDay()]}</span>
                                       </div>
                                       <p className="text-sm font-bold text-slate-200 leading-snug group-hover:text-white transition-colors">{evt.title}</p>
                                   </div>
                               )) : (
                                   <div className="h-32 flex flex-col items-center justify-center text-slate-500 opacity-50">
                                       <CheckCircle2 size={40} strokeWidth={1} />
                                       <span className="text-xs font-bold mt-2">لا مهام قريبة</span>
                                   </div>
                               )}
                           </div>
                       </div>
                       
                       {/* Timeline */}
                       <div className="bg-slate-800/40 rounded-[2rem] border border-white/5 backdrop-blur-md p-6 shadow-inner">
                           <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-4">🕒 جدول اليوم</h4>
                           <div className="relative">
                               {timeline && timeline.length > 0 ? (
                                   <>
                               <div className="absolute top-0 bottom-0 right-6 w-0.5 bg-slate-700/50 rounded-full"></div>
                               <div className="space-y-4">
                                  {timeline.slice(0, 8).map((slot, idx) => {
                                      const slotStartMins = timeToMins(slot.start);
                                      const slotEndMins = timeToMins(slot.end);
                                      const nowMins = time.getHours() * 60 + time.getMinutes();
                                      const isCurrent = nowMins >= slotStartMins && nowMins < slotEndMins;
                                      const isPassed = nowMins >= slotEndMins;

                                      return (
                                          <div key={idx} className={`flex items-center gap-4 ${
                                              isPassed ? 'opacity-40' : 'opacity-100'
                                          }`}>
                                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all relative z-10 ${
                                                  isCurrent ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-110' : 
                                                  slot.break ? 'bg-slate-800 border-amber-500/50 text-amber-500' : 
                                                  'bg-slate-900 border-slate-700 text-slate-400'
                                              }`}>
                                                  {slot.break ? <Coffee size={18} /> : <span className="font-black text-lg">{slot.period}</span>}
                                                  {isCurrent && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>}
                                              </div>
                                              <div className={`flex-1 p-3 rounded-xl border transition-all ${
                                                  isCurrent ? 'bg-white/10 border-indigo-500/30' : 'bg-transparent border-transparent'
                                              }`}>
                                                  <div className="flex justify-between items-center mb-1">
                                                      <span className={`text-xs font-black ${
                                                          isCurrent ? 'text-white' : slot.break ? 'text-amber-400' : 'text-slate-300'
                                                      }`}>
                                                          {slot.break ? 'استراحة' : `الحصة ${slot.period}`}
                                                      </span>
                                                      {isCurrent && <span className="text-[9px] font-bold text-emerald-400 animate-pulse">جارية</span>}
                                                  </div>
                                                  <span className={`text-xs font-mono block ${
                                                      isCurrent ? 'text-indigo-200' : 'text-slate-500'
                                                  }`}>{slot.start} - {slot.end}</span>
                                              </div>
                                          </div>
                                      );
                                  })}
                               </div>
                                   </>
                               ) : (
                                   <div className="text-center text-slate-500 py-8">
                                       <p className="text-sm font-bold">جاري تحميل الجدول...</p>
                                   </div>
                               )}
                           </div>
                       </div>
                       
                       {/* Quick Actions */}
                       <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => onNavigateToView('calendar')} className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 rounded-2xl border border-indigo-500 hover:shadow-lg transition-all group">
                               <CalendarRange size={24} className="text-white mb-2 group-hover:scale-110 transition-transform" />
                               <span className="text-xs font-black text-white block">الرزنامة</span>
                           </button>
                           <button onClick={() => onNavigateToView('substitutions')} className="bg-gradient-to-br from-rose-600 to-rose-800 p-4 rounded-2xl border border-rose-500 hover:shadow-lg transition-all group">
                               <UserX size={24} className="text-white mb-2 group-hover:scale-110 transition-transform" />
                               <span className="text-xs font-black text-white block">الغياب</span>
                           </button>
                           <button onClick={() => onNavigateToSchedule('teacher', 0)} className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 rounded-2xl border border-emerald-500 hover:shadow-lg transition-all group">
                               <LayoutList size={24} className="text-white mb-2 group-hover:scale-110 transition-transform" />
                               <span className="text-xs font-black text-white block">الجدول</span>
                           </button>
                           <button className="bg-gradient-to-br from-amber-600 to-amber-800 p-4 rounded-2xl border border-amber-500 hover:shadow-lg transition-all group relative">
                               <Bell size={24} className="text-white mb-2 group-hover:scale-110 transition-transform" />
                               <span className="text-xs font-black text-white block">تنبيهات</span>
                               {systemAlerts.length > 0 && <span className="absolute top-2 right-2 w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>}
                           </button>
                       </div>
                       
                       {/* Swipe Hint */}
                       <div className="text-center text-slate-500 text-xs font-bold mt-4 opacity-50">
                           ← اسحب لليمين للعودة
                       </div>
                   </div>
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
