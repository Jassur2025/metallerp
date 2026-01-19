import React, { useState, useMemo } from 'react';
import { Employee, UserRole } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Plus, Search, Edit2, Phone, Mail, Briefcase, Calendar, DollarSign, User, Shield, CheckCircle, XCircle, Trash2, Database, RefreshCw, Upload, Cloud } from 'lucide-react';
import { IdGenerator } from '../utils/idGenerator';
import { useEmployees } from '../hooks/useEmployees';


interface StaffProps {
    employees: Employee[]; // From Google Sheets (for migration)
    onSave: (employees: Employee[]) => Promise<void>; // Legacy save
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

// Force rebuild
export const Staff: React.FC<StaffProps> = ({ employees: sheetsEmployees, onSave }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const toast = useToast();
    
    // Firebase real-time hook
    const { 
        employees, 
        loading, 
        error,
        addEmployee, 
        updateEmployee, 
        deleteEmployee,
        refreshEmployees,
        migrateFromSheets,
        stats 
    } = useEmployees({ realtime: true });
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [isMigrating, setIsMigrating] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Employee>>({
        name: '',
        email: '',
        phone: '',
        position: '',
        role: 'sales',
        hireDate: new Date().toISOString().split('T')[0],
        salary: 0,
        commissionRate: 0,
        hasKPI: false,
        status: 'active',
        notes: '',
        terminationDate: ''
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
                commissionRate: 0,
                hasKPI: false,
                status: 'active',
                notes: '',
                terminationDate: ''
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

        if (editingEmployee) {
            // Update existing employee in Firebase
            await updateEmployee(editingEmployee.id, formData);
        } else {
            // Create new employee in Firebase
            await addEmployee(formData as Omit<Employee, 'id'>);
        }

        setIsModalOpen(false);
    };

    const handleDelete = async (employeeId: string) => {
        if (!window.confirm('Вы уверены, что хотите удалить этого сотрудника?')) return;
        
        // Hard delete from Firebase
        await deleteEmployee(employeeId, false);
    };

    const handleMigrateFromSheets = async () => {
        if (sheetsEmployees.length === 0) {
            toast.info('Нет сотрудников в Google Sheets для миграции');
            return;
        }
        
        if (!window.confirm(`Перенести ${sheetsEmployees.length} сотрудников из Google Sheets в Firebase?`)) return;
        
        setIsMigrating(true);
        await migrateFromSheets(sheetsEmployees);
        setIsMigrating(false);
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

    // Show loading state
    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
                    <p className={t.textMuted}>Загрузка сотрудников из Firebase...</p>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className={`text-center ${t.bgCard} p-8 rounded-xl border ${t.border}`}>
                    <Database className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-400 mb-4">{error}</p>
                    <button 
                        onClick={refreshEmployees}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
                    >
                        Попробовать снова
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in pb-24 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                <div>
                    <h2 className={`text-xl sm:text-2xl font-bold ${t.text} flex items-center gap-2`}>
                        <Cloud className="text-purple-400" size={24} />
                        Управление Сотрудниками
                    </h2>
                    <p className={`text-xs sm:text-sm ${t.textMuted} flex items-center gap-2`}>
                        <Database size={14} className="text-emerald-400" />
                        Firebase Database • Real-time синхронизация
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-purple-600/20 text-sm sm:text-base whitespace-nowrap"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Добавить сотрудника</span>
                        <span className="sm:hidden">Добавить</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`${t.textMuted} text-sm`}>Всего сотрудников</p>
                    <p className={`text-2xl font-bold ${t.text} mt-1`}>{stats.total}</p>
                </div>
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`${t.textMuted} text-sm`}>Активных</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.active}</p>
                </div>
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`${t.textMuted} text-sm`}>Неактивных</p>
                    <p className="text-2xl font-bold text-red-400 mt-1">{stats.inactive}</p>
                </div>
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`${t.textMuted} text-sm`}>Администраторов</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{stats.byRole.admin || 0}</p>
                </div>
                <div className={`${t.bgCard} p-4 rounded-xl border ${t.border}`}>
                    <p className={`${t.textMuted} text-sm`}>Продажи</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{stats.byRole.sales || 0}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={20} />
                    <input
                        type="text"
                        placeholder="Поиск по имени, email или должности..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-3 ${t.text} focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none`}
                    />
                </div>
                <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
                    className={`${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
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
                    className={`${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                >
                    <option value="all">Все статусы</option>
                    <option value="active">Активные</option>
                    <option value="inactive">Неактивные</option>
                </select>
            </div>

            {/* Employees Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-4">
                {filteredEmployees.map(employee => (
                    <div key={employee.id} className={`${t.bgCard} rounded-xl border ${t.border} p-5 hover:border-purple-500/50 transition-all shadow-lg`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                    {employee.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className={`font-bold ${t.text} text-lg`}>{employee.name}</h3>
                                    <p className={`${t.textMuted} text-sm`}>{employee.position}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleOpenModal(employee)}
                                    className={`p-2 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-200'} rounded-lg ${t.textMuted} hover:${t.text} transition-colors`}
                                    title="Редактировать"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(employee.id)}
                                    className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                                    title="Удалить"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>


                        <div className="space-y-2 mb-4">
                            <div className={`flex items-center gap-2 text-sm ${t.textMuted}`}>
                                <Mail size={14} />
                                {employee.email}
                            </div>
                            {employee.phone && (
                                <div className={`flex items-center gap-2 text-sm ${t.textMuted}`}>
                                    <Phone size={14} />
                                    {employee.phone}
                                </div>
                            )}
                            <div className={`flex items-center gap-2 text-sm ${t.textMuted}`}>
                                <Calendar size={14} />
                                Принят: {new Date(employee.hireDate).toLocaleDateString('ru-RU')}
                            </div>
                        </div>

                        <div className={`flex items-center justify-between pt-4 border-t ${t.border}`}>
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
                    <div className={`${t.bgCard} rounded-2xl w-full max-w-2xl border ${t.border} shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto`}>
                        <div className={`p-6 border-b ${t.border} sticky top-0 ${t.bgCard} z-10`}>
                            <h3 className={`text-xl font-bold ${t.text}`}>
                                {editingEmployee ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                            </h3>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Имя *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                        placeholder="Иван Иванов"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Email (Gmail) *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                        placeholder="ivan@gmail.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Телефон</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                        placeholder="+998 90 123 45 67"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Должность *</label>
                                    <input
                                        type="text"
                                        value={formData.position}
                                        onChange={e => setFormData({ ...formData, position: e.target.value })}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                        placeholder="Менеджер по продажам"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Роль *</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                    >
                                        <option value="admin">Администратор</option>
                                        <option value="manager">Менеджер</option>
                                        <option value="accountant">Бухгалтер</option>
                                        <option value="sales">Продажи</option>
                                        <option value="warehouse">Склад</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Статус</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                    >
                                        <option value="active">Активен</option>
                                        <option value="inactive">Неактивен</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Дата найма</label>
                                    <input
                                        type="date"
                                        value={formData.hireDate}
                                        onChange={e => setFormData({ ...formData, hireDate: e.target.value })}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Зарплата (USD)</label>
                                    <input
                                        type="number"
                                        value={formData.salary}
                                        onChange={e => setFormData({ ...formData, salary: Number(e.target.value) })}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                    />
                                </div>
                            </div>

                            {/* Termination Date Logic */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 pt-6">
                                    <input
                                        type="checkbox"
                                        id="isTerminated"
                                        checked={!!formData.terminationDate}
                                        onChange={e => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, terminationDate: new Date().toISOString().split('T')[0], status: 'inactive' });
                                            } else {
                                                setFormData({ ...formData, terminationDate: '', status: 'active' });
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    />
                                    <label htmlFor="isTerminated" className={`text-sm font-medium ${t.text}`}>
                                        Сотрудник уволен
                                    </label>
                                </div>
                                {formData.terminationDate && (
                                    <div>
                                        <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Дата увольнения</label>
                                        <input
                                            type="date"
                                            value={formData.terminationDate}
                                            onChange={e => setFormData({ ...formData, terminationDate: e.target.value })}
                                            className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-red-500 outline-none`}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 pt-6">
                                    <input
                                        type="checkbox"
                                        id="hasKPI"
                                        checked={formData.hasKPI || false}
                                        onChange={e => setFormData({ ...formData, hasKPI: e.target.checked })}
                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <label htmlFor="hasKPI" className={`text-sm font-medium ${t.text}`}>
                                        Включить KPI (% от прибыли)
                                    </label>
                                </div>
                                {formData.hasKPI && (
                                    <div>
                                        <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Процент KPI (%)</label>
                                        <input
                                            type="number"
                                            value={formData.commissionRate || 0}
                                            onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                                            className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none`}
                                            placeholder="10"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Заметки</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none`}
                                    placeholder="Дополнительная информация..."
                                />
                            </div>

                            {/* Permissions */}
                            <div className={`border-t ${t.border} pt-4`}>
                                <label className={`block text-sm font-medium ${t.textMuted} mb-3`}>Права доступа (View)</label>
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
                                                : `${t.border} group-hover:border-slate-400`
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
                                            <span className={`text-sm ${formData.permissions?.[module.key as keyof typeof formData.permissions] === true ? t.text : t.textMuted}`}>
                                                {module.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <p className={`text-xs ${t.textMuted} mt-2`}>
                                    * По умолчанию доступ закрыт. Отметьте модули, которые должен видеть сотрудник.
                                </p>
                            </div>
                        </div>

                        {/* Granular Permissions */}
                        <div className={`border-t ${t.border} pt-4 p-6`}>
                            <label className={`block text-sm font-medium ${t.textMuted} mb-3`}>Специальные права (Actions)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { key: 'canViewCostPrice', label: 'Видеть себестоимость (Inventory)' },
                                    { key: 'canProcessReturns', label: 'Оформлять возвраты (Sales)' },
                                    { key: 'canEditProducts', label: 'Редактировать товары (Inventory)' },
                                    { key: 'canDeleteOrders', label: 'Удалять заказы (History)' },
                                    { key: 'canManageUsers', label: 'Управлять сотрудниками (Admin)' }
                                ].map(perm => (
                                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.permissions?.[perm.key as keyof typeof formData.permissions] === true
                                            ? 'bg-amber-600 border-amber-600'
                                            : `${t.border} group-hover:border-slate-400`
                                            }`}>
                                            {formData.permissions?.[perm.key as keyof typeof formData.permissions] === true && (
                                                <CheckCircle size={12} className="text-white" />
                                            )}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={formData.permissions?.[perm.key as keyof typeof formData.permissions] === true}
                                            onChange={(e) => {
                                                const newPermissions: Record<string, boolean> = { ...(formData.permissions || {}) };
                                                newPermissions[perm.key] = e.target.checked;
                                                setFormData({ ...formData, permissions: newPermissions });
                                            }}
                                        />
                                        <span className={`text-sm ${formData.permissions?.[perm.key as keyof typeof formData.permissions] === true ? t.text : t.textMuted}`}>
                                            {perm.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>


                        <div className={`p-6 border-t ${t.border} flex justify-end gap-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'}`}>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className={`px-4 py-2 rounded-lg ${t.textMuted} hover:${t.text} hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} transition-colors`}
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
