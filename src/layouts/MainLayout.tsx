import React from 'react';
import { Menu, Siren, Home, UserX, Calendar, CalendarDays } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { ScheduleConfig, Employee, SystemAlert, ViewState } from '@/types';

interface MainLayoutProps {
    children: React.ReactNode;
    activeView: ViewState;
    setActiveView: (view: ViewState) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    isFlashAlertMode: boolean;
    setIsFlashAlertMode: (mode: boolean) => void;
    currentUser: Employee | null;
    onLogout: () => void;
    scheduleConfig: ScheduleConfig;
    eventAlerts: SystemAlert[];
    onLaunchImport: () => void;
    hasPermission: (permission: string) => boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    activeView,
    setActiveView,
    sidebarOpen,
    setSidebarOpen,
    isFlashAlertMode,
    setIsFlashAlertMode,
    currentUser,
    onLogout,
    scheduleConfig,
    eventAlerts,
    onLaunchImport,
    hasPermission
}) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    // Scroll Detection for Floating Home Button
    const mainRef = React.useRef<HTMLDivElement>(null);
    const [showFloatingHome, setShowFloatingHome] = React.useState(false);

    React.useEffect(() => {
        const handleScroll = () => {
            if (mainRef.current) {
                setShowFloatingHome(mainRef.current.scrollTop > 200);
            }
        };
        const mainEl = mainRef.current;
        if (mainEl) mainEl.addEventListener('scroll', handleScroll);
        return () => mainEl?.removeEventListener('scroll', handleScroll);
    }, []);

    return (
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
                        systemAlerts={eventAlerts}
                        scheduleConfig={scheduleConfig}
                        currentUser={currentUser}
                        onLogout={onLogout}
                        uncoveredCount={0}
                        onLaunchImport={onLaunchImport}
                        hasPermission={hasPermission}
                    />
                )}

                <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
                    <header className={`px-4 py-3 md:px-6 md:py-4 flex justify-between items-center z-20 shadow-sm transition-all duration-500 sticky top-0 shrink-0 ${isFlashAlertMode ? 'bg-rose-900 border-b border-rose-800 shadow-rose-950/40' : 'bg-white/90 backdrop-blur-md border-b border-slate-200'}`}>
                        <div className="flex items-center gap-2 md:gap-4">
                            {!isFlashAlertMode && (
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                                    aria-label="فتح القائمة الجانبية"
                                >
                                    <Menu size={24} aria-hidden="true" />
                                </button>
                            )}
                            {isFlashAlertMode && <Siren className="text-white animate-pulse" size={24} aria-hidden="true" />}
                            <button
                                onClick={() => setActiveView('dashboard')}
                                className="flex items-center gap-2 md:gap-4 hover:opacity-80 transition-all text-right min-w-0"
                                aria-label="العودة للرئيسية"
                            >
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
                            <button
                                onClick={() => setIsFlashAlertMode(!isFlashAlertMode)}
                                className={`px-3 py-1.5 md:px-6 md:py-2 rounded-full font-black text-[10px] md:text-xs transition-all flex items-center gap-2 md:gap-3 ${isFlashAlertMode ? 'bg-white text-rose-600 shadow-2xl' : 'bg-rose-600 text-white shadow-lg shadow-rose-200'}`}
                                aria-label={isFlashAlertMode ? 'إيقاف وضع الطوارئ' : 'تفعيل وضع الطوارئ'}
                                aria-pressed={isFlashAlertMode}
                            >
                                <Siren size={14} className={isFlashAlertMode ? '' : 'animate-bounce'} aria-hidden="true" />
                                <span className="hidden md:inline">{isFlashAlertMode ? 'إلغاء وضع الطوارئ' : 'تفعيل Flash Alert'}</span>
                                <span className="md:hidden">طوارئ</span>
                            </button>
                        </div>
                    </header>

                    <main ref={mainRef} className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar ${isFlashAlertMode ? 'p-3 md:p-10' : (activeView === 'workspace' || activeView === 'duty-management') ? 'p-0' : 'p-3 md:p-8'} pb-24 lg:pb-8`}>
                        <div className={(activeView === 'workspace' || activeView === 'duty-management') ? 'h-full' : 'max-w-7xl mx-auto w-full min-h-full'}>
                            {children}
                        </div>
                    </main>

                    {/* Premium Floating Home Button */}
                    {!isMobile && activeView !== 'dashboard' && (
                        <div className={`fixed bottom-8 left-8 z-50 transition-all duration-500 transform ${showFloatingHome ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                            <button
                                onClick={() => {
                                    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                    setTimeout(() => setActiveView('dashboard'), 300);
                                }}
                                className="group flex items-center gap-0 bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pr-4 hover:pr-5 hover:gap-3 transition-all duration-300 overflow-hidden"
                                aria-label="العودة للرئيسية"
                            >
                                <span className="text-[10px] font-black group-hover:block transition-all duration-300 overflow-hidden whitespace-nowrap opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto delay-75">
                                    العودة للرئيسية
                                </span>
                                <div className="p-2 bg-indigo-600 rounded-full group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/50">
                                    <Home size={18} fill="currentColor" aria-hidden="true" />
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MOBILE BOTTOM NAVIGATION --- */}
            {isMobile && !isFlashAlertMode && (
                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[9000] px-6 py-2 flex justify-between items-center shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] pb-safe-area" role="navigation" aria-label="شريط التنقل السفلي">
                    <button
                        onClick={() => setActiveView('dashboard')}
                        className={`flex flex-col items-center gap-1 transition-all ${activeView === 'dashboard' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
                        aria-label="الرئيسية"
                        aria-current={activeView === 'dashboard' ? 'page' : undefined}
                    >
                        <Home size={20} fill={activeView === 'dashboard' ? "currentColor" : "none"} aria-hidden="true" />
                        <span className="text-[9px] font-black">الرئيسية</span>
                    </button>

                    <button
                        onClick={() => setActiveView('schedule')}
                        className={`flex flex-col items-center gap-1 transition-all ${activeView === 'schedule' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
                        aria-label="الجدول الدراسي"
                        aria-current={activeView === 'schedule' ? 'page' : undefined}
                    >
                        <Calendar size={20} fill={activeView === 'schedule' ? "currentColor" : "none"} aria-hidden="true" />
                        <span className="text-[9px] font-black">الجدول</span>
                    </button>

                    {/* FAB for Quick Action (Absence) */}
                    <div className="relative -top-5">
                        <button
                            onClick={() => setActiveView('substitutions')}
                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all ${activeView === 'substitutions' ? 'bg-rose-600 text-white scale-110 ring-4 ring-rose-100' : 'bg-rose-500 text-white'}`}
                            aria-label="إدارة البدائل والغياب"
                            aria-current={activeView === 'substitutions' ? 'page' : undefined}
                        >
                            <UserX size={24} aria-hidden="true" />
                        </button>
                    </div>

                    <button
                        onClick={() => setActiveView('calendar')}
                        className={`flex flex-col items-center gap-1 transition-all ${activeView === 'calendar' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
                        aria-label="الرزنامة المدرسية"
                        aria-current={activeView === 'calendar' ? 'page' : undefined}
                    >
                        <CalendarDays size={20} fill={activeView === 'calendar' ? "currentColor" : "none"} aria-hidden="true" />
                        <span className="text-[9px] font-black">الرزنامة</span>
                    </button>

                    <button
                        onClick={() => setSidebarOpen(true)}
                        className={`flex flex-col items-center gap-1 transition-all text-slate-400 hover:text-slate-600`}
                        aria-label="فتح القائمة"
                    >
                        <Menu size={20} aria-hidden="true" />
                        <span className="text-[9px] font-black">القائمة</span>
                    </button>
                </nav>
            )}
        </div>
    );
};
