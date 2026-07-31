import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { now } from "../clock.js";
import { recordModeChange, recordNluObservation } from "../domain.js";
import { classifyInput, type NluResult } from "../nlu.js";
import { beginProject } from "./newproject.js";
import { beginSnippet } from "./snippet-request.js";

const composer = new Composer<Ctx>();

function remember(ctx: Ctx, text: string) {
  ctx.session.conversationContext = [...(ctx.session.conversationContext ?? []), text].slice(-6);
}

async function enterExecution(ctx: Ctx, reason: string) {
  const from = ctx.session.mode ?? "conversation";
  ctx.session.mode = "execution";
  ctx.session.awaitingExecutionApproval = undefined;
  if (ctx.from && from !== "execution") {
    await recordModeChange({ owner: String(ctx.from.id), from, to: "execution", timestamp: now().getTime(), reason });
  }
}

function wantsProject(text: string, nlu: NluResult) {
  return nlu.intent === "project" || /\b(new\s+project|create\s+(a\s+)?project|generate\s+(a\s+)?project|scaffold|build\s+(a\s+)?project)\b/i.test(text);
}
function wantsSnippet(text: string, nlu: NluResult) {
  return nlu.intent === "snippet" || /\b(code\s+snippet|write\s+code|generate\s+code|implement\b|function\b|api\s+endpoint|test\b)\b/i.test(text);
}
function explicitWork(text: string) {
  return /\b(generate|create|scaffold|build|write\s+code|implement|run\s+tests|analyze|produce|deploy)\b/i.test(text);
}
function affirmative(text: string) {
  return /^(yes|yeah|yep|please\s+start|go\s+ahead|do\s+it|start|haan|ha|han|theek|thik|chalo|abhi)\b/i.test(text.trim());
}

async function conversationalReply(ctx: Ctx, text: string, nlu: NluResult) {
  const previous = ctx.session.conversationContext ?? [];
  if (nlu.language === "hinglish") {
    ctx.session.awaitingExecutionApproval = true;
    if (nlu.confidence < 0.6) {
      await ctx.reply("Main context samajhna chahta hoon. Project scaffold chahiye, code snippet, ya pehle idea discuss karein?");
      return;
    }
    await ctx.reply("Achha point hai. Sabse pehle kaunsa outcome important hai, aur kaunsi constraint decision ko shape karegi?");
    return;
  }
  if (/\b(what can you do|can you|help)\b/i.test(text)) {
    ctx.session.awaitingExecutionApproval = undefined;
    await ctx.reply("I can help you think through a technical idea, then create a project scaffold or a focused code snippet when you ask me to. What are you weighing up?");
    return;
  }
  if (/\b(idea|brainstorm|thinking|explore|considering)\b/i.test(text)) {
    ctx.session.awaitingExecutionApproval = true;
    await ctx.reply("That’s worth unpacking before we build anything. What outcome matters most, and what constraint is most likely to shape the choice?");
    return;
  }
  const continuity = previous.length > 1 ? " I’m keeping the thread in mind." : "";
  ctx.session.awaitingExecutionApproval = true;
  await ctx.reply(`I’m with you.${continuity} Are you exploring the idea, or would you like me to turn it into a project or code snippet?`);
}

composer.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/") || ctx.session.step) return next();

  const nlu = classifyInput(text);
  const lowConfidence = nlu.confidence < 0.6 || nlu.intent === "unknown";
  await recordNluObservation(nlu.language, nlu.confidence, lowConfidence);
  // Detection keeps the current conversation in the user's mixed style. An
  // explicit choice in the Language menu is the durable preference.
  if (nlu.language === "hinglish") ctx.session.detectedLocale = "hinglish";
  remember(ctx, text);

  if (/\b(switch\s+(to\s+)?execution\s+mode|enter\s+execution\s+mode)\b/i.test(text)) {
    await enterExecution(ctx, "explicit mode request");
    await ctx.reply("Switching to Execution Mode. Tell me whether you want a project scaffold or a code snippet.");
    return;
  }
  if (ctx.session.awaitingExecutionApproval && affirmative(text)) {
    await enterExecution(ctx, "affirmative reply");
    await ctx.reply(nlu.language === "hinglish" ? "Execution Mode on hai. Project scaffold chahiye ya code snippet?" : "Switching to Execution Mode. Tell me whether you want a project scaffold or a code snippet.");
    return;
  }
  if (wantsProject(text, nlu)) {
    await enterExecution(ctx, "project request");
    await beginProject(ctx, nlu.language !== "hinglish");
    return;
  }
  if (wantsSnippet(text, nlu)) {
    await enterExecution(ctx, "snippet request");
    await beginSnippet(ctx, nlu.language !== "hinglish");
    return;
  }
  if (explicitWork(text)) {
    await enterExecution(ctx, "unsupported execution request");
    await ctx.reply("Switching to Execution Mode. I can create a project scaffold or a focused code snippet here. Which should I start?");
    return;
  }
  await conversationalReply(ctx, text, nlu);
});

export default composer;
