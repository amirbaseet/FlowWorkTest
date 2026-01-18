
import * as React from 'react';
import { useState, useMemo } from 'react';
import { 
  Plus, Users, Calendar as CalendarIcon, X, 
  UserPlus, Bus, Siren, FileText, LayoutGrid, GraduationCap, 
  ArrowRightLeft, Wand2, AlertCircle, CheckCircle2, CheckSquare, Unlock, Briefcase, Coffee, Clock, CloudRain
} from 'lucide-react';
import { Employee, CalendarEvent, ClassItem, Lesson, SubstitutionLog } from '../types';
import { useToast } from '../contexts/ToastContext';
import UnifiedEventForm from './UnifiedEventForm';
import { DAYS_AR } from '../constants';
import { normalizeArabic } from '../utils';

// --- HELPER: Parse Key correctly handling hyphens in Class IDs ---
const parseKey = (key: string) => {
    const lastDash = key.lastIndexOf('-');
    if (lastDash === -1) return { classId: key, period: 0 };
    return {
        classId: key.substring(0, lastDash),
        period: parseInt(key.substring(lastDash + 1)) || 0
    };
};

// --- COMPONENT: Manual Distribution Grid ---
interface ManualDistributionProps {
    classes: ClassItem[];
    allClasses: ClassItem[];
    periods: number[];
    lessons: Lesson[];
    employees: Employee[];
    date: string;
    assignments: Record<string, { teacherId: number, reason: string }[]>;
    onAssign: (classId: string, period: number, teacherId: number, reason: string) => void;
    onRemove: (classId: string, period: number, teacherId: number) => void;
    onBulkAssign?: (assignments: { classId: string, period: number, teacherId: number, reason: string }[]) => void;
    modeType: string;
    poolIds?: number[];
    externalPartners?: { id: string; userIds: string[] }[];
}

const ManualDistributionGrid: React.FC<ManualDistributionProps> = ({ 
    classes, allClasses, periods = [], lessons, employees, date, assignments = {}, onAssign, onRemove, onBulkAssign, modeType, poolIds = [], externalPartners = []
}) => {
    const { addToast } = useToast();
    const [activeSlot, setActiveSlot] = useState<{classId: string, period: number} | null>(null);
    
    // Trip Logic States
    const [showTripRecommendations, setShowTripRecommendations] = useState(false);
    const [tripCandidates, setTripCandidates] = useState<{emp: Employee, score: number, gradeCount: number, mainClassId: string}[]>([]);
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
    const [viewPhase, setViewPhase] = useState<'SELECTION' | 'COVERAGE'>('SELECTION');

    const dayName = DAYS_AR[new Date(date).getDay()];
    const normDay = normalizeArabic(dayName);

    const getModeMeta = () => {
        switch (modeType) {
            case 'TRIP': return { label: 'المرافقين', action: 'تعيين مرافق', role: 'مرافق', icon: Bus, color: 'emerald', desc: 'الأولوية للأكثر ارتباطاً بالطبقة' };
            case 'RAINY': return { label: 'المناوبين (داخلي)', action: 'تعيين مناوب', role: 'مناوب داخلي', icon: CloudRain, color: 'cyan', desc: 'توزيع عادل حسب العبء اليومي' };
            case 'HOLIDAY': return { label: 'المنظمين', action: 'تعيين منظم', role: 'منظم', icon: CheckSquare, color: 'violet', desc: 'استغلال المعلمين المتفرغين' };
            case 'EMERGENCY': return { label: 'فريق الطوارئ', action: 'تعيين مساند', role: 'مساند طوارئ', icon: Siren, color: 'rose', desc: 'تغطية النقص الحاد في الطاقم' };
            case 'EXAM': default: return { label: 'المراقبين', action: 'تعيين مراقب', role: 'مراقب', icon: FileText, color: 'violet', desc: 'أولوية للمربي ومعلمي التخصص' };
        }
    };

    const meta = getModeMeta();

    // Helper: Find all educators for the currently selected trip classes
    const tripEducators = useMemo(() => {
        return employees.filter(e => e.addons.educator && classes.some(c => String(c.id) === String(e.addons.educatorClassId)));
    }, [employees, classes]);

    // Calculate Trip Participants (Educators vs Companions) for Display
    const tripParticipants = useMemo(() => {
        const participantIds = new Set<number>();
        
        // 1. From Grid Assignments (Target Trip Classes)
        Object.entries(assignments).forEach(([key, list]) => {
            const { classId } = parseKey(key);
            const isTripClass = classes.some(c => String(c.id) === String(classId));
            if (isTripClass) {
                (list as { teacherId: number, reason: string }[]).forEach(a => participantIds.add(a.teacherId));
            }
        });

        // 2. From Form Partners (The "Companions" selected in the top form)
        externalPartners.forEach(p => {
            p.userIds.forEach(uid => participantIds.add(Number(uid)));
        });

        const participants = Array.from(participantIds).map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[];
        
        const educators: Employee[] = [];
        const companions: Employee[] = [];

        participants.forEach(p => {
            const isTripEducator = classes.some(c => String(c.id) === String(p.addons.educatorClassId));
            if (isTripEducator) educators.push(p);
            else companions.push(p);
        });

        return { educators, companions, allIds: participantIds };
    }, [assignments, employees, classes, externalPartners]);

    // Get Candidates Logic
    const getSlotCandidates = (targetClassId: string, period: number) => {
        const targetClass = allClasses.find(c => c.id === targetClassId); 
        const targetEducator = employees.find(e => e.addons.educator && String(e.addons.educatorClassId) === String(targetClassId));
        
        const assignedElsewhereMap = new Map<number, string>();
        Object.entries(assignments).forEach(([key, valArray]: [string, { teacherId: number, reason: string }[]]) => {
            const entries = valArray;
            const { classId, period: p } = parseKey(key);
            
            if (p === period && classId !== targetClassId) {
                const clsName = allClasses.find(c => c.id === classId)?.name || 'مهمة أخرى';
                entries.forEach(a => assignedElsewhereMap.set(a.teacherId, clsName));
            }
        });

        const assignedInThisSlot = new Set<number>();
        const currentSlotAssignments = assignments[`${targetClassId}-${period}`] || [];
        currentSlotAssignments.forEach(a => assignedInThisSlot.add(a.teacherId));

        // EXCLUSION: Trip Participants
        const tripParticipantsIds = tripParticipants.allIds;

        const releasedTeachers = new Set<number>();
        if (modeType === 'TRIP') {
            lessons.filter(l => 
                l.period === period && 
                normalizeArabic(l.day) === normDay && 
                classes.some(tripC => tripC.id === l.classId)
            ).forEach(l => releasedTeachers.add(l.teacherId));
        }

        const poolCandidates: any[] = [];
        const educatorCandidates: any[] = [];
        const supportCandidates: any[] = [];

        employees.forEach(emp => {
            if (assignedInThisSlot.has(emp.id)) return;
            if (tripParticipantsIds.has(emp.id)) return; // Exclude trip staff from coverage

            const isInPool = poolIds.includes(emp.id);
            const isTargetEducator = targetEducator?.id === emp.id;
            const assignedToClass = assignedElsewhereMap.get(emp.id);
            
            // EXCLUSION: Off-Duty
            if (!emp.constraints.isExternal && !isInPool) {
                const dayLessons = lessons.filter(l => l.teacherId === emp.id && normalizeArabic(l.day) === normDay).map(l => l.period);
                if (dayLessons.length === 0) return;
                const startP = Math.min(...dayLessons);
                const endP = Math.max(...dayLessons);
                if (period < startP || period > endP) return;
            }

            const lesson = lessons.find(l => l.teacherId === emp.id && l.period === period && normalizeArabic(l.day) === normDay);
            
            let statusType = 'FREE';
            let statusLabel = 'فراغ (نافذة)';
            let isReleased = false;
            let priority = 50;

            if (releasedTeachers.has(emp.id)) {
                statusType = 'RELEASED_BY_TRIP';
                statusLabel = 'حر (بسبب الرحلة)';
                isReleased = true;
                priority = 1;
            } else if (lesson) {
                const lType = lesson.type ? lesson.type.toLowerCase() : '';
                if (lType === 'stay') {
                    statusType = 'STAY';
                    statusLabel = `مكوث (${lesson.subject})`;
                } else if (lType === 'individual') {
                    statusType = 'INDIVIDUAL';
                    statusLabel = `فردي (${lesson.subject})`;
                } else {
                    const isTeachingTargetClass = String(lesson.classId) === String(targetClassId);
                    if (isTeachingTargetClass) {
                        statusType = 'RELEASED';
                        statusLabel = `معلم الحصة (${lesson.subject})`;
                        isReleased = true;
                    } else {
                        statusType = 'ACTUAL';
                        statusLabel = `فعلي: ${lesson.subject}`;
                    }
                }
            }

            if (assignedToClass) {
                statusLabel = `مشغول في: ${assignedToClass}`;
                priority = 999;
            }

            if (statusType === 'RELEASED_BY_TRIP') priority = 0;
            else if (isTargetEducator) priority = 2;
            else if (statusType === 'INDIVIDUAL') priority = 10;
            else if (statusType === 'STAY') priority = 15;
            else if (statusType === 'FREE') priority = 20;
            else priority = 50;

            if (isInPool && statusType !== 'ACTUAL' && !assignedToClass) {
                 poolCandidates.push({ emp, label: emp.constraints.isExternal ? 'بديل خارجي' : `احتياط: ${statusLabel}`, type: 'POOL', priority: 0 });
                 return;
            }

            if (emp.addons.educator) {
                educatorCandidates.push({ emp, label: statusLabel, type: statusType, priority, isTarget: isTargetEducator, isAssigned: assignedToClass });
            } else {
                supportCandidates.push({ emp, label: statusLabel, type: statusType, priority, isAssigned: assignedToClass });
            }
        });

        return { 
            poolCandidates: poolCandidates.sort((a,b) => a.priority - b.priority), 
            educatorCandidates: educatorCandidates.sort((a, b) => a.priority - b.priority), 
            supportCandidates: supportCandidates.sort((a, b) => a.priority - b.priority)
        };
    };

    // --- AUTO DISTRIBUTION LOGIC ---
    const handleAutoDistribute = () => {
        if (!onBulkAssign) return;

        if (modeType === 'TRIP') {
            const tripTargetClasses = classes.map(c => c.id);
            const tripEducatorIds = tripEducators.map(e => e.id);

            const teacherStats: Record<number, { count: number, classCounts: Record<string, number> }> = {};

            lessons.forEach(l => {
                if (normalizeArabic(l.day) === normDay && !tripEducatorIds.includes(l.teacherId)) {
                    if (tripTargetClasses.includes(l.classId)) {
                        if (!teacherStats[l.teacherId]) {
                            teacherStats[l.teacherId] = { count: 0, classCounts: {} };
                        }
                        teacherStats[l.teacherId].count++;
                        teacherStats[l.teacherId].classCounts[l.classId] = (teacherStats[l.teacherId].classCounts[l.classId] || 0) + 1;
                    }
                }
            });

            const candidates = Object.entries(teacherStats).map(([tid, stats]) => {
                const emp = employees.find(e => e.id === Number(tid));
                if (!emp) return null;
                const mainClassId = Object.keys(stats.classCounts).sort((a,b) => stats.classCounts[b] - stats.classCounts[a])[0];
                return { emp, score: stats.count, gradeCount: stats.count, mainClassId: mainClassId || tripTargetClasses[0] };
            }).filter(Boolean) as any[];

            candidates.sort((a, b) => b.score - a.score);
            setTripCandidates(candidates);
            setSelectedCandidateIds([]);
            setShowTripRecommendations(true);
            return;
        }
        // Standard logic for exams...
    };

    const handleConfirmSelectedCompanions = () => {
        if (!onBulkAssign || selectedCandidateIds.length === 0) return;
        const newAssignments: any[] = [];
        selectedCandidateIds.forEach(id => {
            const candidate = tripCandidates.find(c => c.emp.id === id);
            if (!candidate) return;
            periods.forEach(p => {
                const existingAssignments = assignments[`${candidate.mainClassId}-${p}`] || [];
                const isAlreadyInSlot = existingAssignments.some(a => a.teacherId === candidate.emp.id);
                if (!isAlreadyInSlot) {
                    newAssignments.push({ classId: candidate.mainClassId, period: p, teacherId: candidate.emp.id, reason: `مرافق رحلة` });
                }
            });
        });
        if (newAssignments.length > 0) {
            onBulkAssign(newAssignments);
            addToast(`تم إضافة ${selectedCandidateIds.length} مرافقين`, "success");
        }
        setShowTripRecommendations(false);
        setSelectedCandidateIds([]);
    };

    const handleRemoveCompanion = (teacherId: number) => {
        let removedCount = 0;
        classes.forEach(cls => {
            periods.forEach(p => {
                const key = `${cls.id}-${p}`;
                const slotAssigns = assignments[key];
                if (slotAssigns && slotAssigns.some(a => a.teacherId === teacherId)) {
                    onRemove(cls.id, p, teacherId);
                    removedCount++;
                }
            });
        });
        if (removedCount > 0) addToast("تم حذف المرافق وإلغاء مهامه", "success");
    };

    const handleAssignEducators = () => {
        if (!onBulkAssign) return;
        const newAssignments: any[] = [];
        tripEducators.forEach(educator => {
            const clsId = educator.addons.educatorClassId!;
            periods.forEach(p => {
                const existing = assignments[`${clsId}-${p}`] || [];
                if (!existing.some(a => a.teacherId === educator.id)) {
                    newAssignments.push({ classId: clsId, period: p, teacherId: educator.id, reason: `مربي الصف` });
                }
            });
        });
        if (newAssignments.length > 0) onBulkAssign(newAssignments);
    };

    // Calculate Impact (Merged Logic)
    const impactedSlots = useMemo(() => {
        if (modeType !== 'TRIP') return [];
        // Use the merged participant list (Assignments + Form Partners)
        const tripTeacherIds = tripParticipants.allIds;

        const impacts: any[] = [];
        tripTeacherIds.forEach(tid => {
            const emp = employees.find(e => e.id === tid);
            if (!emp) return;
            lessons.filter(l => l.teacherId === tid && normalizeArabic(l.day) === normDay).forEach(l => {
                // If the lesson is NOT for a trip class, it's a gap (impact)
                if (!classes.some(c => c.id === l.classId)) {
                    impacts.push({ period: l.period, lesson: l, originalTeacher: emp });
                }
            });
        });
        return impacts.sort((a,b) => a.period - b.period);
    }, [assignments, modeType, lessons, classes, normDay, employees, tripParticipants]);

    const impactedClasses = useMemo(() => {
        const classIds = Array.from(new Set(impactedSlots.map(s => s.lesson.classId)));
        return allClasses.filter(c => classIds.includes(c.id)).sort((a,b) => a.name.localeCompare(b.name));
    }, [impactedSlots, allClasses]);

    return (
        <div className="space-y-4 animate-fade-in flex flex-col h-full min-h-[400px]">
            {/* Header Controls */}
            <div className="flex justify-between items-center mb-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <LayoutGrid size={18} className={`text-${meta.color}-600`}/> 
                        توزيع {meta.label}
                    </h4>
                    
                    {modeType === 'TRIP' && (
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <button onClick={() => setViewPhase('SELECTION')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewPhase === 'SELECTION' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>1. اختيار المرافقين</button>
                            <ArrowRightLeft size={14} className="mx-1 text-slate-300 self-center"/>
                            <button onClick={() => setViewPhase('COVERAGE')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${viewPhase === 'COVERAGE' ? 'bg-rose-100 text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}>2. سد الفجوات ({impactedSlots.length})</button>
                        </div>
                    )}
                </div>

                {onBulkAssign && viewPhase === 'SELECTION' && (
                    <div className="flex gap-2">
                        {modeType === 'TRIP' && (
                            <button onClick={handleAssignEducators} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border border-indigo-200">
                                <GraduationCap size={14}/> تثبيت المربين
                            </button>
                        )}
                        <button onClick={handleAutoDistribute} className={`bg-${meta.color}-50 hover:bg-${meta.color}-100 text-${meta.color}-700 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border border-${meta.color}-200 shadow-sm`}>
                            <Wand2 size={14} /> {modeType === 'TRIP' ? 'اقتراح مرافقين' : 'توزيع آلي'}
                        </button>
                    </div>
                )}
            </div>
            
            <div className="overflow-auto custom-scrollbar rounded-3xl border border-slate-200 shadow-sm flex-1 bg-white relative">
                {viewPhase === 'SELECTION' ? (
                    <table className="w-full text-xs font-bold text-center border-collapse">
                        <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
                            <tr>
                                <th className="p-4 w-40 border-l border-slate-700 text-right">الصف / الحصة</th>
                                {periods.map(p => <th key={p} className="p-4 min-w-[140px] border-l border-slate-700">حصة {p}</th>)}
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {classes.map(cls => {
                                const educator = employees.find(e => e.addons.educator && String(e.addons.educatorClassId) === String(cls.id));
                                return (
                                    <tr key={cls.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                        <td className="p-4 bg-slate-50 font-black text-slate-800 border-l border-slate-200 text-right sticky right-0 z-10">
                                            <div className="flex flex-col">
                                                <span className="text-sm">{cls.name}</span>
                                                {educator && <span className="text-[9px] text-slate-400 font-normal mt-1">{educator.name.split(' ').slice(0,2).join(' ')}</span>}
                                            </div>
                                        </td>
                                        {periods.map(p => {
                                            const slotAssignments = assignments[`${cls.id}-${p}`] || [];
                                            const assignedTeachers = slotAssignments.map(a => employees.find(e => e.id === a.teacherId)).filter(Boolean) as Employee[];
                                            const originalLesson = lessons.find(l => l.classId === cls.id && l.period === p && normalizeArabic(l.day) === normDay);

                                            let cellStyle = 'bg-slate-50';
                                            if (assignedTeachers.length > 0) {
                                                const assignedEducator = educator && assignedTeachers.find(t => t.id === educator.id);
                                                if (assignedEducator) cellStyle = `bg-${meta.color}-100 border border-${meta.color}-300`;
                                                else cellStyle = 'bg-white border border-slate-200';
                                            }

                                            return (
                                                <td key={p} className="p-2 border-l border-slate-100 relative h-28 align-top">
                                                    <div className={`flex flex-col h-full gap-1 rounded-xl p-1.5 transition-all relative group ${cellStyle}`}>
                                                        <div className="flex justify-between items-start opacity-60 px-1 mb-1">
                                                            <span className="text-[9px] text-slate-600 font-bold truncate">{originalLesson ? originalLesson.subject : 'فراغ'}</span>
                                                        </div>
                                                        <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                                                            {assignedTeachers.map(teacher => {
                                                                const isEd = educator?.id === teacher.id;
                                                                return (
                                                                    <div key={teacher.id} className={`flex items-center justify-between p-1.5 rounded-lg text-[9px] font-black shadow-sm ${isEd ? `bg-${meta.color}-600 text-white` : 'bg-slate-100 text-slate-700'}`}>
                                                                        <div className="flex items-center gap-1 truncate">
                                                                            {isEd && <GraduationCap size={10} />}
                                                                            <span className="truncate">{teacher.name.split(' ').slice(0,2).join(' ')}</span>
                                                                        </div>
                                                                        <button onClick={(e) => { e.stopPropagation(); onRemove(cls.id, p, teacher.id); }} className="p-0.5 rounded-full hover:bg-white/20 transition-colors"><X size={10} /></button>
                                                                    </div>
                                                                )
                                                            })}
                                                            <div className="mt-auto">
                                                                <button onClick={() => setActiveSlot({ classId: cls.id, period: p })} className={`w-full flex items-center justify-center gap-1 p-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-${meta.color}-600 hover:bg-${meta.color}-50 transition-all text-[9px] font-bold`}>
                                                                    <Plus size={10} /> إضافة
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    // COVERAGE VIEW
                    <div className="flex flex-col h-full">
                        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 flex flex-col gap-3">
                            <h5 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                <Users size={18} className="text-indigo-600"/> الطاقم المشارك في الرحلة (المرافقون)
                            </h5>
                            <div className="flex flex-wrap gap-4 items-start">
                                {tripParticipants.educators.length > 0 && (
                                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
                                        <div className="p-1 bg-white rounded-lg text-indigo-600 shadow-sm"><GraduationCap size={14}/></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-indigo-400">المربون</span>
                                            <div className="flex flex-wrap gap-1">
                                                {tripParticipants.educators.map(e => <span key={e.id} className="text-[10px] font-black text-indigo-900 bg-white px-1.5 rounded border border-indigo-100">{e.name.split(' ').slice(0,2).join(' ')}</span>)}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {tripParticipants.companions.length > 0 && (
                                    <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                                        <div className="p-1 bg-white rounded-lg text-emerald-600 shadow-sm"><Bus size={14}/></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-emerald-400">المرافقون</span>
                                            <div className="flex flex-wrap gap-1">
                                                {tripParticipants.companions.map(e => (
                                                    <span key={e.id} className="text-[10px] font-black text-emerald-900 bg-white px-1.5 rounded border border-emerald-100 flex items-center gap-1 group cursor-pointer">
                                                        {e.name.split(' ').slice(0,2).join(' ')}
                                                        {/* Only allow removal if not from form partner list (complex to sync back) */}
                                                        {!externalPartners.some(p => p.userIds.includes(String(e.id))) && (
                                                            <button onClick={(ev) => { ev.stopPropagation(); handleRemoveCompanion(e.id); }} className="text-rose-400 hover:text-rose-600 bg-white hover:bg-rose-50 rounded-full p-0.5 transition-colors"><X size={10}/></button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {tripParticipants.allIds.size === 0 && (
                                    <div className="text-slate-400 text-[10px] font-bold italic py-2">لم يتم تحديد أي مرافقين بعد.</div>
                                )}
                            </div>
                        </div>

                        {impactedClasses.length > 0 ? (
                            <table className="w-full text-xs font-bold text-center border-collapse">
                                <thead className="bg-rose-900 text-white sticky top-0 z-10 shadow-md">
                                    <tr>
                                        <th className="p-4 w-40 border-l border-rose-800 text-right">الصف</th>
                                        {periods.map(p => <th key={p} className="p-4 min-w-[140px] border-l border-rose-800">حصة {p}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {impactedClasses.map(cls => (
                                        <tr key={cls.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 bg-slate-50 font-black text-slate-800 border-l border-slate-200 text-right sticky right-0 z-10">{cls.name}</td>
                                            {periods.map(p => {
                                                const impact = impactedSlots.find(s => s.lesson.classId === cls.id && s.period === p);
                                                const slotKey = `${cls.id}-${p}`;
                                                const currentSlotAssignments = assignments[slotKey] || [];
                                                const subTeacher = currentSlotAssignments.length > 0 ? employees.find(e => e.id === currentSlotAssignments[0].teacherId) : null;

                                                return (
                                                    <td key={p} className="p-2 border-l border-slate-100 relative h-28 align-top">
                                                        {impact ? (
                                                            <div className={`flex flex-col h-full gap-1 rounded-xl p-2 transition-all border-2 ${subTeacher ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                                                <span className="text-[10px] font-black text-slate-800 truncate">{impact.lesson.subject}</span>
                                                                <div className="flex items-center gap-1 text-[9px] text-rose-500 font-bold mb-2">
                                                                    <span className="opacity-60">بدل:</span>
                                                                    <span className="truncate">{impact.originalTeacher.name.split(' ')[0]}</span>
                                                                </div>
                                                                {subTeacher ? (
                                                                    <div className="mt-auto bg-white p-1.5 rounded-lg border border-emerald-100 flex justify-between items-center shadow-sm">
                                                                        <span className="text-[9px] font-black text-emerald-600 truncate">{subTeacher.name.split(' ').slice(0,2).join(' ')}</span>
                                                                        <button onClick={() => onRemove(cls.id, p, subTeacher.id)} className="text-rose-400 hover:text-rose-600"><X size={12}/></button>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => setActiveSlot({ classId: cls.id, period: p })} className="mt-auto w-full py-1.5 bg-white hover:bg-rose-100 text-rose-600 rounded-lg font-black text-[9px] border border-rose-200 transition-all flex items-center justify-center gap-1 shadow-sm"><UserPlus size={12}/> بديل</button>
                                                                )}
                                                            </div>
                                                        ) : <div className="w-full h-full bg-slate-50/30 rounded-xl"></div>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <CheckCircle2 size={48} className="mb-4 text-emerald-500" />
                                <p className="font-bold text-lg">لا توجد حصص متأثرة (فجوات)</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Recommendation Modal */}
            {showTripRecommendations && (
                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-6 animate-scale-up max-h-[85vh] flex flex-col border border-white/20">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h5 className="font-black text-slate-800 text-lg flex items-center gap-2"><Bus size={20} className="text-emerald-500"/> المرشحون للمرافقة</h5>
                            <button onClick={() => setShowTripRecommendations(false)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-4">
                            {tripCandidates.length > 0 ? tripCandidates.map((cand, idx) => {
                                const isSelected = selectedCandidateIds.includes(cand.emp.id);
                                return (
                                    <div key={cand.emp.id} onClick={() => setSelectedCandidateIds(prev => prev.includes(cand.emp.id) ? prev.filter(x => x !== cand.emp.id) : [...prev, cand.emp.id])} className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'bg-emerald-50 border-emerald-500 shadow-md' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-600'}`}>{idx + 1}</div>
                                            <div><p className="font-black text-sm text-slate-800">{cand.emp.name}</p></div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-600">{cand.gradeCount} حصص</span>
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>{isSelected && <CheckSquare size={14} className="text-white"/>}</div>
                                        </div>
                                    </div>
                                );
                            }) : <div className="text-center py-8 text-slate-400 italic font-bold">لا يوجد مرشحين إضافيين</div>}
                        </div>
                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center bg-white sticky bottom-0">
                            <span className="text-xs font-bold text-slate-500">تم تحديد {selectedCandidateIds.length}</span>
                            <button onClick={handleConfirmSelectedCompanions} disabled={selectedCandidateIds.length === 0} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50">اعتماد</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Candidate Popup */}
            {activeSlot && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-6 animate-scale-up max-h-[85vh] flex flex-col border border-white/20">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h5 className="font-black text-slate-800 text-lg">{viewPhase === 'COVERAGE' ? 'سد الفجوة (تغطية)' : `اختيار ${meta.role}`}</h5>
                                <p className="text-xs text-slate-500 font-bold mt-1">حصة {activeSlot.period}</p>
                            </div>
                            <button onClick={() => setActiveSlot(null)} className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                            {(() => {
                                const { poolCandidates, educatorCandidates, supportCandidates } = getSlotCandidates(activeSlot.classId, activeSlot.period);
                                const availableSupport = supportCandidates.filter(c => !c.isAssigned);
                                
                                const releasedTeachers = availableSupport.filter(c => c.type === 'RELEASED_BY_TRIP' || c.type === 'RELEASED');
                                const individualTeachers = availableSupport.filter(c => c.type === 'INDIVIDUAL');
                                const stayTeachers = availableSupport.filter(c => c.type === 'STAY');
                                const freeTeachers = availableSupport.filter(c => c.type === 'FREE');

                                const renderBtn = (cand: any, styleClass: string) => (
                                    <button key={cand.emp.id} onClick={() => { onAssign(activeSlot.classId, activeSlot.period, cand.emp.id, 'assignment'); setActiveSlot(null); }} className={`w-full p-3 rounded-xl border transition-all flex justify-between items-center group shadow-sm ${styleClass}`}>
                                        <span className="font-bold text-xs">{cand.emp.name}</span>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded opacity-80 bg-white/50">{cand.label}</span>
                                    </button>
                                );

                                return (
                                    <>
                                        {releasedTeachers.length > 0 && (
                                            <div className="space-y-2 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                                                <h6 className="text-[10px] font-black text-emerald-700 uppercase flex items-center gap-2"><Unlock size={14}/> معلمون محررون</h6>
                                                <div className="grid gap-2">{releasedTeachers.map(c => renderBtn(c, 'bg-white border-emerald-200 text-emerald-900 hover:bg-emerald-100'))}</div>
                                            </div>
                                        )}
                                        {individualTeachers.length > 0 && (
                                            <div className="space-y-2 bg-blue-50 p-3 rounded-2xl border border-blue-100">
                                                <h6 className="text-[10px] font-black text-blue-700 uppercase flex items-center gap-2"><Users size={14}/> حصص فردي</h6>
                                                <div className="grid gap-2">{individualTeachers.map(c => renderBtn(c, 'bg-white border-blue-200 text-blue-900 hover:bg-blue-100'))}</div>
                                            </div>
                                        )}
                                        {stayTeachers.length > 0 && (
                                            <div className="space-y-2 bg-amber-50 p-3 rounded-2xl border border-amber-100">
                                                <h6 className="text-[10px] font-black text-amber-700 uppercase flex items-center gap-2"><Coffee size={14}/> مكوث</h6>
                                                <div className="grid gap-2">{stayTeachers.map(c => renderBtn(c, 'bg-white border-amber-200 text-amber-900 hover:bg-amber-100'))}</div>
                                            </div>
                                        )}
                                        {freeTeachers.length > 0 && (
                                            <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                <h6 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Clock size={14}/> فراغ (نافذة)</h6>
                                                <div className="grid gap-2">{freeTeachers.map(c => renderBtn(c, 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'))}</div>
                                            </div>
                                        )}
                                        {poolCandidates.length > 0 && (
                                            <div className="space-y-2">
                                                <h6 className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2"><Briefcase size={14}/> بنك الاحتياط</h6>
                                                <div className="grid gap-2">{poolCandidates.map(c => renderBtn(c, 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'))}</div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN WRAPPER: CALENDAR REQUEST FORM ---
interface CalendarRequestFormProps {
  employees: Employee[];
  classes: ClassItem[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onClose: () => void;
  prefill?: any;
  currentUser?: Employee | null;
  lessons: Lesson[];
  setSubstitutionLogs?: React.Dispatch<React.SetStateAction<SubstitutionLog[]>>; 
  substitutionLogs?: SubstitutionLog[]; 
}

const CalendarRequestForm: React.FC<CalendarRequestFormProps> = ({ 
  employees, classes, setEvents, onClose, prefill, currentUser, lessons, setSubstitutionLogs 
}) => {
  const { addToast } = useToast();
  
  const [formData, setFormData] = useState({
    title: prefill?.title || '',
    date: prefill?.date || new Date().toISOString().split('T')[0],
    type: prefill?.type || 'ACTIVITY',
    description: prefill?.description || '',
    targetClassIds: prefill?.targetClassIds || [],
    targetPeriods: prefill?.targetPeriods || [],
    targetBreaks: [],
    partners: [],
    opAction: 'none',
    mergeStrategy: 'advance_second'
  });

  const [enableSmartMode, setEnableSmartMode] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, { teacherId: number, reason: string }[]>>({});

  const handleAssign = (classId: string, period: number, teacherId: number, reason: string) => {
      const isLocked = Object.entries(assignments).some(([k, v]) => {
          const { classId: c, period: p } = parseKey(k);
          return p === period && c !== classId && (v as { teacherId: number, reason: string }[]).some(t => t.teacherId === teacherId);
      });

      if (isLocked) {
           addToast("هذا المعلم معين بالفعل في حصة أخرى في نفس التوقيت", "error");
           return;
      }

      const key = `${classId}-${period}`;
      setAssignments(prev => {
          const current = prev[key] || [];
          if (current.some(a => a.teacherId === teacherId)) return prev;
          return { ...prev, [key]: [...current, { teacherId, reason }] };
      });
  };

  const handleRemove = (classId: string, period: number, teacherId: number) => {
      const key = `${classId}-${period}`;
      setAssignments(prev => {
          const current = prev[key] || [];
          return { ...prev, [key]: current.filter(a => a.teacherId !== teacherId) };
      });
  };

  const handleBulkAssign = (newAssignments: { classId: string, period: number, teacherId: number, reason: string }[]) => {
      setAssignments(prev => {
          const next = { ...prev };
          newAssignments.forEach(a => {
              const key = `${a.classId}-${a.period}`;
              const current = next[key] || [];
              if (!current.some(existing => existing.teacherId === a.teacherId)) {
                  next[key] = [...current, { teacherId: a.teacherId, reason: a.reason }];
              }
          });
          return next;
      });
      addToast(`تم توزيع ${newAssignments.length} مهمة تلقائياً`, "success");
  };

  const handleSave = () => {
      if (!formData.title || !formData.date) {
          addToast("يرجى ملء البيانات الأساسية", "error");
          return;
      }

      const newEvent: CalendarEvent = {
          id: `EVT-${Date.now()}`,
          title: formData.title,
          description: formData.description,
          date: formData.date,
          eventType: formData.type as any,
          status: 'CONFIRMED',
          plannerId: currentUser?.id || 0,
          plannerName: currentUser?.name || 'Admin',
          patternId: 'DYNAMIC',
          appliesTo: {
              grades: [],
              classes: formData.targetClassIds,
              periods: formData.targetPeriods
          },
          participants: formData.partners.flatMap((p: { id: string; userIds: string[]; expectations: string }) => p.userIds.map(uid => ({ userId: Number(uid), role: 'PARTNER', expectations: p.expectations }))),
      };

      setEvents(prev => [...prev, newEvent]);

      if (setSubstitutionLogs) {
          const newLogs: SubstitutionLog[] = [];
          Object.entries(assignments).forEach(([key, valArray]) => {
              const { classId, period } = parseKey(key);
              (valArray as { teacherId: number, reason: string }[]).forEach(assignment => {
                  const sub = employees.find(e => e.id === assignment.teacherId);
                  if (sub) {
                      newLogs.push({
                          id: `LOG-${Date.now()}-${Math.random()}`,
                          date: formData.date,
                          period: period,
                          classId: classId,
                          absentTeacherId: 0, 
                          substituteTeacherId: sub.id,
                          substituteName: sub.name,
                          type: sub.constraints.isExternal ? 'assign_external' : 'assign_distribution',
                          reason: assignment.reason || `Event: ${formData.title}`,
                          modeContext: formData.type,
                          timestamp: Date.now()
                      });
                  }
              });
          });
          
          if (newLogs.length > 0) {
              setSubstitutionLogs(prev => [...prev, ...newLogs]);
              addToast(`تم تسجيل ${newLogs.length} تكليفاً بنجاح`, "success");
          }
      }

      addToast("تم حفظ الفعالية بنجاح");
      onClose();
  };

  // Filter classes based on selection (for Phase 1 - Trip)
  const selectedClasses = useMemo(() => {
      return classes.filter(c => formData.targetClassIds.includes(c.id));
  }, [classes, formData.targetClassIds]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
        <UnifiedEventForm
            data={formData}
            setData={setFormData}
            employees={employees}
            classes={classes}
            onCancel={onClose}
            onSave={handleSave}
            enableSmartMode={enableSmartMode}
            setEnableSmartMode={setEnableSmartMode}
        >
            {/* INJECT MANUAL DISTRIBUTION GRID */}
            {formData.targetClassIds.length > 0 && formData.targetPeriods.length > 0 ? (
                <div className="mt-8 border-t border-slate-200 pt-8 animate-slide-down">
                    <ManualDistributionGrid
                        classes={selectedClasses} // Phase 1: Only selected classes
                        allClasses={classes}      // Phase 2: Needs ALL classes to show non-trip impacts
                        periods={formData.targetPeriods}
                        lessons={lessons}
                        employees={employees}
                        date={formData.date}
                        assignments={assignments}
                        onAssign={handleAssign}
                        onRemove={handleRemove}
                        onBulkAssign={handleBulkAssign}
                        modeType={formData.type}
                        poolIds={prefill?.poolIds || []}
                        externalPartners={formData.partners} // Pass form partners to grid
                    />
                </div>
            ) : (
                <div className="mt-8 p-10 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center gap-3">
                    <div className="p-4 bg-white rounded-full shadow-sm text-slate-300"><LayoutGrid size={32}/></div>
                    <h4 className="text-sm font-black text-slate-400">بانتظار تحديد النطاق</h4>
                    <p className="text-xs font-bold text-slate-300">يرجى اختيار الصفوف والحصص المستهدفة أعلاه لإظهار جدول التوزيع والمرافقين.</p>
                </div>
            )}
        </UnifiedEventForm>
    </div>
  );
};

export default CalendarRequestForm;
