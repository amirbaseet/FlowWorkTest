import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface PrintableDutyScheduleProps {
  type: 'weekly' | 'monthly' | 'teacher';
  dutyAssignments: any[];
  employees: any[];
  facilities: any[];
  breakPeriods: any[];
  startDate: string;
  endDate: string;
  selectedTeacherId?: number;
  schoolName?: string;
}

const PrintableDutySchedule: React.FC<PrintableDutyScheduleProps> = ({
  type,
  dutyAssignments,
  employees,
  facilities,
  breakPeriods,
  startDate,
  endDate,
  selectedTeacherId,
  schoolName = "مدرستي"
}) => {
  
  const getDayName = (date: Date): string => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  };

  const getWeekDates = (startDate: Date): Date[] => {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const formatDateForAssignment = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  if (type === 'weekly') {
    const weekStart = new Date(startDate);
    const weekDates = getWeekDates(weekStart);

    return (
      <div className="print-only bg-white p-8" dir="rtl">
        {/* Header */}
        <div className="text-center mb-8 border-b-4 border-indigo-600 pb-6">
          <h1 className="text-3xl font-black text-gray-900 mb-2">{schoolName}</h1>
          <h2 className="text-xl font-bold text-indigo-600 mb-2">جدول المناوبات الأسبوعي</h2>
          <p className="text-sm text-gray-600">
            {weekDates[0].toLocaleDateString('ar')} - {weekDates[6].toLocaleDateString('ar')}
          </p>
        </div>

        {/* Weekly Grid */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="border-2 border-gray-800 px-3 py-3 text-sm font-black w-32">الفسحة</th>
              {weekDates.map((date, idx) => (
                <th key={idx} className="border-2 border-gray-800 px-2 py-3 text-sm font-black">
                  <div>{getDayName(date)}</div>
                  <div className="text-xs font-medium">{date.getDate()}/{date.getMonth() + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakPeriods.map(breakPeriod => (
              <tr key={breakPeriod.id} className="hover:bg-gray-50">
                <td className="border-2 border-gray-300 px-3 py-2 bg-gray-50">
                  <div className="font-bold text-sm text-gray-900">{breakPeriod.name}</div>
                  <div className="text-xs text-gray-600">{breakPeriod.startTime} - {breakPeriod.endTime}</div>
                </td>
                {weekDates.map((date, idx) => {
                  const dateStr = formatDateForAssignment(date);
                  const dayAssignments = dutyAssignments.filter(
                    a => a.breakPeriodId === breakPeriod.id && a.date === dateStr
                  );

                  return (
                    <td key={idx} className="border-2 border-gray-300 px-2 py-2 align-top">
                      <div className="space-y-1">
                        {dayAssignments.map(assignment => {
                          const teacher = employees.find(e => e.id === assignment.teacherId);
                          const facility = facilities.find(f => f.id === assignment.facilityId);
                          return (
                            <div key={assignment.id} className="text-xs">
                              <div className="font-bold text-gray-900">{teacher?.name}</div>
                              <div className="text-gray-600">{facility?.name}</div>
                            </div>
                          );
                        })}
                        {dayAssignments.length === 0 && (
                          <div className="text-xs text-gray-400 text-center">-</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-600">
          <p>طُبع في: {new Date().toLocaleDateString('ar')} - {new Date().toLocaleTimeString('ar')}</p>
        </div>
      </div>
    );
  }

  if (type === 'teacher' && selectedTeacherId) {
    const teacher = employees.find(e => e.id === selectedTeacherId);
    const teacherAssignments = dutyAssignments
      .filter(a => a.teacherId === selectedTeacherId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
      <div className="print-only bg-white p-8" dir="rtl">
        {/* Header */}
        <div className="text-center mb-8 border-b-4 border-indigo-600 pb-6">
          <h1 className="text-3xl font-black text-gray-900 mb-2">{schoolName}</h1>
          <h2 className="text-xl font-bold text-indigo-600 mb-2">جدول المناوبات الشخصي</h2>
          <p className="text-lg font-bold text-gray-700">{teacher?.name}</p>
          <p className="text-sm text-gray-600">
            {new Date(startDate).toLocaleDateString('ar')} - {new Date(endDate).toLocaleDateString('ar')}
          </p>
        </div>

        {/* Assignments List */}
        {teacherAssignments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">لا توجد مناوبات في هذه الفترة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teacherAssignments.map(assignment => {
              const facility = facilities.find(f => f.id === assignment.facilityId);
              const breakPeriod = breakPeriods.find(b => b.id === assignment.breakPeriodId);
              const date = new Date(assignment.date);
              
              return (
                <div key={assignment.id} className="border-2 border-gray-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-gray-900">{getDayName(date)}</span>
                      <span className="text-sm text-gray-600">{date.toLocaleDateString('ar')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                      <div>
                        <span className="font-bold">الفسحة:</span> {breakPeriod?.name}
                      </div>
                      <div>
                        <span className="font-bold">الوقت:</span> {breakPeriod?.startTime} - {breakPeriod?.endTime}
                      </div>
                      <div className="col-span-2">
                        <span className="font-bold">المرفق:</span> {facility?.name}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        <div className="mt-8 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
          <p className="text-sm font-bold text-gray-800">
            إجمالي المناوبات: <span className="text-indigo-600">{teacherAssignments.length}</span>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-600">
          <p>طُبع في: {new Date().toLocaleDateString('ar')} - {new Date().toLocaleTimeString('ar')}</p>
        </div>
      </div>
    );
  }

  return null;
};

export default PrintableDutySchedule;
