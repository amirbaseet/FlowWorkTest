
import * as XLSX from 'xlsx';
import { ImportResult, TimetableImportRecord, TeacherImportRecord, LessonType } from '@/types';
import { normalizeArabic } from '@/utils';

const DAYS_MAP: Record<string, string> = {
  'الاحد': 'الأحد', 'الأحد': 'الأحد', 'sun': 'الأحد',
  'الاثنين': 'الاثنين', 'الإثنين': 'الاثنين', 'mon': 'الاثنين',
  'الثلاثاء': 'الثلاثاء', 'tue': 'الثلاثاء',
  'الاربعاء': 'الأربعاء', 'الأربعاء': 'الأربعاء', 'wed': 'الأربعاء',
  'الخميس': 'الخميس', 'thu': 'الخميس',
  'الجمعة': 'الجمعة', 'fri': 'الجمعة',
  'السبت': 'السبت', 'sat': 'السبت'
};

const detectLessonType = (subject: string, teacherName: string): LessonType => {
  const s = normalizeArabic(subject); // Normalized (ة -> ه)
  const t = normalizeArabic(teacherName);

  // 0. DUTY
  if (s.includes('مناوبه') || s.includes('مناوبة')) return 'duty';

  // 1. STAY
  if (s.startsWith('طاقم')) return 'stay';
  if (s.includes('مكوث') || s.includes('اجتماع طاقم')) return 'stay';
  if (s.includes('احتياط') || (s.includes('اجتماع') && !s.includes('اجتماعي')) || s.includes('تنسيق') || s.includes('stay') || s.includes('meeting')) return 'stay';

  // 2. INDIVIDUAL
  // Updated: Check for 'متابعه' (normalized) and 'متابعة'
  if (s.includes('فردي') || s.includes('individual') || s.includes('פרטני') || s.includes('متابعه') || s.includes('متابعة')) return 'individual';
  
  // 3. SUPPORT
  if (s.includes('دعم')) {
      return 'individual';
  }

  // 4. ACTUAL
  return 'actual';
};

export const parseExcelFile = async (file: File): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        const result: ImportResult = {
          teachers: [],
          timetable: [],
          sharedLessons: [],
          errors: [],
          stats: {
            totalRows: 0,
            teachersFound: 0,
            lessonsFound: 0,
            classesDetected: 0
          }
        };

        const teachersMap = new Map<string, TeacherImportRecord>();
        const classesSet = new Set<string>();
        const sharedLessonsQueue: any[] = [];
        let skippedCells = 0;

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          if (rows.length < 2) return;

          let headerRowIdx = -1;
          for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const firstCell = String(rows[i][0] || '').trim();
            if (firstCell.includes('الحصة') || firstCell.includes('period')) {
              headerRowIdx = i;
              break;
            }
          }

          if (headerRowIdx === -1) return;

          const headers = rows[headerRowIdx];
          const dayColIndices: Record<number, string> = {};
          
          headers.forEach((h: any, idx: number) => {
            const headerText = normalizeArabic(String(h || '')).replace(/[^\u0600-\u06FF]/g, '');
            for (const [key, val] of Object.entries(DAYS_MAP)) {
              if (headerText.includes(normalizeArabic(key))) {
                dayColIndices[idx] = val;
                break;
              }
            }
          });

          const className = sheetName.trim();
          classesSet.add(className);

          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const periodRaw = row[0];
            const periodMatch = String(periodRaw).match(/\d+/);
            if (!periodMatch) continue;
            
            const period = parseInt(periodMatch[0]);
            if (isNaN(period)) continue;

            Object.keys(dayColIndices).forEach(colIdxStr => {
              const colIdx = parseInt(colIdxStr);
              const dayName = dayColIndices[colIdx];
              const cellContent = String(row[colIdx] || '').trim();

              if (!cellContent || cellContent === '-') return;

              const lines = cellContent.split(/\r?\n/).map(l => l.trim()).filter(l => l);
              
              if (lines.length >= 4) {
                // SHARED LESSON DETECTED - Store for user review
                sharedLessonsQueue.push({
                  subject1: lines[0],
                  teacher1: lines[1],
                  subject2: lines[2],
                  teacher2: lines[3],
                  day: dayName,
                  period: period,
                  className: className,
                  cellContent: cellContent
                });
              }

              for (let k = 0; k < lines.length; k += 2) {
                if (k + 1 >= lines.length) {
                  // Single line found
                  const text = lines[k];
                  const type = detectLessonType(text, "");
                  
                  // FIX: Allow 'individual' in single lines (e.g. "متابعة")
                  if (type === 'stay' || type === 'duty' || type === 'individual') {
                      const teacherName = className; // Assume Sheet = Teacher
                      
                      if (!teachersMap.has(teacherName)) {
                          teachersMap.set(teacherName, { name: teacherName, subject: "عام" });
                      }

                      result.timetable.push({
                          teacherName,
                          day: dayName,
                          period,
                          className: "", // No class for tasks
                          subject: text,
                          type: type,
                          rawText: cellContent
                      });
                  } else {
                      skippedCells++;
                  }
                  continue; 
                }

                const subject = lines[k];
                const teacherName = lines[k+1];

                if (!teachersMap.has(teacherName)) {
                  teachersMap.set(teacherName, { name: teacherName, subject: subject });
                }

                result.timetable.push({
                  teacherName,
                  day: dayName,
                  period,
                  className,
                  subject,
                  type: detectLessonType(subject, teacherName),
                  rawText: cellContent
                });
              }
            });
          }
        });

        result.teachers = Array.from(teachersMap.values());
        result.sharedLessons = sharedLessonsQueue;
        result.stats.totalRows = result.timetable.length;
        result.stats.teachersFound = teachersMap.size;
        result.stats.lessonsFound = result.timetable.length;
        result.stats.classesDetected = classesSet.size;

        if (skippedCells > 0) {
          // result.errors.push(`تم تجاهل ${skippedCells} أسطر غير مكتملة.`);
        }

        resolve(result);

      } catch (err) {
        console.error(err);
        reject("فشل تحليل ملف Excel.");
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
