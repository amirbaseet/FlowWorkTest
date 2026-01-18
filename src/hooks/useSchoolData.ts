import { useContext } from 'react';
import { SchoolDataContext } from '@/contexts/SchoolDataContext';

export const useSchoolData = () => {
    const context = useContext(SchoolDataContext);
    if (context === undefined) {
        throw new Error('useSchoolData must be used within a SchoolDataProvider');
    }
    return context;
};
