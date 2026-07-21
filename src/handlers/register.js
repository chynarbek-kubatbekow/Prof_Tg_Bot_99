import { config } from "../const/config.js";
import { formatApplication, applicationStatusKeyboard } from "../lib/admin-format.js";
import { appendToSheets } from "../lib/append-to-sheets.js";

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clearRegisterSession(ctx) {
  ctx.session.waitingForName = false;
  ctx.session.waitingForPhone = false;
  ctx.session.waitingForDirection = false;
  ctx.session.waitingForComment = false;
  ctx.session.userName = "";
  ctx.session.userPhone = "";
  ctx.session.userDirection = "";
}

function normalizeKyrgyzPhone(value) {
  const cleanPhone = value.replace(/[\s\-\(\)]/g, "");

  if (cleanPhone.startsWith("+996")) {
    return cleanPhone;
  }

  if (cleanPhone.startsWith("0")) {
    return `+996${cleanPhone.slice(1)}`;
  }

  if (cleanPhone.startsWith("996")) {
    return `+${cleanPhone}`;
  }

  if (/^\d{9}$/.test(cleanPhone)) {
    return `+996${cleanPhone}`;
  }

  return cleanPhone;
}

async function notifyAdmins(ctx, application) {
  if (config.adminIds.length === 0) {
    console.warn("ADMIN_IDS is empty. Application notification skipped.");
    return;
  }

  const text = formatApplication(application, "Новая заявка");
  const results = await Promise.allSettled(
    config.adminIds.map((adminId) =>
      ctx.api.sendMessage(adminId, text, {
        reply_markup: applicationStatusKeyboard(application.id),
      }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Не удалось отправить заявку админу ${config.adminIds[index]}:`, result.reason);
    }
  });
}

export async function registerHandler(ctx, next) {
  if (
    !ctx.session.waitingForName &&
    !ctx.session.waitingForPhone &&
    !ctx.session.waitingForDirection &&
    !ctx.session.waitingForComment
  ) {
    return await next();
  }

  const userText = ctx.message.text?.trim();
  if (!userText) {
    return await ctx.reply("Пожалуйста, отправьте текстовое сообщение.");
  }

  await ctx.replyWithChatAction("typing");

  if (ctx.session.waitingForName) {
    const nameRegex = /^[а-яА-ЯёЁa-zA-Z\-]+\s+[а-яА-ЯёЁa-zA-Z\-\s]+$/;

    if (!nameRegex.test(userText) || userText.length < 5) {
      return await ctx.reply(
        "Некорректный формат ФИО.\n" +
          "Пожалуйста, введите ваши реальные фамилию и имя:",
      );
    }

    ctx.session.userName = userText;
    ctx.session.waitingForName = false;
    ctx.session.waitingForPhone = true;
    return await ctx.reply(
      "Отлично! Теперь введите ваш номер телефона\n\nДля отмены отправьте /cancel или нажмите любую кнопку меню.",
    );
  }

  if (ctx.session.waitingForPhone) {
    const normalizedPhone = normalizeKyrgyzPhone(userText);
    const phoneRegex = /^\+996\d{9}$/;

    if (!phoneRegex.test(normalizedPhone)) {
      return await ctx.reply(
        "Некорректный номер телефона.\n" +
          "Пожалуйста, введите номер в формате: +996123456789",
      );
    }

    ctx.session.userPhone = normalizedPhone;
    ctx.session.waitingForPhone = false;
    ctx.session.waitingForDirection = true;
    return await ctx.reply("Укажите интересующее направление обучения:");
  }

  if (ctx.session.waitingForDirection) {
    if (userText.length < 2) {
      return await ctx.reply("Пожалуйста, укажите направление или отправьте «-», если пока не выбрали.");
    }

    ctx.session.userDirection = userText === "-" ? "" : userText;
    ctx.session.waitingForDirection = false;
    ctx.session.waitingForComment = true;
    return await ctx.reply("Добавьте комментарий к заявке или отправьте «-», если комментария нет:");
  }

  if (ctx.session.waitingForComment) {
    const bookingData = {
      fullName: ctx.session.userName,
      phone: ctx.session.userPhone,
      direction: ctx.session.userDirection,
      comment: userText === "-" ? "" : userText,
      username: ctx.from?.username ? `@${ctx.from.username}` : "Не указан",
      telegramId: ctx.from?.id.toString(),
    };

    try {
      const application = await ctx.storage.createApplication(bookingData);
      await appendToSheets(application);
      await notifyAdmins(ctx, application);
      clearRegisterSession(ctx);

      const successText = await ctx.storage.getSettingValue(
        "application_success_text",
        "Заявка успешно принята и сохранена!",
      );

      return await ctx.reply(
        `${escapeHtml(successText)}\n\n` +
          `<b>ФИО</b>: ${escapeHtml(application.fullName)}\n` +
          `<b>Телефон:</b> ${escapeHtml(application.phone)}\n` +
          `<b>Направление:</b> ${escapeHtml(application.direction || "Не указано")}\n` +
          `<b>Комментарий:</b> ${escapeHtml(application.comment || "Не указан")}`,
        { parse_mode: "HTML", reply_markup: await ctx.getMainKeyboard() },
      );
    } catch (error) {
      console.error("Ошибка сохранения заявки:", error);
      return await ctx.reply(
        await ctx.storage.getSettingValue("error_message", "Ошибка сохранения. Попробуйте ещё раз."),
      );
    }
  }
}
