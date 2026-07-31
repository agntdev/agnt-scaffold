import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { now } from "../clock.js";
import { recordCompletionFeedback, recordModeChange } from "../domain.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

export async function startTask(ctx: Ctx) {
  const from = ctx.session.mode ?? "conversation";
  ctx.session.mode = "execution";
  ctx.session.chatActive = false;
  ctx.session.awaitingExecutionApproval = undefined;
  if (ctx.from && from !== "execution") {
    await recordModeChange({ owner: String(ctx.from.id), from, to: "execution", timestamp: now().getTime(), reason: "manual agent activation" });
  }
  await ctx.reply("Execution Mode is on. Tell me whether you want a project scaffold or a code snippet.", {
    reply_markup: inlineKeyboard([
      [inlineButton("New project", "project:new"), inlineButton("Code snippet", "snippet:request")],
      [inlineButton("Main menu", "menu:main")],
    ]),
  });
}

composer.command("agent", startTask);
composer.callbackQuery("agent:start", async (ctx) => { await ctx.answerCallbackQuery(); await startTask(ctx); });
composer.callbackQuery("feedback:complete", async (ctx) => { await ctx.answerCallbackQuery({ text: "Thanks for the feedback." }); await recordCompletionFeedback(); await ctx.reply("Thanks — that helps us improve the next build."); });
export default composer;
