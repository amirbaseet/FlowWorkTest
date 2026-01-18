import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { useAuth } from '@/hooks/useAuth';
import { useAbsence } from '@/hooks/useAbsence';
import { useLessons } from '@/hooks/useLessons';
import { useAbsences } from '@/hooks/useAbsences';
import { useSubstitutions } from '@/hooks/useSubstitutions';
import { useCoverage } from '@/hooks/useCoverage';
import { MainLayout } from '@/layouts/MainLayout';
import { SystemAlert, ViewState, ScheduleFilter } from '@/types';

// Lazy Load Components
const Dashboard = lazy(() => import('@/components/Dashboard'));
const Employees = lazy(() => import('@/components/Employees'));
const Schedule = lazy(() => import('@/components/Schedule'));
const Settings = lazy(() => import('@/components/Settings'));
const AiAssistant = lazy(() => import('@/components/AiAssistant'));
const Substitutions = lazy(() => import('@/components/Substitutions'));
const Reports = lazy(() => import('@/components/Reports'));
const CalendarModule = lazy(() => import('@/components/CalendarModule'));
const CalendarRequestForm = lazy(() => import('@/components/CalendarRequestForm'));
const PartnerPortal = lazy(() => import('@/components/PartnerPortal'));
const LoginScreen = lazy(() => import('@/components/LoginScreen'));
const ModeConfigModal = lazy(() => import('@/components/ModeConfigModal'));
const BulletinBoard = lazy(() => import('@/components/BulletinBoard'));
const ExcelWizard = lazy(() => import('@/components/ExcelWizard'));
const Workspace = lazy(() => import('@/components/Workspace'));
const DutyManagement = lazy(() => import('@/components/DutyManagement'));
const DutyReports = lazy(() => import('@/components/DutyReports'));

// Loading Spinner Component
const PageLoader = () => (
    <div className="flex h-full w-full items-center justify-center p-20">
        <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <p className="text-sm font-bold text-indigo-600 animate-pulse">جاري تحميل المكونات...</p>
        </div>
    </div>
);

export function AppRouter() {
    const data = useAppData();

    // Phase 2: Operational Data from Context
    const { lessons, setLessons } = useLessons();
    const { absences, setAbsences } = useAbsences();
    const { substitutionLogs, setSubstitutionLogs } = useSubstitutions();
    const {
        coverageRequests, setCoverageRequests,
        coverageAssignments, setCoverageAssignments,
        dailyPools, setDailyPools
    } = useCoverage();

    const auth = useAuth(data.employees, data.roles);

    const absenceLogic = useAbsence({
        absences,
        setAbsences,
        coverageRequests,
        setCoverageRequests,
        setCoverageAssignments,
        setDailyPools
    });

    // UI State
    const [activeView, setActiveView] = useState<ViewState>('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>(null);
    const [prefilledRequest, setPrefilledRequest] = useState<any>(null);
    const [showCalendarRequestOverlay, setShowCalendarRequestOverlay] = useState(false);
    const [isFlashAlertMode, setIsFlashAlertMode] = useState(false);
    const [configuringModeId, setConfiguringModeId] = useState<string | null>(null);
    const [isKioskMode, setIsKioskMode] = useState(false);
    const [workspaceAbsenceStep, setWorkspaceAbsenceStep] = useState<1 | 2 | 3 | 6 | null>(null);
    const [showImportWizard, setShowImportWizard] = useState(false);

    // Initialization Effects
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

    // Event Alerts
    const eventAlerts = useMemo((): SystemAlert[] => {
        const alerts: SystemAlert[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        data.events.forEach(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntil === 0) {
                alerts.push({ id: `event-today-${event.id}`, type: 'warning', message: `فعالية اليوم: ${event.title}`, detail: `الفعالية "${event.title}" تحدث اليوم. تأكد من جميع الترتيبات.` });
            } else if (daysUntil === 1) {
                alerts.push({ id: `event-tomorrow-${event.id}`, type: 'info', message: `فعالية غداً: ${event.title}`, detail: `الفعالية "${event.title}" ستحدث غداً. يرجى التحضير مسبقاً.` });
            } else if (daysUntil === 3) {
                alerts.push({ id: `event-3days-${event.id}`, type: 'info', message: `فعالية قريبة: ${event.title}`, detail: `الفعالية "${event.title}" ستحدث بعد 3 أيام (${event.date}).` });
            } else if (daysUntil === 7) {
                alerts.push({ id: `event-7days-${event.id}`, type: 'info', message: `فعالية قادمة: ${event.title}`, detail: `الفعالية "${event.title}" ستحدث بعد أسبوع (${event.date}).` });
            }
        });

        return alerts;
    }, [data.events]);

    const toggleMode = (modeId: string) => {
        const currentMode = data.engineContext?.[modeId];
        if (!currentMode?.isActive) setConfiguringModeId(modeId);
        else data.setEngineContext(prev => ({ ...prev, [modeId]: { ...prev[modeId], isActive: false } }));
    };

    // --- RENDER ---

    if (auth.isAuthChecking) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
    }

    if (isKioskMode && activeView === 'bulletin-board') {
        return (
            <Suspense fallback={<PageLoader />}>
                <BulletinBoard
                    key={`bulletin-${substitutionLogs.length}-${absences.length}`}
                    scheduleConfig={data.scheduleConfig}
                    employees={data.employees}
                    classes={data.classes}
                    lessons={lessons}
                    events={data.events}
                    substitutionLogs={substitutionLogs}
                    absences={absences}
                    engineContext={data.engineContext}
                />
            </Suspense>
        );
    }

    if (!auth.currentUser) {
        return (
            <Suspense fallback={<PageLoader />}>
                <LoginScreen onLogin={async (e, p) => {
                    const success = await auth.login(e, p);
                    if (success) {
                        // After login redirect logic (extracted from App.tsx)
                        const inputId = e.includes('@') ? e.split('@')[0] : e;
                        const emp = data.employees.find(x => x.nationalId === inputId);
                        if (emp && (emp.baseRoleId === 'teacher' || emp.constraints.isExternal)) {
                            setActiveView('schedule');
                            setScheduleFilter({ mode: 'teacher', id: emp.id });
                        } else {
                            setActiveView('dashboard');
                        }
                    }
                    return success;
                }} />
            </Suspense>
        );
    }

    // Helper for Bulletin View inside App (Non-Kiosk)
    if (activeView === 'bulletin-board') {
        return (
            <>
                <Suspense fallback={<PageLoader />}>
                    <BulletinBoard
                        key={`bulletin-${substitutionLogs.length}-${absences.length}`}
                        scheduleConfig={data.scheduleConfig}
                        employees={data.employees}
                        classes={data.classes}
                        lessons={lessons}
                        events={data.events}
                        substitutionLogs={substitutionLogs}
                        absences={absences}
                        engineContext={data.engineContext}
                    />
                </Suspense>
                {!isKioskMode && (
                    <button
                        onClick={() => setActiveView('dashboard')}
                        className="fixed bottom-6 left-6 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl transition-all z-50 border-2 border-white/20 group"
                    >
                        ←
                    </button>
                )}
            </>
        );
    }

    return (
        <>
            <MainLayout
                activeView={activeView}
                setActiveView={setActiveView}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                isFlashAlertMode={isFlashAlertMode}
                setIsFlashAlertMode={setIsFlashAlertMode}
                currentUser={auth.currentUser}
                onLogout={auth.logout}
                scheduleConfig={data.scheduleConfig}
                eventAlerts={eventAlerts}
                onLaunchImport={() => setShowImportWizard(true)}
                hasPermission={auth.hasPermission}
            >
                <Suspense fallback={<PageLoader />}>
                    {activeView === 'dashboard' && <Dashboard employees={data.employees} classes={data.classes} scheduleConfig={data.scheduleConfig} onNavigateToSchedule={(m, i) => { setScheduleFilter({ mode: m, id: i }); setActiveView('schedule'); }} onNavigateToView={setActiveView} engineContext={data.engineContext} events={data.events} systemAlerts={eventAlerts} currentUser={auth.currentUser} dutyAssignments={data.dutyAssignments} facilities={data.facilities} breakPeriods={data.breakPeriods} />}

                    {activeView === 'employees' && <Employees onNavigateToSchedule={(m, i) => { setScheduleFilter({ mode: m, id: i }); setActiveView('schedule'); }} />}

                    {activeView === 'schedule' && <Schedule scheduleConfig={data.scheduleConfig} employees={data.employees} classes={data.classes} initialFilter={scheduleFilter} academicYear={data.academicYear} patterns={data.dayPatterns} holidays={data.holidays} overrides={data.overrides} events={data.events} engineContext={data.engineContext} setEngineContext={data.setEngineContext} onToggleMode={toggleMode} />}

                    {activeView === 'substitutions' && <Substitutions employees={data.employees} scheduleConfig={data.scheduleConfig} classes={data.classes} engineContext={data.engineContext} setEngineContext={data.setEngineContext} onToggleMode={toggleMode} onNavigateToView={setActiveView} academicYear={data.academicYear} patterns={data.dayPatterns} holidays={data.holidays} overrides={data.overrides} setOverrides={data.setOverrides} events={data.events} setEvents={data.setEvents} onOpenRequestForm={(pref) => { setPrefilledRequest(pref); if (pref.returnToAbsenceForm) { setShowCalendarRequestOverlay(true); } else { setActiveView('calendar-request'); } }} initialAbsenceStep={workspaceAbsenceStep} onClearInitialStep={() => setWorkspaceAbsenceStep(null)} />}

                    {activeView === 'workspace' && <Workspace
                        employees={data.employees}
                        classes={data.classes}
                        scheduleConfig={data.scheduleConfig}
                        engineContext={data.engineContext}
                        events={data.events}
                        setEvents={data.setEvents}
                        onOpenAbsenceForm={(step) => {
                            setWorkspaceAbsenceStep(step);
                            setActiveView('substitutions');
                        }}
                    />}

                    {activeView === 'calendar' && <CalendarModule
                        currentUser={auth.currentUser}
                        academicYear={data.academicYear}
                        patterns={data.dayPatterns}
                        holidays={data.holidays}
                        overrides={data.overrides}
                        events={data.events}
                        tasks={data.tasks}
                        comments={data.comments}
                        setHolidays={data.setHolidays}
                        setOverrides={data.setOverrides}
                        setEvents={data.setEvents}
                        setTasks={data.setTasks}
                        setComments={data.setComments}
                        onOpenRequestForm={(pref) => { setPrefilledRequest(pref); if (pref.returnToAbsenceForm) { setShowCalendarRequestOverlay(true); } else { setActiveView('calendar-request'); } }}
                        onNavigateToView={setActiveView}
                        engineContext={data.engineContext}
                        scheduleConfig={data.scheduleConfig}
                    />}

                    {activeView === 'partner-portal' && <PartnerPortal employees={data.employees} classes={data.classes} setEvents={data.setEvents} onBack={() => setActiveView('calendar')} currentUser={auth.currentUser} scheduleConfig={data.scheduleConfig} />}

                    {activeView === 'ai-assistant' && <AiAssistant employees={data.employees} classes={data.classes} scheduleConfig={data.scheduleConfig} />}

                    {activeView === 'settings' && <Settings engineContext={data.engineContext} setEngineContext={data.setEngineContext} />}

                    {activeView === 'duty-management' && (
                        <DutyManagement
                            employees={data.employees}
                            setEmployees={data.setEmployees}
                            classes={data.classes}
                            scheduleConfig={data.scheduleConfig}
                            academicYear={data.academicYear}
                            dutyAssignments={data.dutyAssignments}
                            setDutyAssignments={data.setDutyAssignments}
                            facilities={data.facilities}
                            setFacilities={data.setFacilities}
                            breakPeriods={data.breakPeriods}
                            setBreakPeriods={data.setBreakPeriods}
                            notifications={data.dutyNotifications}
                            setNotifications={data.setDutyNotifications}
                            swapRequests={data.dutySwapRequests}
                            setSwapRequests={data.setDutySwapRequests}
                        />
                    )}

                    {activeView === 'duty-reports' && (
                        <DutyReports
                            employees={data.employees}
                            dutyAssignments={data.dutyAssignments}
                            facilities={data.facilities}
                            breakPeriods={data.breakPeriods}
                            lessons={lessons}
                        />
                    )}

                    {activeView === 'reports' && <Reports employees={data.employees} absences={absences} substitutionLogs={substitutionLogs} scheduleConfig={data.scheduleConfig} classes={data.classes} lessons={lessons} comments={data.comments} events={data.events} patterns={data.dayPatterns} academicYear={data.academicYear} engineContext={data.engineContext} setEngineContext={data.setEngineContext} onToggleMode={toggleMode} systemAlerts={eventAlerts} tasks={data.tasks} onNavigateToView={setActiveView} onNavigateToSettings={() => setActiveView('settings')} />}

                    {activeView === 'calendar-request' && (
                        <CalendarRequestForm
                            employees={data.employees}
                            classes={data.classes}
                            setEvents={data.setEvents}
                            onClose={() => { setActiveView('calendar'); setPrefilledRequest(null); setShowCalendarRequestOverlay(false); }}
                            prefill={prefilledRequest}
                            currentUser={auth.currentUser}
                            lessons={lessons}
                            setSubstitutionLogs={setSubstitutionLogs}
                            substitutionLogs={substitutionLogs}
                            engineContext={data.engineContext}
                            scheduleConfig={data.scheduleConfig}
                        />
                    )}

                </Suspense>
            </MainLayout>

            {/* Global Modals */}
            {configuringModeId && (
                <ModeConfigModal
                    modeId={configuringModeId}
                    initialConfig={data.engineContext[configuringModeId]}
                    classes={data.classes}
                    scheduleConfig={data.scheduleConfig}
                    onClose={() => setConfiguringModeId(null)}
                    onSave={(config) => {
                        data.setEngineContext(prev => ({ ...prev, [configuringModeId]: { ...config, isActive: true } }));
                        setConfiguringModeId(null);
                    }}
                />
            )}

            {showImportWizard && (
                <ExcelWizard
                    onClose={() => setShowImportWizard(false)}
                    setEmployees={data.setEmployees}
                    setClasses={data.setClasses}
                    setLessons={setLessons}
                    scheduleConfig={data.scheduleConfig}
                    setScheduleConfig={data.setScheduleConfig}
                    currentEmployees={data.employees}
                    currentClasses={data.classes}
                    currentLessons={lessons}
                />
            )}

            {showCalendarRequestOverlay && (
                <div className="fixed inset-0 z-[101] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <CalendarRequestForm
                            employees={data.employees}
                            classes={data.classes}
                            setEvents={data.setEvents}
                            onClose={() => { setShowCalendarRequestOverlay(false); setPrefilledRequest(null); }}
                            prefill={prefilledRequest}
                            currentUser={auth.currentUser}
                            lessons={lessons}
                            setSubstitutionLogs={setSubstitutionLogs}
                            substitutionLogs={substitutionLogs}
                            engineContext={data.engineContext}
                            scheduleConfig={data.scheduleConfig}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
