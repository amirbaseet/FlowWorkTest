import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <ToastProvider>
            {children}
        </ToastProvider>
    );
};
