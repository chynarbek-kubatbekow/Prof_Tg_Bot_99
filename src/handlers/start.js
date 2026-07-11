export async function startHandler(ctx) {
  const welcomeMessage =
    (await ctx.storage?.getSettingValue("welcome_message")) ||
    "Добро пожаловать\n\nЯ - оператор-помощник лицея\n/start - начать работу";

  await ctx.reply(welcomeMessage, { reply_markup: await ctx.getMainKeyboard() });
}
