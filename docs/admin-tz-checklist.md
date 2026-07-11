# Чеклист выполнения ТЗ: Telegram-админка

Дата проверки: 2026-07-11

## Проверки

```powershell
npm run test:admin
npm run test:postgres
Get-ChildItem -Recurse -File src,scripts -Include *.js | ForEach-Object { node --check $_.FullName }
node -e "import('./src/lib/faq-load.js').then(async m=>{const t=await m.FAQLoad(); console.log('Context chars:', t.length); console.log('Has passport rule:', t.includes('Российский паспорт') || t.includes('российским паспортом'));})"
```

## Покрытие требований

| Пункт ТЗ | Реализация | Проверка |
| --- | --- | --- |
| `/admin` | `src/bot.js`, `src/handlers/admin-panel.js` | `npm run test:admin` проверяет вход админа |
| Доступ только по `ADMIN_IDS` | `src/const/config.js`, `src/handlers/admin-panel.js` | smoke-test проверяет отказ неадмину |
| Ответ неадмину | `adminPanelCommandHandler` | smoke-test ожидает `У вас нет доступа к этому разделу` |
| Главное меню админа | `adminMenuKeyboard()` | smoke-test ожидает `Панель администратора` |
| Заявки: уведомление админу | `src/handlers/register.js`, `src/lib/admin-format.js` | smoke-test проходит форму заявки и проверяет `sendMessage` админу |
| Статусы заявок | `APPLICATION_STATUSES` | smoke-test меняет статус на `В работе` |
| Новые заявки | `showApplicationsList(ctx, "new")` | smoke-test открывает `adm:apps:new` |
| Все заявки | `showApplicationsList(ctx)` | storage smoke-test проверяет пагинацию |
| Изменить статус заявки | `adm:status:*` callbacks | smoke-test обновляет статус заявки |
| Информация бота | `info_sections`, `showInfoMenu()` | smoke-test редактирует `documents` |
| Разделы информации | `INFO_SECTIONS` | хранится в SQLite и попадает в dynamic context |
| Редактирование информации | `edit_info` action | smoke-test обновляет документы и проверяет AI-контекст |
| Направления | `directions`, `showDirectionsMenu()` | smoke-test добавляет направление |
| Добавить направление | `direction_add` flow | smoke-test проходит название, срок, описание, требования, возможности, подтверждение |
| Изменить направление | `edit_direction_field` | smoke-test меняет срок обучения |
| Удалить направление | `deleteDirection()` | smoke-test удаляет направление |
| Активно / скрыто | `toggleDirection()` | smoke-test скрывает направление |
| FAQ добавить | `faq_add_question`, `faq_add_answer` | smoke-test добавляет FAQ |
| FAQ изменить | `faq_edit_answer` | smoke-test меняет ответ |
| FAQ удалить | `deleteFaq()` | smoke-test удаляет FAQ |
| FAQ список | `showFaqList()` | smoke-test проверяет запись в storage |
| Контакты | `contacts`, `showContactsMenu()`, `adminHandler()` | smoke-test меняет телефон и проверяет ответ пользователю без AI |
| Поля контактов | `CONTACT_FIELDS` | телефон, WhatsApp, Telegram, адрес, email, график, соцсети |
| Настройки | `settings`, `showSettingsMenu()` | smoke-test меняет кнопку `button_ai_helper` |
| Приветствие | `startHandler()` читает `welcome_message` | smoke-test меняет приветствие и проверяет `/start` |
| Текст после заявки | `registerHandler()` читает `application_success_text` | smoke-test меняет текст и проверяет ответ после заявки |
| Сообщение ошибки | `registerHandler()`, `aiAnswerHandler()` читают `error_message` | кодовая проверка |
| Основные кнопки | `buildMainKeyboard(storage.getButtonLabels())` | smoke-test меняет название кнопки |
| Хранение вне кода | `src/lib/admin-storage.js` | PostgreSQL через `DATABASE_URL`; SQLite только fallback |
| База из `src/data` в БД | `bot.js`, `knowledge_sources` | `npm run test:postgres` проверяет запись/чтение knowledge source |
| Логи изменений | `change_logs`, `showChangeLogs()` | smoke-test открывает `adm:logs` и проверяет записи |
| Ошибка сохранения | `try/catch` в admin/user flows | кодовая проверка: успех пишется только после storage update |
| Навигация | `navKeyboard()` | callback-клавиатуры используют Назад/Главное/Отмена |
| Мгновенное применение | `ctx.getKnowledgeContext()`, `ctx.getMainKeyboard()` | smoke-test проверяет dynamic context и labels |

## Render

Production-хранилище:

```env
DATABASE_URL=postgresql_connection_string
```

Render подготовлен как Background Worker через `render.yaml`.
`npm run test:postgres` проверяет подключение, создание таблиц, запись, чтение и удаление тестовой записи в PostgreSQL/Neon, включая `knowledge_sources`.

SQLite можно использовать локально или на Render только с persistent disk:

```env
DATABASE_PATH=/var/data/bot-admin.sqlite
```
