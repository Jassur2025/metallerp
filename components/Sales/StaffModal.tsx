import React from 'react';
import { User, Phone, Mail, Building } from 'lucide-react';
import { Employee } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface StaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    staffData: Partial<Employee>;
    setStaffData: (data: Partial<Employee>) => void;
    onSave: () => void;
}

export const StaffModal: React.FC<StaffModalProps> = ({
    isOpen,
    onClose,
    staffData,
    setStaffData,
    onSave
}) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${t.bgCard} rounded-2xl w-full max-w-md border ${t.border} shadow-2xl animate-scale-in flex flex-col max-h-[90vh]`}>
                <div className={`p-6 border-b ${t.border} flex justify-between items-center shrink-0`}>
                    <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                        <User className="text-primary-500" /> Новый Продавец
                    </h3>
                    <button onClick={onClose} className={`${t.textMuted} hover:${t.text} text-2xl`}>&times;</button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div>
                        <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Ф.И.О. сотрудника *</label>
                        <div className="relative">
                            <User className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
                            <input
                                type="text"
                                placeholder="Имя Фамилия"
                                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                value={staffData.name || ''}
                                onChange={e => setStaffData({ ...staffData, name: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Должность</label>
                        <div className="relative">
                            <Building className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
                            <input
                                type="text"
                                placeholder="Продавец, Менеджер..."
                                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                value={staffData.position || ''}
                                onChange={e => setStaffData({ ...staffData, position: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Email *</label>
                        <div className="relative">
                            <Mail className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
                            <input
                                type="email"
                                placeholder="example@gmail.com"
                                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                value={staffData.email || ''}
                                onChange={e => setStaffData({ ...staffData, email: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Телефон</label>
                        <div className="relative">
                            <Phone className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
                            <input
                                type="text"
                                placeholder="+998 XX XXX XX XX"
                                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                value={staffData.phone || ''}
                                onChange={e => setStaffData({ ...staffData, phone: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className={`p-6 border-t ${t.border} bg-slate-500/5 rounded-b-2xl shrink-0 flex gap-3`}>
                    <button
                        onClick={onClose}
                        className={`flex-1 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${t.text} py-3 rounded-xl font-medium transition-colors`}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!staffData.name?.trim() || !staffData.email?.trim()}
                        className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all"
                    >
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};
