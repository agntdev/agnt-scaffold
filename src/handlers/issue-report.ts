import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId } from "../runtime.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

export function recoveryKeyboard() {
  return inlineKeyboard([[inlineButton("Report issue", "issue:report")], [inlineButton("Main menu", "menu:main")]]);
}

composer.callbackQuery("issue:report", async (ctx) => {
  await ctx.answerCallbackQuery();
  const admin = adminChatId(ctx);
  if (!admin) {
    await ctx.reply("Issue reporting isn’t set up yet. Please try again in a moment.");
    return;
  }
  try {
    await ctx.api.sendMessage(admin, "CodeScaffold received a flow-start issue report. Please check service health and recent errors.");
    await ctx.reply("Your issue report was sent. Please try again in a moment.");
  } catch {
    await ctx.reply("Sorry — I couldn’t send that report right now. Please try again in a moment.");
  }
});

export default composer;
