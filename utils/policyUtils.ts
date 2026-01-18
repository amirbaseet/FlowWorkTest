
import { ConditionGroup, Condition, GoldenRuleV2, PriorityStepV2 } from '../types/policy';
import { SUBJECT_PRIORITY_FOR_INDIVIDUAL } from '../constants';

export const COMPONENT_OPTIONS = {
  teacherType: [
    { value: 'any', label: 'الكل / غير مهم' },
    { value: 'internal', label: 'داخلي' },
    { value: 'external', label: 'خارجي' }
  ],
  lessonType: [
    { value: 'any', label: 'الكل / غير مهم' },
    { value: 'actual', label: 'فعلي (Actual)' },
    { value: 'individual', label: 'فردي (Individual)' },
    { value: 'stay', label: 'مكوث (Stay)' },
    { value: 'shared', label: 'فعلي مشترك' }
  ],
  timeContext: [
    { value: 'any', label: 'الكل / غير مهم' },
    { value: 'during_school', label: 'خلال الدوام' },
    { value: 'same_day_stay', label: 'نفس يوم المكوث' },
    { value: 'before_end', label: 'قبل نهاية الدوام' },
    { value: 'after_end', label: 'بعد نهاية الدوام' },
    { value: 'emergency', label: 'خلال طوارئ' }
  ],
  relationship: [
    { value: 'any', label: 'الكل / غير مهم' },
    { value: 'same_subject', label: 'نفس موضوع المعلم الغائب' },
    { value: 'same_class', label: 'نفس الصف' },
    { value: 'same_grade', label: 'نفس الطبقة' },
    { value: 'same_homeroom', label: 'مربي الصف نفسه' },
    { value: 'is_homeroom', label: 'هو مربي صف' }
  ]
};

export const getSubjectOptions = () => {
  return [
    { value: 'any', label: 'الكل / غير مهم' },
    ...SUBJECT_PRIORITY_FOR_INDIVIDUAL.map(s => ({ value: s, label: s }))
  ];
};

export const createEmptyCondition = (): Condition => ({
  id: `c_${Date.now()}_${Math.random()}`,
  teacherType: 'any',
  lessonType: 'any',
  subject: 'any',
  timeContext: 'any',
  relationship: 'any'
});

export const createEmptyConditionGroup = (): ConditionGroup => ({
  id: `g_${Date.now()}_${Math.random()}`,
  op: 'AND',
  conditions: [createEmptyCondition()]
});

// Update Mandatory Rules to match new structure
export const MANDATORY_RULES: GoldenRuleV2[] = [
  {
    id: 'GR-LAW-001',
    name: 'قانون حماية حصص المكوث (Ironclad Stay Protection)',
    description: 'يُحظر استخدام حصص المكوث للتغطية، حيث تعتبر وقت تحضير مقدس.',
    isGlobal: true,
    isEnabled: true,
    compliancePercentage: 100,
    randomnessPercentage: 0,
    severity: 'CRITICAL',
    overrideAllowed: false,
    overrideRequiresReason: true,
    auditRequired: true,
    scope: { targetScope: 'all' },
    when: {
      id: 'root',
      op: 'AND',
      conditions: [{ 
        id: 'c1', 
        teacherType: 'any', 
        lessonType: 'stay', 
        subject: 'any', 
        timeContext: 'any', 
        relationship: 'any' 
      }]
    },
    then: [{ type: 'BLOCK_ASSIGNMENT' }],
    exceptions: []
  },
  {
    id: 'GR-LAW-002',
    name: 'قدسية الحصة الفعلية (Actual Lesson Sanctity)',
    description: 'يُمنع سحب معلم من حصة فعلية (Actual) لتغطية حصة أخرى.',
    isGlobal: true,
    isEnabled: true,
    compliancePercentage: 100,
    randomnessPercentage: 0,
    severity: 'CRITICAL',
    overrideAllowed: false,
    overrideRequiresReason: true,
    auditRequired: true,
    scope: { targetScope: 'all' },
    when: {
      id: 'root',
      op: 'AND',
      conditions: [{ 
        id: 'c2', 
        teacherType: 'any', 
        lessonType: 'actual', 
        subject: 'any', 
        timeContext: 'any', 
        relationship: 'any' 
      }]
    },
    then: [{ type: 'BLOCK_ASSIGNMENT' }],
    exceptions: []
  }
];
