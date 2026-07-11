import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const defaultSiteRoot = "C:\\Users\\User\\Desktop\\plit99_improved-2";
const siteRoot = process.argv[2] || process.env.PLIT99_SITE_ROOT || defaultSiteRoot;
const templatesRoot = path.join(siteRoot, "core", "templates", "core");
const outputPath = path.join(projectRoot, "src", "data", "plit99-site-context.txt");

const pages = [
  ["index.html", "Главная"],
  ["about.html", "О лицее"],
  ["education.html", "Обучение"],
  ["admission.html", "Поступление"],
  ["results.html", "Результаты и возможности"],
  ["contacts.html", "Контакты"],
];

function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    gt: ">",
    lt: "<",
    quot: "\"",
    apos: "'",
    nbsp: " ",
    mdash: "-",
    ndash: "-",
    raquo: "\"",
    laquo: "\"",
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const radix = entity[1]?.toLowerCase() === "x" ? 16 : 10;
      const number = Number.parseInt(entity.slice(radix === 16 ? 2 : 1), radix);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }

    return named[entity] ?? match;
  });
}

function htmlToLines(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "\n")
    .replace(/{#.*?#}/gs, "\n")
    .replace(/{%[\s\S]*?%}/g, "\n")
    .replace(/{{[\s\S]*?}}/g, "\n")
    .replace(/<\/(h[1-6]|p|div|li|article|section|td|th|tr|button|a)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const seen = new Set();

  return decodeHtmlEntities(cleaned)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 2)
    .filter((line) => !/^(active|MAP|TIME|ADM|DOC|IT|ENG)$/i.test(line))
    .filter((line) => !/^[a-z0-9_-]+$/i.test(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function readPage(fileName, title) {
  const filePath = path.join(templatesRoot, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template not found: ${filePath}`);
  }

  const html = fs.readFileSync(filePath, "utf8");
  const lines = htmlToLines(html);

  return [`## ${title}`, ...lines].join("\n");
}

const generatedAt = new Date().toISOString();
const sections = pages.map(([fileName, title]) => readPage(fileName, title));
const manualCorrections = [
  "## Актуальное уточнение для ответов бота",
  "Проверено 2026-07-08 по официальной странице поступления pl99.kg/admission/. Жесткое контекстное правило: в ПЛИТ №99 может поступить только абитуриент с паспортом Кыргызской Республики. Если спрашивают о поступлении с российским паспортом, паспортом РФ, казахстанским паспортом или любым другим иностранным паспортом, не подтверждай такую возможность. Без паспорта Кыргызской Республики возможность поступления не подтверждается; детали можно уточнить у приёмной комиссии.",
].join("\n");
const content = [
  "# Контекст с сайта ПЛИТ №99",
  `Источник: ${siteRoot}`,
  `Сгенерировано: ${generatedAt}`,
  "",
  manualCorrections,
  "",
  ...sections,
  "",
].join("\n\n");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, content, "utf8");

console.log(`Site context written: ${outputPath}`);
console.log(`Characters: ${content.length}`);
