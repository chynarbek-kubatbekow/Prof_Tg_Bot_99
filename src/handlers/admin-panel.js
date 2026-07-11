import { InlineKeyboard } from "grammy";
import { config } from "../const/config.js";
import {
  APPLICATION_STATUSES,
  INFO_SECTIONS,
} from "../lib/admin-storage.js";
import {
  STATUS_CALLBACK_PREFIX,
  applicationStatusKeyboard,
  formatApplication,
  formatDate,
  statusTitle,
} from "../lib/admin-format.js";

const DIRECTION_FIELDS = {
  title: "Название",
  studyPeriod: "Срок обучения",
  description: "Описание",
  requirements: "Требования",
  opportunities: "Возможности после обучения",
};

function isAdmin(ctx) {
  return config.adminIds.includes(ctx.from?.id);
}

function trimText(value = "", maxLength = 52) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function adminMenuKeyboard() {
  return new InlineKeyboard()
    .text("📝 Заявки", "adm:apps")
    .row()
    .text("📚 Информация бота", "adm:info")
    .row()
    .text("📚 Направления", "adm:dirs")
    .row()
    .text("❓ FAQ", "adm:faq")
    .row()
    .text("📞 Контакты", "adm:contacts")
    .row()
    .text("⚙️ Настройки", "adm:settings");
}

function navKeyboard(back = "adm:menu") {
  return new InlineKeyboard()
    .text("⬅️ Назад", back)
    .text("🏠 Главное меню", "adm:menu")
    .row()
    .text("❌ Отмена", "adm:cancel");
}

function viewEditKeyboard(editCallback, back = "adm:menu") {
  return new InlineKeyboard()
    .text("✏️ Изменить", editCallback)
    .row()
    .text("⬅️ Назад", back)
    .text("🏠 Главное меню", "adm:menu")
    .row()
    .text("❌ Отмена", "adm:cancel");
}

function applicationKeyboard(applicationId, back = "adm:apps") {
  const keyboard = applicationStatusKeyboard(applicationId);
  keyboard
    .row()
    .text("⬅️ Назад", back)
    .text("🏠 Главное меню", "adm:menu")
    .row()
    .text("❌ Отмена", "adm:cancel");
  return keyboard;
}

function directionCard(direction) {
  return [
    `Направление #${direction.id}`,
    "",
    `Название: ${direction.title}`,
    `Описание: ${direction.description}`,
    `Срок обучения: ${direction.studyPeriod}`,
    `Требования: ${direction.requirements || "Не указаны"}`,
    `Возможности после обучения: ${direction.opportunities || "Не указаны"}`,
    `Статус: ${direction.status === "active" ? "Активно" : "Скрыто"}`,
    `Обновлено: ${formatDate(direction.updatedAt)}`,
  ].join("\n");
}

function faqCard(item) {
  return [`FAQ #${item.id}`, "", `Вопрос: ${item.question}`, "", `Ответ: ${item.answer}`].join("\n");
}

async function show(ctx, text, keyboard = null) {
  const extra = keyboard ? { reply_markup: keyboard } : {};

  if (ctx.callbackQuery?.message) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (error) {
      const message = String(error.description || error.message);
      if (message.includes("message is not modified")) {
        return null;
      }

      console.error("Admin panel edit error:", error);
    }
  }

  return ctx.reply(text, extra);
}

async function showAdminMenu(ctx) {
  ctx.session.adminAction = null;
  return show(
    ctx,
    ["Панель администратора", "", "Выберите действие:"].join("\n"),
    adminMenuKeyboard(),
  );
}

async function showApplicationsMenu(ctx) {
  return show(
    ctx,
    "Заявки\n\nВыберите действие:",
    new InlineKeyboard()
      .text("Посмотреть новые заявки", "adm:apps:new")
      .row()
      .text("Все заявки", "adm:apps:all")
      .row()
      .text("⬅️ Назад", "adm:menu")
      .text("🏠 Главное меню", "adm:menu")
      .row()
      .text("❌ Отмена", "adm:cancel"),
  );
}

async function showApplicationsList(ctx, status = null, offset = 0) {
  const limit = 10;
  const safeOffset = Math.max(0, Number(offset) || 0);
  const applications = await ctx.storage.listApplications(status, limit, safeOffset);
  const total = await ctx.storage.countApplications(status);
  const title = status === "new" ? "Новые заявки" : "Все заявки";

  if (applications.length === 0) {
    return show(ctx, `${title}\n\nСписок пуст.`, navKeyboard("adm:apps"));
  }

  const page = Math.floor(safeOffset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const lines = applications.map(
    (application) =>
      `#${application.id} | ${application.fullName} | ${application.phone} | ${application.statusTitle}`,
  );
  const keyboard = new InlineKeyboard();
  const statusPart = status || "all";

  applications.forEach((application) => {
    keyboard.text(`#${application.id} ${trimText(application.fullName, 28)}`, `adm:app:${application.id}`).row();
  });

  if (safeOffset > 0) {
    keyboard.text("◀️ Предыдущие", `adm:apps:list:${statusPart}:${Math.max(0, safeOffset - limit)}`);
  }
  if (safeOffset + limit < total) {
    keyboard.text("Следующие ▶️", `adm:apps:list:${statusPart}:${safeOffset + limit}`);
  }
  if (safeOffset > 0 || safeOffset + limit < total) {
    keyboard.row();
  }
  keyboard.text("⬅️ Назад", "adm:apps").text("🏠 Главное меню", "adm:menu").row().text("❌ Отмена", "adm:cancel");

  return show(ctx, [`${title} (${total})`, `Страница ${page}/${pages}`, "", ...lines].join("\n"), keyboard);
}

async function showApplication(ctx, id, back = "adm:apps") {
  const application = await ctx.storage.getApplication(id);
  if (!application) {
    return show(ctx, "Заявка не найдена.", navKeyboard(back));
  }

  return show(ctx, formatApplication(application, "Заявка"), applicationKeyboard(application.id, back));
}

async function updateApplicationStatus(ctx, data) {
  const [, id, status] = data.slice(STATUS_CALLBACK_PREFIX.length).match(/^(\d+):(.+)$/) || [];
  if (!id || !APPLICATION_STATUSES[status]) {
    return ctx.answerCallbackQuery({ text: "Некорректный статус", show_alert: true });
  }

  const application = await ctx.storage.updateApplicationStatus(Number(id), status, ctx.from);
  if (!application) {
    return ctx.answerCallbackQuery({ text: "Заявка не найдена", show_alert: true });
  }

  await show(ctx, formatApplication(application, "Заявка"), applicationKeyboard(application.id));
  return ctx.answerCallbackQuery({ text: `Статус: ${statusTitle(status)}` });
}

async function showInfoMenu(ctx) {
  const keyboard = new InlineKeyboard();
  INFO_SECTIONS.forEach((section) => {
    keyboard.text(section.title, `adm:info:view:${section.key}`).row();
  });
  keyboard.text("⬅️ Назад", "adm:menu").text("🏠 Главное меню", "adm:menu").row().text("❌ Отмена", "adm:cancel");
  return show(ctx, "Информация бота\n\nВыберите раздел:", keyboard);
}

async function showInfoSection(ctx, key) {
  const section = await ctx.storage.getInfoSection(key);
  if (!section) {
    return show(ctx, "Раздел не найден.", navKeyboard("adm:info"));
  }

  const content = section.content.trim() || "Раздел пока пуст. Данные берутся из основной базы знаний.";
  return show(ctx, `${section.title}\n\n${content}`, viewEditKeyboard(`adm:info:edit:${key}`, "adm:info"));
}

async function startInfoEdit(ctx, key) {
  const section = await ctx.storage.getInfoSection(key);
  if (!section) {
    return show(ctx, "Раздел не найден.", navKeyboard("adm:info"));
  }

  ctx.session.adminAction = {
    type: "edit_info",
    key,
  };

  return show(
    ctx,
    `Отправьте новый текст раздела:\n\n${section.title}`,
    navKeyboard(`adm:info:view:${key}`),
  );
}

async function showDirectionsMenu(ctx, back = "adm:menu") {
  return show(
    ctx,
    "Направления обучения\n\nВыберите действие:",
    new InlineKeyboard()
      .text("➕ Добавить направление", "adm:dir:add")
      .row()
      .text("📋 Список направлений", "adm:dir:list")
      .row()
      .text("⬅️ Назад", back)
      .text("🏠 Главное меню", "adm:menu")
      .row()
      .text("❌ Отмена", "adm:cancel"),
  );
}

async function showDirectionsList(ctx) {
  const directions = await ctx.storage.listDirections();
  if (directions.length === 0) {
    return show(ctx, "Направления\n\nСписок пуст.", navKeyboard("adm:dirs"));
  }

  const keyboard = new InlineKeyboard();
  directions.forEach((direction) => {
    const marker = direction.status === "active" ? "🟢" : "⚪";
    keyboard.text(`${marker} ${trimText(direction.title, 34)}`, `adm:dir:view:${direction.id}`).row();
  });
  keyboard.text("⬅️ Назад", "adm:dirs").text("🏠 Главное меню", "adm:menu").row().text("❌ Отмена", "adm:cancel");

  return show(ctx, "Направления\n\nВыберите карточку:", keyboard);
}

async function showDirection(ctx, id) {
  const direction = await ctx.storage.getDirection(id);
  if (!direction) {
    return show(ctx, "Направление не найдено.", navKeyboard("adm:dir:list"));
  }

  const toggleText = direction.status === "active" ? "Скрыть" : "Сделать активным";
  const keyboard = new InlineKeyboard()
    .text("✏️ Название", `adm:dir:field:${id}:title`)
    .row()
    .text("✏️ Срок", `adm:dir:field:${id}:studyPeriod`)
    .row()
    .text("✏️ Описание", `adm:dir:field:${id}:description`)
    .row()
    .text("✏️ Требования", `adm:dir:field:${id}:requirements`)
    .row()
    .text("✏️ Возможности", `adm:dir:field:${id}:opportunities`)
    .row()
    .text(toggleText, `adm:dir:toggle:${id}`)
    .row()
    .text("🗑 Удалить", `adm:dir:del:${id}`)
    .row()
    .text("⬅️ Назад", "adm:dir:list")
    .text("🏠 Главное меню", "adm:menu")
    .row()
    .text("❌ Отмена", "adm:cancel");

  return show(ctx, directionCard(direction), keyboard);
}

async function startDirectionAdd(ctx) {
  ctx.session.adminAction = {
    type: "direction_add",
    step: "title",
    data: {},
  };

  return show(ctx, "Введите название направления:", navKeyboard("adm:dirs"));
}

async function confirmDirectionAdd(ctx) {
  const action = ctx.session.adminAction;
  if (action?.type !== "direction_add_confirm") {
    return show(ctx, "Нет направления для сохранения.", navKeyboard("adm:dirs"));
  }

  const direction = await ctx.storage.createDirection(action.data, ctx.from);
  ctx.session.adminAction = null;
  return show(ctx, `Направление сохранено.\n\n${directionCard(direction)}`, navKeyboard("adm:dir:list"));
}

async function startDirectionFieldEdit(ctx, id, field) {
  const direction = await ctx.storage.getDirection(id);
  if (!direction || !DIRECTION_FIELDS[field]) {
    return show(ctx, "Поле не найдено.", navKeyboard("adm:dir:list"));
  }

  ctx.session.adminAction = {
    type: "edit_direction_field",
    id,
    field,
  };

  return show(
    ctx,
    `Отправьте новое значение поля "${DIRECTION_FIELDS[field]}":\n\n${direction[field] || "Пусто"}`,
    navKeyboard(`adm:dir:view:${id}`),
  );
}

async function toggleDirection(ctx, id) {
  const direction = await ctx.storage.getDirection(id);
  if (!direction) {
    return show(ctx, "Направление не найдено.", navKeyboard("adm:dir:list"));
  }

  const nextStatus = direction.status === "active" ? "hidden" : "active";
  await ctx.storage.updateDirection(id, { status: nextStatus }, ctx.from);
  return showDirection(ctx, id);
}

async function deleteDirection(ctx, id) {
  const deleted = await ctx.storage.deleteDirection(id, ctx.from);
  return show(ctx, deleted ? "Направление удалено." : "Направление не найдено.", navKeyboard("adm:dir:list"));
}

async function showFaqMenu(ctx) {
  return show(
    ctx,
    "FAQ\n\nВыберите действие:",
    new InlineKeyboard()
      .text("➕ Добавить вопрос", "adm:faq:add")
      .row()
      .text("📋 Все вопросы", "adm:faq:list")
      .row()
      .text("⬅️ Назад", "adm:menu")
      .text("🏠 Главное меню", "adm:menu")
      .row()
      .text("❌ Отмена", "adm:cancel"),
  );
}

async function showFaqList(ctx) {
  const items = await ctx.storage.listFaq();
  if (items.length === 0) {
    return show(ctx, "FAQ\n\nСписок пуст.", navKeyboard("adm:faq"));
  }

  const keyboard = new InlineKeyboard();
  items.forEach((item) => {
    keyboard.text(`#${item.id} ${trimText(item.question, 38)}`, `adm:faq:view:${item.id}`).row();
  });
  keyboard.text("⬅️ Назад", "adm:faq").text("🏠 Главное меню", "adm:menu").row().text("❌ Отмена", "adm:cancel");

  return show(ctx, "FAQ\n\nВыберите вопрос:", keyboard);
}

async function showFaqItem(ctx, id) {
  const item = await ctx.storage.getFaq(id);
  if (!item) {
    return show(ctx, "FAQ не найден.", navKeyboard("adm:faq:list"));
  }

  return show(
    ctx,
    faqCard(item),
    new InlineKeyboard()
      .text("✏️ Изменить ответ", `adm:faq:edit:${id}`)
      .row()
      .text("🗑 Удалить вопрос", `adm:faq:del:${id}`)
      .row()
      .text("⬅️ Назад", "adm:faq:list")
      .text("🏠 Главное меню", "adm:menu")
      .row()
      .text("❌ Отмена", "adm:cancel"),
  );
}

async function startFaqAdd(ctx) {
  ctx.session.adminAction = {
    type: "faq_add_question",
    data: {},
  };

  return show(ctx, "Введите вопрос:", navKeyboard("adm:faq"));
}

async function startFaqEdit(ctx, id) {
  const item = await ctx.storage.getFaq(id);
  if (!item) {
    return show(ctx, "FAQ не найден.", navKeyboard("adm:faq:list"));
  }

  ctx.session.adminAction = {
    type: "faq_edit_answer",
    id,
  };

  return show(ctx, `Отправьте новый ответ на вопрос:\n\n${item.question}`, navKeyboard(`adm:faq:view:${id}`));
}

async function deleteFaq(ctx, id) {
  const deleted = await ctx.storage.deleteFaq(id, ctx.from);
  return show(ctx, deleted ? "FAQ удалён." : "FAQ не найден.", navKeyboard("adm:faq:list"));
}

async function showContactsMenu(ctx) {
  const contacts = await ctx.storage.listContacts();
  const keyboard = new InlineKeyboard();
  contacts.forEach((field) => {
    keyboard.text(field.title, `adm:contact:${field.key}`).row();
  });
  keyboard.text("⬅️ Назад", "adm:menu").text("🏠 Главное меню", "adm:menu").row().text("❌ Отмена", "adm:cancel");
  return show(ctx, "Контакты\n\nВыберите поле:", keyboard);
}

async function showContactField(ctx, key) {
  const field = await ctx.storage.getContact(key);
  if (!field) {
    return show(ctx, "Поле не найдено.", navKeyboard("adm:contacts"));
  }

  return show(
    ctx,
    `${field.title}\n\n${field.value || "Пусто"}`,
    viewEditKeyboard(`adm:contact:edit:${key}`, "adm:contacts"),
  );
}

async function startContactEdit(ctx, key) {
  const field = await ctx.storage.getContact(key);
  if (!field) {
    return show(ctx, "Поле не найдено.", navKeyboard("adm:contacts"));
  }

  ctx.session.adminAction = {
    type: "edit_contact",
    key,
  };

  return show(ctx, `Отправьте новое значение поля:\n\n${field.title}`, navKeyboard(`adm:contact:${key}`));
}

async function showSettingsMenu(ctx) {
  const settings = await ctx.storage.listSettings();
  const keyboard = new InlineKeyboard();
  settings.forEach((field) => {
    keyboard.text(field.title, `adm:setting:${field.key}`).row();
  });
  keyboard
    .text("🕘 Логи изменений", "adm:logs")
    .row()
    .text("⬅️ Назад", "adm:menu")
    .text("🏠 Главное меню", "adm:menu")
    .row()
    .text("❌ Отмена", "adm:cancel");
  return show(ctx, "Настройки\n\nВыберите поле:", keyboard);
}

async function showChangeLogs(ctx) {
  const logs = await ctx.storage.listChangeLogs(20);
  if (logs.length === 0) {
    return show(ctx, "Логи изменений\n\nЗаписей пока нет.", navKeyboard("adm:settings"));
  }

  const lines = logs.map((log) =>
    [
      `#${log.id} | ${formatDate(log.createdAt)}`,
      `Админ: ${log.adminName}${log.adminId ? ` (${log.adminId})` : ""}`,
      `${log.action}: ${log.details || log.entityId || log.entity}`,
    ].join("\n"),
  );

  return show(ctx, ["Логи изменений", "", ...lines].join("\n\n"), navKeyboard("adm:settings"));
}

async function showSettingField(ctx, key) {
  const field = await ctx.storage.getSetting(key);
  if (!field) {
    return show(ctx, "Настройка не найдена.", navKeyboard("adm:settings"));
  }

  return show(
    ctx,
    `${field.title}\n\n${field.value || "Пусто"}`,
    viewEditKeyboard(`adm:setting:edit:${key}`, "adm:settings"),
  );
}

async function startSettingEdit(ctx, key) {
  const field = await ctx.storage.getSetting(key);
  if (!field) {
    return show(ctx, "Настройка не найдена.", navKeyboard("adm:settings"));
  }

  ctx.session.adminAction = {
    type: "edit_setting",
    key,
  };

  return show(ctx, `Отправьте новое значение настройки:\n\n${field.title}`, navKeyboard(`adm:setting:${key}`));
}

async function handleDirectionAddText(ctx, action, text) {
  const steps = {
    title: {
      next: "studyPeriod",
      prompt: "Введите срок обучения:",
    },
    studyPeriod: {
      next: "description",
      prompt: "Введите описание направления:",
    },
    description: {
      next: "requirements",
      prompt: "Введите требования или отправьте «-», если требований нет:",
    },
    requirements: {
      next: "opportunities",
      prompt: "Введите возможности после обучения или отправьте «-», если их пока нет:",
    },
  };

  if (["title", "studyPeriod", "description"].includes(action.step) && text === "-") {
    return ctx.reply("Это обязательное поле. Отправьте текстовое значение:", {
      reply_markup: navKeyboard("adm:dirs"),
    });
  }

  const value = text === "-" ? "" : text;
  action.data[action.step] = value;

  if (action.step === "opportunities") {
    const summary = [
      "Проверьте направление:",
      "",
      `Название: ${action.data.title}`,
      `Срок обучения: ${action.data.studyPeriod}`,
      `Описание: ${action.data.description}`,
      `Требования: ${action.data.requirements || "Не указаны"}`,
      `Возможности: ${action.data.opportunities || "Не указаны"}`,
    ].join("\n");

    ctx.session.adminAction = {
      type: "direction_add_confirm",
      data: {
        ...action.data,
        status: "active",
      },
    };

    return ctx.reply(
      summary,
      {
        reply_markup: new InlineKeyboard()
          .text("✅ Подтвердить", "adm:dir:add:save")
          .row()
          .text("⬅️ Назад", "adm:dirs")
          .text("🏠 Главное меню", "adm:menu")
          .row()
          .text("❌ Отмена", "adm:cancel"),
      },
    );
  }

  const currentStep = action.step;
  action.step = steps[currentStep].next;
  ctx.session.adminAction = action;
  return ctx.reply(steps[currentStep].prompt, { reply_markup: navKeyboard("adm:dirs") });
}

export async function adminPanelCommandHandler(ctx) {
  if (!isAdmin(ctx)) {
    return ctx.reply("У вас нет доступа к этому разделу");
  }

  return showAdminMenu(ctx);
}

export async function adminPanelTextHandler(ctx, next) {
  const action = ctx.session.adminAction;
  if (!action) {
    return next();
  }

  if (!isAdmin(ctx)) {
    ctx.session.adminAction = null;
    return ctx.reply("У вас нет доступа к этому разделу");
  }

  const text = ctx.message?.text?.trim();
  if (!text) {
    return ctx.reply("Отправьте текстовое сообщение.");
  }

  if (text === "❌ Отмена") {
    ctx.session.adminAction = null;
    return showAdminMenu(ctx);
  }

  try {
    if (action.type === "edit_info") {
      const section = await ctx.storage.updateInfoSection(action.key, text, ctx.from);
      ctx.session.adminAction = null;
      await ctx.reply("Информация успешно обновлена");
      return showInfoSection(ctx, section.key);
    }

    if (action.type === "edit_contact") {
      const field = await ctx.storage.updateContact(action.key, text, ctx.from);
      ctx.session.adminAction = null;
      await ctx.reply("Контакт успешно обновлён");
      return showContactField(ctx, field.key);
    }

    if (action.type === "edit_setting") {
      const field = await ctx.storage.updateSetting(action.key, text, ctx.from);
      ctx.session.adminAction = null;
      await ctx.reply("Настройка успешно обновлена");
      return showSettingField(ctx, field.key);
    }

    if (action.type === "faq_add_question") {
      ctx.session.adminAction = {
        type: "faq_add_answer",
        data: {
          question: text,
        },
      };
      return ctx.reply("Введите ответ:", { reply_markup: navKeyboard("adm:faq") });
    }

    if (action.type === "faq_add_answer") {
      const item = await ctx.storage.createFaq(action.data.question, text, ctx.from);
      ctx.session.adminAction = null;
      await ctx.reply("FAQ сохранён.");
      return showFaqItem(ctx, item.id);
    }

    if (action.type === "faq_edit_answer") {
      const item = await ctx.storage.updateFaqAnswer(action.id, text, ctx.from);
      ctx.session.adminAction = null;
      if (!item) {
        return ctx.reply("FAQ не найден.");
      }
      await ctx.reply("Ответ успешно обновлён");
      return showFaqItem(ctx, item.id);
    }

    if (action.type === "direction_add") {
      return handleDirectionAddText(ctx, action, text);
    }

    if (action.type === "direction_add_confirm") {
      return ctx.reply("Нажмите «Подтвердить» или «Отмена» под карточкой направления.", {
        reply_markup: navKeyboard("adm:dirs"),
      });
    }

    if (action.type === "edit_direction_field") {
      const direction = await ctx.storage.updateDirection(action.id, { [action.field]: text === "-" ? "" : text }, ctx.from);
      ctx.session.adminAction = null;
      if (!direction) {
        return ctx.reply("Направление не найдено.");
      }
      await ctx.reply("Направление успешно обновлено");
      return showDirection(ctx, direction.id);
    }
  } catch (error) {
    console.error("Admin save error:", error);
    return ctx.reply("Ошибка сохранения. Попробуйте ещё раз.");
  }

  ctx.session.adminAction = null;
  return next();
}

export async function adminPanelCallbackHandler(ctx, next) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("adm:")) {
    return next();
  }

  if (!isAdmin(ctx)) {
    return ctx.answerCallbackQuery({
      text: "У вас нет доступа к этому разделу",
      show_alert: true,
    });
  }

  if (data.startsWith(STATUS_CALLBACK_PREFIX)) {
    return updateApplicationStatus(ctx, data);
  }

  try {
    if (data === "adm:menu") {
      await showAdminMenu(ctx);
    } else if (data === "adm:cancel") {
      ctx.session.adminAction = null;
      await showAdminMenu(ctx);
    } else if (data === "adm:apps") {
      await showApplicationsMenu(ctx);
    } else if (data === "adm:apps:new") {
      await showApplicationsList(ctx, "new");
    } else if (data === "adm:apps:all") {
      await showApplicationsList(ctx);
    } else if (data.startsWith("adm:apps:list:")) {
      const [, , , statusPart, offset] = data.split(":");
      await showApplicationsList(ctx, statusPart === "all" ? null : statusPart, Number(offset));
    } else if (data.startsWith("adm:app:")) {
      await showApplication(ctx, Number(data.split(":")[2]));
    } else if (data === "adm:info") {
      await showInfoMenu(ctx);
    } else if (data.startsWith("adm:info:view:")) {
      const key = data.split(":")[3];
      if (key === "education") {
        await showDirectionsMenu(ctx, "adm:info");
      } else {
        await showInfoSection(ctx, key);
      }
    } else if (data.startsWith("adm:info:edit:")) {
      await startInfoEdit(ctx, data.split(":")[3]);
    } else if (data === "adm:dirs") {
      await showDirectionsMenu(ctx, "adm:menu");
    } else if (data === "adm:dir:add") {
      await startDirectionAdd(ctx);
    } else if (data === "adm:dir:add:save") {
      await confirmDirectionAdd(ctx);
    } else if (data === "adm:dir:list") {
      await showDirectionsList(ctx);
    } else if (data.startsWith("adm:dir:view:")) {
      await showDirection(ctx, Number(data.split(":")[3]));
    } else if (data.startsWith("adm:dir:field:")) {
      const [, , , id, field] = data.split(":");
      await startDirectionFieldEdit(ctx, Number(id), field);
    } else if (data.startsWith("adm:dir:toggle:")) {
      await toggleDirection(ctx, Number(data.split(":")[3]));
    } else if (data.startsWith("adm:dir:del:")) {
      await deleteDirection(ctx, Number(data.split(":")[3]));
    } else if (data === "adm:faq") {
      await showFaqMenu(ctx);
    } else if (data === "adm:faq:add") {
      await startFaqAdd(ctx);
    } else if (data === "adm:faq:list") {
      await showFaqList(ctx);
    } else if (data.startsWith("adm:faq:view:")) {
      await showFaqItem(ctx, Number(data.split(":")[3]));
    } else if (data.startsWith("adm:faq:edit:")) {
      await startFaqEdit(ctx, Number(data.split(":")[3]));
    } else if (data.startsWith("adm:faq:del:")) {
      await deleteFaq(ctx, Number(data.split(":")[3]));
    } else if (data === "adm:contacts") {
      await showContactsMenu(ctx);
    } else if (data.startsWith("adm:contact:edit:")) {
      await startContactEdit(ctx, data.split(":")[3]);
    } else if (data.startsWith("adm:contact:")) {
      await showContactField(ctx, data.split(":")[2]);
    } else if (data === "adm:settings") {
      await showSettingsMenu(ctx);
    } else if (data === "adm:logs") {
      await showChangeLogs(ctx);
    } else if (data.startsWith("adm:setting:edit:")) {
      await startSettingEdit(ctx, data.split(":")[3]);
    } else if (data.startsWith("adm:setting:")) {
      await showSettingField(ctx, data.split(":")[2]);
    } else {
      await ctx.answerCallbackQuery({ text: "Неизвестное действие", show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error("Admin callback error:", error);
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true });
  }
}
