
import React, { useMemo, useState, useEffect, memo, useRef } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  Clock,
  Search,
  User,
  Menu,
  X,
  CloudRain,
  Sun,
  CloudLightning,
  CloudFog,
  CloudSun,
  Wind,
  Droplets,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  LayoutList,
  CalendarRange,
  UserX,
  Shield,
  Users,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Coffee,
  Moon,
  CalendarDays
} from 'lucide-react';
import {
  Employee, Lesson, ScheduleConfig, AbsenceRecord,
  EngineContext, SubstitutionLog, SystemAlert, ViewState,
  CalendarEvent, ModeConfig, ClassItem
} from '@/types';
import { DAYS_AR } from '@/constants';
import { getOperationalScope } from '@/utils/accessControl';
import { useLessons } from '@/hooks/useLessons';
import { useAbsences } from '@/hooks/useAbsences';
import { useSubstitutions } from '@/hooks/useSubstitutions';

import { getLiveSchoolStatus, generatePatternFromConfig, timeToMins, normalizeArabic } from '@/utils';



import NotificationBell from './NotificationBell';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';


// --- LIVE CHRONOMETER COMPONENT ---
interface LiveChronometerProps {
  classes: ClassItem[];
  scheduleConfig: ScheduleConfig;
  engineContext: EngineContext;
  // absences: AbsenceRecord[]; // Removed
  // substitutionLogs: SubstitutionLog[]; // Removed
  employees: Employee[];
  systemAlerts: SystemAlert[];
  events: CalendarEvent[];
  // lessons: Lesson[]; // Removed
  currentUser: Employee | null;
  // Duty related props
  dutyAssignments: any[];
  facilities: any[];
  breakPeriods: any[];
  onNavigateToView: (view: ViewState) => void;
  onNavigateToSchedule: (mode: 'class' | 'teacher' | 'subject', id: string | number) => void;
}

const LiveChronometer = memo(({
  classes,
  scheduleConfig,
  engineContext,
  // absences,
  // substitutionLogs,
  employees,
  systemAlerts,
  events,
  // lessons,
  currentUser,
  dutyAssignments,
  facilities,
  breakPeriods,
  onNavigateToView,
  onNavigateToSchedule
}: LiveChronometerProps) => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState({ temp: 24, condition: 'صافي', code: 0, wind: 10, humidity: 45 });
  const timelineRef = useRef<HTMLDivElement>(null);

  // State for Available Now period navigation - default to 1
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);

  // Check if user is admin
  const isAdmin = currentUser?.baseRoleId === 'principal' || currentUser?.baseRoleId === 'vice_principal';

  // Hooks
  const { lessons } = useLessons();
  const { absences } = useAbsences();
  const { substitutionLogs } = useSubstitutions();

  // --- SCOPED ACCESS CONTROL ---
  // Determine what this user is allowed to see (Grade rules / Subject rules)
  const { visibleEmployees: scopedEmployees, visibleClasses: scopedClasses } = useMemo(() => {
    return getOperationalScope(currentUser, classes || [], employees);
  }, [currentUser, classes, employees]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch Live Weather (Robust Error Handling)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=31.7683&longitude=35.2137&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto');
        if (!res.ok) return;

        const data = await res.json();
        if (data && data.current) {
          const temp = Math.round(data.current.temperature_2m);
          const code = data.current.weather_code;
          const wind = Math.round(data.current.wind_speed_10m);
          const humidity = Math.round(data.current.relative_humidity_2m);

          let condition = 'صافي';
          if (code > 0 && code <= 3) condition = 'غائم جزئياً';
          if (code >= 45 && code <= 48) condition = 'ضبابي';
          if (code >= 51 && code <= 67) condition = 'ماطر';
          if (code >= 71 && code <= 77) condition = 'ثلجي';
          if (code >= 80 && code <= 82) condition = 'زخات مطر';
          if (code >= 95) condition = 'عاصف';

          setWeather({ temp, condition, code, wind, humidity });
        }
      } catch (e) {
        // Suppress error logging
      }
    };
    fetchWeather();
    const wTimer = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(wTimer);
  }, []);

  const todayStr = time.toISOString().split('T')[0];
  const liveStatus = useMemo(() => getLiveSchoolStatus(scheduleConfig), [scheduleConfig, time.getMinutes()]);
  const todayAbsences = absences.filter(a => a.date === todayStr);

  // --- DATA VIZ: ABSENCE TREND (Last 5 days) ---
  const absenceTrendData = useMemo(() => {
    const scopedEmployeeIds = scopedEmployees.map(e => e.id);
    const last5Days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (4 - i));
      return d.toISOString().split('T')[0];
    });

    return last5Days.map(date => {
      const count = absences.filter(a => a.date === date && scopedEmployeeIds.includes(a.teacherId)).length;
      return {
        name: new Date(date).toLocaleDateString('ar', { weekday: 'short' }),
        count: count,
        fullDate: date
      };
    });
  }, [absences, todayStr, scopedEmployees]);




  // --- DATA VIZ: DUTY DISTRIBUTION ---
  const dutyDistributionData = useMemo(() => {
    const full = scopedEmployees.filter(e => e.dutySettings?.fullDutyDay === DAYS_AR[time.getDay()]).length;
    const half = scopedEmployees.filter(e => e.dutySettings?.halfDutyDay === DAYS_AR[time.getDay()]).length;
    return [
      { name: 'كاملة', value: full, color: '#06b6d4' }, // Cyan
      { name: 'نصف', value: half, color: '#f59e0b' },   // Amber
      { name: 'لا يوجد', value: Math.max(0, scopedEmployees.length - full - half), color: '#e2e8f0' } // Slate
    ];
  }, [scopedEmployees, time]);


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

  const radius = 90;
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
    if (liveStatus.state === 'IN_BREAK') return 'text-amber-500';
    if (liveStatus.state === 'BEFORE_SCHOOL') return 'text-emerald-500';
    if (liveStatus.state === 'AFTER_SCHOOL') return 'text-slate-500';
    if (liveStatus.state === 'HOLIDAY') return 'text-rose-500';
    return 'text-indigo-600';
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

  // Set initial selected period to current period or keep at 1 when outside school hours
  useEffect(() => {
    if (liveStatus.currentPeriod) {
      setSelectedPeriod(liveStatus.currentPeriod);
    }
  }, [liveStatus.currentPeriod]);

  // Calculate available teachers for selected period
  const todayDayName = DAYS_AR[time.getDay()];
  const normalizedTodayDayName = normalizeArabic(todayDayName);

  const availableTeachers = useMemo(() => {
    const targetPeriod = selectedPeriod || liveStatus.currentPeriod || 1;

    // Get teachers who have ONLY stay/individual lessons (exclude actual/free)
    // USE SCOPED EMPLOYEES
    return scopedEmployees.filter(emp => {
      // Skip if absent today
      const isAbsent = absences.some(a => a.date === todayStr && a.teacherId === emp.id);
      if (isAbsent) return false;

      // Find lesson for this teacher at target period
      const lesson = lessons.find(l =>
        l.teacherId === emp.id &&
        l.period === targetPeriod &&
        normalizeArabic(l.day) === normalizedTodayDayName
      );

      // ONLY include stay or individual lessons (or free if logic permits - keeping original logic: stay/individual only from prior code context seems strict but we will stick to it or expand to FREE?
      // Original logic was: "Get teachers who have ONLY stay/individual lessons (exclude actual/free)" - wait, usually available means FREE too. 
      // Let's stick to the code I read: `return lessonType === 'stay' || lessonType === 'individual';` was in previous file. 
      // I should probably include FREE teachers too if "Available Now" implies substitutes. 
      // But let's replicate EXACT original logic first to be safe.
      if (!lesson) return false; // This excludes FREE teachers in original logic!

      const lessonType = lesson.type?.toLowerCase();
      return lessonType === 'stay' || lessonType === 'individual';
    }).map(emp => {
      const lesson = lessons.find(l =>
        l.teacherId === emp.id &&
        l.period === targetPeriod &&
        normalizeArabic(l.day) === normalizedTodayDayName
      );

      return {
        id: emp.id,
        name: emp.name,
        type: lesson?.type || 'individual',
        subject: lesson?.subject || null,
        classId: lesson?.classId || null
      };
    });
  }, [scopedEmployees, lessons, absences, selectedPeriod, liveStatus.currentPeriod, normalizedTodayDayName, todayStr]);

  // Get list of ALL periods (not just from current)
  const availablePeriods = useMemo(() => {
    const maxP = scheduleConfig.periodsPerDay;
    if (liveStatus.state === 'AFTER_SCHOOL' || liveStatus.state === 'HOLIDAY' || liveStatus.state === 'BEFORE_SCHOOL') {
      return Array.from({ length: maxP }, (_, i) => i + 1);
    }
    const currentP = liveStatus.currentPeriod || 1;
    return Array.from({ length: maxP - currentP + 1 }, (_, i) => currentP + i);
  }, [liveStatus.currentPeriod, liveStatus.state, scheduleConfig.periodsPerDay]);

  // Calculate ALL teachers with duty today (for admin view)
  const todayDutyTeachers = useMemo(() => {
    const nowMins = time.getHours() * 60 + time.getMinutes();

    const teachersWithDutyToday: any[] = [];

    employees.forEach(emp => {
      const fullDay = emp.dutySettings?.fullDutyDay;
      const halfDay = emp.dutySettings?.halfDutyDay;
      const normToday = normalizeArabic(DAYS_AR[time.getDay()]);

      if (fullDay && normalizeArabic(fullDay) === normToday) {
        // Active check logic
        let isActive = false;
        if (breakPeriods.length > 0) {
          for (const bp of breakPeriods) {
            if (bp.startTime && bp.endTime) {
              const [startH, startM] = bp.startTime.split(':').map(Number);
              const [endH, endM] = bp.endTime.split(':').map(Number);
              const startMins = startH * 60 + startM;
              const endMins = endH * 60 + endM;
              if (nowMins >= startMins && nowMins <= endMins) {
                isActive = true;
                break;
              }
            }
          }
        }
        teachersWithDutyToday.push({
          id: `full-${emp.id}`,
          teacherId: emp.id,
          teacherName: emp.name,
          dutyType: 'full',
          isActive
        });
      }

      if (halfDay && normalizeArabic(halfDay) === normToday) {
        let isActive = false;
        // Same active check
        if (breakPeriods.length > 0) {
          for (const bp of breakPeriods) {
            if (bp.startTime && bp.endTime) {
              const [startH, startM] = bp.startTime.split(':').map(Number);
              const [endH, endM] = bp.endTime.split(':').map(Number);
              const startMins = startH * 60 + startM;
              const endMins = endH * 60 + endM;
              if (nowMins >= startMins && nowMins <= endMins) {
                isActive = true;
                break;
              }
            }
          }
        }
        teachersWithDutyToday.push({
          id: `half-${emp.id}`,
          teacherId: emp.id,
          teacherName: emp.name,
          dutyType: 'half',
          isActive
        });
      }
    });

    return teachersWithDutyToday.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.teacherName.localeCompare(b.teacherName, 'ar');
    });
  }, [employees, breakPeriods, time]);


  // --- MY SCHEDULE LOGIC (Restored) ---
  const myTodayLessons = useMemo(() => {
    if (!currentUser) return [];
    return lessons.filter(l =>
      l.teacherId === currentUser.id &&
      normalizeArabic(l.day) === normalizedTodayDayName
    );
  }, [lessons, currentUser, normalizedTodayDayName]);

  const myTimeline = useMemo(() => {
    return timeline.map(slot => {
      if (slot.break) return { ...slot, hasLesson: false };
      const lesson = myTodayLessons.find(l => l.period === slot.period);
      const isCurrent = liveStatus.currentPeriod === slot.period && liveStatus.state === 'IN_PERIOD';
      return {
        ...slot,
        hasLesson: !!lesson,
        className: lesson?.className || null,
        subject: lesson?.subject || null,
        isCurrent
      };
    });
  }, [timeline, myTodayLessons, liveStatus]);


  // Navigation handlers
  const goToPreviousPeriod = () => {
    const currentIdx = availablePeriods.indexOf(selectedPeriod);
    if (currentIdx > 0) setSelectedPeriod(availablePeriods[currentIdx - 1]);
  };
  const goToNextPeriod = () => {
    const currentIdx = availablePeriods.indexOf(selectedPeriod);
    if (currentIdx < availablePeriods.length - 1) setSelectedPeriod(availablePeriods[currentIdx + 1]);
  };

  return (
    <div className="w-full min-h-full p-4 md:p-6 lg:p-8 animate-fade-in font-sans pb-32" dir="rtl">

      {/* ... HEADER (Unchanged) ... */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              {time.getHours() < 12 ? 'صباح الخير' : 'مساء الخير'}، {currentUser?.name?.split(' ')[0] || 'أستاذ'}
            </span>
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-slate-500 font-bold mt-1 text-sm flex items-center gap-2 max-w-lg">
            {scheduleConfig.schoolInfo?.name ? `نظام ${scheduleConfig.schoolInfo.name} الذكي` : 'لوحة التحكم المركزية'}
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span className="text-slate-400">{DAYS_AR[time.getDay()]}، {time.toLocaleDateString('ar-EG')}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Weather Widget (Glass) */}
          <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md border border-white/40 shadow-xl shadow-indigo-100/50 px-5 py-3 rounded-[2rem] hover:scale-105 transition-transform cursor-default group">
            <div className="bg-gradient-to-br from-blue-400 to-indigo-500 p-2.5 rounded-full text-white shadow-lg group-hover:rotate-12 transition-transform">
              <WeatherIcon size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-slate-700 leading-none">{weather.temp}°</span>
              <span className="text-[10px] font-bold text-slate-400 mt-0.5">{weather.condition}</span>
            </div>
            <div className="w-px h-8 bg-slate-200 mx-1"></div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                <Wind size={10} className="text-slate-400" /> {weather.wind} km/h
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                <Droplets size={10} className="text-blue-400" /> {weather.humidity}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD GRID (BENTO) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

        {/* LEFT COL: STATS & ACTIONS & DUTY LIST (3 COLS) */}
        <div className="lg:col-span-3 flex flex-col gap-6 order-2 lg:order-1">

          {/* 1. Absence Card with Chart */}
          <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group hover:shadow-lg transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">الغياب اليومي</span>
                <span className="text-4xl font-black text-slate-800 tracking-tight">{todayAbsences.length}</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-2xl text-rose-500 border border-rose-100">
                <UserX size={20} strokeWidth={2.5} />
              </div>
            </div>
            {/* Mini Trend Chart */}
            <div className="h-16 w-full -mb-3 -ml-3">
              <ResponsiveContainer width="110%" height="100%">
                <AreaChart data={absenceTrendData}>
                  <defs>
                    <linearGradient id="colorAbsence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="count" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorAbsence)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-[10px] font-bold text-slate-400 flex items-center justify-between">
              <span>متوسط الأسبوع: {Math.round(absenceTrendData.reduce((a, b) => a + b.count, 0) / 5)}</span>
              {todayAbsences.length > absenceTrendData[3].count ? (
                <span className="text-rose-500 flex items-center gap-1"><ArrowUpRight size={10} /> مرتفع</span>
              ) : (
                <span className="text-emerald-500 flex items-center gap-1"><ArrowDownRight size={10} /> منخفض</span>
              )}
            </div>
          </div>

          {/* 2. Quick Actions */}
          <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Zap size={14} className="text-amber-500" /> إجراءات سريعة
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => onNavigateToView('calendar')} className="p-4 bg-indigo-50 hover:bg-indigo-100 rounded-2xl flex flex-col items-center gap-2 transition-colors border border-indigo-100 group">
                <CalendarRange size={20} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-indigo-900">الفعاليات</span>
              </button>
              {isAdmin && (
                <button onClick={() => onNavigateToView('substitutions')} className="p-4 bg-rose-50 hover:bg-rose-100 rounded-2xl flex flex-col items-center gap-2 transition-colors border border-rose-100 group">
                  <UserX size={20} className="text-rose-600 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-rose-900">الغيابات</span>
                </button>
              )}
              <button onClick={() => onNavigateToSchedule('teacher', 0)} className="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-2xl flex flex-col items-center gap-2 transition-colors border border-emerald-100 group">
                <LayoutList size={20} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-emerald-900">الحصص</span>
              </button>
              <button onClick={() => onNavigateToView('bulletin-board')} className="p-4 bg-amber-50 hover:bg-amber-100 rounded-2xl flex flex-col items-center gap-2 transition-colors border border-amber-100 group">
                <LayoutList size={20} className="text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-amber-900">اللوحة</span>
              </button>
            </div>
          </div>

          {/* 3. Duty Management (RESTORED LIST) */}
          {isAdmin ? (
            <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(34,211,238,0.08)] border border-cyan-100/50 h-[300px] flex flex-col mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-cyan-500 uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14} /> مناوبو اليوم
                </h3>
                <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-lg text-[10px] font-black">{todayDutyTeachers.length}</span>
              </div>

              {/* Chart Mini */}
              <div className="h-20 w-20 mx-auto mb-4 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dutyDistributionData} innerRadius={25} outerRadius={35} paddingAngle={2} dataKey="value">
                      {dutyDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Shield size={16} className="text-slate-300" />
                </div>
              </div>

              {/* List (Scrollable) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                {todayDutyTeachers.length > 0 ? todayDutyTeachers.map((duty, idx) => (
                  <div key={idx} className={`p-2 rounded-xl flex items-center gap-2 transition-all ${duty.isActive ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 text-white shadow-md' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${duty.isActive ? 'bg-white animate-pulse' : duty.dutyType === 'full' ? 'bg-cyan-500' : 'bg-amber-500'}`}></div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-black truncate ${duty.isActive ? 'text-white' : 'text-slate-700'}`}>{duty.teacherName}</p>
                      <span className={`text-[8px] font-bold ${duty.isActive ? 'text-white/80' : 'text-slate-400'}`}>
                        {duty.dutyType === 'full' ? 'مناوبة كاملة' : 'نصف مناوبة'}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-4 text-slate-400">
                    <Shield size={16} className="mx-auto mb-1 opacity-50" />
                    <span className="text-[9px] font-bold">لا مناوبات اليوم</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* 4. STAFF MEETINGS CARD (NEW) */}
          <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(251,191,36,0.08)] border border-amber-100 min-h-[150px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black text-amber-500 uppercase tracking-wider flex items-center gap-2">
                <Users size={14} /> اجتماعات الطواقم
              </h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">الأسبوع الحالي</span>
            </div>
            <div className="flex-1 relative z-10">
              {/* Reuse extracting logic inline or via hook ideally, but for now reproducing safely */}
              {(() => {
                const uniqueMeetings = new Map();
                // Extract from lessons
                lessons.forEach(l => {
                  const subj = l.subject.trim();
                  const normSubj = normalizeArabic(subj);
                  const words = normSubj.split(/\s+/);
                  const isMeeting = normSubj.includes('طاقم') || words.includes('اجتماع') || words.includes('إجتماع') || subj.includes('طاقم');

                  if (isMeeting) {
                    const key = `${subj}-${l.day}-${l.period}`;
                    if (!uniqueMeetings.has(key)) {
                      uniqueMeetings.set(key, { title: subj, day: l.day, period: l.period });
                    }
                  }
                });
                // Extract from config
                if ((scheduleConfig.structure as any)?.meetings) {
                  (scheduleConfig.structure as any).meetings.forEach((m: any) => {
                    const key = `${m.name}-${m.day}-${m.period}`;
                    if (!uniqueMeetings.has(key)) {
                      uniqueMeetings.set(key, { title: m.name, day: m.day, period: m.period });
                    }
                  });
                }
                const meetings = Array.from(uniqueMeetings.values()).sort((a, b) => {
                  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
                  const da = days.indexOf(a.day.split(' ')[0]) || 0;
                  const db = days.indexOf(b.day.split(' ')[0]) || 0;
                  return da - db || a.period - b.period;
                });

                return meetings.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 content-start">
                    {meetings.map((m: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 bg-amber-50 p-2 rounded-xl border border-amber-200 hover:border-amber-400 transition-colors">
                        <div className="flex flex-col items-center bg-white border border-amber-200 rounded-lg p-1 min-w-[35px]">
                          <span className="text-[8px] font-bold text-amber-600">{m.day.split(' ')[0]}</span>
                          <span className="text-[10px] font-black text-slate-800">{m.period}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 leading-tight truncate flex-1" title={m.title}>
                          {m.title}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full py-8 flex flex-col items-center justify-center text-slate-400 gap-1 opacity-60">
                    <CalendarDays size={20} />
                    <span className="text-[9px] font-bold italic">لا اجتماعات هذا الأسبوع</span>
                  </div>
                );
              })()}
            </div>
          </div>

        </div>

        {/* CENTER COL: THE REACTOR CORE (6 COLS) */}
        <div className="lg:col-span-6 md:col-span-2 order-1 lg:order-2 flex flex-col gap-6">
          <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-[3rem] p-1 relative overflow-hidden shadow-2xl min-h-[500px] flex flex-col items-center justify-center text-center group flex-1">

            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-[3rem]">
              <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[-100px] right-[-100px] w-[300px] h-[300px] bg-rose-500/10 rounded-full blur-[100px]"></div>
              {/* Grid Pattern */}
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center w-full max-w-md mx-auto py-10">

              {/* School Badge */}
              <div className="mb-6 bg-slate-800/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700/50 flex items-center gap-2 mt-400">
                <div className={`w-2 h-2 rounded-full ${liveStatus.state === 'IN_PERIOD' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                <span className="text-[10px] font-black tracking-widest text-slate-300 uppercase">
                  {liveStatus.state === 'IN_PERIOD' ? 'SYSTEM ONLINE' : 'STANDBY MODE'}
                </span>
              </div>

              {/* MAIN CLOCK */}
              <div className="relative mb-8">
                {/* SVG Progress Ring */}
                <svg className="w-[280px] h-[280px] md:w-[320px] md:h-[320px] transform -rotate-90" viewBox="0 0 240 240">
                  {/* Track */}
                  <circle cx="120" cy="120" r={radius} stroke="#334155" strokeWidth="8" fill="none" className="opacity-30" />
                  {/* Progress */}
                  <circle
                    cx="120" cy="120" r={radius}
                    stroke={getRingColor()}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                  />
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-sm font-black uppercase tracking-widest mb-2 ${getStatusColor()}`}>{getTimerLabel()}</span>
                  {liveStatus.state === 'AFTER_SCHOOL' || liveStatus.state === 'HOLIDAY' ? (
                    <span className="text-5xl font-black text-slate-600 tracking-tighter">OFFLINE</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-8xl font-black text-white tracking-tighter tabular-nums leading-none">
                        {liveStatus.minsRemainingInSlot}
                      </span>
                      <span className="text-xl font-bold text-slate-500">دقيقة</span>
                    </div>
                  )}
                  <div className="mt-4 px-4 py-1.5 bg-slate-800 rounded-xl border border-slate-700 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">
                      {liveStatus.state === 'IN_PERIOD' ? `الحصة الدراسية ${liveStatus.currentPeriod}` :
                        liveStatus.state === 'IN_BREAK' ? 'وقت الاستراحة' :
                          'خارج الدوام'}
                    </span>
                  </div>
                </div>

                {/* Orbiting Satellite (Animation) */}
                <div className="absolute top-1/2 left-1/2 w-[340px] h-[340px] border border-slate-700/30 rounded-full -translate-x-1/2 -translate-y-1/2 animate-spin-slow pointer-events-none">
                  <div className="absolute top-0 left-1/2 w-3 h-3 bg-indigo-500 rounded-full -translate-x-1/2 -translate-y-1.5 shadow-[0_0_10px_rgba(99,102,241,1)]"></div>
                </div>
              </div>

              {/* Digital Time Bottom */}
              <div className="text-center">
                <h2 className="text-4xl font-black text-white/10 tracking-widest scale-y-150 opacity-20 select-none">
                  {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </h2>
              </div>

            </div>

            {/* Timeline Strip (Restored Detailed Strip) */}
            <div className="absolute bottom-6 left-6 right-6 h-2 bg-slate-800 rounded-full flex items-center gap-1 p-0.5 overflow-hidden">
              {timeline.map((slot, idx) => {
                const isActive = slot.period === liveStatus.currentPeriod;
                const isPast = slot.period < (liveStatus.currentPeriod || 0) || (liveStatus.state === 'AFTER_SCHOOL');
                const isBreak = !!slot.break;

                return (
                  <div
                    key={idx}
                    className={`h-full rounded-full transition-all relative group ${isActive ? isBreak ? 'bg-amber-500 shadow-[0_0_10px_orange]' : 'bg-indigo-500 shadow-[0_0_10px_indigo]' :
                      isPast ? 'bg-slate-600' :
                        isBreak ? 'bg-slate-700/50' : 'bg-slate-700'
                      }`}
                    style={{
                      flex: isBreak ? '0.5 1 0%' : '1 1 0%'
                    }}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-[8px] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {isBreak ? 'استراحة' : `حصة ${slot.period}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MY SCHEDULE ROW (Restored) */}
          {myTimeline.length > 0 && (
            <div className="bg-white rounded-[2rem] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <LayoutList size={14} className="text-indigo-500" /> جدول حصصي اليوم
              </h3>
              <div className="flex flex-wrap gap-2 justify-center pb-2">
                {myTimeline.map((slot, idx) => (
                  slot.break ? (
                    <div key={idx} className="basis-[12%] min-w-[60px] flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-100 opacity-60">
                      <Coffee size={14} className="text-slate-400 mb-1" />
                      <span className="text-[8px] font-bold text-slate-400">استراحة</span>
                    </div>
                  ) : (
                    <div key={idx} className={`basis-[18%] min-w-[100px] flex-grow p-3 rounded-xl border flex flex-col gap-1 transition-all ${slot.isCurrent ? 'bg-indigo-500 text-white shadow-lg scale-105 border-indigo-400' :
                      slot.hasLesson ? 'bg-indigo-50 border-indigo-100' :
                        'bg-white border-slate-100 opacity-50'
                      }`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-[8px] font-black uppercase ${slot.isCurrent ? 'text-indigo-200' : 'text-slate-400'}`}>حصة {slot.period}</span>
                        {slot.isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
                      </div>
                      {slot.hasLesson ? (
                        <>
                          <span className={`text-xs font-black ${slot.isCurrent ? 'text-white' : 'text-slate-800'}`}>{slot.className}</span>
                          <span className={`text-[9px] truncate ${slot.isCurrent ? 'text-indigo-100' : 'text-slate-500'}`}>{slot.subject}</span>
                        </>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-300 mt-2">فراغ</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COL: FEED & ALERTS (3 COLS) */}
        <div className="lg:col-span-3 flex flex-col gap-6 order-3">

          {/* 1. Upcoming Events */}
          <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 h-1/2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">الجدول القادم</h3>
              <button onClick={() => onNavigateToView('calendar')} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700">عرض الكل</button>
            </div>
            <div className="space-y-3 relative before:absolute before:right-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {upcomingEvents.length > 0 ? upcomingEvents.map((evt, idx) => (
                <div key={idx} className="relative pr-8">
                  <div className={`absolute right-[11px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${evt.eventType === 'EXAM' ? 'bg-rose-500' :
                    evt.eventType === 'TRIP' ? 'bg-emerald-500' : 'bg-indigo-500'
                    } z-10 box-content shadow-sm`}></div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors group cursor-pointer">
                    <h4 className="text-xs font-black text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors">{evt.title}</h4>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(evt.date).toLocaleDateString('ar')}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${evt.eventType === 'EXAM' ? 'bg-rose-100 text-rose-600' :
                        evt.eventType === 'TRIP' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
                        }`}>{evt.eventType}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-slate-300">
                  <CalendarRange size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">لا توجد أحداث قريبة</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Available Now / Duty Info */}
          <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex-1 flex flex-col">
            {isAdmin ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Users size={14} className="text-emerald-500" /> متاحون الآن
                  </h3>
                  {/* Period Navigation */}
                  <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                    <button onClick={goToPreviousPeriod} disabled={availablePeriods.indexOf(selectedPeriod) === 0} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 transition-all"><ChevronRight size={10} /></button>
                    <span className="text-[9px] font-black w-8 text-center">{selectedPeriod}</span>
                    <button onClick={goToNextPeriod} disabled={availablePeriods.indexOf(selectedPeriod) === availablePeriods.length - 1} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 transition-all"><ChevronLeft size={10} /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar -mr-2 pr-2">
                  {liveStatus.state === 'HOLIDAY' ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <Coffee size={24} className="mb-2 opacity-50 text-rose-400" />
                      <p className="text-xs font-bold text-rose-400">عطلة رسمية</p>
                    </div>
                  ) : liveStatus.state === 'WEEKEND' ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <Coffee size={24} className="mb-2 opacity-50 text-indigo-400" />
                      <p className="text-xs font-bold text-indigo-400">عطلة نهاية الأسبوع</p>
                    </div>
                  ) : (liveStatus.state === 'AFTER_SCHOOL' || liveStatus.state === 'BEFORE_SCHOOL') && !selectedPeriod ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <Moon size={24} className="mb-2 opacity-50" />
                      <p className="text-xs font-bold">خارج أوقات الدوام</p>
                    </div>
                  ) : availableTeachers.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {availableTeachers.map((t, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-default border border-transparent hover:border-slate-100">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500">
                            {t.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{t.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${t.type === 'stay' ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
                              <span className="text-[9px] text-slate-400">{t.type === 'stay' ? 'مكوث' : 'فردي'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <UserX size={24} className="mb-2 opacity-50" />
                      <p className="text-xs font-bold">الجميع مشغول</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Teacher View: My Duties (Keep simpler)
              <>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield size={14} className="text-orange-500" /> مناوباتي
                </h3>
                {/* Reuse logic for user duties here or just a nice empty state if none */}
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <CheckCircle2 size={24} className="mb-2 opacity-50 text-emerald-400" />
                  <p className="text-xs font-bold">لا مناوبات اليوم</p>
                </div>
              </>
            )}
          </div>

        </div>

      </div>

      {/* --- FLOATING NOTIFICATIONS (BOTTOM RIGHT) --- */}
      <div className="fixed bottom-6 right-6 z-50">
        <NotificationBell alerts={systemAlerts} variant="glass" />
      </div>

    </div>
  );
});

export default LiveChronometer;
