import { useSchoolData } from '@/hooks/useSchoolData';

export const useEmployees = () => {
    const { employees, setEmployees } = useSchoolData();
    return { employees, setEmployees };
};
