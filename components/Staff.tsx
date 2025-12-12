import React, { useState, useMemo } from 'react';
import { Employee, UserRole } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search, Edit2, Phone, Mail, Briefcase, Calendar, DollarSign, User, Shield, CheckCircle, XCircle } from 'lucide-react';

interface StaffProps {
    employees: Employee[];
    onSave: (employees: Employee[]) => Promise<void>;
}

const ROLE_COLORS: Record<UserRole, string> = {
    admin: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    manager: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    accountant: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    sales: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    warehouse: 'bg-slate-500/20 text-slate-400 border-slate-500/50'
};

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Администратор',
    manager: 'Менеджер',
    accountant: 'Бухгалтер',
    sales: 'Продажи',
    warehouse: 'Склад'
};

export const Staff: React.FC<StaffProps> = ({ employees, onSave }) => {
    const toast = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Employee>>({
        name: '',
        email: '',
        phone: '',
        position: '',
        role: 'sales',
        hireDate: new Date().toISOString().split('T')[0],
        salary: 0,
        status: 'active',
        notes: ''
    });

    const handleOpenModal = (employee?: Employee) => {
        if (employee) {
            setEditingEmployee(employee);
            setFormData(employee);
        } else {
            setEditingEmployee(null);
            setFormData({
                name: '',
                email: '',
                phone: '',
                position: '',
                role: 'sales',
                hireDate: new Date().toISOString().split('T')[0],
                salary: 0,
                status: 'active',
                notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.email || !formData.position) {
            toast.warning('Имя, Email и Должность обязательны!');
            return;
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email!)) {
            toast.warning('Введите корректный email адрес!');
            return;
        }

        let updatedEmployees: Employee[];
        if (editingEmployee) {
            // Update
            updatedEmployees = employees.map(e =>
                e.id === editingEmployee.id ? { ...e, ...formData } as Employee : e
            );
        } else {
            // Create
            const newEmployee: Employee = {
                id: Date.now().toString(),
                ...formData as Employee
            };
            updatedEmployees = [...employees, newEmployee];
        }

        await onSave(updatedEmployees);
        setIsModalOpen(false);
    };

    // Filter employees
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                emp.position.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = filterRole === 'all' || emp.role === filterRole;
            const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;
            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [employees, searchTerm, filterRole, filterStatus]);

    // Stats
    const stats = useMemo(() => {
        const total = employees.length;
        const active = employees.filter(e => e.status === 'active').length;
        const byRole = employees.reduce((acc, emp) => {
            acc[emp.role] = (acc[emp.role] || 0) + 1;
            return acc;
        }, {} as Record<UserRole, number>);
        return { total, active, byRole };
    }, [employees]);

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in pb-24 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Управление Сотрудниками</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Персонал и распределение ролей</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-purple-600/20 text-sm sm:text-base whitespace-nowrap"
                >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Добавить сотрудника</span>
                    <span className="sm:hidden">Добавить</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-sm">Всего сотрудников</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-sm">Активных</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.active}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-sm">Администраторов</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{stats.byRole.admin || 0}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-slate-400 text-sm">Продажи</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{stats.byRole.sales || 0}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Поиск по имени, email или должности..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                </div>
                <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                    <option value="all">Все роли</option>
                    <option value="admin">Администратор</option>
                    <option value="manager">Менеджер</option>
                    <option value="accountant">Бухгалтер</option>
                    <option value="sales">Продажи</option>
                    <option value="warehouse">Склад</option>
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                    <option value="all">Все статусы</option>
                    <option value="active">Активные</option>
                    <option value="inactive">Неактивные</option>
                </select>
            </div>

            {/* Employees Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-4">
                {filteredEmployees.map(employee => (
                    <div key={employee.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-all shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                    {employee.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">{employee.name}</h3>
                                    <p className="text-slate-400 text-sm">{employee.position}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleOpenModal(employee)}
                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <Edit2 size={16} />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Mail size={14} />
                                {employee.email}
                            </div>
                            {employee.phone && (
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <Phone size={14} />
                                    {employee.phone}
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Calendar size={14} />
                                Принят: {new Date(employee.hireDate).toLocaleDateString('ru-RU')}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[employee.role]}`}>
                                <Shield size={12} className="inline mr-1" />
                                {ROLE_LABELS[employee.role]}
                            </span>
                            <span className={`flex items-center gap-1 text-xs ${employee.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {employee.status === 'active' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                {employee.status === 'active' ? 'Активен' : 'Неактивен'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {filteredEmployees.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    <User size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Сотрудники не найдены</p>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                            <h3 className="text-xl font-bold text-white">
                                {editingEmployee ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                            </h3>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Имя *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="Иван Иванов"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Email (Gmail) *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="ivan@gmail.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Телефон</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="+998 90 123 45 67"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Должность *</label>
                                    <input
                                        type="text"
                                        value={formData.position}
                                        onChange={e => setFormData({ ...formData, position: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="Менеджер по продажам"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Роль *</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="admin">Администратор</option>
                                        <option value="manager">Менеджер</option>
                                        <option value="accountant">Бухгалтер</option>
                                        <option value="sales">Продажи</option>
                                        <option value="warehouse">Склад</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Статус</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="active">Активен</option>
                                        <option value="inactive">Неактивен</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Дата найма</label>
                                    <input
                                        type="date"
                                        value={formData.hireDate}
                                        onChange={e => setFormData({ ...formData, hireDate: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Зарплата (USD)</label>
                                    <input
                                        type="number"
                                        value={formData.salary}
                                        onChange={e => setFormData({ ...formData, salary: Number(e.target.value) })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Заметки</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none"
                                    placeholder="Дополнительная информация..."
                                />
                            </div>

                            {/* Permissions */}
                            <div className="border-t border-slate-700 pt-4">
                                <label className="block text-sm font-medium text-slate-400 mb-3">Права доступа (View)</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {[
                                        { key: 'dashboard', label: 'Дашборд' },
                                        { key: 'inventory', label: 'Склад' },
                                        { key: 'import', label: 'Импорт' },
                                        { key: 'sales', label: 'Касса' },
                                        { key: 'workflow', label: 'Workflow' },
                                        { key: 'reports', label: 'Отчеты' },
                                        { key: 'crm', label: 'Клиенты' },
                                        { key: 'staff', label: 'Сотрудники' },
                                        { key: 'fixedAssets', label: 'Осн. Средства' },
                                        { key: 'balance', label: 'Баланс' },
                                        { key: 'settings', label: 'Настройки' }
                                    ].map(module => (
                                        <label key={module.key} className="flex items-center gap-2 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.permissions?.[module.key as keyof typeof formData.permissions] === true
                                                ? 'bg-purple-600 border-purple-600'
                                                : 'border-slate-600 group-hover:border-slate-500'
                                                }`}>
                                                {formData.permissions?.[module.key as keyof typeof formData.permissions] === true && (
                                                    <CheckCircle size={12} className="text-white" />
                                                )}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={formData.permissions?.[module.key as keyof typeof formData.permissions] === true}
                                                onChange={(e) => {
                                                    const newPermissions: Record<string, boolean> = { ...(formData.permissions || {}) };
                                                    newPermissions[module.key] = e.target.checked;
                                                    setFormData({ ...formData, permissions: newPermissions });
                                                }}
                                            />
                                            <span className={`text-sm ${formData.permissions?.[module.key as keyof typeof formData.permissions] === true ? 'text-white' : 'text-slate-500'}`}>
                                                {module.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    * По умолчанию доступ закрыт. Отметьте модули, которые должен видеть сотрудник.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/50">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors shadow-lg shadow-purple-600/20"
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
