/**
 * Employee Service - Firebase Firestore
 * Professional database for storing employee data
 */

import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp,
  runTransaction 
} from '../lib/firebase';
import { Employee, UserRole } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { validateEmployee } from '../utils/validation';
import { executeSafeBatch } from '../utils/batchWriter';
import { logger } from '../utils/logger';

// Collection name
const EMPLOYEES_COLLECTION = 'employees';

// Firestore document interface (with Firestore-specific fields)
interface EmployeeDocument {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  position: string;
  role: UserRole;
  hireDate: Timestamp;
  terminationDate?: Timestamp;
  salary?: number;
  commissionRate?: number;
  hasKPI?: boolean;
  status: 'active' | 'inactive';
  notes?: string;
  permissions?: Record<string, boolean>;
  _version?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Convert Firestore document to Employee
const fromFirestore = (doc: import('firebase/firestore').DocumentSnapshot): Employee => {
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    hireDate: data?.hireDate?.toDate?.()?.toISOString?.().split('T')[0] || data?.hireDate,
    terminationDate: data?.terminationDate?.toDate?.()?.toISOString?.().split('T')[0] || data?.terminationDate,
    _version: data?._version || 1,
    updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
  } as Employee;
};

// Convert Employee to Firestore document
const toFirestore = (employee: Employee): Partial<EmployeeDocument> => {
  const { id, ...data } = employee;
  
  const doc: Record<string, unknown> = {
    ...data,
    hireDate: Timestamp.fromDate(new Date(employee.hireDate)),
    updatedAt: Timestamp.now()
  };

  if (employee.terminationDate) {
    doc.terminationDate = Timestamp.fromDate(new Date(employee.terminationDate));
  } else {
    delete doc.terminationDate;
  }

  // Remove undefined values to avoid Firestore errors
  Object.keys(doc).forEach(key => {
    if (doc[key] === undefined) {
      delete doc[key];
    }
  });

  return doc;
};

export const employeeService = {
  /**
   * Get all employees
   */
  async getAll(): Promise<Employee[]> {
    try {
      // Simple query without orderBy to avoid index requirement
      const querySnapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
      const employees = querySnapshot.docs.map(fromFirestore);
      // Sort client-side
      return employees.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error('EmployeeService', 'Error fetching employees:', error);
      throw error;
    }
  },

  /**
   * Get employee by ID
   */
  async getById(id: string): Promise<Employee | null> {
    try {
      const docRef = doc(db, EMPLOYEES_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return fromFirestore(docSnap);
      }
      return null;
    } catch (error) {
      logger.error('EmployeeService', 'Error fetching employee:', error);
      throw error;
    }
  },

  /**
   * Get employee by email
   */
  async getByEmail(email: string): Promise<Employee | null> {
    try {
      const q = query(
        collection(db, EMPLOYEES_COLLECTION), 
        where('email', '==', email.toLowerCase())
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return fromFirestore(querySnapshot.docs[0]);
      }
      return null;
    } catch (error) {
      logger.error('EmployeeService', 'Error fetching employee by email:', error);
      throw error;
    }
  },

  /**
   * Get employees by role
   */
  async getByRole(role: UserRole): Promise<Employee[]> {
    try {
      const q = query(
        collection(db, EMPLOYEES_COLLECTION), 
        where('role', '==', role),
        orderBy('name')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(fromFirestore);
    } catch (error) {
      logger.error('EmployeeService', 'Error fetching employees by role:', error);
      throw error;
    }
  },

  /**
   * Get active employees
   */
  async getActive(): Promise<Employee[]> {
    try {
      const q = query(
        collection(db, EMPLOYEES_COLLECTION), 
        where('status', '==', 'active'),
        orderBy('name')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(fromFirestore);
    } catch (error) {
      logger.error('EmployeeService', 'Error fetching active employees:', error);
      throw error;
    }
  },

  /**
   * Create new employee
   */
  async create(employee: Omit<Employee, 'id'>): Promise<Employee> {
    try {
      const validation = validateEmployee(employee);
      if (!validation.isValid) {
        throw new Error(`Ошибка валидации: ${validation.errors.join(', ')}`);
      }

      const id = IdGenerator.employee();
      const now = Timestamp.now();
      
      const docData = {
        ...toFirestore({ ...employee, id } as Employee),
        createdAt: now,
        _version: 1
      };

      await setDoc(doc(db, EMPLOYEES_COLLECTION, id), docData);
      
      return {
        ...employee,
        id,
        _version: 1,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('EmployeeService', 'Error creating employee:', error);
      throw error;
    }
  },

  /**
   * Update employee
   */
  async update(id: string, updates: Partial<Employee>): Promise<Employee> {
    try {
      // Skip validation for partial updates with only status/system fields
      const hasUserFields = updates.name || updates.email || updates.position || updates.salary !== undefined;
      if (hasUserFields) {
        const validation = validateEmployee(updates);
        if (!validation.isValid) {
          throw new Error(`Ошибка валидации: ${validation.errors.join(', ')}`);
        }
      }

      const docRef = doc(db, EMPLOYEES_COLLECTION, id);

      const result = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        
        if (!docSnap.exists()) {
          throw new Error(`Employee with id ${id} not found`);
        }

        const currentData = fromFirestore(docSnap);
        const newVersion = (currentData._version || 0) + 1;

        const updateData: Record<string, unknown> = {
          ...toFirestore({ ...currentData, ...updates, id } as Employee),
          _version: newVersion,
          updatedAt: Timestamp.now()
        };

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

      transaction.update(docRef, updateData as Record<string, import('firebase/firestore').FieldValue | Partial<unknown> | undefined>);

        return {
          ...currentData,
          ...updates,
          id,
          _version: newVersion,
          updatedAt: new Date().toISOString()
        } as Employee;
      });

      return result;
    } catch (error) {
      logger.error('EmployeeService', 'Error updating employee:', error);
      throw error;
    }
  },

  /**
   * Delete employee (soft delete - set status to inactive)
   */
  async softDelete(id: string): Promise<void> {
    try {
      await this.update(id, { 
        status: 'inactive', 
        terminationDate: new Date().toISOString().split('T')[0] 
      });
    } catch (error) {
      logger.error('EmployeeService', 'Error soft deleting employee:', error);
      throw error;
    }
  },

  /**
   * Hard delete employee (permanently remove)
   */
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
    } catch (error) {
      logger.error('EmployeeService', 'Error deleting employee:', error);
      throw error;
    }
  },

  /**
   * Batch create employees (for migration)
   */
  async batchCreate(employees: Employee[]): Promise<void> {
    try {
      const now = Timestamp.now();

      await executeSafeBatch(employees, { collectionName: EMPLOYEES_COLLECTION }, (employee, batch) => {
        const id = employee.id || IdGenerator.employee();
        const docRef = doc(db, EMPLOYEES_COLLECTION, id);
        batch.set(docRef, {
          ...toFirestore({ ...employee, id }),
          createdAt: now,
          _version: employee._version || 1
        });
      });
    } catch (error) {
      logger.error('EmployeeService', 'Error batch creating employees:', error);
      throw error;
    }
  },

  /**
   * Subscribe to employees changes (real-time updates)
   */
  subscribe(callback: (employees: Employee[]) => void): () => void {
    // Simple collection reference without orderBy
    const collectionRef = collection(db, EMPLOYEES_COLLECTION);
    
    const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
      const employees = snapshot.docs.map(fromFirestore);
      // Sort client-side
      employees.sort((a, b) => a.name.localeCompare(b.name));
      callback(employees);
    }, (error) => {
      logger.error('EmployeeService', 'Error subscribing to employees:', error);
      // Return empty array on error to stop loading
      callback([]);
    });

    return unsubscribe;
  },

  /**
   * Check if employee exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    const employee = await this.getByEmail(email);
    return employee !== null;
  },

  /**
   * Search employees by name
   */
  async searchByName(searchTerm: string): Promise<Employee[]> {
    try {
      // Firestore doesn't support native full-text search
      // Get all and filter client-side for now
      const all = await this.getAll();
      const term = searchTerm.toLowerCase();
      return all.filter(e => 
        e.name.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term) ||
        e.position.toLowerCase().includes(term)
      );
    } catch (error) {
      logger.error('EmployeeService', 'Error searching employees:', error);
      throw error;
    }
  },

  /**
   * Get employee statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
  }> {
    try {
      const employees = await this.getAll();
      
      const stats = {
        total: employees.length,
        active: employees.filter(e => e.status === 'active').length,
        inactive: employees.filter(e => e.status === 'inactive').length,
        byRole: {} as Record<UserRole, number>
      };

      employees.forEach(emp => {
        stats.byRole[emp.role] = (stats.byRole[emp.role] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('EmployeeService', 'Error getting employee stats:', error);
      throw error;
    }
  }
};

export default employeeService;
