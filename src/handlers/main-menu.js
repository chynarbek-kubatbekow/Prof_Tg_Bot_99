import { adminHandler } from "./admin.js";
import { askedQuestionsHandler } from "./asked-questions.js";

export function resetUserFlow(ctx) {
  ctx.session.waitingForAI = false;
  ctx.session.waitingForName = false;
  ctx.session.waitingForPhone = false;
  ctx.session.waitingForDirection = false;
  ctx.session.waitingForComment = false;
  ctx.session.userName = "";
  ctx.session.userPhone = "";
  ctx.session.userDirection = "";
}

export async function mainMenuHandler(ctx, next) {
  const text = ctx.message?.text;
  if (!text) {
    return next();
  }

  const labels = await ctx.storage.getButtonLabels();

  if (text === labels.aiHelper) {
    resetUserFlow(ctx);
    ctx.session.waitingForAI = true;
    return ctx.reply("Задайте ваш вопрос");
  }

  if (text === labels.adminContact) {
    resetUserFlow(ctx);
    return adminHandler(ctx);
  }

  if (text === labels.faq) {
    resetUserFlow(ctx);
    return askedQuestionsHandler(ctx);
  }

  if (text === labels.register) {
    resetUserFlow(ctx);
    ctx.session.waitingForName = true;
    return ctx.reply(
      "Введите ваше ФИО:\n\nДля отмены отправьте /cancel или нажмите любую кнопку меню.",
    );
  }

  return next();
}
