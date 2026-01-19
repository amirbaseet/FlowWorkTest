// src/components/absence/steps/Step3PoolManagement.tsx

import React from 'react';
import { Briefcase, UserPlus, Trash2, AlertCircle, Info, Save, ChevronLeft, ChevronRight, Phone, CheckCircle2 } from 'lucide-react';
import { Employee, Lesson } from '@/types';
import { normalizeArabic } from '@/utils';

interface Step3PoolManagementProps {
    activeExternalIds: number[];
    employees: Employee[];
    onTogglePool: (id: number) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    globalStartDate: string;
    lessons: Lesson[];
    onSave: () => void;
    onPrev: () => void;
    onNext: () => void;
}

export const Step3PoolManagement: React.FC<Step3PoolManagementProps> = ({
    activeExternalIds,
    employees,
    onTogglePool,
    searchTerm,
    onSearchChange,
    globalStartDate,
    lessons,
    onSave,
    onPrev,
    onNext
}) => {
    // Helper to check if teacher has lessons on the absence date
    const hasLessonsOnDate = (teacherId: number): boolean => {
        const date = new Date(globalStartDate);
        const dayOfWeek = date.getDay();
        const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayName = DAYS_AR[dayOfWeek];
        return lessons.some(
            l => l.teacherId === teacherId && normalizeArabic(l.day) === normalizeArabic(dayName)
        );
    };

    // Split teachers into categories
    const availableTeachers = employees.filter(emp =>
        !activeExternalIds.includes(emp.id) && hasLessonsOnDate(emp.id)
    );
    
    const onCallTeachers = employees.filter(emp =>
        !activeExternalIds.includes(emp.id) && !hasLessonsOnDate(emp.id)
    );

    // Filter by search term
    const filteredAvailable = availableTeachers.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const filteredOnCall = onCallTeachers.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-[2.5rem] border border-amber-100">
                <div className="mb-2">
                    <h4 className="font-black text-lg text-amber-900 flex items-center gap-2">
                        <Briefcase size={20} className="text-amber-600" />
                        بنك الاحتياط
                    </h4>
                    <p className="text-xs text-amber-700 mt-1">
                        اختر المعلمين المتاحين للتغطية (لديهم فراغ أو يمكن استدعاؤهم)
                    </p>
                </div>

                {/* Info Box */}
                <div className="bg-amber-100 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                    <Info size={14} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                        <p className="font-black mb-1">نوعان من المعلمين:</p>
                        <ul className="text-[10px] space-y-1">
                            <li>✅ <span className="font-bold">متاح:</span> لديه حصص اليوم ولديه فراغ</li>
                            <li>📞 <span className="font-bold">مستدعى:</span> ليس لديه حصص اليوم، سيتم استدعاؤه</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Active Pool Display */}
            {activeExternalIds.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h5 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                        <Briefcase size={16} className="text-amber-600" />
                        المعلمون في البنك ({activeExternalIds.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                        {activeExternalIds.map(id => {
                            const emp = employees.find(e => e.id === id);
                            if (!emp) return null;
                            const isOnCall = !hasLessonsOnDate(id);

                            return (
                                <div
                                    key={id}
                                    onClick={() => onTogglePool(id)}
                                    className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-amber-100 transition-all group relative"
                                >
                                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-black">
                                        {emp.name.charAt(0)}
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">{emp.name}</span>

                                    {/* On-call indicator */}
                                    {isOnCall && (
                                        <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black flex items-center gap-1">
                                            📞 مستدعى
                                        </span>
                                    )}

                                    <Trash2 size={12} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="ابحث عن معلم..."
                        className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-300 transition-all"
                        value={searchTerm}
                        onChange={e => onSearchChange(e.target.value)}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <UserPlus size={16} />
                    </div>
                </div>
            </div>

            {/* SECTION 1: Available Teachers (have lessons, have gaps) */}
            {filteredAvailable.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm">
                    <div className="mb-3">
                        <h5 className="text-sm font-black text-emerald-700 flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            معلمون متاحون ({filteredAvailable.length})
                        </h5>
                        <p className="text-[9px] text-emerald-600 mt-0.5">
                            لديهم حصص اليوم ولديهم فراغ - موجودون في المدرسة
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredAvailable.map(emp => (
                            <div
                                key={emp.id}
                                onClick={() => onTogglePool(emp.id)}
                                className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-xl cursor-pointer hover:bg-emerald-100 hover:shadow-md transition-all flex items-center gap-2 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">
                                    {emp.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate" title={emp.name}>
                                        {emp.name}
                                    </p>
                                    <p className="text-[9px] text-emerald-600 font-medium">
                                        ✅ لديه فراغ
                                    </p>
                                </div>
                                <UserPlus size={14} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 2: On-Call Teachers (no lessons, must be called) */}
            {filteredOnCall.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm">
                    <div className="mb-3">
                        <h5 className="text-sm font-black text-blue-700 flex items-center gap-2">
                            <Phone size={16} />
                            معلمون للاستدعاء ({filteredOnCall.length})
                        </h5>
                        <p className="text-[9px] text-blue-600 mt-0.5">
                            ليس لديهم حصص اليوم - سيتم استدعاؤهم خصيصاً للمدرسة
                        </p>
                    </div>

                    {/* Warning Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-xs text-blue-800 flex items-start gap-2">
                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-blue-600" />
                        <p>
                            <span className="font-black">تنبيه:</span> هؤلاء المعلمون ليس لديهم حصص في هذا اليوم. إضافتهم للبنك تعني استدعاءهم خصيصاً للحضور إلى المدرسة.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredOnCall.map(emp => (
                            <div
                                key={emp.id}
                                onClick={() => {
                                    // Show confirmation dialog
                                    const confirmed = window.confirm(
                                        `⚠️ ${emp.name} ليس لديه حصص في هذا اليوم.\n\n` +
                                        `إضافته للبنك تعني استدعاءه خصيصاً للحضور إلى المدرسة.\n\n` +
                                        `هل تريد المتابعة؟`
                                    );
                                    if (confirmed) {
                                        onTogglePool(emp.id);
                                    }
                                }}
                                className="p-3 bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl cursor-pointer hover:bg-blue-100 hover:border-solid hover:shadow-md transition-all flex items-center gap-2 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">
                                    {emp.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 truncate" title={emp.name}>
                                        {emp.name}
                                    </p>
                                    <p className="text-[9px] text-blue-600 font-medium flex items-center gap-1">
                                        📞 استدعاء
                                    </p>
                                </div>
                                <Phone size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {filteredAvailable.length === 0 && filteredOnCall.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
                    <Briefcase size={48} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-black text-slate-600 mb-1">
                        {searchTerm ? 'لا توجد نتائج' : 'لا يوجد معلمون متاحون'}
                    </p>
                    <p className="text-xs text-slate-400">
                        {searchTerm ? 'جرب البحث بكلمات مختلفة' : 'جميع المعلمين في البنك بالفعل'}
                    </p>
                </div>
            )}

            {/* Footer Navigation */}
            <div className="flex justify-between items-center pt-4">
                <button
                    onClick={onPrev}
                    className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 flex items-center gap-2"
                >
                    <ChevronRight size={16} />
                    السابق
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={onSave}
                        className="px-6 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all flex items-center gap-2"
                    >
                        <Save size={16} />
                        حفظ
                    </button>

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
