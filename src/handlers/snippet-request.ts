import { Composer, InputFile } from "grammy";
import type { Ctx, SnippetParameters } from "../bot.js";
import { now } from "../clock.js";
import { saveSnippet, snippetDocument } from "../domain.js";
import { generateNemotronSnippet, nemotronAvailable } from "../nemotron.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "Code snippet", data: "snippet:request", order: 20 });
const composer = new Composer<Ctx>();
const cancel = inlineKeyboard([[inlineButton("Cancel", "snippet:cancel")]]);
function types() { return inlineKeyboard([[inlineButton("Function", "snippet:type:Function"), inlineButton("API endpoint", "snippet:type:API-endpoint")], [inlineButton("Test", "snippet:type:Test")], [inlineButton("Cancel", "snippet:cancel")]]); }
function languages() { return inlineKeyboard([[inlineButton("TypeScript", "snippet:language:TypeScript"), inlineButton("Python", "snippet:language:Python")], [inlineButton("Go", "snippet:language:Go")], [inlineButton("Cancel", "snippet:cancel")]]); }
function models(ctx: Ctx) {
  const nemotron = nemotronAvailable(ctx);
  return inlineKeyboard([
    [inlineButton("Built-in template", "snippet:model:template")],
    [inlineButton(nemotron ? "Nemotron 3 Ultra" : "Nemotron unavailable", nemotron ? "snippet:model:nemotron" : "snippet:model:unavailable")],
    [inlineButton("Cancel", "snippet:cancel")],
  ]);
}
composer.callbackQuery("snippet:request", async (ctx) => { await ctx.answerCallbackQuery(); ctx.session.step = "snippet:type"; ctx.session.snippetDraft = {}; await ctx.reply("Choose the kind of code snippet you need.", { reply_markup: types() }); });
composer.callbackQuery(/^snippet:type:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "snippet:type") return; ctx.session.snippetDraft!.type = ctx.callbackQuery.data.slice(13); ctx.session.step = "snippet:language"; await ctx.reply("Choose a language.", { reply_markup: languages() }); });
composer.callbackQuery(/^snippet:language:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "snippet:language") return; ctx.session.snippetDraft!.language = ctx.callbackQuery.data.slice(17); ctx.session.step = "snippet:model"; await ctx.reply("Choose how to generate the snippet.", { reply_markup: models(ctx) }); });
composer.callbackQuery("snippet:model:unavailable", async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "snippet:model") return; await ctx.reply("Nemotron 3 Ultra isn’t set up yet. Choose the built-in template or ask the owner to add the model key.", { reply_markup: models(ctx) }); });
composer.callbackQuery(/^snippet:model:(template|nemotron)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "snippet:model") return; const selected = ctx.match[1] as "template" | "nemotron"; if (selected === "nemotron" && !nemotronAvailable(ctx)) { await ctx.reply("Nemotron 3 Ultra isn’t set up yet. Choose the built-in template or ask the owner to add the model key.", { reply_markup: models(ctx) }); return; } ctx.session.snippetModel = selected; ctx.session.step = "snippet:requirements"; await ctx.reply("Describe the requirements for this snippet.", { reply_markup: cancel }); });
composer.callbackQuery("snippet:cancel", async (ctx) => { await ctx.answerCallbackQuery(); ctx.session.step = undefined; ctx.session.snippetDraft = undefined; ctx.session.snippetModel = undefined; await ctx.reply("This snippet request was cancelled."); });
composer.on("message:text", async (ctx, next) => { if (ctx.session.step !== "snippet:requirements") return next(); const requirements = ctx.message.text.trim(); if (requirements.length < 5 || requirements.length > 1000 || !ctx.from) { await ctx.reply("Describe the snippet in 5–1,000 characters."); return; } const draft = { ...ctx.session.snippetDraft, requirements } as SnippetParameters; const selectedModel = ctx.session.snippetModel ?? "template"; await ctx.reply("Generating your code snippet now."); let document = snippetDocument(draft); if (selectedModel === "nemotron") { try { const generated = await generateNemotronSnippet(ctx, draft); if (!generated) { await ctx.reply("Nemotron couldn’t generate that snippet right now. Choose the built-in template and try again.", { reply_markup: models(ctx) }); ctx.session.step = "snippet:model"; return; } document = generated; } catch { await ctx.reply("Nemotron couldn’t generate that snippet right now. Choose the built-in template and try again.", { reply_markup: models(ctx) }); ctx.session.step = "snippet:model"; return; } } await saveSnippet(String(ctx.from.id), draft, now().getTime()); ctx.session.step = undefined; ctx.session.snippetDraft = undefined; ctx.session.snippetModel = undefined; await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(document), "code-snippet.txt")); await ctx.reply(`Your ${draft.type} snippet in ${draft.language} is ready. Download it from this chat’s artifact delivery.\n\nUse it as a starting point, then adapt the names and configuration to your project.\n\nAvailable for 30 days.`, { reply_markup: inlineKeyboard([[inlineButton("Main menu", "menu:main")]]) }); });
export default composer;
