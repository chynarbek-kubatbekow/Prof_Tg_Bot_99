function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(text) {
  let result = escapeHtml(text);

  result = result.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code.trim()}</pre>`);

  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

  result = result.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  result = result.replace(/__(.+?)__/g, "<b>$1</b>");

  result = result.replace(/\*(.+?)\*/g, "<i>$1</i>");
  result = result.replace(/(?<!_)_([^_]+)_(?!_)/g, "<i>$1</i>");

  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  result = result.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

  result = result.replace(/^[\-\*]\s+(.+)$/gm, "• $1");

  return result;
}

export function markdown() {
  return async (ctx, next) => {
    ctx.replyMD = async (text, extra = {}) => {
      if (typeof text !== "string" || text.trim().length === 0) {
        console.error("replyMD: получен невалидный текст:", text);
        return await ctx.reply("Произошла ошибка при формировании ответа.");
      }

      const htmlText = markdownToHtml(text);

      try {
        return await ctx.reply(htmlText, {
          parse_mode: "HTML",
          ...extra,
        });
      } catch (error) {
        console.error("HTML parse error:", error);
        return await ctx.reply(text, { ...extra, parse_mode: undefined });
      }
    };

    await next();
  };
}