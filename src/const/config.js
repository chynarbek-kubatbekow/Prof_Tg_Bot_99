import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  telegramToken: process.env.BOT_TOKEN,
  deepseekKey: process.env.DEEPSEEK_KEY,
  aiModel: "deepseek-chat",
  adminNumber: '+996 703 331 895',
  pdf: [
    path.join(process.cwd(), "./src/data/pl99base.pdf"),
    path.join(process.cwd(), "./src/data/pl99docum.pdf"),
  ],
  textContext: [
    path.join(process.cwd(), "./src/data/plit99-site-context.txt"),
  ],
};
