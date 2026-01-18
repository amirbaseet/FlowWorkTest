import { useContext } from 'react';
import { OperationDataContext } from '@/contexts/OperationDataContext';

export function useLessons() {
    const context = useContext(OperationDataContext);
    if (!context) {
        throw new Error('useLessons must be used within an OperationDataProvider');
    }
    const { lessons, setLessons } = context;
    return { lessons, setLessons };
}
