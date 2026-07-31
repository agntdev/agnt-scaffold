import { Composer, InputFile } from "grammy";
import type { Ctx, SnippetParameters } from "../bot.js";
import { now } from "../clock.js";
import { recordBuild, recordModeChange, saveSnippet, snippetDocument } from "../domain.js";
import { generateNemotronSnippet, nemotronAvailable } from "../nemotron.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { locale, tr } from "../i18n.js";
registerMainMenuItem({ label: "Code snippet", data: "snippet:request", order: 20 });
const composer = new Composer<Ctx>();
async function tx(ctx: Ctx, key: string, english: string) { return tr(await locale(ctx), key, english); }
async function cancel(ctx: Ctx) { return inlineKeyboard([[inlineButton(await tx(ctx, "cancel", "Cancel"), "snippet:cancel")]]); }
async function types(ctx: Ctx) { const l = await locale(ctx); return inlineKeyboard([[inlineButton(l === "hinglish" ? "Function banao" : "Function", "snippet:type:Function"), inlineButton(l === "hinglish" ? "API endpoint" : "API endpoint", "snippet:type:API-endpoint")], [inlineButton(l === "hinglish" ? "Test banao" : "Test", "snippet:type:Test")], [inlineButton(await tx(ctx, "cancel", "Cancel"), "snippet:cancel")]]); }
async function languages(ctx: Ctx) { return inlineKeyboard([[inlineButton("TypeScript", "snippet:language:TypeScript"), inlineButton("Python", "snippet:language:Python")], [inlineButton("Go", "snippet:language:Go")], [inlineButton(await tx(ctx, "cancel", "Cancel"), "snippet:cancel")]]); }
function models(ctx: Ctx) {
  const nemotron = nemotronAvailable(ctx);
  return inlineKeyboard([
    [inlineButton("Built-in template", "snippet:model:template")],
    [inlineButton(nemotron ? "Nemotron 3 Ultra" : "Nemotron unavailable", nemotron ? "snippet:model:nemotron" : "snippet:model:unavailable")],
    [inlineButton("Cancel", "snippet:cancel")],
  ]);
}
export async function beginSnippet(ctx: Ctx, announce = true) {
  const from = ctx.session.mode ?? "conversation";
  if (announce) await ctx.reply("Switching to Execution Mode to generate your code snippet.");
  ctx.session.mode = "execution";
  if (ctx.from && from !== "execution") await recordModeChange({ owner: String(ctx.from.id), from, to: "execution", timestamp: now().getTime(), reason: "snippet request" });
  ctx.session.awaitingExecutionApproval = undefined;
  ctx.session.step = "snippet:type";
  ctx.session.snippetDraft = {};
  await ctx.reply(await tx(ctx, "chooseSnippet", "Choose the kind of code snippet you need."), { reply_markup: await types(ctx) });
}
async function returnToConversation(ctx: Ctx, reason: string) {
  const from = ctx.session.mode ?? "execution";
  ctx.session.mode = "conversation";
  if (ctx.from && from !== "conversation") await recordModeChange({ owner: String(ctx.from.id), from, to: "conversation", timestamp: now().getTime(), reason });
  await ctx.reply("Done — returning to Conversation Mode.");
}
composer.callbackQuery("snippet:request", async (ctx) => { await ctx.answerCallbackQuery(); await beginSnippet(ctx); });
composer.callbackQuery(/^snippet:type:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "snippet:type") return; ctx.session.snippetDraft!.type = ctx.callbackQuery.data.slice(13); ctx.session.step = "snippet:language"; await ctx.reply(await tx(ctx, "chooseLanguage", "Choose a language."), { reply_markup: await languages(ctx) }); });
composer.callbackQuery(/^snippet:language:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "snippet:language") return; ctx.session.snippetDraft!.language = ctx.callbackQuery.data.slice(17); ctx.session.step = "snippet:model"; await ctx.reply(await tx(ctx, "generateMethod", "Choose how to generate the snippet."), { reply_markup: models(ctx) }); });
composer.callbackQuery("snippet:model:unavailable", async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "snippet:model") return; await ctx.reply("Nemotron 3 Ultra isn’t set up yet. Choose the built-in template or ask the owner to add the model key.", { reply_markup: models(ctx) }); });
composer.callbackQuery(/^snippet:model:(template|nemotron)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "snippet:model") return; const selected = ctx.match[1] as "template" | "nemotron"; if (selected === "nemotron" && !nemotronAvailable(ctx)) { await ctx.reply("Nemotron 3 Ultra isn’t set up yet. Choose the built-in template or ask the owner to add the model key.", { reply_markup: models(ctx) }); return; } ctx.session.snippetModel = selected; ctx.session.step = "snippet:requirements"; await ctx.reply(await tx(ctx, "requirements", "Describe the requirements for this snippet."), { reply_markup: await cancel(ctx) }); });
composer.callbackQuery("snippet:cancel", async (ctx) => { await ctx.answerCallbackQuery(); ctx.session.step = undefined; ctx.session.snippetDraft = undefined; ctx.session.snippetModel = undefined; await ctx.reply(await tx(ctx, "cancelledSnippet", "This snippet request was cancelled.")); await returnToConversation(ctx, "snippet cancelled"); });
composer.on("message:text", async (ctx, next) => { if (ctx.session.step !== "snippet:requirements") return next(); const requirements = ctx.message.text.trim(); if (requirements.length < 5 || requirements.length > 1000 || !ctx.from) { await ctx.reply(await tx(ctx, "invalidRequirements", "Describe the snippet in 5–1,000 characters.")); return; } const draft = { ...ctx.session.snippetDraft, requirements } as SnippetParameters; const selectedModel = ctx.session.snippetModel ?? "template"; await ctx.reply(await tx(ctx, "generatingSnippet", "Generating your code snippet now.")); let document = snippetDocument(draft); if (selectedModel === "nemotron") { try { const generated = await generateNemotronSnippet(ctx, draft); if (!generated) { await recordBuild(false); await ctx.reply("Nemotron couldn’t generate that snippet right now. Choose the built-in template and try again.", { reply_markup: models(ctx) }); ctx.session.step = "snippet:model"; return; } document = generated; } catch { await recordBuild(false); await ctx.reply("Nemotron couldn’t generate that snippet right now. Choose the built-in template and try again.", { reply_markup: models(ctx) }); ctx.session.step = "snippet:model"; return; } } await saveSnippet(String(ctx.from.id), draft, now().getTime()); await recordBuild(true); ctx.session.step = undefined; ctx.session.snippetDraft = undefined; ctx.session.snippetModel = undefined; await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(document), "code-snippet.txt")); const l = await locale(ctx); await ctx.reply(l === "hinglish" ? `Tumhara ${draft.type} snippet ${draft.language} mein ready hai. Is chat ke artifact delivery se download karo.\n\nIsse starting point ki tarah use karo, phir names aur configuration project ke hisaab se adapt karo.\n\n30 din tak available hai.` : `Your ${draft.type} snippet in ${draft.language} is ready. Download it from this chat’s artifact delivery.\n\nUse it as a starting point, then adapt the names and configuration to your project.\n\nAvailable for 30 days.`, { reply_markup: inlineKeyboard([[inlineButton("Share feedback", "feedback:complete")], [inlineButton(await tx(ctx, "mainMenu", "Main menu"), "menu:main")]]) }); await returnToConversation(ctx, "snippet completed"); });
export default composer;
