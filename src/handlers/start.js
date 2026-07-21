import { resetUserFlow } from "./main-menu.js";

export async function startHandler(ctx) {
  resetUserFlow(ctx);

  const welcomeMessage =
    (await ctx.storage?.getSettingValue("welcome_message")) ||
    "Добро пожаловать\n\nЯ - оператор-помощник лицея\n/start - начать работу";

  await ctx.reply(welcomeMessage, { reply_markup: await ctx.getMainKeyboard() });
}

export async function cancelHandler(ctx) {
  resetUserFlow(ctx);
  await ctx.reply("Заполнение заявки отменено.", {
    reply_markup: await ctx.getMainKeyboard(),
  });
}
