import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { locale, tr } from "../i18n.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

async function menu(ctx: Ctx) {
  const l = await locale(ctx);
  return inlineKeyboard([
    [inlineButton(tr(l, "newProject", "New project"), "project:new"), inlineButton(tr(l, "snippet", "Code snippet"), "snippet:request")],
    [inlineButton("Chat", "chat:open"), inlineButton("Start task", "agent:start")],
    [inlineButton(tr(l, "revision", "Request revision"), "revision:request"), inlineButton(tr(l, "language", "Language"), "language:choose")],
    [inlineButton(tr(l, "settings", "Team settings"), "owner:settings")],
    [inlineButton(tr(l, "helpButton", "Help"), "menu:help")],
  ]);
}
async function welcome(ctx: Ctx) { const l = await locale(ctx); return tr(l, "welcome", "Build a project scaffold or request a focused code snippet."); }

composer.command("start", async (ctx) => {
  ctx.session.mode = "conversation";
  ctx.session.awaitingExecutionApproval = undefined;
  await ctx.reply(await welcome(ctx), { reply_markup: await menu(ctx) });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(await welcome(ctx), { reply_markup: await menu(ctx) });
});

export default composer;
