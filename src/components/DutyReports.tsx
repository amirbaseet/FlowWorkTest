import React, { useState, useMemo } from 'react';
import { BarChart3, PieChart, Download, Printer, Calendar, Filter, CheckSquare, Square, TrendingUp, Award, AlertCircle, Users, Clock, FileText, Layout } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import PrintableDutySchedule from './PrintableDutySchedule';
import HistoricalDutyAnalytics from './HistoricalDutyAnalytics';

interface DutyReportsProps {
  employees: any[];
  dutyAssignments: any[];
  facilities: any[];
  breakPeriods: any[];
  lessons: any[];
}

interface MetricConfig {
  id: string;
  name: string;
  enabled: boolean;
  category: 'chart' | 'table' | 'stat';
}

const DutyReports: React.FC<DutyReportsProps> = ({
  employees,
  dutyAssignments,
  facilities,
  breakPeriods,
  lessons
}) => {
  // State
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [printTemplate, setPrintTemplate] = useState<'standard' | 'weekly' | 'monthly' | 'teacher'>('standard');
  
  const [metrics, setMetrics] = useState<MetricConfig[]>([
    { id: 'duty-dist', name: 'توزيع المناوبات', enabled: true, category: 'chart' },
    { id: 'fairness', name: 'درجة العدالة', enabled: true, category: 'stat' },
    { id: 'coverage', name: 'تحليل التغطية', enabled: true, category: 'chart' },
    { id: 'teacher-table', name: 'تقرير المعلمين', enabled: true, category: 'table' },
    { id: 'facility-table', name: 'تقرير المرافق', enabled: false, category: 'table' },
    { id: 'trends', name: 'الاتجاهات الأسبوعية', enabled: false, category: 'chart' },
    { id: 'historical', name: 'التحليلات التاريخية', enabled: false, category: 'chart' },
  ]);

  // Filtered assignments by date range
  const filteredAssignments = useMemo(() => {
    return dutyAssignments.filter(a => {
      const date = new Date(a.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return date >= start && date <= end;
    });
  }, [dutyAssignments, startDate, endDate]);

  // Calculate duty counts per teacher
  const teacherDutyCounts = useMemo(() => {
    const counts = new Map<number, number>();
    employees.forEach(emp => counts.set(emp.id, 0));
    
    filteredAssignments.forEach(assignment => {
      const count = counts.get(assignment.teacherId) || 0;
      counts.set(assignment.teacherId, count + 1);
    });
    
    return Array.from(counts.entries())
      .map(([teacherId, count]) => ({
        teacher: employees.find(e => e.id === teacherId),
        count
      }))
      .filter(item => item.teacher)
      .sort((a, b) => b.count - a.count);
  }, [employees, filteredAssignments]);

  // Calculate fairness score
  const fairnessMetrics = useMemo(() => {
    const counts = teacherDutyCounts.map(t => t.count);
    if (counts.length === 0) return { score: 100, min: 0, max: 0, avg: 0, stdDev: 0 };
    
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    
    const variance = counts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    
    const score = Math.max(0, 100 - (stdDev / (avg || 1)) * 50);
    
    return { score: Math.round(score), min, max, avg: avg.toFixed(1), stdDev: stdDev.toFixed(2) };
  }, [teacherDutyCounts]);

  // Coverage analysis
  const coverageData = useMemo(() => {
    return breakPeriods.map(bp => {
      const total = facilities.length * 7; // Assuming 7 days
      const assigned = filteredAssignments.filter(a => a.breakPeriodId === bp.id).length;
      return {
        name: bp.name,
        percentage: total > 0 ? Math.round((assigned / total) * 100) : 0
      };
    });
  }, [breakPeriods, facilities, filteredAssignments]);

  // Toggle metric
  const toggleMetric = (id: string) => {
    setMetrics(prev => prev.map(m => 
      m.id === id ? { ...m, enabled: !m.enabled } : m
    ));
  };

  // Export to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Teacher report sheet
    const teacherData = teacherDutyCounts.map(t => ({
      'اسم المعلم': t.teacher?.name || '',
      'عدد المناوبات': t.count,
      'النصاب': t.teacher?.contractedHours || 0,
      'متاح': t.teacher ? t.teacher.contractedHours - (t.teacher.workload?.actual || 0) : 0
    }));
    const ws1 = XLSX.utils.json_to_sheet(teacherData);
    XLSX.utils.book_append_sheet(wb, ws1, 'تقرير المعلمين');
    
    // Summary sheet
    const summaryData = [{
      'إجمالي التخصيصات': filteredAssignments.length,
      'عدد المعلمين': employees.length,
      'درجة العدالة': fairnessMetrics.score,
      'الحد الأدنى': fairnessMetrics.min,
      'المتوسط': fairnessMetrics.avg,
      'الحد الأقصى': fairnessMetrics.max
    }];
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, 'الملخص');
    
    XLSX.writeFile(wb, `تقرير_المناوبات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Duty Reports', 20, 20);
    doc.setFontSize(12);
    doc.text(`Period: ${startDate} to ${endDate}`, 20, 30);
    
    // Summary
    doc.setFontSize(14);
    doc.text('Summary', 20, 45);
    doc.setFontSize(10);
    doc.text(`Total Assignments: ${filteredAssignments.length}`, 20, 55);
    doc.text(`Fairness Score: ${fairnessMetrics.score}/100`, 20, 62);
    doc.text(`Average Duties: ${fairnessMetrics.avg}`, 20, 69);
    
    // Teacher table
    const tableData = teacherDutyCounts.slice(0, 20).map(t => [
      t.teacher?.name || '',
      t.count.toString(),
      t.teacher?.contractedHours?.toString() || '0'
    ]);
    
    (doc as any).autoTable({
      startY: 80,
      head: [['Teacher', 'Duty Count', 'Contracted Hours']],
      body: tableData,
    });
    
    doc.save(`duty-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Teacher Name,Duty Count,Contracted Hours,Available Hours'];
    const rows = teacherDutyCounts.map(t => 
      `${t.teacher?.name},${t.count},${t.teacher?.contractedHours || 0},${t.teacher ? t.teacher.contractedHours - (t.teacher.workload?.actual || 0) : 0}`
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `duty-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Print view
  const openPrintView = () => {
    window.print();
  };

  return (
    <div className="h-screen w-screen overflow-auto bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" dir="rtl">
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-indigo-200 px-6 py-4 sticky top-0 z-10 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <BarChart3 className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">التقارير والتحليلات</h1>
            <p className="text-sm text-gray-600 font-medium">تحليل شامل لتوزيع المناوبات والعدالة</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        
        {/* Controls Bar */}
        <div className="bg-white rounded-2xl p-4 border-2 border-gray-200 shadow-md mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">من تاريخ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            
            {/* Export Dropdown */}
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all shadow-sm"
              >
                <Download size={16} />
                Excel
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all shadow-sm"
              >
                <Download size={16} />
                PDF
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all shadow-sm"
              >
                <Download size={16} />
                CSV
              </button>
              <button
                onClick={openPrintView}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-all shadow-sm"
              >
                <Printer size={16} />
                طباعة
              </button>
            </div>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="bg-white rounded-2xl p-4 border-2 border-gray-200 shadow-md mb-6 print:hidden">
          <h3 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
            <Filter size={16} />
            اختر المقاييس المراد عرضها
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {metrics.map(metric => (
              <button
                key={metric.id}
                onClick={() => toggleMetric(metric.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                  metric.enabled 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {metric.enabled ? <CheckSquare size={16} /> : <Square size={16} />}
                <span className="text-sm font-bold">{metric.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Print Template Selector */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200 shadow-md mb-6 print:hidden">
          <h3 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
            <Layout size={16} className="text-purple-600" />
            قوالب الطباعة
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={printTemplate}
              onChange={(e) => setPrintTemplate(e.target.value as any)}
              className="flex-1 px-4 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm font-bold"
            >
              <option value="standard">عرض قياسي (شاشة)</option>
              <option value="weekly">جدول أسبوعي (طباعة)</option>
              <option value="teacher">جدول معلم (طباعة)</option>
            </select>
            {printTemplate !== 'standard' && (
              <button
                onClick={openPrintView}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-bold transition-all shadow-sm"
              >
                <Printer size={16} />
                طباعة
              </button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border-2 border-blue-200 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">إجمالي التخصيصات</p>
                <p className="text-2xl font-black text-blue-600">{filteredAssignments.length}</p>
              </div>
            </div>
          </div>

          {metrics.find(m => m.id === 'fairness')?.enabled && (
            <div className="bg-white rounded-2xl p-4 border-2 border-green-200 shadow-md">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Award className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">درجة العدالة</p>
                  <p className="text-2xl font-black text-green-600">{fairnessMetrics.score}/100</p>
                </div>
              </div>
              <div className="text-[10px] text-gray-600 mt-2 pt-2 border-t border-green-100">
                <div className="flex justify-between">
                  <span>Min: {fairnessMetrics.min}</span>
                  <span>Avg: {fairnessMetrics.avg}</span>
                  <span>Max: {fairnessMetrics.max}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 border-2 border-purple-200 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">المعلمون النشطون</p>
                <p className="text-2xl font-black text-purple-600">{teacherDutyCounts.filter(t => t.count > 0).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border-2 border-amber-200 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-amber-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">متوسط المناوبات</p>
                <p className="text-2xl font-black text-amber-600">{fairnessMetrics.avg}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {metrics.find(m => m.id === 'duty-dist')?.enabled && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-md mb-6">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" size={20} />
              توزيع المناوبات لكل معلم
            </h3>
            
            <div className="space-y-2">
              {teacherDutyCounts.slice(0, 10).map((item, idx) => {
                const maxCount = Math.max(...teacherDutyCounts.map(t => t.count), 1);
                const width = (item.count / maxCount) * 100;
                
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-bold text-gray-700 truncate">
                      {item.teacher?.name}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-end px-3 transition-all duration-500"
                        style={{ width: `${width}%` }}
                      >
                        <span className="text-white text-sm font-black">{item.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Coverage Chart */}
        {metrics.find(m => m.id === 'coverage')?.enabled && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-md mb-6">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <PieChart className="text-purple-600" size={20} />
              تحليل التغطية حسب الفسحة
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {coverageData.map((item, idx) => (
                <div key={idx} className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <p className="text-sm font-bold text-gray-700 mb-2">{item.name}</p>
                  <div className="relative w-24 h-24 mx-auto mb-2">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#e0e7ff"
                        strokeWidth="10"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="10"
                        strokeDasharray={`${item.percentage * 2.51} 251`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black text-purple-600">{item.percentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teacher Report Table */}
        {metrics.find(m => m.id === 'teacher-table')?.enabled && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-md mb-6">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <Users className="text-blue-600" size={20} />
              تقرير المعلمين التفصيلي
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-black text-gray-700 border-b-2">#</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-gray-700 border-b-2">اسم المعلم</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-700 border-b-2">المناوبات</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-700 border-b-2">النصاب</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-700 border-b-2">متاح</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-700 border-b-2">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherDutyCounts.map((item, idx) => {
                    const available = item.teacher ? item.teacher.contractedHours - (item.teacher.workload?.actual || 0) : 0;
                    const status = item.count === 0 ? 'غير مُعيّن' : 
                                 item.count <= parseInt(fairnessMetrics.avg) ? 'جيد' : 'مرتفع';
                    const statusColor = item.count === 0 ? 'text-gray-500' :
                                      item.count <= parseInt(fairnessMetrics.avg) ? 'text-green-600' : 'text-amber-600';
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700 border-b">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-800 border-b">{item.teacher?.name}</td>
                        <td className="px-4 py-3 text-sm text-center font-black text-indigo-600 border-b">{item.count}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-700 border-b">{item.teacher?.contractedHours || 0}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-700 border-b">{available}</td>
                        <td className={`px-4 py-3 text-sm text-center font-bold border-b ${statusColor}`}>{status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Historical Analytics */}
        {metrics.find(m => m.id === 'historical')?.enabled && (
          <HistoricalDutyAnalytics
            dutyAssignments={dutyAssignments}
            employees={employees}
            breakPeriods={breakPeriods}
            facilities={facilities}
          />
        )}

        {/* No Data Message */}
        {filteredAssignments.length === 0 && (
          <div className="bg-white rounded-2xl p-12 border-2 border-gray-200 shadow-md text-center">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-lg font-bold text-gray-700">لا توجد بيانات للعرض</p>
            <p className="text-sm text-gray-500 mt-2">لا توجد تخصيصات في الفترة المحددة</p>
          </div>
        )}

        {/* Print Templates */}
        {printTemplate !== 'standard' && (
          <PrintableDutySchedule
            type={printTemplate as 'weekly' | 'teacher'}
            dutyAssignments={filteredAssignments}
            employees={employees}
            facilities={facilities}
            breakPeriods={breakPeriods}
            startDate={startDate}
            endDate={endDate}
            schoolName="مدرستي"
          />
        )}

      </div>
    </div>
  );
};

export default DutyReports;
