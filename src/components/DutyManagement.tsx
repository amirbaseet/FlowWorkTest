import React, { useMemo, useState } from 'react';
import { Shield, Clock, Users, MapPin, AlertCircle, TrendingUp, TrendingDown, Minus, Search, Filter, Plus, Edit2, Trash2, X, Building2, DoorOpen, Coffee, BookOpen, Navigation, ChevronDown, ChevronUp, Calendar, GripVertical, CheckCircle2, Sparkles, Zap, Award, BarChart3, RefreshCw, Sun } from 'lucide-react';
import {
  Employee, ClassItem, Lesson, ScheduleConfig, AcademicYear,
  Facility, BreakPeriod, DutyAssignment, DutySettings,
  TeacherWorkload, FacilityPressure, TeacherSuggestion,
  SubLocation, SuggestionDropdown, AutoFillProgress
} from '@/types';
import { generateSubstitutionOptions, calculatePeriodTimeRange, toLocalISOString, normalizeArabic, timeToMins, minsToTime, getSchoolDaysInWeek } from '@/utils';
import { DAYS_AR, GRADES_AR, FACILITY_TYPES, DEFAULT_FACILITIES, FacilityType } from '@/constants';
import { useDuty } from '@/hooks/useDuty';
import { useLessons } from '@/hooks/useLessons';
import DutyNotificationCenter from './DutyNotificationCenter';
import DutySwapModal from './DutySwapModal';

interface DutyManagementProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  classes: ClassItem[];
  scheduleConfig: ScheduleConfig;
  academicYear: AcademicYear;
  dutyAssignments: DutyAssignment[];
  setDutyAssignments: React.Dispatch<React.SetStateAction<DutyAssignment[]>>;
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  breakPeriods: BreakPeriod[];
  setBreakPeriods: React.Dispatch<React.SetStateAction<BreakPeriod[]>>;
  notifications?: any[];
  setNotifications?: React.Dispatch<React.SetStateAction<any[]>>;
  swapRequests?: any[];
  setSwapRequests?: React.Dispatch<React.SetStateAction<any[]>>;
}

const DutyManagement: React.FC<DutyManagementProps> = ({
  employees,
  setEmployees,
  classes,
  scheduleConfig,
  academicYear,
  dutyAssignments: initialAssignments,
  setDutyAssignments: setParentAssignments,
  facilities: initialFacilities,
  setFacilities: setParentFacilities,
  breakPeriods: initialBreakPeriods,
  setBreakPeriods: setParentBreakPeriods,
  notifications = [],
  setNotifications,
  swapRequests = [],
  setSwapRequests
}) => {
  // --- ATOMIC HOOKS ---
  const { lessons } = useLessons();

  // --- CUSTOM HOOK ---
  const {
    facilities, setFacilities,
    dutyAssignments, setDutyAssignments,
    breakPeriods, setBreakPeriods,
    dutySettings, setDutySettings,
    teacherWorkloads,
    facilitiesPressure,
    kpis,
    handleAssignDuty,
    handleRemoveAssignment: hookRemoveAssignment,
    handleSwapDuty,
    getSuggestedTeachers
  } = useDuty({
    employees,
    lessons,
    classes,
    scheduleConfig,
    initialFacilities: initialFacilities.length > 0 ? initialFacilities : DEFAULT_FACILITIES,
    initialAssignments,
    initialBreakPeriods
  });

  // --- SYNC EFFECTS (Fix for Split-Brain State) ---
  // Sync local useDuty state back to parent (AppRouter) for localStorage persistence
  React.useEffect(() => {
    setParentAssignments(dutyAssignments);
  }, [dutyAssignments, setParentAssignments]);

  React.useEffect(() => {
    setParentFacilities(facilities);
  }, [facilities, setParentFacilities]);

  React.useEffect(() => {
    setParentBreakPeriods(breakPeriods);
  }, [breakPeriods, setParentBreakPeriods]);

  // --- LOCAL UI STATE ---

  // State - Teacher Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'internal' | 'external' | 'assistant'>('all');
  const [filterWorkload, setFilterWorkload] = useState<'all' | 'full' | 'half' | 'flexible'>('all');
  const [filterCapacity, setFilterCapacity] = useState<'all' | 'available' | 'loaded' | 'overloaded'>('all');
  const [teacherListCollapsed, setTeacherListCollapsed] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);

  // State - Swap Modal
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapAssignment, setSwapAssignment] = useState<DutyAssignment | null>(null);

  // State - Facilities UI
  const [showAddFacilityModal, setShowAddFacilityModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [facilityFormData, setFacilityFormData] = useState({
    name: '',
    type: 'courtyard',
    capacity: 50,
    subLocations: [] as SubLocation[],
    locationType: 'internal' as 'internal' | 'external'
  });

  // State - Facility Types Management (Now using Constants, but keeping UI state for adding custom types locally if needed or removing it)
  // The original code had state for facilityTypes. We should use the constant + local state if user can add new ones.
  // For now, let's assume we just use the constant for standard types, and if the user wants custom types, we might need a local state initialized from constant.
  const [facilityTypes, setFacilityTypes] = useState<FacilityType[]>(FACILITY_TYPES);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIcon, setNewTypeIcon] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('blue');

  // State - Sub-location form
  const [subLocationName, setSubLocationName] = useState('');
  const [subLocationCapacity, setSubLocationCapacity] = useState(25);

  // State - Timeline
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'timeline-cards'>('timeline-cards');
  const [draggedTeacher, setDraggedTeacher] = useState<Employee | null>(null);

  // State - Allocation System
  const [showSuggestionDropdown, setShowSuggestionDropdown] = useState<SuggestionDropdown | null>(null);
  const [autoFillProgress, setAutoFillProgress] = useState<AutoFillProgress | null>(null);
  const [suggestionTab, setSuggestionTab] = useState<'smart' | 'all'>('smart');
  const [suggestionSearch, setSuggestionSearch] = useState('');

  // State - Adding Assignment
  const [addToCardModal, setAddToCardModal] = useState<{
    isOpen: boolean;
    breakPeriodId: string;
    locationType: 'internal' | 'external';
    date: string;
  } | null>(null);
  const [selectedFacilityForAdd, setSelectedFacilityForAdd] = useState<string>('');
  const [selectedTeacherForAdd, setSelectedTeacherForAdd] = useState<string>('');
  const [applyToAllDays, setApplyToAllDays] = useState<boolean>(false);
  const [applyToAllBreaks, setApplyToAllBreaks] = useState<boolean>(false);

  // State - Tabs
  const [activeTab, setActiveTab] = useState<'timeline' | 'facilities' | 'settings'>('timeline');

  // REMOVED: dutySettings state (now in hook)

  const [editingBreakPeriod, setEditingBreakPeriod] = useState<BreakPeriod | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);

  // Break Period Form Data
  const [breakFormData, setBreakFormData] = useState({
    name: '',
    startTime: '07:30',
    endTime: '08:00',
    breakType: 'external' as 'internal' | 'external' | 'mixed',
    targetGrades: [] as string[],
    targetFloors: [] as string[],
    sourceType: 'manual' as 'schedule' | 'manual',
    isAutoLinked: false
  });

  // State - Collapsible About Section
  const [aboutSectionExpanded, setAboutSectionExpanded] = useState(false);

  // NEW: State - Day Duty Selection Modal
  const [dayDutyModal, setDayDutyModal] = useState<{
    isOpen: boolean;
    dayName: string;
    dayIndex: number;
    dutyType: 'full' | 'half' | null; // null means both/unspecified
  }>({ isOpen: false, dayName: '', dayIndex: 0, dutyType: null });

  // NEW: State - Grade Picker Modal for Break Cards
  const [gradePickerModal, setGradePickerModal] = useState<{
    isOpen: boolean;
    breakPeriodId: string;
    locationType: 'internal' | 'external';
  }>({ isOpen: false, breakPeriodId: '', locationType: 'internal' });

  // NEW: State - Day Duty Assignments (temporary, local tracking)
  const [dayDutyAssignments, setDayDutyAssignments] = useState<{
    teacherId: number;
    dayName: string;
    dutyType: 'full' | 'half';
  }[]>([]);

  // Initialize dayDutyAssignments from employees' dutySettings on mount
  React.useEffect(() => {
    const initialAssignments: { teacherId: number; dayName: string; dutyType: 'full' | 'half' }[] = [];

    employees.forEach(emp => {
      if (emp.dutySettings?.fullDutyDay) {
        initialAssignments.push({
          teacherId: Number(emp.id),
          dayName: emp.dutySettings.fullDutyDay,
          dutyType: 'full'
        });
      }
      if (emp.dutySettings?.halfDutyDay) {
        initialAssignments.push({
          teacherId: Number(emp.id),
          dayName: emp.dutySettings.halfDutyDay,
          dutyType: 'half'
        });
      }
    });

    if (initialAssignments.length > 0) {
      setDayDutyAssignments(initialAssignments);
    }
  }, []); // Run only on mount



  // NEW: Helper - Get all unique grades from classes (School Policy Center)
  const getAllGradesFromSchedule = (): string[] => {
    if (!classes || classes.length === 0) {
      // Fallback if no classes exist yet
      return ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    }

    // Extract unique grade levels from classes
    const grades = new Set<string>();
    classes.forEach(cls => {
      if (cls.gradeLevel) {
        grades.add(String(cls.gradeLevel));
      }
    });

    // Sort ascending
    return Array.from(grades).sort((a, b) => parseInt(a) - parseInt(b));
  };

  // NEW: Helper - Get all classes with names and sections
  const getAllClassesWithDetails = (): { id: string; name: string; grade: string; section: string }[] => {
    if (!classes || classes.length === 0) {
      return [];
    }

    return classes.map(cls => ({
      id: cls.id,
      name: cls.name,
      grade: String(cls.gradeLevel),
      section: cls.name.replace(/^\d+/, '').trim() // Extract section (e.g., "1أ" -> "أ")
    }));
  };

  // NEW: Helper - Get grades grouped with their sections (from باني الهيكلية الصفية)
  const getGradesWithSections = (): { grade: string; gradeName: string; classes: ClassItem[] }[] => {
    if (!classes || classes.length === 0) {
      return [];
    }

    // Group classes by gradeLevel
    const gradeMap = new Map<number, ClassItem[]>();

    classes.forEach(cls => {
      if (!gradeMap.has(cls.gradeLevel)) {
        gradeMap.set(cls.gradeLevel, []);
      }
      gradeMap.get(cls.gradeLevel)!.push(cls);
    });

    // Convert to array and sort by grade
    return Array.from(gradeMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([gradeLevel, gradeClasses]) => ({
        grade: String(gradeLevel),
        gradeName: GRADES_AR[gradeLevel - 1] || `طبقة ${gradeLevel}`,
        classes: gradeClasses
      }));
  };

  // NEW: Helper - Get all unique floors/sub-locations from facilities
  const getAllFloorsFromFacilities = (): string[] => {
    const floors = new Set<string>();

    facilities.forEach(facility => {
      if (facility.subLocations && facility.subLocations.length > 0) {
        facility.subLocations.forEach(subLoc => {
          floors.add(subLoc.name);
        });
      }
    });

    return Array.from(floors).sort();
  };

  // NEW: Helper - Get teachers who teach specific classes
  const getTeachersForClasses = (classIds: string[]): Employee[] => {
    if (!classIds || classIds.length === 0) return [];

    // Find all teachers who teach any of the specified classes
    const teacherIds = new Set<number>();

    lessons.forEach(lesson => {
      if (classIds.includes(lesson.classId)) {
        teacherIds.add(lesson.teacherId);
      }
    });

    // Get employee objects
    return employees.filter(emp => teacherIds.has(emp.id));
  };

  // NEW: Helper - Get class educator (primary teacher)
  const getClassEducator = (classId: string): Employee | null => {
    const educator = employees.find(emp =>
      emp.addons?.educator && emp.addons?.educatorClassId === classId
    );
    return educator || null;
  };



  // NEW: Compute available grades from classes (reactive)
  const availableGradesFromSystem = useMemo<string[]>(() => {
    return getAllGradesFromSchedule();
  }, [classes]); // React when classes change

  // NEW: Initialize availableGrades from system on first load
  React.useEffect(() => {
    if (dutySettings.availableGrades.length === 0) {
      setDutySettings(prev => ({
        ...prev,
        availableGrades: availableGradesFromSystem
      }));
    }
  }, [availableGradesFromSystem]);











  // Filter teachers
  const filteredTeachers = useMemo(() => {
    return teacherWorkloads.filter(t => {
      // Search filter
      if (searchQuery && !t.teacher.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Type filter
      if (filterType !== 'all') {
        if (filterType === 'external' && !t.teacher.constraints?.isExternal) return false;
        if (filterType === 'internal' && t.teacher.constraints?.isExternal) return false;
        // Assistant filter can be added based on role
      }

      // Workload filter
      if (filterWorkload !== 'all') {
        if (filterWorkload === 'full' && t.teacher.constraints?.isHalfTime) return false;
        if (filterWorkload === 'half' && !t.teacher.constraints?.isHalfTime) return false;
      }

      // Capacity filter
      if (filterCapacity !== 'all') {
        if (filterCapacity !== t.availability) return false;
      }

      return true;
    });
  }, [teacherWorkloads, searchQuery, filterType, filterWorkload, filterCapacity]);

  // Facility Type Icons
  // Helper functions for Facility Types
  const getFacilityType = (typeId: string): FacilityType | undefined => {
    return facilityTypes.find(ft => ft.id === typeId);
  };

  const getFacilityIcon = (typeId: string): string => {
    const type = getFacilityType(typeId);
    return type?.icon || '🏛️';
  };

  const getFacilityTypeName = (typeId: string): string => {
    const type = getFacilityType(typeId);
    return type?.name || 'غير محدد';
  };

  const getFacilityColor = (typeId: string): string => {
    const type = getFacilityType(typeId);
    return type?.color || 'gray';
  };

  // Facility Type Handlers
  const handleAddFacilityType = () => {
    if (!newTypeName.trim()) {
      alert('يرجى إدخال اسم النوع');
      return;
    }

    const newType: FacilityType = {
      id: `type-${Date.now()}`,
      name: newTypeName.trim(),
      icon: newTypeIcon.trim() || '🏛️',
      color: newTypeColor
    };

    setFacilityTypes(prev => [...prev, newType]);
    setNewTypeName('');
    setNewTypeIcon('');
    setNewTypeColor('blue');
    setShowAddTypeModal(false);
  };

  const handleDeleteFacilityType = (typeId: string) => {
    // Check if type is used by any facility
    const usedByFacilities = facilities.filter(f => f.type === typeId);

    if (usedByFacilities.length > 0) {
      alert(`لا يمكن حذف هذا النوع. يوجد ${usedByFacilities.length} مرفق يستخدم هذا النوع.`);
      return;
    }

    const confirmed = window.confirm('هل أنت متأكد من حذف هذا النوع؟');
    if (confirmed) {
      setFacilityTypes(prev => prev.filter(ft => ft.id !== typeId));
    }
  };

  // Facility Handlers
  const handleAddFacility = () => {
    setEditingFacility(null);
    setFacilityFormData({
      name: '',
      type: 'courtyard',
      capacity: 50,
      subLocations: [],
      locationType: 'internal'  // NEW: default
    });
    setShowAddFacilityModal(true);
  };

  const handleEditFacility = (facility: Facility) => {
    setEditingFacility(facility);
    setFacilityFormData({
      name: facility.name,
      type: facility.type,
      capacity: facility.capacity,
      subLocations: facility.subLocations || [],  // NEW: include subLocations
      locationType: facility.locationType || 'internal'  // NEW: include locationType
    });
    setShowAddFacilityModal(true);
  };

  const handleDeleteFacility = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المرفق؟')) {
      setFacilities(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleSaveFacility = () => {
    if (!facilityFormData.name.trim()) {
      alert('يرجى إدخال اسم المرفق');
      return;
    }

    if (editingFacility) {
      // Edit existing
      setFacilities(prev => prev.map(f =>
        f.id === editingFacility.id
          ? { ...f, ...facilityFormData }
          : f
      ));
    } else {
      // Add new
      const newFacility: Facility = {
        id: Date.now().toString(),
        ...facilityFormData,
        assignedTeachers: []
      };
      setFacilities(prev => [...prev, newFacility]);
    }

    setShowAddFacilityModal(false);
  };

  // NEW: Get teachers who have lessons on a specific day
  const getTeachersForDay = (dayName: string): Employee[] => {
    // Find teachers who have lessons on this day
    const teacherIds = new Set<number>();

    lessons.forEach(lesson => {
      // Normalize day names for comparison
      const lessonDay = lesson.day.replace('ال', '');
      const targetDay = dayName.replace('ال', '');

      if (lessonDay === targetDay || lesson.day === dayName) {
        teacherIds.add(Number(lesson.teacherId)); // Ensure number type
      }
    });

    // If no lessons found, return all employees as fallback
    if (teacherIds.size === 0) {
      return employees;
    }

    return employees.filter(emp => teacherIds.has(Number(emp.id)));
  };

  // NEW: Handler to assign duty to teacher for a day
  const handleAssignDayDuty = (teacherId: number, dayName: string, dutyType: 'full' | 'half') => {
    // Ensure teacherId is a number
    const numTeacherId = Number(teacherId);

    // Get teacher info
    const teacher = employees.find(e => Number(e.id) === numTeacherId);
    if (!teacher) {
      console.warn('Teacher not found:', numTeacherId);
      return;
    }

    // Check if teacher has a packed schedule on this day
    const teacherLessonsOnDay = lessons.filter(lesson => {
      // Normalize day names for comparison
      const lessonDay = lesson.day.replace('ال', '');
      const targetDay = dayName.replace('ال', '');
      return (lessonDay === targetDay || lesson.day === dayName) && Number(lesson.teacherId) === numTeacherId;
    });

    // Get workload info
    const teacherWorkload = teacherWorkloads.find(tw => Number(tw.teacher.id) === numTeacherId);
    const totalLessonsOnDay = teacherLessonsOnDay.length;
    const periodsPerDay = scheduleConfig.periodsPerDay || 7;

    // Packed schedule criteria: 6+ lessons on that day = packed
    const isPacked = totalLessonsOnDay >= 6;

    // If schedule is packed, show confirmation
    if (isPacked) {
      const shortDay = dayName.replace('ال', '');
      const dutyLabel = dutyType === 'full' ? 'مناوبة كاملة' : 'نصف مناوبة';

      const confirmed = window.confirm(
        `⚠️ تنبيه: جدول المعلم مضغوط!\n\n` +
        `👤 المعلم: ${teacher.name}\n` +
        `📅 اليوم: ${shortDay}\n` +
        `📚 عدد الحصص: ${totalLessonsOnDay} من ${periodsPerDay}\n` +
        `🟠 السعة المتبقية: ${teacherWorkload?.capacity || 0} ساعات\n\n` +
        `هل تريد تعيينه لـ ${dutyLabel} على أي حال؟`
      );

      if (!confirmed) {
        return; // User cancelled
      }
    }

    // Check if already assigned to THIS day
    const existingOnThisDay = dayDutyAssignments.find(
      a => a.teacherId === numTeacherId && a.dayName === dayName
    );

    if (existingOnThisDay) {
      // Update existing assignment on this day
      setDayDutyAssignments(prev =>
        prev.map(a =>
          a.teacherId === numTeacherId && a.dayName === dayName
            ? { ...a, dutyType }
            : a
        )
      );
    } else {
      // Add new assignment
      // NOTE: Allow both full and half duty on DIFFERENT days for the same teacher
      // Only remove previous assignment of the SAME type
      setDayDutyAssignments(prev => [
        ...prev.filter(a => !(a.teacherId === numTeacherId && a.dutyType === dutyType)), // Remove same type only
        { teacherId: numTeacherId, dayName, dutyType }
      ]);
    }

    // SYNC: Update teacher's dutySettings to reflect the assignment
    // NOTE: A teacher can have BOTH full duty day AND half duty day on DIFFERENT days
    setEmployees(prev => prev.map(emp => {
      if (Number(emp.id) !== numTeacherId) return emp;

      const currentFullDay = emp.dutySettings?.fullDutyDay;
      const currentHalfDay = emp.dutySettings?.halfDutyDay;

      return {
        ...emp,
        dutySettings: {
          ...emp.dutySettings,
          employmentRatio: emp.dutySettings?.employmentRatio || 'full',
          // Set the appropriate day - keep the other type unless it's the SAME day
          fullDutyDay: dutyType === 'full'
            ? dayName
            : (currentFullDay === dayName ? undefined : currentFullDay), // Clear only if same day
          halfDutyDay: dutyType === 'half'
            ? dayName
            : (currentHalfDay === dayName ? undefined : currentHalfDay), // Clear only if same day
          exemptFromDuty: emp.dutySettings?.exemptFromDuty || false
        }
      };
    }));
  };

  // NEW: Handler to remove duty assignment
  const handleRemoveDayDuty = (teacherId: number, dayName: string) => {
    const numTeacherId = Number(teacherId);

    // Get the assignment to know which type to clear
    const assignment = dayDutyAssignments.find(
      a => a.teacherId === numTeacherId && a.dayName === dayName
    );

    // Remove from dayDutyAssignments
    setDayDutyAssignments(prev =>
      prev.filter(a => !(a.teacherId === numTeacherId && a.dayName === dayName))
    );

    // SYNC: Clear teacher's dutySettings
    if (assignment) {
      setEmployees(prev => prev.map(emp => {
        if (Number(emp.id) !== numTeacherId) return emp;

        return {
          ...emp,
          dutySettings: {
            ...emp.dutySettings,
            employmentRatio: emp.dutySettings?.employmentRatio || 'full',
            // Clear the appropriate day based on duty type
            fullDutyDay: assignment.dutyType === 'full' ? undefined : emp.dutySettings?.fullDutyDay,
            halfDutyDay: assignment.dutyType === 'half' ? undefined : emp.dutySettings?.halfDutyDay,
            exemptFromDuty: emp.dutySettings?.exemptFromDuty || false
          }
        };
      }));
    }
  };

  // NEW: Get duty assignment for a teacher on any day
  const getTeacherDutyAssignment = (teacherId: number): { dayName: string; dutyType: 'full' | 'half' } | null => {
    const numTeacherId = Number(teacherId);
    const assignment = dayDutyAssignments.find(a => a.teacherId === numTeacherId);
    return assignment ? { dayName: assignment.dayName, dutyType: assignment.dutyType } : null;
  };

  // NEW: Check if teacher is assigned to a specific day
  const isTeacherAssignedToDay = (teacherId: number, dayName: string): { assigned: boolean; dutyType?: 'full' | 'half' } => {
    const numTeacherId = Number(teacherId);
    const assignment = dayDutyAssignments.find(
      a => a.teacherId === numTeacherId && a.dayName === dayName
    );
    return assignment
      ? { assigned: true, dutyType: assignment.dutyType }
      : { assigned: false };
  };

  // --- Derived Helpers (Restored for JSX Compatibility) ---

  const getAssignmentsForCell = (breakPeriodId: string, facilityId: string, date: string) => {
    return dutyAssignments.filter(a =>
      a.breakPeriodId === breakPeriodId &&
      a.facilityId === facilityId &&
      a.date === date
    );
  };

  const getCellCoverageStatus = (breakPeriodId: string, facilityId: string, date: string) => {
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility) return 'empty';

    const assignments = getAssignmentsForCell(breakPeriodId, facilityId, date);
    const required = Math.ceil(facility.capacity / 50); // Default ratio 1:50

    if (assignments.length === 0) return 'empty';
    if (assignments.length >= required) return 'staffed';
    return 'understaffed';
  };

  const getDutyCount = (teacherId: string, date: string) => {
    return dutyAssignments.filter(a => a.teacherId === teacherId && a.date === date).length;
  };

  const getAvailableTeachersForBreak = (breakPeriod: BreakPeriod, date: string) => {
    const assignedIds = dutyAssignments
      .filter(a => a.breakPeriodId === breakPeriod.id && a.date === date)
      .map(a => a.teacherId);

    return teacherWorkloads.filter(tw =>
      !assignedIds.includes(String(tw.teacher.id)) &&
      tw.availability !== 'overloaded'
    );
  };

  const getSuggestionsForCell = (breakPeriod: BreakPeriod, facilityId: string, date: string, limit: number = 5) => {
    const facility = facilities.find(f => f.id === facilityId);
    if (!facility) return [];
    return getSuggestedTeachers(facility, breakPeriod, date, limit);
  };

  // Timeline Helper Functions
  const formatDateForAssignment = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, teacher: Employee) => {
    setDraggedTeacher(teacher);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('teacherId', teacher.id);
  };

  const handleDragEnd = () => {
    setDraggedTeacher(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, breakPeriodId: string, facilityId: string) => {
    e.preventDefault();

    if (!draggedTeacher) return;

    const date = formatDateForAssignment(selectedDate);
    const breakPeriod = breakPeriods.find(bp => bp.id === breakPeriodId);

    if (!breakPeriod) return;

    // Direct assignment via hook
    // Note: You might want to add validation here similar to original getAvailableTeachersForBreak
    // For now, we trust the hook or the user's manual action
    handleAssignDuty(
      String(draggedTeacher.id),
      facilityId,
      breakPeriodId,
      date
    );

    setDraggedTeacher(null);
  };

  const handleRemoveAssignment = (assignmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    hookRemoveAssignment(assignmentId);
  };

  // Handle cell click to show suggestions
  const handleCellClick = (e: React.MouseEvent, breakPeriodId: string, facilityId: string) => {
    // Don't show if dragging
    if (draggedTeacher) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setShowSuggestionDropdown({
      breakPeriodId,
      facilityId,
      position: {
        x: rect.left,
        y: rect.bottom + window.scrollY
      }
    });
  };

  // Assign teacher from suggestion
  const assignFromSuggestion = (teacherId: string) => {
    if (!showSuggestionDropdown) return;

    const date = formatDateForAssignment(selectedDate);
    handleAssignDuty(
      teacherId,
      showSuggestionDropdown.facilityId,
      showSuggestionDropdown.breakPeriodId,
      date
    );
    setShowSuggestionDropdown(null);
  };

  // Auto-fill single break with animation
  const handleAutoFillBreak = async (breakPeriodId: string) => {
    const date = formatDateForAssignment(selectedDate);
    const breakPeriod = breakPeriods.find(bp => bp.id === breakPeriodId);
    if (!breakPeriod) return;

    // Check for existing assignments
    const existing = dutyAssignments.filter(a => a.breakPeriodId === breakPeriodId && a.date === date);
    if (existing.length > 0) {
      const confirmed = window.confirm(
        `يوجد ${existing.length} تخصيصات موجودة في هذه الفسحة.\nهل تريد مسحها والبدء من جديد؟`
      );
      if (!confirmed) return;

      // Remove existing one by one or batch if supported
      existing.forEach(a => hookRemoveAssignment(a.id));
    }

    const newAssignments: DutyAssignment[] = [];
    const facilityAssignmentsMap = new Map<string, string[]>(); // Track assigned teachers per facility to avoid duplicates if improved logic needed

    for (const facility of facilities) {
      // Use smart suggestions from hook
      const suggestions = getSuggestedTeachers(facility, breakPeriod, date, Math.ceil(facility.capacity / 50));

      for (const suggestion of suggestions) {
        handleAssignDuty(String(suggestion.teacher.id), facility.id, breakPeriod.id, date);
        // Add delay for animation effect if desired, but here we just call the hook function
        // If we want visual progress, we might need to await something or handle state locally, 
        // but since handleAssignDuty is likely sync or simple state update, we can't easily await "animation".
        // To keep the progress bar visual:
        newAssignments.push({
          id: 'temp', breakPeriodId, facilityId: facility.id, teacherId: String(suggestion.teacher.id), date
        });
      }
    }

    // Use dummy progress for UX since real assignment is instant
    setAutoFillProgress({
      current: 0,
      total: newAssignments.length,
      isRunning: true,
      currentBreak: breakPeriod.name
    });

    for (let i = 0; i < newAssignments.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setAutoFillProgress(prev => prev ? { ...prev, current: i + 1 } : null);
    }

    setAutoFillProgress(null);
  };

  // Auto-fill all breaks with animation
  const handleAutoFillAll = async () => {
    const date = formatDateForAssignment(selectedDate);

    // Check for existing assignments
    const existing = dutyAssignments.filter(a => a.date === date);
    if (existing.length > 0) {
      const confirmed = window.confirm(
        `يوجد ${existing.length} تخصيصات موجودة.\nهل تريد مسحها جميعاً وملء الجدول تلقائياً؟`
      );
      if (!confirmed) return;

      // Clear all for this date
      // Ideally use a batch remove function if available, or loop
      existing.forEach(a => hookRemoveAssignment(a.id));
    }

    const assignmentsToMake: { teacherId: string, facilityId: string, breakPeriodId: string }[] = [];

    for (const breakPeriod of breakPeriods) {
      for (const facility of facilities) {
        const requiredTeachers = Math.ceil(facility.capacity / 50);
        const suggestions = getSuggestedTeachers(facility, breakPeriod, date, requiredTeachers);

        for (const suggestion of suggestions) {
          assignmentsToMake.push({
            teacherId: String(suggestion.teacher.id),
            facilityId: facility.id,
            breakPeriodId: breakPeriod.id
          });
        }
      }
    }

    // Animate assignments
    setAutoFillProgress({
      current: 0,
      total: assignmentsToMake.length,
      isRunning: true
    });

    for (let i = 0; i < assignmentsToMake.length; i++) {
      const { teacherId, facilityId, breakPeriodId } = assignmentsToMake[i];
      handleAssignDuty(teacherId, facilityId, breakPeriodId, date);

      await new Promise(resolve => setTimeout(resolve, 50));

      const bp = breakPeriods.find(b => b.id === breakPeriodId);
      const fac = facilities.find(f => f.id === facilityId);
      setAutoFillProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentBreak: bp?.name,
        currentFacility: fac?.name
      } : null);
    }

    setAutoFillProgress(null);
  };

  // Clear all assignments for selected date
  const handleClearAll = () => {
    const date = formatDateForAssignment(selectedDate);
    const existing = dutyAssignments.filter(a => a.date === date);

    if (existing.length === 0) {
      alert('لا توجد تخصيصات لمسحها');
      return;
    }

    const confirmed = window.confirm(`هل أنت متأكد من مسح ${existing.length} تخصيص؟`);
    if (confirmed) {
      existing.forEach(a => hookRemoveAssignment(a.id));
    }
  };

  // Handle duty swap request
  const handleSubmitSwap = (targetAssignmentId: string, reason: string) => {
    if (!swapAssignment || !setSwapRequests || !setNotifications) return;

    const targetAssignment = dutyAssignments.find(a => a.id === targetAssignmentId);
    if (!targetAssignment) return;

    const newSwap = {
      id: `swap-${Date.now()}`,
      requesterId: swapAssignment.teacherId,
      targetTeacherId: targetAssignment.teacherId,
      requesterAssignmentId: swapAssignment.id,
      targetAssignmentId: targetAssignmentId,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setSwapRequests(prev => [...prev, newSwap]);

    // Create notification
    const requester = employees.find(e => e.id === swapAssignment.teacherId);
    const notification = {
      id: `notif-${Date.now()}`,
      type: 'info',
      title: 'طلب تبديل جديد',
      message: `طلب تبديل من ${requester?.name}`,
      timestamp: new Date().toISOString(),
      read: false,
      relatedIds: [swapAssignment.id, targetAssignmentId]
    };

    setNotifications(prev => [...prev, notification]);
  };

  // Handle notification actions
  const handleMarkAsRead = (id: string) => {
    if (!setNotifications) return;
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleDeleteNotification = (id: string) => {
    if (!setNotifications) return;
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAllNotifications = () => {
    if (!setNotifications) return;
    setNotifications([]);
  };

  // Weekly View Helper Functions
  const getWeekDates = (date: Date): Date[] => {
    const week: Date[] = [];
    const current = new Date(date);

    // Get Sunday of current week
    const day = current.getDay();
    const diff = current.getDate() - day;
    const sunday = new Date(current.setDate(diff));

    // Generate 7 days
    for (let i = 0; i < 7; i++) {
      const weekDay = new Date(sunday);
      weekDay.setDate(sunday.getDate() + i);
      week.push(weekDay);
    }

    return week;
  };

  const getDayName = (date: Date): string => {
    return DAYS_AR[date.getDay()];
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate);
  };



  const getTimeSlotColor = (type: 'gate' | 'break'): string => {
    if (type === 'gate') return 'blue';    // السير - أزرق
    if (type === 'break') return 'orange'; // الاستراحات - برتقالي
    return 'gray';
  };

  const getTimeSlotIcon = (type: 'gate' | 'break'): string => {
    if (type === 'gate') return '📍';
    if (type === 'break') return '☕';
    return '⏰';
  };

  // Helper: Get floor/level from subLocation name
  const getFloorFromSubLocation = (subLocationId: string | undefined, facilityId: string): string => {
    if (!subLocationId) return '';
    const facility = facilities.find(f => f.id === facilityId);
    const subLoc = facility?.subLocations?.find(sl => sl.id === subLocationId);
    return subLoc?.name || '';
  };

  // Helper: Categorize facility by name
  const categorizeFacility = (facilityName: string): 'gate' | 'front' | 'back' | 'other' => {
    const lowerName = facilityName.toLowerCase();
    if (lowerName.includes('بوابة') || lowerName.includes('gate')) return 'gate';
    if (lowerName.includes('أمامية') || lowerName.includes('امامية') || lowerName.includes('front')) return 'front';
    if (lowerName.includes('خلفية') || lowerName.includes('back')) return 'back';
    return 'other';
  };

  return (
    <div className="h-full w-full overflow-auto bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50" dir="rtl">

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-orange-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800">إدارة المناوبات</h1>
              <p className="text-xs text-gray-600 font-medium">نظام الإشراف على الاستراحات والمناوبات المدرسية</p>
            </div>
          </div>
          {/* Notification Bell */}
          {setNotifications && (
            <DutyNotificationCenter
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onDelete={handleDeleteNotification}
              onClearAll={handleClearAllNotifications}
            />
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="p-2">

        {/* System Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">

          {/* Staff Card - الطاقم */}
          {(() => {
            // Calculate employee types - use dayDutyAssignments
            const allAssignedTeacherIds = new Set(
              dayDutyAssignments.map(da => da.teacherId)
            );

            // Count by type
            const teachers = employees.filter(emp =>
              !emp.addons?.educator &&
              !emp.addons?.assistantClassId &&
              emp.addons?.coordinators?.length === 0 &&
              !emp.constraints?.isExternal
            );
            const educators = employees.filter(emp => emp.addons?.educator);
            const assistants = employees.filter(emp => emp.addons?.assistantClassId);
            const coordinators = employees.filter(emp => emp.addons?.coordinators?.length > 0);
            const externals = employees.filter(emp => emp.constraints?.isExternal);

            // Remaining (not assigned to any day via dayDutyAssignments)
            const remainingTeachers = teachers.filter(t => !allAssignedTeacherIds.has(t.id));
            const remainingEducators = educators.filter(t => !allAssignedTeacherIds.has(t.id));
            const remainingAssistants = assistants.filter(t => !allAssignedTeacherIds.has(t.id));
            const remainingCoordinators = coordinators.filter(t => !allAssignedTeacherIds.has(t.id));
            const remainingExternals = externals.filter(t => !allAssignedTeacherIds.has(t.id));

            const totalStaff = employees.length;
            const totalRemaining = totalStaff - allAssignedTeacherIds.size;

            return (
              <div className="bg-white rounded-2xl p-4 border-2 border-blue-200 shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="text-blue-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 font-medium">الطاقم</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-2xl font-black text-blue-600">{totalRemaining}</p>
                      <p className="text-xs text-gray-500">/ {totalStaff}</p>
                    </div>
                  </div>
                </div>

                {/* Employee Types with Remaining Counts */}
                <div className="space-y-1 text-[10px] mt-2 pt-2 border-t border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-1">
                      <span>👨‍🏫</span> معلمين
                    </span>
                    <span className="font-bold">
                      <span className="text-blue-700">{remainingTeachers.length}</span>
                      <span className="text-gray-400">/{teachers.length}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-1">
                      <span>🏫</span> مربي صف
                    </span>
                    <span className="font-bold">
                      <span className="text-purple-700">{remainingEducators.length}</span>
                      <span className="text-gray-400">/{educators.length}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-1">
                      <span>👥</span> مساعدين
                    </span>
                    <span className="font-bold">
                      <span className="text-green-700">{remainingAssistants.length}</span>
                      <span className="text-gray-400">/{assistants.length}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-1">
                      <span>📋</span> منسقين
                    </span>
                    <span className="font-bold">
                      <span className="text-amber-700">{remainingCoordinators.length}</span>
                      <span className="text-gray-400">/{coordinators.length}</span>
                    </span>
                  </div>
                  {externals.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex items-center gap-1">
                        <span>🌍</span> خارجيين
                      </span>
                      <span className="font-bold">
                        <span className="text-teal-700">{remainingExternals.length}</span>
                        <span className="text-gray-400">/{externals.length}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mt-2 pt-2 border-t border-blue-100">
                  <div className="flex justify-between text-[9px] mb-1">
                    <span className="text-gray-500">تم التوزيع</span>
                    <span className="font-bold text-blue-600">{Math.round((allAssignedTeacherIds.size / totalStaff) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${(allAssignedTeacherIds.size / totalStaff) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Day Cards - Based on Schedule Config */}
          {(() => {
            // Get school days from config (exclude holidays, start from weekStartDay)
            const startDayIndex = DAYS_AR.indexOf(scheduleConfig.weekStartDay);
            const sortedDays = [...DAYS_AR.slice(startDayIndex), ...DAYS_AR.slice(0, startDayIndex)];
            const schoolDays = sortedDays.filter(day => !(scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(day)));

            const dayColors = [
              { bg: 'purple', light: 'purple-50', border: 'purple-200', text: 'purple-600' },
              { bg: 'amber', light: 'amber-50', border: 'amber-200', text: 'amber-600' },
              { bg: 'green', light: 'green-50', border: 'green-200', text: 'green-600' },
              { bg: 'teal', light: 'teal-50', border: 'teal-200', text: 'teal-600' },
              { bg: 'indigo', light: 'indigo-50', border: 'indigo-200', text: 'indigo-600' },
              { bg: 'rose', light: 'rose-50', border: 'rose-200', text: 'rose-600' },
              { bg: 'cyan', light: 'cyan-50', border: 'cyan-200', text: 'cyan-600' },
            ];

            return schoolDays.map((dayName, index) => {
              // Get the actual day index in DAYS_AR
              const dayOfWeek = DAYS_AR.indexOf(dayName);

              // Get teachers assigned for this day from dayDutyAssignments
              const fullDutyTeachers = dayDutyAssignments
                .filter(a => a.dayName === dayName && a.dutyType === 'full')
                .map(a => employees.find(e => e.id === a.teacherId))
                .filter(Boolean) as Employee[];

              const halfDutyTeachers = dayDutyAssignments
                .filter(a => a.dayName === dayName && a.dutyType === 'half')
                .map(a => employees.find(e => e.id === a.teacherId))
                .filter(Boolean) as Employee[];

              const color = dayColors[index % dayColors.length];

              // Use FULL day name as requested by user (consistent with settings)
              const displayDayName = dayName;

              return (
                <div key={dayName} className={`bg-white rounded-2xl p-3 border-2 border-${color.border} shadow-md`}>
                  {/* Day Header - Clickable to open both types */}
                  <button
                    onClick={() => setDayDutyModal({ isOpen: true, dayName, dayIndex: dayOfWeek, dutyType: null })}
                    className="w-full flex items-center justify-center gap-2 mb-2 hover:opacity-70 transition-opacity"
                  >
                    <Calendar className={`text-${color.text}`} size={16} />
                    <p className={`text-sm font-black text-${color.text}`}>{displayDayName}</p>
                  </button>

                  {/* Two Vertical Cards - Clickable */}
                  <div className="space-y-2">
                    {/* Full Duty Card - Clickable */}
                    <button
                      onClick={() => setDayDutyModal({ isOpen: true, dayName, dayIndex: dayOfWeek, dutyType: 'full' })}
                      className={`w-full bg-${color.light} rounded-lg p-2 border border-${color.border} hover:ring-2 hover:ring-${color.text} transition-all text-right`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-[10px] font-bold text-gray-700">مناوبة كاملة</p>
                        <span className="mr-auto text-[9px] bg-green-100 text-green-700 px-1 rounded font-bold">{fullDutyTeachers.length}</span>
                      </div>
                      <div className="min-h-[40px]">
                        {fullDutyTeachers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {fullDutyTeachers.slice(0, 3).map(teacher => (
                              <span key={teacher.id} className="px-1.5 py-0.5 bg-white rounded text-[9px] font-bold text-gray-700 border border-gray-200 truncate max-w-[60px]" title={teacher.name}>
                                {teacher.name.split(' ')[0]}
                              </span>
                            ))}
                            {fullDutyTeachers.length > 3 && (
                              <span className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px] font-bold text-gray-600">
                                +{fullDutyTeachers.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[9px] text-gray-400 italic">اضغط للتحديد</p>
                        )}
                      </div>
                    </button>

                    {/* Half Duty Card - Clickable */}
                    <button
                      onClick={() => setDayDutyModal({ isOpen: true, dayName, dayIndex: dayOfWeek, dutyType: 'half' })}
                      className={`w-full bg-${color.light} rounded-lg p-2 border border-${color.border} hover:ring-2 hover:ring-${color.text} transition-all text-right`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <p className="text-[10px] font-bold text-gray-700">نصف مناوبة</p>
                        <span className="mr-auto text-[9px] bg-yellow-100 text-yellow-700 px-1 rounded font-bold">{halfDutyTeachers.length}</span>
                      </div>
                      <div className="min-h-[40px]">
                        {halfDutyTeachers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {halfDutyTeachers.slice(0, 3).map(teacher => (
                              <span key={teacher.id} className="px-1.5 py-0.5 bg-white rounded text-[9px] font-bold text-gray-700 border border-gray-200 truncate max-w-[60px]" title={teacher.name}>
                                {teacher.name.split(' ')[0]}
                              </span>
                            ))}
                            {halfDutyTeachers.length > 3 && (
                              <span className="px-1.5 py-0.5 bg-gray-200 rounded text-[9px] font-bold text-gray-600">
                                +{halfDutyTeachers.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[9px] text-gray-400 italic">اضغط للتحديد</p>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Day Total */}
                  <div className="mt-2 pt-2 border-t border-gray-200 text-center">
                    <p className="text-[10px] text-gray-600">
                      المجموع: <span className={`font-bold text-${color.text}`}>{fullDutyTeachers.length + halfDutyTeachers.length}</span>
                    </p>
                  </div>
                </div>
              );
            });
          })()}

        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="ابحث عن معلم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-orange-400 focus:outline-none"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium focus:border-orange-400 focus:outline-none"
            >
              <option value="all">الكل</option>
              <option value="internal">داخلي</option>
              <option value="external">خارجي</option>
            </select>

            {/* Workload Filter */}
            <select
              value={filterWorkload}
              onChange={(e) => setFilterWorkload(e.target.value as any)}
              className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium focus:border-orange-400 focus:outline-none"
            >
              <option value="all">كل الأنصبة</option>
              <option value="full">نصاب كامل</option>
              <option value="half">نصف نصاب</option>
            </select>

            {/* Capacity Filter */}
            <select
              value={filterCapacity}
              onChange={(e) => setFilterCapacity(e.target.value as any)}
              className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium focus:border-orange-400 focus:outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="available">🟢 متاح</option>
              <option value="loaded">🟡 محمل</option>
              <option value="overloaded">🔴 زائد</option>
            </select>
          </div>
        </div>

        {/* Single Column Layout: Teachers */}
        <div className="mb-4">

          {/* Teacher List */}
          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                  <Users className="text-blue-600" size={20} />
                  قائمة المعلمين ({filteredTeachers.length})
                </h2>

                {/* Select All Checkbox */}
                {!teacherListCollapsed && (
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors border border-blue-200">
                    <input
                      type="checkbox"
                      checked={selectedTeacherIds.length === filteredTeachers.length && filteredTeachers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTeacherIds(filteredTeachers.map(tw => tw.teacher.id));
                        } else {
                          setSelectedTeacherIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-blue-700">
                      {selectedTeacherIds.length === filteredTeachers.length && filteredTeachers.length > 0 ? '✅ إلغاء الكل' : '☐ اختر الكل'}
                      {selectedTeacherIds.length > 0 && ` (${selectedTeacherIds.length})`}
                    </span>
                  </label>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Toggle Collapse Button */}
                <button
                  onClick={() => setTeacherListCollapsed(!teacherListCollapsed)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {teacherListCollapsed ? (
                    <>
                      <ChevronDown size={16} className="text-gray-600" />
                      <span className="text-xs font-bold text-gray-700">إظهار</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp size={16} className="text-gray-600" />
                      <span className="text-xs font-bold text-gray-700">إخفاء</span>
                    </>
                  )}
                </button>

                {/* Status Legend */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    متاح
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    محمل
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    زائد
                  </span>
                </div>
              </div>
            </div>

            {/* Collapsible Content */}
            {!teacherListCollapsed && (
              <>
                {/* Bulk Actions Toolbar */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-200 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="text-blue-600" size={18} />
                    <h3 className="text-sm font-black text-gray-800">تطبيق جماعي على جميع المعلمين المعروضين</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Bulk Employment Ratio */}
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <label className="text-[10px] text-gray-600 font-medium mb-1 block">💼 نسبة الوظيفة (جماعي)</label>
                      <div className="flex gap-2">
                        <select
                          id="bulk-employment-ratio"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-[10px] font-bold focus:border-blue-400 focus:outline-none"
                        >
                          <option value="">— اختر —</option>
                          <option value="full">✅ كامل</option>
                          <option value="partial">🔹 جزئي</option>
                        </select>
                        <button
                          onClick={() => {
                            if (selectedTeacherIds.length === 0) {
                              alert('⚠️ يرجى تحديد معلم واحد على الأقل');
                              return;
                            }
                            const select = document.getElementById('bulk-employment-ratio') as HTMLSelectElement;
                            if (!select.value) {
                              alert('يرجى اختيار قيمة');
                              return;
                            }
                            const value = select.value as 'full' | 'partial';
                            setEmployees(prev => prev.map(emp => {
                              // Only update selected teachers
                              if (!selectedTeacherIds.includes(emp.id)) return emp;

                              return {
                                ...emp,
                                dutySettings: {
                                  employmentRatio: value,
                                  fullDutyDay: emp.dutySettings?.fullDutyDay || undefined,
                                  halfDutyDay: emp.dutySettings?.halfDutyDay || undefined,
                                  exemptFromDuty: emp.dutySettings?.exemptFromDuty || false
                                }
                              };
                            }));
                            alert(`✅ تم تطبيق "${value === 'full' ? 'كامل' : 'جزئي'}" على ${selectedTeacherIds.length} معلم`);
                          }}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-[10px] font-bold transition-colors"
                        >
                          ✅ تطبيق
                        </button>
                      </div>
                    </div>

                    {/* Bulk Full Duty Day */}
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <label className="text-[10px] text-gray-600 font-medium mb-1 block">📅 مناوبة كاملة (جماعي)</label>
                      <div className="flex gap-2">
                        <select
                          id="bulk-full-duty-day"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-[10px] font-bold focus:border-green-400 focus:outline-none"
                        >
                          <option value="">— اختر —</option>
                          <option value="none">❌ لا يوجد</option>
                          {academicYear.defaultWeekdays.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (selectedTeacherIds.length === 0) {
                              alert('⚠️ يرجى تحديد معلم واحد على الأقل');
                              return;
                            }
                            const select = document.getElementById('bulk-full-duty-day') as HTMLSelectElement;
                            if (!select.value) {
                              alert('يرجى اختيار قيمة');
                              return;
                            }
                            const value = select.value;
                            setEmployees(prev => prev.map(emp => {
                              if (!selectedTeacherIds.includes(emp.id)) return emp;

                              return {
                                ...emp,
                                dutySettings: {
                                  employmentRatio: emp.dutySettings?.employmentRatio || 'full',
                                  fullDutyDay: value === 'none' ? undefined : value,
                                  halfDutyDay: emp.dutySettings?.halfDutyDay || undefined,
                                  exemptFromDuty: emp.dutySettings?.exemptFromDuty || false
                                }
                              };
                            }));
                            alert(`✅ تم تطبيق "${value === 'none' ? 'لا يوجد' : value}" على ${selectedTeacherIds.length} معلم`);
                          }}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-[10px] font-bold transition-colors"
                        >
                          ✅ تطبيق
                        </button>
                      </div>
                    </div>

                    {/* Bulk Half Duty Day */}
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <label className="text-[10px] text-gray-600 font-medium mb-1 block">⏰ نصف نوبة (جماعي)</label>
                      <div className="flex gap-2">
                        <select
                          id="bulk-half-duty-day"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-[10px] font-bold focus:border-purple-400 focus:outline-none"
                        >
                          <option value="">— اختر —</option>
                          <option value="none">❌ لا يوجد</option>
                          {academicYear.defaultWeekdays.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (selectedTeacherIds.length === 0) {
                              alert('⚠️ يرجى تحديد معلم واحد على الأقل');
                              return;
                            }
                            const select = document.getElementById('bulk-half-duty-day') as HTMLSelectElement;
                            if (!select.value) {
                              alert('يرجى اختيار قيمة');
                              return;
                            }
                            const value = select.value;
                            setEmployees(prev => prev.map(emp => {
                              if (!selectedTeacherIds.includes(emp.id)) return emp;

                              return {
                                ...emp,
                                dutySettings: {
                                  employmentRatio: emp.dutySettings?.employmentRatio || 'full',
                                  fullDutyDay: emp.dutySettings?.fullDutyDay || undefined,
                                  halfDutyDay: value === 'none' ? undefined : value,
                                  exemptFromDuty: emp.dutySettings?.exemptFromDuty || false
                                }
                              };
                            }));
                            alert(`✅ تم تطبيق "${value === 'none' ? 'لا يوجد' : value}" على ${selectedTeacherIds.length} معلم`);
                          }}
                          className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-[10px] font-bold transition-colors"
                        >
                          ✅ تطبيق
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto custom-scrollbar p-1">
                  {filteredTeachers.length === 0 ? (
                    <div className="col-span-4 text-center py-8 text-gray-500">
                      <Users className="mx-auto mb-2" size={32} />
                      <p className="text-sm font-medium">لا توجد نتائج</p>
                    </div>
                  ) : (
                    filteredTeachers.map((tw, idx) => {
                      const statusColor =
                        tw.availability === 'available' ? 'emerald' :
                          tw.availability === 'loaded' ? 'yellow' : 'red';

                      const isDraggable = tw.capacity > 0; // Only draggable if has capacity
                      const dutyCount = getDutyCount(String(tw.teacher.id), formatDateForAssignment(selectedDate));

                      return (
                        <div
                          key={tw.teacher.id}
                          draggable={isDraggable}
                          onDragStart={(e) => isDraggable && handleDragStart(e, tw.teacher)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            // Toggle selection on card click (but not when dragging or clicking checkbox)
                            if (!isDraggable) return; // Don't allow selection if not draggable

                            // Check if click target is checkbox or its label
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
                              return; // Let checkbox handle its own event
                            }

                            // Toggle selection
                            if (selectedTeacherIds.includes(tw.teacher.id)) {
                              setSelectedTeacherIds(prev => prev.filter(id => id !== tw.teacher.id));
                            } else {
                              setSelectedTeacherIds(prev => [...prev, tw.teacher.id]);
                            }
                          }}
                          title={`المناوبات: ${dutyCount} | السعة: ${tw.capacity} ساعات`}
                          className={`p-2 rounded-lg border-2 transition-all ${selectedTeacherIds.includes(tw.teacher.id)
                            ? 'border-blue-500 bg-blue-100 shadow-md'
                            : `border-${statusColor}-200 bg-${statusColor}-50/30 hover:bg-${statusColor}-50`
                            } ${isDraggable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                            }`}
                        >
                          {/* Header: Name + Score */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-1">
                                {/* Selection Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={selectedTeacherIds.includes(tw.teacher.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (e.target.checked) {
                                      setSelectedTeacherIds(prev => [...prev, tw.teacher.id]);
                                    } else {
                                      setSelectedTeacherIds(prev => prev.filter(id => id !== tw.teacher.id));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                />
                                {isDraggable && <GripVertical size={12} className="text-gray-400 flex-shrink-0" />}
                                <span className={`w-2 h-2 rounded-full bg-${statusColor}-500 flex-shrink-0`}></span>
                                <h3 className="font-black text-xs text-gray-800 truncate">{tw.teacher.name}</h3>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                {tw.teacher.constraints?.isExternal && (
                                  <span className="text-[8px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">خارجي</span>
                                )}
                                {tw.teacher.constraints?.isHalfTime && (
                                  <span className="text-[8px] px-1 py-0.5 bg-purple-100 text-purple-700 rounded font-bold">نصف</span>
                                )}
                                {/* NEW: Show day duty assignment(s) - can have both full and half */}
                                {(() => {
                                  const teacherAssignments = dayDutyAssignments.filter(a => a.teacherId === Number(tw.teacher.id));
                                  if (teacherAssignments.length === 0) return null;

                                  return teacherAssignments.map(dayAssign => {
                                    const shortDay = dayAssign.dayName.replace('ال', '');
                                    const typeLabel = dayAssign.dutyType === 'full' ? 'كاملة' : 'نصف';
                                    return (
                                      <span
                                        key={`${dayAssign.dayName}-${dayAssign.dutyType}`}
                                        className={`text-[8px] px-1 py-0.5 rounded font-bold flex items-center gap-0.5 ${dayAssign.dutyType === 'full'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-yellow-100 text-yellow-700'
                                          }`}
                                      >
                                        📅 {shortDay} ({typeLabel})
                                      </span>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                            <div className="text-center flex-shrink-0">
                              <div className={`text-xl font-black text-${statusColor}-600`}>
                                {tw.score}
                              </div>
                              <div className="text-[8px] text-gray-500 font-medium">نقاط</div>
                            </div>
                          </div>

                          {/* Duty Settings Dropdowns - 2x2 Grid (Compact) */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Employment Ratio */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-gray-600 font-medium">💼 نسبة الوظيفة</label>
                              <select
                                value={tw.teacher.dutySettings?.employmentRatio || (tw.total < tw.teacher.contractedHours ? 'partial' : 'full')}
                                onChange={(e) => {
                                  const updatedTeacher = {
                                    ...tw.teacher,
                                    dutySettings: {
                                      ...tw.teacher.dutySettings,
                                      employmentRatio: e.target.value as 'full' | 'partial',
                                      fullDutyDay: tw.teacher.dutySettings?.fullDutyDay || undefined,
                                      halfDutyDay: tw.teacher.dutySettings?.halfDutyDay || undefined,
                                      exemptFromDuty: tw.teacher.dutySettings?.exemptFromDuty || false
                                    }
                                  };
                                  setEmployees(prev => prev.map(emp => emp.id === tw.teacher.id ? updatedTeacher : emp));
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-[10px] font-bold focus:border-blue-400 focus:outline-none"
                              >
                                <option value="full">✅ كامل</option>
                                <option value="partial">🔹 جزئي</option>
                              </select>
                            </div>

                            {/* Full Duty Day */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-gray-600 font-medium">📅 مناوبة كاملة</label>
                              <select
                                value={tw.teacher.dutySettings?.fullDutyDay || 'none'}
                                onChange={(e) => {
                                  const newDay = e.target.value === 'none' ? undefined : e.target.value;
                                  const updatedTeacher = {
                                    ...tw.teacher,
                                    dutySettings: {
                                      employmentRatio: tw.teacher.dutySettings?.employmentRatio || (tw.total < tw.teacher.contractedHours ? 'partial' : 'full'),
                                      fullDutyDay: newDay,
                                      halfDutyDay: tw.teacher.dutySettings?.halfDutyDay || undefined,
                                      exemptFromDuty: tw.teacher.dutySettings?.exemptFromDuty || false
                                    }
                                  };
                                  setEmployees(prev => prev.map(emp => Number(emp.id) === Number(tw.teacher.id) ? updatedTeacher : emp));

                                  // SYNC: Update dayDutyAssignments
                                  if (newDay) {
                                    setDayDutyAssignments(prev => [
                                      ...prev.filter(a => a.teacherId !== Number(tw.teacher.id)),
                                      { teacherId: Number(tw.teacher.id), dayName: newDay, dutyType: 'full' }
                                    ]);
                                  } else {
                                    // Remove assignment if set to none
                                    const currentAssign = dayDutyAssignments.find(a => a.teacherId === Number(tw.teacher.id) && a.dutyType === 'full');
                                    if (currentAssign) {
                                      setDayDutyAssignments(prev => prev.filter(a => !(a.teacherId === Number(tw.teacher.id) && a.dutyType === 'full')));
                                    }
                                  }
                                }}
                                className={`w-full px-2 py-1 border rounded text-[10px] font-bold focus:border-blue-400 focus:outline-none ${tw.teacher.dutySettings?.fullDutyDay ? 'border-green-400 bg-green-50' : 'border-gray-300'
                                  }`}
                              >
                                <option value="none">❌ لا يوجد</option>
                                {DAYS_AR.filter(day => !(scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(day))).map(day => (
                                  <option key={day} value={day}>{day}</option>
                                ))}
                              </select>
                            </div>

                            {/* Half Duty Day */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-gray-600 font-medium">⏰ نصف نوبة</label>
                              <select
                                value={tw.teacher.dutySettings?.halfDutyDay || 'none'}
                                onChange={(e) => {
                                  const newDay = e.target.value === 'none' ? undefined : e.target.value;
                                  const updatedTeacher = {
                                    ...tw.teacher,
                                    dutySettings: {
                                      employmentRatio: tw.teacher.dutySettings?.employmentRatio || (tw.total < tw.teacher.contractedHours ? 'partial' : 'full'),
                                      fullDutyDay: tw.teacher.dutySettings?.fullDutyDay || undefined,
                                      halfDutyDay: newDay,
                                      exemptFromDuty: tw.teacher.dutySettings?.exemptFromDuty || false
                                    }
                                  };
                                  setEmployees(prev => prev.map(emp => Number(emp.id) === Number(tw.teacher.id) ? updatedTeacher : emp));

                                  // SYNC: Update dayDutyAssignments
                                  if (newDay) {
                                    setDayDutyAssignments(prev => [
                                      ...prev.filter(a => a.teacherId !== Number(tw.teacher.id)),
                                      { teacherId: Number(tw.teacher.id), dayName: newDay, dutyType: 'half' }
                                    ]);
                                  } else {
                                    // Remove assignment if set to none
                                    const currentAssign = dayDutyAssignments.find(a => a.teacherId === Number(tw.teacher.id) && a.dutyType === 'half');
                                    if (currentAssign) {
                                      setDayDutyAssignments(prev => prev.filter(a => !(a.teacherId === Number(tw.teacher.id) && a.dutyType === 'half')));
                                    }
                                  }
                                }}
                                className={`w-full px-2 py-1 border rounded text-[10px] font-bold focus:border-blue-400 focus:outline-none ${tw.teacher.dutySettings?.halfDutyDay ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                                  }`}
                              >
                                <option value="none">❌ لا يوجد</option>
                                {DAYS_AR.filter(day => !(scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(day))).map(day => (
                                  <option key={day} value={day}>{day}</option>
                                ))}
                              </select>
                            </div>

                            {/* Exempt from Duty */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-gray-600 font-medium">✋ معفي</label>
                              <select
                                value={tw.teacher.dutySettings?.exemptFromDuty ? 'yes' : 'no'}
                                onChange={(e) => {
                                  const updatedTeacher = {
                                    ...tw.teacher,
                                    dutySettings: {
                                      employmentRatio: tw.teacher.dutySettings?.employmentRatio || (tw.total < tw.teacher.contractedHours ? 'partial' : 'full'),
                                      fullDutyDay: tw.teacher.dutySettings?.fullDutyDay || undefined,
                                      halfDutyDay: tw.teacher.dutySettings?.halfDutyDay || undefined,
                                      exemptFromDuty: e.target.value === 'yes'
                                    }
                                  };
                                  setEmployees(prev => prev.map(emp => emp.id === tw.teacher.id ? updatedTeacher : emp));
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-[10px] font-bold focus:border-blue-400 focus:outline-none"
                              >
                                <option value="no">❌ لا</option>
                                <option value="yes">✅ نعم</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

        </div>

        {/* NEW: Main Tabs (Timeline | Facilities | Settings) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 px-4 py-3 font-black text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'timeline'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-b-4 border-blue-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Calendar size={20} />
              جدول المناوبات
            </button>
            <button
              onClick={() => setActiveTab('facilities')}
              className={`flex-1 px-4 py-3 font-black text-sm transition-all flex items-center justify-center gap-2 border-r border-gray-200 ${activeTab === 'facilities'
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-b-4 border-green-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Building2 size={20} />
              إدارة المرافق
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-4 py-3 font-black text-sm transition-all flex items-center justify-center gap-2 border-r border-gray-200 ${activeTab === 'settings'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border-b-4 border-purple-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Shield size={20} />
              ⚙️ إعدادات المناوبات
            </button>
          </div>
        </div>

        {/* Tab Content: Timeline */}
        {activeTab === 'timeline' && (
          <>
            {/* Timeline Schedule Accordion */}
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm mb-4 overflow-hidden">
              {/* Accordion Header/Toggle */}
              <button
                onClick={() => setTimelineExpanded(!timelineExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="text-blue-600" size={16} />
                  </div>
                  <div className="text-right">
                    <h2 className="text-base font-black text-gray-800">جدول المناوبات الزمني</h2>
                    <p className="text-[10px] text-gray-600">تخصيص المعلمين للمرافق حسب فترات الاستراحة</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600">
                    {dutyAssignments.length} تخصيص
                  </span>
                  {timelineExpanded ? (
                    <ChevronUp className="text-blue-600" size={24} />
                  ) : (
                    <ChevronDown className="text-blue-600" size={24} />
                  )}
                </div>
              </button>

              {/* Accordion Content */}
              {timelineExpanded && (
                <div className="px-3 py-3 border-t border-blue-100 bg-blue-50/30">

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-blue-100">
                    <button
                      onClick={handleAutoFillAll}
                      disabled={autoFillProgress?.isRunning}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles size={18} />
                      ملء تلقائي للكل
                    </button>

                    <button
                      onClick={handleClearAll}
                      disabled={autoFillProgress?.isRunning}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={18} />
                      مسح الكل
                    </button>

                    {/* Progress Bar */}
                    {autoFillProgress && autoFillProgress.isRunning && (
                      <div className="flex-1 bg-white rounded-lg p-3 border-2 border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-700">
                            جاري التخصيص... {autoFillProgress.current}/{autoFillProgress.total}
                          </span>
                          <span className="text-xs font-bold text-blue-600">
                            {Math.round((autoFillProgress.current / autoFillProgress.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(autoFillProgress.current / autoFillProgress.total) * 100}%` }}
                          ></div>
                        </div>
                        {autoFillProgress.currentBreak && (
                          <p className="text-xs text-gray-600 mt-1">
                            {autoFillProgress.currentBreak} - {autoFillProgress.currentFacility}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Controls Bar */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-blue-100">
                    <div className="flex items-center gap-3">
                      {/* Date Picker */}
                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border-2 border-gray-200">
                        <Calendar size={16} className="text-gray-500" />
                        <input
                          type="date"
                          value={selectedDate.toISOString().split('T')[0]}
                          onChange={(e) => setSelectedDate(new Date(e.target.value))}
                          className="text-sm font-medium focus:outline-none"
                        />
                      </div>

                      {/* View Toggle */}
                      <div className="flex bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                        <button
                          onClick={() => setViewMode('timeline-cards')}
                          className={`px-4 py-2 text-sm font-bold transition-colors ${viewMode === 'timeline-cards'
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          🎴 بطاقات
                        </button>
                        <button
                          onClick={() => setViewMode('daily')}
                          className={`px-4 py-2 text-sm font-bold transition-colors border-r-2 border-gray-200 ${viewMode === 'daily'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          يومي
                        </button>
                        <button
                          onClick={() => setViewMode('weekly')}
                          className={`px-4 py-2 text-sm font-bold transition-colors border-r-2 border-gray-200 ${viewMode === 'weekly'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          أسبوعي
                        </button>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-green-500"></span>
                        مكتمل
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-yellow-500"></span>
                        ناقص
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-red-500"></span>
                        فارغ
                      </span>
                    </div>
                  </div>

                  {/* Timeline Grid */}
                  {viewMode === 'daily' && (
                    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-auto" style={{ maxHeight: '500px' }}>
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-right text-xs font-black text-gray-700 border-b-2 border-gray-200 min-w-[120px]">
                              فترة الاستراحة
                            </th>
                            {facilities.map(facility => (
                              <th
                                key={facility.id}
                                className="px-4 py-3 text-center text-xs font-black text-gray-700 border-b-2 border-gray-200 min-w-[150px]"
                              >
                                {facility.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {breakPeriods.map(breakPeriod => (
                            <tr key={breakPeriod.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 border-b border-gray-200">
                                <div className="text-right">
                                  <p className="text-sm font-black text-gray-800">{breakPeriod.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {breakPeriod.startTime} - {breakPeriod.endTime}
                                  </p>
                                </div>
                              </td>
                              {facilities.map(facility => {
                                const date = formatDateForAssignment(selectedDate);
                                const assignments = getAssignmentsForCell(breakPeriod.id, facility.id, date);
                                const coverageStatus = getCellCoverageStatus(breakPeriod.id, facility.id, date);

                                const cellBgColor =
                                  coverageStatus === 'staffed' ? 'bg-green-50' :
                                    coverageStatus === 'understaffed' ? 'bg-yellow-50' : 'bg-red-50';

                                const cellBorderColor =
                                  coverageStatus === 'staffed' ? 'border-green-200' :
                                    coverageStatus === 'understaffed' ? 'border-yellow-200' : 'border-red-200';

                                return (
                                  <td
                                    key={facility.id}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, breakPeriod.id, facility.id)}
                                    onClick={(e) => handleCellClick(e, breakPeriod.id, facility.id)}
                                    className={`px-2 py-2 border-b border-gray-200 ${cellBgColor} border-2 ${cellBorderColor} cursor-pointer transition-colors hover:opacity-80 relative`}
                                  >
                                    <div className="min-h-[60px] space-y-1">
                                      {assignments.length === 0 ? (
                                        <div className="text-center py-2">
                                          <div className="text-xs text-gray-400 mb-1">اسحب معلم هنا</div>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleCellClick(e, breakPeriod.id, facility.id); }}
                                            className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-bold transition-colors flex items-center gap-1 mx-auto"
                                          >
                                            <Sparkles size={12} />
                                            اقتراحات
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          {assignments.map(assignment => {
                                            const teacher = employees.find(e => e.id === assignment.teacherId);
                                            if (!teacher) return null;

                                            return (
                                              <div
                                                key={assignment.id}
                                                className="flex items-center justify-between bg-white rounded px-2 py-1 shadow-sm group"
                                              >
                                                <div className="flex items-center gap-1">
                                                  <CheckCircle2 size={12} className="text-green-600" />
                                                  <span className="text-xs font-bold text-gray-800">{teacher.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSwapAssignment(assignment);
                                                      setSwapModalOpen(true);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-blue-100 rounded transition-all"
                                                    title="تبديل المناوبة"
                                                  >
                                                    <RefreshCw size={12} className="text-blue-600" />
                                                  </button>
                                                  <button
                                                    onClick={(e) => handleRemoveAssignment(assignment.id, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-all"
                                                    title="إلغاء التخصيص"
                                                  >
                                                    <X size={12} className="text-red-600" />
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                          {/* Add Teacher Button */}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleCellClick(e, breakPeriod.id, facility.id); }}
                                            className="w-full mt-1 text-[10px] px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 font-bold transition-colors flex items-center gap-1 justify-center"
                                          >
                                            <Plus size={10} />
                                            إضافة معلم
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Weekly View */}
                  {viewMode === 'weekly' && (
                    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-auto">
                      {/* Week Navigation */}
                      <div className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 flex items-center justify-between z-10">
                        <button
                          onClick={() => navigateWeek('prev')}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-sm font-bold transition-colors"
                        >
                          <ChevronUp className="rotate-270" size={16} />
                          أسبوع سابق
                        </button>

                        <div className="text-center">
                          <p className="text-sm font-black text-gray-800">
                            {(() => {
                              const weekDates = getWeekDates(selectedDate);
                              const start = weekDates[0];
                              const end = weekDates[6];
                              return `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
                            })()}
                          </p>
                          <p className="text-xs text-gray-600">عرض أسبوعي</p>
                        </div>

                        <button
                          onClick={() => navigateWeek('next')}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-sm font-bold transition-colors"
                        >
                          أسبوع تالي
                          <ChevronDown className="rotate-90" size={16} />
                        </button>
                      </div>

                      {/* Days Header */}
                      <div className="grid grid-cols-7 border-b-2 border-gray-200 bg-gray-50">
                        {getWeekDates(selectedDate).map((date, idx) => {
                          const today = isToday(date);
                          return (
                            <div
                              key={idx}
                              className={`px-2 py-3 text-center border-l border-gray-200 ${today ? 'bg-blue-100' : ''
                                }`}
                            >
                              <p className={`text-xs font-black ${today ? 'text-blue-700' : 'text-gray-700'
                                }`}>
                                {getDayName(date)}
                              </p>
                              <p className={`text-[10px] ${today ? 'text-blue-600 font-bold' : 'text-gray-500'
                                }`}>
                                {date.getDate()}/{date.getMonth() + 1}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Week Grid - Breaks × Days */}
                      <div className="max-h-[600px] overflow-auto">
                        {breakPeriods.map(breakPeriod => (
                          <div key={breakPeriod.id} className="border-b border-gray-200">
                            {/* Break Header */}
                            <div className="sticky left-0 bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-2 border-b border-gray-300">
                              <p className="text-sm font-black text-gray-800">{breakPeriod.name}</p>
                              <p className="text-xs text-gray-600">{breakPeriod.startTime} - {breakPeriod.endTime}</p>
                            </div>

                            {/* Days Grid for this Break */}
                            <div className="grid grid-cols-7">
                              {getWeekDates(selectedDate).map((date, dayIdx) => {
                                const dateStr = formatDateForAssignment(date);
                                const today = isToday(date);

                                // Get all assignments for this break on this day
                                const dayAssignments = dutyAssignments.filter(
                                  a => a.breakPeriodId === breakPeriod.id && a.date === dateStr
                                );

                                // Group by facility
                                const facilityGroups = facilities.map(facility => {
                                  const facilityAssignments = dayAssignments.filter(
                                    a => a.facilityId === facility.id
                                  );
                                  return {
                                    facility,
                                    assignments: facilityAssignments
                                  };
                                });

                                return (
                                  <div
                                    key={dayIdx}
                                    className={`px-2 py-3 border-l border-gray-200 min-h-[120px] ${today ? 'bg-blue-50/30' : ''
                                      }`}
                                  >
                                    {facilityGroups.map(group => (
                                      <div key={group.facility.id} className="mb-2">
                                        {group.assignments.length > 0 && (
                                          <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
                                            <p className="text-[9px] font-bold text-gray-600 mb-1">
                                              {group.facility.name}
                                            </p>
                                            <div className="space-y-1">
                                              {group.assignments.map(assignment => {
                                                const teacher = employees.find(e => e.id === assignment.teacherId);
                                                if (!teacher) return null;
                                                return (
                                                  <div
                                                    key={assignment.id}
                                                    className="flex items-center gap-1 text-[10px]"
                                                  >
                                                    <CheckCircle2 size={10} className="text-green-600 flex-shrink-0" />
                                                    <span className="font-bold text-gray-800 truncate">
                                                      {teacher.name}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}

                                    {dayAssignments.length === 0 && (
                                      <div className="text-center text-[10px] text-gray-400 py-4">
                                        لا تخصيصات
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline Cards View (NEW) */}
                  {viewMode === 'timeline-cards' && (
                    <div className="space-y-3">
                      {/* Week Navigation */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 px-4 py-3 flex items-center justify-between">
                        <button
                          onClick={() => navigateWeek('prev')}
                          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border-2 border-purple-300 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow"
                        >
                          <ChevronUp className="rotate-270" size={18} />
                          أسبوع سابق
                        </button>

                        <div className="text-center">
                          <p className="text-lg font-black text-purple-900">
                            {(() => {
                              const weekDates = getWeekDates(selectedDate);
                              const start = weekDates[0];
                              const end = weekDates[6];
                              return `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
                            })()}
                          </p>
                          <p className="text-xs text-purple-600 font-medium">📅 الأسبوع الحالي</p>
                        </div>

                        <button
                          onClick={() => navigateWeek('next')}
                          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border-2 border-purple-300 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow"
                        >
                          أسبوع تالي
                          <ChevronDown className="rotate-90" size={18} />
                        </button>
                      </div>

                      {/* Days Rows */}
                      <div className="space-y-2">
                        {getWeekDates(selectedDate).map((dayDate, dayIdx) => {
                          const dateStr = formatDateForAssignment(dayDate);
                          const DAYS_AR_MAP = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                          const dayName = DAYS_AR_MAP[dayDate.getDay()];
                          const today = isToday(dayDate);
                          const isHoliday = (scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(dayName));

                          // Get gate assignments (السير)
                          const gateAssignments = dutyAssignments.filter(a => {
                            const facility = facilities.find(f => f.id === a.facilityId);
                            return a.date === dateStr && facility?.type === 'gate';
                          });

                          return (
                            <div
                              key={dayIdx}
                              className={`bg-white rounded-xl border ${today ? 'border-indigo-400 shadow-md ring-2 ring-indigo-200' : 'border-gray-200 shadow-sm'
                                } overflow-hidden`}
                            >
                              {/* Day Content - Horizontal Layout with Day Name on Right */}
                              <div className="flex min-h-[180px]">
                                {/* Day Name - Right Side Label (FIRST for RTL) */}
                                <div className={`w-16 flex-shrink-0 flex flex-col items-center justify-center ${today
                                  ? 'bg-gradient-to-b from-indigo-500 to-purple-500'
                                  : 'bg-gradient-to-b from-gray-100 to-gray-50'
                                  } border-l-2 ${today ? 'border-indigo-400' : 'border-gray-200'
                                  }`}>
                                  <div className={`w-10 h-10 rounded-lg ${today ? 'bg-white/20' : 'bg-white'
                                    } flex items-center justify-center shadow-sm mb-2`}>
                                    <span className="text-xl">📅</span>
                                  </div>
                                  <h3 className={`text-sm font-black ${today ? 'text-white' : 'text-gray-800'
                                    }`} style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>{dayName}</h3>
                                  <p className={`text-[10px] font-medium mt-2 ${today ? 'text-white/80' : 'text-gray-600'
                                    }`}>
                                    {dayDate.getDate()}/{dayDate.getMonth() + 1}
                                  </p>
                                  {today && (
                                    <span className="mt-2 px-2 py-1 bg-white/20 text-white text-[9px] font-black rounded-full">
                                      ⭐ اليوم
                                    </span>
                                  )}
                                </div>

                                {/* Time Slots Cards - Main Content */}
                                {isHoliday ? (
                                  <div className="flex-1 p-2 flex items-center justify-center bg-gray-50">
                                    <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-100/50 w-full">
                                      <span className="text-4xl block mb-2">🏖️</span>
                                      <h3 className="text-lg font-black text-gray-400">عطلة رسمية</h3>
                                      <p className="text-sm text-gray-500 mt-1">لا توجد مناوبات في هذا اليوم</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex-1 p-2 overflow-x-auto">
                                    <div className="flex gap-2 pb-2 custom-scrollbar" style={{ minWidth: 'max-content' }}>

                                      {/* Morning Period Card (الفترة الصباحية) - NEW STRUCTURE */}
                                      {(() => {
                                        // Get all morning assignments (gate facilities)
                                        const morningAssignments = dutyAssignments.filter(a => {
                                          const facility = facilities.find(f => f.id === a.facilityId);
                                          return a.date === dateStr && facility?.type === 'gate';
                                        });

                                        if (morningAssignments.length === 0) return null;

                                        // Categorize by facility type
                                        const gateAssignment = morningAssignments.find(a => {
                                          const facility = facilities.find(f => f.id === a.facilityId);
                                          return facility && categorizeFacility(facility.name) === 'gate';
                                        });

                                        const frontYardAssignments = morningAssignments.filter(a => {
                                          const facility = facilities.find(f => f.id === a.facilityId);
                                          return facility && categorizeFacility(facility.name) === 'front';
                                        });

                                        const backYardAssignments = morningAssignments.filter(a => {
                                          const facility = facilities.find(f => f.id === a.facilityId);
                                          return facility && categorizeFacility(facility.name) === 'back';
                                        });

                                        return (
                                          <div className="flex-shrink-0" style={{ width: '520px' }}>
                                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-300 shadow-sm hover:shadow-md transition-all h-full">
                                              {/* Header */}
                                              <div className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 border-b-2 border-green-300 rounded-t-xl">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-xl">🌅</span>
                                                    <h4 className="text-sm font-black text-green-900">الفترة الصباحية</h4>
                                                  </div>
                                                  <div className="text-xs text-green-700 font-bold flex items-center gap-1">
                                                    <Clock size={12} />
                                                    7:30 - 8:00
                                                  </div>
                                                </div>
                                              </div>

                                              {/* 3 Sections Grid */}
                                              <div className="p-3 grid grid-cols-3 gap-2">

                                                {/* Section 1: السير (Gate Guard) */}
                                                <div className="bg-white/70 rounded-lg border-2 border-green-200 p-2">
                                                  <div className="flex items-center gap-1 mb-2 pb-1 border-b border-green-200">
                                                    <span className="text-sm">📍</span>
                                                    <p className="text-xs font-black text-green-900">السير</p>
                                                  </div>
                                                  {gateAssignment ? (() => {
                                                    const teacher = employees.find(e => String(e.id) === String(gateAssignment.teacherId));
                                                    const floor = getFloorFromSubLocation(gateAssignment.subLocationId, gateAssignment.facilityId);

                                                    if (!teacher) return <p className="text-[10px] text-green-400 text-center py-1">💭 فارغ</p>;

                                                    return (
                                                      <div className="bg-green-50 rounded px-2 py-1 border border-green-300 group relative hover:bg-green-100 transition-colors">
                                                        <div className="flex items-center justify-between gap-1">
                                                          <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-bold text-green-900 truncate" title={teacher.name}>
                                                              👤 {teacher.name}
                                                            </p>
                                                            {floor && (
                                                              <p className="text-[9px] text-green-600 truncate" title={floor}>
                                                                {floor}
                                                              </p>
                                                            )}
                                                          </div>
                                                          {/* Edit/Delete Buttons */}
                                                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSwapAssignment(gateAssignment);
                                                                setSwapModalOpen(true);
                                                              }}
                                                              className="p-0.5 hover:bg-green-200 rounded transition-colors"
                                                              title="تبديل"
                                                            >
                                                              <RefreshCw size={10} className="text-green-700" />
                                                            </button>
                                                            <button
                                                              onClick={(e) => handleRemoveAssignment(gateAssignment.id, e)}
                                                              className="p-0.5 hover:bg-red-200 rounded transition-colors"
                                                              title="حذف"
                                                            >
                                                              <X size={10} className="text-red-600" />
                                                            </button>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    );
                                                  })() : (
                                                    <p className="text-[10px] text-green-400 text-center py-1">💭 فارغ</p>
                                                  )}
                                                </div>

                                                {/* Section 2: الساحة الأمامية (Front Yard) */}
                                                <div className="bg-white/70 rounded-lg border-2 border-green-200 p-2">
                                                  <div className="flex items-center gap-1 mb-2 pb-1 border-b border-green-200">
                                                    <span className="text-sm">🏛️</span>
                                                    <p className="text-xs font-black text-green-900">الساحة الأمامية</p>
                                                  </div>
                                                  <div className="space-y-1 max-h-20 overflow-y-auto custom-scrollbar">
                                                    {frontYardAssignments.length > 0 ? frontYardAssignments.map((assignment, idx) => {
                                                      const teacher = employees.find(e => String(e.id) === String(assignment.teacherId));
                                                      const floor = getFloorFromSubLocation(assignment.subLocationId, assignment.facilityId);

                                                      if (!teacher) return null;

                                                      return (
                                                        <div key={idx} className="bg-green-50 rounded px-2 py-1 border border-green-300 group relative hover:bg-green-100 transition-colors">
                                                          <div className="flex items-center justify-between gap-1">
                                                            <div className="flex-1 min-w-0">
                                                              <p className="text-[11px] font-bold text-green-900 truncate" title={teacher.name}>
                                                                👤 {teacher.name}
                                                              </p>
                                                              {floor && (
                                                                <p className="text-[9px] text-green-600 truncate" title={floor}>
                                                                  {floor}
                                                                </p>
                                                              )}
                                                            </div>
                                                            {/* Edit/Delete Buttons */}
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                              <button
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setSwapAssignment(assignment);
                                                                  setSwapModalOpen(true);
                                                                }}
                                                                className="p-0.5 hover:bg-green-200 rounded transition-colors"
                                                                title="تبديل"
                                                              >
                                                                <RefreshCw size={10} className="text-green-700" />
                                                              </button>
                                                              <button
                                                                onClick={(e) => handleRemoveAssignment(assignment.id, e)}
                                                                className="p-0.5 hover:bg-red-200 rounded transition-colors"
                                                                title="حذف"
                                                              >
                                                                <X size={10} className="text-red-600" />
                                                              </button>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      );
                                                    }) : (
                                                      <p className="text-[10px] text-green-400 text-center py-1">💭 فارغ</p>
                                                    )}
                                                  </div>
                                                </div>

                                                {/* Section 3: الساحة الخلفية (Back Yard) */}
                                                <div className="bg-white/70 rounded-lg border-2 border-green-200 p-2">
                                                  <div className="flex items-center gap-1 mb-2 pb-1 border-b border-green-200">
                                                    <span className="text-sm">🏛️</span>
                                                    <p className="text-xs font-black text-green-900">الساحة الخلفية</p>
                                                  </div>
                                                  <div className="space-y-1 max-h-20 overflow-y-auto custom-scrollbar">
                                                    {backYardAssignments.length > 0 ? backYardAssignments.map((assignment, idx) => {
                                                      const teacher = employees.find(e => String(e.id) === String(assignment.teacherId));
                                                      const floor = getFloorFromSubLocation(assignment.subLocationId, assignment.facilityId);

                                                      if (!teacher) return null;

                                                      return (
                                                        <div key={idx} className="bg-green-50 rounded px-2 py-1 border border-green-300 group relative hover:bg-green-100 transition-colors">
                                                          <div className="flex items-center justify-between gap-1">
                                                            <div className="flex-1 min-w-0">
                                                              <p className="text-[11px] font-bold text-green-900 truncate" title={teacher.name}>
                                                                👤 {teacher.name}
                                                              </p>
                                                              {floor && (
                                                                <p className="text-[9px] text-green-600 truncate" title={floor}>
                                                                  {floor}
                                                                </p>
                                                              )}
                                                            </div>
                                                            {/* Edit/Delete Buttons */}
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                              <button
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setSwapAssignment(assignment);
                                                                  setSwapModalOpen(true);
                                                                }}
                                                                className="p-0.5 hover:bg-green-200 rounded transition-colors"
                                                                title="تبديل"
                                                              >
                                                                <RefreshCw size={10} className="text-green-700" />
                                                              </button>
                                                              <button
                                                                onClick={(e) => handleRemoveAssignment(assignment.id, e)}
                                                                className="p-0.5 hover:bg-red-200 rounded transition-colors"
                                                                title="حذف"
                                                              >
                                                                <X size={10} className="text-red-600" />
                                                              </button>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      );
                                                    }) : (
                                                      <p className="text-[10px] text-green-400 text-center py-1">💭 فارغ</p>
                                                    )}
                                                  </div>
                                                </div>

                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* Break Period Cards - NEW STRUCTURE WITH INTERNAL/EXTERNAL */}
                                      {breakPeriods.map(breakPeriod => {
                                        const breakAssignments = dutyAssignments.filter(a =>
                                          a.date === dateStr && a.breakPeriodId === breakPeriod.id
                                        );

                                        // Get ALL facilities grouped by type (not just those with assignments)
                                        const allInternalFacilities = facilities.filter(f =>
                                          f.locationType === 'internal' || !f.locationType
                                        );

                                        const allExternalFacilities = facilities.filter(f =>
                                          f.locationType === 'external'
                                        );

                                        // Group by locationType (internal/external) - for assignments
                                        const internalFacilities = facilities.filter(f =>
                                          breakAssignments.some(a => a.facilityId === f.id) &&
                                          (f.locationType === 'internal' || !f.locationType)
                                        );

                                        const externalFacilities = facilities.filter(f =>
                                          breakAssignments.some(a => a.facilityId === f.id) &&
                                          f.locationType === 'external'
                                        );

                                        // Always show both sections (internal + external) regardless of facilities
                                        const hasInternalFacilities = true; // Always show internal
                                        const hasExternalFacilities = true; // Always show external

                                        // Calculate card width - always show both sections
                                        const totalSections = 2; // Always 2 sections
                                        const cardWidth = '640px'; // Always full width for 2 sections

                                        return (
                                          <div key={breakPeriod.id} className="flex-shrink-0" style={{ width: cardWidth }}>
                                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 shadow-sm hover:shadow-md transition-all h-full">
                                              {/* Header */}
                                              <div className="px-4 py-2 bg-gradient-to-r from-orange-100 to-amber-100 border-b-2 border-orange-300 rounded-t-xl">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-xl">☕</span>
                                                    <h4 className="text-sm font-black text-orange-900">{breakPeriod.name}</h4>
                                                  </div>
                                                  <div className="text-xs text-orange-700 font-bold flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {breakPeriod.startTime} - {breakPeriod.endTime}
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Internal/External Split (Horizontal) */}
                                              <div className="p-3">
                                                <div className={`grid gap-3 ${totalSections === 2 ? 'grid-cols-2' : 'grid-cols-1'
                                                  }`}>

                                                  {/* Internal Section */}
                                                  {hasInternalFacilities && (
                                                    <div className="bg-blue-50/50 rounded-lg border-2 border-blue-200 p-2">
                                                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b-2 border-blue-300">
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-sm">🏠</span>
                                                          <h5 className="text-xs font-black text-blue-900">داخلي</h5>
                                                        </div>
                                                        {/* Target Grades Badges - Inline */}
                                                        <div className="flex-1 flex flex-wrap items-center gap-1">
                                                          {(breakPeriod.internalTargetGrades && breakPeriod.internalTargetGrades.length > 0) ? (
                                                            breakPeriod.internalTargetGrades.map(grade => {
                                                              const gradeInfo = getGradesWithSections().find(g => g.grade === grade);
                                                              const sectionsCount = gradeInfo?.classes.length || 0;
                                                              return (
                                                                <span key={grade} className="text-[8px] px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded-full font-bold" title={`${sectionsCount} شعبة`}>
                                                                  🏫 {GRADES_AR[parseInt(grade) - 1] || grade} ({sectionsCount})
                                                                </span>
                                                              );
                                                            })
                                                          ) : (
                                                            <span className="text-[8px] text-blue-400 italic">بدون طبقات</span>
                                                          )}
                                                          <button
                                                            onClick={() => {
                                                              setGradePickerModal({
                                                                isOpen: true,
                                                                breakPeriodId: breakPeriod.id,
                                                                locationType: 'internal'
                                                              });
                                                            }}
                                                            className="text-[8px] px-1 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded font-bold transition-colors"
                                                            title="تعديل الطبقات"
                                                          >
                                                            ⚙️
                                                          </button>
                                                        </div>
                                                        <button
                                                          onClick={() => {
                                                            setAddToCardModal({
                                                              isOpen: true,
                                                              breakPeriodId: breakPeriod.id,
                                                              locationType: 'internal',
                                                              date: dateStr
                                                            });
                                                            setSelectedFacilityForAdd('');
                                                            setSelectedTeacherForAdd('');
                                                          }}
                                                          className="text-[9px] px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded font-bold transition-colors flex items-center gap-1"
                                                        >
                                                          <Plus size={10} />
                                                          إضافة
                                                        </button>
                                                      </div>

                                                      {/* Group by floor (subLocation) */}
                                                      <div className="space-y-2">
                                                        {(() => {
                                                          // Get all unique floors from internal facilities
                                                          const floorMap = new Map<string, { facilityId: string, assignments: typeof breakAssignments }>();

                                                          internalFacilities.forEach(facility => {
                                                            const facilityAssignments = breakAssignments.filter(a => a.facilityId === facility.id);

                                                            facilityAssignments.forEach(assignment => {
                                                              const floor = getFloorFromSubLocation(assignment.subLocationId, assignment.facilityId) || 'غير محدد';

                                                              if (!floorMap.has(floor)) {
                                                                floorMap.set(floor, { facilityId: facility.id, assignments: [] });
                                                              }
                                                              floorMap.get(floor)!.assignments.push(assignment);
                                                            });
                                                          });

                                                          // If no assignments, show empty state
                                                          if (floorMap.size === 0) {
                                                            return (
                                                              <div className="text-center py-3">
                                                                <p className="text-[10px] text-blue-400">💭 لا توجد تخصيصات</p>
                                                                <p className="text-[9px] text-blue-300 mt-1">اضغط "إضافة" لتعيين معلم</p>
                                                              </div>
                                                            );
                                                          }

                                                          return Array.from(floorMap.entries()).map(([floorName, data]) => (
                                                            <div key={floorName} className="bg-white/70 rounded-lg p-2 border border-blue-300">
                                                              <p className="text-[10px] font-black text-blue-800 mb-1">🏛️ {floorName}</p>
                                                              <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                                                                {data.assignments.map((assignment, idx) => {
                                                                  const teacher = employees.find(e => String(e.id) === String(assignment.teacherId));
                                                                  const facility = facilities.find(f => f.id === assignment.facilityId);
                                                                  const isEmpty = !assignment.teacherId || assignment.teacherId === '';

                                                                  // Show empty facility slot (clickable to add teacher)
                                                                  if (isEmpty) {
                                                                    return (
                                                                      <div
                                                                        key={idx}
                                                                        onClick={() => {
                                                                          setAddToCardModal({
                                                                            isOpen: true,
                                                                            breakPeriodId: breakPeriod.id,
                                                                            locationType: 'internal',
                                                                            date: dateStr
                                                                          });
                                                                          setSelectedFacilityForAdd(assignment.facilityId);
                                                                          setSelectedTeacherForAdd('');
                                                                        }}
                                                                        className="bg-amber-50 rounded px-2 py-1.5 border-2 border-dashed border-amber-300 cursor-pointer hover:bg-amber-100 hover:border-amber-400 transition-colors group"
                                                                      >
                                                                        <div className="flex items-center justify-between gap-1">
                                                                          <div className="flex-1 min-w-0">
                                                                            {facility && (
                                                                              <p className="text-[10px] font-bold text-amber-700 truncate">
                                                                                {getFacilityIcon(facility.type)} {facility.name}
                                                                              </p>
                                                                            )}
                                                                            <p className="text-[9px] text-amber-500 flex items-center gap-1">
                                                                              <Plus size={10} />
                                                                              انقر لإضافة معلم
                                                                            </p>
                                                                          </div>
                                                                          <button
                                                                            onClick={(e) => handleRemoveAssignment(assignment.id, e)}
                                                                            className="p-0.5 hover:bg-red-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                            title="حذف المرفق"
                                                                          >
                                                                            <X size={10} className="text-red-500" />
                                                                          </button>
                                                                        </div>
                                                                      </div>
                                                                    );
                                                                  }

                                                                  if (!teacher) return null;

                                                                  return (
                                                                    <div key={idx} className="bg-blue-100 rounded px-2 py-1 border border-blue-300 group relative hover:bg-blue-200 transition-colors">
                                                                      <div className="flex items-center justify-between gap-1">
                                                                        <div className="flex-1 min-w-0">
                                                                          <p className="text-[10px] font-bold text-blue-900 truncate" title={teacher.name}>
                                                                            👤 {teacher.name}
                                                                          </p>
                                                                          {facility && (
                                                                            <p className="text-[9px] text-blue-600 truncate" title={facility.name}>
                                                                              {getFacilityIcon(facility.type)} {facility.name}
                                                                            </p>
                                                                          )}
                                                                        </div>
                                                                        {/* Edit/Delete Buttons */}
                                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                          <button
                                                                            onClick={(e) => {
                                                                              e.stopPropagation();
                                                                              setSwapAssignment(assignment);
                                                                              setSwapModalOpen(true);
                                                                            }}
                                                                            className="p-0.5 hover:bg-blue-300 rounded transition-colors"
                                                                            title="تبديل"
                                                                          >
                                                                            <RefreshCw size={10} className="text-blue-700" />
                                                                          </button>
                                                                          <button
                                                                            onClick={(e) => handleRemoveAssignment(assignment.id, e)}
                                                                            className="p-0.5 hover:bg-red-200 rounded transition-colors"
                                                                            title="حذف"
                                                                          >
                                                                            <X size={10} className="text-red-600" />
                                                                          </button>
                                                                        </div>
                                                                      </div>
                                                                    </div>
                                                                  );
                                                                })}
                                                              </div>
                                                            </div>
                                                          ));
                                                        })()}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* External Section */}
                                                  {hasExternalFacilities && (
                                                    <div className="bg-green-50/50 rounded-lg border-2 border-green-200 p-2">
                                                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b-2 border-green-300">
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-sm">🌳</span>
                                                          <h5 className="text-xs font-black text-green-900">خارجي</h5>
                                                        </div>
                                                        {/* Target Grades Badges - Inline */}
                                                        <div className="flex-1 flex flex-wrap items-center gap-1">
                                                          {(breakPeriod.externalTargetGrades && breakPeriod.externalTargetGrades.length > 0) ? (
                                                            breakPeriod.externalTargetGrades.map(grade => {
                                                              const gradeInfo = getGradesWithSections().find(g => g.grade === grade);
                                                              const sectionsCount = gradeInfo?.classes.length || 0;
                                                              return (
                                                                <span key={grade} className="text-[8px] px-1.5 py-0.5 bg-green-200 text-green-800 rounded-full font-bold" title={`${sectionsCount} شعبة`}>
                                                                  🏫 {GRADES_AR[parseInt(grade) - 1] || grade} ({sectionsCount})
                                                                </span>
                                                              );
                                                            })
                                                          ) : (
                                                            <span className="text-[8px] text-green-400 italic">بدون طبقات</span>
                                                          )}
                                                          <button
                                                            onClick={() => {
                                                              setGradePickerModal({
                                                                isOpen: true,
                                                                breakPeriodId: breakPeriod.id,
                                                                locationType: 'external'
                                                              });
                                                            }}
                                                            className="text-[8px] px-1 py-0.5 bg-green-100 hover:bg-green-200 text-green-600 rounded font-bold transition-colors"
                                                            title="تعديل الطبقات"
                                                          >
                                                            ⚙️
                                                          </button>
                                                        </div>
                                                        <button
                                                          onClick={() => {
                                                            setAddToCardModal({
                                                              isOpen: true,
                                                              breakPeriodId: breakPeriod.id,
                                                              locationType: 'external',
                                                              date: dateStr
                                                            });
                                                            setSelectedFacilityForAdd('');
                                                            setSelectedTeacherForAdd('');
                                                          }}
                                                          className="text-[9px] px-2 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded font-bold transition-colors flex items-center gap-1"
                                                        >
                                                          <Plus size={10} />
                                                          إضافة
                                                        </button>
                                                      </div>

                                                      {/* Group by floor (subLocation) */}
                                                      <div className="space-y-2">
                                                        {(() => {
                                                          const floorMap = new Map<string, { facilityId: string, assignments: typeof breakAssignments }>();

                                                          externalFacilities.forEach(facility => {
                                                            const facilityAssignments = breakAssignments.filter(a => a.facilityId === facility.id);

                                                            facilityAssignments.forEach(assignment => {
                                                              const floor = getFloorFromSubLocation(assignment.subLocationId, assignment.facilityId) || 'غير محدد';

                                                              if (!floorMap.has(floor)) {
                                                                floorMap.set(floor, { facilityId: facility.id, assignments: [] });
                                                              }
                                                              floorMap.get(floor)!.assignments.push(assignment);
                                                            });
                                                          });

                                                          // If no assignments, show empty state
                                                          if (floorMap.size === 0) {
                                                            return (
                                                              <div className="text-center py-3">
                                                                <p className="text-[10px] text-green-400">💭 لا توجد تخصيصات</p>
                                                                <p className="text-[9px] text-green-300 mt-1">اضغط "إضافة" لتعيين معلم</p>
                                                              </div>
                                                            );
                                                          }

                                                          return Array.from(floorMap.entries()).map(([floorName, data]) => (
                                                            <div key={floorName} className="bg-white/70 rounded-lg p-2 border border-green-300">
                                                              <p className="text-[10px] font-black text-green-800 mb-1">🏛️ {floorName}</p>
                                                              <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                                                                {data.assignments.map((assignment, idx) => {
                                                                  const teacher = employees.find(e => String(e.id) === String(assignment.teacherId));
                                                                  const facility = facilities.find(f => f.id === assignment.facilityId);
                                                                  const isEmpty = !assignment.teacherId || assignment.teacherId === '';

                                                                  // Show empty facility slot (clickable to add teacher)
                                                                  if (isEmpty) {
                                                                    return (
                                                                      <div
                                                                        key={idx}
                                                                        onClick={() => {
                                                                          setAddToCardModal({
                                                                            isOpen: true,
                                                                            breakPeriodId: breakPeriod.id,
                                                                            locationType: 'external',
                                                                            date: dateStr
                                                                          });
                                                                          setSelectedFacilityForAdd(assignment.facilityId);
                                                                          setSelectedTeacherForAdd('');
                                                                        }}
                                                                        className="bg-amber-50 rounded px-2 py-1.5 border-2 border-dashed border-amber-300 cursor-pointer hover:bg-amber-100 hover:border-amber-400 transition-colors group"
                                                                      >
                                                                        <div className="flex items-center justify-between gap-1">
                                                                          <div className="flex-1 min-w-0">
                                                                            {facility && (
                                                                              <p className="text-[10px] font-bold text-amber-700 truncate">
                                                                                {getFacilityIcon(facility.type)} {facility.name}
                                                                              </p>
                                                                            )}
                                                                            <p className="text-[9px] text-amber-500 flex items-center gap-1">
                                                                              <Plus size={10} />
                                                                              انقر لإضافة معلم
                                                                            </p>
                                                                          </div>
                                                                          <button
                                                                            onClick={(e) => handleRemoveAssignment(assignment.id, e)}
                                                                            className="p-0.5 hover:bg-red-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                            title="حذف المرفق"
                                                                          >
                                                                            <X size={10} className="text-red-500" />
                                                                          </button>
                                                                        </div>
                                                                      </div>
                                                                    );
                                                                  }

                                                                  if (!teacher) return null;

                                                                  return (
                                                                    <div key={idx} className="bg-green-100 rounded px-2 py-1 border border-green-300 group relative hover:bg-green-200 transition-colors">
                                                                      <div className="flex items-center justify-between gap-1">
                                                                        <div className="flex-1 min-w-0">
                                                                          <p className="text-[10px] font-bold text-green-900 truncate" title={teacher.name}>
                                                                            👤 {teacher.name}
                                                                          </p>
                                                                          {facility && (
                                                                            <p className="text-[9px] text-green-600 truncate" title={facility.name}>
                                                                              {getFacilityIcon(facility.type)} {facility.name}
                                                                            </p>
                                                                          )}
                                                                        </div>
                                                                        {/* Edit/Delete Buttons */}
                                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                          <button
                                                                            onClick={(e) => {
                                                                              e.stopPropagation();
                                                                              setSwapAssignment(assignment);
                                                                              setSwapModalOpen(true);
                                                                            }}
                                                                            className="p-0.5 hover:bg-green-300 rounded transition-colors"
                                                                            title="تبديل"
                                                                          >
                                                                            <RefreshCw size={10} className="text-green-700" />
                                                                          </button>
                                                                          <button
                                                                            onClick={(e) => handleRemoveAssignment(assignment.id, e)}
                                                                            className="p-0.5 hover:bg-red-200 rounded transition-colors"
                                                                            title="حذف"
                                                                          >
                                                                            <X size={10} className="text-red-600" />
                                                                          </button>
                                                                        </div>
                                                                      </div>
                                                                    </div>
                                                                  );
                                                                })}
                                                              </div>
                                                            </div>
                                                          ));
                                                        })()}
                                                      </div>
                                                    </div>
                                                  )}

                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      {/* Empty state - Only show if no break periods defined */}
                                      {breakPeriods.length === 0 && (() => {
                                        const morningAssignments = dutyAssignments.filter(a => {
                                          const facility = facilities.find(f => f.id === a.facilityId);
                                          return a.date === dateStr && facility?.type === 'gate';
                                        });

                                        if (morningAssignments.length === 0) {
                                          return (
                                            <div className="flex-1 flex items-center justify-center py-12 text-gray-400">
                                              <div className="text-center">
                                                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                                                <p className="text-sm font-bold">لا توجد استراحات محددة</p>
                                                <p className="text-xs text-gray-400 mt-1">أضف استراحات في هندسة التدفق الزمني</p>
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Instructions */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border-2 border-purple-200">
                        <h3 className="text-sm font-black text-purple-900 mb-2 flex items-center gap-2">
                          <Sparkles size={16} />
                          💡 نظام عرض البطاقات
                        </h3>
                        <ul className="text-xs text-purple-700 space-y-1 mr-4">
                          <li>• 🌅 <strong>الفترة الصباحية</strong>: 3 أقسام (السير + ساحة أمامية + ساحة خلفية) - لون أخضر</li>
                          <li>• 📍 <strong>السير</strong>: معلم واحد على البوابة الرئيسية</li>
                          <li>• ☕ <strong>الاستراحات</strong>: مقسمة إلى 🏠 داخلي | 🌳 خارجي (أفقياً) - لون برتقالي</li>
                          <li>• 🏛️ <strong>الطبقات</strong>: تجميع حسب الطابق (من المواقع الفرعية) داخل كل قسم</li>
                          <li>• 👤 <strong>المعلومات</strong>: اسم المعلم + اسم المرفق تحت كل طابق</li>
                          <li>• 🏠/🌳 <strong>نوع الموقع</strong>: يتم تحديده عند إضافة المرفق (داخلي أو خارجي)</li>
                          <li>• 📅 <strong>أيام الدراسة</strong>: يتم عرض أيام الدراسة فقط (بدون العطل)</li>
                          <li>• ➡️ <strong>التنقل</strong>: استخدم أزرار "أسبوع سابق/تالي" للتنقل بين الأسابيع</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-sm font-black text-blue-900 mb-2 flex items-center gap-2">
                      <GripVertical size={16} />
                      كيفية الاستخدام
                    </h3>
                    <ul className="space-y-1 text-xs text-blue-800">
                      <li>• اسحب بطاقة المعلم من القائمة اليسرى</li>
                      <li>• أفلتها في الخلية المطلوبة (فترة + مرفق)</li>
                      <li>• يمكنك فقط سحب المعلمين المتاحين (لديهم سعة)</li>
                      <li>• لإلغاء التخصيص، مرر فوق المعلم وانقر X</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Suggestion Dropdown - Enhanced with Tabs */}
        {showSuggestionDropdown && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => { setShowSuggestionDropdown(null); setSuggestionSearch(''); setSuggestionTab('smart'); }}
            />
            <div
              className="fixed z-50 bg-white rounded-xl shadow-2xl border-2 border-blue-300 min-w-[320px] max-w-[400px] max-h-[450px] flex flex-col"
              style={{
                top: `${Math.min(showSuggestionDropdown.position.y + 5, window.innerHeight - 460)}px`,
                left: `${Math.min(showSuggestionDropdown.position.x, window.innerWidth - 420)}px`
              }}
              dir="rtl"
            >
              {/* Header with Close Button */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gradient-to-l from-blue-50 to-white rounded-t-xl">
                <div className="flex items-center gap-2">
                  <Users className="text-blue-600" size={16} />
                  <h3 className="text-sm font-black text-gray-800">اختيار معلم</h3>
                </div>
                <button
                  onClick={() => { setShowSuggestionDropdown(null); setSuggestionSearch(''); setSuggestionTab('smart'); }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                <button
                  onClick={() => setSuggestionTab('smart')}
                  className={`flex-1 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1 transition-all ${suggestionTab === 'smart'
                    ? 'text-blue-700 border-b-2 border-blue-500 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <Sparkles size={12} />
                  اقتراحات ذكية
                </button>
                <button
                  onClick={() => setSuggestionTab('all')}
                  className={`flex-1 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1 transition-all ${suggestionTab === 'all'
                    ? 'text-green-700 border-b-2 border-green-500 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <Users size={12} />
                  جميع المتاحين
                </button>
              </div>

              {/* Search (only for 'all' tab) */}
              {suggestionTab === 'all' && (
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={suggestionSearch}
                      onChange={(e) => setSuggestionSearch(e.target.value)}
                      placeholder="بحث باسم المعلم..."
                      className="w-full pr-8 pl-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-green-400 focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-2">
                {(() => {
                  const date = formatDateForAssignment(selectedDate);
                  const breakPeriod = breakPeriods.find(bp => bp.id === showSuggestionDropdown.breakPeriodId);
                  if (!breakPeriod) return null;

                  // Get current assignments for this cell to exclude already assigned teachers
                  const currentAssignments = dutyAssignments.filter(
                    a => a.breakPeriodId === showSuggestionDropdown.breakPeriodId &&
                      a.facilityId === showSuggestionDropdown.facilityId &&
                      a.date === date
                  );
                  const assignedTeacherIds = currentAssignments.map(a => a.teacherId);

                  if (suggestionTab === 'smart') {
                    // Smart Suggestions Tab
                    const suggestions = getSuggestionsForCell(
                      breakPeriod,
                      showSuggestionDropdown.facilityId,
                      date,
                      5
                    ).filter(s => !assignedTeacherIds.includes(String(s.teacher.id)));

                    if (suggestions.length === 0) {
                      return (
                        <div className="py-6 text-center">
                          <Sparkles size={24} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-xs text-gray-500">لا توجد اقتراحات متاحة</p>
                          <p className="text-[10px] text-gray-400 mt-1">جرب تبويب "جميع المتاحين"</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1.5">
                        {suggestions.map((suggestion, idx) => {
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                          return (
                            <button
                              key={suggestion.teacher.id}
                              onClick={() => { assignFromSuggestion(String(suggestion.teacher.id)); setSuggestionSearch(''); }}
                              className="w-full text-right p-2.5 rounded-lg hover:bg-blue-50 transition-colors border border-gray-200 hover:border-blue-300"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  {medal && <span className="text-sm">{medal}</span>}
                                  <span className="text-xs font-black text-gray-800">{suggestion.teacher.name}</span>
                                </div>
                                <span className="text-sm font-black text-blue-600">{suggestion.score}</span>
                              </div>
                              <div className="text-[9px] text-gray-500 space-y-0.5 mr-5">
                                {suggestion.reasons.slice(0, 2).map((reason, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <CheckCircle2 size={8} className="text-green-500" />
                                    <span>{reason}</span>
                                  </div>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  } else {
                    // All Available Teachers Tab
                    const availableTeachers = getAvailableTeachersForBreak(breakPeriod, date)
                      .filter(tw => !assignedTeacherIds.includes(String(tw.teacher.id)))
                      .filter(tw =>
                        !suggestionSearch ||
                        tw.teacher.name.toLowerCase().includes(suggestionSearch.toLowerCase())
                      );

                    if (availableTeachers.length === 0) {
                      return (
                        <div className="py-6 text-center">
                          <Users size={24} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-xs text-gray-500">
                            {suggestionSearch ? 'لا توجد نتائج للبحث' : 'لا يوجد معلمون متاحون'}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1">
                        <div className="text-[10px] text-gray-500 mb-2 px-1">
                          {availableTeachers.length} معلم متاح
                        </div>
                        {availableTeachers.map((tw) => {
                          const dutyCount = getDutyCount(String(tw.teacher.id), date);
                          return (
                            <button
                              key={tw.teacher.id}
                              onClick={() => { assignFromSuggestion(String(tw.teacher.id)); setSuggestionSearch(''); }}
                              className="w-full text-right p-2 rounded-lg hover:bg-green-50 transition-colors border border-gray-100 hover:border-green-300 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-white text-[10px] font-bold">
                                  {tw.teacher.name.charAt(0)}
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-gray-800 block">{tw.teacher.name}</span>
                                  <span className="text-[9px] text-gray-500">سعة: {tw.capacity} | مناوبات اليوم: {dutyCount}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {tw.teacher.dutySettings?.exemptFromDuty && (
                                  <span className="text-[8px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">معفى</span>
                                )}
                                {dutyCount >= 3 && (
                                  <span className="text-[8px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-bold">محمّل</span>
                                )}
                                <ChevronDown size={14} className="text-gray-400 rotate-90" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          </>
        )}

        {/* Add to Card Modal - For adding facility + teacher from timeline-cards view */}
        {addToCardModal && addToCardModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" dir="rtl">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <Plus size={20} className="text-blue-600" />
                  إضافة تخصيص
                </h3>
                <button
                  onClick={() => {
                    setAddToCardModal(null);
                    setApplyToAllDays(false);
                    setApplyToAllBreaks(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} className="text-gray-600" />
                </button>
              </div>

              {/* Break Period Info */}
              <div className="bg-orange-50 rounded-lg p-3 mb-4 border border-orange-200">
                <p className="text-xs font-bold text-orange-800">
                  ☕ {breakPeriods.find(bp => bp.id === addToCardModal.breakPeriodId)?.name}
                </p>
                <p className="text-[10px] text-orange-600">
                  {addToCardModal.locationType === 'internal' ? '🏠 داخلي' : '🌳 خارجي'}
                </p>
              </div>

              {/* Facility Selection */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">🏢 اختر المرفق</label>
                <select
                  value={selectedFacilityForAdd}
                  onChange={(e) => setSelectedFacilityForAdd(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none text-sm"
                >
                  <option value="">اختر المرفق...</option>
                  {facilities
                    .filter(f => {
                      if (addToCardModal.locationType === 'internal') {
                        return f.locationType === 'internal' || !f.locationType;
                      }
                      return f.locationType === 'external';
                    })
                    .map(facility => (
                      <option key={facility.id} value={facility.id}>
                        {getFacilityIcon(facility.type)} {facility.name}
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Teacher Selection - Show teachers from day duty cards at top */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">👤 اختر المعلم</label>
                {(() => {
                  // Get day name from the date
                  const dateObj = new Date(addToCardModal.date);
                  const dayIndex = dateObj.getDay();
                  const DAYS_AR_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                  const dayName = DAYS_AR_FULL[dayIndex];
                  const dayNameShort = dayName.replace('ال', '');

                  // Get teachers assigned to THIS day from day duty cards (dayDutyAssignments)
                  const teachersAssignedToday = dayDutyAssignments.filter(assignment => {
                    const assignmentDay = assignment.dayName.replace('ال', '');
                    return assignmentDay === dayNameShort ||
                      assignment.dayName === dayName ||
                      assignment.dayName === dayNameShort;
                  });

                  // Get teacher objects with their duty type
                  const teachersWithDuty = teachersAssignedToday.map(assignment => {
                    const teacher = employees.find(e => Number(e.id) === assignment.teacherId);
                    return {
                      teacher,
                      dutyType: assignment.dutyType
                    };
                  }).filter(t => t.teacher) as { teacher: Employee; dutyType: 'full' | 'half' }[];

                  // Get already assigned teachers in THIS break period on this date
                  const assignedInThisBreak = dutyAssignments
                    .filter(a => a.breakPeriodId === addToCardModal.breakPeriodId && a.date === addToCardModal.date)
                    .map(a => a.teacherId);

                  // Get assigned teachers in ANY assignment on this date
                  const assignedTodayAll = dutyAssignments
                    .filter(a => a.date === addToCardModal.date)
                    .map(a => a.teacherId);

                  if (teachersWithDuty.length === 0) {
                    return (
                      <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                        <p className="text-xs text-yellow-800 text-center">
                          ⚠️ لا يوجد معلمين معيّنين للمناوبة يوم <strong>{dayName}</strong>
                        </p>
                        <p className="text-[10px] text-yellow-600 text-center mt-1">
                          عيّن المعلمين من بطاقات الأيام في أعلى الصفحة
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-[10px] text-gray-500 mb-2">
                        📝 المعلمون المعيّنون من بطاقة يوم <strong>{dayName}</strong> ({teachersWithDuty.length})
                      </p>
                      {teachersWithDuty.map(({ teacher, dutyType }) => {
                        const isSelected = selectedTeacherForAdd === String(teacher.id);
                        const isAssignedInThisBreak = assignedInThisBreak.includes(String(teacher.id));
                        const isAssignedElsewhere = !isAssignedInThisBreak && assignedTodayAll.includes(String(teacher.id));

                        return (
                          <button
                            key={teacher.id}
                            onClick={() => !isAssignedInThisBreak && setSelectedTeacherForAdd(String(teacher.id))}
                            disabled={isAssignedInThisBreak}
                            className={`w-full text-right px-3 py-2 rounded-lg border-2 transition-all flex items-center justify-between ${isSelected
                              ? 'bg-blue-100 border-blue-500 shadow-md'
                              : isAssignedInThisBreak
                                ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                                : isAssignedElsewhere
                                  ? 'bg-orange-50 border-orange-300 hover:border-orange-400'
                                  : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected && <CheckCircle2 size={14} className="text-blue-600" />}
                              <span className={`text-sm font-bold ${isAssignedInThisBreak ? 'line-through text-gray-400' :
                                isAssignedElsewhere ? 'text-orange-700' : 'text-gray-800'
                                }`}>
                                {teacher.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${dutyType === 'full'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {dutyType === 'full' ? 'كاملة' : 'نصفية'}
                              </span>
                              {isAssignedInThisBreak && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                  ✔ معيّن
                                </span>
                              )}
                              {isAssignedElsewhere && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-200 text-orange-700">
                                  📍 موزع
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Apply Options */}
              <div className="mb-4 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
                <p className="text-xs font-black text-purple-800 mb-3 flex items-center gap-1">
                  <Zap size={14} />
                  خيارات التطبيق
                </p>

                {/* Apply to all days */}
                <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-200 mb-2 cursor-pointer hover:bg-purple-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={applyToAllDays}
                    onChange={(e) => setApplyToAllDays(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-800">📅 تطبيق المرفق على جميع أيام الأسبوع</p>
                    <p className="text-[10px] text-gray-500">سيتم إضافة المرفق لكل أيام الدوام (بدون معلمين - تضاف لاحقاً)</p>
                  </div>
                </label>

                {/* Apply to all breaks of same type */}
                <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={applyToAllBreaks}
                    onChange={(e) => setApplyToAllBreaks(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-800">☕ تطبيق المرفق على جميع الاستراحات ({addToCardModal.locationType === 'internal' ? 'الداخلية' : 'الخارجية'})</p>
                    <p className="text-[10px] text-gray-500">سيتم إضافة المرفق لكل الاستراحات (بدون معلمين - تضاف لاحقاً)</p>
                  </div>
                </label>
              </div>

              {/* Preview of assignments count */}
              {(applyToAllDays || applyToAllBreaks) && (
                <div className="mb-4 p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-[10px] text-amber-800">
                    🏢 سيتم إنشاء <span className="font-black">
                      {(() => {
                        const daysCount = applyToAllDays ? 5 : 1; // 5 school days
                        const breaksCount = applyToAllBreaks ? breakPeriods.length : 1;
                        return daysCount * breaksCount;
                      })()} مرفق فارغ</span> (بدون معلمين)
                  </p>
                  <p className="text-[9px] text-amber-600 mt-1">
                    📝 يمكنك إضافة المعلمين لاحقاً بالنقر على المرفق في كل يوم
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAddToCardModal(null);
                    setApplyToAllDays(false);
                    setApplyToAllBreaks(false);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-sm transition-colors"
                >
                  إلغاء
                </button>

                {/* Apply Facilities Only (when options selected) */}
                {(applyToAllDays || applyToAllBreaks) && (
                  <button
                    onClick={() => {
                      if (!selectedFacilityForAdd) {
                        alert('يرجى اختيار المرفق');
                        return;
                      }

                      const newAssignments: DutyAssignment[] = [];

                      // Get school days of the week
                      const weekDates = getSchoolDaysInWeek(selectedDate);
                      const datesToApply = applyToAllDays ? weekDates.map(d => formatDateForAssignment(d)) : [addToCardModal.date];

                      // Get breaks to apply to
                      const breaksToApply = applyToAllBreaks ? breakPeriods : [breakPeriods.find(bp => bp.id === addToCardModal.breakPeriodId)!];

                      // Create facility slots WITHOUT teachers
                      datesToApply.forEach((date, dateIdx) => {
                        breaksToApply.forEach((breakPeriod, breakIdx) => {
                          // Check if facility already exists for this combination
                          const exists = dutyAssignments.some(
                            a => a.breakPeriodId === breakPeriod.id &&
                              a.facilityId === selectedFacilityForAdd &&
                              a.date === date
                          );

                          if (!exists) {
                            newAssignments.push({
                              id: `${Date.now()}-${dateIdx}-${breakIdx}`,
                              breakPeriodId: breakPeriod.id,
                              facilityId: selectedFacilityForAdd,
                              teacherId: '', // Empty - to be filled later
                              date
                            });
                          }
                        });
                      });

                      if (newAssignments.length > 0) {
                        setDutyAssignments(prev => [...prev, ...newAssignments]);
                      }

                      setAddToCardModal(null);
                      setSelectedFacilityForAdd('');
                      setSelectedTeacherForAdd('');
                      setApplyToAllDays(false);
                      setApplyToAllBreaks(false);
                    }}
                    disabled={!selectedFacilityForAdd}
                    className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Building2 size={16} />
                    تطبيق المرافق
                  </button>
                )}

                {/* Add with Teacher (single assignment) */}
                {!(applyToAllDays || applyToAllBreaks) && (
                  <button
                    onClick={() => {
                      if (!selectedFacilityForAdd || !selectedTeacherForAdd) {
                        alert('يرجى اختيار المرفق والمعلم');
                        return;
                      }

                      // Check if there's an existing empty slot for this facility
                      const existingEmptySlot = dutyAssignments.find(
                        a => a.breakPeriodId === addToCardModal.breakPeriodId &&
                          a.facilityId === selectedFacilityForAdd &&
                          a.date === addToCardModal.date &&
                          (!a.teacherId || a.teacherId === '')
                      );

                      if (existingEmptySlot) {
                        // UPDATE existing slot with teacher
                        setDutyAssignments(prev => prev.map(a =>
                          a.id === existingEmptySlot.id
                            ? { ...a, teacherId: selectedTeacherForAdd }
                            : a
                        ));
                      } else {
                        // Create NEW assignment
                        const newAssignment: DutyAssignment = {
                          id: Date.now().toString(),
                          breakPeriodId: addToCardModal.breakPeriodId,
                          facilityId: selectedFacilityForAdd,
                          teacherId: selectedTeacherForAdd,
                          date: addToCardModal.date
                        };

                        setDutyAssignments(prev => [...prev, newAssignment]);
                      }

                      setAddToCardModal(null);
                      setSelectedFacilityForAdd('');
                      setSelectedTeacherForAdd('');
                      setApplyToAllDays(false);
                      setApplyToAllBreaks(false);
                    }}
                    disabled={!selectedFacilityForAdd || !selectedTeacherForAdd}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    إضافة
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Facility Add/Edit Modal */}
        {showAddFacilityModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" dir="rtl">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black text-gray-800">
                  {editingFacility ? 'تعديل المرفق' : 'إضافة مرفق جديد'}
                </h3>
                <button
                  onClick={() => setShowAddFacilityModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم المرفق</label>
                  <input
                    type="text"
                    value={facilityFormData.name}
                    onChange={(e) => setFacilityFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: الساحة الرئيسية"
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none"
                  />
                </div>

                {/* Type */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-gray-700">نوع المرفق</label>
                    <button
                      type="button"
                      onClick={() => setShowAddTypeModal(true)}
                      className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded font-bold transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} />
                      إضافة نوع
                    </button>
                  </div>
                  <select
                    value={facilityFormData.type}
                    onChange={(e) => setFacilityFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none"
                  >
                    {facilityTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.icon} {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">السعة (عدد الطلاب)</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={facilityFormData.capacity}
                    onChange={(e) => setFacilityFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 50 }))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    المعلمين المطلوبين: <span className="font-bold">{Math.ceil(facilityFormData.capacity / 50)}</span> (1 معلم لكل 50 طالب)
                  </p>
                </div>

                {/* Location Type */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🏛️ نوع الموقع</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFacilityFormData(prev => ({ ...prev, locationType: 'internal' }))}
                      className={`flex-1 px-4 py-3 rounded-lg font-bold text-sm transition-all border-2 ${facilityFormData.locationType === 'internal'
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                        }`}
                    >
                      🏠 داخلي
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacilityFormData(prev => ({ ...prev, locationType: 'external' }))}
                      className={`flex-1 px-4 py-3 rounded-lg font-bold text-sm transition-all border-2 ${facilityFormData.locationType === 'external'
                        ? 'bg-green-500 text-white border-green-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                        }`}
                    >
                      🌳 خارجي
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 الداخلي: داخل المبنى (ممرات، دورات مياه...) | الخارجي: خارج المبنى (ساحات، ملاعب...)
                  </p>
                </div>

                {/* Sub-Locations */}
                <div className="border-t-2 border-gray-200 pt-4 mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    🎯 المواقع الفرعية (اختياري)
                    <span className="text-xs text-gray-500 font-normal mr-2">مثال: ملعب القدم، ملعب السلة، المضمار</span>
                  </label>

                  {/* Add Sub-Location Form */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="اسم الموقع (مثال: ملعب القدم)"
                      value={subLocationName}
                      onChange={(e) => setSubLocationName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="السعة"
                      min="5"
                      max="200"
                      value={subLocationCapacity}
                      onChange={(e) => setSubLocationCapacity(parseInt(e.target.value) || 25)}
                      className="w-24 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!subLocationName.trim()) {
                          alert('يرجى إدخال اسم الموقع الفرعي');
                          return;
                        }

                        const newSubLocation: SubLocation = {
                          id: Date.now().toString(),
                          name: subLocationName.trim(),
                          capacity: subLocationCapacity
                        };

                        setFacilityFormData(prev => ({
                          ...prev,
                          subLocations: [...(prev.subLocations || []), newSubLocation]
                        }));

                        setSubLocationName('');
                        setSubLocationCapacity(25);
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-sm transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Sub-Locations List */}
                  {facilityFormData.subLocations && facilityFormData.subLocations.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {facilityFormData.subLocations.map((subLoc) => (
                        <div
                          key={subLoc.id}
                          className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-blue-600" />
                            <span className="text-sm font-bold text-gray-800">{subLoc.name}</span>
                            <span className="text-xs text-gray-500">({subLoc.capacity} طالب)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFacilityFormData(prev => ({
                                ...prev,
                                subLocations: (prev.subLocations || []).filter(sl => sl.id !== subLoc.id)
                              }));
                            }}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                          >
                            <Trash2 size={14} className="text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(!facilityFormData.subLocations || facilityFormData.subLocations.length === 0) && (
                    <p className="text-xs text-gray-400 text-center py-2 italic">
                      لم يتم إضافة مواقع فرعية بعد
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveFacility}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all shadow-sm"
                >
                  {editingFacility ? 'حفظ التعديلات' : 'إضافة المرفق'}
                </button>
                <button
                  onClick={() => setShowAddFacilityModal(false)}
                  className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Facilities - MOVED ABOVE SYSTEM DESCRIPTION */}
        {activeTab === 'facilities' && (
          <div className="space-y-6">

            {/* Facilities List with Advanced Editing */}
            <div className="bg-white rounded-2xl p-6 border-2 border-green-200 shadow-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                  <Building2 className="text-green-600" size={20} />
                  🏛️ إدارة المرافق ({facilities.length})
                </h2>
                <button
                  onClick={handleAddFacility}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-md"
                >
                  <Plus size={18} />
                  إضافة مرفق
                </button>
              </div>

              {/* Filter Bar */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${filterType === 'all' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  🏛️ الكل ({facilities.length})
                </button>
                <button
                  onClick={() => setFilterType('internal')}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${filterType === 'internal' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  🏠 داخلي ({facilities.filter(f => f.locationType === 'internal' || !f.locationType).length})
                </button>
                <button
                  onClick={() => setFilterType('external')}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${filterType === 'external' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  🌳 خارجي ({facilities.filter(f => f.locationType === 'external').length})
                </button>
              </div>

              {/* Facilities Grid */}
              <div className="grid gap-4">
                {facilities
                  .filter(f => {
                    if (filterType === 'all') return true;
                    if (filterType === 'internal') return f.locationType === 'internal' || !f.locationType;
                    if (filterType === 'external') return f.locationType === 'external';
                    return true;
                  })
                  .map(facility => {
                    const facilityType = facilityTypes.find(ft => ft.id === facility.type);
                    const icon = facilityType?.icon || '🏛️';
                    const color = facilityType?.color || 'gray';

                    return (
                      <div
                        key={facility.id}
                        className={`p-4 bg-${color}-50 rounded-xl border-2 border-${color}-200 hover:shadow-md transition-all`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">{icon}</span>
                              <h3 className="font-black text-gray-800 text-lg">{facility.name}</h3>
                              {facility.locationType && (
                                <span className={`px-2 py-0.5 text-xs font-bold rounded ${facility.locationType === 'internal' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                  }`}>
                                  {facility.locationType === 'internal' ? '🏠 داخلي' : '🌳 خارجي'}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div className="bg-white rounded-lg p-2 border border-gray-200">
                                <p className="text-xs text-gray-600">📊 السعة</p>
                                <p className="font-bold text-gray-800">{facility.capacity} طالب</p>
                              </div>
                              <div className="bg-white rounded-lg p-2 border border-gray-200">
                                <p className="text-xs text-gray-600">👥 معلمون مطلوبون</p>
                                <p className="font-bold text-gray-800">{Math.ceil(facility.capacity / 50)}</p>
                              </div>
                            </div>

                            {/* Target Grades */}
                            {facility.targetGrades && facility.targetGrades.length > 0 && (
                              <div className="mt-3 p-2 bg-white rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">🎓 الصفوف المستهدفة</p>
                                <div className="flex flex-wrap gap-1">
                                  {facility.targetGrades.map(grade => (
                                    <span key={grade} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                                      {grade}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Linked Breaks */}
                            {facility.linkedBreaks && facility.linkedBreaks.length > 0 && (
                              <div className="mt-3 p-2 bg-white rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">☕ الاستراحات المرتبطة</p>
                                <div className="flex flex-wrap gap-1">
                                  {facility.linkedBreaks.map(breakId => {
                                    const breakPeriod = breakPeriods.find(bp => bp.id === breakId);
                                    return breakPeriod ? (
                                      <span key={breakId} className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                                        {breakPeriod.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Sub-Locations */}
                            {facility.subLocations && facility.subLocations.length > 0 && (
                              <div className="mt-3 p-2 bg-white rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-600 mb-1">🏛️ المواقع الفرعية ({facility.subLocations.length})</p>
                                <div className="flex flex-wrap gap-1">
                                  {facility.subLocations.map(subLoc => (
                                    <span key={subLoc.id} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                                      {subLoc.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditFacility(facility)}
                              className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit2 size={16} className="text-blue-700" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف "${facility.name}"?`)) {
                                  setFacilities(prev => prev.filter(f => f.id !== facility.id));
                                }
                              }}
                              className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={16} className="text-red-700" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {facilities.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Building2 size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-bold">لم يتم إضافة مرافق بعد</p>
                  <p className="text-sm">اضغط "إضافة مرفق" للبدء</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Settings - COMPLETE IMPLEMENTATION */}
        {activeTab === 'settings' && (
          <div className="space-y-6">

            {/* Section 2: Break Periods Management - تم إضافته */}
            <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-blue-900 flex items-center gap-2">
                  <Coffee className="text-blue-600" size={18} />
                  ☕ إدارة فترات المناوبة ({breakPeriods.length})
                </h3>
                <button
                  onClick={() => {
                    setEditingBreakPeriod(null);
                    setShowBreakModal(true);
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-md"
                >
                  <Plus size={16} />
                  إضافة مناوبة
                </button>
              </div>

              <div className="space-y-3">
                {breakPeriods.map((breakPeriod, index) => (
                  <div key={breakPeriod.id} className="bg-white rounded-lg p-4 border-2 border-blue-300 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg font-black text-blue-600">{index + 1}️⃣</span>
                          <h4 className="font-black text-gray-800 text-lg">{breakPeriod.name}</h4>

                          {breakPeriod.sourceType === 'schedule' && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                              🔗 من الجدول
                            </span>
                          )}

                          {breakPeriod.breakType && (
                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${breakPeriod.breakType === 'internal' ? 'bg-blue-100 text-blue-700' :
                              breakPeriod.breakType === 'external' ? 'bg-green-100 text-green-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>
                              {breakPeriod.breakType === 'internal' ? '🏠 داخلي' :
                                breakPeriod.breakType === 'external' ? '🌳 خارجي' :
                                  '🏠🌳 مختلط'}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mb-2">
                          ⏰ {breakPeriod.startTime} - {breakPeriod.endTime}
                        </p>

                        {breakPeriod.targetGrades && breakPeriod.targetGrades.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600 mb-1">🎓 الصفوف:</p>
                            <div className="flex flex-wrap gap-1">
                              {breakPeriod.targetGrades.map(classId => {
                                const cls = classes.find(c => c.id === classId);
                                return cls ? (
                                  <span key={classId} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                                    {cls.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}

                        {breakPeriod.linkedFacilities && (
                          breakPeriod.linkedFacilities.internal?.length > 0 ||
                          breakPeriod.linkedFacilities.external?.length > 0
                        ) && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 mb-1">🏖️ المرافق:</p>
                              <div className="flex flex-wrap gap-1">
                                {breakPeriod.linkedFacilities.internal?.map(facilityId => {
                                  const facility = facilities.find(f => f.id === facilityId);
                                  const facilityType = facility ? facilityTypes.find(ft => ft.id === facility.type) : null;
                                  return facility ? (
                                    <span key={facilityId} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded flex items-center gap-1">
                                      <span>{facilityType?.icon || '🏠'}</span>
                                      <span>{facility.name}</span>
                                    </span>
                                  ) : null;
                                })}
                                {breakPeriod.linkedFacilities.external?.map(facilityId => {
                                  const facility = facilities.find(f => f.id === facilityId);
                                  const facilityType = facility ? facilityTypes.find(ft => ft.id === facility.type) : null;
                                  return facility ? (
                                    <span key={facilityId} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded flex items-center gap-1">
                                      <span>{facilityType?.icon || '🌳'}</span>
                                      <span>{facility.name}</span>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingBreakPeriod(breakPeriod);

                            // Combine internal and external facilities into targetFloors
                            const allFacilities = [
                              ...(breakPeriod.linkedFacilities?.internal || []),
                              ...(breakPeriod.linkedFacilities?.external || [])
                            ];

                            setBreakFormData({
                              name: breakPeriod.name,
                              startTime: breakPeriod.startTime,
                              endTime: breakPeriod.endTime,
                              breakType: breakPeriod.breakType || 'external',
                              targetGrades: breakPeriod.targetGrades || [],
                              targetFloors: allFacilities,
                              sourceType: breakPeriod.sourceType || 'manual',
                              isAutoLinked: breakPeriod.isAutoLinked || false
                            });
                            setShowBreakModal(true);
                          }}
                          className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} className="text-blue-700" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف "${breakPeriod.name}"?`)) {
                              setBreakPeriods(prev => prev.filter(bp => bp.id !== breakPeriod.id));
                            }
                          }}
                          className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} className="text-red-700" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* System Description - Collapsible */}
        <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-md mb-6 overflow-hidden">
          <button
            onClick={() => setAboutSectionExpanded(!aboutSectionExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-orange-50 transition-colors"
          >
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <Shield className="text-orange-600" size={20} />
              عن نظام إدارة المناوبات
            </h2>
            <ChevronDown
              size={24}
              className={`text-orange-600 transition-transform duration-300 ${aboutSectionExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {aboutSectionExpanded && (
            <div className="px-6 pb-6 space-y-3 text-sm text-gray-700 leading-relaxed border-t border-orange-100">
              <p className="font-medium pt-4">
                <strong className="text-orange-600">نظام الإشراف على الاستراحات والمناوبات المدرسية</strong> هو نظام شامل مبني على السياسات ونصف يدوي ويعتمد على الجدول الزمني، مصمم لضمان سلامة الطلاب وتوزيع عادل للمهام بين المعلمين.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <h3 className="font-black text-gray-800 mb-2 flex items-center gap-2">
                    🎯 الأهداف الأساسية
                  </h3>
                  <ul className="space-y-1 text-xs">
                    <li>• ضمان سلامة الطلاب وتقليل الإصابات</li>
                    <li>• توزيع المناوبات بعدالة بين المعلمين</li>
                    <li>• احترام القيود القانونية والعمالية</li>
                    <li>• منع القرارات الذاتية أو العاطفية</li>
                    <li>• تحويل الخبرة الإدارية إلى منطق سياسات قابل للتدقيق</li>
                  </ul>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="font-black text-gray-800 mb-2 flex items-center gap-2">
                    ⚙️ المكونات الرئيسية
                  </h3>
                  <ul className="space-y-1 text-xs">
                    <li>• <strong>السياق والإطار القانوني:</strong> حدود المناوبات والقواعد</li>
                    <li>• <strong>مكتبة المكونات:</strong> معلمين، مرافق، استراحات</li>
                    <li>• <strong>محرك التخصيص:</strong> اقتراحات ذكية بموافقة بشرية</li>
                    <li>• <strong>محرك الجدول الزمني:</strong> عرض حي ومحدث</li>
                    <li>• <strong>نظام الإشعارات:</strong> تنبيهات للمعلمين</li>
                  </ul>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 mt-4">
                <h3 className="font-black text-gray-800 mb-2 flex items-center gap-2">
                  🛡️ الفلسفة الأساسية
                </h3>
                <p className="text-xs leading-relaxed">
                  <strong className="text-amber-700">المناوبات ليست مهام عشوائية</strong> — إنها مسؤوليات منظمة مقيدة بالوقت والمكان والضغط والعدالة. لذلك:
                </p>
                <ul className="space-y-1 text-xs mt-2">
                  <li>✓ التخصيص يجب أن يكون مدفوعاً بالسياسات</li>
                  <li>✓ التنفيذ يجب أن يكون معتمداً من قبل الإنسان</li>
                  <li>✓ العرض يجب أن يكون واضحاً وفورياً</li>
                  <li>✓ التغييرات يجب أن تكون مرئية وقابلة للتتبع</li>
                </ul>
              </div>

              <div className="bg-red-50 rounded-xl p-4 border border-red-200 mt-4">
                <h3 className="font-black text-gray-800 mb-2 flex items-center gap-2">
                  ⚠️ مبدأ مهم
                </h3>
                <p className="text-xs font-bold text-red-700">
                  النظام يقترح، والمسؤول يقرر. النظام لا يستبدل المسؤولين — بل يدعمهم بذكاء منظم.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Duty Swap Modal */}
        <DutySwapModal
          isOpen={swapModalOpen}
          onClose={() => {
            setSwapModalOpen(false);
            setSwapAssignment(null);
          }}
          currentAssignment={swapAssignment}
          employees={employees}
          facilities={facilities}
          breakPeriods={breakPeriods}
          dutyAssignments={dutyAssignments}
          onSubmitSwap={handleSubmitSwap}
        />

        {/* Add Facility Type Modal (NEW) */}
        {showAddTypeModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h3 className="text-lg font-black text-white">➕ إضافة نوع مرفق جديد</h3>
                <button
                  onClick={() => setShowAddTypeModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Type Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم النوع</label>
                  <input
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="مثال: ملعب رياضي"
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
                  />
                </div>

                {/* Icon */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    الرمز (Emoji)
                    <span className="text-xs text-gray-500 font-normal mr-2">اختياري</span>
                  </label>
                  <input
                    type="text"
                    value={newTypeIcon}
                    onChange={(e) => setNewTypeIcon(e.target.value)}
                    placeholder="مثال: ⚽"
                    maxLength={2}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none text-2xl text-center"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 انسخ Emoji من لوحة المفاتيح أو اتركه فارغاً للرمز الافتراضي
                  </p>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اللون</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['blue', 'green', 'purple', 'orange', 'red', 'teal', 'indigo', 'pink'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTypeColor(color)}
                        className={`h-10 rounded-lg border-2 transition-all ${newTypeColor === color
                          ? `bg-${color}-500 border-${color}-600 ring-2 ring-${color}-300`
                          : `bg-${color}-200 border-${color}-300 hover:bg-${color}-300`
                          }`}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-gray-50 rounded-lg p-3 border-2 border-gray-200">
                  <p className="text-xs font-bold text-gray-600 mb-2">👁️ معاينة:</p>
                  <div className={`inline-flex items-center gap-2 px-3 py-2 bg-${newTypeColor}-100 border border-${newTypeColor}-300 rounded-lg`}>
                    <span className="text-xl">{newTypeIcon || '🏛️'}</span>
                    <span className={`text-sm font-bold text-${newTypeColor}-800`}>
                      {newTypeName || 'اسم النوع'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={handleAddFacilityType}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all shadow-sm"
                >
                  ✅ إضافة النوع
                </button>
                <button
                  onClick={() => setShowAddTypeModal(false)}
                  className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manage Facility Types Section (NEW) - Add before closing div */}
        <div className="fixed bottom-4 left-4 z-20">
          <button
            onClick={() => {
              const show = !document.getElementById('facility-types-panel')?.classList.contains('hidden');
              document.getElementById('facility-types-panel')?.classList.toggle('hidden');
            }}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold shadow-lg transition-all flex items-center gap-2"
            title="إدارة أنواع المرافق"
          >
            <Building2 size={16} />
            إدارة الأنواع
          </button>

          <div id="facility-types-panel" className="hidden absolute bottom-14 left-0 bg-white rounded-xl shadow-2xl border-2 border-indigo-200 p-4 w-80 max-h-96 overflow-y-auto" dir="rtl">
            <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-indigo-600" />
              أنواع المرافق ({facilityTypes.length})
            </h4>

            <div className="space-y-2">
              {facilityTypes.map(type => {
                const usageCount = facilities.filter(f => f.type === type.id).length;

                return (
                  <div
                    key={type.id}
                    className={`flex items-center justify-between p-2 bg-${type.color}-50 border border-${type.color}-200 rounded-lg`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{type.icon}</span>
                      <div>
                        <p className={`text-sm font-bold text-${type.color}-800`}>{type.name}</p>
                        <p className="text-xs text-gray-500">{usageCount} مرفق</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFacilityType(type.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="حذف"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add/Edit Break Period */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-black flex items-center gap-2">
                <Coffee size={24} />
                {editingBreakPeriod ? 'تعديل فترة مناوبة' : 'إضافة فترة مناوبة جديدة'}
              </h3>
              <button
                onClick={() => {
                  setShowBreakModal(false);
                  setEditingBreakPeriod(null);
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Break Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  🎯 اسم المناوبة *
                </label>
                <input
                  type="text"
                  value={breakFormData.name}
                  onChange={(e) => setBreakFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثل: الاستراحة الأولى"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none font-bold"
                />
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ⏰ وقت البداية *
                  </label>
                  <input
                    type="time"
                    value={breakFormData.startTime}
                    onChange={(e) => setBreakFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ⏰ وقت النهاية *
                  </label>
                  <input
                    type="time"
                    value={breakFormData.endTime}
                    onChange={(e) => setBreakFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none font-bold"
                  />
                </div>
              </div>

              {/* Break Type */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  🏘 نوع المناوبة *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setBreakFormData(prev => ({ ...prev, breakType: 'internal' }))}
                    className={`p-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${breakFormData.breakType === 'internal'
                      ? 'bg-blue-500 border-blue-600 text-white shadow-lg scale-105'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                      }`}
                  >
                    <span className="text-2xl">🏠</span>
                    <span className="text-sm">داخلي</span>
                  </button>
                  <button
                    onClick={() => setBreakFormData(prev => ({ ...prev, breakType: 'external' }))}
                    className={`p-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${breakFormData.breakType === 'external'
                      ? 'bg-green-500 border-green-600 text-white shadow-lg scale-105'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-green-300'
                      }`}
                  >
                    <span className="text-2xl">🌳</span>
                    <span className="text-sm">خارجي</span>
                  </button>
                  <button
                    onClick={() => setBreakFormData(prev => ({ ...prev, breakType: 'mixed' }))}
                    className={`p-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${breakFormData.breakType === 'mixed'
                      ? 'bg-purple-500 border-purple-600 text-white shadow-lg scale-105'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-purple-300'
                      }`}
                  >
                    <span className="text-2xl">🏠🌳</span>
                    <span className="text-sm">مختلط</span>
                  </button>
                </div>
              </div>

              {/* Target Classes */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  🏫 الصفوف المستهدفة
                  <span className="text-xs text-gray-500 font-normal mr-2">(اختياري - يمكنك اختيار عدة صفوف)</span>
                </label>

                {availableGradesFromSystem.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg text-center">
                    <p className="text-sm text-yellow-700 font-bold">⚠️ لم يتم بناء الهيكلية الصفية</p>
                    <p className="text-xs text-yellow-600 mt-1">يرجى الذهاب إلى الإعدادات → باني الهيكلية</p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                    {/* Select All / Deselect All */}
                    <div className="mb-3 pb-3 border-b border-gray-300 flex items-center justify-between">
                      <button
                        onClick={() => {
                          const allClasses = classes.map(c => c.id);
                          setBreakFormData(prev => ({ ...prev, targetGrades: allClasses }));
                        }}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        ✅ تحديد الكل
                      </button>
                      <button
                        onClick={() => setBreakFormData(prev => ({ ...prev, targetGrades: [] }))}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        ❌ إلغاء التحديد
                      </button>
                    </div>

                    {/* Classes grouped by grade */}
                    {availableGradesFromSystem.map(grade => {
                      const classesInGrade = classes.filter(c => String(c.gradeLevel) === grade);
                      return (
                        <div key={grade} className="mb-4">
                          <p className="text-xs font-black text-gray-600 mb-2 flex items-center gap-2">
                            🎓 الصف {grade} ({classesInGrade.length} شعبة)
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {classesInGrade.map(cls => (
                              <label
                                key={cls.id}
                                className="flex items-center gap-2 p-2 bg-white rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-300 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={breakFormData.targetGrades.includes(cls.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setBreakFormData(prev => ({
                                        ...prev,
                                        targetGrades: [...prev.targetGrades, cls.id]
                                      }));
                                    } else {
                                      setBreakFormData(prev => ({
                                        ...prev,
                                        targetGrades: prev.targetGrades.filter(id => id !== cls.id)
                                      }));
                                    }
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm font-bold text-gray-800">{cls.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Count */}
                {breakFormData.targetGrades.length > 0 && (
                  <p className="text-xs text-blue-600 font-bold mt-2">
                    ✅ تم تحديد {breakFormData.targetGrades.length} صف
                  </p>
                )}
              </div>

              {/* Target Facilities - Based on Break Type */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  🏖️ المرافق المستهدفة
                  <span className="text-xs text-gray-500 font-normal mr-2">(حسب نوع المناوبة)</span>
                </label>

                {facilities.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg text-center">
                    <p className="text-sm text-yellow-700 font-bold">⚠️ لم يتم إضافة مرافق بعد</p>
                    <p className="text-xs text-yellow-600 mt-1">يرجى إضافة مرافق في تبويب "إدارة المرافق"</p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                    {/* Select All / Deselect All */}
                    <div className="mb-3 pb-3 border-b border-gray-300 flex items-center justify-between">
                      <button
                        onClick={() => {
                          const filteredFacilities = facilities
                            .filter(f => {
                              if (breakFormData.breakType === 'internal') return f.locationType === 'internal' || !f.locationType;
                              if (breakFormData.breakType === 'external') return f.locationType === 'external';
                              return true; // mixed: all facilities
                            })
                            .map(f => f.id);
                          setBreakFormData(prev => ({ ...prev, targetFloors: filteredFacilities }));
                        }}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        ✅ تحديد الكل
                      </button>
                      <button
                        onClick={() => setBreakFormData(prev => ({ ...prev, targetFloors: [] }))}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        ❌ إلغاء التحديد
                      </button>
                    </div>

                    {/* Facilities filtered by break type */}
                    {breakFormData.breakType === 'internal' && (
                      <div className="mb-4">
                        <p className="text-xs font-black text-blue-600 mb-2 flex items-center gap-2">
                          🏠 المرافق الداخلية ({facilities.filter(f => f.locationType === 'internal' || !f.locationType).length})
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {facilities
                            .filter(f => f.locationType === 'internal' || !f.locationType)
                            .map(facility => {
                              const facilityType = facilityTypes.find(ft => ft.id === facility.type);
                              return (
                                <label
                                  key={facility.id}
                                  className="flex items-center gap-2 p-2 bg-white rounded-lg border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={breakFormData.targetFloors.includes(facility.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setBreakFormData(prev => ({
                                          ...prev,
                                          targetFloors: [...prev.targetFloors, facility.id]
                                        }));
                                      } else {
                                        setBreakFormData(prev => ({
                                          ...prev,
                                          targetFloors: prev.targetFloors.filter(id => id !== facility.id)
                                        }));
                                      }
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-xl">{facilityType?.icon || '🏖️'}</span>
                                  <span className="text-sm font-bold text-gray-800">{facility.name}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {breakFormData.breakType === 'external' && (
                      <div className="mb-4">
                        <p className="text-xs font-black text-green-600 mb-2 flex items-center gap-2">
                          🌳 المرافق الخارجية ({facilities.filter(f => f.locationType === 'external').length})
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {facilities
                            .filter(f => f.locationType === 'external')
                            .map(facility => {
                              const facilityType = facilityTypes.find(ft => ft.id === facility.type);
                              return (
                                <label
                                  key={facility.id}
                                  className="flex items-center gap-2 p-2 bg-white rounded-lg border-2 border-green-200 cursor-pointer hover:border-green-400 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={breakFormData.targetFloors.includes(facility.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setBreakFormData(prev => ({
                                          ...prev,
                                          targetFloors: [...prev.targetFloors, facility.id]
                                        }));
                                      } else {
                                        setBreakFormData(prev => ({
                                          ...prev,
                                          targetFloors: prev.targetFloors.filter(id => id !== facility.id)
                                        }));
                                      }
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-xl">{facilityType?.icon || '🌳'}</span>
                                  <span className="text-sm font-bold text-gray-800">{facility.name}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {breakFormData.breakType === 'mixed' && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-black text-blue-600 mb-2 flex items-center gap-2">
                            🏠 المرافق الداخلية ({facilities.filter(f => f.locationType === 'internal' || !f.locationType).length})
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {facilities
                              .filter(f => f.locationType === 'internal' || !f.locationType)
                              .map(facility => {
                                const facilityType = facilityTypes.find(ft => ft.id === facility.type);
                                return (
                                  <label
                                    key={facility.id}
                                    className="flex items-center gap-2 p-2 bg-white rounded-lg border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={breakFormData.targetFloors.includes(facility.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setBreakFormData(prev => ({
                                            ...prev,
                                            targetFloors: [...prev.targetFloors, facility.id]
                                          }));
                                        } else {
                                          setBreakFormData(prev => ({
                                            ...prev,
                                            targetFloors: prev.targetFloors.filter(id => id !== facility.id)
                                          }));
                                        }
                                      }}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-xl">{facilityType?.icon || '🏖️'}</span>
                                    <span className="text-sm font-bold text-gray-800">{facility.name}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-black text-green-600 mb-2 flex items-center gap-2">
                            🌳 المرافق الخارجية ({facilities.filter(f => f.locationType === 'external').length})
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {facilities
                              .filter(f => f.locationType === 'external')
                              .map(facility => {
                                const facilityType = facilityTypes.find(ft => ft.id === facility.type);
                                return (
                                  <label
                                    key={facility.id}
                                    className="flex items-center gap-2 p-2 bg-white rounded-lg border-2 border-green-200 cursor-pointer hover:border-green-400 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={breakFormData.targetFloors.includes(facility.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setBreakFormData(prev => ({
                                            ...prev,
                                            targetFloors: [...prev.targetFloors, facility.id]
                                          }));
                                        } else {
                                          setBreakFormData(prev => ({
                                            ...prev,
                                            targetFloors: prev.targetFloors.filter(id => id !== facility.id)
                                          }));
                                        }
                                      }}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-xl">{facilityType?.icon || '🌳'}</span>
                                    <span className="text-sm font-bold text-gray-800">{facility.name}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Count */}
                {breakFormData.targetFloors.length > 0 && (
                  <p className="text-xs text-purple-600 font-bold mt-2">
                    ✅ تم تحديد {breakFormData.targetFloors.length} مرفق
                  </p>
                )}
              </div>

              {/* Source Type */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  📌 مصدر المناوبة
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setBreakFormData(prev => ({ ...prev, sourceType: 'manual', isAutoLinked: false }))}
                    className={`flex-1 p-3 rounded-lg border-2 font-bold transition-all ${breakFormData.sourceType === 'manual'
                      ? 'bg-gray-500 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                  >
                    ✍️ يدوي
                  </button>
                  <button
                    onClick={() => setBreakFormData(prev => ({ ...prev, sourceType: 'schedule', isAutoLinked: true }))}
                    className={`flex-1 p-3 rounded-lg border-2 font-bold transition-all ${breakFormData.sourceType === 'schedule'
                      ? 'bg-green-500 border-green-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-green-300'
                      }`}
                  >
                    🔗 من الجدول
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t-2 border-gray-200 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowBreakModal(false);
                  setEditingBreakPeriod(null);
                }}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
              >
                ❌ إلغاء
              </button>
              <button
                onClick={() => {
                  // Validation
                  if (!breakFormData.name.trim()) {
                    alert('يرجى إدخال اسم المناوبة');
                    return;
                  }
                  if (!breakFormData.startTime || !breakFormData.endTime) {
                    alert('يرجى تحديد وقت البداية والنهاية');
                    return;
                  }

                  // Separate facilities by type based on locationType
                  const internalFacilities: string[] = [];
                  const externalFacilities: string[] = [];

                  breakFormData.targetFloors.forEach(facilityId => {
                    const facility = facilities.find(f => f.id === facilityId);
                    if (facility) {
                      if (facility.locationType === 'external') {
                        externalFacilities.push(facilityId);
                      } else {
                        // Default to internal if no locationType or internal
                        internalFacilities.push(facilityId);
                      }
                    }
                  });

                  const newBreakPeriod: BreakPeriod = {
                    id: editingBreakPeriod?.id || `break-${Date.now()}`,
                    name: breakFormData.name,
                    startTime: breakFormData.startTime,
                    endTime: breakFormData.endTime,
                    order: editingBreakPeriod?.order || breakPeriods.length + 1,
                    breakType: breakFormData.breakType,
                    targetGrades: breakFormData.targetGrades,
                    sourceType: breakFormData.sourceType,
                    isAutoLinked: breakFormData.isAutoLinked,
                    linkedFacilities: {
                      internal: internalFacilities,
                      external: externalFacilities
                    }
                  };

                  if (editingBreakPeriod) {
                    // Update existing
                    setBreakPeriods(prev => prev.map(bp =>
                      bp.id === editingBreakPeriod.id ? newBreakPeriod : bp
                    ));
                  } else {
                    // Add new
                    setBreakPeriods(prev => [...prev, newBreakPeriod]);
                  }

                  setShowBreakModal(false);
                  setEditingBreakPeriod(null);

                  // Reset form
                  setBreakFormData({
                    name: '',
                    startTime: '07:30',
                    endTime: '08:00',
                    breakType: 'external',
                    targetGrades: [],
                    targetFloors: [],
                    sourceType: 'manual',
                    isAutoLinked: false
                  });
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-bold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg flex items-center gap-2"
              >
                <CheckCircle2 size={18} />
                {editingBreakPeriod ? '💾 حفظ التعديلات' : '➕ إضافة المناوبة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Day Duty Selection Modal */}
      {dayDutyModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={24} />
                <div>
                  <h3 className="text-lg font-black">تحديد مناوبين - {dayDutyModal.dayName}</h3>
                  <p className="text-sm text-orange-100">
                    {dayDutyModal.dutyType === 'full' ? 'مناوبة كاملة' : dayDutyModal.dutyType === 'half' ? 'نصف مناوبة' : 'كل الأنواع'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDayDutyModal({ isOpen: false, dayName: '', dayIndex: 0, dutyType: null })}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* Teacher List */}
              {(() => {
                // Get teachers who work on this day
                const teachersOnDay = getTeachersForDay(dayDutyModal.dayName);

                // Separate into:
                // 1. Assigned to THIS day (show at bottom with remove option)
                // 2. Assigned SAME TYPE to OTHER days (show with day indicator, blocked)
                // 3. Not assigned for this type (show at top - can have OTHER type elsewhere)
                const currentDutyType = dayDutyModal.dutyType; // 'full', 'half', or null

                const assigned = teachersOnDay.filter(t => {
                  const allAssignments = dayDutyAssignments.filter(a => a.teacherId === Number(t.id));
                  return allAssignments.some(a => a.dayName === dayDutyModal.dayName);
                });

                const assignedSameTypeOtherDays = teachersOnDay.filter(t => {
                  const allAssignments = dayDutyAssignments.filter(a => a.teacherId === Number(t.id));
                  // Not assigned to this day
                  if (allAssignments.some(a => a.dayName === dayDutyModal.dayName)) return false;
                  // Check if same type is assigned elsewhere
                  return allAssignments.some(a =>
                    a.dayName !== dayDutyModal.dayName &&
                    (currentDutyType === null || a.dutyType === currentDutyType)
                  );
                });

                const notAssigned = teachersOnDay.filter(t => {
                  const allAssignments = dayDutyAssignments.filter(a => a.teacherId === Number(t.id));
                  // Not assigned to this day
                  if (allAssignments.some(a => a.dayName === dayDutyModal.dayName)) return false;
                  // Not assigned same type elsewhere (but may have different type)
                  return !allAssignments.some(a =>
                    a.dayName !== dayDutyModal.dayName &&
                    (currentDutyType === null || a.dutyType === currentDutyType)
                  );
                });

                // Sort: not assigned first, then blocked (same type elsewhere), then assigned to this day
                const sortedTeachers = [...notAssigned, ...assignedSameTypeOtherDays, ...assigned];

                if (sortedTeachers.length === 0) {
                  return (
                    <div className="text-center py-10 text-gray-500">
                      <Users size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="font-bold">لا يوجد موظفين لديهم دوام في هذا اليوم</p>
                      <p className="text-sm mt-2">تأكد من إدخال الجدول الدراسي</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {/* Stats + Quick Actions */}
                    <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-600">
                          إجمالي: {sortedTeachers.length}
                        </span>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-sm text-green-600">متاح: {notAssigned.length}</span>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-sm text-orange-600">موزع: {assigned.length}</span>
                      </div>

                      {/* Quick Select All Button */}
                      {notAssigned.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const dutyType = dayDutyModal.dutyType || 'full';
                            notAssigned.forEach(teacher => {
                              // Use setTimeout to batch updates properly
                              setTimeout(() => {
                                handleAssignDayDuty(teacher.id, dayDutyModal.dayName, dutyType);
                              }, 0);
                            });
                          }}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors flex items-center gap-1"
                        >
                          ✔ تحديد الكل ({notAssigned.length})
                        </button>
                      )}
                    </div>

                    {sortedTeachers.map(teacher => {
                      // Get all assignments for this teacher
                      const allAssignments = dayDutyAssignments.filter(a => a.teacherId === Number(teacher.id));

                      // Check if assigned to THIS day (any type)
                      const assignmentOnThisDay = allAssignments.find(a => a.dayName === dayDutyModal.dayName);
                      const isAssignedHere = !!assignmentOnThisDay;

                      // For "assigned elsewhere" check - only block if same duty type is assigned elsewhere
                      // A teacher can have full duty on one day AND half duty on another day
                      const currentDutyType = dayDutyModal.dutyType; // 'full', 'half', or null (both)

                      // Check if they have the SAME type assigned elsewhere
                      const sameTypeElsewhere = allAssignments.find(
                        a => a.dayName !== dayDutyModal.dayName &&
                          (currentDutyType === null || a.dutyType === currentDutyType)
                      );

                      // Only show as "assigned elsewhere" if they have the same type elsewhere
                      const isAssignedElsewhere = currentDutyType !== null
                        ? !!sameTypeElsewhere
                        : allAssignments.some(a => a.dayName !== dayDutyModal.dayName);

                      // Get the relevant assignment to display
                      const displayAssignment = assignmentOnThisDay || sameTypeElsewhere || allAssignments[0];

                      return (
                        <div
                          key={teacher.id}
                          className={`p-3 rounded-lg border-2 flex items-center justify-between transition-all ${isAssignedHere
                            ? 'bg-green-50 border-green-300'
                            : isAssignedElsewhere
                              ? 'bg-gray-100 border-gray-200 opacity-60'
                              : 'bg-white border-gray-200 hover:border-orange-300'
                            }`}
                        >
                          {/* Teacher Info */}
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isAssignedHere ? 'bg-green-500' : isAssignedElsewhere ? 'bg-gray-400' : 'bg-blue-500'
                              }`}>
                              {teacher.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">{teacher.name}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {teacher.constraints?.isHalfTime && (
                                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">نصف دوام</span>
                                )}
                                {isAssignedElsewhere && sameTypeElsewhere && (
                                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
                                    ← {sameTypeElsewhere.dayName.replace('ال', '')} ({sameTypeElsewhere.dutyType === 'full' ? 'كاملة' : 'نصف'})
                                  </span>
                                )}
                                {isAssignedHere && assignmentOnThisDay && (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                    {assignmentOnThisDay.dutyType === 'full' ? 'مناوبة كاملة' : 'نصف مناوبة'}
                                  </span>
                                )}
                                {/* Show OTHER type assignment info if exists */}
                                {!isAssignedHere && allAssignments.length > 0 && !isAssignedElsewhere && (
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                                    📅 {allAssignments[0].dayName.replace('ال', '')} ({allAssignments[0].dutyType === 'full' ? 'كاملة' : 'نصف'})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            {isAssignedHere ? (
                              // Remove button
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleRemoveDayDuty(teacher.id, dayDutyModal.dayName);
                                }}
                                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors"
                              >
                                ✖ إلغاء
                              </button>
                            ) : isAssignedElsewhere ? (
                              // Already assigned elsewhere - show info
                              <span className="text-xs text-gray-400">موزع مسبقاً</span>
                            ) : (
                              // Assign buttons (full or half based on modal type)
                              <>
                                {(dayDutyModal.dutyType === null || dayDutyModal.dutyType === 'full') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleAssignDayDuty(teacher.id, dayDutyModal.dayName, 'full');
                                    }}
                                    className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors"
                                  >
                                    كاملة
                                  </button>
                                )}
                                {(dayDutyModal.dutyType === null || dayDutyModal.dutyType === 'half') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleAssignDayDuty(teacher.id, dayDutyModal.dayName, 'half');
                                    }}
                                    className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold hover:bg-yellow-200 transition-colors"
                                  >
                                    نصف
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex flex-col gap-3 border-t border-gray-200">
              {/* Distribution Balance Check */}
              {(() => {
                // Get school days
                const startDayIndex = DAYS_AR.indexOf(scheduleConfig.weekStartDay);
                const sortedDays = [...DAYS_AR.slice(startDayIndex), ...DAYS_AR.slice(0, startDayIndex)];
                const schoolDays = sortedDays.filter(day => !(scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(day)));

                // Count per day and type
                const dayStats = schoolDays.map(day => {
                  const fullCount = dayDutyAssignments.filter(a => a.dayName === day && a.dutyType === 'full').length;
                  const halfCount = dayDutyAssignments.filter(a => a.dayName === day && a.dutyType === 'half').length;
                  return { day, fullCount, halfCount, total: fullCount + halfCount };
                });

                // Check for imbalance
                const fullCounts = dayStats.map(s => s.fullCount);
                const halfCounts = dayStats.map(s => s.halfCount);
                const maxFull = Math.max(...fullCounts);
                const minFull = Math.min(...fullCounts);
                const maxHalf = Math.max(...halfCounts);
                const minHalf = Math.min(...halfCounts);

                const hasFullImbalance = maxFull > 0 && (maxFull - minFull) > 1;
                const hasHalfImbalance = maxHalf > 0 && (maxHalf - minHalf) > 1;

                if (!hasFullImbalance && !hasHalfImbalance) return null;

                return (
                  <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-xl">⚠️</span>
                      <div className="flex-1">
                        <p className="font-bold text-amber-800 text-sm">تنبيه: التوزيع غير متساوي!</p>
                        <div className="text-xs text-amber-700 mt-1 space-y-1">
                          {hasFullImbalance && (
                            <p>
                              <span className="font-bold">مناوبة كاملة:</span>{' '}
                              {dayStats.map(s => `${s.day.replace('ال', '')}(${s.fullCount})`).join(' - ')}
                            </p>
                          )}
                          {hasHalfImbalance && (
                            <p>
                              <span className="font-bold">نصف مناوبة:</span>{' '}
                              {dayStats.map(s => `${s.day.replace('ال', '')}(${s.halfCount})`).join(' - ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Footer Actions */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  تم توزيع: <span className="font-bold text-green-600">{dayDutyAssignments.filter(a => a.dayName === dayDutyModal.dayName).length}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Final validation before closing
                    const startDayIndex = DAYS_AR.indexOf(scheduleConfig.weekStartDay);
                    const sortedDays = [...DAYS_AR.slice(startDayIndex), ...DAYS_AR.slice(0, startDayIndex)];
                    const schoolDays = sortedDays.filter(day => !(scheduleConfig.holidays || []).some(h => normalizeArabic(h) === normalizeArabic(day)));

                    const dayStats = schoolDays.map(day => {
                      const fullCount = dayDutyAssignments.filter(a => a.dayName === day && a.dutyType === 'full').length;
                      const halfCount = dayDutyAssignments.filter(a => a.dayName === day && a.dutyType === 'half').length;
                      return { day, fullCount, halfCount };
                    });

                    const fullCounts = dayStats.map(s => s.fullCount);
                    const halfCounts = dayStats.map(s => s.halfCount);
                    const maxFull = Math.max(...fullCounts);
                    const minFull = Math.min(...fullCounts);
                    const maxHalf = Math.max(...halfCounts);
                    const minHalf = Math.min(...halfCounts);

                    const hasFullImbalance = maxFull > 0 && (maxFull - minFull) > 1;
                    const hasHalfImbalance = maxHalf > 0 && (maxHalf - minHalf) > 1;

                    if (hasFullImbalance || hasHalfImbalance) {
                      const msg = [
                        '⚠️ تنبيه: التوزيع غير متساوي!\n'
                      ];

                      if (hasFullImbalance) {
                        msg.push('مناوبة كاملة:');
                        dayStats.forEach(s => msg.push(`  ${s.day}: ${s.fullCount} معلم`));
                        msg.push('');
                      }

                      if (hasHalfImbalance) {
                        msg.push('نصف مناوبة:');
                        dayStats.forEach(s => msg.push(`  ${s.day}: ${s.halfCount} معلم`));
                      }

                      msg.push('\nهل تريد الاستمرار على أي حال؟');

                      if (!window.confirm(msg.join('\n'))) {
                        return; // Don't close
                      }
                    }

                    setDayDutyModal({ isOpen: false, dayName: '', dayIndex: 0, dutyType: null });
                  }}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
                >
                  تم
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grade Picker Modal for Break Cards */}
      {gradePickerModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className={`px-6 py-4 flex items-center justify-between ${gradePickerModal.locationType === 'internal'
              ? 'bg-gradient-to-r from-blue-500 to-blue-600'
              : 'bg-gradient-to-r from-green-500 to-green-600'
              } text-white`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{gradePickerModal.locationType === 'internal' ? '🏠' : '🌳'}</span>
                <div>
                  <h3 className="text-lg font-black">تحديد الطبقات المستهدفة</h3>
                  <p className="text-sm opacity-80">
                    {gradePickerModal.locationType === 'internal' ? 'القسم الداخلي' : 'القسم الخارجي'} - {breakPeriods.find(bp => bp.id === gradePickerModal.breakPeriodId)?.name || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGradePickerModal({ isOpen: false, breakPeriodId: '', locationType: 'internal' })}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {getGradesWithSections().length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p className="font-bold">⚠️ لم يتم بناء الهيكلية الصفية</p>
                  <p className="text-sm mt-2">يرجى الذهاب إلى الإعدادات → باني الهيكلية</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Quick Actions */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-bold text-gray-600">
                      اختر الطبقات ({getGradesWithSections().length} طبقة)
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const allGrades = getGradesWithSections().map(g => g.grade);
                          const field = gradePickerModal.locationType === 'internal' ? 'internalTargetGrades' : 'externalTargetGrades';
                          setBreakPeriods(prev => prev.map(bp =>
                            bp.id === gradePickerModal.breakPeriodId
                              ? { ...bp, [field]: allGrades }
                              : bp
                          ));
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
                      >
                        ✔ تحديد الكل
                      </button>
                      <button
                        onClick={() => {
                          const field = gradePickerModal.locationType === 'internal' ? 'internalTargetGrades' : 'externalTargetGrades';
                          setBreakPeriods(prev => prev.map(bp =>
                            bp.id === gradePickerModal.breakPeriodId
                              ? { ...bp, [field]: [] }
                              : bp
                          ));
                        }}
                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        ✖ إلغاء الكل
                      </button>
                    </div>
                  </div>

                  {/* Grade Cards */}
                  {getGradesWithSections().map(gradeInfo => {
                    const breakPeriod = breakPeriods.find(bp => bp.id === gradePickerModal.breakPeriodId);
                    const currentGrades = gradePickerModal.locationType === 'internal'
                      ? (breakPeriod?.internalTargetGrades || [])
                      : (breakPeriod?.externalTargetGrades || []);
                    const isSelected = currentGrades.includes(gradeInfo.grade);

                    return (
                      <div
                        key={gradeInfo.grade}
                        onClick={() => {
                          const field = gradePickerModal.locationType === 'internal' ? 'internalTargetGrades' : 'externalTargetGrades';
                          setBreakPeriods(prev => prev.map(bp => {
                            if (bp.id !== gradePickerModal.breakPeriodId) return bp;
                            const currentGrades = gradePickerModal.locationType === 'internal'
                              ? (bp.internalTargetGrades || [])
                              : (bp.externalTargetGrades || []);
                            const newGrades = isSelected
                              ? currentGrades.filter(g => g !== gradeInfo.grade)
                              : [...currentGrades, gradeInfo.grade];
                            return { ...bp, [field]: newGrades };
                          }));
                        }}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                          ? gradePickerModal.locationType === 'internal'
                            ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                            : 'bg-green-50 border-green-400 ring-2 ring-green-200'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Selection Indicator */}
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected
                              ? gradePickerModal.locationType === 'internal'
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300'
                              }`}>
                              {isSelected && <CheckCircle2 size={14} />}
                            </div>

                            {/* Grade Info */}
                            <div>
                              <p className="font-black text-gray-800 text-sm">🏫 {gradeInfo.gradeName}</p>
                              <p className="text-xs text-gray-500">
                                {gradeInfo.classes.length} شعبة
                              </p>
                            </div>
                          </div>

                          {/* Sections Preview */}
                          <div className="flex flex-wrap gap-1 max-w-[150px] justify-end">
                            {gradeInfo.classes.slice(0, 4).map(cls => (
                              <span
                                key={cls.id}
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isSelected
                                  ? gradePickerModal.locationType === 'internal'
                                    ? 'bg-blue-200 text-blue-800'
                                    : 'bg-green-200 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                                  }`}
                              >
                                {cls.name.split(' ').pop()}
                              </span>
                            ))}
                            {gradeInfo.classes.length > 4 && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full font-bold">
                                +{gradeInfo.classes.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  محدد: <span className={`font-bold ${gradePickerModal.locationType === 'internal' ? 'text-blue-600' : 'text-green-600'
                    }`}>
                    {(() => {
                      const breakPeriod = breakPeriods.find(bp => bp.id === gradePickerModal.breakPeriodId);
                      const currentGrades = gradePickerModal.locationType === 'internal'
                        ? (breakPeriod?.internalTargetGrades || [])
                        : (breakPeriod?.externalTargetGrades || []);
                      return currentGrades.length;
                    })()} طبقة
                  </span>
                </div>
                <button
                  onClick={() => setGradePickerModal({ isOpen: false, breakPeriodId: '', locationType: 'internal' })}
                  className={`px-6 py-2 text-white rounded-lg font-bold transition-colors ${gradePickerModal.locationType === 'internal'
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-green-500 hover:bg-green-600'
                    }`}
                >
                  تم
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DutyManagement;
