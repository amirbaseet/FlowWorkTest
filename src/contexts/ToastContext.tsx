import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { ToastMessage } from '@/types';

interface ToastContextType {
  addToast: (message: string, type?: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastMessage['type'] = 'success') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(
      () => setToasts((p) => p.filter((t) => t.id !== id)),
      5000
    );
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 left-4 space-y-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-white font-bold flex items-center gap-3 transform transition-all duration-300 animate-slide-up ${
              t.type === "success" ? "bg-emerald-600" : 
              t.type === "error" ? "bg-rose-600" : 
              t.type === "warning" ? "bg-amber-500" : 
              "bg-blue-600"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle2 size={20} />
            ) : t.type === "error" || t.type === "warning" ? (
              <AlertTriangle size={20} />
            ) : (
                <Info size={20} />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};