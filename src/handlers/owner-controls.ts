import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { now } from "../clock.js";
import { recentProjects, saveSettings, settings } from "../domain.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "Team settings", data: "owner:settings", order: 40 });
const composer = new Composer<Ctx>();
function admin(ctx: Ctx): boolean { return Boolean(process.env.ADMIN_CHAT_ID && String(ctx.from?.id) === process.env.ADMIN_CHAT_ID); }
async function show(ctx: Ctx) { const cfg = await settings(); await ctx.reply(`Team defaults\nLanguages: ${cfg.languages.join(", ")}\nFrameworks: ${cfg.frameworks.join(", ")}\nRetention: ${cfg.retentionDays} days\nGroup notifications: ${cfg.notificationsEnabled ? "on" : "off"}`, { reply_markup: inlineKeyboard([[inlineButton("Languages", "owner:languages"), inlineButton("Frameworks", "owner:frameworks")], [inlineButton("Toggle notifications", "owner:toggle-notifications")], [inlineButton("Retention: 30 days", "owner:retention:30")], [inlineButton("Recent projects", "owner:history")], [inlineButton("Main menu", "menu:main")]]) }); }
composer.callbackQuery("owner:settings", async (ctx) => { await ctx.answerCallbackQuery(); if (!process.env.ADMIN_CHAT_ID) { await ctx.reply("Team settings aren’t set up yet."); return; } if (!admin(ctx)) { await ctx.reply("Only the team owner can change these settings."); return; } await show(ctx); });
composer.callbackQuery("owner:toggle-notifications", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; const cfg = await settings(); await saveSettings({ ...cfg, notificationsEnabled: !cfg.notificationsEnabled }); await show(ctx); });
composer.callbackQuery("owner:retention:30", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; const cfg = await settings(); await saveSettings({ ...cfg, retentionDays: 30 }); await show(ctx); });
composer.callbackQuery("owner:languages", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; await ctx.reply("Choose the default language set.", { reply_markup: inlineKeyboard([[inlineButton("TypeScript and Python", "owner:languages:ts-py")], [inlineButton("Go and TypeScript", "owner:languages:go-ts")]]) }); });
composer.callbackQuery("owner:frameworks", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; await ctx.reply("Choose the default framework set.", { reply_markup: inlineKeyboard([[inlineButton("Node.js and FastAPI", "owner:frameworks:node-python")], [inlineButton("Node.js and Go", "owner:frameworks:node-go")]]) }); });
composer.callbackQuery("owner:languages:ts-py", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; const cfg = await settings(); await saveSettings({ ...cfg, languages: ["TypeScript", "Python"] }); await show(ctx); });
composer.callbackQuery("owner:languages:go-ts", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; const cfg = await settings(); await saveSettings({ ...cfg, languages: ["Go", "TypeScript"] }); await show(ctx); });
composer.callbackQuery("owner:frameworks:node-python", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; const cfg = await settings(); await saveSettings({ ...cfg, frameworks: ["Node.js", "FastAPI"] }); await show(ctx); });
composer.callbackQuery("owner:frameworks:node-go", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; const cfg = await settings(); await saveSettings({ ...cfg, frameworks: ["Node.js", "Go standard library"] }); await show(ctx); });
composer.callbackQuery("owner:history", async (ctx) => { await ctx.answerCallbackQuery(); if (!admin(ctx)) return; const projects = await recentProjects(now().getTime()); await ctx.reply(projects.length ? `Recent projects:\n${projects.map((project) => `• ${project.name}`).join("\n")}` : "No projects have been generated yet."); });
export default composer;
