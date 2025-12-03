# Инструкция по деплою на GitHub Pages

## Проблема: Приложение не работает на GitHub Pages

### Основные причины:

1. **Отсутствуют переменные окружения** - Firebase конфигурация не настроена
2. **Неправильный base path** - Пути к ресурсам могут быть неверными
3. **SPA routing** - GitHub Pages не поддерживает client-side routing по умолчанию

## Решение

### Шаг 1: Настройка GitHub Secrets

1. Перейдите в ваш репозиторий на GitHub
2. Откройте **Settings** → **Secrets and variables** → **Actions**
3. Добавьте следующие секреты:

```
VITE_FIREBASE_API_KEY=ваш_api_key
VITE_FIREBASE_AUTH_DOMAIN=ваш_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ваш_project_id
VITE_FIREBASE_STORAGE_BUCKET=ваш_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=ваш_sender_id
VITE_FIREBASE_APP_ID=ваш_app_id
GEMINI_API_KEY=ваш_gemini_key (опционально)
```

### Шаг 2: Включение GitHub Pages

1. Перейдите в **Settings** → **Pages**
2. В разделе **Source** выберите:
   - **Source**: GitHub Actions
3. Сохраните изменения

### Шаг 3: Настройка base path (если нужно)

Если ваш репозиторий не в корне GitHub Pages (например, `username.github.io/repo-name`), нужно настроить base path:

1. Откройте `vite.config.ts`
2. Добавьте `base` в конфигурацию:

```typescript
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/your-repo-name/', // Замените на имя вашего репозитория
      // ... остальная конфигурация
    };
});
```

### Шаг 4: Создание 404.html для SPA routing

GitHub Pages не поддерживает client-side routing. Создайте файл `public/404.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Metal ERP</title>
    <script>
      // Single Page Apps for GitHub Pages
      // https://github.com/rafgraph/spa-github-pages
      var pathSegmentsToKeep = 0;
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body>
  </body>
</html>
```

### Шаг 5: Обновление index.html

Добавьте скрипт для обработки SPA routing в `index.html` перед закрывающим тегом `</body>`:

```html
<script>
  // SPA routing для GitHub Pages
  (function() {
    var pathSegmentsToKeep = 0;
    var l = window.location;
    if (l.search[1] === '/' ) {
      var decoded = l.search.slice(1).split('&').map(function(s) { 
        return s.replace(/~and~/g, '&')
      }).join('?');
      window.history.replaceState(null, null,
          l.pathname.slice(0, -1) + decoded + l.hash
      );
    }
  })();
</script>
```

### Шаг 6: Push изменений

```bash
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
```

### Шаг 7: Проверка деплоя

1. Перейдите в **Actions** в вашем репозитории
2. Дождитесь завершения workflow "Deploy to GitHub Pages"
3. Откройте ваш сайт по адресу: `https://username.github.io/repo-name/`

## Альтернативные решения

### Вариант 1: Использовать Vercel/Netlify

Эти платформы лучше поддерживают SPA и env переменные:

1. **Vercel**: 
   - Подключите репозиторий
   - Добавьте env переменные в настройках проекта
   - Автоматический деплой при push

2. **Netlify**:
   - Подключите репозиторий
   - Добавьте env переменные
   - Настройте build command: `npm run build`
   - Publish directory: `dist`

### Вариант 2: Использовать Firebase Hosting

Если вы уже используете Firebase:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Выберите dist как public directory
firebase deploy
```

## Проверка проблем

### Консоль браузера

Откройте DevTools (F12) и проверьте ошибки:
- `Missing required environment variable` - не настроены Secrets
- `Failed to fetch` - проблемы с CORS или путями
- `404` на ресурсы - неправильный base path

### Network tab

Проверьте, загружаются ли все файлы:
- JS файлы должны загружаться с правильными путями
- CSS файлы должны быть доступны
- API запросы должны работать

## Частые проблемы

1. **Белый экран**: Проверьте консоль на ошибки Firebase
2. **404 на роуты**: Добавьте 404.html для SPA routing
3. **Не загружаются ресурсы**: Проверьте base path в vite.config.ts
4. **Firebase ошибки**: Убедитесь, что Secrets настроены правильно




