import assert from "node:assert/strict";

process.env.ADMIN_IDS = "111";

const { createAdminStorage } = await import("../src/lib/admin-storage.js");
const {
  adminPanelCallbackHandler,
  adminPanelCommandHandler,
  adminPanelTextHandler,
} = await import("../src/handlers/admin-panel.js");
const { adminHandler } = await import("../src/handlers/admin.js");
const { registerHandler } = await import("../src/handlers/register.js");
const { startHandler } = await import("../src/handlers/start.js");

delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.GOOGLE_SHEET_ID;
delete process.env.GOOGLE_SHEET_NAME;

function createMockContextFactory(storage) {
  const session = {};
  const events = [];

  function createContext({ fromId = 111, text = null, callbackData = null } = {}) {
    return {
      from: {
        id: fromId,
        first_name: fromId === 111 ? "Админ" : "Гость",
        username: fromId === 111 ? "admin" : "guest",
      },
      session,
      storage,
      message: text ? { text } : undefined,
      callbackQuery: callbackData
        ? {
            data: callbackData,
            message: {
              message_id: 1,
            },
          }
        : undefined,
      api: {
        sendMessage: async (...args) => {
          events.push({ type: "sendMessage", args });
          return {};
        },
      },
      getMainKeyboard: async () => ({ keyboard: "mock" }),
      replyWithChatAction: async (action) => {
        events.push({ type: "chatAction", action });
        return {};
      },
      reply: async (message, extra = {}) => {
        events.push({ type: "reply", message, extra });
        return {};
      },
      replyMD: async (message, extra = {}) => {
        events.push({ type: "replyMD", message, extra });
        return {};
      },
      editMessageText: async (message, extra = {}) => {
        events.push({ type: "edit", message, extra });
        return {};
      },
      answerCallbackQuery: async (extra = {}) => {
        events.push({ type: "answerCallbackQuery", extra });
        return {};
      },
    };
  }

  return {
    session,
    events,
    createContext,
  };
}

async function runCallback(createContext, data) {
  await adminPanelCallbackHandler(createContext({ callbackData: data }), async () => {
    throw new Error(`Callback ${data} was not handled`);
  });
}

async function runText(createContext, text) {
  await adminPanelTextHandler(createContext({ text }), async () => {
    throw new Error(`Text "${text}" was not handled`);
  });
}

async function runRegister(createContext, text) {
  await registerHandler(createContext({ text }), async () => {
    throw new Error(`Register text "${text}" was not handled`);
  });
}

function lastEvent(events, type) {
  return events.filter((event) => event.type === type).at(-1);
}

const storage = createAdminStorage(":memory:");
await storage.ready;
await storage.upsertKnowledgeSource({
  key: "test-src-data",
  title: "Тестовая база src/data",
  sourceType: "src_data",
  content: "Базовый контекст из файлов для теста.",
});
assert.match(await storage.getStoredKnowledgeContext(), /Базовый контекст из файлов/);
await storage.writeSession("test-session", { waitingForName: true, userName: "Тест" });
assert.deepEqual(await storage.readSession("test-session"), {
  waitingForName: true,
  userName: "Тест",
});
await storage.deleteSession("test-session");
assert.equal(await storage.readSession("test-session"), undefined);
const { session, events, createContext } = createMockContextFactory(storage);

await adminPanelCommandHandler(createContext({ fromId: 222 }));
assert.equal(lastEvent(events, "reply").message, "У вас нет доступа к этому разделу");

await adminPanelCommandHandler(createContext());
assert.match(lastEvent(events, "reply").message, /Панель администратора/);

await storage.updateSetting("welcome_message", "Здравствуйте! Это тестовое приветствие.", { id: 111 });
await startHandler(createContext());
assert.match(lastEvent(events, "reply").message, /тестовое приветствие/);

await storage.updateSetting("application_success_text", "Тест: заявка принята.", { id: 111 });
session.waitingForName = true;
await runRegister(createContext, "Петр Петров");
await runRegister(createContext, "+996123456789");
await runRegister(createContext, "Программирование");
await runRegister(createContext, "Хочу консультацию");
const registeredApplication = (await storage.listApplications())[0];
assert.equal(registeredApplication.fullName, "Петр Петров");
assert.equal(registeredApplication.direction, "Программирование");
assert.equal(registeredApplication.comment, "Хочу консультацию");
const notification = events.find((event) => event.type === "sendMessage");
assert.equal(notification.args[0], 111);
assert.match(notification.args[1], /Новая заявка/);
assert.match(notification.args[1], /Петр Петров/);
assert.match(lastEvent(events, "reply").message, /Тест: заявка принята/);

await storage.updateContact("phone", "+996 700 111 222", { id: 111 });
await adminHandler(createContext());
assert.match(lastEvent(events, "replyMD").message, /\+996 700 111 222/);

const application = await storage.createApplication({
  fullName: "Иван Иванов",
  phone: "+996123456789",
  direction: "IT",
  comment: "Хочу поступить",
  username: "@ivan",
  telegramId: "42",
});

await runCallback(createContext, "adm:apps:new");
assert.match(lastEvent(events, "edit").message, /Новые заявки/);
assert.match(lastEvent(events, "edit").message, /Иван Иванов/);

await runCallback(createContext, `adm:status:${application.id}:work`);
assert.equal((await storage.getApplication(application.id)).statusTitle, "В работе");

await runCallback(createContext, "adm:info:edit:documents");
assert.equal(session.adminAction.type, "edit_info");
await runText(createContext, "Документы: паспорт КР или свидетельство о рождении КР.");
assert.match((await storage.getInfoSection("documents")).content, /паспорт КР/);
assert.match(await storage.getDynamicKnowledgeContext(), /паспорт КР/);

await runCallback(createContext, "adm:dir:add");
assert.equal(session.adminAction.type, "direction_add");
await runText(createContext, "Программирование");
await runText(createContext, "2 года");
await runText(createContext, "Обучение разработке ПО");
await runText(createContext, "-");
await runText(createContext, "Работа разработчиком");
assert.equal(session.adminAction.type, "direction_add_confirm");
await runCallback(createContext, "adm:dir:add:save");
const [direction] = await storage.listDirections();
assert.equal(direction.title, "Программирование");
assert.equal(direction.status, "active");
assert.match(await storage.getDynamicKnowledgeContext(), /Программирование/);

await runCallback(createContext, `adm:dir:field:${direction.id}:studyPeriod`);
await runText(createContext, "3 года");
assert.equal((await storage.getDirection(direction.id)).studyPeriod, "3 года");

await runCallback(createContext, `adm:dir:toggle:${direction.id}`);
assert.equal((await storage.getDirection(direction.id)).status, "hidden");

await runCallback(createContext, "adm:faq:add");
assert.equal(session.adminAction.type, "faq_add_question");
await runText(createContext, "Есть ли общежитие?");
assert.equal(session.adminAction.type, "faq_add_answer");
await runText(createContext, "Да, общежитие есть.");
const [faq] = await storage.listFaq();
assert.equal(faq.question, "Есть ли общежитие?");
assert.match(await storage.getDynamicKnowledgeContext(), /общежитие/);

await runCallback(createContext, `adm:faq:edit:${faq.id}`);
await runText(createContext, "Общежитие есть, детали уточняйте в администрации.");
assert.match((await storage.getFaq(faq.id)).answer, /детали уточняйте/);

await runCallback(createContext, "adm:contact:edit:phone");
await runText(createContext, "+996 700 000 000");
assert.equal((await storage.getContact("phone")).value, "+996 700 000 000");
assert.match(await storage.getDynamicKnowledgeContext(), /\+996 700 000 000/);

await runCallback(createContext, "adm:setting:edit:button_ai_helper");
await runText(createContext, "Спросить бота");
assert.equal((await storage.getButtonLabels()).aiHelper, "Спросить бота");

await runCallback(createContext, "adm:logs");
assert.match(lastEvent(events, "edit").message, /Логи изменений/);
assert.ok((await storage.listChangeLogs()).length >= 8);

await runCallback(createContext, `adm:faq:del:${faq.id}`);
assert.equal((await storage.listFaq()).length, 0);

await runCallback(createContext, `adm:dir:del:${direction.id}`);
assert.equal((await storage.listDirections()).length, 0);

await storage.close();

console.log("Admin smoke test passed");
