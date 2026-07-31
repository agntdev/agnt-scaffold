import { Composer, InputFile } from "grammy";
import type { Ctx, ProjectParameters } from "../bot.js";
import { now } from "../clock.js";
import { artifactFor, projectDocument, projectsFor, recordBuild, recordModeChange, recordRecent, saveProject, settings, type ProjectRecord } from "../domain.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { locale, tr } from "../i18n.js";

registerMainMenuItem({ label: "New project", data: "project:new", order: 10 });
const composer = new Composer<Ctx>();
async function tx(ctx: Ctx, key: string, english: string) { return tr(await locale(ctx), key, english); }
async function cancel(ctx: Ctx) { return inlineKeyboard([[inlineButton(await tx(ctx, "cancel", "Cancel"), "flow:cancel")]]); }
async function choice(ctx: Ctx, items: Array<[string, string]>) { return inlineKeyboard([...items.map(([label, data]) => [inlineButton(label, data)]), [inlineButton(await tx(ctx, "cancel", "Cancel"), "flow:cancel")]]); }

function clear(ctx: Ctx) { ctx.session.step = undefined; ctx.session.projectDraft = undefined; }
async function askName(ctx: Ctx) {
  ctx.session.step = "project:name";
  ctx.session.projectDraft = {};
  await ctx.reply(await tx(ctx, "projectName", "What should this project be called? Use letters, numbers, hyphens, or underscores."), { reply_markup: await cancel(ctx) });
}
export async function beginProject(ctx: Ctx, announce = true) {
  const from = ctx.session.mode ?? "conversation";
  if (announce) await ctx.reply("Switching to Execution Mode to create your project.");
  ctx.session.mode = "execution";
  if (ctx.from && from !== "execution") await recordModeChange({ owner: String(ctx.from.id), from, to: "execution", timestamp: now().getTime(), reason: "project request" });
  ctx.session.awaitingExecutionApproval = undefined;
  await askName(ctx);
}
async function askLanguage(ctx: Ctx) {
  const cfg = await settings();
  ctx.session.step = "project:language";
  await ctx.reply(await tx(ctx, "chooseLanguage", "Choose a language."), { reply_markup: await choice(ctx, cfg.languages.map((language) => [language, `project:language:${language}`])) });
}
async function askFramework(ctx: Ctx) {
  const cfg = await settings();
  ctx.session.step = "project:framework";
  await ctx.reply(await tx(ctx, "chooseFramework", "Choose a framework."), { reply_markup: await choice(ctx, cfg.frameworks.map((framework) => [framework, `project:framework:${framework}`])) });
}
async function askFeatures(ctx: Ctx) {
  ctx.session.step = "project:features";
  ctx.session.projectDraft!.features = [];
  return ctx.reply(await tx(ctx, "chooseFeatures", "Choose the features to include. Tap Done when you’re ready."), { reply_markup: inlineKeyboard([
    [inlineButton("API", "project:feature:API"), inlineButton("Database", "project:feature:Database")],
    [inlineButton("Docker", "project:feature:Docker"), inlineButton("Auth", "project:feature:Auth")],
    [inlineButton(await tx(ctx, "done", "Done"), "project:features:done")], [inlineButton(await tx(ctx, "cancel", "Cancel"), "flow:cancel")],
  ]) });
}
async function askLicense(ctx: Ctx) { ctx.session.step = "project:license"; return ctx.reply(await tx(ctx, "chooseLicense", "Choose a license."), { reply_markup: await choice(ctx, [["MIT", "project:license:MIT"], ["Apache 2.0", "project:license:Apache-2.0"], ["No license", "project:license:None"]]) }); }
async function askCi(ctx: Ctx) { ctx.session.step = "project:ci"; return ctx.reply(await tx(ctx, "chooseCi", "Choose CI configuration."), { reply_markup: await choice(ctx, [["GitHub Actions", "project:ci:GitHub-Actions"], ["None", "project:ci:None"]]) }); }
async function askTests(ctx: Ctx) { ctx.session.step = "project:tests"; return ctx.reply(await tx(ctx, "chooseTests", "Choose a test setup."), { reply_markup: await choice(ctx, [["Unit tests", "project:tests:Unit-tests"], ["No tests", "project:tests:None"]]) }); }
function completeDraft(ctx: Ctx): ProjectParameters | undefined {
  const draft = ctx.session.projectDraft;
  if (!draft?.name || !draft.language || !draft.framework || !draft.features || !draft.license || !draft.ci || !draft.tests) return undefined;
  return draft as ProjectParameters;
}
async function confirm(ctx: Ctx) {
  const draft = completeDraft(ctx); if (!draft) { clear(ctx); await ctx.reply(await tx(ctx, "expired", "That project setup expired. Start a new project and try again.")); return; }
  ctx.session.step = "project:confirm";
  await ctx.reply(`Review your project:\n${draft.name} · ${draft.language} · ${draft.framework}\nFeatures: ${draft.features.join(", ") || "None"}\nLicense: ${draft.license}\nCI: ${draft.ci}\nTests: ${draft.tests}`, { reply_markup: inlineKeyboard([[inlineButton(await tx(ctx, "generateProject", "Generate project"), "project:confirm"), inlineButton(await tx(ctx, "cancel", "Cancel"), "flow:cancel")]]) });
}
async function generate(ctx: Ctx) {
  const params = completeDraft(ctx); if (!params || !ctx.from) { clear(ctx); await ctx.reply(await tx(ctx, "expired", "That project setup expired. Start a new project and try again.")); return; }
  const instant = now().getTime(); const cfg = await settings(); const ordinal = (await projectsFor(String(ctx.from.id), instant)).length + 1; const id = `project-${ctx.from.id}-${ordinal}`;
  const record: ProjectRecord = { ...params, id, owner: String(ctx.from.id), createdAt: instant, artifact: artifactFor(id, String(ctx.from.id), "project", instant, cfg.retentionDays, params.name) };
  await ctx.reply(await tx(ctx, "generatedProject", "Generating your project now."));
  await saveProject(record); await recordRecent(id); await recordBuild(true); clear(ctx);
  const l = await locale(ctx);
  await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(projectDocument(params, l)), `${params.name}-scaffold.md`));
  await ctx.reply(l === "hinglish" ? `Tumhara ${params.name} scaffold ready hai. Is chat ke artifact delivery se download karo.\n\nInstall\nDependencies install karke README ke steps follow karo.\n\n${cfg.retentionDays} din tak available hai.` : `Your ${params.name} scaffold is ready. Download it from this chat’s artifact delivery.\n\nREADME\n${record.artifact.readme}\n\nInstall\n${record.artifact.installationInstructions}\n\nAvailable for ${cfg.retentionDays} days.`, { reply_markup: inlineKeyboard([[inlineButton(await tx(ctx, "requestRevision", "Request revision"), "revision:request"), inlineButton("Share feedback", "feedback:complete")], [inlineButton(await tx(ctx, "mainMenu", "Main menu"), "menu:main")]]) });
  await notifyCompletion(ctx, params.name);
  await returnToConversation(ctx, "project completed");
}
async function returnToConversation(ctx: Ctx, reason: string) {
  const from = ctx.session.mode ?? "execution";
  ctx.session.mode = "conversation";
  if (ctx.from && from !== "conversation") await recordModeChange({ owner: String(ctx.from.id), from, to: "conversation", timestamp: now().getTime(), reason });
  await ctx.reply("Done — returning to Conversation Mode.");
}
async function notifyCompletion(ctx: Ctx, name: string) {
  const cfg = await settings(); const admin = process.env.ADMIN_CHAT_ID;
  if (!cfg.notificationsEnabled) return;
  if (!admin) { await ctx.reply("Group completion notifications aren’t set up yet."); return; }
  try { await ctx.api.sendMessage(admin, `CodeScaffold completed ${name}.`); } catch { /* A blocked or unavailable group must not fail delivery. */ }
}

composer.command("newproject", async (ctx) => { await beginProject(ctx); });
composer.callbackQuery("project:new", async (ctx) => { await ctx.answerCallbackQuery(); await beginProject(ctx); });
composer.callbackQuery(/^project:language:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "project:language") return; ctx.session.projectDraft!.language = ctx.callbackQuery.data.slice("project:language:".length); await askFramework(ctx); });
composer.callbackQuery(/^project:framework:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "project:framework") return; ctx.session.projectDraft!.framework = ctx.callbackQuery.data.slice("project:framework:".length); await askFeatures(ctx); });
composer.callbackQuery(/^project:feature:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "project:features") return; const feature = ctx.callbackQuery.data.slice("project:feature:".length); const values = ctx.session.projectDraft!.features!; ctx.session.projectDraft!.features = values.includes(feature) ? values.filter((item) => item !== feature) : [...values, feature]; await ctx.reply(`${feature} ${values.includes(feature) ? "removed" : "added"}. Tap Done when you’re ready.`); });
composer.callbackQuery("project:features:done", async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step === "project:features") await askLicense(ctx); });
composer.callbackQuery(/^project:license:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "project:license") return; ctx.session.projectDraft!.license = ctx.callbackQuery.data.slice("project:license:".length); await askCi(ctx); });
composer.callbackQuery(/^project:ci:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "project:ci") return; ctx.session.projectDraft!.ci = ctx.callbackQuery.data.slice("project:ci:".length); await askTests(ctx); });
composer.callbackQuery(/^project:tests:/, async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step !== "project:tests") return; ctx.session.projectDraft!.tests = ctx.callbackQuery.data.slice("project:tests:".length); await confirm(ctx); });
composer.callbackQuery("project:confirm", async (ctx) => { await ctx.answerCallbackQuery(); if (ctx.session.step === "project:confirm") await generate(ctx); });
composer.callbackQuery("flow:cancel", async (ctx) => { await ctx.answerCallbackQuery(); clear(ctx); await ctx.reply(await tx(ctx, "cancelledProject", "This draft was cancelled. You can start another project whenever you’re ready.")); await returnToConversation(ctx, "project cancelled"); });
composer.on("message:text", async (ctx, next) => { if (ctx.session.step !== "project:name") return next(); const name = ctx.message.text.trim(); if (!/^[a-zA-Z0-9_-]{2,64}$/.test(name)) { await ctx.reply(await tx(ctx, "invalidName", "Use 2–64 letters, numbers, hyphens, or underscores for the project name.")); return; } ctx.session.projectDraft!.name = name; await askLanguage(ctx); });
export default composer;
