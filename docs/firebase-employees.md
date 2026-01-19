# 🔥 Firebase Firestore - База данных сотрудников

## Настройка Firebase Firestore

### 1. Перейдите в Firebase Console

1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Выберите ваш проект (тот же, что используется для авторизации)

### 2. Включите Firestore Database

1. В боковом меню выберите **Build** → **Firestore Database**
2. Нажмите **Create database**
3. Выберите режим:
   - **Production mode** (рекомендуется для production)
   - **Test mode** (для разработки, доступ открыт 30 дней)
4. Выберите регион ближайший к вашим пользователям:
   - `europe-west1` (Бельгия) - для СНГ
   - `us-central1` (Айова) - по умолчанию

### 3. Настройте правила безопасности

Перейдите в **Firestore Database** → **Rules** и замените правила на:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Функция проверки авторизации
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Функция проверки email в списке сотрудников
    function isEmployee() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/employees/$(request.auth.token.email));
    }
    
    // Функция проверки роли админа
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/employees/$(request.auth.token.email)).data.role == 'admin';
    }
    
    // Коллекция сотрудников
    match /employees/{employeeId} {
      // Читать могут все авторизованные
      allow read: if isAuthenticated();
      
      // Создавать и удалять могут только админы
      allow create, delete: if isAdmin();
      
      // Редактировать могут админы или сам сотрудник (свой профиль)
      allow update: if isAdmin() || 
        (isAuthenticated() && request.auth.token.email == resource.data.email);
    }
  }
}
```

### 4. Создайте индексы (автоматически)

Firestore автоматически создаст нужные индексы при первых запросах. Если появятся ошибки, перейдите по ссылке в консоли для создания индекса.

## Структура данных

### Коллекция: `employees`

```typescript
{
  id: string;              // Уникальный ID (EMP-XXXXXXXXX)
  name: string;            // ФИО
  email: string;           // Gmail адрес
  phone?: string;          // Телефон
  position: string;        // Должность
  role: UserRole;          // admin | manager | accountant | sales | warehouse
  hireDate: Timestamp;     // Дата найма
  terminationDate?: Timestamp; // Дата увольнения
  salary?: number;         // Зарплата (USD)
  commissionRate?: number; // % KPI
  hasKPI?: boolean;        // Включен KPI
  status: 'active' | 'inactive';
  notes?: string;          // Заметки
  permissions?: {          // Права доступа
    dashboard?: boolean;
    inventory?: boolean;
    sales?: boolean;
    // ...
  };
  _version: number;        // Версия документа
  createdAt: Timestamp;    // Дата создания
  updatedAt: Timestamp;    // Дата обновления
}
```

## Использование в коде

### Сервис сотрудников

```typescript
import { employeeService } from './services/employeeService';

// Получить всех сотрудников
const employees = await employeeService.getAll();

// Получить по email
const employee = await employeeService.getByEmail('user@gmail.com');

// Создать сотрудника
const newEmployee = await employeeService.create({
  name: 'Иван Иванов',
  email: 'ivan@gmail.com',
  position: 'Менеджер',
  role: 'manager',
  hireDate: '2024-01-15',
  status: 'active'
});

// Обновить
await employeeService.update(id, { salary: 1500 });

// Soft delete (деактивация)
await employeeService.softDelete(id);

// Hard delete (полное удаление)
await employeeService.delete(id);
```

### React Hook с real-time обновлениями

```typescript
import { useEmployees } from './hooks/useEmployees';

function MyComponent() {
  const { 
    employees,           // Список сотрудников (real-time)
    loading,             // Состояние загрузки
    error,               // Ошибки
    addEmployee,         // Добавить
    updateEmployee,      // Обновить
    deleteEmployee,      // Удалить
    stats,               // Статистика
    migrateFromSheets    // Миграция из Google Sheets
  } = useEmployees({ realtime: true });

  // ...
}
```

## Миграция из Google Sheets

1. Откройте модуль **Сотрудники** в ERP
2. Нажмите кнопку **Миграция** (если есть сотрудники в Google Sheets)
3. Подтвердите перенос
4. Данные будут скопированы в Firebase (дубликаты пропускаются)

## Преимущества Firebase Firestore

| Функция | Google Sheets | Firebase Firestore |
|---------|---------------|-------------------|
| Real-time обновления | ❌ | ✅ |
| Offline поддержка | ❌ | ✅ |
| Скорость чтения | Медленно | Очень быстро |
| Скорость записи | Медленно | Быстро |
| Лимиты API | 60 req/min | Практически нет |
| Безопасность | Basic | Продвинутая |
| Индексы | Нет | Автоматические |

## Troubleshooting

### Ошибка "Missing or insufficient permissions"

1. Проверьте, что Firestore включен в Firebase Console
2. Проверьте правила безопасности
3. Для разработки установите временные правила:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

### Ошибка "Failed to get document because the client is offline"

Это нормально при первом запуске с включенным offline persistence. Данные будут синхронизированы автоматически.

### Индекс не найден

Если появляется ошибка о необходимости индекса, кликните по ссылке в консоли браузера - она создаст индекс автоматически.

---

✅ **Firebase Firestore успешно интегрирован для хранения данных сотрудников!**
