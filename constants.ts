
import { Employee, ClassItem, Lesson, ScheduleConfig, Role, AbsenceRecord, EngineContext, ModeConfig, AcademicYear, DayPattern, DashboardLayout, GoldenRule, PolicyRule, PriorityStep } from './types';

export const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const GRADES_AR = [
  "طبقة أول", "طبقة ثاني", "طبقة ثالث", "طبقة رابع", "طبقة خامس", "طبقة سادس", // Primary
  "طبقة سابع", "طبقة ثامن", "طبقة تاسع", // Middle
  "طبقة عاشر", "طبقة حادي عشر", "طبقة ثاني عشر" // High
];

export const SUBJECT_PRIORITY_FOR_INDIVIDUAL = [
  "لغة عربية", "رياضيات", "لغة إنجليزية", "علوم", "لغة عبرية", "تربية إسلامية", "تربية اجتماعية", "فنون", "رياضة"
];

export const COORDINATOR_TYPES = [
  { id: 'subject', label: 'مركز موضوع' },
  { id: 'social', label: 'مركز تربية اجتماعية' },
  { id: 'layer', label: 'مركز طبقة' },
  { id: 'ict', label: 'مركز حوسبة' },
  { id: 'evaluation', label: 'مركز تقييم وقياس' },
];

export const INITIAL_ACADEMIC_YEAR: AcademicYear = {
  id: "AY2025",
  name: "2025-2026",
  timezone: "Asia/Jerusalem",
  startDate: "2025-09-01",
  endDate: "2026-06-30",
  defaultWeekdays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "السبت"]
};

export const INITIAL_DAY_PATTERNS: DayPattern[] = [
  {
    id: "PATTERN_REGULAR",
    name: "REGULAR",
    periods: [
      { period: 1, start: "08:00", end: "08:45" },
      { period: 2, start: "08:45", end: "09:30" },
      { period: 2, break: true, name: "استراحة", start: "09:30", end: "09:50" },
      { period: 3, start: "09:50", end: "10:35" },
      { period: 4, start: "10:35", end: "11:20" },
      { period: 4, break: true, name: "استراحة", start: "11:20", end: "11:40" },
      { period: 5, start: "11:40", end: "12:25" },
      { period: 6, start: "12:25", end: "13:10" },
      { period: 7, start: "13:10", end: "13:55" }
    ]
  }
];

export const INITIAL_ROLES: Role[] = [
  { id: "principal", label: "مدير مدرسة", defaultHours: 40, permissions: ["view_all", "edit_absences", "manage_staff", "override_engine", "system_admin"], workloadDetails: { actual: 4, individual: 0, stay: 36 } },
  { id: "vice_principal", label: "نائب مدير", defaultHours: 38, permissions: ["view_all", "edit_absences", "manage_staff", "override_engine"], workloadDetails: { actual: 8, individual: 2, stay: 28 } },
  { id: "teachers", label: "معلم", defaultHours: 36, permissions: ["view_all"], workloadDetails: { actual: 26, individual: 5, stay: 5 } },
  { id: "counselor", label: "مستشار تربوي", defaultHours: 30, permissions: ["view_all"], workloadDetails: { actual: 4, individual: 26, stay: 0 } },
];

// --- CLEAN SLATE DATA ---
export const INITIAL_CLASSES: ClassItem[] = [];
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_LESSONS: Lesson[] = [];

export const INITIAL_SCHEDULE_CONFIG: ScheduleConfig = {
  schoolInfo: { name: "مدرسة المستقبل النموذجية" },
  weekStartDay: "الاثنين",
  schoolStartTime: "08:00",
  periodDuration: 45,
  customPeriodDurations: { 1: 50, 2: 45, 3: 45, 4: 45, 5: 45, 6: 45, 7: 45 },
  periodsPerDay: 7,
  holidays: ["الجمعة", "الأحد"], 
  breakPositions: { 2: 'main', 4: 'transit' },
  breakTypes: { 2: 'long', 4: 'short' },
  breakDurations: { 2: 20, 4: 10 },
  structure: {
    activeStages: ['primary'],
    generalCounts: [4, 4, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0],
    specialCounts: [1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    lowerStageEnd: 2,
    namingConvention: 'alpha',
    mergeSpecialNaming: false
  },
  absenceReasons: ["مرضي", "مهمة", "تأخر", "إذن شخصي", "دورة تدريبية"]
};

export const INITIAL_ABSENCES: AbsenceRecord[] = [];

// --- THE CONSTITUTION (GOLDEN RULES) ---

// 1. STANDARD RULE (To be injected in all modes)
export const STANDARD_STAY_RULE: GoldenRule = {
    id: 'GR-NO-STAY-COVER', 
    label: 'منع استغلال حصة المكوث',
    isActive: true,
    compliancePercentage: 100, // Default Strict
    enforcementLevel: 'STRICT',
    isGlobal: true, 
    auditRequired: true,
    systemCritical: true, 
    description: 'يُمنع منعًا باتًا تكليف أي معلم (مربي أو غير مربي) بتغطية حصص دراسية باستخدام حصة المكوث، لما لذلك من أثر تربوي وتنظيمي سلبي. الاستثناء الوحيد: توفر حصة فردي ومكوث نفس اليوم (يسمح بالتبديل فقط).',
    action: { type: 'BLOCK_STAY_FOR_COVERAGE' }
};

const GET_DEFAULT_LADDER = (): PriorityStep[] => [
  { id: 'step_ext', order: 1, label: 'بديل خارجي', weightPercentage: 40, probabilityBias: 0, explanation: 'تفضيل استخدام الكادر الخارجي للحفاظ على استقرار الطاقم الداخلي.', criteria: { staffCategory: 'any', teacherType: 'external', relationship: 'none', slotState: 'any', selectionReason: 'any' }, enabled: true },
  { id: 'step_rel', order: 2, label: 'معلم محرر (فراغ)', weightPercentage: 30, probabilityBias: 0, explanation: 'استخدام حصص الفراغ (الشباك) للمعلمين المتواجدين.', criteria: { staffCategory: 'any', teacherType: 'internal', relationship: 'none', slotState: 'free', selectionReason: 'any' }, enabled: true },
  { id: 'step_ind', order: 3, label: 'حصص فردية', weightPercentage: 20, probabilityBias: 0, explanation: 'تحويل الحصة الفردية إلى حصة صفية عند الضرورة.', criteria: { staffCategory: 'any', teacherType: 'internal', relationship: 'none', slotState: 'individual', selectionReason: 'any' }, enabled: true },
  { id: 'step_mrg', order: 4, label: 'دمج الشعب', weightPercentage: 10, probabilityBias: 0, explanation: 'دمج الشعب المتوازية كحل أخير.', criteria: { staffCategory: 'any', teacherType: 'any', relationship: 'none', slotState: 'any', selectionReason: 'any' }, enabled: true },
];

export const INITIAL_ENGINE_CONTEXT: EngineContext = {
  normalMode: { 
    id: 'normalMode',
    name: 'الوضع الطبيعي',
    isActive: true, 
    target: 'all', 
    affectedGradeLevels: [], 
    affectedClassIds: [], 
    affectedPeriods: [1,2,3,4,5,6,7], 
    affectedBreaks: [2, 4], 
    breakAction: 'none', 
    mergeStrategy: 'advance_second',
    simulationMode: false,
    policyVersion: '1.0',
    goldenRules: [
        STANDARD_STAY_RULE
    ],
    policyRules: [],
    priorityLadder: GET_DEFAULT_LADDER()
  },
  rainyMode: { 
    id: 'rainyMode',
    name: 'يوم ماطر',
    isActive: false,
    target: 'all', 
    affectedGradeLevels: [], 
    affectedClassIds: [], 
    affectedPeriods: [1,2,3,4,5,6,7], 
    affectedBreaks: [2, 4], 
    breakAction: 'internal', 
    mergeStrategy: 'advance_second',
    simulationMode: false,
    policyVersion: '1.2',
    goldenRules: [
        STANDARD_STAY_RULE,
        { 
            id: 'GR_RAINY_MERGE', 
            label: 'تجميع الصفوف عند انخفاض العدد', 
            isActive: true, 
            compliancePercentage: 100, 
            enforcementLevel: 'STRICT',
            description: 'عند انخفاض الحضور، يتم دمج الشعب وتوزيع التغطية بالتساوي بين معلمي الطبقة.',
            action: { type: 'REQUIRE_MERGED_CLASSES_COUNT' }
        },
        {
            id: 'GR_DAILY_EQUITY',
            label: 'قاعدة العدالة اليومية',
            isActive: true,
            compliancePercentage: 90,
            enforcementLevel: 'FLEXIBLE',
            description: 'يُمنع تحميل معلم عبئًا أكبر من غيره في نفس اليوم مهما كانت أولويته الأكاديمية.'
        }
    ],
    policyRules: [{ id: 'R1', label: 'تفعيل الإشراف الصفي الإلزامي', isActive: true }],
    priorityLadder: [
        { id: 'step_rainy_merge', order: 1, label: 'دمج الشعب (أولوية)', weightPercentage: 50, probabilityBias: 0, explanation: 'في الأيام الماطرة، دمج الصفوف قليل العدد هو الحل الأمثل.', criteria: { staffCategory: 'any', teacherType: 'any', relationship: 'same_grade', slotState: 'any', selectionReason: 'any' }, enabled: true },
        ...GET_DEFAULT_LADDER().slice(1)
    ],
    rainy: { mergedClassesCount: 0, teacherMultiGradeFactor: 0.7 }
  },
  examMode: {
    id: 'examMode',
    name: 'فترة امتحانات',
    isActive: false,
    target: 'all',
    affectedGradeLevels: [],
    affectedClassIds: [],
    affectedPeriods: [1,2,3],
    affectedBreaks: [],
    breakAction: 'none',
    mergeStrategy: 'advance_second',
    simulationMode: false,
    policyVersion: '2.0',
    goldenRules: [
        STANDARD_STAY_RULE,
        {
            id: 'GR_EXAM_SUBJECT',
            label: 'تحديد موضوع الامتحان',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'STRICT',
            description: 'يجب تحديد موضوع الامتحان والطبقة أو الصف المعني عند تفعيل النمط.',
            action: { type: 'REQUIRE_EXAM_SUBJECT' }
        },
        {
            id: 'GR_EXAM_EDUCATOR',
            label: 'أولوية المربي في المراقبة',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'STRICT',
            description: 'الأصل أن يقوم مربي الصف بمراقبة امتحان صفه لضمان الاستقرار.'
        },
        {
            id: 'GR_EXAM_SWAP',
            label: 'قاعدة التبديل بين الصفوف عند التعارض',
            isActive: true,
            compliancePercentage: 80,
            enforcementLevel: 'FLEXIBLE',
            description: 'إذا كان المربي لديه حصة فعلية في صف آخر، يتم التبديل مع معلم الصف الذي لديه امتحان لتمكينه من تفقد طلابه.'
        },
        {
            id: 'GR_EXAM_INDIVIDUAL',
            label: 'قاعدة الفردي كمساعد مراقبة',
            isActive: true,
            compliancePercentage: 90,
            enforcementLevel: 'FLEXIBLE',
            description: 'إذا كان لدى المربي حصة فردي، يعمل كمراقب أساسي أو مساعد حسب الحاجة.'
        },
        {
            id: 'GR_NO_EXTERNAL',
            label: 'منع البديل الخارجي',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'STRICT',
            description: 'لا يُسمح باستخدام بدلاء خارجيين في مراقبة الامتحانات.',
            action: { type: 'BLOCK_EXTERNAL_STAFF' },
            conditions: [{ id: 'c1', key: 'teacherType', operator: 'equals', value: 'external' }]
        }
    ],
    policyRules: [],
    priorityLadder: [
        { id: 'step_exam_educator', order: 1, label: 'مربي الصف', weightPercentage: 80, probabilityBias: 0, explanation: 'المربي هو المراقب الأول.', criteria: { staffCategory: 'teacher', teacherType: 'internal', relationship: 'class_educator', slotState: 'any', selectionReason: 'any' }, enabled: true },
        { id: 'step_exam_sub', order: 2, label: 'معلم الموضوع (متواجد)', weightPercentage: 60, probabilityBias: 0, explanation: 'الأولوية لمعلم المادة المتواجد.', criteria: { staffCategory: 'teacher', teacherType: 'internal', relationship: 'same_subject', slotState: 'actual', selectionReason: 'any' }, enabled: true },
        ...GET_DEFAULT_LADDER().slice(1)
    ],
    exam: { examSubject: '' }
  },
  tripMode: { 
    id: 'tripMode',
    name: 'رحلة خارجية',
    isActive: false,
    target: 'specific_grades', 
    affectedGradeLevels: [], 
    affectedClassIds: [], 
    affectedPeriods: [1,2,3,4,5,6,7], 
    affectedBreaks: [2, 4], 
    breakAction: 'none', 
    mergeStrategy: 'advance_second',
    simulationMode: false,
    policyVersion: '1.1',
    goldenRules: [
        STANDARD_STAY_RULE,
        { 
            id: 'GR_TRIP_EDUCATOR', 
            label: 'قاعدة خروج المربي مع صفه', 
            isActive: true, 
            compliancePercentage: 100, 
            enforcementLevel: 'STRICT',
            description: 'المربي يخرج مع الصف في الجولة.' 
        },
        {
            id: 'GR_TRIP_COMPANION',
            label: 'قاعدة اختيار المعلم المرافق',
            isActive: true,
            compliancePercentage: 90,
            enforcementLevel: 'FLEXIBLE',
            description: 'يُختار المعلم المرافق بناءً على أعلى ارتباط بالصف.'
        },
        { 
            id: 'GR_SLOT_RELEASED', 
            label: 'قاعدة الحصص المتحررة', 
            isActive: true, 
            compliancePercentage: 100, 
            enforcementLevel: 'STRICT',
            description: 'كل حصة لصف خرج في الجولة تُعتبر متحررة (Released) وتستخدم للتغطية.',
            action: { type: 'RELEASE_TRIP_SLOTS' }
        },
        {
            id: 'GR_TRIP_EQUITY',
            label: 'قاعدة العدالة في الرحلات',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'STRICT',
            description: 'يُراعى توزيع الرحلات على المعلمين بعدالة عبر السنة.'
        },
        { 
            id: 'GR_NO_7TH', 
            label: 'قاعدة الحصة السابعة', 
            isActive: true, 
            compliancePercentage: 90, 
            enforcementLevel: 'FLEXIBLE',
            description: 'المعلم المرافق لا يُكلف بالحصة السابعة عند عودته. إذا غادر الطلاب بعد السادسة، المعلم الذي بقي ولديه سابعة يغطي مكان المعلم الذي خرج.',
            action: { type: 'EXEMPT_7TH_PERIOD' }
        }
    ],
    policyRules: [{ id: 'T1', label: 'تحرير حصص المربين والمنسقين', isActive: true }],
    priorityLadder: GET_DEFAULT_LADDER()
  },
  emergencyMode: {
    id: 'emergencyMode',
    name: 'نقص حاد (طوارئ)',
    isActive: false,
    target: 'all',
    affectedGradeLevels: [],
    affectedClassIds: [], 
    affectedPeriods: [1,2,3,4,5,6,7], 
    affectedBreaks: [],
    breakAction: 'merge',
    mergeStrategy: 'delay_first',
    simulationMode: false,
    autoTriggerThreshold: 6,
    policyVersion: '3.0',
    goldenRules: [
        {
            ...STANDARD_STAY_RULE,
            compliancePercentage: 30, // Relaxed heavily
            label: 'منع استغلال المكوث (مخفف)'
        },
        {
            id: 'GR_SURVIVAL',
            label: 'قاعدة البقاء التشغيلي',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'EMERGENCY_ONLY',
            description: 'الأولوية لتغطية أكبر عدد ممكن من الحصص بأي معلم متاح، بغض النظر عن التخصص.'
        },
        {
            id: 'GR_DOC',
            label: 'قاعدة التوثيق الإلزامي',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'STRICT',
            description: 'كل قرار يجب أن يُسجل مع السبب والنمط والقاعدة التي تم تخفيفها.'
        }
    ],
    policyRules: [],
    priorityLadder: GET_DEFAULT_LADDER()
  },
  holidayMode: {
    id: 'holidayMode',
    name: 'عطلة / مناسبات',
    isActive: false,
    target: 'specific_grades',
    affectedGradeLevels: [],
    affectedClassIds: [],
    affectedPeriods: [1,2,3,4,5,6,7],
    affectedBreaks: [],
    breakAction: 'none',
    mergeStrategy: 'advance_second',
    simulationMode: false,
    policyVersion: '1.0',
    holiday: { type: 'partial', excludedGrades: [], excludedClasses: [] },
    goldenRules: [
        STANDARD_STAY_RULE,
        {
            id: 'GR_HOLIDAY_EXCLUDE',
            label: 'قاعدة تحديد المستثنين من العطلة',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'STRICT',
            description: 'يتم تحديد طبقات أو صفوف لا يشملها العطل.'
        },
        {
            id: 'GR_USE_RELEASED',
            label: 'قاعدة استغلال المعلمين المتفرغين',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'STRICT',
            description: 'معلمو الصفوف المعطلة يتحولون إلى بدلاء داخليين مع الالتزام ببرامجهم (فردي / مكوث).'
        },
        {
            id: 'GR_PROTECT_SCHEDULE',
            label: 'قاعدة عدم الإخلال بالبرنامج الأصلي',
            isActive: true,
            compliancePercentage: 80,
            enforcementLevel: 'FLEXIBLE',
            description: 'لا يُسمح بكسر برنامج المعلم الأساسي بحجة العطلة.'
        }
    ],
    policyRules: [
        { id: 'PR_HOLIDAY_RELEASE', label: 'استغلال المعلمين المتفرغين', isActive: true, description: 'المعلمون الذين تم إلغاء حصصهم بسبب غياب طلابهم يعتبرون في حكم المتفرغين للتغطية.' }
    ],
    priorityLadder: [
        { id: 'step_holiday_release', order: 1, label: 'معلم متفرغ (بسبب العطلة)', weightPercentage: 100, probabilityBias: 0, criteria: { staffCategory: 'any', teacherType: 'internal', relationship: 'none', slotState: 'released', selectionReason: 'any' }, explanation: 'المعلمون الذين تم إلغاء حصصهم بسبب غياب طلابهم.', enabled: true },
        ...GET_DEFAULT_LADDER()
    ]
  },
  examPrepMode: {
    id: 'examPrepMode',
    name: 'وضع التحضير للامتحانات',
    isActive: false,
    target: 'all',
    affectedGradeLevels: [],
    affectedClassIds: [],
    affectedPeriods: [1,2,3,4,5,6,7],
    affectedBreaks: [],
    breakAction: 'none',
    mergeStrategy: 'advance_second',
    simulationMode: false,
    policyVersion: '1.0',
    goldenRules: [
        STANDARD_STAY_RULE,
        {
            id: 'GR_CORE_SUBJECT_PRIORITY',
            label: 'أولوية معلم الموضوع',
            isActive: true,
            compliancePercentage: 100,
            enforcementLevel: 'STRICT',
            description: 'في حال غياب معلم موضوع أساسي، يجب أن يكون البديل من نفس التخصص لضمان استمرارية المراجعة.'
        },
        {
            id: 'GR_NO_DISTURBANCE',
            label: 'منع الأنشطة اللامنهجية',
            isActive: true,
            compliancePercentage: 90,
            enforcementLevel: 'FLEXIBLE',
            description: 'يتم تقليص الأنشطة غير الأكاديمية (رياضة، فنون) لصالح حصص المراجعة والتركيز.'
        }
    ],
    policyRules: [],
    priorityLadder: [
        { id: 'step_prep_subject', order: 1, label: 'معلم نفس الموضوع', weightPercentage: 80, probabilityBias: 0, criteria: { staffCategory: 'teacher', teacherType: 'internal', relationship: 'same_subject', slotState: 'any', selectionReason: 'same_subject' }, explanation: 'الأولوية القصوى لمعلم نفس التخصص للمراجعة.', enabled: true },
        { id: 'step_prep_educator', order: 2, label: 'مربي الصف', weightPercentage: 60, probabilityBias: 0, criteria: { staffCategory: 'teacher', teacherType: 'internal', relationship: 'class_educator', slotState: 'any', selectionReason: 'class_educator' }, explanation: 'المربي لضمان الاستقرار النفسي قبل الامتحانات.', enabled: true },
        { id: 'step_prep_expert', order: 3, label: 'خبير خارجي', weightPercentage: 40, probabilityBias: 0, criteria: { staffCategory: 'any', teacherType: 'external', relationship: 'none', slotState: 'any', selectionReason: 'external_expert' }, explanation: 'الاستعانة بخبراء للمراجعة المركزة.', enabled: true },
        { id: 'step_prep_free', order: 4, label: 'معلم متاح (عام)', weightPercentage: 20, probabilityBias: 0, criteria: { staffCategory: 'any', teacherType: 'internal', relationship: 'none', slotState: 'free', selectionReason: 'any' }, explanation: 'خيار أخير للمراقبة فقط.', enabled: true }
    ]
  }
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = [
  { id: 'chronometer', title: 'الميقاتية الحية', visible: true, size: 'medium', order: 1 },
  { id: 'agenda', title: 'أجندة اليوم', visible: true, size: 'medium', order: 2 },
  { id: 'stats', title: 'مركز العمليات الميداني', visible: true, size: 'large', order: 3 },
  { id: 'protocols', title: 'وحدة الأنماط', visible: true, size: 'large', order: 4 },
  { id: 'alerts', title: 'التنبيهات', visible: true, size: 'small', order: 5 },
  { id: 'ai_insight', title: 'الرؤية الذكية', visible: true, size: 'small', order: 6 },
  { id: 'quick_tasks', title: 'المهام السريعة', visible: true, size: 'medium', order: 7 },
  { id: 'chart', title: 'الرسم البياني', visible: true, size: 'medium', order: 8 }
];
