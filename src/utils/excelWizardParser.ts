
import * as XLSX from 'xlsx';
import { normalizeArabic } from '@/utils';
import { SharedLesson } from '@/types';

// --- Types ---

export interface WizardStats {
  teacherCount: number;
  classCount: number;
  sectionCount: number;
  dayCount: number;
  periodCount: number;
  entryCount: number;
  skippedSheets: number;
  skippedCells: number;
}

export interface WizardTeacher {
  name: string;
  role: 'homeroom' | 'non-homeroom' | 'external-sub';
  birthDateISO?: string;
  nationalId?: string;
  phoneNumber?: string;
  jobType: 'full' | 'partial';
  isMother: boolean;
  declaredWeeklyTotal?: number;
  computed: {
    actual: number;
    individual: number;
    stay: number;
    total: number;
  };
  detectedSubjects: string[];
  flags: string[];
  isFromTeacherMatrix?: boolean;
  diagnostics?: {
      idSource: 'sheetName' | 'topSample' | 'limitedScan' | 'notFound';
      duplicatesCount: number;
      mergedSheetsCount: number;
  };
}

export interface WizardClass {
  key: string;
  displayName: string;
  homeroomTeacherName?: string | null;
  flags: string[];
}

export interface WizardEntry {
  classKey: string;
  day: string;
  period: number;
  subject: string;
  teacherName: string;
  lessonType: 'ACTUAL' | 'STAY' | 'INDIVIDUAL' | 'DUTY';
  rawCell: string;
  teacherRole?: 'primary' | 'secondary';
}

export interface WizardPayload {
  source: string;
  importedAtISO: string;
  schoolStats: WizardStats;
  teachers: WizardTeacher[];
  classes: WizardClass[];
  entries: WizardEntry[];
  sharedLessons: SharedLesson[]; // To match SharedLesson[] but keep it flexible here
  globalFlags: string[];
  errors: { sheetErrors: string[]; cellErrors: string[]; warnings: string[] };
}

// --- Constants ---

const CANONICAL_DAYS_MAP: Record<string, string> = {
  "الاحد": "الأحد", "الأحد": "الأحد", "sun": "الأحد",
  "الاثنين": "الاثنين", "الإثنين": "الاثنين", "mon": "الاثنين",
  "الثلاثاء": "الثلاثاء", "tue": "الثلاثاء",
  "الاربعاء": "الأربعاء", "الأربعاء": "الأربعاء", "wed": "الأربعاء",
  "الخميس": "الخميس", "thu": "الخميس",
  "الجمعة": "الجمعة", "fri": "الجمعة",
  "السبت": "السبت", "sat": "السبت"
};

const NORMALIZE = (str: string) => str ? normalizeArabic(str.trim()) : '';

// --- Helpers ---

// Robust ID Token Finder (5-9 digits)
const findIdToken = (text: string): string | null => {
    if (!text) return null;
    const norm = text.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    // Find numeric sequences of length 5 to 9
    const allNumbers = norm.match(/\d+/g);
    if (!allNumbers) return null;
    const valid = allNumbers.find(n => n.length >= 5 && n.length <= 9);
    return valid ? valid.padStart(9, '0') : null;
};

// Strict Name Normalization for Keying
const strictNormalizeName = (raw: string): string => {
    let s = raw.trim();
    s = s.replace(/^(أ\.|د\.|الاستاذ|الأستاذ|المعلمة|المعلم)\s+/g, '');
    s = s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
};

// Robust ID Extraction
const extractNationalId = (sheetName: string, rows: any[][]): { id: string | undefined, source: 'sheetName' | 'topSample' | 'limitedScan' | 'notFound' } => {
    // 1. Sheet Name
    const sheetId = findIdToken(sheetName);
    if (sheetId) return { id: sheetId, source: 'sheetName' };

    // 2. Grid Sample (Top 12 rows, 6 cols)
    for (let r = 0; r < Math.min(rows.length, 12); r++) {
        for (let c = 0; c < Math.min(rows[r].length, 6); c++) {
            const val = String(rows[r][c] || '');
            const tid = findIdToken(val);
            if (tid) return { id: tid, source: 'topSample' };
        }
    }

    // 3. Limited Full Scan
    for (let r = 0; r < Math.min(rows.length, 60); r++) {
        for (let c = 0; c < Math.min(rows[r].length, 20); c++) {
             const val = String(rows[r][c] || '');
             const tid = findIdToken(val);
             if (tid) return { id: tid, source: 'limitedScan' };
        }
    }
    
    return { id: undefined, source: 'notFound' };
};

// STRICT MODE: Used ONLY for Teacher Timetable File
const detectTeacherCellType = (subjectRaw: string): 'ACTUAL' | 'STAY' | 'INDIVIDUAL' | 'DUTY' => {
    const s = normalizeArabic(subjectRaw); 
    
    // 0. DUTY
    if (s.includes('مناوبة') || s.includes('مناوبه')) return 'DUTY';

    // 1. STAY (Absolute Priority)
    if (s.match(/مكوث|طاقم|احتياط|تنسيق/)) return 'STAY';
    
    // Check for Meeting but EXCLUDE 'social' (اجتماعي/اجتماعيات)
    if (s.includes('اجتماع') && !s.includes('اجتماعي')) return 'STAY';
    
    if (s.includes('stay') || s.includes('meeting')) return 'STAY';

    // 2. INDIVIDUAL
    // Must be explicit "Individual" mention or "Follow-up" (متابعة)
    if (s.includes('فردي') || s.includes('individual') || s.includes('פרטני') || s.includes('متابعة') || s.includes('متابعه')) return 'INDIVIDUAL';
    
    // Note: "دعم" (Support) defaults to ACTUAL for Internal teachers unless 'Individual' is explicitly stated.
    // This allows "Support" to be treated as a teaching load if it's not individual.

    // 3. ACTUAL (Default)
    return 'ACTUAL';
};

// LEGACY MODE: Used for Class Schedule ONLY if Teacher File is missing
const detectLessonTypeLegacy = (subjectRaw: string, isExternal: boolean): 'ACTUAL' | 'STAY' | 'INDIVIDUAL' | 'DUTY' => {
    const s = normalizeArabic(subjectRaw); 
    
    if (s.includes('مناوبة') || s.includes('مناوبه')) return 'DUTY';

    // 1. STAY
    if (s.startsWith('طاقم') || s.includes('مكوث') || s.includes('اجتماع طاقم')) return 'STAY';
    if (s.includes('احتياط') || (s.includes('اجتماع') && !s.includes('اجتماعي')) || s.includes('تنسيق')) return 'STAY';

    // 2. INDIVIDUAL
    // Updated: Added 'متابعة' (with normaliztion check)
    if (s.includes('فردي') || s.includes('individual') || s.includes('פרטני') || s.includes('متابعة') || s.includes('متابعه')) return 'INDIVIDUAL';
    
    // 3. SUPPORT -> INDIVIDUAL (Legacy behavior)
    if (s.includes('دعم') || s.includes('support')) return 'INDIVIDUAL';

    return 'ACTUAL';
};

const readWorkbook = (file: File): Promise<XLSX.WorkBook> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        resolve(workbook);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

// --- Main Parser ---

export const parseSchoolData = async (teachersFile: File | null, scheduleFile: File): Promise<WizardPayload> => {
  try {
    const payload: WizardPayload = {
      source: scheduleFile.name + (teachersFile ? ` + ${teachersFile.name}` : ''),
      importedAtISO: new Date().toISOString(),
      schoolStats: { teacherCount: 0, classCount: 0, sectionCount: 0, dayCount: 0, periodCount: 0, entryCount: 0, skippedSheets: 0, skippedCells: 0 },
      teachers: [],
      classes: [],
      entries: [],
      sharedLessons: [],
      globalFlags: [],
      errors: { sheetErrors: [], cellErrors: [], warnings: [] }
    };

    // Extended Teacher Map with deduplication sets
    const teacherMap = new Map<string, WizardTeacher & { dedupSet: Set<string>, processedSlots: Set<string> }>();
    const processedClasses = new Set<string>();

    // AUTHORITATIVE TEACHER SLOT MAP
    // Key: `strictNormalizeName(TeacherName)|Day|Period`
    // Value: Type and Original Text
    const teacherSlotMap = new Map<string, { type: 'ACTUAL'|'STAY'|'INDIVIDUAL'|'DUTY', raw: string, teacherName: string }>();
    const getSlotKey = (name: string, day: string, p: number) => `${strictNormalizeName(name)}|${day}|${p}`;

    // 1. Parse Teachers File (HR Data OR Matrix Format)
    if (teachersFile) {
        const wbTeachers = await readWorkbook(teachersFile);
        
        // Detect Format: List vs Matrix
        let isListFormat = false;
        const firstSheet = wbTeachers.Sheets[wbTeachers.SheetNames[0]];
        const firstRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        
        for (let i = 0; i < Math.min(firstRows.length, 20); i++) {
            const rowStr = firstRows[i].join(' ').toLowerCase();
            if ((rowStr.includes('اسم') && rowStr.includes('المعلم')) || rowStr.includes('teacher name')) {
                isListFormat = true;
                break;
            }
        }

        if (isListFormat) {
            // ... (Keep existing List Format logic minimal - mainly for HR data)
            // Note: List format usually doesn't have schedule, just HR info.
            const sheetName = wbTeachers.SheetNames.find(n => n.toLowerCase().includes('teachers') || n.includes('المعلمين') || n.includes('الطاقم')) || wbTeachers.SheetNames[0];
            const sheet = wbTeachers.Sheets[sheetName];
            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            if (rows.length > 0) {
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(rows.length, 20); i++) {
                    const rowStr = rows[i].join(' ').toLowerCase();
                    if (rowStr.includes('name') || rowStr.includes('اسم') || rowStr.includes('المعلم')) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx !== -1) {
                    const headerRow = rows[headerRowIdx];
                    const idxName = headerRow.findIndex((c: any) => String(c).includes('اسم') || String(c).toLowerCase().includes('name'));
                    const idxID = headerRow.findIndex((c: any) => String(c).includes('هوية') || String(c).includes('ID') || String(c).includes('سجل'));
                    const idxPhone = headerRow.findIndex((c: any) => String(c).includes('هاتف') || String(c).includes('جوال') || String(c).includes('phone'));
                    const idxRole = headerRow.findIndex((c: any) => String(c).includes('دور') || String(c).includes('وظيفة') || String(c).includes('role'));
                    const idxLoad = headerRow.findIndex((c: any) => String(c).includes('حصص') || String(c).includes('hours'));

                    if (idxName !== -1) {
                        for (let i = headerRowIdx + 1; i < rows.length; i++) {
                            const row = rows[i];
                            const rawName = String(row[idxName] || '').trim();
                            const nameKey = strictNormalizeName(rawName);
                            if (!nameKey || nameKey.length < 2) continue;

                            const nationalId = idxID !== -1 ? String(row[idxID] || '').replace(/\D/g, '') : undefined;
                            const phoneNumber = idxPhone !== -1 ? String(row[idxPhone] || '').trim() : undefined;
                            const roleRaw = idxRole !== -1 ? NORMALIZE(String(row[idxRole] || '')) : '';
                            const loadRaw = idxLoad !== -1 ? parseInt(row[idxLoad]) : undefined;

                            // Store HR data, key with prefix
                            teacherMap.set(`name:${nameKey}`, {
                                name: rawName,
                                role: roleRaw.includes('مربي') ? 'homeroom' : roleRaw.includes('خارجي') ? 'external-sub' : 'non-homeroom',
                                jobType: 'full',
                                isMother: false,
                                nationalId,
                                phoneNumber,
                                declaredWeeklyTotal: isNaN(loadRaw!) ? undefined : loadRaw,
                                computed: { actual: 0, individual: 0, stay: 0, total: 0 },
                                detectedSubjects: [],
                                flags: ['IMPORTED_FROM_HR_LIST'],
                                isFromTeacherMatrix: false,
                                dedupSet: new Set(),
                                processedSlots: new Set(),
                                diagnostics: { idSource: 'notFound', duplicatesCount: 0, mergedSheetsCount: 0 }
                            });
                        }
                    }
                }
            }
        } else {
            // --- ROBUST TEACHER MATRIX PARSING ---
            wbTeachers.SheetNames.forEach(sheetName => {
                const sheet = wbTeachers.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                
                // 1. Find Header "الحصة" or fallback
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(rows.length, 40); i++) {
                    const cell0 = String(rows[i][0] || '').trim();
                    if (cell0 === 'الحصة') {
                        headerRowIdx = i;
                        break;
                    }
                }
                
                // Fallback Header Detection (look for Days in row)
                if (headerRowIdx === -1) {
                    for (let i = 0; i < Math.min(rows.length, 30); i++) {
                        const rowStr = rows[i].join(' ');
                        const hasDays = rows[i].some(c => Object.keys(CANONICAL_DAYS_MAP).some(d => String(c).includes(d)));
                        if (hasDays) {
                            headerRowIdx = i;
                            break;
                        }
                    }
                }

                if (headerRowIdx === -1) {
                    payload.schoolStats.skippedSheets++;
                    return; 
                }

                // 2. Extract Identity
                const { id: extractedId, source: idSource } = extractNationalId(sheetName, rows);
                
                // Name Extraction
                let rawName = sheetName;
                if (extractedId) {
                    const idPattern = new RegExp(extractedId.replace(/^0+/, ''));
                    rawName = rawName.replace(idPattern, '');
                }
                rawName = rawName.replace(/\(\d+\)/g, '').replace(/\d+/g, '').replace(/[-_]/g, ' ').trim(); 
                
                // Prefer A1 cell for Name if valid
                const a1 = String(rows[0][0] || '').trim();
                if (a1 && a1 !== 'الحصة' && a1.length > 2 && !a1.match(/^\d+$/)) {
                    rawName = a1;
                }

                // 3. Generate Teacher Key
                let teacherKey = '';
                if (extractedId) {
                    teacherKey = `id:${extractedId}`;
                } else {
                    teacherKey = `name:${strictNormalizeName(rawName)}`;
                }

                // 4. Init or Merge Teacher
                let teacher = teacherMap.get(teacherKey);
                if (!teacher) {
                    const isExternal = rawName.includes('مرشد') || rawName.includes('خارجي') || rawName.includes('مرافِق');
                    
                    teacher = {
                        name: rawName,
                        role: isExternal ? 'external-sub' : 'non-homeroom',
                        jobType: 'full',
                        isMother: false,
                        nationalId: extractedId,
                        computed: { actual: 0, individual: 0, stay: 0, total: 0 },
                        detectedSubjects: [],
                        flags: ['IMPORTED_FROM_TEACHER_MATRIX'],
                        isFromTeacherMatrix: true,
                        dedupSet: new Set(),
                        processedSlots: new Set(),
                        diagnostics: { 
                            idSource: idSource, 
                            duplicatesCount: 0, 
                            mergedSheetsCount: 1 
                        }
                    };
                } else {
                    teacher.diagnostics!.mergedSheetsCount++;
                    if (extractedId && !teacher.nationalId) {
                        teacher.nationalId = extractedId;
                        teacher.diagnostics!.idSource = idSource;
                    }
                }

                // 5. Process Schedule Grid (Build Authoritative Slot Map)
                const dayMap: Record<number, string> = {};
                const headerRow = rows[headerRowIdx];
                headerRow.forEach((cell: any, idx: number) => {
                    const val = NORMALIZE(String(cell));
                    for (const [key, canonical] of Object.entries(CANONICAL_DAYS_MAP)) {
                        if (val.includes(NORMALIZE(key))) {
                            dayMap[idx] = canonical;
                            break;
                        }
                    }
                });

                for (let r = headerRowIdx + 1; r < rows.length; r++) {
                    const row = rows[r];
                    const period = parseInt(String(row[0]));
                    if (isNaN(period)) continue;

                    Object.keys(dayMap).forEach(colIdxStr => {
                        const colIdx = parseInt(colIdxStr);
                        const day = dayMap[colIdx];
                        const cellContent = String(row[colIdx] || '').trim();
                        if (!cellContent || cellContent === '-' || cellContent === '.') return;

                        const lines = cellContent.split(/\r?\n/).map(l => l.trim()).filter(l => l);
                        if (lines.length === 0) return;

                        const subject = lines[0];
                        
                        // STRICT CLASSIFICATION FOR TEACHER SLOT MAP
                        const strictType = detectTeacherCellType(subject);
                        const slotKey = getSlotKey(teacher!.name, day, period);
                        
                        // Store in Authoritative Map
                        if (!teacherSlotMap.has(slotKey)) {
                            teacherSlotMap.set(slotKey, { type: strictType, raw: subject, teacherName: teacher!.name });
                        }

                        // Capture Subjects
                        if (strictType === 'ACTUAL' && subject.length > 2 && !teacher!.detectedSubjects.includes(subject)) {
                            teacher!.detectedSubjects.push(subject);
                        }
                    });
                }
                teacherMap.set(teacherKey, teacher!);
            });
        }
    }

    // 2. Parse Schedule File (Timetable)
    const wbSchedule = await readWorkbook(scheduleFile);
    const hasTeachersFile = !!teachersFile;

    const isKnownTeacher = (raw: string) => {
        const key = strictNormalizeName(raw);
        if (!key) return false;
        // Check against known names in map (loosely)
        for (let t of teacherMap.values()) {
            if (strictNormalizeName(t.name) === key) return true;
        }
        return false;
    };

    wbSchedule.SheetNames.forEach(sheetName => {
        const sheet = wbSchedule.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const cellVal = String(rows[i][0] || '').trim();
            if (cellVal === 'الحصة' || cellVal.toLowerCase().includes('period') || cellVal.includes('رقم الحصة')) {
                headerRowIdx = i;
                break;
            }
        }

        if (headerRowIdx === -1) {
            if (rows.length > 5) payload.schoolStats.skippedSheets++;
            return;
        }

        const headerRow = rows[headerRowIdx];
        const dayMap: Record<number, string> = {}; 
        
        headerRow.forEach((cell: any, idx: number) => {
            const val = NORMALIZE(String(cell));
            for (const [key, canonical] of Object.entries(CANONICAL_DAYS_MAP)) {
                if (val.includes(NORMALIZE(key))) {
                    dayMap[idx] = canonical;
                    break;
                }
            }
        });

        if (Object.keys(dayMap).length === 0) return;

        const className = sheetName.trim(); 
        const sheetIsKnownTeacher = isKnownTeacher(className);

        processedClasses.add(className);
        if (!sheetIsKnownTeacher) {
            payload.classes.push({ key: className, displayName: className, flags: [] });
        }

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            const periodMatch = String(row[0] || '').match(/\d+/);
            if (!periodMatch) continue;
            
            const period = parseInt(periodMatch[0]);

            Object.keys(dayMap).forEach(colIdxStr => {
                const colIdx = parseInt(colIdxStr);
                const day = dayMap[colIdx];
                const cellContent = String(row[colIdx] || '').trim();
                
                if (!cellContent || cellContent === '-' || cellContent === '.') return;

                const lines = cellContent.split(/\r?\n/).map(l => l.trim()).filter(l => l);
                if (lines.length === 0) return;

                if (lines.length >= 4) {
                    payload.sharedLessons.push({
                        subject1: lines[0],
                        teacher1: lines[1],
                        subject2: lines[2],
                        teacher2: lines[3],
                        day,
                        period,
                        className,
                        cellContent
                    });
                }

                const addLessonEntry = (subject: string, teacherNameRaw: string) => {
                    let teacherKey = `name:${strictNormalizeName(teacherNameRaw)}`;
                    let teacherObj = teacherMap.get(teacherKey);
                    
                    const isExternal = teacherNameRaw.includes('خارجي') || teacherObj?.role === 'external-sub';
                    
                    // INITIAL TYPE DETERMINATION
                    // If we have an authoritative teacher file, default to ACTUAL to prevent false positives from class schedule wording.
                    // If no teacher file, fall back to legacy detection.
                    let lessonType: 'ACTUAL' | 'STAY' | 'INDIVIDUAL' | 'DUTY' = hasTeachersFile ? 'ACTUAL' : detectLessonTypeLegacy(subject, isExternal);

                    let entryClassKey = className;
                    
                    if ((lessonType === 'STAY' || lessonType === 'DUTY') && teacherNameRaw === 'غير محدد' && sheetIsKnownTeacher) {
                        teacherNameRaw = className; 
                        entryClassKey = 'NO_CLASS'; 
                        teacherKey = `name:${strictNormalizeName(teacherNameRaw)}`;
                        teacherObj = teacherMap.get(teacherKey);
                    } else if (lessonType === 'STAY' || lessonType === 'DUTY') {
                        entryClassKey = 'NO_CLASS';
                    }

                    payload.entries.push({
                        classKey: entryClassKey,
                        day,
                        period,
                        subject,
                        teacherName: teacherNameRaw,
                        lessonType,
                        rawCell: cellContent
                    });

                    // Create placeholder teacher if needed
                    if (!teacherObj && teacherNameRaw !== 'غير محدد') {
                        const inferredRole = isExternal ? 'external-sub' : 'non-homeroom';
                        teacherMap.set(teacherKey, {
                            name: teacherNameRaw,
                            role: inferredRole,
                            jobType: 'full',
                            isMother: false,
                            computed: { actual: 0, individual: 0, stay: 0, total: 0 },
                            detectedSubjects: [],
                            flags: ['AUTO_GENERATED_FROM_SCHEDULE'],
                            isFromTeacherMatrix: false,
                            dedupSet: new Set(),
                            processedSlots: new Set(),
                            diagnostics: { idSource: 'notFound', duplicatesCount: 0, mergedSheetsCount: 0 }
                        });
                    }
                };

                // Parsing Lines logic (Same as before)
                if (lines.length === 1) {
                    addLessonEntry(lines[0], "غير محدد");
                } else if (lines.length % 2 === 0) {
                    for (let k = 0; k < lines.length; k += 2) {
                        addLessonEntry(lines[k], lines[k+1]);
                    }
                } else {
                    let currentSubject = lines[0];
                    for (let k = 1; k < lines.length; k++) {
                        const item = lines[k];
                        const nextItem = lines[k+1]; 
                        const itemIsTeacher = isKnownTeacher(item);
                        
                        if (itemIsTeacher) {
                            addLessonEntry(currentSubject, item);
                        } else if (nextItem && isKnownTeacher(nextItem)) {
                            currentSubject = item; 
                        } else if (!itemIsTeacher && k > 0 && lines.length === 3 && k===1) {
                            addLessonEntry(currentSubject, item); 
                        }
                    }
                }
            });
        }
    });

    // --- 3. RECONCILIATION & STATS CALCULATION ---
    
    // Reset all teacher stats before recalculation based on reconciled entries
    teacherMap.forEach(t => {
        t.computed = { actual: 0, individual: 0, stay: 0, total: 0 };
        t.processedSlots = new Set();
    });

    const reconciledSlots = new Set<string>();

    // Pass A: Reconcile Class Schedule Entries
    payload.entries.forEach(entry => {
        const slotKey = getSlotKey(entry.teacherName, entry.day, entry.period);
        reconciledSlots.add(slotKey);

        if (hasTeachersFile) {
            const authoritative = teacherSlotMap.get(slotKey);
            if (authoritative) {
                // FORCE overwrite with teacher's authoritative type
                entry.lessonType = authoritative.type;
            }
        }

        // Update Stats
        const teacherKey = `name:${strictNormalizeName(entry.teacherName)}`;
        const teacher = teacherMap.get(teacherKey);
        if (teacher) {
            // Count unique slots only
            if (!teacher.processedSlots.has(slotKey)) {
                teacher.processedSlots.add(slotKey);
                if (entry.lessonType === 'ACTUAL') teacher.computed.actual++;
                else if (entry.lessonType === 'INDIVIDUAL') teacher.computed.individual++;
                else if (entry.lessonType === 'STAY') teacher.computed.stay++;
                
                // EXCLUDE DUTY FROM TOTAL LOAD
                if (entry.lessonType !== 'DUTY') {
                    teacher.computed.total++;
                }
            }
        }
    });

    // Pass B: Inject Missing Teacher-Only Entries (STAY/INDIVIDUAL/MEETINGS)
    if (hasTeachersFile) {
        teacherSlotMap.forEach((val, key) => {
            if (!reconciledSlots.has(key) && val.type !== 'ACTUAL') {
                const [_, day, pStr] = key.split('|');
                const period = parseInt(pStr);
                
                // Add to payload
                payload.entries.push({
                    classKey: 'NO_CLASS',
                    day,
                    period,
                    subject: val.raw,
                    teacherName: val.teacherName,
                    lessonType: val.type,
                    rawCell: val.raw
                });

                // Update Stats
                const teacherKey = `name:${strictNormalizeName(val.teacherName)}`;
                const teacher = teacherMap.get(teacherKey);
                if (teacher) {
                    if (!teacher.processedSlots.has(key)) {
                        teacher.processedSlots.add(key);
                        if (val.type === 'INDIVIDUAL') teacher.computed.individual++;
                        else if (val.type === 'STAY') teacher.computed.stay++;
                        
                        // EXCLUDE DUTY FROM TOTAL LOAD
                        if (val.type !== 'DUTY') {
                            teacher.computed.total++;
                        }
                    }
                }
            }
        });
    }

    // 4. Homeroom Detection (Smart Keyword Based)
    payload.classes.forEach(cls => {
        // Broaden the search for Homeroom-indicating subjects
        const homeroomKeywords = ['مهارات', 'تربية', 'حياة', 'توجيه', 'مربي', 'life', 'homeroom', 'skills', 'فعاليات', 'تواصل'];
        
        const homeroomEntries = payload.entries.filter(e => {
            const subj = normalizeArabic(e.subject);
            return e.classKey === cls.key && homeroomKeywords.some(k => subj.includes(k));
        });

        if (homeroomEntries.length > 0) {
            const candidates: Record<string, number> = {};
            
            // Count frequency of teachers teaching these specific lessons to this class
            homeroomEntries.forEach(e => { 
                if(e.teacherName !== 'غير محدد') {
                    candidates[e.teacherName] = (candidates[e.teacherName] || 0) + 1; 
                }
            });
            
            // The teacher with the most "Homeroom" lessons for this class is likely the Homeroom Teacher
            const winnerName = Object.keys(candidates).sort((a, b) => candidates[b] - candidates[a])[0];
            
            if (winnerName) {
                cls.homeroomTeacherName = winnerName;
                const teacherKey = `name:${strictNormalizeName(winnerName)}`;
                const teacher = teacherMap.get(teacherKey);
                if (teacher) {
                    teacher.role = 'homeroom';
                    // Optional: Add a flag indicating how it was detected
                    teacher.flags.push('AUTO_DETECTED_HOMEROOM');
                }
            }
        } else {
            cls.homeroomTeacherName = null;
        }
    });

    // Finalize
    payload.teachers = Array.from(teacherMap.values()).map(t => t);
    payload.schoolStats.teacherCount = payload.teachers.length;
    payload.schoolStats.classCount = payload.classes.length;
    payload.schoolStats.entryCount = payload.entries.length;
    payload.schoolStats.periodCount = new Set(payload.entries.map(e => e.period)).size;

    return payload;

  } catch (err) {
    console.error(err);
    throw new Error("فشل في قراءة ملفات Excel. يرجى التأكد من الصيغة.");
  }
};
