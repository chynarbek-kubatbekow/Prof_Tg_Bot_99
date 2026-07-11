import http from "node:http";
import { webhookCallback } from "grammy";
import { createBot, startBotPolling } from "./bot.js";
import { config } from "./const/config.js";
import { ExtractNumber } from "./lib/extract-number.js";
import { FAQLoad } from "./lib/faq-load.js";

const allowedUpdates = ["message", "callback_query"];

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendHead(res, statusCode) {
  res.writeHead(statusCode);
  res.end();
}

function buildWebhookEndpoint() {
  return new URL(config.webhookPath, `${config.webhookUrl}/`).toString();
}

function createHealthServer({ bot, mode, webhookHandler }) {
  const startedAt = new Date().toISOString();

  return http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error("HTTP request failed", error);
      if (!res.headersSent) {
        sendJson(res, 500, { status: "error" });
        return;
      }
      if (!res.writableEnded) {
        res.end();
      }
    });
  });

  async function handleRequest(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "HEAD" && (url.pathname === "/" || url.pathname === "/health")) {
      sendHead(res, 200);
      return;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      sendJson(res, 200, {
        status: "ok",
        mode,
        botRunning: bot.isRunning(),
        startedAt,
      });
      return;
    }

    if (url.pathname === config.webhookPath) {
      if (req.method !== "POST" || !webhookHandler) {
        sendJson(res, 405, { status: "method_not_allowed" });
        return;
      }

      await webhookHandler(req, res);
      return;
    }

    sendJson(res, 404, { status: "not_found" });
  }
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function installShutdownHandlers({ bot, server, storage }) {
  let stopping = false;

  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;

    console.log(`Received ${signal}. Shutting down...`);

    const tasks = [closeServer(server), storage.close()];
    if (bot.isRunning()) {
      tasks.push(bot.stop());
    }

    await Promise.allSettled(tasks);
    process.exit(0);
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function startWebhookMode(faqContext, number) {
  const { bot, storage } = await createBot(faqContext, number);
  const webhookHandler = webhookCallback(bot, "http", {
    onTimeout: "return",
    timeoutMilliseconds: 30_000,
    secretToken: config.webhookSecret,
  });
  const server = createHealthServer({ bot, mode: "webhook", webhookHandler });

  await listen(server);

  const webhookEndpoint = buildWebhookEndpoint();
  const webhookOptions = {
    allowed_updates: allowedUpdates,
    ...(config.webhookSecret ? { secret_token: config.webhookSecret } : {}),
  };

  await bot.init();
  await bot.api.setWebhook(webhookEndpoint, webhookOptions);

  installShutdownHandlers({ bot, server, storage });

  console.log(`Web server listening on port ${config.port}`);
  console.log(`Telegram webhook is set to ${webhookEndpoint}`);
  console.log(`Bot Started in webhook mode as @${bot.botInfo.username}`);
}

async function startPollingMode(faqContext, number) {
  const { bot, storage } = await startBotPolling(faqContext, number);

  if (!process.env.PORT) {
    return;
  }

  const server = createHealthServer({ bot, mode: "polling" });
  await listen(server);
  installShutdownHandlers({ bot, server, storage });
  console.log(`Health server listening on port ${config.port}`);
}

async function startProject() {
  try {
    console.log("Start project...");

    const faqContext = await FAQLoad();
    const number = ExtractNumber(faqContext);

    if (config.webhookUrl) {
      await startWebhookMode(faqContext, number);
      return;
    }

    await startPollingMode(faqContext, number);
  } catch (error) {
    console.error("Error: bot not started", error);
    process.exit(1);
  }
}

startProject();
