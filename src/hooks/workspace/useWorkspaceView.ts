// src/hooks/workspace/useWorkspaceView.ts

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Lesson, CalendarEvent, ScheduleConfig } from '@/types';
import { toLocalISOString, normalizeArabic } from '@/utils';
import { DAYS_AR } from '@/constants';

export interface UseWorkspaceViewReturn {
  viewDate: Date;
  selectedDay: string;
  boardViewDate: string;
  viewPhase: 'SELECTION' | 'COVERAGE';
  isSchoolDay: { isSchool: boolean; reason: string };
  todayStr: string;
  availableDays: string[];
  setViewDate: (date: Date) => void;
  setSelectedDay: (day: string) => void;
  setBoardViewDate: (date: string) => void;
  setViewPhase: (phase: 'SELECTION' | 'COVERAGE') => void;
  goToToday: () => void;
  goToNextDay: () => void;
  goToPrevDay: () => void;
}

export interface UseWorkspaceViewProps {
  lessons: Lesson[];
  events: CalendarEvent[];
  scheduleConfig: ScheduleConfig;
}

export const useWorkspaceView = ({
  lessons,
  events,
  scheduleConfig
}: UseWorkspaceViewProps): UseWorkspaceViewReturn => {
  
  // State
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    // Find first day with lessons
    const daysWithLessons = Array.from(new Set(lessons.map(l => l.day)));
    return daysWithLessons[0] || DAYS_AR[new Date().getDay()];
  });
  const [boardViewDate, setBoardViewDate] = useState(toLocalISOString(new Date()));
  const [viewPhase, setViewPhase] = useState<'SELECTION' | 'COVERAGE'>('SELECTION');

  // Computed: Today string (ISO format)
  const todayStr = useMemo(() => toLocalISOString(viewDate), [viewDate]);

  // Computed: Available days with lessons
  const availableDays = useMemo(() => {
    return Array.from(new Set(lessons.map(l => l.day)));
  }, [lessons]);

  // Computed: Check if selected date is a school day
  const isSchoolDay = useMemo(() => {
    const dayOfWeek = viewDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = toLocalISOString(viewDate);
    const dayNameFromDate = DAYS_AR[dayOfWeek];

    // Check 1: Is this day a configured holiday (weekend) in Settings?
    const normDayName = normalizeArabic(dayNameFromDate);
    const isHoliday = scheduleConfig.holidays?.some(h => normalizeArabic(h) === normDayName);

    if (isHoliday) {
      return { isSchool: false, reason: 'عطلة نهاية الأسبوع' };
    }

    // Check 2: Is there a HOLIDAY event on this date?
    const holidayEvent = events.find(ev =>
      ev.date === dateStr &&
      ev.status !== 'CANCELLED' &&
      (ev.eventType === 'ADMIN' || ev.title.includes('عطلة') || ev.title.includes('إجازة'))
    );

    if (holidayEvent) {
      return { isSchool: false, reason: holidayEvent.title };
    }

    // Check 3: Does the selected day exist in lessons?
    const hasLessonsForDay = lessons.some(l => normalizeArabic(l.day) === normDayName);

    if (!hasLessonsForDay) {
      return { isSchool: false, reason: 'لا توجد حصص مجدولة لهذا اليوم' };
    }

    return { isSchool: true, reason: '' };
  }, [viewDate, events, lessons, scheduleConfig.holidays]);

  // Handlers
  const goToToday = useCallback(() => {
    setViewDate(new Date());
  }, []);

  const goToNextDay = useCallback(() => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() + 1);
    setViewDate(newDate);
  }, [viewDate]);

  const goToPrevDay = useCallback(() => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() - 1);
    setViewDate(newDate);
  }, [viewDate]);

  // Sync boardViewDate with viewDate on change
  useEffect(() => {
    setBoardViewDate(toLocalISOString(viewDate));
  }, [viewDate]);

  // Sync selectedDay with viewDate on change
  useEffect(() => {
    const dayOfWeek = viewDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dayNameFromDate = DAYS_AR[dayOfWeek];
    setSelectedDay(dayNameFromDate);
  }, [viewDate]);

  return {
    viewDate,
    selectedDay,
    boardViewDate,
    viewPhase,
    isSchoolDay,
    todayStr,
    availableDays,
    setViewDate,
    setSelectedDay,
    setBoardViewDate,
    setViewPhase,
    goToToday,
    goToNextDay,
    goToPrevDay
  };
};
