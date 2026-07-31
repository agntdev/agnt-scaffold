import type { Ctx } from "./bot.js";

type RuntimeEnv = { ADMIN_CHAT_ID?: string };

/** Read deployment bindings on Workers and environment variables on Node. */
export function adminChatId(ctx?: Ctx): string | undefined {
  const workerEnv = (ctx as (Ctx & { env?: RuntimeEnv }) | undefined)?.env;
  return workerEnv?.ADMIN_CHAT_ID
    ?? (typeof process === "undefined" ? undefined : process.env.ADMIN_CHAT_ID);
}
