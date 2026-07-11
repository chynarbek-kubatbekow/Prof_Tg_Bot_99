import { initBot } from "./bot.js";
import { ExtractNumber } from "./lib/extract-number.js";
import { FAQLoad } from "./lib/faq-load.js";

async function startProject() {
  try {
    console.log("Start project...");

    const faqContext = await FAQLoad();
    const number = ExtractNumber(faqContext);

    await initBot(faqContext, number);
  } catch (error) {
    console.error("Error: bot not started", error);
    process.exit(1);
  }
}

startProject();
