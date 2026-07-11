import { config } from "../const/config.js";
import { askOpenAI } from "../services/ai.js";

export async function aiAnswerHandler(ctx, next) {
  const userQuestion = ctx.message?.text;

  if (!userQuestion) {
    return next();
  }

  if (!ctx.session.waitingForAI) {
    return next();
  }

  await ctx.replyWithChatAction("typing");
  try {
    const botAnswer = await askOpenAI(userQuestion, await ctx.getKnowledgeContext());
    if (botAnswer === "NOT_FOUND") {
      await ctx.reply(
        `К сожалению, я не нашёл ответ на этот вопрос. Пожалуйста, обратитесь в администрацию по телефону: ${config.adminNumber}`,
      );
    } else {
      await ctx.replyMD(botAnswer);
    }
  } catch (error) {
    console.error("Error:", error);
    await ctx.reply(
      await ctx.storage.getSettingValue(
        "error_message",
        "Произошла ошибка. Пожалуйста, свяжитесь с администрацией",
      ),
    );
  }
}
