// src/components/absence/utils/submitHelpers.ts

import { 
    AbsenceRecord, 
    SubstitutionLog, 
    ScheduleConfig, 
    Employee, 
    Lesson, 
    ClassItem 
} from '@/types';
import { getDatesInRange, getSafeDayName, inferPartialAbsence } from './absenceHelpers';
import { normalizeArabic } from '@/utils';

export interface SelectedTeacherState {
    id: number;
    startDate: string;
    endDate: string;
    type: 'FULL' | 'PARTIAL';
    affectedPeriods: number[];
    reason: string;
}

/**
 * Create absence records from selected teachers
 */
export const createAbsenceRecords = (
    selectedTeachers: SelectedTeacherState[],
    scheduleConfig: ScheduleConfig
): Omit<AbsenceRecord, 'id'>[] => {
    const absencesList: Omit<AbsenceRecord, 'id'>[] = [];
    const periods = Array.from({ length: scheduleConfig.periodsPerDay }, (_, i) => i + 1);
    
    selectedTeachers.forEach(teacherSel => {
        const dates = getDatesInRange(teacherSel.startDate, teacherSel.endDate);
        
        dates.forEach((date: string) => {
            const dayName = getSafeDayName(date);
            
            // Skip holidays
            if (scheduleConfig.holidays.includes(dayName)) {
                return;
            }
            
            const partialInfo = teacherSel.type === 'PARTIAL' 
                ? inferPartialAbsence(teacherSel.affectedPeriods, scheduleConfig.periodsPerDay) 
                : {};
            
            absencesList.push({
                teacherId: teacherSel.id,
                date,
                reason: teacherSel.reason,
                type: teacherSel.type,
                affectedPeriods: teacherSel.type === 'FULL' 
                    ? periods 
                    : teacherSel.affectedPeriods,
                status: 'OPEN',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...partialInfo
            });
        });
    });
    
    return absencesList;
};

/**
 * Create assistant coverage substitutions
 */
export const createAssistantCoverageSubstitutions = (
    assistantCoverage: Record<string, boolean>,
    boardViewDate: string,
    lessons: Lesson[]
): Omit<SubstitutionLog, 'id' | 'timestamp'>[] => {
    const subs: Omit<SubstitutionLog, 'id' | 'timestamp'>[] = [];
    
    Object.entries(assistantCoverage).forEach(([slotKey, isCovered]) => {
        if (isCovered) {
            const [teacherIdStr, periodStr] = slotKey.split('-');
            const teacherId = Number(teacherIdStr);
            const period = Number(periodStr);
            
            const lesson = lessons.find(l => 
                l.teacherId === teacherId && 
                l.period === period
            );
            
            if (lesson) {
                subs.push({
                    date: boardViewDate,
                    period: period,
                    classId: lesson.classId,
                    absentTeacherId: teacherId,
                    substituteId: -1, // Special ID for assistant
                    substituteName: 'مساعد الصف',
                    type: 'assistant_coverage',
                    reason: 'Assistant Coverage',
                    modeContext: 'Lower Grade Coverage',
                    assistantCoverage: {
                        coveredByAssistant: true
                    }
                });
            }
        }
    });
    
    return subs;
};

/**
 * Create class merge substitutions
 */
export const createClassMergeSubstitutions = (
    classMerges: Record<string, any>,
    boardViewDate: string,
    lessons: Lesson[]
): Omit<SubstitutionLog, 'id' | 'timestamp'>[] => {
    const subs: Omit<SubstitutionLog, 'id' | 'timestamp'>[] = [];
    
    Object.entries(classMerges).forEach(([slotKey, mergeInfo]) => {
        const [teacherIdStr, periodStr] = slotKey.split('-');
        const teacherId = Number(teacherIdStr);
        const period = Number(periodStr);
        
        const lesson = lessons.find(l => 
            l.teacherId === teacherId && 
            l.period === period
        );
        
        if (lesson) {
            subs.push({
                date: boardViewDate,
                period: period,
                classId: lesson.classId,
                absentTeacherId: teacherId,
                substituteId: -2, // Special ID for class merge
                substituteName: 'دمج الشعب',
                type: 'class_merge',
                reason: 'Class Merge',
                modeContext: 'Low Attendance Merge',
                classMerge: mergeInfo
            });
        }
    });
    
    return subs;
};

/**
 * Auto-assign classroom assistants for lower grade educators
 */
export const autoAssignClassroomAssistants = (
    selectedTeachers: SelectedTeacherState[],
    employees: Employee[],
    classes: ClassItem[],
    lessons: Lesson[],
    scheduleConfig: ScheduleConfig,
    boardViewDate: string,
    existingSubstitutions: Omit<SubstitutionLog, 'id' | 'timestamp'>[],
    assistantCoverage: Record<string, boolean>,
    classMerges: Record<string, any>,
    addToast: (message: string, type: string) => void
): Omit<SubstitutionLog, 'id' | 'timestamp'>[] => {
    const newSubs: Omit<SubstitutionLog, 'id' | 'timestamp'>[] = [];
    
    selectedTeachers.forEach(teacherSel => {
        const absentEmployee = employees.find(e => e.id === teacherSel.id);
        
        // Check if this teacher is an educator
        if (!absentEmployee?.addons?.educator) {
            return;
        }
        
        const educatorClassId = absentEmployee.addons.educatorClassId;
        
        // Check if this class is in lower grades
        const educatorClass = classes.find(c => c.id === educatorClassId);
        const isLowerGrade = educatorClass &&
            scheduleConfig.structure.lowerStageEnd &&
            (educatorClass.gradeLevel || 0) <= scheduleConfig.structure.lowerStageEnd;
        
        if (!isLowerGrade) {
            return;
        }
        
        // Find the classroom assistant for this class
        const classroomAssistant = employees.find(e =>
            e.baseRoleId === 'assistant' &&
            e.addons?.assistantClassId === educatorClassId
        );
        
        if (!classroomAssistant) {
            addToast(
                `ℹ️ لا توجد مساعدة مخصصة للصف ${educatorClass?.name || educatorClassId}`,
                'info'
            );
            return;
        }
        
        // Get all lessons for this educator in their own class
        const dayName = getSafeDayName(boardViewDate);
        const educatorLessonsInHisClass = lessons.filter(l =>
            l.teacherId === teacherSel.id &&
            l.classId === educatorClassId &&
            normalizeArabic(l.day) === normalizeArabic(dayName)
        );
        
        let assignedCount = 0;
        
        educatorLessonsInHisClass.forEach(lesson => {
            const lessonType = lesson.type?.toLowerCase();
            
            // Skip individual and stay lessons
            if (lessonType === 'individual' ||
                lessonType === 'stay' ||
                lessonType === 'makooth') {
                return;
            }
            
            // Check if not already substituted or covered
            const slotKey = `${teacherSel.id}-${lesson.period}`;
            const alreadySubstituted = existingSubstitutions.some(s =>
                s.absentTeacherId === teacherSel.id &&
                s.period === lesson.period &&
                s.date === boardViewDate
            );
            const alreadyCovered = assistantCoverage[slotKey];
            const alreadyMerged = classMerges[slotKey];
            
            if (!alreadySubstituted && !alreadyCovered && !alreadyMerged) {
                newSubs.push({
                    date: boardViewDate,
                    period: lesson.period,
                    classId: lesson.classId,
                    absentTeacherId: teacherSel.id,
                    substituteId: classroomAssistant.id,
                    substituteName: classroomAssistant.name,
                    type: 'assistant_coverage' as any,
                    reason: 'مساعدة الصف - بديل المربي',
                    modeContext: 'Auto-assigned for lower grade educator'
                });
                assignedCount++;
            }
        });
        
        if (assignedCount > 0) {
            addToast(
                ` تم تعيين ${classroomAssistant.name} (مساعدة الصف) في ${assignedCount} حصة تلقائياً`,
                'success'
            );
        }
    });
    
    return newSubs;
};
