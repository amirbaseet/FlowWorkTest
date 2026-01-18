
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Menu, LayoutDashboard, ChevronRight, Share2, ArrowLeft, Siren, Home, Zap, ShieldCheck, X, CloudRain, Bus, FileText, Activity, GripVertical, Sparkles, UserX, Calendar, CalendarDays } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ToastProvider } from './contexts/ToastContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Schedule from './components/Schedule';
import Settings from './components/Settings';
import AiAssistant from './components/AiAssistant';
import Substitutions from './components/Substitutions';
import Reports from './components/Reports';
import CalendarModule from './components/CalendarModule';
import CalendarRequestForm from './components/CalendarRequestForm'; 
import PartnerPortal from './components/PartnerPortal';
import NotificationBell from './components/NotificationBell';
import ScheduleQualityIndicator from './components/ScheduleQualityIndicator';
import LoginScreen from './components/LoginScreen';
import ModeConfigModal from './components/ModeConfigModal';
import BulletinBoard from './components/BulletinBoard';
import ExcelWizard from './components/ExcelWizard';

import { 
  INITIAL_EMPLOYEES, INITIAL_CLASSES, INITIAL_LESSONS, INITIAL_SCHEDULE_CONFIG,
  INITIAL_ROLES, INITIAL_ABSENCES, INITIAL_ENGINE_CONTEXT, INITIAL_ACADEMIC_YEAR,
  INITIAL_DAY_PATTERNS, DAYS_AR, DEFAULT_DASHBOARD_LAYOUT
} from './constants';
import { 
  Employee, ClassItem, Lesson, ScheduleConfig, ViewState, Role, AbsenceRecord, 
  EngineContext, SubstitutionLog, SystemAlert, AcademicYear, DayPattern, CalendarHoliday, 
  DayOverride, CalendarEvent, CalendarTask, EventComment, DashboardLayout, ModeConfig,
  ScheduleFilter
} from './types';

export default function App() {
  const [employees, setEmployees] = useLocalStorage<Employee[]>('employees', INITIAL_EMPLOYEES);
  const [classes, setClasses] = useLocalStorage<ClassItem[]>('classes', INITIAL_CLASSES);
  const [lessons, setLessons] = useLocalStorage<Lesson[]>('lessons', INITIAL_LESSONS);
  const [scheduleConfig, setScheduleConfig] = useLocalStorage<ScheduleConfig>('scheduleConfig', INITIAL_SCHEDULE_CONFIG);
  const [roles, setRoles] = useLocalStorage<Role[]>('roles', INITIAL_ROLES);
  const [absences, setAbsences] = useLocalStorage<AbsenceRecord[]>('absences', INITIAL_ABSENCES);
  const [engineContext, setEngineContext] = useLocalStorage<EngineContext>('engineContext', INITIAL_ENGINE_CONTEXT);
  const [substitutionLogs, setSubstitutionLogs] = useLocalStorage<SubstitutionLog[]>('substitutionLogs', []);
  const [dashboardConfig, setDashboardConfig] = useLocalStorage<DashboardLayout>('dashboardConfig', DEFAULT_DASHBOARD_LAYOUT);
  
  const [academicYear] = useLocalStorage<AcademicYear>('academicYear', INITIAL_ACADEMIC_YEAR);
  const [dayPatterns] = useLocalStorage<DayPattern[]>('dayPatterns', INITIAL_DAY_PATTERNS);
  const [holidays, setHolidays] = useLocalStorage<CalendarHoliday[]>('calendarHolidays', []);
  const [overrides, setOverrides] = useLocalStorage<DayOverride[]>('dayOverrides', []);
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('calendarEvents', []);
  const [tasks, setTasks] = useLocalStorage<CalendarTask[]>('calendarTasks', []);
  const [comments, setComments] = useLocalStorage<EventComment[]>('calendarComments', []);

  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>(null);
  const [prefilledRequest, setPrefilledRequest] = useState<any>(null);
  const [isFlashAlertMode, setIsFlashAlertMode] = useState(false);
  const [configuringModeId, setConfiguringModeId] = useState<string | null>(null);
  const [isKioskMode, setIsKioskMode] = useState(false);
  
  const [showImportWizard, setShowImportWizard] = useState(false);

  const [orbitPos, setOrbitPos] = useState({ x: 30, y: 30 });
  const [isOrbitIdle, setIsOrbitIdle] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const orbitTimerRef = useRef<number | null>(null);
  
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const modeParam = params.get('mode');

    if (viewParam === 'bulletin') {
      setActiveView('bulletin-board');
      if (modeParam === 'kiosk') {
        setIsKioskMode(true);
      }
    }
  }, []);

  const resetOrbitTimer = () => {
    setIsOrbitIdle(false);
    if (orbitTimerRef.current) window.clearTimeout(orbitTimerRef.current);
    orbitTimerRef.current = window.setTimeout(() => {
        setIsOrbitIdle(true);
    }, 5000);
  };

  useEffect(() => {
    resetOrbitTimer();
    return () => { if (orbitTimerRef.current) window.clearTimeout(orbitTimerRef.current); };
  }, [activeView]);

  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setOrbitPos({
          x: Math.max(10, window.innerWidth - e.clientX - 40),
          y: Math.max(10, window.innerHeight - e.clientY - 40)
        });
        resetOrbitTimer();
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isMobile]);

  const orbitBaseColor = useMemo(() => {
    if (isFlashAlertMode) return 'from-rose-600 to-rose-900 shadow-rose-500/50';
    switch (activeView) {
      case 'schedule': return 'from-indigo-600 to-indigo-900 shadow-indigo-500/50';
      case 'substitutions': return 'from-amber-600 to-amber-900 shadow-amber-500/50';
      case 'ai-assistant': return 'from-violet-600 to-violet-900 shadow-violet-500/50';
      case 'reports': return 'from-emerald-600 to-emerald-900 shadow-emerald-500/50';
      default: return 'from-slate-800 to-slate-950 shadow-slate-900/50';
    }
  }, [activeView, isFlashAlertMode]);

  useEffect(() => {
    const storedUser = localStorage.getItem('classflow_user');
    if (storedUser) { try { setCurrentUser(JSON.parse(storedUser)); } catch (e) {} }
    setIsAuthChecking(false);
  }, []);

  const handleLogin = async (email: string, pass: string): Promise<boolean> => {
    // 1. Check Super Admin
    if (email === 'admin@school.edu' && pass === 'password123') {
      const admin: Employee = { id: 999, name: 'مدير النظام', nationalId: '000', baseRoleId: 'principal', contractedHours: 40, workload: { actual: 0, individual: 0, stay: 0 }, addons: { educator: false, coordinators: [] }, constraints: { cannotCoverAlone: false, isExternal: false }, subjects: ['إدارة'] };
      setCurrentUser(admin); 
      localStorage.setItem('classflow_user', JSON.stringify(admin)); 
      setActiveView('dashboard');
      return true;
    }

    // 2. Check Employee Database
    // Format: [NationalID]@school.edu OR just NationalID
    const inputId = email.includes('@') ? email.split('@')[0] : email;
    
    // Find employee by National ID
    const employee = employees.find(e => e.nationalId === inputId);
    
    // Verify: Password matches National ID (Simple Auth for Demo)
    if (employee && pass === employee.nationalId) {
       setCurrentUser(employee);
       localStorage.setItem('classflow_user', JSON.stringify(employee));
       
       // Redirect based on role
       if (employee.baseRoleId === 'teacher' || employee.constraints.isExternal) {
           setActiveView('schedule'); // Teachers see schedule first
           setScheduleFilter({ mode: 'teacher', id: employee.id }); // Filter to their schedule
       } else {
           setActiveView('dashboard');
       }
       return true;
    }

    return false;
  };

  const handleLogout = () => { localStorage.removeItem('classflow_user'); setCurrentUser(null); setActiveView('dashboard'); };
  
  const toggleMode = (modeId: string) => {
    const currentMode = engineContext?.[modeId];
    if (!currentMode?.isActive) setConfiguringModeId(modeId);
    else setEngineContext(prev => ({ ...prev, [modeId]: { ...prev[modeId], isActive: false } }));
  };

  if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  
  if (isKioskMode && activeView === 'bulletin-board') {
    return (
      <BulletinBoard 
        scheduleConfig={scheduleConfig}
        employees={employees}
        classes={classes}
        lessons={lessons}
        events={events}
        substitutionLogs={substitutionLogs}
        absences={absences}
        engineContext={engineContext}
      />
    );
  }

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  if (activeView === 'bulletin-board') {
    return (
      <>
        <BulletinBoard 
          scheduleConfig={scheduleConfig}
          employees={employees}
          classes={classes}
          lessons={lessons}
          events={events}
          substitutionLogs={substitutionLogs}
          absences={absences}
          engineContext={engineContext}
        />
        {!isKioskMode && (
          <button 
            onClick={() => setActiveView('dashboard')}
            className="fixed bottom-6 left-6 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl transition-all z-50 border-2 border-white/20 group"
            title="العودة للرئيسية"
          >
            <Home size={24} className="group-hover:scale-110 transition-transform" />
          </button>
        )}
      </>
    );
  }

  return (
    <ToastProvider>
      <div className={`flex flex-col h-screen w-full overflow-hidden font-sans transition-all duration-700 ${isFlashAlertMode ? 'bg-rose-950 text-white' : 'bg-slate-50 text-slate-800'}`} onContextMenu={(e) => e.preventDefault()}>
        
        {/* Main Flex Layout: Sidebar (Hidden on Mobile) + Content */}
        <div className="flex flex-1 h-full overflow-hidden">
            {/* Sidebar - Acts as fixed drawer on mobile, static on desktop */}
            {!isFlashAlertMode && (
            <Sidebar 
                active={activeView} 
                setActive={setActiveView} 
                open={sidebarOpen} 
                setOpen={setSidebarOpen} 
                systemAlerts={[]} 
                scheduleConfig={scheduleConfig} 
                currentUser={currentUser} 
                onLogout={handleLogout} 
                uncoveredCount={0} 
                onLaunchImport={() => setShowImportWizard(true)}
            />
            )}

            <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
            <header className={`px-4 py-3 md:px-6 md:py-4 flex justify-between items-center z-20 shadow-sm transition-all duration-500 sticky top-0 shrink-0 ${isFlashAlertMode ? 'bg-rose-900 border-b border-rose-800 shadow-rose-950/40' : 'bg-white/90 backdrop-blur-md border-b border-slate-200'}`}>
                <div className="flex items-center gap-2 md:gap-4">
                {!isFlashAlertMode && (
                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors">
                        <Menu size={24} />
                    </button>
                    )}
                {isFlashAlertMode && <Siren className="text-white animate-pulse" size={24} />}
                <button onClick={() => setActiveView('dashboard')} className="flex items-center gap-2 md:gap-4 hover:opacity-80 transition-all text-right min-w-0">
                    <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm md:text-2xl tracking-tighter truncate">
                        {isFlashAlertMode ? 'نظام الطوارئ' : (scheduleConfig.schoolInfo?.name || "مدرستي")}
                        </span>
                        {currentUser?.baseRoleId !== 'principal' && (
                            <span className="text-[9px] text-indigo-500 font-bold hidden md:block">
                                مرحباً بك، {currentUser?.name.split(' ')[0]}
                            </span>
                        )}
                    </div>
                </button>
                </div>
                <div className="flex items-center gap-2 md:gap-6 relative">
                    <button onClick={() => setIsFlashAlertMode(!isFlashAlertMode)} className={`px-3 py-1.5 md:px-6 md:py-2 rounded-full font-black text-[10px] md:text-xs transition-all flex items-center gap-2 md:gap-3 ${isFlashAlertMode ? 'bg-white text-rose-600 shadow-2xl' : 'bg-rose-600 text-white shadow-lg shadow-rose-200'}`}>
                    <Siren size={14} className={isFlashAlertMode ? '' : 'animate-bounce'} />
                    <span className="hidden md:inline">{isFlashAlertMode ? 'إلغاء وضع الطوارئ' : 'تفعيل Flash Alert'}</span>
                    <span className="md:hidden">طوارئ</span>
                    </button>
                </div>
            </header>

            <main className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar ${isFlashAlertMode ? 'p-3 md:p-10' : 'p-3 md:p-8'} pb-24 lg:pb-8`}>
                <div className="max-w-7xl mx-auto w-full min-h-full">
                {activeView === 'dashboard' && <Dashboard employees={employees} classes={classes} lessons={lessons} scheduleConfig={scheduleConfig} absences={absences} onNavigateToSchedule={(m,i) => {setScheduleFilter({mode:m,id:i}); setActiveView('schedule');}} onNavigateToView={setActiveView} engineContext={engineContext} substitutionLogs={substitutionLogs} events={events} systemAlerts={[]} />}
                {!isFlashAlertMode && (
                    <>
                    {activeView === 'employees' && <Employees employees={employees} setEmployees={setEmployees} classes={classes} roles={roles} onNavigateToSchedule={(m,i) => {setScheduleFilter({mode:m,id:i}); setActiveView('schedule');}} lessons={lessons} />}
                    {activeView === 'schedule' && <Schedule lessons={lessons} setLessons={setLessons} scheduleConfig={scheduleConfig} employees={employees} classes={classes} initialFilter={scheduleFilter} academicYear={academicYear} patterns={dayPatterns} holidays={holidays} overrides={overrides} events={events} engineContext={engineContext} setEngineContext={setEngineContext} onToggleMode={toggleMode} substitutionLogs={substitutionLogs} absences={absences} />}
                    {activeView === 'substitutions' && <Substitutions employees={employees} lessons={lessons} setLessons={setLessons} scheduleConfig={scheduleConfig} classes={classes} engineContext={engineContext} setEngineContext={setEngineContext} onToggleMode={toggleMode} setSubstitutionLogs={setSubstitutionLogs} substitutionLogs={substitutionLogs} absences={absences} setAbsences={setAbsences} onNavigateToView={setActiveView} academicYear={academicYear} patterns={dayPatterns} holidays={holidays} overrides={overrides} setOverrides={setOverrides} events={events} setEvents={setEvents} onOpenRequestForm={(pref) => { setPrefilledRequest(pref); setActiveView('calendar-request'); }} />}
                    {activeView === 'calendar' && <CalendarModule currentUser={currentUser} academicYear={academicYear} patterns={dayPatterns} holidays={holidays} overrides={overrides} events={events} tasks={tasks} comments={comments} employees={employees} classes={classes} lessons={lessons} absences={absences} setAbsences={setAbsences} substitutionLogs={substitutionLogs} setHolidays={setHolidays} setOverrides={setOverrides} setEvents={setEvents} setTasks={setTasks} setComments={setComments} onOpenRequestForm={(pref) => { setPrefilledRequest(pref); setActiveView('calendar-request'); }} onNavigateToView={setActiveView} engineContext={engineContext} scheduleConfig={scheduleConfig} />}
                    {activeView === 'partner-portal' && <PartnerPortal employees={employees} classes={classes} setEvents={setEvents} onBack={() => setActiveView('calendar')} currentUser={currentUser} />}
                    {activeView === 'ai-assistant' && <AiAssistant lessons={lessons} employees={employees} classes={classes} substitutionLogs={substitutionLogs} absences={absences} />}
                    
                    {activeView === 'settings' && <Settings scheduleConfig={scheduleConfig} setScheduleConfig={setScheduleConfig} roles={roles} setRoles={setRoles} classes={classes} setClasses={setClasses} engineContext={engineContext} setEngineContext={setEngineContext} validateDeleteClass={() => ({canDelete:true})} validateDeleteRole={() => ({canDelete:true})} setEmployees={setEmployees} setLessons={setLessons} />}
                    
                    {activeView === 'reports' && <Reports employees={employees} absences={absences} substitutionLogs={substitutionLogs} scheduleConfig={scheduleConfig} classes={classes} lessons={lessons} comments={comments} events={events} patterns={dayPatterns} academicYear={academicYear} engineContext={engineContext} setEngineContext={setEngineContext} onToggleMode={toggleMode} systemAlerts={[]} tasks={tasks} onNavigateToView={setActiveView} onNavigateToSettings={() => setActiveView('settings')} />}
                    {activeView === 'calendar-request' && (
                        <CalendarRequestForm 
                            employees={employees} 
                            classes={classes} 
                            setEvents={setEvents} 
                            onClose={() => { setActiveView('calendar'); setPrefilledRequest(null); }} 
                            prefill={prefilledRequest} 
                            currentUser={currentUser} 
                            lessons={lessons}
                            setSubstitutionLogs={setSubstitutionLogs}
                            substitutionLogs={substitutionLogs}
                        />
                    )}
                    </>
                )}
                </div>
            </main>

            {/* Floating Orbit (Desktop Only) */}
            {!isMobile && activeView !== 'dashboard' && (
                <div 
                style={{ bottom: orbitPos.y, left: orbitPos.x }}
                onMouseEnter={() => setIsOrbitIdle(false)}
                onMouseLeave={resetOrbitTimer}
                className={`
                    fixed z-[9999] flex items-center transition-all duration-700 ease-in-out
                    ${isOrbitIdle ? 'opacity-35 scale-75 blur-[1px]' : 'opacity-100 scale-100'}
                `}
                >
                <div className={`absolute inset-0 bg-gradient-to-tr ${orbitBaseColor} opacity-20 blur-3xl rounded-full animate-pulse transition-all duration-700`}></div>

                <div className="flex items-center gap-2 relative bg-white/10 backdrop-blur-3xl p-2 rounded-[3.5rem] border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)]">
                    <div 
                        onMouseDown={() => setIsDragging(true)}
                        className={`
                        w-8 h-12 flex items-center justify-center cursor-move transition-all duration-500
                        ${isOrbitIdle ? 'w-4 h-4' : 'w-8 h-12 bg-white/5 rounded-full text-white/30 hover:text-white/80'}
                        `}
                    >
                        {!isOrbitIdle && <GripVertical size={16} />}
                    </div>
                    
                    <button 
                    onClick={() => setActiveView('dashboard')}
                    className={`
                        flex items-center gap-4 bg-gradient-to-br ${orbitBaseColor} text-white shadow-2xl
                        transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) 
                        relative overflow-hidden group
                        ${isOrbitIdle ? 'p-4 rounded-full' : 'px-5 py-3 md:px-10 md:py-6 rounded-[2.5rem]'}
                    `}
                    >
                    <div className="relative z-10">
                        <Home size={isOrbitIdle ? 24 : 28} className={`transition-all duration-700 ${!isOrbitIdle ? 'group-hover:rotate-[360deg] group-hover:scale-125' : ''}`} />
                    </div>
                    
                    {!isOrbitIdle && (
                        <div className="text-right whitespace-nowrap animate-fade-in relative z-10 hidden md:block">
                        <span className="block font-black text-base tracking-tighter">العودة للرئيسية</span>
                        <div className="flex items-center gap-1 opacity-60">
                            <span className="block text-[10px] font-black uppercase tracking-[0.2em]">Dash Core</span>
                            <Sparkles size={10} className="text-indigo-300 animate-pulse" />
                        </div>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none"></div>
                    </button>
                </div>
                </div>
            )}
            </div>
        </div>

        {/* --- MOBILE BOTTOM NAVIGATION --- */}
        {isMobile && !isFlashAlertMode && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[9000] px-6 py-2 flex justify-between items-center shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] pb-safe-area">
                <button 
                    onClick={() => setActiveView('dashboard')} 
                    className={`flex flex-col items-center gap-1 transition-all ${activeView === 'dashboard' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
                >
                    <Home size={20} fill={activeView === 'dashboard' ? "currentColor" : "none"} />
                    <span className="text-[9px] font-black">الرئيسية</span>
                </button>
                
                <button 
                    onClick={() => setActiveView('schedule')} 
                    className={`flex flex-col items-center gap-1 transition-all ${activeView === 'schedule' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
                >
                    <Calendar size={20} fill={activeView === 'schedule' ? "currentColor" : "none"} />
                    <span className="text-[9px] font-black">الجدول</span>
                </button>

                {/* FAB for Quick Action (Absence) */}
                <div className="relative -top-5">
                    <button 
                        onClick={() => setActiveView('substitutions')}
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all ${activeView === 'substitutions' ? 'bg-rose-600 text-white scale-110 ring-4 ring-rose-100' : 'bg-rose-500 text-white'}`}
                    >
                        <UserX size={24} />
                    </button>
                </div>

                <button 
                    onClick={() => setActiveView('calendar')} 
                    className={`flex flex-col items-center gap-1 transition-all ${activeView === 'calendar' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
                >
                    <CalendarDays size={20} fill={activeView === 'calendar' ? "currentColor" : "none"} />
                    <span className="text-[9px] font-black">الرزنامة</span>
                </button>

                <button 
                    onClick={() => setSidebarOpen(true)} 
                    className={`flex flex-col items-center gap-1 transition-all text-slate-400 hover:text-slate-600`}
                >
                    <Menu size={20} />
                    <span className="text-[9px] font-black">القائمة</span>
                </button>
            </div>
        )}

      {configuringModeId && (
        <ModeConfigModal 
          modeId={configuringModeId}
          initialConfig={engineContext[configuringModeId]}
          classes={classes}
          scheduleConfig={scheduleConfig}
          onClose={() => setConfiguringModeId(null)}
          onSave={(config) => {
            setEngineContext(prev => ({ ...prev, [configuringModeId]: { ...config, isActive: true } }));
            setConfiguringModeId(null);
          }}
        />
      )}

      {showImportWizard && (
        <ExcelWizard 
          onClose={() => setShowImportWizard(false)}
          setEmployees={setEmployees}
          setClasses={setClasses}
          setLessons={setLessons}
          scheduleConfig={scheduleConfig} 
          setScheduleConfig={setScheduleConfig}
          currentEmployees={employees}
          currentClasses={classes}
          currentLessons={lessons}
        />
      )}
    </ToastProvider>
  );
}

const style = document.createElement('style');
style.innerHTML = `
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 1.5s infinite;
}
.pb-safe-area {
    padding-bottom: env(safe-area-inset-bottom);
}
`;
document.head.appendChild(style);
