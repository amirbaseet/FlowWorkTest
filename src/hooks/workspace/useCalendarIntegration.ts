// src/hooks/workspace/useCalendarIntegration.ts

import { useCallback } from 'react';
import { CalendarEvent, Employee, SubstitutionLog } from '@/types';
import { toLocalISOString } from '@/utils';

export interface UseCalendarIntegrationProps {
  confirmedModes: Array<{ modeId: string; classes: string[]; periods: number[] }>;
  assignments: Record<string, Array<{ teacherId: number; reason: string }>>;
  viewDate: Date;
  employees: Employee[];
  setEvents?: (value: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => void;
  setSubstitutionLogs?: (value: SubstitutionLog[] | ((prev: SubstitutionLog[]) => SubstitutionLog[])) => void;
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSuccess?: () => void;
}

export interface UseCalendarIntegrationReturn {
  handleSaveToCalendar: (title: string, description: string) => void;
  canSaveToCalendar: boolean;
}

/**
 * Calendar integration for saving workspace distributions as events
 * Creates calendar events and substitution logs
 */
export const useCalendarIntegration = ({
  confirmedModes,
  assignments,
  viewDate,
  employees,
  setEvents,
  setSubstitutionLogs,
  addToast,
  onSuccess
}: UseCalendarIntegrationProps): UseCalendarIntegrationReturn => {
  
  const canSaveToCalendar = confirmedModes.length > 0 && Object.keys(assignments).length > 0;

  const handleSaveToCalendar = useCallback((title: string, description: string) => {
    if (!setEvents || !setSubstitutionLogs) {
      addToast('⚠️ لا يمكن الحفظ: الوظائف غير متاحة', 'error');
      return;
    }

    if (confirmedModes.length === 0) {
      addToast('⚠️ لا يوجد أنماط مثبتة', 'warning');
      return;
    }

    if (Object.keys(assignments).length === 0) {
      addToast('⚠️ لا يوجد تكليفات لحفظها', 'warning');
      return;
    }

    const dateStr = toLocalISOString(viewDate);

    // Create calendar event for each confirmed mode
    const newEvents: CalendarEvent[] = confirmedModes.map((template, index) => ({
      id: `event-${Date.now()}-${index}`,
      title: title || `${template.modeId} - توزيع`,
      description: description || `توزيع آلي للنمط ${template.modeId}`,
      date: dateStr,
      eventType: 'ADMIN',
      status: 'CONFIRMED' as const,
      plannerId: 0, // System-generated
      plannerName: 'النظام',
      patternId: 'default',
      appliesTo: {
        grades: [],
        classes: template.classes,
        periods: template.periods
      },
      participants: [],
      linkedMode: template.modeId,
      affectedClasses: template.classes,
      affectedPeriods: template.periods,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Create substitution logs from assignments
    const newLogs: SubstitutionLog[] = [];
    
    Object.entries(assignments).forEach(([key, assignmentList]) => {
      const [classId, periodStr] = key.split('-');
      const period = Number(periodStr);

      assignmentList.forEach(assignment => {
        const substitute = employees.find(e => e.id === assignment.teacherId);
        
        newLogs.push({
          id: `log-${Date.now()}-${key}-${assignment.teacherId}`,
          date: dateStr,
          period,
          classId,
          absentTeacherId: 0, // Will be filled if known
          substituteId: assignment.teacherId,
          substituteName: substitute?.name || 'بديل',
          type: 'assign_internal',
          reason: assignment.reason,
          modeContext: 'workspace_calendar_save',
          timestamp: Date.now()
        });
      });
    });

    // Save events
    setEvents(prev => [...prev, ...newEvents]);
    
    // Save substitution logs
    setSubstitutionLogs(prev => [...prev, ...newLogs]);

    addToast(` تم حفظ ${newEvents.length} فعاليات و ${newLogs.length} تكليفات في الرزنامة`, 'success');

    // Call success callback
    if (onSuccess) {
      onSuccess();
    }
  }, [confirmedModes, assignments, viewDate, employees, setEvents, setSubstitutionLogs, addToast, onSuccess]);

  return {
    handleSaveToCalendar,
    canSaveToCalendar
  };
};
