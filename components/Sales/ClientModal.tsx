import React from 'react';
import { User, Phone, Mail, MapPin } from 'lucide-react';
import { Client } from '../../types';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl animate-scale-in">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="text-primary-500" /> Новый клиент
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Имя *</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Введите имя клиента"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                value={clientData.name || ''}
                onChange={e => setClientData({ ...clientData, name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Телефон *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="tel"
                placeholder="+998 XX XXX XX XX"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                value={clientData.phone || ''}
                onChange={e => setClientData({ ...clientData, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="email"
                placeholder="example@email.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                value={clientData.email || ''}
                onChange={e => setClientData({ ...clientData, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Адрес</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Город, улица, дом"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                value={clientData.address || ''}
                onChange={e => setClientData({ ...clientData, address: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Кредитный лимит (USD)</label>
            <input
              type="number"
              placeholder="0"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
              value={clientData.creditLimit || ''}
              onChange={e => setClientData({ ...clientData, creditLimit: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Заметки</label>
            <textarea
              placeholder="Дополнительная информация..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none h-20 resize-none"
              value={clientData.notes || ''}
              onChange={e => setClientData({ ...clientData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium transition-colors"
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


