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
```

Для Google Sheets:

```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_SHEET_ID=google_sheet_id
GOOGLE_SHEET_NAME=Sheet1
```

Файл `google-credentials.json` должен лежать в корне проекта.

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

Запуск напрямую:

```powershell
node src/index.js
```

Запуск для разработки:

```powershell
npm run dev
```

## 7. Быстрая Проверка Контекста

```powershell
node -e "import('./src/lib/faq-load.js').then(async m=>{const t=await m.FAQLoad(); console.log('Context chars:', t.length); console.log('Has site data:', t.includes('Контекст с сайта ПЛИТ №99'));})"
```

## Частые Ошибки

`Missing required environment variable BOT_TOKEN` - не заполнен `BOT_TOKEN`.

`Missing required environment variable DEEPSEEK_KEY` - не заполнен `DEEPSEEK_KEY`.

`ENOENT ... pl99base.pdf` - нет файла `src/data/pl99base.pdf`.

`ENOENT ... pl99docum.pdf` - нет файла `src/data/pl99docum.pdf`.
