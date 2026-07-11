import dotenv from "dotenv";
import path from "path";

dotenv.config();

function parseAdminIds(value = "") {
  return value
    .split(/[\s,;]+/)
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export const config = {
  telegramToken: process.env.BOT_TOKEN,
  deepseekKey: process.env.DEEPSEEK_KEY,
  aiModel: "deepseek-chat",
  adminNumber: '+996 703 331 895',
  adminIds: parseAdminIds(process.env.ADMIN_IDS),
  databaseUrl: process.env.DATABASE_URL,
  databasePath: process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(process.cwd(), "./src/data/bot-admin.sqlite"),
  pdf: [
    path.join(process.cwd(), "./src/data/admission-passport-rule.pdf"),
    path.join(process.cwd(), "./src/data/pl99base.pdf"),
    path.join(process.cwd(), "./src/data/pl99docum.pdf"),
  ],
  textContext: [
    path.join(process.cwd(), "./src/data/plit99-site-context.txt"),
    path.join(process.cwd(), "./src/data/admission-passport-rule.txt"),
  ],
};
