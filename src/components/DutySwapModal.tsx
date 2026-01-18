import React, { useState, useMemo } from 'react';
import { X, Users, Calendar, MapPin, Clock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface DutySwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAssignment: {
    id: string;
    breakPeriodId: string;
    facilityId: string;
    teacherId: number;
    date: string;
  } | null;
  employees: any[];
  facilities: any[];
  breakPeriods: any[];
  dutyAssignments: any[];
  onSubmitSwap: (targetAssignmentId: string, reason: string) => void;
}

const DutySwapModal: React.FC<DutySwapModalProps> = ({
  isOpen,
  onClose,
  currentAssignment,
  employees,
  facilities,
  breakPeriods,
  dutyAssignments,
  onSubmitSwap
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'select' | 'confirm'>(

'select');

  if (!isOpen || !currentAssignment) return null;

  const currentTeacher = employees.find(e => e.id === currentAssignment.teacherId);
  const currentFacility = facilities.find(f => f.id === currentAssignment.facilityId);
  const currentBreak = breakPeriods.find(b => b.id === currentAssignment.breakPeriodId);

  // Find eligible assignments to swap with
  const eligibleSwaps = useMemo(() => {
    return dutyAssignments.filter(assignment => 
      assignment.id !== currentAssignment.id &&
      assignment.date === currentAssignment.date
    ).map(assignment => {
      const teacher = employees.find(e => e.id === assignment.teacherId);
      const facility = facilities.find(f => f.id === assignment.facilityId);
      const breakPeriod = breakPeriods.find(b => b.id === assignment.breakPeriodId);
      
      return {
        assignment,
        teacher,
        facility,
        breakPeriod
      };
    });
  }, [dutyAssignments, currentAssignment, employees, facilities, breakPeriods]);

  const selectedTarget = eligibleSwaps.find(s => s.assignment.id === selectedTargetId);

  const handleSubmit = () => {
    if (!selectedTargetId || !reason.trim()) return;
    onSubmitSwap(selectedTargetId, reason);
    setSelectedTargetId('');
    setReason('');
    setStep('select');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <RefreshCw size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black">طلب تبديل مناوبة</h2>
              <p className="text-sm text-blue-100">اختر معلم للتبديل معه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[600px] overflow-y-auto">
          {/* Current Assignment Info */}
          <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200 mb-6">
            <h3 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-blue-600" />
              مناوبتك الحالية
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Users size={14} className="text-gray-600" />
                <span className="text-gray-700">{currentTeacher?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-gray-600" />
                <span className="text-gray-700">{new Date(currentAssignment.date).toLocaleDateString('ar')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-gray-600" />
                <span className="text-gray-700">{currentBreak?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-gray-600" />
                <span className="text-gray-700">{currentFacility?.name}</span>
              </div>
            </div>
          </div>

          {step === 'select' && (
            <>
              {/* Eligible Swaps */}
              <h3 className="text-sm font-black text-gray-800 mb-3">اختر مناوبة للتبديل</h3>
              
              {eligibleSwaps.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto mb-3 text-gray-300" size={48} />
                  <p className="text-sm text-gray-500">لا توجد مناوبات متاحة للتبديل في نفس اليوم</p>
                </div>
              ) : (
                <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto">
                  {eligibleSwaps.map(({ assignment, teacher, facility, breakPeriod }) => (
                    <button
                      key={assignment.id}
                      onClick={() => setSelectedTargetId(assignment.id)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                        selectedTargetId === assignment.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-800">{teacher?.name}</span>
                        {selectedTargetId === assignment.id && (
                          <CheckCircle2 size={20} className="text-indigo-600" />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>{breakPeriod?.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={12} />
                          <span>{facility?.name}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Reason Input */}
              {selectedTargetId && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    سبب التبديل <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="مثال: لدي ارتباط مهم في هذا الوقت..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none text-sm resize-none"
                    rows={3}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (selectedTargetId && reason.trim()) {
                      setStep('confirm');
                    }
                  }}
                  disabled={!selectedTargetId || !reason.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  متابعة
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && selectedTarget && (
            <>
              {/* Confirmation */}
              <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200 mb-6">
                <h3 className="text-sm font-black text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  تأكيد التبديل
                </h3>
                <p className="text-xs text-amber-700 mb-4">
                  سيتم إرسال طلب التبديل إلى الإدارة للموافقة. بعد الموافقة، ستتبادل المناوبات مع المعلم المحدد.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Your New Duty */}
                  <div className="bg-white rounded-lg p-3 border border-amber-300">
                    <p className="text-xs font-bold text-gray-600 mb-2">مناوبتك الجديدة</p>
                    <div className="space-y-1 text-xs text-gray-700">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{selectedTarget.breakPeriod?.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={12} />
                        <span>{selectedTarget.facility?.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Their New Duty */}
                  <div className="bg-white rounded-lg p-3 border border-amber-300">
                    <p className="text-xs font-bold text-gray-600 mb-2">مناوبة {selectedTarget.teacher?.name} الجديدة</p>
                    <div className="space-y-1 text-xs text-gray-700">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{currentBreak?.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={12} />
                        <span>{currentFacility?.name}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-white rounded-lg border border-amber-300">
                  <p className="text-xs font-bold text-gray-600 mb-1">السبب:</p>
                  <p className="text-xs text-gray-700">{reason}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-bold transition-all"
                >
                  إرسال الطلب
                </button>
                <button
                  onClick={() => setStep('select')}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold transition-all"
                >
                  رجوع
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default DutySwapModal;
