import React from 'react';
import { User, Phone, Mail, MapPin } from 'lucide-react';
import { Client } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientData: Partial<Client>;
  setClientData: (data: Partial<Client>) => void;
  onSave: () => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  clientData,
  setClientData,
  onSave
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [activeTab, setActiveTab] = React.useState<'individual' | 'legal'>('individual');

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(clientData.type || 'individual');
    }
  }, [isOpen, clientData.type]);

  const handleTabChange = (tab: 'individual' | 'legal') => {
    setActiveTab(tab);
    setClientData({ ...clientData, type: tab });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${t.bgCard} rounded-2xl w-full max-w-lg border ${t.border} shadow-2xl animate-scale-in flex flex-col max-h-[90vh]`}>
        <div className={`p-6 border-b ${t.border} flex justify-between items-center shrink-0`}>
          <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
            <User className="text-primary-500" /> Новый клиент
          </h3>
          <button onClick={onClose} className={`${t.textMuted} hover:${t.text} text-2xl`}>&times;</button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 shrink-0">
          <div className={`flex ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} p-1 rounded-lg border ${t.border}`}>
            <button
              onClick={() => handleTabChange('individual')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'individual' ? 'bg-primary-600 text-white shadow' : `${t.textMuted} hover:${t.text}`}`}
            >
              Физ. лицо
            </button>
            <button
              onClick={() => handleTabChange('legal')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'legal' ? 'bg-primary-600 text-white shadow' : `${t.textMuted} hover:${t.text}`}`}
            >
              Юр. лицо
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Common Fields */}
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Имя / Контактное лицо *</label>
            <div className="relative">
              <User className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
              <input
                type="text"
                placeholder="Имя клиента или контактного лица"
                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                value={clientData.name || ''}
                onChange={e => setClientData({ ...clientData, name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Телефон *</label>
            <div className="relative">
              <Phone className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
              <input
                type="tel"
                placeholder="+998 XX XXX XX XX"
                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                value={clientData.phone || ''}
                onChange={e => setClientData({ ...clientData, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Legal Entity Specific Fields */}
          {activeTab === 'legal' && (
            <>
              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Название Организации *</label>
                <div className="relative">
                  <User className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
                  <input
                    type="text"
                    placeholder="ООО 'Пример'"
                    className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                    value={clientData.companyName || ''}
                    onChange={e => setClientData({ ...clientData, companyName: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>ИНН *</label>
                  <input
                    type="text"
                    placeholder="9 цифр"
                    className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                    value={clientData.inn || ''}
                    onChange={e => setClientData({ ...clientData, inn: e.target.value })}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>МФО</label>
                  <input
                    type="text"
                    placeholder="5 цифр"
                    className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                    value={clientData.mfo || ''}
                    onChange={e => setClientData({ ...clientData, mfo: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Расчетный счет</label>
                <input
                  type="text"
                  placeholder="20 цифр"
                  className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                  value={clientData.bankAccount || ''}
                  onChange={e => setClientData({ ...clientData, bankAccount: e.target.value })}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Название Банка</label>
                <input
                  type="text"
                  placeholder="Например: Ipak Yuli Bank"
                  className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                  value={clientData.bankName || ''}
                  onChange={e => setClientData({ ...clientData, bankName: e.target.value })}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Юридический адрес</label>
                <input
                  type="text"
                  placeholder="Адрес регистрации фирмы"
                  className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                  value={clientData.addressLegal || ''}
                  onChange={e => setClientData({ ...clientData, addressLegal: e.target.value })}
                />
              </div>
            </>
          )}

          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Email</label>
            <div className="relative">
              <Mail className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
              <input
                type="email"
                placeholder="example@email.com"
                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                value={clientData.email || ''}
                onChange={e => setClientData({ ...clientData, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Адрес (Фактический)</label>
            <div className="relative">
              <MapPin className={`absolute left-3 top-2.5 ${t.textMuted}`} size={16} />
              <input
                type="text"
                placeholder="Город, улица, дом"
                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                value={clientData.address || ''}
                onChange={e => setClientData({ ...clientData, address: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Кредитный лимит (USD)</label>
            <input
              type="number"
              placeholder="0"
              className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
              value={clientData.creditLimit || ''}
              onChange={e => setClientData({ ...clientData, creditLimit: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Заметки</label>
            <textarea
              placeholder="Дополнительная информация..."
              className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none h-20 resize-none`}
              value={clientData.notes || ''}
              onChange={e => setClientData({ ...clientData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2 shrink-0">
            <button
              onClick={onClose}
              className={`flex-1 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${t.text} py-3 rounded-xl font-medium transition-colors`}
            >
              Отмена
            </button>
            <button
              onClick={onSave}
              className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-primary-600/20 transition-all"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};







