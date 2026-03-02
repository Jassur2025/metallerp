import React, { createContext, useContext } from 'react';
import type { Employee } from '../types';
import { SUPER_ADMIN_EMAILS } from '../constants';
import { useAuth } from './AuthContext';

/**
 * Provides the current Employee object (matched by email) to the entire app.
 * Components can call useCurrentEmployee() to get:
 *   - employee: the matched Employee | undefined
 *   - can(permission): check a granular permission key
 *   - isSuperAdmin: whether the user bypasses all checks
 */

interface CurrentEmployeeContextValue {
  employee: Employee | undefined;
  /** Check a granular permission (canViewCostPrice, canViewSalary, etc.).
   *  Admins automatically get true. */
  can: (key: string) => boolean;
  isSuperAdmin: boolean;
}

const Ctx = createContext<CurrentEmployeeContextValue | undefined>(undefined);

export const CurrentEmployeeProvider: React.FC<{
  employee: Employee | undefined;
  children: React.ReactNode;
}> = ({ employee, children }) => {
  const { user } = useAuth();
  const isSuperAdmin = !!(
    user?.email &&
    (SUPER_ADMIN_EMAILS.includes(user.email) || employee?.role === 'admin')
  );

  const can = (key: string): boolean => {
    if (isSuperAdmin) return true;
    if (!employee?.permissions) return false;
    return (employee.permissions as Record<string, boolean>)[key] === true;
  };

  return (
    <Ctx.Provider value={{ employee, can, isSuperAdmin }}>
      {children}
    </Ctx.Provider>
  );
};

export function useCurrentEmployee(): CurrentEmployeeContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useCurrentEmployee must be used within <CurrentEmployeeProvider>');
  }
  return ctx;
}
