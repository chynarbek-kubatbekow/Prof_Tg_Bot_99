import { Keyboard } from "grammy";
import { Hears } from "./const/hears.js";

export const DEFAULT_BUTTON_LABELS = {
  aiHelper: Hears.AI_HELPER,
  adminContact: Hears.ADMIN,
  faq: Hears.ASKED_QUESTIONS,
  register: Hears.REGISTER,
};

export function buildMainKeyboard(labels = DEFAULT_BUTTON_LABELS) {
  return new Keyboard()
    .row()
    .text(labels.aiHelper)
    .text(labels.adminContact)
    .row()
    .text(labels.faq)
    .text(labels.register)
    .resized()
    .persistent();
}

export const keyboard = buildMainKeyboard();
