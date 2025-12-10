# ⚡ Быстрое решение ошибки OAuth

## ❌ Ошибка
```
Request had invalid authentication credentials. 
Expected OAuth 2 access token, login cookie or other valid authentication credential.
```

## ✅ Решение (5 минут)

### 1️⃣ Google Cloud Console
Откройте: https://console.cloud.google.com/ → выберите проект **metalmaster-erp**

### 2️⃣ Включите Sheets API
```
APIs & Services → Library → "Google Sheets API" → ENABLE
```

### 3️⃣ Настройте OAuth Consent Screen
```
APIs & Services → OAuth consent screen

1. Заполните:
   - App name: MetalMaster ERP
   - User support email: ваш email
   
2. ⚠️ ВАЖНО - Добавьте Scope:
   → ADD OR REMOVE SCOPES
   → Найдите: "Google Sheets API"
   → Выберите: ".../auth/spreadsheets"
   → UPDATE → SAVE

3. Добавьте Test Users (если режим "Testing"):
   → ADD USERS
   → Введите ваш Google email
   → ADD → SAVE
```

### 4️⃣ Проверьте Credentials
```
APIs & Services → Credentials → [ваш OAuth 2.0 Client ID]

Authorized JavaScript origins:
  http://localhost:5173
  http://localhost:3000

Authorized redirect URIs:
  http://localhost:5173/__/auth/handler
  http://localhost:3000/__/auth/handler

→ SAVE
```

### 5️⃣ Перезапустите вход
```
1. В приложении: Выйдите (Logout)
2. Очистите localStorage (F12 → Console):
   localStorage.clear()
3. Войдите снова через Google
```

---

## 🧪 Проверка (в консоли браузера F12)

### Команда 1: Проверить токен
```javascript
const token = localStorage.getItem('google_access_token');
console.log('Токен:', token ? '✅ Есть' : '❌ Нет');
console.log('Тип:', token?.startsWith('ya29.') ? '✅ OAuth token' : '❌ Неправильный токен');
console.log('Длина:', token?.length);
```

**Должно быть:**
```
Токен: ✅ Есть
Тип: ✅ OAuth token
Длина: 150-250
```

### Команда 2: Тест доступа к Sheets
```javascript
const token = localStorage.getItem('google_access_token');
const spreadsheetId = '1ваш_id_таблицы';

fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(data => {
  if (data.error) {
    console.error('❌ Ошибка:', data.error.message);
  } else {
    console.log('✅ Доступ к Sheets работает!');
  }
});
```

---

## 🔴 Частые ошибки

### "OAuth token не получен"
➡️ Scope не добавлен → вернитесь к шагу 3️⃣

### "Access blocked"
➡️ Не добавлены test users → вернитесь к шагу 3️⃣

### "Токен есть, но Sheets не работает"
➡️ Используется ID token вместо access token → проверьте тип токена (должен начинаться с `ya29.`)

---

## 📞 Логи для диагностики

При успешном входе в консоли должно быть:
```
✅ OAuth access token получен через redirect
```

При ошибке:
```
❌ OAuth access token не получен!
📝 Проверьте настройки OAuth consent screen
```

---

**Полная инструкция:** см. файл `ИНСТРУКЦИЯ-OAuth-Setup.md`





