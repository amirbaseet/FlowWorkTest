import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar as CalendarIcon, Award, AlertTriangle } from 'lucide-react';

interface HistoricalDutyAnalyticsProps {
  dutyAssignments: any[];
  employees: any[];
  breakPeriods: any[];
  facilities: any[];
}

const HistoricalDutyAnalytics: React.FC<HistoricalDutyAnalyticsProps> = ({
  dutyAssignments,
  employees,
  breakPeriods,
  facilities
}) => {
  
  // Group assignments by month
  const monthlyData = useMemo(() => {
    const months = new Map<string, { count: number; teachers: Set<number> }>();
    
    dutyAssignments.forEach(assignment => {
      const date = new Date(assignment.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!months.has(monthKey)) {
        months.set(monthKey, { count: 0, teachers: new Set() });
      }
      
      const monthData = months.get(monthKey)!;
      monthData.count++;
      monthData.teachers.add(assignment.teacherId);
    });
    
    return Array.from(months.entries())
      .map(([month, data]) => ({
        month,
        count: data.count,
        activeTeachers: data.teachers.size,
        avgPerTeacher: data.teachers.size > 0 ? (data.count / data.teachers.size).toFixed(1) : '0'
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months
  }, [dutyAssignments]);

  // Calculate trend
  const trend = useMemo(() => {
    if (monthlyData.length < 2) return { direction: 'stable', percentage: 0 };
    
    const latest = monthlyData[monthlyData.length - 1].count;
    const previous = monthlyData[monthlyData.length - 2].count;
    
    if (previous === 0) return { direction: 'stable', percentage: 0 };
    
    const change = ((latest - previous) / previous) * 100;
    
    return {
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
      percentage: Math.abs(Math.round(change))
    };
  }, [monthlyData]);

  // Teacher performance trends
  const teacherTrends = useMemo(() => {
    const teacherMonthly = new Map<number, Map<string, number>>();
    
    dutyAssignments.forEach(assignment => {
      const date = new Date(assignment.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!teacherMonthly.has(assignment.teacherId)) {
        teacherMonthly.set(assignment.teacherId, new Map());
      }
      
      const months = teacherMonthly.get(assignment.teacherId)!;
      months.set(monthKey, (months.get(monthKey) || 0) + 1);
    });
    
    return Array.from(teacherMonthly.entries())
      .map(([teacherId, months]) => {
        const teacher = employees.find(e => e.id === teacherId);
        const monthsArray = Array.from(months.values());
        const avgDuties = monthsArray.reduce((a, b) => a + b, 0) / monthsArray.length;
        const lastMonth = monthsArray[monthsArray.length - 1] || 0;
        const prevMonth = monthsArray[monthsArray.length - 2] || 0;
        
        return {
          teacher,
          avgDuties: avgDuties.toFixed(1),
          lastMonth,
          trend: lastMonth > prevMonth ? 'up' : lastMonth < prevMonth ? 'down' : 'stable'
        };
      })
      .sort((a, b) => parseFloat(b.avgDuties) - parseFloat(a.avgDuties))
      .slice(0, 10);
  }, [dutyAssignments, employees]);

  // Insights
  const insights = useMemo(() => {
    const result: Array<{ type: 'warning' | 'info' | 'success'; message: string }> = [];
    
    // Check for overworked teachers
    const overworked = teacherTrends.filter(t => parseFloat(t.avgDuties) > 15);
    if (overworked.length > 0) {
      result.push({
        type: 'warning',
        message: `${overworked.length} معلم يقترب من الحد الأقصى للمناوبات`
      });
    }
    
    // Check for trend
    if (trend.direction === 'up') {
      result.push({
        type: 'info',
        message: `زيادة في المناوبات بنسبة ${trend.percentage}% هذا الشهر`
      });
    } else if (trend.direction === 'down') {
      result.push({
        type: 'success',
        message: `انخفاض في المناوبات بنسبة ${trend.percentage}% هذا الشهر`
      });
    }
    
    // Check for inactive teachers
    const activeTeachers = new Set(dutyAssignments.map(a => a.teacherId));
    const inactiveCount = employees.length - activeTeachers.size;
    if (inactiveCount > 0) {
      result.push({
        type: 'info',
        message: `${inactiveCount} معلم لم يُعيّن لأي مناوبة`
      });
    }
    
    return result;
  }, [teacherTrends, trend, dutyAssignments, employees]);

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Trend Overview */}
      <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-md">
        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="text-indigo-600" size={20} />
          اتجاهات المناوبات الشهرية
        </h3>
        
        {monthlyData.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">لا توجد بيانات كافية للتحليل</p>
        ) : (
          <>
            {/* Trend Indicator */}
            <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">الاتجاه الحالي</p>
                <div className="flex items-center gap-2">
                  {trend.direction === 'up' && <TrendingUp className="text-green-600" size={24} />}
                  {trend.direction === 'down' && <TrendingDown className="text-red-600" size={24} />}
                  {trend.direction === 'stable' && <Minus className="text-gray-600" size={24} />}
                  {trend.percentage > 0 && (
                    <span className={`text-2xl font-black ${
                      trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {trend.percentage}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Chart */}
            <div className="space-y-2">
              {monthlyData.map((month, idx) => {
                const maxCount = Math.max(...monthlyData.map(m => m.count), 1);
                const width = (month.count / maxCount) * 100;
                
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-bold text-gray-700">
                      {getMonthName(month.month)}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-10 relative overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-between px-3 transition-all duration-500"
                        style={{ width: `${width}%` }}
                      >
                        <span className="text-white text-xs font-black">{month.count} مناوبة</span>
                        <span className="text-white text-[10px]">{month.activeTeachers} معلم</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Teacher Performance Trends */}
      <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-md">
        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
          <Award className="text-purple-600" size={20} />
          أداء المعلمين (آخر 6 أشهر)
        </h3>
        
        <div className="space-y-2">
          {teacherTrends.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700">{idx + 1}.</span>
                <span className="text-sm font-bold text-gray-800">{item.teacher?.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500">متوسط</p>
                  <p className="text-sm font-black text-indigo-600">{item.avgDuties}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500">الشهر الحالي</p>
                  <p className="text-sm font-black text-purple-600">{item.lastMonth}</p>
                </div>
                <div>
                  {item.trend === 'up' && <TrendingUp className="text-green-600" size={16} />}
                  {item.trend === 'down' && <TrendingDown className="text-red-600" size={16} />}
                  {item.trend === 'stable' && <Minus className="text-gray-400" size={16} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-md">
          <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={20} />
            رؤى وتوصيات
          </h3>
          
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <div 
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border-r-4 ${
                  insight.type === 'warning' ? 'bg-amber-50 border-amber-500' :
                  insight.type === 'info' ? 'bg-blue-50 border-blue-500' :
                  'bg-green-50 border-green-500'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {insight.type === 'warning' && <AlertTriangle className="text-amber-600" size={18} />}
                  {insight.type === 'info' && <CalendarIcon className="text-blue-600" size={18} />}
                  {insight.type === 'success' && <Award className="text-green-600" size={18} />}
                </div>
                <p className="text-sm font-medium text-gray-700">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default HistoricalDutyAnalytics;
