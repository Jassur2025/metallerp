import React from 'react';
import { Client } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { Plus } from 'lucide-react';

interface ClientFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    formData: Partial<Client>;
    setFormData: (data: Partial<Client>) => void;
    editingClient: Client | null;
    onSave: () => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
    isOpen, onClose, formData, setFormData, editingClient, onSave
}) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${t.bgCard} rounded-2xl w-full max-w-lg border ${t.border} shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col`}>
                <div className={`p-6 border-b ${t.border} flex justify-between items-center flex-shrink-0`}>
                    <h3 className={`text-xl font-bold ${t.text}`}>
                        {editingClient ? 'Редактировать клиента' : 'Новый клиент'}
                    </h3>
                    <button onClick={onClose} className={`${t.textMuted} hover:${t.text}`}>
                        <Plus size={24} className="rotate-45" />
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    {/* Client Type Selector */}
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${t.textMuted}`}>Тип клиента</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: 'individual' })}
                                className={`py-3 rounded-xl text-sm font-bold transition-all border ${formData.type !== 'legal' 
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                                    : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`}`}
                            >
                                👤 Физ. лицо
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: 'legal' })}
                                className={`py-3 rounded-xl text-sm font-bold transition-all border ${formData.type === 'legal' 
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-500' 
                                    : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`}`}
                            >
                                🏢 Юр. лицо
                            </button>
                        </div>
                    </div>

                    {/* Common Fields */}
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${t.textMuted}`}>
                            {formData.type === 'legal' ? 'Контактное лицо *' : 'Имя клиента *'}
                        </label>
                        <input
                            type="text"
                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder={formData.type === 'legal' ? 'ФИО контактного лица' : 'ФИО клиента'}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${t.textMuted}`}>Телефон *</label>
                        <input
                            type="text"
                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+998 XX XXX XX XX"
                        />
                    </div>

                    {/* Legal Entity Fields */}
                    {formData.type === 'legal' && (
                        <div className="space-y-4 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                            <h4 className="text-sm font-bold text-blue-500 flex items-center gap-2">
                                🏢 Реквизиты организации
                            </h4>
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Название организации *</label>
                                <input
                                    type="text"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                    value={formData.companyName || ''}
                                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                    placeholder="ООО, АО, ИП..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className={`text-sm font-medium ${t.textMuted}`}>ИНН</label>
                                    <input
                                        type="text"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                        value={formData.inn || ''}
                                        onChange={e => setFormData({ ...formData, inn: e.target.value })}
                                        placeholder="123456789"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={`text-sm font-medium ${t.textMuted}`}>МФО</label>
                                    <input
                                        type="text"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                        value={formData.mfo || ''}
                                        onChange={e => setFormData({ ...formData, mfo: e.target.value })}
                                        placeholder="00000"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Расчётный счёт</label>
                                <input
                                    type="text"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                    value={formData.bankAccount || ''}
                                    onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                                    placeholder="20208000..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Название банка</label>
                                <input
                                    type="text"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                    value={formData.bankName || ''}
                                    onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                                    placeholder="АКБ Капиталбанк"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Юридический адрес</label>
                                <input
                                    type="text"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                    value={formData.addressLegal || ''}
                                    onChange={e => setFormData({ ...formData, addressLegal: e.target.value })}
                                    placeholder="г. Ташкент, ул..."
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className={`text-sm font-medium ${t.textMuted}`}>Email</label>
                            <input
                                type="email"
                                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className={`text-sm font-medium ${t.textMuted}`}>Кредитный лимит ($)</label>
                            <input
                                type="number"
                                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                value={formData.creditLimit}
                                onChange={e => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${t.textMuted}`}>
                            {formData.type === 'legal' ? 'Фактический адрес' : 'Адрес'}
                        </label>
                        <input
                            type="text"
                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${t.textMuted}`}>Заметки</label>
                        <textarea
                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none h-20 resize-none`}
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                    <button
                        onClick={onSave}
                        className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-primary-600/20 mt-4"
                    >
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};
