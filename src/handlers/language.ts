import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { saveUserLocale } from "../domain.js";
import { hasHinglish, locale, tr } from "../i18n.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Language", data: "language:choose", order: 35 });
const composer = new Composer<Ctx>();
async function picker(ctx: Ctx) {
  const l = await locale(ctx);
  await ctx.reply(tr(l, "languagePrompt", "Choose your preferred language."), { reply_markup: inlineKeyboard([
    [inlineButton("English", "language:set:english"), inlineButton("Hinglish", "language:set:hinglish")],
    [inlineButton(tr(l, "mainMenu", "Main menu"), "menu:main")],
  ]) });
}
composer.command("language", picker);
composer.callbackQuery("language:choose", async (ctx) => { await ctx.answerCallbackQuery(); await picker(ctx); });
composer.callbackQuery(/^language:set:(english|hinglish)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  const selected = ctx.match[1] as "english" | "hinglish";
  await saveUserLocale(String(ctx.from.id), selected);
  await ctx.reply(selected === "hinglish" ? tr("hinglish", "languageSaved", "") : "English is set. Future messages will be in English.");
});
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step || !ctx.from || !hasHinglish(ctx.message.text)) return next();
  await saveUserLocale(String(ctx.from.id), "hinglish");
  await ctx.reply(tr("hinglish", "detected", ""));
});
export default composer;
