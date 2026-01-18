
import React, { useState, useMemo } from 'react';
import { 
  BarChart3, ShieldAlert, TrendingUp, Brain, Siren, Flame, Zap, 
  Activity, AlertTriangle, Scale, Target, Play, RotateCcw, ShieldCheck,
  FileText, Check, XCircle, AlertOctagon, Filter, Calendar as CalendarIcon,
  Download, ChevronDown, ChevronUp, Printer, FileSpreadsheet, ListFilter,
  CheckCircle2, AlertCircle, LayoutGrid, Network, UserX, Cpu, BarChart, ListTodo, CalendarDays, Plus, Users,
  CloudRain, Bus, Wallet, Coins, ClipboardList, FileCheck, X
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, BarChart as ReBarChart, Bar, Cell
} from 'recharts';
import { 
  Employee, AbsenceRecord, SubstitutionLog, ScheduleConfig, 
  ClassItem, Lesson, EventComment, SimulationResult,
  CalendarEvent, DayPattern, AcademicYear, EngineContext, CalendarTask, SystemAlert, ModeConfig
} from '../types';
import { runAnnualSimulation, downloadCSV, toLocalISOString } from '../utils';
import { DAYS_AR } from '../constants';

interface ReportsProps {
  employees: Employee[];
  absences: AbsenceRecord[];
  substitutionLogs: SubstitutionLog[];
  scheduleConfig: ScheduleConfig;
  classes: ClassItem[];
  lessons: Lesson[];
  comments: EventComment[];
  events: CalendarEvent[];
  patterns: DayPattern[];
  academicYear: AcademicYear;
  // Props added for Command Center (formerly Dashboard widgets)
  engineContext: EngineContext;
  setEngineContext: React.Dispatch<React.SetStateAction<EngineContext>>;
  onToggleMode: (modeId: string) => void;
  systemAlerts: SystemAlert[];
  tasks: CalendarTask[];
  onNavigateToView?: (view: any) => void;
  onNavigateToSettings?: () => void;
}

const Reports: React.FC<ReportsProps> = ({ 
  employees, absences, substitutionLogs, scheduleConfig, classes, lessons, comments, events, patterns, academicYear,
  engineContext, setEngineContext, onToggleMode, systemAlerts, tasks, onNavigateToView, onNavigateToSettings
}) => {
  const [activeTab, setActiveTab] = useState<string>('command_center');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Operational Report State - FIX: Use toLocalISOString
  const [dateRange, setDateRange] = useState({ 
      start: toLocalISOString(new Date()), 
      end: toLocalISOString(new Date()) 
  });
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true, compliance: true, impact: true, fairness: true, logs: true, payroll: true, audit: true
  });

  // --- STATS LOGIC (Migrated from Dashboard) ---
  const stats = useMemo(() => {
    const todayStr = toLocalISOString(new Date());
    const dayOfWeek = DAYS_AR[new Date().getDay()];
    const todayAbsences = absences.filter(a => a.date === todayStr);

    const totalTeachers = employees.filter(e => !e.constraints.isExternal).length;
    const absentCount = todayAbsences.length;
    const presentCount = totalTeachers - absentCount;
    const coverageRate = totalTeachers > 0 ? Math.round((presentCount / totalTeachers) * 100) : 0;
    
    const activeExternals = new Set(substitutionLogs.filter(s => s.date === todayStr && s.type === 'assign_external').map(s => s.substituteTeacherId)).size;

    let uncoveredCount = 0;
    todayAbsences.forEach(abs => {
        const affected = lessons.filter(l => 
            l.teacherId === abs.teacherId && 
            l.day === dayOfWeek && 
            (abs.type === 'FULL' || abs.affectedPeriods.includes(l.period))
        );
        affected.forEach(l => {
            const hasSub = substitutionLogs.some(log => log.date === todayStr && log.period === l.period && log.absentTeacherId === abs.teacherId);
            if (!hasSub) uncoveredCount++;
        });
    });
    
    return { totalTeachers, absentCount, presentCount, coverageRate, uncoveredCount, activeExternals };
  }, [employees, absences, lessons, substitutionLogs]);

  // AI Insight Generator (Mock)
  const aiInsight = useMemo(() => {
    const tips = [
      "معدل الغياب اليوم منخفض، فرصة جيدة لعقد اجتماعات الفرق.",
      "تم رصد ضغط عالٍ على معلمي الرياضيات، يوصى بتخفيف المناوبة.",
      "تنبؤ: قد تزداد الغيابات غداً بسبب الحالة الجوية المتوقعة.",
      "كفاءة الجدول اليوم: 98%. ممتاز!",
      "هناك 3 معلمين بدلاء متاحين للحصة القادمة."
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }, []);

  const protocolModes = [
    { id: 'rainyMode', label: 'ماطر', icon: CloudRain },
    { id: 'tripMode', label: 'رحلة', icon: Bus },
    { id: 'examMode', label: 'امتحان', icon: FileText },
    { id: 'emergencyMode', label: 'طوارئ', icon: Siren },
  ];

  const KpiCard = ({ title, value, subtext, icon: Icon, colorClass, trend }: any) => (
    <div className="bg-white p-5 rounded-[2rem] shadow-lg border border-slate-100 flex flex-col justify-between h-full group hover:shadow-xl transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-5 rounded-bl-[4rem] -mr-4 -mt-4 transition-transform group-hover:scale-110 text-slate-900"></div>
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 text-current shadow-sm`}>
          <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
        </div>
        {trend && (
          <span className="text-[9px] font-black bg-slate-5 px-2 py-1 rounded-full text-slate-400 flex items-center gap-1 border border-slate-100">
            <TrendingUp size={10} /> {trend}
          </span>
        )}
      </div>
      <div className="mt-4 relative z-10">
        <h4 className="text-3xl font-black text-slate-800 tracking-tighter tabular-nums">{value}</h4>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{title}</p>
        {subtext && <p className="text-[9px] font-medium text-slate-400 mt-1 opacity-80">{subtext}</p>}
      </div>
    </div>
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStartSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const result = runAnnualSimulation(employees, lessons, classes, scheduleConfig);
      setSimulationResult(result);
      setIsSimulating(false);
    }, 1500);
  };

  // --- OPERATIONAL REPORT LOGIC ---
  const operationalData = useMemo(() => {
    const filteredLogs = substitutionLogs.filter(l => l.date >= dateRange.start && l.date <= dateRange.end);
    const filteredAbsences = absences.filter(a => a.date >= dateRange.start && a.date <= dateRange.end);
    
    // Metrics
    const totalCoverage = filteredLogs.length;
    const totalAbsences = filteredAbsences.length;
    const uniqueAbsentTeachers = new Set(filteredAbsences.map(a => a.teacherId)).size;
    
    // --- 1. Payroll Data (External) ---
    const payrollMap = new Map<number, { name: string; hours: number; days: Set<string> }>();
    
    filteredLogs.filter(l => l.type === 'assign_external').forEach(l => {
        if (!payrollMap.has(l.substituteTeacherId)) {
            payrollMap.set(l.substituteTeacherId, { 
                name: l.substituteName, 
                hours: 0, 
                days: new Set() 
            });
        }
        const entry = payrollMap.get(l.substituteTeacherId)!;
        entry.hours++;
        entry.days.add(l.date);
    });

    const payrollList = Array.from(payrollMap.values())
        .map(p => ({ ...p, daysCount: p.days.size }))
        .sort((a, b) => b.hours - a.hours);

    // --- 2. Compliance Audit Data ---
    const complianceList = filteredAbsences.map(a => {
        const teacher = employees.find(e => e.id === a.teacherId);
        const reasonLower = (a.reason || "").toLowerCase();
        
        let status: 'DELIVERED' | 'PENDING' = 'PENDING';
        if (a.isJustified) status = 'DELIVERED';
        else if (reasonLower.includes('تقرير') || reasonLower.includes('√') || reasonLower.includes('تم')) status = 'DELIVERED';
        else if (reasonLower.includes('×') || reasonLower.includes('لم') || !reasonLower) status = 'PENDING';

        return {
            id: a.id,
            teacherName: teacher?.name || 'غير معروف',
            date: a.date,
            reason: a.reason,
            status
        };
    }).sort((a, b) => (a.status === 'PENDING' ? -1 : 1)); // Show pending first

    // --- 3. Detailed Daily Report (Aggregation) ---
    const detailedReport = filteredAbsences.map(a => {
        const teacher = employees.find(e => e.id === a.teacherId);
        
        // Find substitutions for this specific absence
        const subs = filteredLogs.filter(l => l.date === a.date && l.absentTeacherId === a.teacherId);
        
        // Aggregate per substitute
        const subCounts: Record<string, number> = {};
        let hasExternal = false;

        subs.forEach(s => {
            const name = s.substituteName.split(' ').slice(0, 2).join(' '); // Short Name
            subCounts[name] = (subCounts[name] || 0) + 1;
            if (s.type === 'assign_external') hasExternal = true;
        });

        const substitutesString = Object.entries(subCounts)
            .map(([name, count]) => `${name} (${count})`)
            .join(' + ');

        return {
            id: a.id,
            date: a.date,
            absentName: teacher?.name || 'Unknown',
            type: a.type === 'FULL' ? 'يوم كامل' : 'جزئي',
            reason: a.reason || '-',
            substitutesString: substitutesString || 'لم يتم تأمين بديل',
            affectedCount: a.affectedPeriods.length,
            hasExternal,
            isFullyCovered: subs.length >= a.affectedPeriods.length
        };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Existing Logic...
    const teacherLoad: Record<number, number> = {};
    filteredLogs.forEach(l => {
      teacherLoad[l.substituteTeacherId] = (teacherLoad[l.substituteTeacherId] || 0) + 1;
    });
    const loads = Object.values(teacherLoad);
    const maxLoad = Math.max(...loads, 0);
    const fairnessStatus = maxLoad > 5 ? 'Warning' : maxLoad > 8 ? 'Critical' : 'Normal';

    return {
      filteredLogs,
      metrics: { totalCoverage, totalAbsences, uniqueAbsentTeachers, fairnessStatus, maxLoad },
      teacherLoad,
      payrollList,
      complianceList,
      detailedReport
    };
  }, [substitutionLogs, absences, dateRange, employees]);

  const exportDetailedReport = () => {
      const headers = ['التاريخ', 'المعلم الغائب', 'نوع الغياب', 'المبرر', 'المعلم البديل (عدد الحصص)', 'ملاحظات'];
      const rows = operationalData.detailedReport.map(r => ({
          date: r.date,
          absent: r.absentName,
          type: r.type,
          reason: r.reason,
          subs: r.substitutesString,
          notes: r.hasExternal ? 'تم استخدام بديل خارجي' : ''
      }));
      downloadCSV(rows, headers, `Detailed_Report_${dateRange.start}_${dateRange.end}.csv`);
  };

  // --- RENDERERS ---

  const renderCommandCenter = () => {
    const todayStr = toLocalISOString(new Date());
    const dayEvents = events.filter(e => e.date >= todayStr).slice(0, 3);

    return (
      <div className="space-y-6 animate-fade-in pb-10">
         {/* 1. KPIs Section */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard title="الطاقم الحاضر" value={stats.presentCount} subtext={`من ${stats.totalTeachers}`} icon={Users} colorClass="bg-indigo-500 text-white" />
            <KpiCard title="الغياب" value={stats.absentCount} subtext="معلمون اليوم" icon={UserX} colorClass="bg-rose-500 text-white" trend={stats.absentCount > 5 ? 'High' : undefined}/>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-[2rem] shadow-lg text-white flex flex-col justify-between relative overflow-hidden col-span-2 sm:col-span-1">
               <div className="flex justify-between items-start relative z-10">
                  <div className="p-2 bg-white/20 rounded-xl"><Activity size={18} /></div>
                  <span className="bg-white/10 px-2 py-0.5 rounded text-[8px] font-black">Health</span>
               </div>
               <div className="relative z-10 mt-4">
                 <h4 className="text-3xl font-black tracking-tighter">{stats.coverageRate}%</h4>
                 <p className="text-[9px] font-bold opacity-80 uppercase tracking-widest mt-1">نسبة التغطية</p>
               </div>
               <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            </div>
            <KpiCard title="خارجي" value={stats.activeExternals} subtext="نشط" icon={Network} colorClass="bg-amber-500 text-white" />
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 2. Protocol Engine */}
            <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Cpu size={18}/></div>
                   <div><h3 className="font-black text-sm text-slate-800">وحدة الأنماط</h3><p className="text-[9px] font-bold text-slate-400">Protocols</p></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {protocolModes.map(mode => {
                      const isActive = engineContext?.[mode.id]?.isActive;
                      return (
                         <button key={mode.id} onClick={() => onToggleMode(mode.id)} className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center relative overflow-hidden ${isActive ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-100'}`}>
                            <mode.icon size={20} className={isActive ? 'text-white' : ''} />
                            <span className="font-black text-[10px]">{mode.label}</span>
                         </button>
                      );
                   })}
                </div>
            </div>

            {/* 3. Alerts */}
            <div className="lg:col-span-4">
               {stats.uncoveredCount > 0 ? (
                  <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem] flex flex-col items-start gap-4 h-full shadow-inner animate-pulse">
                      <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><Siren size={24} /></div>
                      <div><h3 className="text-lg font-black text-rose-800">تنبيه حرج</h3><p className="text-xs font-bold text-rose-600 mt-1">{stats.uncoveredCount} حصص مكشوفة!</p></div>
                      {onNavigateToView && <button onClick={() => onNavigateToView('substitutions')} className="w-full py-3 bg-white text-rose-600 rounded-xl font-black text-[10px] shadow-sm mt-auto">معالجة فورية</button>}
                  </div>
               ) : (
                  <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] flex flex-col items-start gap-4 h-full shadow-inner">
                      <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><CheckCircle2 size={24} /></div>
                      <div><h3 className="text-lg font-black text-emerald-800">النظام آمن</h3><p className="text-xs font-bold text-emerald-600 mt-1">لا توجد ثغرات حالياً</p></div>
                  </div>
               )}
            </div>

            {/* 4. Chart */}
            <div className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between mb-4"><h3 className="font-black text-sm text-slate-800">الضغط الأسبوعي</h3><BarChart size={16} className="text-slate-400" /></div>
                <div className="flex-1 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[{ name: 'S', v: 40 }, { name: 'M', v: 65 }, { name: 'T', v: 45 }, { name: 'W', v: 90 }, { name: 'T', v: 55 }]}>
                         <defs><linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                         <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: '10px'}} />
                         <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#chartGradient)" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
            </div>

            {/* 5. Agenda */}
            <div className="lg:col-span-3 bg-white p-6 rounded-[2.5rem] shadow-lg border border-slate-100 flex flex-col h-full">
               <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2"><CalendarDays size={16} className="text-violet-500"/><h3 className="font-black text-sm text-slate-800">الأجندة</h3></div>
                  {onNavigateToView && <button onClick={() => onNavigateToView('calendar')} className="text-[9px] font-bold text-slate-400 hover:text-indigo-600">الكل</button>}
               </div>
               <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                  {dayEvents.length > 0 ? dayEvents.map(e => (
                     <div key={e.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="bg-white p-2 rounded-lg text-xs font-black text-slate-600 shadow-sm text-center min-w-[40px]">
                           <span className="block text-[8px] text-slate-400 uppercase">{new Date(e.date).toLocaleDateString('en-US', {weekday: 'short'})}</span>
                           {new Date(e.date).getDate()}
                        </div>
                        <div className="min-w-0">
                           <p className="text-xs font-black text-slate-800 truncate">{e.title}</p>
                           <p className="text-[9px] text-slate-400 truncate">{e.eventType}</p>
                        </div>
                     </div>
                  )) : <div className="text-center text-slate-300 text-xs py-8 font-bold italic">لا فعاليات</div>}
               </div>
            </div>

            {/* 6. Tasks */}
            <div className="lg:col-span-3 bg-white p-6 rounded-[2.5rem] shadow-lg border border-slate-100 flex flex-col h-full">
               <div className="flex items-center gap-2 mb-4"><ListTodo size={16} className="text-emerald-500"/><h3 className="font-black text-sm text-slate-800">المهام</h3></div>
               <div className="space-y-2 flex-1">
                  {[1,2].map(i => (
                     <div key={i} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
                        <div className="w-4 h-4 rounded border-2 border-slate-300 group-hover:border-emerald-500 transition-colors"></div>
                        <span className="text-[10px] font-bold text-slate-500 line-through decoration-transparent group-hover:text-slate-700 transition-colors">مراجعة الغياب</span>
                     </div>
                  ))}
                  <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold mt-2 pt-2 border-t border-slate-50 cursor-pointer hover:text-indigo-600">
                     <Plus size={12}/> إضافة
                  </div>
               </div>
            </div>

            {/* 7. AI Insight */}
            <div className="lg:col-span-12 bg-gradient-to-br from-violet-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-lg text-white relative overflow-hidden flex flex-col justify-center">
               <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[4rem] pointer-events-none"></div>
               <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3 bg-black/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                     <Brain size={12} className="text-pink-300" />
                     <span className="text-[9px] font-black uppercase tracking-widest">AI Insight</span>
                  </div>
                  <p className="text-xs font-bold leading-relaxed opacity-90">{aiInsight}</p>
               </div>
            </div>
         </div>
      </div>
    );
  };

  const renderOperationalReport = () => {
    const { metrics, payrollList, complianceList, detailedReport } = operationalData;

    return (
      <div className="space-y-8 animate-fade-in pb-10">
        {/* Report Controls */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 text-white rounded-2xl"><Filter size={20}/></div>
              <div>
                 <h4 className="font-black text-slate-800 text-sm">نطاق التقرير</h4>
                 <div className="flex items-center gap-2 mt-1">
                    <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-[10px] font-bold outline-none" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                    <span className="text-slate-400 font-bold">-</span>
                    <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-[10px] font-bold outline-none" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                 </div>
              </div>
           </div>
           <div className="flex gap-3">
              <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all">
                 <Printer size={16} /> طباعة
              </button>
              <button onClick={exportDetailedReport} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                 <FileSpreadsheet size={16} /> تصدير Excel
              </button>
           </div>
        </div>

        {/* 1. Executive Summary */}
        <section className="space-y-4">
           <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('summary')}>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-3"><Activity className="text-indigo-600"/> الملخص التنفيذي</h3>
              {expandedSections.summary ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
           </div>
           
           {expandedSections.summary && (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-down">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <span className="text-[10px] font-black text-slate-400 uppercase">إجمالي قرارات التغطية</span>
                   <div className="flex items-end gap-3 mt-2">
                      <span className="text-3xl font-black text-slate-900">{metrics.totalCoverage}</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">قرار منفذ</span>
                   </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <span className="text-[10px] font-black text-slate-400 uppercase">حالات الغياب</span>
                   <div className="flex items-end gap-3 mt-2">
                      <span className="text-3xl font-black text-slate-900">{metrics.totalAbsences}</span>
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg">{metrics.uniqueAbsentTeachers} معلم</span>
                   </div>
                </div>
                <div className={`p-6 rounded-[2rem] border shadow-sm text-white ${metrics.fairnessStatus === 'Normal' ? 'bg-emerald-600 border-emerald-500' : metrics.fairnessStatus === 'Warning' ? 'bg-amber-500 border-amber-400' : 'bg-rose-600 border-rose-500'}`}>
                   <span className="text-[10px] font-black opacity-80 uppercase">مؤشر العدالة</span>
                   <div className="flex items-end gap-3 mt-2">
                      <span className="text-xl font-black">{metrics.fairnessStatus === 'Normal' ? 'متوازن' : metrics.fairnessStatus === 'Warning' ? 'اختلال جزئي' : 'حرج'}</span>
                      {metrics.maxLoad > 0 && <span className="text-[10px] font-bold opacity-90 bg-white/20 px-2 py-0.5 rounded-lg">Max Load: {metrics.maxLoad}</span>}
                   </div>
                </div>
             </div>
           )}
        </section>

        {/* 2. New Widgets Grid (Payroll & Compliance) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Widget A: External Payroll Summary */}
            <section className="space-y-4">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('payroll')}>
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-3"><Wallet className="text-amber-500"/> مستحقات البدلاء الخارجيين</h3>
                    {expandedSections.payroll ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </div>
                
                {expandedSections.payroll && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-slide-down h-[350px] flex flex-col">
                        <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-amber-50/30">
                            <span className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2"><Coins size={14}/> وحدة المحاسبة</span>
                            <span className="text-[10px] font-bold text-slate-400">{payrollList.length} مستفيد</span>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                            {payrollList.length > 0 ? (
                                <div className="space-y-2">
                                    {payrollList.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-amber-500 shadow-sm border border-amber-100 font-black text-xs">{i + 1}</div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-800">{p.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400">{p.daysCount} أيام عمل</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-xl text-xs font-black shadow-sm">
                                                    {p.hours} حصة
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <Wallet size={48} strokeWidth={1} className="mb-2 text-amber-200"/>
                                    <p className="text-xs font-bold">لا يوجد بدلاء خارجيين في هذه الفترة</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Widget B: Compliance Audit */}
            <section className="space-y-4">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('audit')}>
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-3"><ClipboardList className="text-indigo-600"/> جرد الامتثال والتقارير</h3>
                    {expandedSections.audit ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </div>
                
                {expandedSections.audit && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-slide-down h-[350px] flex flex-col">
                        <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-indigo-50/30">
                            <span className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><FileCheck size={14}/> حالة التسليم</span>
                            <div className="flex gap-2">
                                <span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-lg">{complianceList.filter(c => c.status === 'PENDING').length} معلق</span>
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-lg">{complianceList.filter(c => c.status === 'DELIVERED').length} تم</span>
                            </div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                            {complianceList.length > 0 ? (
                                <div className="space-y-2">
                                    {complianceList.map((item, i) => (
                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-2xl border ${item.status === 'PENDING' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-xs font-black truncate ${item.status === 'PENDING' ? 'text-rose-700' : 'text-slate-800'}`}>{item.teacherName}</p>
                                                    <span className="text-[9px] text-slate-400 font-mono bg-white/50 px-1 rounded">{item.date}</span>
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-500 mt-0.5 truncate">{item.reason || 'بدون سبب'}</p>
                                            </div>
                                            <div className="shrink-0 ml-2">
                                                {item.status === 'PENDING' ? (
                                                    <div className="flex items-center gap-1 text-rose-600 bg-white px-2 py-1 rounded-lg shadow-sm border border-rose-100">
                                                        <AlertCircle size={12}/> <span className="text-[9px] font-black">لم يسلم</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                                        <CheckCircle2 size={12}/> <span className="text-[9px] font-black">تم التسليم</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <CheckCircle2 size={48} strokeWidth={1} className="mb-2 text-emerald-200"/>
                                    <p className="text-xs font-bold">سجل الامتثال نظيف</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </div>

        {/* 3. Detailed Operational Report Table */}
        <section className="space-y-4">
           <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('logs')}>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-3"><FileText className="text-slate-500"/> التقرير التشغيلي اليومي التفصيلي</h3>
              {expandedSections.logs ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
           </div>

           {expandedSections.logs && (
             <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-slide-down">
                <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                   <table className="w-full text-right border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase sticky top-0 z-10">
                         <tr>
                            <th className="p-4">التاريخ</th>
                            <th className="p-4">المعلم الغائب</th>
                            <th className="p-4">نوع الغياب</th>
                            <th className="p-4">المبرر / السبب</th>
                            <th className="p-4 w-1/3">البدلاء (عدد الحصص)</th>
                            <th className="p-4">ملاحظات النظام</th>
                         </tr>
                      </thead>
                      <tbody className="text-xs font-bold text-slate-700">
                         {detailedReport.length > 0 ? detailedReport.map((row) => (
                            <tr key={row.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${row.hasExternal ? 'bg-amber-50/40' : ''}`}>
                               <td className="p-4 font-mono text-slate-500 whitespace-nowrap">{row.date}</td>
                               <td className="p-4 text-rose-700 font-black">{row.absentName}</td>
                               <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-[9px] ${row.type === 'يوم كامل' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                     {row.type}
                                  </span>
                               </td>
                               <td className="p-4 text-slate-500 max-w-xs truncate" title={row.reason}>{row.reason}</td>
                               <td className="p-4">
                                   <div className="flex flex-wrap gap-1">
                                       {row.substitutesString.split(' + ').map((sub, idx) => (
                                           <span key={idx} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap">
                                               {sub}
                                           </span>
                                       ))}
                                   </div>
                               </td>
                               <td className="p-4">
                                   {row.hasExternal && (
                                       <span className="flex items-center gap-1 text-[9px] text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded w-fit">
                                           <Wallet size={10}/> تكلفة خارجية
                                       </span>
                                   )}
                                   {!row.isFullyCovered && (
                                       <span className="flex items-center gap-1 text-[9px] text-rose-600 font-bold bg-rose-100 px-2 py-0.5 rounded w-fit mt-1">
                                           <AlertTriangle size={10}/> نقص تغطية
                                       </span>
                                   )}
                               </td>
                            </tr>
                         )) : (
                            <tr>
                               <td colSpan={6} className="p-10 text-center text-slate-400 italic">لا توجد سجلات غياب في هذا النطاق الزمني</td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
           )}
        </section>
      </div>
    );
  };

  const renderSimulationView = () => (
    <div className="space-y-10 animate-fade-in pb-10">
      {/* 1. Simulation Control Center */}
      <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
          <div className="max-w-2xl">
            <h3 className="text-4xl font-black tracking-tighter flex items-center gap-5 mb-4">
              <Brain className="text-indigo-400" size={40} /> محاكي الصمود السنوي v2.0
            </h3>
            <p className="text-slate-400 text-lg font-bold leading-relaxed">
              يقوم هذا المحرك باختبار النظام ضد 365 يوماً من البيانات الافتراضية المكثفة، لفحص مدى عدالة توزيع الحصص، وقدرة "الإشغال الذكي" على حماية الفصول غير المراقبة.
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleStartSimulation}
              disabled={isSimulating}
              className={`px-12 py-6 rounded-[2.5rem] font-black text-lg flex items-center gap-4 transition-all shadow-2xl ${isSimulating ? 'bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-500 glow-primary'}`}
            >
              {isSimulating ? <RotateCcw className="animate-spin" /> : <Play fill="currentColor" />}
              {isSimulating ? 'جاري التحليل...' : 'بدء محاكاة 365 يوماً'}
            </button>
          </div>
        </div>
      </div>

      {simulationResult ? (
        <>
          {/* 2. Executive Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">كفاءة التغطية السنوية</p>
               <div className="flex items-end gap-2">
                 <span className="text-4xl font-black text-emerald-600">{simulationResult.avgEfficiency}%</span>
                 <ShieldCheck className="text-emerald-400 mb-1" size={20} />
               </div>
            </div>
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">إجمالي الغيابات المختبرة</p>
               <span className="text-4xl font-black text-slate-900">{simulationResult.totalAbsences}</span>
            </div>
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">حصص لم يتم تأمينها</p>
               <span className="text-4xl font-black text-rose-600">{simulationResult.totalUncovered}</span>
            </div>
            <div className="bg-rose-900 p-8 rounded-[3rem] shadow-xl text-white">
               <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-2">نقاط الانهيار (Critical)</p>
               <span className="text-4xl font-black">{simulationResult.criticalDates.length} أيام</span>
            </div>
          </div>

          {/* 3. Main Graph */}
          <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h4 className="text-2xl font-black text-slate-900 tracking-tighter">منحنى الضغط مقابل الاستجابة</h4>
                <p className="text-slate-400 font-bold text-sm">تتبع قدرة "الإشغال الذكي" على امتصاص الصدمات السنوية</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><div className="w-3 h-3 bg-rose-500 rounded-full"></div> مستوى الضغط</div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><div className="w-3 h-3 bg-indigo-500 rounded-full"></div> إجهاد الطاقم</div>
              </div>
            </div>

            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulationResult.points}>
                  <defs>
                    <linearGradient id="pColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={[0, 120]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', backgroundColor: '#0f172a', color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="pressure" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#pColor)" />
                  <Area type="monotone" dataKey="fatigue" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Strategic Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-xl">
               <h4 className="text-xl font-black mb-8 flex items-center gap-3 text-indigo-600"><Target /> التواريخ الأكثر خطورة</h4>
               <div className="space-y-4">
                  {simulationResult.criticalDates.map((cd, i) => (
                    <div key={i} className="flex justify-between items-center p-5 bg-rose-50 rounded-2xl border border-rose-100">
                       <span className="font-black text-rose-900">{cd.date}</span>
                       <span className="text-xs font-bold text-rose-500">{cd.risk}</span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="bg-slate-50 p-10 rounded-[3.5rem] border border-slate-200">
               <h4 className="text-xl font-black mb-8 flex items-center gap-3 text-slate-700"><Zap className="text-amber-500" /> توصيات الذكاء الاصطناعي</h4>
               <ul className="space-y-4">
                  <li className="flex gap-4 items-start">
                    <div className="p-2 bg-white rounded-lg text-emerald-500 shadow-sm"><ShieldCheck size={16}/></div>
                    <p className="text-sm font-bold text-slate-600">النظام يحمي صفوف (١-٢) بنسبة 100% بفضل وجود المساعدين دائماً.</p>
                  </li>
                  <li className="flex gap-4 items-start">
                    <div className="p-2 bg-white rounded-lg text-amber-500 shadow-sm"><AlertTriangle size={16}/></div>
                    <p className="text-sm font-bold text-slate-600">يوصى بزيادة طاقم "البدلاء الخارجيين" بنسبة 10% قبل شهر يونيو لتفادي نقاط الانهيار.</p>
                  </li>
                  <li className="flex gap-4 items-start">
                    <div className="p-2 bg-white rounded-lg text-indigo-500 shadow-sm"><TrendingUp size={16}/></div>
                    <p className="text-sm font-bold text-slate-600">معدل الإجهاد التراكمي للطاقم مستقر، مما يدل على عدالة توزيع الحصص.</p>
                  </li>
               </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-6">
           <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <Activity size={48} />
           </div>
           <div>
              <p className="font-black text-2xl text-slate-400">بانتظار تشغيل المحاكي...</p>
              <p className="text-sm font-bold text-slate-300 mt-2">سيقوم النظام بتحليل 200 يوم عمل وأكثر من 5000 حصة دراسية.</p>
           </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-10 pb-20 animate-fade-in" dir="rtl">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-bl-[5rem] -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
         <div className="relative z-10">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-5">
              <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-200"><BarChart3 size={32} /></div>
              التحليل الاستراتيجي السنوي
            </h2>
            <p className="text-slate-500 mt-2 font-bold text-lg mr-20 italic">لوحة القيادة المركزية ومحاكاة كفاءة النظام</p>
         </div>
         <div className="flex p-2 bg-slate-100 rounded-[2rem] shadow-inner relative z-10 gap-2">
            <button onClick={() => setActiveTab('command_center')} className={`px-6 py-3 rounded-[1.5rem] font-black text-xs transition-all ${activeTab === 'command_center' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>لوحة القيادة</button>
            <button onClick={() => setActiveTab('operational')} className={`px-6 py-3 rounded-[1.5rem] font-black text-xs transition-all ${activeTab === 'operational' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>التقرير التشغيلي</button>
            <button onClick={() => setActiveTab('simulation')} className={`px-6 py-3 rounded-[1.5rem] font-black text-xs transition-all ${activeTab === 'simulation' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>المحاكاة (AI)</button>
         </div>
      </div>

      <div className="min-h-[600px]">
         {activeTab === 'command_center' && renderCommandCenter()}
         {activeTab === 'simulation' && renderSimulationView()}
         {activeTab === 'operational' && renderOperationalReport()}
      </div>
    </div>
  );
};

export default Reports;
