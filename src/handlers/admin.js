import { config } from "../const/config.js";
import { askOpenAI } from "../services/ai.js";

async function contactsAnswer(ctx) {
  const contacts = (await ctx.storage?.listContacts())?.filter((field) => field.value.trim());

  if (!contacts?.length) {
    return "";
  }

  return contacts.map((field) => `**${field.title}:** ${field.value.trim()}`).join("\n");
}

export async function adminHandler(ctx) {
  ctx.session.waitingForAI = false;
  await ctx.replyWithChatAction("typing");

  try {
    const storedContacts = await contactsAnswer(ctx);
    if (storedContacts) {
      return ctx.replyMD(storedContacts);
    }

    const systemQuery = "номер телефона и контакты администрации";
    const botAnswer = await askOpenAI(systemQuery, await ctx.getKnowledgeContext());

    if (botAnswer === "NOT_FOUND") {
      await ctx.reply(`Номер администрации: ${config.adminNumber}`);
    } else {
      await ctx.replyMD(botAnswer);
    }
  } catch (error) {
    console.error("Error fetching admin contact from FAQ:", error);
    await ctx.reply("Не удалось получить контакты. Попробуйте позже.");
  }
}
