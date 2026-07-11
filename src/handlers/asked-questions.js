import { askOpenAI } from "../services/ai.js";

export async function askedQuestionsHandler(ctx) {
  ctx.session.waitingForAI = false;
  await ctx.replyWithChatAction("typing");

  try {
    const faqItems = await ctx.storage.listFaq();
    if (faqItems.length > 0) {
      const answer = faqItems
        .map((item, index) => `${index + 1}. **${item.question}**\n${item.answer}`)
        .join("\n\n");
      return ctx.replyMD(answer);
    }

    const systemQuery = "часто задаваемые вопросы";
    const botAnswer = await askOpenAI(systemQuery, await ctx.getKnowledgeContext());

    if (botAnswer === "NOT_FOUND") {
      await ctx.reply("Ответ временно недоступен");
    } else {
      await ctx.replyMD(botAnswer);
    }
  } catch (error) {
    console.error("Error fetching admin contact from FAQ:", error);
    await ctx.reply(
      "Не удалось найти часто задаваемые вопросы. Попробуйте позже.",
    );
  }
}
