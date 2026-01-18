// src/components/absence/utils/absenceHelpers.ts

import { DAYS_AR } from '@/constants';

/**
 * Infer partial absence type based on selected periods
 */
export const inferPartialAbsence = (selectedPeriods: number[], maxPeriod: number) => {
    if (!selectedPeriods || selectedPeriods.length === 0) return {};
    
    const P = [...new Set(selectedPeriods)].sort((a, b) => a - b);
    const minP = P[0];
    const maxP = P[P.length - 1];

    let isContiguous = true;
    for (let i = 0; i < P.length - 1; i++) {
        if (P[i + 1] !== P[i] + 1) {
            isContiguous = false;
            break;
        }
    }

    const coversStart = minP === 1;
    const coversEnd = maxP === maxPeriod;

    let type: 'LATE' | 'LEAVE_AND_RETURN' | 'LEAVE_UNTIL_END' = 'LEAVE_AND_RETURN';
    let label = 'غياب جزئي';

    if (!isContiguous) {
        label = 'غياب جزئي متقطع';
    } else {
        if (coversStart && !coversEnd) {
            type = 'LATE';
            label = 'تأخير';
        } else if (!coversStart && coversEnd) {
            type = 'LEAVE_UNTIL_END';
            label = 'مغادرة لنهاية الدوام';
        } else if (!coversStart && !coversEnd) {
            type = 'LEAVE_AND_RETURN';
            label = 'مغادرة مع عودة';
        }
    }

    return {
        partialAbsenceType: type,
        partialAbsenceLabelAr: label,
        partialAbsencePattern: (isContiguous ? 'CONTIGUOUS' : 'NON_CONTIGUOUS') as 'CONTIGUOUS' | 'NON_CONTIGUOUS'
    };
};

/**
 * Get all dates in a range (inclusive)
 */
export const getDatesInRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
        dates.push(new Date(current).toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
};

/**
 * Get day name in Arabic safely (with timezone handling)
 */
export const getSafeDayName = (dateStr: string): string => {
    const d = new Date(dateStr + 'T12:00:00');
    return DAYS_AR[d.getDay()];
};
