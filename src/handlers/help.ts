import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { locale, tr } from "../i18n.js";

// /help — plain-language explanation for non-technical users. This bot is
// button-driven: tell the user to tap /start to open the menu rather than listing
// slash commands. The same text is shown when the user taps the Help button on the
// main menu (`menu:help`). Enhance the copy for your specific bot; keep it short.
const composer = new Composer<Ctx>();

async function helpText(ctx: Ctx) { return tr(await locale(ctx), "help", "Open the menu with /start, then choose a project, revision, or code snippet. Clear task requests automatically start Execution Mode; /agent and Start task do it manually. Hinglish is supported. Use /language to choose English or Hinglish."); }
async function backToMenu(ctx: Ctx) { return inlineKeyboard([[inlineButton(tr(await locale(ctx), "back", "Back to menu"), "menu:main")]]); }

composer.command("help", async (ctx) => {
  await ctx.reply(await helpText(ctx));
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(await helpText(ctx), { reply_markup: await backToMenu(ctx) });
});

export default composer;
