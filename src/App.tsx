import React from 'react';
import { AppProviders } from '@/providers/AppProviders';
import { SchoolDataProvider } from '@/providers/SchoolDataProvider';
import { OperationDataProvider } from '@/providers/OperationDataProvider';
import { AppRouter } from '@/routes/AppRouter';

export default function App() {
  console.log("App Mounting");
  return (
    <AppProviders>
      <SchoolDataProvider>
        <OperationDataProvider>
          <AppRouter />
        </OperationDataProvider>
      </SchoolDataProvider>
    </AppProviders>
  );
}
