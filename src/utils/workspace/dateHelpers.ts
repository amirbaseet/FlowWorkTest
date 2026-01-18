// src/utils/workspace/dateHelpers.ts

import { CalendarEvent, Lesson, ScheduleConfig } from '@/types';
import { DAYS_AR } from '@/constants';
import { normalizeArabic, toLocalISOString } from '@/utils';

/**
 * Check if a given date is a school day
 * @returns Object with isSchool boolean and reason string
 */
export function isSchoolDay(
  date: Date,
  events: CalendarEvent[],
  lessons: Lesson[],
  scheduleConfig: ScheduleConfig
): { isSchool: boolean; reason: string } {
  // Get day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = date.getDay();
  const dayNameFromDate = DAYS_AR[dayOfWeek];
  const dateStr = toLocalISOString(date);

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
  const hasLessonsForDay = lessons.some(l => l.day === dayNameFromDate);

  if (!hasLessonsForDay) {
    return { isSchool: false, reason: 'لا توجد حصص مجدولة لهذا اليوم' };
  }

  return { isSchool: true, reason: '' };
}

/**
 * Get array of working days between start and end dates
 * Excludes holidays configured in scheduleConfig
 */
export function getWorkingDays(
  startDate: Date,
  endDate: Date,
  scheduleConfig: ScheduleConfig
): Date[] {
  const workingDays: Date[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dayName = DAYS_AR[dayOfWeek];
    const normDayName = normalizeArabic(dayName);
    
    // Check if this day is not a holiday
    const isHoliday = scheduleConfig.holidays?.some(h => normalizeArabic(h) === normDayName);
    
    if (!isHoliday) {
      workingDays.push(new Date(currentDate));
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

/**
 * Format date in Arabic locale with full details
 */
export function formatArabicDate(date: Date): string {
  return date.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get safe day name from date (throws error if invalid)
 */
export function getSafeDayName(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dayIndex = dateObj.getDay();
  
  if (dayIndex < 0 || dayIndex > 6) {
    throw new Error(`Invalid day index: ${dayIndex}`);
  }
  
  return DAYS_AR[dayIndex];
}
