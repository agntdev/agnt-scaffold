import { Composer } from "grammy";
import { createBot, type BotContext, type CreateBotOptions } from "./toolkit/index.js";
import type { StorageAdapter } from "grammy";
import agent from "./handlers/agent.js";
import conversationMode from "./handlers/conversation-mode.js";
import help from "./handlers/help.js";
import issueReport from "./handlers/issue-report.js";
import language from "./handlers/language.js";
import newproject from "./handlers/newproject.js";
import ownerControls from "./handlers/owner-controls.js";
import revisionRequest from "./handlers/revision-request.js";
import snippetRequest from "./handlers/snippet-request.js";
import start from "./handlers/start.js";

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface Session {
  step?: string;
  mode?: "conversation" | "execution";
  /** True only while the user has explicitly opened freeform Chat. */
  chatActive?: boolean;
  detectedLocale?: "hinglish";
  conversationContext?: Array<{ text: string; at: number }>;
  awaitingExecutionApproval?: boolean;
  projectDraft?: Partial<ProjectParameters>;
  snippetDraft?: Partial<SnippetParameters>;
  snippetModel?: "template" | "nemotron";
  revisionProjectId?: string;
}

export interface ProjectParameters {
  name: string;
  language: string;
  framework: string;
  features: string[];
  license: string;
  ci: string;
  tests: string;
}

export interface SnippetParameters {
  type: string;
  language: string;
  requirements: string;
}

export type Ctx = BotContext<Session>;

/**
 * BuildBotOptions lets a runtime-specific ENTRY POINT (never a feature handler)
 * override how the bot is assembled:
 *
 *  - `handlers`: an optional pre-loaded list of feature Composers. The Workers
 *    entry passes its build-time manifest; Node uses the synchronous static list
 *    below. Keeping registration synchronous means a newly created bot can
 *    accept an update immediately, including in the replay harness.
 *  - `storage`: an explicit grammY session StorageAdapter (Workers passes a
 *    Durable-Object-backed one; Node auto-selects Redis/in-memory).
 */
export interface BuildBotOptions {
  handlers?: Composer<Ctx>[];
  storage?: StorageAdapter<Session>;
  telemetryEnv?: CreateBotOptions<Session>["telemetryEnv"];
  telemetryReporterOptions?: CreateBotOptions<Session>["telemetryReporterOptions"];
}

/**
 * buildBot — assembles the bot, installs its synchronously imported feature
 * handlers, then registers the global fallback. Does NOT start polling.
 */
export function buildBot(token: string, opts: BuildBotOptions = {}) {
  const bot = createBot<Session>(token, {
    initial: () => ({ mode: "conversation", conversationContext: [] }),
    storage: opts.storage,
    telemetryEnv: opts.telemetryEnv,
    telemetryReporterOptions: opts.telemetryReporterOptions,
  });

  const handlers = opts.handlers ?? defaultHandlers;
  for (const h of handlers) bot.use(h);

  bot.on("message", (ctx) => ctx.reply("Sorry, I didn't understand that. Try /help."));

  return bot;
}

// This list is intentionally static. Dynamic handler discovery registers too
// late in constrained runtimes and is unavailable in Cloudflare Workers.
const defaultHandlers: Composer<Ctx>[] = [
  agent,
  conversationMode,
  help,
  issueReport,
  language,
  newproject,
  ownerControls,
  revisionRequest,
  snippetRequest,
  start,
];
