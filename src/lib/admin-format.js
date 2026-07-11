import { InlineKeyboard } from "grammy";
import { APPLICATION_STATUSES } from "./admin-storage.js";

export const STATUS_CALLBACK_PREFIX = "adm:status:";

export function formatDate(value) {
  if (!value) {
    return "Не указана";
  }

  return new Date(value).toLocaleString("ru-RU", {
    timeZone: "Asia/Bishkek",
  });
}

export function formatApplication(application, title = "Заявка") {
  return [
    `${title} #${application.id}`,
    "",
    `ФИО: ${application.fullName}`,
    `Телефон: ${application.phone}`,
    `Направление: ${application.direction || "Не указано"}`,
    `Комментарий: ${application.comment || "Не указан"}`,
    `Telegram: ${application.username}`,
    `Telegram ID: ${application.telegramId || "Не указан"}`,
    `Статус: ${application.statusTitle}`,
    `Дата: ${formatDate(application.createdAt)}`,
  ].join("\n");
}

export function applicationStatusKeyboard(applicationId) {
  return new InlineKeyboard()
    .text("🟡 Взять в работу", `${STATUS_CALLBACK_PREFIX}${applicationId}:work`)
    .row()
    .text("🟢 Связались", `${STATUS_CALLBACK_PREFIX}${applicationId}:contacted`)
    .row()
    .text("🔴 Не дозвонились", `${STATUS_CALLBACK_PREFIX}${applicationId}:no_answer`)
    .row()
    .text("✅ Завершить", `${STATUS_CALLBACK_PREFIX}${applicationId}:done`);
}

export function statusTitle(statusCode) {
  return APPLICATION_STATUSES[statusCode] || APPLICATION_STATUSES.new;
}
