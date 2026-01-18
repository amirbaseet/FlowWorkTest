
import React, { useState } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2, Database, ArrowRight, Download, Table } from 'lucide-react';
import { parseExcelFile } from '@/utils/excelImport';
import { ImportResult } from '@/types';
import * as XLSX from 'xlsx';
import { normalizeArabic } from '@/utils';
import { SharedLessonClassifier } from './SharedLessonClassifier';

interface ImportExcelModalProps {
  onClose: () => void;
  onSave: (data: ImportResult) => void;
}

const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ onClose, onSave }) => {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [showClassifier, setShowClassifier] = useState(false);

  const handleDownloadTemplate = () => {
    // Generate Matrix Template (Class per Sheet)
    const headers = ['الحصة', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    const periods = Array.from({length: 7}, (_, i) => [i + 1, '', '', '', '', '']); // 7 Periods
    
    // Fill sample for Period 1 Sunday
    periods[0][1] = "لغة عربية\nأحمد محمود"; // Sample Cell

    const ws = XLSX.utils.aoa_to_sheet([headers, ...periods]);
    ws['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "خامس أ"); // Sheet Name = Class Name

    XLSX.writeFile(wb, "repo_classes_template.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    try {
      const data = await parseExcelFile(file);
      setResult(data);
      setStep('preview');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "خطأ في قراءة الملف.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (result) {
      if (result.sharedLessons.length > 0) {
        setShowClassifier(true);
      } else {
        onSave(result);
        onClose();
      }
    }
  };

  const handleClassify = (classifications: any[]) => {
    if (!result) return;

    // Create subject-role mapping (SUBJECT ONLY, not teacher)
    const subjectRoleMap = new Map<string, 'primary' | 'secondary'>();
    
    classifications.forEach(c => {
      const normalizedPrimary = normalizeArabic(c.primary.subject).toLowerCase().trim();
      const normalizedSecondary = normalizeArabic(c.secondary.subject).toLowerCase().trim();
      
      subjectRoleMap.set(normalizedPrimary, 'primary');
      if (c.secondary.role === 'primary') {
        subjectRoleMap.set(normalizedSecondary, 'primary');
      } else {
        subjectRoleMap.set(normalizedSecondary, 'secondary');
      }
    });

    // Apply to all entries in timetable
    const updatedTimetable = result.timetable.map(entry => {
      const normalizedSubject = normalizeArabic(entry.subject).toLowerCase().trim();
      const role = subjectRoleMap.get(normalizedSubject);
      
      return {
        ...entry,
        teacherRole: role || entry.teacherRole // Keep existing or default to undefined (which usually means primary later)
      };
    });

    onSave({ ...result, timetable: updatedTimetable });
    onClose();
  };

  const handleSkipClassification = () => {
    if (result) {
      onSave(result);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-6 animate-fade-in" dir="rtl">
      {showClassifier && result && (
        <SharedLessonClassifier 
          sharedLessons={result.sharedLessons}
          onClassify={handleClassify}
          onSkip={handleSkipClassification}
        />
      )}
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">معالج الاستيراد الذكي</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Excel Matrix Parser v2.0</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-2xl transition-all shadow-sm border border-slate-100">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center h-full space-y-8 py-10">
              <div className="text-center space-y-2">
                <h4 className="text-xl font-black text-slate-800">رفع ملف الجداول (نمط المصفوفة)</h4>
                <p className="text-sm text-slate-500 max-w-md mx-auto font-bold">
                  يجب أن تكون كل شعبة في ورقة منفصلة. الأعمدة تمثل الأيام، والصفوف تمثل الحصص.
                </p>
              </div>

              <div className="w-full max-w-xl space-y-4">
                <button 
                  onClick={handleDownloadTemplate}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-indigo-50 border-2 border-indigo-100 text-indigo-600 rounded-[2rem] hover:bg-indigo-100 transition-all font-black text-xs shadow-sm group"
                >
                  <Download size={20} className="group-hover:-translate-y-1 transition-transform" />
                  تحميل نموذج المصفوفة (Excel)
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-black uppercase">أو</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <label className="group cursor-pointer flex flex-col items-center justify-center w-full h-56 border-4 border-dashed border-slate-200 rounded-[3rem] hover:border-emerald-500 hover:bg-emerald-50/30 transition-all relative overflow-hidden bg-slate-50">
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} disabled={isLoading} />
                  
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                      <Loader2 size={48} className="text-emerald-500 animate-spin" />
                      <span className="text-sm font-bold text-emerald-600">جاري تحليل المصفوفة...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-5 bg-white rounded-full shadow-xl mb-4 group-hover:scale-110 transition-transform">
                        <Upload size={32} className="text-emerald-600" />
                      </div>
                      <span className="text-lg font-black text-slate-700">اضغط لرفع ملف repo_classes.xlsx</span>
                      <span className="text-xs font-bold text-slate-400 mt-1">Matrix Format Support</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {step === 'preview' && result && (
            <div className="space-y-8 animate-slide-up">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">المعلمون الجدد</span>
                  <span className="text-3xl font-black text-indigo-700">{result.stats.teachersFound}</span>
                </div>
                <div className="p-5 bg-emerald-50 rounded-3xl border border-emerald-100">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-2">الحصص المستخرجة</span>
                  <span className="text-3xl font-black text-emerald-700">{result.stats.lessonsFound}</span>
                </div>
                <div className="p-5 bg-amber-50 rounded-3xl border border-amber-100">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-2">الشعب المكتشفة</span>
                  <span className="text-3xl font-black text-amber-700">{result.stats.classesDetected}</span>
                </div>
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">السجلات</span>
                  <span className="text-3xl font-black text-slate-700">{result.stats.totalRows}</span>
                </div>
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100">
                  <h5 className="font-black text-rose-700 flex items-center gap-2 mb-3"><AlertTriangle size={18}/> تنبيهات التحليل</h5>
                  <ul className="list-disc list-inside space-y-1">
                    {result.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx} className="text-xs font-bold text-rose-600">{err}</li>
                    ))}
                    {result.errors.length > 5 && <li className="text-xs font-bold text-rose-600">... والمزيد</li>}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="space-y-4">
                <h5 className="font-black text-slate-800 flex items-center gap-2"><Database size={18} className="text-slate-400"/> عينة من البيانات المعالجة</h5>
                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden max-h-60 overflow-y-auto custom-scrollbar shadow-inner">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 font-black text-slate-500 sticky top-0">
                      <tr>
                        <th className="p-4">الشعبة</th>
                        <th className="p-4">اليوم</th>
                        <th className="p-4">الحصة</th>
                        <th className="p-4">المادة</th>
                        <th className="p-4">المعلم</th>
                        <th className="p-4">التصنيف</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 font-bold divide-y divide-slate-50">
                      {result.timetable.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-4 font-black text-indigo-900">{row.className}</td>
                          <td className="p-4">{row.day}</td>
                          <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-[10px]">{row.period}</span></td>
                          <td className="p-4">{row.subject}</td>
                          <td className="p-4">{row.teacherName}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-[9px] ${
                              row.type === 'actual' ? 'bg-indigo-100 text-indigo-700' : 
                              row.type === 'stay' ? 'bg-amber-100 text-amber-700' : 
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {row.type === 'stay' ? 'مكوث' : row.type === 'individual' ? 'فردي' : 'فعلية'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <button onClick={() => setStep('upload')} disabled={step === 'upload'} className="px-8 py-4 rounded-[2rem] text-xs font-black text-slate-500 hover:bg-slate-100 transition-all disabled:opacity-50">
            إعادة الرفع
          </button>
          
          <button 
            onClick={handleConfirm}
            disabled={!result || result.stats.lessonsFound === 0}
            className="bg-slate-900 text-white px-10 py-4 rounded-[2rem] font-black text-xs shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed glow-primary"
          >
            <CheckCircle2 size={18} /> اعتماد ودمج البيانات ({result?.stats.lessonsFound || 0})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportExcelModal;
