
import React, { useState } from 'react';
import { Lock, Mail, Loader2, AlertCircle, Info } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, pass: string) => Promise<boolean>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setIsLoading(true);
    
    // Simulate network delay for better UX feel
    setTimeout(async () => {
      try {
        const success = await onLogin(email, password);
        if (!success) {
          setError('بيانات الدخول غير صحيحة أو الحساب غير فعال');
          setIsLoading(false);
        }
        // If success, App.tsx handles the unmounting/redirection
      } catch (err) {
        setError('حدث خطأ في النظام، يرجى المحاولة لاحقاً');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden" dir="rtl">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-900 to-slate-900 z-0"></div>
      <div className="absolute top-0 left-0 w-full h-full opacity-10 z-0 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
          
          {/* Header */}
          <div className="pt-10 pb-6 px-8 text-center bg-white">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6">
              <Lock className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2 font-sans">
              class flow<span className="text-indigo-600">.ai</span>
            </h1>
            <p className="text-slate-500 text-sm font-bold">
              نظام إدارة الغياب والتغطية والعدالة المدرسية
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-3 rounded-xl text-xs font-bold border border-rose-100 animate-slide-up">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block mr-1" htmlFor="email">
                البريد الإلكتروني / رقم الهوية
              </label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  id="email"
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl py-3.5 pr-12 pl-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400"
                  placeholder="رقم الهوية"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block mr-1" htmlFor="password">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  id="password"
                  type="password"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl py-3.5 pr-12 pl-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 font-sans"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-xl hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>

          {/* Teacher Login Hint */}
          <div className="bg-indigo-50 p-4 border-t border-indigo-100 flex items-start gap-3">
             <Info size={18} className="text-indigo-600 mt-0.5 shrink-0" />
             <div className="text-xs font-bold text-indigo-800 leading-relaxed">
                <span className="block font-black mb-1">دخول المعلمين والطاقم:</span>
                استخدم رقم الهوية في خانة البريد الإلكتروني، ورقم الهوية ككلمة مرور افتراضية (ما لم يتم تغييرها).
             </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold">
              جميع الحقوق محفوظة © {new Date().getFullYear()} Class Flow Enterprise
            </p>
          </div>
        </div>
        
        <div className="text-center mt-8">
           <p className="text-slate-400 text-xs">للتجربة (مدير): admin@school.edu / password123</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
