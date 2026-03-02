/**
 * Navigation configuration — single source of truth for sidebar items + page titles.
 */
import React from 'react';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Container,
  Landmark,
  Wallet,
  Users,
  FileText,
  UserCircle2,
  BookOpen,
  Book,
  DollarSign,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Ordered list of sidebar navigation items (excluding Settings which is always shown).
 * `key` doubles as the permission module key and activeTab value.
 */
export const navigationItems: NavItem[] = [
  { key: 'dashboard',   label: 'Дашборд',       icon: <LayoutDashboard size={20} /> },
  { key: 'inventory',   label: 'Склад',          icon: <Package size={20} /> },
  { key: 'import',      label: 'Закуп',          icon: <Container size={20} /> },
  { key: 'sales',       label: 'Касса',          icon: <Wallet size={20} /> },
  { key: 'workflow',    label: 'Workflow',        icon: <BookOpen size={20} /> },
  { key: 'reports',     label: 'Отчеты',         icon: <FileText size={20} /> },
  { key: 'crm',         label: 'Клиенты',        icon: <Users size={20} /> },
  { key: 'staff',       label: 'Сотрудники',     icon: <UserCircle2 size={20} /> },
  { key: 'payroll',     label: 'Зарплата',       icon: <DollarSign size={20} /> },
  { key: 'fixedAssets', label: 'Осн. Средства',  icon: <Landmark size={20} /> },
  { key: 'balance',     label: 'Баланс',         icon: <BarChart3 size={20} /> },
  { key: 'journal',     label: 'Журнал',         icon: <Book size={20} /> },
  { key: 'priceList',   label: 'Прайс',          icon: <FileText size={20} /> },
];

/** Maps activeTab → header title shown in the top bar. */
export const headerTitles: Record<string, string> = {
  dashboard:   'Обзор показателей',
  inventory:   'Управление складом',
  import:      'Закуп и Импорт',
  sales:       'Касса и Расходы',
  workflow:    'Workflow заявки',
  reports:     'Финансовые Отчеты',
  crm:         'База Клиентов',
  staff:       'Управление Сотрудниками',
  fixedAssets: 'Основные Средства',
  balance:     'Управленческий Баланс',
  settings:    'Настройки системы',
  journal:     'Журнал событий',
  priceList:   'Прайс-лист',
  payroll:     'Зарплата',
};
