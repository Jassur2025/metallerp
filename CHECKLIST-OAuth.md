# ✅ Чеклист: Устранение ошибки OAuth

## ❌ Ошибка
```
Request had invalid authentication credentials. 
Expected OAuth 2 access token
```

---

## 📝 Что делать (по порядку):

### ☐ 1. Google Cloud Console

Откройте: https://console.cloud.google.com/ → проект **metalmaster-erp**

#### ☐ 1.1. Включите Sheets API
```
APIs & Services → Library → "Google Sheets API" → ENABLE
```

#### ☐ 1.2. Настройте OAuth Consent Screen
```
APIs & Services → OAuth consent screen
```

- ☐ App name: MetalMaster ERP
- ☐ User support email: ваш_email
- ☐ **ВАЖНО!** Scopes → ADD OR REMOVE SCOPES
  - ☐ Найдите: "Google Sheets API"
  - ☐ Выберите: ".../auth/spreadsheets"
  - ☐ UPDATE → SAVE
- ☐ Test users → ADD USERS → ваш_email → ADD

#### ☐ 1.3. Проверьте Credentials
```
APIs & Services → Credentials → [OAuth 2.0 Client ID]
```

- ☐ Authorized JavaScript origins:
  ```
  http://localhost:5173
  http://localhost:3000
  ```
- ☐ Authorized redirect URIs:
  ```
  http://localhost:5173/__/auth/handler
  http://localhost:3000/__/auth/handler
  ```
- ☐ SAVE

---

### ☐ 2. Перезапустите вход в приложении

- ☐ Откройте приложение
- ☐ Нажмите Logout (выйдите)
- ☐ Откройте консоль браузера (F12)
- ☐ Очистите localStorage:
  ```javascript
  localStorage.clear()
  ```
- ☐ Войдите заново через Google
- ☐ Дайте разрешение на доступ к Google Sheets

---

### ☐ 3. Проверьте результат

В консоли браузера (F12) должно быть:
```
✅ OAuth access token получен
```

Если НЕТ, проверьте:
```javascript
window.authDiagnostics.logDiagnostics()
```

**Должно быть:**
- ☐ Has token: true
- ☐ Token type: oauth
- ☐ Is valid: true
- ☐ Token prefix: ya29.

---

### ☐ 4. Протестируйте доступ к Sheets

```javascript
window.authDiagnostics.testSheetsAccess('ваш_spreadsheet_id')
```

**Должно быть:**
```
✅ Доступ к Google Sheets работает!
```

---

## 🔴 Если не работает

### Проблема: "OAuth token не получен"
- ☐ Вернитесь к шагу 1.2 - убедитесь, что scope добавлен
- ☐ Выйдите и войдите заново
- ☐ Проверьте, что вы в списке test users

### Проблема: "Token type: id_token"
- ☐ Это Firebase ID token, он НЕ работает с Sheets API
- ☐ Scope не настроен в OAuth consent screen
- ☐ Вернитесь к шагу 1.2

### Проблема: "Access blocked"
- ☐ Добавьте себя в test users (шаг 1.2)
- ☐ Или опубликуйте приложение: OAuth consent screen → PUBLISH APP

---

## 📚 Инструкции

- 📘 **Подробная инструкция:** [ИНСТРУКЦИЯ-OAuth-Setup.md](./ИНСТРУКЦИЯ-OAuth-Setup.md)
- ⚡ **Быстрое решение:** [БЫСТРОЕ-РЕШЕНИЕ-OAuth.md](./БЫСТРОЕ-РЕШЕНИЕ-OAuth.md)
- 📊 **Итоговый отчет:** [OAuth-FIX-SUMMARY.md](./OAuth-FIX-SUMMARY.md)

---

## 🆘 Команды для диагностики

```javascript
// Справка
window.authDiagnostics.showHelp()

// Проверка токена
window.authDiagnostics.logDiagnostics()

// Тест Sheets API
window.authDiagnostics.testSheetsAccess('spreadsheet_id')

// Очистить всё
window.authDiagnostics.clearAuth()
```

---

**После выполнения всех шагов ошибка должна исчезнуть!** ✅


