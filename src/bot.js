import { Bot, session } from "grammy";
import { config } from "./const/config.js";
import { adminPanelCallbackHandler, adminPanelCommandHandler, adminPanelTextHandler } from "./handlers/admin-panel.js";
import { aiAnswerHandler } from "./handlers/ai-answer.js";
import { mainMenuHandler } from "./handlers/main-menu.js";
import { registerHandler } from "./handlers/register.js";
import { cancelHandler, startHandler } from "./handlers/start.js";
import { unknownMessageHandler } from "./handlers/unknown-message.js";
import { buildMainKeyboard } from "./keyboard.js";
import { createAdminStorage } from "./lib/admin-storage.js";
import { botSessionData } from "./lib/bot-session-data.js";
import { markdown } from "./lib/markdown.js";

function createSessionStorage(storage) {
  return {
    read: (key) => storage.readSession(key),
    write: (key, value) => storage.writeSession(key, value),
    delete: (key) => storage.deleteSession(key),
  };
}

export async function createBot(faqContext, number) {
  const bot = new Bot(config.telegramToken);
  const storage = createAdminStorage();
  await storage.ready;
  await storage.upsertKnowledgeSource({
    key: "src-data-faq-context",
    title: "База знаний из файлов src/data",
    sourceType: "src_data",
    content: faqContext,
  });

  bot.use(
    session({
      initial: botSessionData,
      storage: createSessionStorage(storage),
    }),
  );

  bot.use(markdown());

  bot.use(async (ctx, next) => {
    ctx.faqContext = faqContext;
    ctx.storage = storage;
    ctx.adminNumber = number;
    ctx.getKnowledgeContext = async () => {
      const dynamicContext = await storage.getDynamicKnowledgeContext();
      const storedContext = await storage.getStoredKnowledgeContext();
      return [dynamicContext, storedContext || faqContext].filter(Boolean).join("\n\n");
    };
    ctx.getMainKeyboard = async () => buildMainKeyboard(await storage.getButtonLabels());
    await next();
  });

  bot.command("start", startHandler);
  bot.command("cancel", cancelHandler);
  bot.command("admin", adminPanelCommandHandler);

  bot.on("callback_query:data", adminPanelCallbackHandler);
  bot.on("message:text", adminPanelTextHandler);
  bot.on("message:text", mainMenuHandler);
  bot.on("message:text", registerHandler);
  bot.on("message:text", aiAnswerHandler);
  bot.on("message", unknownMessageHandler);

  return { bot, storage };
}

export async function startBotPolling(faqContext, number) {
  const { bot, storage } = await createBot(faqContext, number);

  await bot.api.deleteWebhook();

  bot
    .start({
      allowed_updates: ["message", "callback_query"],
      onStart: (botInfo) => {
        console.log(`Bot Started in polling mode as @${botInfo.username}`);
      },
    })
    .catch((error) => {
      console.error("Error: bot polling stopped", error);
      process.exit(1);
    });

  return { bot, storage };
}

export async function initBot(faqContext, number) {
  return startBotPolling(faqContext, number);
}
