
import React from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { SystemAlert } from '../types';

interface ScheduleQualityIndicatorProps {
  alerts: SystemAlert[];
  uncoveredCount?: number; // New prop for daily operational health
  variant?: 'dark' | 'light';
}

const ScheduleQualityIndicator: React.FC<ScheduleQualityIndicatorProps> = ({ alerts, uncoveredCount = 0, variant = 'dark' }) => {
  // Calculate Score
  // 1. Static Schedule Issues
  const errorCount = alerts.filter(a => a.type === 'error').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;
  
  // 2. Daily Operational Issues (Heavy Penalty)
  // Each uncovered lesson drops the score significantly to alert admin immediately
  const operationalPenalty = uncoveredCount * 15; 
  
  const deduction = (errorCount * 10) + (warningCount * 2) + operationalPenalty;
  const score = Math.max(0, 100 - deduction);

  let colorClass = '';
  let bgClass = '';
  let pulseClass = '';
  
  if (uncoveredCount > 0) {
     // Critical State due to operational issues
     colorClass = 'text-rose-600';
     bgClass = variant === 'dark' ? 'bg-rose-500/20 border-rose-500/40' : 'bg-rose-100 border-rose-300';
     pulseClass = 'animate-pulse';
  } else if (score === 100) {
    colorClass = 'text-emerald-500';
    bgClass = variant === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200';
  } else if (score >= 70) {
    colorClass = 'text-amber-500';
    bgClass = variant === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200';
  } else {
    colorClass = 'text-rose-500';
    bgClass = variant === 'dark' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200';
  }

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${bgClass} transition-all ${pulseClass}`}
      title={`جودة النظام: ${score}% 
      ${uncoveredCount > 0 ? `| 🚨 ${uncoveredCount} حصص مكشوفة` : ''} 
      (${errorCount} أخطاء بالجدول, ${warningCount} تنبيهات)`}
    >
      {uncoveredCount > 0 ? (
          <AlertTriangle size={16} className={colorClass} />
      ) : (
          <Activity size={16} className={colorClass} />
      )}
      <span className={`text-xs font-bold font-mono ${colorClass}`}>
        {score}%
      </span>
    </div>
  );
};

export default ScheduleQualityIndicator;
