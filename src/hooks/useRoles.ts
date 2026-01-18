import { useSchoolData } from '@/hooks/useSchoolData';

export const useRoles = () => {
    const { roles, setRoles } = useSchoolData();
    return { roles, setRoles };
};
