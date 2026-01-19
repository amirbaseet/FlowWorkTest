// src/components/absence/steps/Step6Distribution.tsx

import React from 'react';
import { Zap, Activity, BrainCircuit, BriefcaseBusiness, Info, ChevronDown, CheckCircle2, User, Layers, Coffee, Ban, ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { Employee, ClassItem, Lesson, ScheduleConfig, CalendarEvent, EngineContext } from '@/types';
import { getSafeDayName } from '@/utils';
import GroupAbsenceBoard from '../../GroupAbsenceBoard';

interface Step6DistributionProps {
    isAutoAssigning: boolean;
    onBatchAutoAssign: () => void;
    onOpenWizard: () => void;
    activeReservePool: Employee[];
    boardViewDate: string;
    onSetBoardViewDate: (date: string) => void;
    globalStartDate: string;
    globalEndDate: string;
    selectedTeachers: any[];
    employees: Employee[];
    assignments: Record<string, number>;
    onBoardAssign: (slotKey: string, substituteId: number | null) => void;
    onBoardUnassign: (slotKey: string) => void;
    onBoardBulkAssign: (slotKey: string, substituteId: number) => void;
    activeExternalIds: number[];
    boardViewLessons: any[];
    classes: ClassItem[];
    lessons: Lesson[];
    scheduleConfig: ScheduleConfig;
    events: CalendarEvent[];
    engineContext: EngineContext;
    onAssignSubstitute: (absentId: number, period: number, date: string, substitute: any) => void;
    assistantCoverage: Record<string, boolean>;
    classMerges: Record<string, any>;
    onToggleAssistantCoverage: (slotKey: string) => void;
    onToggleClassMerge: (slotKey: string) => void;
    assignmentVersion: number;
    onSave: () => void;
    onPrev: () => void;
    onNext: () => void;
}

export const Step6Distribution: React.FC<Step6DistributionProps> = ({
    isAutoAssigning,
    onBatchAutoAssign,
    onOpenWizard,
    activeReservePool,
    boardViewDate,
    onSetBoardViewDate,
    globalStartDate,
    globalEndDate,
    selectedTeachers,
    employees,
    assignments,
    onBoardAssign,
    onBoardUnassign,
    onBoardBulkAssign,
    activeExternalIds,
    boardViewLessons,
    classes,
    lessons,
    scheduleConfig,
    events,
    engineContext,
    onAssignSubstitute,
    assistantCoverage,
    classMerges,
    onToggleAssistantCoverage,
    onToggleClassMerge,
    assignmentVersion,
    onSave,
    onPrev,
    onNext
}) => {
    return (
        <div className="h-full flex flex-col animate-fade-in relative p-8">
            <div className="bg-white border-b border-slate-100 pb-2 mb-2 flex justify-between items-center shrink-0">
                <div className="flex gap-2 items-center">
                    <button onClick={onOpenWizard} className="px-3 py-1.5 rounded-lg text-[9px] font-black bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center gap-1.5">
                        <Zap size={12} /> تخصيص البدلاء
                    </button>
                    <button onClick={onBatchAutoAssign} className="px-3 py-1.5 rounded-lg text-[9px] font-black bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all flex items-center gap-1.5 border border-emerald-100">
                        {isAutoAssigning ? <Activity size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
                        توزيع ذكي
                    </button>
                </div>
            </div>

            {/* ACTIVE POOL BAR (Compact) */}
            {activeReservePool.length > 0 && (
                <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 mb-2 flex items-center gap-2 animate-slide-down shrink-0">
                    <div className="flex items-center gap-1.5 text-indigo-700 shrink-0">
                        <BriefcaseBusiness size={14} />
                        <span className="text-[10px] font-black">بنك البدلاء:</span>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                        {activeReservePool.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-indigo-100 shadow-sm">
                                <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-black">{p.name.charAt(0)}</div>
                                <span className="text-[9px] font-bold text-slate-700 whitespace-nowrap">{p.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VISUAL STATUS LEGEND */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-2 rounded-xl border border-slate-200 mb-3 shrink-0">
                <details className="group">
                    <summary className="text-[10px] font-black text-slate-700 flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                        <Info size={12} /> دليل التمييز البصري
                        <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mt-2">
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-emerald-200">
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                            </div>
                            <p className="text-[9px] font-black text-emerald-700">متاح - فراغ</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-blue-200">
                            <div className="w-6 h-6 rounded-lg bg-blue-100 border-2 border-blue-300 flex items-center justify-center">
                                <User size={12} className="text-blue-600" />
                            </div>
                            <p className="text-[9px] font-black text-blue-700">مغطى بالمساعد</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-purple-200">
                            <div className="w-6 h-6 rounded-lg bg-purple-100 border-2 border-purple-300 flex items-center justify-center">
                                <Layers size={12} className="text-purple-600" />
                            </div>
                            <p className="text-[9px] font-black text-purple-700">دمج الشعب</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-purple-200">
                            <div className="w-6 h-6 rounded-lg bg-purple-100 border-2 border-purple-300 flex items-center justify-center">
                                <User size={12} className="text-purple-600" />
                            </div>
                            <p className="text-[9px] font-black text-purple-700">حصة فردية</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-orange-200">
                            <div className="w-6 h-6 rounded-lg bg-orange-100 border-2 border-orange-300 flex items-center justify-center">
                                <Coffee size={12} className="text-orange-600" />
                            </div>
                            <p className="text-[9px] font-black text-orange-700">حصة مكوث</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-red-200">
                            <div className="w-6 h-6 rounded-lg bg-red-100 border-2 border-red-300 flex items-center justify-center">
                                <Ban size={12} className="text-red-600" />
                            </div>
                            <p className="text-[9px] font-black text-red-700">مشغول/تعارض</p>
                        </div>
                    </div>
                </details>
            </div>

            {/* MAIN BOARD */}
            <div className="flex-1 overflow-hidden relative min-h-0">
                <GroupAbsenceBoard
                    key={`board-${assignmentVersion}-${boardViewDate}`}
                    selectedTeacherIds={selectedTeachers.map(t => t.id)}
                    employees={employees}
                    assignments={assignments}
                    onAssign={onBoardAssign}
                    onUnassign={onBoardUnassign}
                    onBulkAssign={onBoardBulkAssign}
                    activeExternalIds={activeExternalIds}
                    uncoveredLessons={boardViewLessons}
                    classes={classes}
                    lessons={lessons}
                    scheduleConfig={scheduleConfig}
                    dayName={getSafeDayName(boardViewDate)}
                    events={events}
                    date={boardViewDate}
                    engineContext={engineContext}
                    onAssignSubstitute={onAssignSubstitute}
                    assistantCoverage={assistantCoverage}
                    classMerges={classMerges}
                    onToggleAssistantCoverage={onToggleAssistantCoverage}
                    onToggleClassMerge={onToggleClassMerge}
                />
            </div>

            {/* DATE NAVIGATION */}
            <div className="bg-white border-t border-slate-100 pt-2 mt-2 flex justify-center items-center shrink-0">
                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-100">
                    <button onClick={() => {
                        const d = new Date(boardViewDate); d.setDate(d.getDate() - 1);
                        if (d >= new Date(globalStartDate)) onSetBoardViewDate(d.toISOString().split('T')[0]);
                    }} className="p-1 hover:bg-white rounded text-slate-400 disabled:opacity-30" disabled={boardViewDate <= globalStartDate}><ChevronRight size={12} /></button>
                    <span className="text-[9px] font-black w-20 text-center text-slate-600">{boardViewDate}</span>
                    <button onClick={() => {
                        const d = new Date(boardViewDate); d.setDate(d.getDate() + 1);
                        if (d <= new Date(globalEndDate)) onSetBoardViewDate(d.toISOString().split('T')[0]);
                    }} className="p-1 hover:bg-white rounded text-slate-400 disabled:opacity-30" disabled={boardViewDate >= globalEndDate}><ChevronLeft size={12} /></button>
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-between items-center pt-4 shrink-0">
                {/* LEFT: Previous button */}
                <button
                    onClick={onPrev}
                    className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 flex items-center gap-2"
                >
                    <ChevronRight size={16} />
                    السابق
                </button>
                
                {/* RIGHT: Save + Next buttons */}
                <div className="flex gap-3">
                    {/* Save button */}
                    <button
                        onClick={onSave}
                        className="px-6 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all flex items-center gap-2"
                    >
                        <Save size={16} />
                        حفظ
                    </button>
                    
                    {/* Next button */}
                    <button
                        onClick={onNext}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2"
                    >
                        التالي
                        <ChevronLeft size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
