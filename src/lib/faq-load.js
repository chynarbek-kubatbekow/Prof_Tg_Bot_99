import fs from "fs";
import { WasmPdfDocument } from "pdf-oxide-wasm/nodejs";
import { config } from "../const/config.js";

export async function FAQLoad() {
  let combinedText = "";

  for (const filePath of config.pdf) {
    try {
      const dataBuffer = fs.readFileSync(filePath);

      const pdfDoc = new WasmPdfDocument(new Uint8Array(dataBuffer));

      const text = pdfDoc.extractAllText();

      combinedText += `\n--- СТАРЫЕ МАТЕРИАЛЫ PDF: ${filePath} ---\n` + text;
      console.log(`Sucess: ${filePath}`);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  }

  for (const filePath of config.textContext || []) {
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: optional text context not found ${filePath}`);
      continue;
    }

    try {
      const text = fs.readFileSync(filePath, "utf8");
      combinedText += `\n--- НОВЫЕ ДАННЫЕ С САЙТА: ${filePath} ---\n` + text;
      console.log(`Sucess: ${filePath}`);
    } catch (error) {
      console.error(`Error reading text context ${filePath}:`, error);
      throw error;
    }
  }
  
  return combinedText;
}
