
import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { SystemAlert } from '@/types';

interface NotificationBellProps {
  alerts: SystemAlert[];
  variant?: 'dark' | 'light' | 'glass';
}

const NotificationBell: React.FC<NotificationBellProps> = ({ alerts, variant = 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasErrors = alerts.some(a => a.type === 'error');
  const hasWarnings = alerts.some(a => a.type === 'warning');

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all duration-200 ${variant === 'dark'
            ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
            : variant === 'glass'
              ? 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 shadow-lg'
              : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
      >
        <Bell size={22} className={isOpen ? 'animate-pulse' : ''} />

        {alerts.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasErrors ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hasErrors ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute top-full ${variant === 'dark' ? 'right-0 mt-2' : 'right-0 mt-2'} w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-slide-up transform origin-top-right`}>
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-bold text-slate-800">التنبيهات</h3>
              <p className="text-xs text-slate-500">
                {alerts.length > 0 ? `يوجد ${alerts.length} تنبيهات في النظام` : 'لا توجد تنبيهات جديدة'}
              </p>
            </div>
            {alerts.length > 0 && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${hasErrors ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                {hasErrors ? 'حرج' : 'تنبيه'}
              </span>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {alerts.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {alerts.map((alert, idx) => (
                  <div key={idx} className={`p-4 hover:bg-slate-50 transition-colors flex gap-3 ${alert.type === 'error' ? 'bg-rose-50/30' : ''}`}>
                    <div className={`mt-1 flex-shrink-0 ${alert.type === 'error' ? 'text-rose-500' : 'text-amber-500'}`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${alert.type === 'error' ? 'text-rose-700' : 'text-slate-700'}`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {alert.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                <CheckCircle2 size={48} className="mb-2 text-emerald-500 opacity-20" />
                <p className="text-sm font-bold text-emerald-600">النظام سليم</p>
                <p className="text-xs mt-1">لا توجد تعارضات أو مشاكل في الجدول</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
