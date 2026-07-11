export function ExtractNumber(text) {
  const phoneRegex = /(?:\+7|8)\s?\(?\d{3}\)?[\s.-]?\d{3}-?\d{2}-?\d{2}/;
  const match = text.match(phoneRegex);

  if (match) {
    return match[0];
  }
}
