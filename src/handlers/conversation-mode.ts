import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { now } from "../clock.js";
import { clearConversation, conversationFor, recordModeChange, recordNluObservation, saveConversation, type ConversationTurn } from "../domain.js";
import { generateNemotronConversation } from "../nemotron.js";
import { classifyInput, type NluResult } from "../nlu.js";
import { beginProject } from "./newproject.js";
import { beginSnippet } from "./snippet-request.js";
import { startTask } from "./agent.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { recoveryKeyboard } from "./issue-report.js";

const composer = new Composer<Ctx>();

function remember(ctx: Ctx, text: string) {
  const cutoff = now().getTime() - 24 * 60 * 60 * 1000;
  const recent = (ctx.session.conversationContext ?? []).filter((item) => item.at >= cutoff);
  ctx.session.conversationContext = [...recent, { text, at: now().getTime() }].slice(-20);
}

function chatKeyboard() {
  return inlineKeyboard([
    [inlineButton("Clear conversation", "chat:clear")],
    [inlineButton("Switch to Agent/Task mode", "chat:agent")],
    [inlineButton("Main menu", "menu:main")],
  ]);
}

async function chatHistory(ctx: Ctx): Promise<ConversationTurn[]> {
  if (!ctx.from) return [];
  return conversationFor(String(ctx.from.id), now().getTime());
}

async function openChat(ctx: Ctx) {
  ctx.session.mode = "conversation";
  ctx.session.chatActive = true;
  ctx.session.awaitingExecutionApproval = undefined;
  const history = await chatHistory(ctx);
  await ctx.reply(history.length
    ? "Chat is ready. I’ve kept the last day of this conversation in context."
    : "Chat is ready. Send a message to discuss an idea, ask a question, or think something through.",
  { reply_markup: chatKeyboard() });
}

async function replyInChat(ctx: Ctx, text: string) {
  if (!ctx.from) return;
  const prior = await chatHistory(ctx);
  const turns: ConversationTurn[] = [...prior, { role: "user", text, at: now().getTime() }];
  await ctx.replyWithChatAction("typing");
  let answer: string | undefined;
  try {
    answer = await generateNemotronConversation(ctx, turns);
  } catch {
    answer = undefined;
  }
  if (!answer) {
    await saveConversation(String(ctx.from.id), turns);
    await ctx.reply("Chat is temporarily unavailable. Try again in a moment.", { reply_markup: chatKeyboard() });
    return;
  }
  const complete = [...turns, { role: "assistant" as const, text: answer, at: now().getTime() }];
  await saveConversation(String(ctx.from.id), complete);
  await ctx.reply(answer, { reply_markup: chatKeyboard() });
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

  // Explicit Chat is deliberately not an intent router: a user can discuss
  // anything naturally without being pushed into the project wizard.
  if (ctx.session.chatActive) {
    await replyInChat(ctx, text);
    return;
  }

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

async function openChatSafely(ctx: Ctx) {
  try {
    await openChat(ctx);
  } catch {
    ctx.session.chatActive = false;
    await ctx.reply("Sorry — I’m having trouble starting chat right now. Please try again in a moment.", { reply_markup: recoveryKeyboard() });
  }
}
composer.command("chat", openChatSafely);
composer.command("clear", async (ctx) => {
  if (ctx.from) await clearConversation(String(ctx.from.id));
  ctx.session.conversationContext = [];
  await ctx.reply("Your chat history is cleared.", { reply_markup: chatKeyboard() });
});
composer.callbackQuery("chat:open", async (ctx) => { await ctx.answerCallbackQuery(); await openChatSafely(ctx); });
composer.callbackQuery("chat:clear", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.from) await clearConversation(String(ctx.from.id));
  ctx.session.conversationContext = [];
  await ctx.reply("Your chat history is cleared.", { reply_markup: chatKeyboard() });
});
composer.callbackQuery("chat:agent", async (ctx) => {
  await ctx.answerCallbackQuery();
  await startTask(ctx);
});

export default composer;
