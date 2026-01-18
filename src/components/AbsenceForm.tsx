
import React, { useState } from 'react';
import {
    UserX, Search, CheckCircle2, AlertTriangle, X, List, Globe, ShieldCheck,
    Users, Calendar, Clock, UserCheck, ChevronDown, Filter, Coffee,
    ArrowLeftRight, CalendarRange, Trash2, Check, UserPlus, Zap, Siren,
    Activity, Shield, Briefcase, LayoutList, ChevronLeft, ChevronRight,
    UserMinus, BarChart4, TrendingUp, CalendarDays, ArrowRight, Table,
    FileText, ClipboardCheck, ArrowLeft, Split, Layers, Briefcase as CaseIcon,
    MousePointerClick, BriefcaseBusiness, Ban, LogOut, LogIn, ChevronUp, User, Edit3,
    Stethoscope, Thermometer, Clock3, AlertOctagon, RotateCcw, ToggleLeft, ToggleRight,
    CalendarClock, Copy, Lock, Home, Play, PlayCircle, CheckSquare, Sun, Moon, BrainCircuit,
    Timer, CalendarPlus, Info, BookOpen
} from 'lucide-react';
import { Employee, AbsenceRecord, ScheduleConfig, Lesson, ClassItem, SubstitutionLog, EngineContext, ModeConfig, CalendarEvent } from '@/types';
import { normalizeArabic } from '@/utils';
import { useAbsenceForm, SelectedTeacherState } from './absence/hooks/useAbsenceForm';
import { inferPartialAbsence, getDatesInRange, getSafeDayName } from './absence/utils/absenceHelpers';
import { 
    createAbsenceRecords, 
    createAssistantCoverageSubstitutions, 
    createClassMergeSubstitutions, 
    autoAssignClassroomAssistants 
} from './absence/utils/submitHelpers';
import { useToast } from '@/contexts/ToastContext';
import GroupAbsenceBoard from './GroupAbsenceBoard';
import { Step1SelectTeachers } from './absence/steps/Step1SelectTeachers';
import { Step2AbsenceDetails } from './absence/steps/Step2AbsenceDetails';
import { Step3PoolManagement } from './absence/steps/Step3PoolManagement';
import { Step4ModesEvents } from './absence/steps/Step4ModesEvents';
import { Step5ScheduleGaps } from './absence/steps/Step5ScheduleGaps';
import { Step6Distribution } from './absence/steps/Step6Distribution';
import { Step7FinalReview } from './absence/steps/Step7FinalReview';

interface AbsenceFormProps {
    employees: Employee[];
    classes: ClassItem[];
    lessons: Lesson[];
    scheduleConfig: ScheduleConfig;
    date: string;
    dayOfWeek: string;
    onSave: (absences: Omit<AbsenceRecord, 'id'>[], substitutions: Omit<SubstitutionLog, 'id' | 'timestamp'>[]) => void;
    onCancel: () => void;
    engineContext: EngineContext;
    initialData?: AbsenceRecord;
    onDelete?: () => void;
    existingAbsences?: AbsenceRecord[];
    substitutionLogs?: SubstitutionLog[];
    onToggleMode?: (modeId: string) => void;
    events?: CalendarEvent[];
    preSelectedPool?: number[]; // NEW PROP
    onPoolUpdate?: (poolIds: number[]) => void; // Callback to update parent pool
    onOpenRequestForm: (prefill: any) => void; // For adding modes/events
    initialStep?: 1 | 2 | 3 | 4 | 5 | 6 | 7; // NEW: Start at specific step (default: 1)
    singleStageMode?: boolean; // NEW: Independent stage mode (no navigation, save & exit)
    onStageSave?: (stage: number, data: any) => void; // Callback for single stage save
    onAddSubstitution?: (sub: Omit<SubstitutionLog, 'id' | 'timestamp'>) => void;
    onRemoveSubstitution?: (absentTeacherId: number, period: number, date: string) => void;
}



const AbsenceForm: React.FC<AbsenceFormProps> = ({
    employees, classes, lessons, scheduleConfig, date: initialDate, dayOfWeek,
    onSave, onCancel, engineContext, initialData, onDelete, existingAbsences = [], substitutionLogs = [], onToggleMode, events = [],
    preSelectedPool = [], // Use passed pool if available
    onPoolUpdate, // Callback to sync pool with parent
    onOpenRequestForm,
    initialStep = 1, // NEW: Default to step 1 if not provided
    singleStageMode = false, // NEW: Independent stage mode
    onStageSave, // Callback for single stage save
    onAddSubstitution,
    onRemoveSubstitution
}) => {
    const { addToast } = useToast();

    const {
        step, setStep,
        selectedTeachers, setSelectedTeachers,
        globalStartDate, setGlobalStartDate,
        globalEndDate, setGlobalEndDate,
        searchTerm, setSearchTerm,
        activeExternalIds, setActiveExternalIds,
        selectedModeIds, setSelectedModeIds,
        detectedGaps, setDetectedGaps,
        gapSolutions, setGapSolutions,
        substitutions, setSubstitutions,
        assistantCoverage, setAssistantCoverage,
        classMerges, setClassMerges,
        isAutoAssigning, setIsAutoAssigning,
        boardViewDate, setBoardViewDate,
        filteredEmployees,
        isWizardOpen, setIsWizardOpen,
        wizardStep, setWizardStep,
        assignments, setAssignments,
        assignmentVersion, setAssignmentVersion,
        selectedList, availableList,
        preAbsentIds, preAbsentTeachers,
        affectedLessons, boardViewLessons,
        availableExternals,
        availableInternalCandidates, externalSubstitutesFromActiveIds,
        derivedEngineContext, activeEvents,
        isHolidayCheck, periods,
        handleTeacherToggle, updateTeacherConfig,
        applyGlobalDatesToAll, handleApplyToAllDetails,
        handleBatchAutoAssign, handleBoardAssign,
        handleBoardBulkAssign, handleToggleAssistantCoverage,
        handleToggleClassMerge, handleBoardUnassign, handleAssignSubstitute,
        activeReservePool,
        toggleWizardSelection, handleWizardNext,
        goToNextStep, goToPrevStep, goToStep
    } = useAbsenceForm({
        initialDate,
        initialStep: initialStep as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        preSelectedPool,
        employees,
        lessons,
        classes,
        scheduleConfig,
        initialData,
        existingAbsences,
        substitutionLogs,
        singleStageMode,
        engineContext,
        events,
        addToast,
        onAddSubstitution,
        onRemoveSubstitution
    });




    const handleSubmit = () => {
        if (selectedTeachers.length === 0) {
            addToast('يجب تحديد معلم واحد على الأقل', 'error');
            return;
        }
        
        // 1. Create absence records
        const absencesList = createAbsenceRecords(selectedTeachers, scheduleConfig);
        
        // 2. Start with existing substitutions
        const allSubstitutions = [...substitutions];
        
        // 3. Add assistant coverage
        const assistantSubs = createAssistantCoverageSubstitutions(
            assistantCoverage,
            boardViewDate,
            lessons
        );
        allSubstitutions.push(...assistantSubs);
        
        // 4. Add class merges
        const mergeSubs = createClassMergeSubstitutions(
            classMerges,
            boardViewDate,
            lessons
        );
        allSubstitutions.push(...mergeSubs);
        
        // 5. Auto-assign classroom assistants
        const autoAssistantSubs = autoAssignClassroomAssistants(
            selectedTeachers,
            employees,
            classes,
            lessons,
            scheduleConfig,
            boardViewDate,
            allSubstitutions,
            assistantCoverage,
            classMerges,
            addToast
        );
        allSubstitutions.push(...autoAssistantSubs);
        
        // 6. Save
        onSave(absencesList, allSubstitutions);
    };


    return (
        <div className="bg-white w-full max-w-7xl rounded-[3rem] shadow-2xl flex flex-col h-[90vh] relative" dir="rtl">
            {/* HOLIDAY WARNING */}
            {isHolidayCheck && (
                <div className="bg-rose-50 border-b border-rose-100 p-3 flex items-center justify-center gap-3 animate-slide-down">
                    <div className="p-1.5 bg-white rounded-full shadow-sm"><Coffee size={14} className="text-rose-500" /></div>
                    <p className="text-xs font-black text-rose-700">
                        تنبيه: يوم {new Date(globalStartDate).toLocaleDateString('ar-EG')} هو عطلة رسمية ({scheduleConfig.holidays?.find(h => normalizeArabic(h) === normalizeArabic(getSafeDayName(globalStartDate))) || 'عطلة'}).
                        <span className="font-normal opacity-80 mr-1">يرجى التأكد من ضرورة التوثيق في هذا اليوم.</span>
                    </p>
                </div>
            )}
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div>
                    {singleStageMode ? (
                        /* Single Stage Mode Header - Stage-specific title */
                        <>
                            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                {step === 1 && <><Users className="text-indigo-600" /> 1️⃣ تحديد الغائبين</>}
                                {step === 2 && <><Calendar className="text-purple-600" /> 2️⃣ فترة الغياب</>}
                                {step === 3 && <><Shield className="text-blue-600" /> 3️⃣ بنك الاحتياط</>}
                                {step === 6 && <><Zap className="text-green-600" /> 6️⃣ التوزيع الآلي</>}
                            </h3>
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                                <Info size={12} />
                                بطاقة مستقلة • احفظ واخرج
                            </p>
                        </>
                    ) : (
                        /* Normal Workflow Mode Header */
                        <>
                            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                {initialData ? <Edit3 className="text-indigo-600" /> : <UserMinus className="text-rose-600" />}
                                {initialData ? 'تعديل سجل الغياب' : 'بروتوكول توثيق الغياب'}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`h-2 w-2 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-1 w-6 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-1 w-6 rounded-full ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-2 w-2 rounded-full ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-1 w-6 rounded-full ${step >= 4 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-2 w-2 rounded-full ${step >= 4 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-1 w-6 rounded-full ${step >= 5 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-2 w-2 rounded-full ${step >= 5 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-1 w-6 rounded-full ${step >= 6 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-2 w-2 rounded-full ${step >= 6 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-1 w-6 rounded-full ${step >= 7 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className={`h-2 w-2 rounded-full ${step >= 7 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                                <span className="text-xs font-bold text-slate-400 mr-2">
                                    {step === 1 ? 'تحديد النطاق' :
                                        step === 2 ? 'تفاصيل الغياب' :
                                            step === 3 ? 'بنك الاحتياط' :
                                                step === 4 ? 'الأنماط' :
                                                    step === 5 ? 'سد الفجوات' :
                                                        step === 6 ? 'البدلاء' : 'المراجعة'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
                <button onClick={onCancel} className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-2xl transition-all shadow-sm"><X size={24} /></button>
            </div>

            <div className="flex-1 custom-scrollbar" style={{ overflow: step === 6 ? 'hidden' : 'auto', padding: step === 6 ? 0 : '2rem' }}>
                {step === 1 && (
                    <Step1SelectTeachers
                        selectedList={selectedList}
                        availableList={availableList}
                        preAbsentIds={preAbsentIds}
                        globalStartDate={globalStartDate}
                        globalEndDate={globalEndDate}
                        onApplyGlobalDates={applyGlobalDatesToAll}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onToggleTeacher={handleTeacherToggle}
                        onNext={goToNextStep}
                    />
                )}

                {step === 2 && (
                    <Step2AbsenceDetails
                        selectedTeachers={selectedTeachers}
                        employees={employees}
                        periods={periods}
                        scheduleConfig={scheduleConfig}
                        onTeacherToggle={handleTeacherToggle}
                        onUpdateTeacherConfig={updateTeacherConfig}
                        onApplyToAll={handleApplyToAllDetails}
                        preAbsentTeachers={preAbsentTeachers}
                        onPrev={goToPrevStep}
                        onNext={goToNextStep}
                    />
                )}

                {step === 3 && (
                    <Step3PoolManagement
                        activeExternalIds={activeExternalIds}
                        setActiveExternalIds={setActiveExternalIds}
                        employees={employees}
                        availableExternals={availableExternals}
                        availableInternalCandidates={availableInternalCandidates}
                        selectedTeachers={selectedTeachers}
                        boardViewDate={boardViewDate}
                        lessons={lessons}
                        onPoolUpdate={onPoolUpdate}
                        onAddToast={addToast}
                        onPrev={goToPrevStep}
                        onNext={goToNextStep}
                    />
                )}

                {step === 4 && (
                    <Step4ModesEvents
                        activeEvents={activeEvents}
                        globalStartDate={globalStartDate}
                        activeExternalIds={activeExternalIds}
                        onOpenRequestForm={onOpenRequestForm}
                        setStep={setStep}
                        onPrev={goToPrevStep}
                        onNext={goToNextStep}
                    />
                )}

                {step === 5 && (
                    <Step5ScheduleGaps
                        selectedTeachers={selectedTeachers}
                        activeEvents={activeEvents}
                        substitutions={substitutions}
                        globalStartDate={globalStartDate}
                        employees={employees}
                        lessons={lessons}
                        classes={classes}
                        periods={periods}
                        onPrev={goToPrevStep}
                        onNext={goToNextStep}
                    />
                )}

                {step === 7 && (
                    <Step7FinalReview
                        selectedTeachers={selectedTeachers}
                        globalStartDate={globalStartDate}
                        globalEndDate={globalEndDate}
                        activeExternalIds={activeExternalIds}
                        activeEvents={activeEvents}
                        substitutions={substitutions}
                        employees={employees}
                        onPrev={goToPrevStep}
                        onSubmit={handleSubmit}
                        initialData={initialData}
                    />
                )}

                {step === 6 && (
                    <Step6Distribution
                        isAutoAssigning={isAutoAssigning}
                        onBatchAutoAssign={handleBatchAutoAssign}
                        onOpenWizard={() => setIsWizardOpen(true)}
                        activeReservePool={activeReservePool}
                        boardViewDate={boardViewDate}
                        onSetBoardViewDate={setBoardViewDate}
                        globalStartDate={globalStartDate}
                        globalEndDate={globalEndDate}
                        selectedTeachers={selectedTeachers}
                        employees={employees}
                        assignments={assignments}
                        onBoardAssign={handleBoardAssign}
                        onBoardUnassign={handleBoardUnassign}
                        onBoardBulkAssign={handleBoardBulkAssign}
                        activeExternalIds={activeExternalIds}
                        boardViewLessons={boardViewLessons}
                        classes={classes}
                        lessons={lessons}
                        scheduleConfig={scheduleConfig}
                        events={events}
                        engineContext={engineContext}
                        onAssignSubstitute={handleAssignSubstitute}
                        assistantCoverage={assistantCoverage}
                        classMerges={classMerges}
                        onToggleAssistantCoverage={handleToggleAssistantCoverage}
                        onToggleClassMerge={handleToggleClassMerge}
                        assignmentVersion={assignmentVersion}
                        onPrev={goToPrevStep}
                        onNext={goToNextStep}
                    />
                )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                {singleStageMode ? (
                    /* Single Stage Mode Footer - Save & Exit only */
                    <>
                        <button
                            onClick={onCancel}
                            className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-100 transition-all flex items-center gap-2"
                        >
                            <X size={14} /> إلغاء
                        </button>
                        <button
                            onClick={() => {
                                // Stage-specific save logic
                                const stageData: any = {};

                                if (step === 1) {
                                    // Stage 1: Save selected teachers
                                    if (selectedTeachers.length === 0) {
                                        addToast('يجب تحديد معلم واحد على الأقل', 'error');
                                        return;
                                    }
                                    stageData.selectedTeachers = selectedTeachers;
                                    stageData.globalStartDate = globalStartDate;
                                    stageData.globalEndDate = globalEndDate;
                                    addToast(`✅ تم حفظ ${selectedTeachers.length} معلم غائب`, 'success');
                                } else if (step === 2) {
                                    // Stage 2: Save absence details
                                    stageData.selectedTeachers = selectedTeachers;
                                    stageData.globalStartDate = globalStartDate;
                                    stageData.globalEndDate = globalEndDate;
                                    addToast('✅ تم حفظ تفاصيل الغياب', 'success');
                                } else if (step === 3) {
                                    // Stage 3: Save pool
                                    stageData.activeExternalIds = activeExternalIds;
                                    
                                    // Actually persist the pool using the onPoolUpdate callback
                                    if (onPoolUpdate) {
                                        onPoolUpdate(activeExternalIds);
                                    }
                                    
                                    addToast(`✅ تم حفظ بنك الاحتياط (${activeExternalIds.length} معلم)`, 'success');
                                } else if (step === 6) {
                                    // Stage 6: Save substitutions
                                    stageData.substitutions = substitutions;
                                    
                                    // Actually persist substitutions using the onAddSubstitution callback
                                    if (onAddSubstitution) {
                                        substitutions.forEach(sub => {
                                            onAddSubstitution(sub);
                                        });
                                    }
                                    
                                    addToast(`✅ تم حفظ التوزيع (${substitutions.length} تعيين)`, 'success');
                                }

                                if (onStageSave) {
                                    onStageSave(step, stageData);
                                }
                                onCancel();
                            }}
                            className="px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs shadow-lg hover:bg-emerald-500 transition-all flex items-center gap-2"
                        >
                            <CheckCircle2 size={14} /> حفظ البطاقة {step === 1 ? '١' : step === 2 ? '٢' : step === 3 ? '٣' : '٦'}
                        </button>
                    </>
                ) : (
                    /* Normal Workflow Mode Footer */
                    <>
                        {step > 1 ? (
                            <button onClick={() => setStep(prev => prev - 1 as any)} className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-100 transition-all">السابق</button>
                        ) : (
                            initialData && onDelete ? (
                                <button onClick={onDelete} className="px-6 py-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 font-bold text-xs hover:bg-rose-100 transition-all flex items-center gap-2"><Trash2 size={14} /> حذف السجل</button>
                            ) : <div></div>
                        )}

                        {step < 7 ? (
                            <div className="flex items-center gap-3">
                                {step > 1 && (
                                    <button
                                        onClick={() => setStep(prev => (prev - 1) as any)}
                                        className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-2"
                                    >
                                        <ChevronRight size={14} /> رجوع
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        // Validation for each step
                                        if (step === 1 && selectedTeachers.length === 0) {
                                            addToast('يجب تحديد معلم واحد على الأقل', 'error');
                                            return;
                                        }
                                        setStep(prev => (prev + 1) as any);
                                    }}
                                    disabled={step === 1 && selectedTeachers.length === 0}
                                    className="px-8 py-3 rounded-2xl bg-indigo-600 text-white font-black text-xs shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    التالي <ChevronLeft size={14} />
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleSubmit} className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl hover:bg-emerald-500 transition-all flex items-center gap-3 glow-primary">
                                <CheckCircle2 size={18} /> {initialData ? 'حفظ التعديلات' : 'اعتماد التوثيق'}
                            </button>
                        )}
                    </>
                )}
            </div>

            {isWizardOpen && (
                <div className="absolute inset-0 z-[100] bg-slate-900/10 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-white/40 flex flex-col overflow-hidden animate-scale-up">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h4 className="font-black text-slate-800 flex items-center gap-2"><BriefcaseBusiness size={18} className="text-indigo-600" /> تجهيز بنك البدلاء (Pool)</h4>
                            <button onClick={() => setIsWizardOpen(false)} className="p-2 bg-white rounded-xl shadow-sm text-slate-400 hover:text-rose-500"><X size={16} /></button>
                        </div>

                        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                            {wizardStep === 1 && (
                                <div className="space-y-6">
                                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                        حدد قائمة البدلاء الخارجيين الذين تم استدعاؤهم أو المتاحين اليوم. سيتم منحهم الأولوية القصوى في التوزيع الآلي وإظهارهم في لوحة التحكم.
                                    </p>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {availableExternals.length > 0 ? availableExternals.map(ext => {
                                            const isActive = activeExternalIds.includes(ext.id);
                                            return (
                                                <div
                                                    key={ext.id}
                                                    onClick={() => toggleWizardSelection(ext.id)}
                                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isActive ? 'bg-amber-50 border-amber-400 shadow-md' : 'bg-white border-slate-100 hover:border-amber-200'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isActive ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600'}`}>{ext.name.charAt(0)}</div>
                                                        <div>
                                                            <p className={`text-xs font-black ${isActive ? 'text-amber-900' : 'text-slate-700'}`}>{ext.name}</p>
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                <span className="text-[8px] font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded-md">بديل خارجي</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isActive && <CheckCircle2 size={18} className="text-amber-500" />}
                                                </div>
                                            );
                                        }) : (
                                            <div className="text-center py-8 text-slate-400 italic text-xs">لا يوجد معلمون خارجيون معرفون في النظام</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className="space-y-6">
                                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                        اكتشاف المعلمين الداخليين الذين لديهم فراغ كلي أو جزئي اليوم ويمكن إضافتهم لقائمة "الاحتياط النشط".
                                    </p>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {availableInternalCandidates.map(cand => {
                                            const isActive = activeExternalIds.includes(cand.emp.id);
                                            const isFull = cand.status === 'FULL';

                                            // Color logic: Emerald for FULL, Indigo for PARTIAL
                                            const baseColor = isFull ? 'emerald' : 'indigo';
                                            const activeBg = isFull ? 'bg-emerald-50 border-emerald-400' : 'bg-indigo-50 border-indigo-400';
                                            const activeText = isFull ? 'text-emerald-900' : 'text-indigo-900';
                                            const iconColor = isFull ? 'text-emerald-600' : 'text-indigo-600';
                                            const badgeBg = isFull ? 'bg-emerald-500' : 'bg-indigo-500';

                                            return (
                                                <div
                                                    key={cand.emp.id}
                                                    onClick={() => toggleWizardSelection(cand.emp.id)}
                                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isActive ? `${activeBg} shadow-md` : `bg-white border-slate-100 hover:border-${baseColor}-200`}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isActive ? `${badgeBg} text-white` : 'bg-slate-100 text-slate-400'}`}>{cand.emp.name.charAt(0)}</div>
                                                        <div>
                                                            <p className={`text-xs font-black ${isActive ? activeText : 'text-slate-700'}`}>{cand.emp.name}</p>
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                {isFull ? <CheckCircle2 size={10} className={isActive ? 'text-emerald-600' : 'text-emerald-500'} /> : <Timer size={10} className={isActive ? 'text-indigo-600' : 'text-indigo-500'} />}
                                                                <span className={`text-[8px] font-bold ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>{cand.label} • {cand.subLabel}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isActive && <CheckCircle2 size={18} className={iconColor} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                            {wizardStep > 1 && <button onClick={() => setWizardStep(prev => prev - 1 as any)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">رجوع</button>}
                            <div className="flex gap-2 ml-auto">
                                <button onClick={() => setIsWizardOpen(false)} className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-100">إلغاء</button>
                                <button onClick={handleWizardNext} className="px-8 py-3 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-indigo-600 shadow-lg transition-all">{wizardStep < 2 ? 'التالي: الداخلي المتاح' : 'إنهاء واعتماد'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AbsenceForm;