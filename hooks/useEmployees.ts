/**
 * useEmployees Hook - Firebase Firestore
 * Real-time employee data management with Firebase
 */

import { useState, useEffect, useCallback } from 'react';
import { Employee, UserRole } from '../types';
import { employeeService } from '../services/employeeService';
import { useToast } from '../contexts/ToastContext';

interface UseEmployeesOptions {
  realtime?: boolean; // Enable real-time updates
  filterRole?: UserRole | 'all';
  filterStatus?: 'active' | 'inactive' | 'all';
}

interface UseEmployeesReturn {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  // CRUD operations
  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<Employee | null>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<boolean>;
  deleteEmployee: (id: string, soft?: boolean) => Promise<boolean>;
  // Utilities
  getEmployeeById: (id: string) => Employee | undefined;
  getEmployeeByEmail: (email: string) => Employee | undefined;
  refreshEmployees: () => Promise<void>;
  // Migration
  migrateFromSheets: (sheetsEmployees: Employee[]) => Promise<boolean>;
  // Stats
  stats: {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
  };
}

export const useEmployees = (options: UseEmployeesOptions = {}): UseEmployeesReturn => {
  const { realtime = true, filterRole = 'all', filterStatus = 'all' } = options;
  const toast = useToast();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate stats
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    inactive: employees.filter(e => e.status === 'inactive').length,
    byRole: employees.reduce((acc, emp) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {} as Record<UserRole, number>)
  };

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesRole = filterRole === 'all' || emp.role === filterRole;
    const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;
    return matchesRole && matchesStatus;
  });

  // Load employees
  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeeService.getAll();
      setEmployees(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки сотрудников');
      console.error('Error loading employees:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Setup real-time subscription
  useEffect(() => {
    if (realtime) {
      setLoading(true);
      const unsubscribe = employeeService.subscribe((data) => {
        setEmployees(data);
        setLoading(false);
        setError(null);
      });

      return () => unsubscribe();
    } else {
      loadEmployees();
    }
  }, [realtime, loadEmployees]);

  // Add employee
  const addEmployee = useCallback(async (employee: Omit<Employee, 'id'>): Promise<Employee | null> => {
    try {
      // Check for duplicate email
      const existing = await employeeService.getByEmail(employee.email);
      if (existing) {
        toast.error('Сотрудник с таким email уже существует');
        return null;
      }

      const newEmployee = await employeeService.create(employee);
      toast.success('Сотрудник успешно добавлен');
      
      // If not realtime, manually update state
      if (!realtime) {
        setEmployees(prev => [...prev, newEmployee]);
      }
      
      return newEmployee;
    } catch (err: any) {
      toast.error(`Ошибка добавления сотрудника: ${err.message}`);
      return null;
    }
  }, [realtime, toast]);

  // Update employee
  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>): Promise<boolean> => {
    try {
      // If email is being changed, check for duplicates
      if (updates.email) {
        const existing = await employeeService.getByEmail(updates.email);
        if (existing && existing.id !== id) {
          toast.error('Сотрудник с таким email уже существует');
          return false;
        }
      }

      await employeeService.update(id, updates);
      toast.success('Сотрудник успешно обновлён');
      
      // If not realtime, manually update state
      if (!realtime) {
        setEmployees(prev => prev.map(e => 
          e.id === id ? { ...e, ...updates } : e
        ));
      }
      
      return true;
    } catch (err: any) {
      toast.error(`Ошибка обновления сотрудника: ${err.message}`);
      return false;
    }
  }, [realtime, toast]);

  // Delete employee
  const deleteEmployee = useCallback(async (id: string, soft = true): Promise<boolean> => {
    try {
      if (soft) {
        await employeeService.softDelete(id);
        toast.success('Сотрудник деактивирован');
      } else {
        await employeeService.delete(id);
        toast.success('Сотрудник удалён');
      }
      
      // If not realtime, manually update state
      if (!realtime) {
        if (soft) {
          setEmployees(prev => prev.map(e => 
            e.id === id ? { ...e, status: 'inactive', terminationDate: new Date().toISOString().split('T')[0] } : e
          ));
        } else {
          setEmployees(prev => prev.filter(e => e.id !== id));
        }
      }
      
      return true;
    } catch (err: any) {
      toast.error(`Ошибка удаления сотрудника: ${err.message}`);
      return false;
    }
  }, [realtime, toast]);

  // Get employee by ID
  const getEmployeeById = useCallback((id: string): Employee | undefined => {
    return employees.find(e => e.id === id);
  }, [employees]);

  // Get employee by email
  const getEmployeeByEmail = useCallback((email: string): Employee | undefined => {
    return employees.find(e => e.email.toLowerCase() === email.toLowerCase());
  }, [employees]);

  // Migrate from Google Sheets
  const migrateFromSheets = useCallback(async (sheetsEmployees: Employee[]): Promise<boolean> => {
    try {
      if (sheetsEmployees.length === 0) {
        toast.info('Нет сотрудников для миграции');
        return true;
      }

      // Check for existing employees
      const existingEmployees = await employeeService.getAll();
      const existingEmails = new Set(existingEmployees.map(e => e.email.toLowerCase()));

      // Filter out duplicates
      const newEmployees = sheetsEmployees.filter(
        emp => !existingEmails.has(emp.email.toLowerCase())
      );

      if (newEmployees.length === 0) {
        toast.info('Все сотрудники уже перенесены в Firebase');
        return true;
      }

      await employeeService.batchCreate(newEmployees);
      toast.success(`Перенесено ${newEmployees.length} сотрудников в Firebase`);
      
      // Reload if not realtime
      if (!realtime) {
        await loadEmployees();
      }
      
      return true;
    } catch (err: any) {
      toast.error(`Ошибка миграции: ${err.message}`);
      return false;
    }
  }, [realtime, loadEmployees, toast]);

  return {
    employees: filteredEmployees,
    loading,
    error,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeById,
    getEmployeeByEmail,
    refreshEmployees: loadEmployees,
    migrateFromSheets,
    stats
  };
};

export default useEmployees;
