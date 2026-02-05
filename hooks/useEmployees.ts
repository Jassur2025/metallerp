import { useState, useEffect, useCallback, useMemo } from 'react';
import { Employee } from '../types';
import employeeService from '../services/employeeService'; // Check default export

export function useEmployees(options?: { realtime?: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load & Subscription
  useEffect(() => {
    const unsubscribe = employeeService.subscribe((data) => {
      setEmployees(data);
      setLoading(false);
      setError(null);
    });
    return () => unsubscribe();
  }, []);

  const addEmployee = useCallback(async (employee: Omit<Employee, 'id'>) => {
    try {
      return await employeeService.create(employee);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding employee');
      throw err;
    }
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    try {
      await employeeService.update(id, updates);
      // Local state update is handled by subscription
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating employee');
      throw err;
    }
  }, []);

  const deleteEmployee = useCallback(async (id: string, hardDelete: boolean = false) => {
    try {
      if (hardDelete) {
        await employeeService.delete(id);
      } else {
        await employeeService.softDelete(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting employee');
      throw err;
    }
  }, []);

  const migrateFromSheets = useCallback(async (legacyEmployees: Employee[]) => {
    // Find employees that are NOT in Firebase yet (by ID)
    const currentIds = new Set(employees.map(e => e.id));
    const toMigrate = legacyEmployees.filter(e => !currentIds.has(e.id));

    if (toMigrate.length === 0) return 0;

    await employeeService.batchCreate(toMigrate);
    return toMigrate.length;
  }, [employees]);

  // Calculate stats
  const stats = useMemo(() => {
    const s = {
      total: employees.length,
      active: employees.filter(e => e.status === 'active').length,
      inactive: employees.filter(e => e.status === 'inactive').length,
      byRole: {} as Record<string, number>
    };

    employees.forEach(emp => {
      s.byRole[emp.role] = (s.byRole[emp.role] || 0) + 1;
    });

    return s;
  }, [employees]);

  const refreshEmployees = useCallback(async () => {
    // For realtime, this might just check connection or do nothing
    // We can simulate a reload if needed, but subscription handles updates
    setLoading(true);
    try {
      const data = await employeeService.getAll();
      setEmployees(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    employees,
    loading,
    error,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    migrateFromSheets,
    refreshEmployees,
    stats
  };
}
