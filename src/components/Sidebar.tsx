
import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Sparkles,
  X,
  School,
  LogOut,
  Settings,
  ShieldAlert,
  FileBarChart2,
  CalendarDays,
  ChevronLeft,
  Share2,
  Tv,
  ExternalLink,
  Database,
  RotateCcw,
  Loader2,
  Briefcase,
  Shield,
  BarChart3
} from 'lucide-react';
import { ViewState, SystemAlert, ScheduleConfig, Employee } from '@/types';
import { PERMISSIONS } from '@/types/permissions';
import NotificationBell from './NotificationBell';
import ScheduleQualityIndicator from './ScheduleQualityIndicator';

interface SidebarProps {
  active: ViewState;
  setActive: (view: ViewState) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  systemAlerts: SystemAlert[];
  scheduleConfig: ScheduleConfig;
  uncoveredCount?: number;
  onLogout?: () => void;
  currentUser?: Employee | null;
  onLaunchImport?: () => void;
  hasPermission: (permission: string) => boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  active,
  setActive,
  open,
  setOpen,
  systemAlerts,
  scheduleConfig,
  uncoveredCount = 0,
  onLogout,
  currentUser,
  onLaunchImport,
  hasPermission
}) => {
  const [isRestarting, setIsRestarting] = useState(false);
  // Keep isAdmin for UI labels, or replace with specific permission later
  const isAdmin = currentUser?.baseRoleId === 'principal' || currentUser?.baseRoleId === 'vice_principal';

  const menuItems: { id: ViewState; label: string; icon: any; color?: string; requiredPermission?: string }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, requiredPermission: PERMISSIONS.DASHBOARD },
    { id: 'bulletin-board', label: 'لوحة الإعلانات', icon: Tv, color: 'text-emerald-400', requiredPermission: PERMISSIONS.DASHBOARD }, // Everyone can see bulletin
    { id: 'employees', label: 'طاقم العمل', icon: Users, requiredPermission: PERMISSIONS.EMPLOYEES },
    { id: 'calendar', label: 'الرزنامة المدرسية', icon: CalendarDays, requiredPermission: PERMISSIONS.DASHBOARD },
    { id: 'schedule', label: 'الجدول الدراسي', icon: Calendar, requiredPermission: PERMISSIONS.SCHEDULE },
    { id: 'substitutions', label: 'الإشغال الذكي', icon: ShieldAlert, requiredPermission: PERMISSIONS.SUBSTITUTIONS },
    { id: 'workspace', label: 'مساحة العمل', icon: Briefcase, color: 'text-cyan-400', requiredPermission: PERMISSIONS.MANAGE_SUBSTITUTIONS },
    { id: 'reports', label: 'التقارير الإدارية', icon: FileBarChart2, requiredPermission: PERMISSIONS.REPORTS },
    { id: 'partner-portal', label: 'بوابة الشركاء', icon: Share2, color: 'text-violet-400', requiredPermission: PERMISSIONS.DASHBOARD },
    { id: 'ai-assistant', label: 'المساعد الذكي', icon: Sparkles, requiredPermission: PERMISSIONS.DASHBOARD },
    { id: 'duty-management', label: 'إدارة المناوبات', icon: Shield, color: 'text-orange-400', requiredPermission: PERMISSIONS.DUTY },
    { id: 'duty-reports', label: 'تقارير المناوبات', icon: BarChart3, color: 'text-purple-400', requiredPermission: PERMISSIONS.DUTY },
    { id: 'settings', label: 'الإعدادات', icon: Settings, requiredPermission: PERMISSIONS.SETTINGS },
  ];

  // Filter items based on permission
  const visibleItems = menuItems.filter(item => !item.requiredPermission || hasPermission(item.requiredPermission));

  const schoolName = scheduleConfig.schoolInfo?.name || "مدرستي";

  const handleSystemRestart = () => {
    setIsRestarting(true);
    setTimeout(() => {
      // Force a full browser reload to reset application state
      // Remove query parameters to return to default view
      try {
        const url = new URL(window.location.href);
        url.search = '';
        window.location.href = url.toString();
      } catch (e) {
        window.location.reload();
      }
    }, 500);
  };

  const userRolesDisplay = useMemo(() => {
    if (!currentUser) return "";

    const roles = [];
    if (currentUser.baseRoleId === 'principal') roles.push('مدير المدرسة');
    else if (currentUser.baseRoleId === 'vice_principal') roles.push('نائب المدير');
    else if (currentUser.constraints?.isExternal) roles.push('موظف خارجي');
    else roles.push('معلم');

    if (currentUser.addons.educator && currentUser.addons.educatorClassId) {
      roles.push(`مربي ${currentUser.addons.educatorClassId}`);
    }

    if (currentUser.addons.coordinators && currentUser.addons.coordinators.length > 0) {
      roles.push(`مركز ${currentUser.addons.coordinators.join('، ')}`);
    }

    return roles.join(' | ');
  }, [currentUser]);

  return (
    <>
      {/* Overlay for all screen sizes */}
      <div
        className={`fixed inset-0 bg-slate-900/50 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar Container - Drawer on all screen sizes */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out flex flex-col h-full
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <School size={18} />
            </div>
            <div>
              <h1 className="font-black text-sm leading-tight truncate w-28">{schoolName}</h1>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                {isAdmin ? 'لوحة الإدارة' : 'بوابة المعلم'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Profile Snippet */}
        {currentUser && (
          <div className="px-5 py-4 bg-slate-800/50 border-b border-slate-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold shrink-0 mt-1">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-white">{currentUser.name}</p>
              <p className="text-[9px] text-indigo-300 font-medium leading-tight mt-1 whitespace-pre-wrap break-words">
                {userRolesDisplay}
              </p>
            </div>
          </div>
        )}

        {/* Indicators */}
        <div className="px-5 py-3 flex gap-2">
          <ScheduleQualityIndicator alerts={systemAlerts} uncoveredCount={uncoveredCount} variant="dark" />
          <NotificationBell alerts={systemAlerts} variant="dark" />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-1">
          {visibleItems.map((item) => (
            <div key={item.id} className="relative group">
              <button
                onClick={() => {
                  setActive(item.id);
                  setOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                  ${active === item.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'
                  }
                `}
              >
                <item.icon size={16} className={`${active === item.id ? 'text-white' : item.color || 'text-slate-500 group-hover:text-white'}`} />
                <span className="flex-1 text-right text-xs">{item.label}</span>
                {active === item.id && <ChevronLeft size={14} />}
              </button>

              {/* Dedicated Launch Button for Bulletin Board */}
              {item.id === 'bulletin-board' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(window.location.pathname + '?view=bulletin&mode=kiosk', '_blank');
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                  title="فتح في شاشة عرض خارجية (وضع Kiosk)"
                >
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          ))}

          {/* New Import Button - Admin Only */}
          {onLaunchImport && isAdmin && (
            <button
              onClick={() => {
                onLaunchImport();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-slate-400 hover:bg-slate-800 hover:text-white font-medium border-t border-slate-800 mt-4 pt-4"
            >
              <Database size={16} className="text-amber-500" />
              <span className="flex-1 text-right text-xs">استيراد بيانات (Excel)</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 space-y-1">
          <button
            type="button"
            onClick={handleSystemRestart}
            disabled={isRestarting}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all font-bold text-xs group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRestarting ? (
              <Loader2 size={16} className="animate-spin text-indigo-400" />
            ) : (
              <RotateCcw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
            )}
            <span>{isRestarting ? 'جاري إعادة التشغيل...' : 'إعادة تشغيل النظام'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            disabled={isRestarting}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all font-bold text-xs"
          >
            <LogOut size={16} />
            <span>تسجيل خروج</span>
          </button>
          <div className="mt-3 text-center pt-2 border-t border-slate-800/50">
            <p className="text-[9px] text-slate-600 font-bold">Class Flow AI v3.4</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
