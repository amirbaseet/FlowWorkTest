import { useState, useEffect } from 'react';
import { Employee, Role } from '@/types';
import { INITIAL_ROLES } from '@/constants';
import { hashPassword } from '@/utils/security';

export function useAuth(employees: Employee[], roles: Role[]) {
    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('classflow_user');
        if (storedUser) {
            try {
                setCurrentUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user from storage", e);
            }
        }
        setIsAuthChecking(false);
    }, []);

    const login = async (email: string, pass: string): Promise<boolean> => {
        const hashedInput = await hashPassword(pass);

        // 1. Check Super Admin (Hardcoded Hash for Demo: 'password123')
        // Hash for 'password123': "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f" (Example - we rely on consistent hashing)
        // Since we can't pre-calculate the hash with the dynamic salt here in code easily without running it, 
        // we will verify by hashing the known admin password live.
        const adminPassHash = await hashPassword('password123');

        if (email === 'admin@school.edu' && hashedInput === adminPassHash) {
            const principalRole = roles.find(r => r.id === 'principal');
            const admin: Employee = {
                id: 999,
                name: 'مدير النظام',
                nationalId: '000',
                baseRoleId: 'principal',
                contractedHours: principalRole?.defaultHours || 40,
                workload: principalRole?.workloadDetails || { actual: 4, individual: 0, stay: 36 },
                addons: { educator: false, coordinators: [] },
                constraints: { cannotCoverAlone: false, isExternal: false },
                subjects: ['إدارة']
            };
            setCurrentUser(admin);
            localStorage.setItem('classflow_user', JSON.stringify(admin));
            return true;
        }

        // 2. Check Employee Database
        const inputId = email.includes('@') ? email.split('@')[0] : email;
        const employee = employees.find(e => e.nationalId === inputId);

        // For employees, we assume their ID is their password.
        // We verify this by hashing the ID they provided and comparing it to what the hash of their ID *would* be.
        if (employee) {
            const expectedHash = await hashPassword(employee.nationalId);
            if (hashedInput === expectedHash) {
                setCurrentUser(employee);
                localStorage.setItem('classflow_user', JSON.stringify(employee));
                return true;
            }
        }

        return false;
    };

    const logout = () => {
        localStorage.removeItem('classflow_user');
        setCurrentUser(null);
    };

    // NEW: Permission Check
    const hasPermission = (permission: string): boolean => {
        if (!currentUser) return false;

        // 1. Resolve User Role
        const userRole = roles.find(r => r.id === currentUser.baseRoleId);
        if (!userRole) return false;

        // 2. Check Permissions
        // Admin gets everything (simplification)
        if (currentUser.baseRoleId === 'principal' || currentUser.baseRoleId === 'sys_admin') return true;

        return userRole.permissions.includes(permission as any);
    };

    const hasRole = (roleId: string): boolean => {
        return currentUser?.baseRoleId === roleId;
    };

    return { currentUser, isAuthChecking, login, logout, setCurrentUser, hasPermission, hasRole };
}
