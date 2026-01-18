import { useSchoolData } from '@/hooks/useSchoolData';

export const useClasses = () => {
    const { classes, setClasses } = useSchoolData();
    return { classes, setClasses };
};
