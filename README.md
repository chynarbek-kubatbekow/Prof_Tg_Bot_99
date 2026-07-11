# Litsey Main Bot

Короткая инструкция по установке и запуску Telegram-бота.

## 1. Открыть Проект

```powershell
cd "C:\Users\User\Desktop\litsey-main-bot — cloned"
```

## 2. Установить Зависимости

Обычная установка:

```powershell
npm install
```

Строгая установка по `package-lock.json`:

```powershell
npm ci
```

## 3. Настроить `.env`

В корне проекта должен быть файл `.env`.

Минимум для запуска:

```env
BOT_TOKEN=telegram_bot_token
DEEPSEEK_KEY=deepseek_api_key
ADMIN_IDS=123456789,987654321
DATABASE_URL=postgresql_connection_string
```

Для Google Sheets:

```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_SHEET_ID=google_sheet_id
GOOGLE_SHEET_NAME=Sheet1
```

Файл `google-credentials.json` должен лежать в корне проекта.

`ADMIN_IDS` - Telegram ID сотрудников, которым разрешён доступ к панели `/admin`.
Несколько ID можно указывать через запятую, пробел или перенос строки.

`DATABASE_URL` - PostgreSQL/Neon строка подключения. Если переменная задана,
админка хранит заявки, FAQ, направления, контакты, настройки, логи и session-состояние
диалогов в PostgreSQL.

Локальный fallback без PostgreSQL:

```env
DATABASE_PATH=./src/data/bot-admin.sqlite
```

Если `DATABASE_URL` не задан, используется SQLite-файл `src/data/bot-admin.sqlite`.

## 4. Проверить Данные Бота

PDF-данные:

```text
src/data/pl99base.pdf
src/data/pl99docum.pdf
```

Данные с сайта лежат здесь:

```text
src/data/plit99-site-context.txt
```

Данные админки в production хранятся в PostgreSQL/Neon через:

```env
DATABASE_URL=postgresql_connection_string
```

Локальный SQLite fallback:

```text
src/data/bot-admin.sqlite
```

Таблицы создаются автоматически при первом запуске бота.
Текущие шаги пользователя и администратора тоже сохраняются в БД, поэтому заявки
и редактирование в `/admin` не зависят от памяти процесса.

Файлы из `src/data` остаются в репозитории и попадают на Render вместе с кодом.
При старте бот извлекает из них текстовый контекст и сохраняет его в таблицу
`knowledge_sources` в PostgreSQL. DeepSeek получает контекст в таком порядке:

1. свежие данные из админки;
2. база знаний из `src/data`, сохраненная в PostgreSQL;
3. fallback на локально загруженный контекст из файлов.

Админка не редактирует PDF напрямую. Она сохраняет отдельный актуальный слой данных
в PostgreSQL, и этот слой имеет приоритет над PDF/старым контекстом.

Для Render не используй SQLite без persistent disk: локальные файлы могут потеряться
после перезапуска или redeploy. Используй `DATABASE_URL` от Neon/Render Postgres.

PDF и данные сайта используются вместе: старые материалы и новые данные дополняют друг друга.

## 5. Обновить Данные С Сайта

Если сайт изменился, запусти:

```powershell
npm run build:site-context -- "C:\Users\User\Desktop\plit99_improved-2"
```

Команда обновит файл:

```text
src/data/plit99-site-context.txt
```

## 6. Запустить Бота

Обычный запуск:

```powershell
npm start
```

Локально без `WEBHOOK_URL` и `RENDER_EXTERNAL_URL` бот запускается через polling.
На Render Web Service бот автоматически использует webhook через `RENDER_EXTERNAL_URL`.

Запуск напрямую:

```powershell
node src/index.js
```

Запуск для разработки:

```powershell
npm run dev
```

## 7. Админка

Админ открывает панель командой:

```text
/admin
```

В панели можно смотреть заявки, менять их статусы, редактировать информацию бота,
FAQ, контакты, направления обучения и основные тексты/кнопки.

Изменения сразу используются в пользовательской части бота.
Если задан `DATABASE_URL`, они сохраняются в PostgreSQL; иначе используется SQLite fallback.

## 8. Проверки

```powershell
npm run test:admin
npm run test:postgres
node -e "import('./src/lib/faq-load.js').then(async m=>{const t=await m.FAQLoad(); console.log('Context chars:', t.length); console.log('Has site data:', t.includes('Контекст с сайта ПЛИТ №99'));})"
```

`npm run test:postgres` требует заполненный `DATABASE_URL`.

## 9. Render

Проект подготовлен как Render Web Service через `render.yaml`.
Render автоматически дает переменные `PORT` и `RENDER_EXTERNAL_URL`, поэтому
отдельный `WEBHOOK_URL` на Render обычно не нужен.

Build command:

```text
npm ci
```

Start command:

```text
npm start
```

Обязательные Render env vars:

```env
NODE_VERSION=24.15.0
BOT_TOKEN=telegram_bot_token
DEEPSEEK_KEY=deepseek_api_key
DATABASE_URL=postgresql_connection_string
ADMIN_IDS=123456789,987654321
```

Google Sheets env vars опциональны. Если они не заданы, заявки всё равно сохраняются
в PostgreSQL.

Опциональные env vars:

```env
WEBHOOK_URL=https://your-domain.example.com
WEBHOOK_PATH=/telegram/webhook
WEBHOOK_SECRET=long_random_secret
```

`WEBHOOK_URL` нужен только если сервис запускается не на Render или если нужно
принудительно указать публичный адрес. `WEBHOOK_SECRET` повышает защиту webhook,
но для базового запуска не обязателен.

После деплоя проверь в Render:

```text
/health
```

Ответ должен быть JSON со статусом `ok` и режимом `webhook`.

## Частые Ошибки

`Missing required environment variable BOT_TOKEN` - не заполнен `BOT_TOKEN`.

`Missing required environment variable DEEPSEEK_KEY` - не заполнен `DEEPSEEK_KEY`.

`ENOENT ... pl99base.pdf` - нет файла `src/data/pl99base.pdf`.

`ENOENT ... pl99docum.pdf` - нет файла `src/data/pl99docum.pdf`.

`No open ports detected` на Render - сервис создан не как Web Service из нового
`render.yaml` или приложение не получило переменную `PORT`.

`409 Conflict: terminated by other getUpdates request` - где-то еще запущена
копия этого же бота в polling-режиме. Оставь один запущенный экземпляр.
