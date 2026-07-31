/**
 * NVIDIA Nemotron integration. The credential is read only at the point of
 * use, from the Worker binding in production or process.env on Node. It is
 * deliberately never returned, logged, or stored in a session/artifact.
 */
import type { Ctx, SnippetParameters } from "./bot.js";
import type { ConversationTurn } from "./domain.js";

type RuntimeContext = Ctx & {
  env?: { NEMOTRON_3_ULTRA_API_KEY?: string };
};

const endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
const model = "nvidia/nemotron-3-ultra-550b-a55b";

export function nemotronApiKey(ctx?: RuntimeContext): string | undefined {
  return ctx?.env?.NEMOTRON_3_ULTRA_API_KEY
    ?? (typeof process === "undefined" ? undefined : process.env.NEMOTRON_3_ULTRA_API_KEY);
}

export function nemotronAvailable(ctx?: RuntimeContext): boolean {
  return Boolean(nemotronApiKey(ctx));
}

export async function generateNemotronSnippet(
  ctx: RuntimeContext,
  params: SnippetParameters,
): Promise<string | undefined> {
  const apiKey = nemotronApiKey(ctx);
  if (!apiKey) return undefined;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: "Return only production-ready source code. Do not use Markdown fences or explanations.",
        },
        {
          role: "user",
          content: `Write a ${params.type} in ${params.language}. Requirements: ${params.requirements}`,
        },
      ],
    }),
  });
  if (!response.ok) return undefined;

  const body = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : undefined;
}

/** The same platform model powers Chat, with an intentionally open-ended prompt. */
export async function generateNemotronConversation(
  ctx: RuntimeContext,
  history: ConversationTurn[],
): Promise<string | undefined> {
  const apiKey = nemotronApiKey(ctx);
  if (!apiKey) return undefined;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: "You are CodeScaffold's conversational assistant. Have natural, helpful discussions about ideas, planning, technical questions, brainstorming, and general topics. Be professional and concise. Preserve context, ask a useful follow-up when it helps, and do not force users into a project or code-generation flow. Follow the model provider's safety policies.",
        },
        ...history.slice(-24).map((turn) => ({ role: turn.role, content: turn.text })),
      ],
    }),
  });
  if (!response.ok) return undefined;
  const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = body.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : undefined;
}
