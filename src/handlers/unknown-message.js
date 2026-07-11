export async function unknownMessageHandler(ctx) {
  await ctx.reply(
    "Пожалуйста, выберите действие на клавиатуре ниже:",
    { reply_markup: await ctx.getMainKeyboard() },
  );
}
