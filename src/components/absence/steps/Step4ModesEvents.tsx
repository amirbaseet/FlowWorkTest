// src/components/absence/steps/Step4ModesEvents.tsx

import React from 'react';
import { Zap, Edit3, CalendarPlus, Info, CheckCircle2, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarEvent } from '@/types';

interface Step4ModesEventsProps {
    activeEvents: CalendarEvent[];
    globalStartDate: string;
    activeExternalIds: number[];
    onOpenRequestForm: (prefill: any) => void;
    setStep: React.Dispatch<React.SetStateAction<1 | 2 | 3 | 4 | 5 | 6 | 7>>;
    onSave: () => void;
    onPrev: () => void;
    onNext: () => void;
}

export const Step4ModesEvents: React.FC<Step4ModesEventsProps> = ({
    activeEvents,
    globalStartDate,
    activeExternalIds,
    onOpenRequestForm,
    setStep,
    onSave,
    onPrev,
    onNext
}) => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 p-6 rounded-[2.5rem] border border-violet-100">
                <div className="mb-4">
                    <h4 className="font-black text-lg text-violet-900 flex items-center gap-2">
                        <Zap size={20} className="text-violet-600" /> إضافة أنماط لهذا اليوم
                    </h4>
                    <p className="text-xs text-violet-700 mt-1">
                        يمكنك إضافة أكثر من نمط لنفس اليوم (امتحانات، رحلات، نشاطات...)
                    </p>
                </div>

                {/* Display Active Events for this date */}
                {activeEvents.length > 0 && (
                    <div className="mb-6">
                        <h5 className="text-xs font-black text-violet-600 mb-3">الأنماط النشطة لهذا اليوم:</h5>
                        <div className="grid gap-3">
                            {activeEvents.map(event => (
                                <div key={event.id} className="bg-white p-4 rounded-xl border border-violet-200 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                                            {event.eventType === 'EXAM' ? '📝' : event.eventType === 'TRIP' ? '🚌' : '🎯'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800">{event.title}</p>
                                            <p className="text-[10px] text-slate-500">{event.description || 'لا يوجد وصف'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {event.opContext?.isActive && (
                                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-1 rounded-md">
                                                قواعد نشطة
                                            </span>
                                        )}
                                        <button
                                            onClick={() => {
                                                onOpenRequestForm({
                                                    ...event,
                                                    returnToAbsenceForm: true
                                                });
                                            }}
                                            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                                        >
                                            <Edit3 size={14} className="text-slate-600" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add New Mode/Event Button */}
                <button
                    onClick={() => {
                        onOpenRequestForm({
                            date: globalStartDate,
                            title: `فعالية ${new Date(globalStartDate).toLocaleDateString('ar-EG')}`,
                            type: 'ACTIVITY',
                            description: '',
                            autoSmartMode: true,
                            poolIds: activeExternalIds,
                            returnToAbsenceForm: true,
                            autoSetActive: true,
                            runAutoDistribution: true
                        });
                    }}
                    className="w-full p-4 bg-white border-2 border-dashed border-violet-300 rounded-xl hover:border-violet-400 hover:bg-violet-50 transition-all text-violet-600 font-black text-sm flex items-center justify-center gap-2"
                >
                    <CalendarPlus size={18} />
                    إضافة نمط/فعالية جديدة
                </button>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2 mt-4">
                    <Info size={14} className="mt-0.5 shrink-0 text-amber-600" />
                    <p><span className="font-black">ملاحظة:</span> سيتم فتح نموذج إضافة النمط في نافذة منبثقة. بعد الإضافة، ستعود تلقائيًا إلى هذه النافذة</p>
                </div>

                {activeEvents.length === 0 ? (
                    <div className="text-center py-12 text-violet-400">
                        <Zap size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-black text-slate-600">لا توجد أنماط مفعلة لهذا اليوم</p>
                        <p className="text-xs text-slate-400 mt-2">يمكنك المتابعة للمرحلة التالية</p>
                        <button
                            onClick={() => setStep(5)}
                            className="mt-4 px-6 py-2 bg-violet-600 text-white rounded-xl text-xs font-black hover:bg-violet-700 transition-all"
                        >
                            تخطي هذه المرحلة
                        </button>
                    </div>
                ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 mt-4">
                        <CheckCircle2 size={20} className="text-emerald-600" />
                        <p className="text-xs text-emerald-800">
                            <span className="font-black">تم!</span> سيتم تطبيق قواعد الأنماط النشطة تلقائياً
                        </p>
                    </div>
                )}
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-between items-center pt-4">
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
