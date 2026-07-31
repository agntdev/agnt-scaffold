/**
 * Small, deterministic NLU seam for conversation routing.  It is intentionally
 * local: conversational routing must continue to work when no model credential
 * is configured, and it gives us inspectable confidence scores for QA.
 */
export type ConversationIntent = "project" | "snippet" | "execution" | "conversation" | "unknown";
export type InputLanguage = "english" | "hinglish";

export interface NluResult {
  language: InputLanguage;
  intent: ConversationIntent;
  confidence: number;
  normalized: string;
}

const romanizedHindi: Record<string, string> = {
  kya: "what", kaise: "how", kaisa: "how", kaunsi: "which", kaun: "who",
  mera: "my", meri: "my", mere: "my", mujhe: "me", hum: "we", ham: "we",
  project: "project", naya: "new", nayi: "new", banao: "create", bana: "create",
  bnao: "create", banana: "create", karo: "do", karna: "do", kar: "do",
  chahiye: "need", chaiye: "need", chahie: "need", hai: "is", hain: "are",
  ho: "is", hoga: "will", hogi: "will", theek: "okay", thik: "okay",
  chal: "go", chalo: "go", shuru: "start", shuruat: "start", abhi: "now",
  phir: "then", aur: "and", wala: "one", wale: "ones", ke: "for", ka: "of",
  ki: "of", ko: "to", se: "with", mein: "in", me: "in", batao: "tell",
  samjhao: "explain", dikhao: "show", likho: "write", likh: "write", code: "code",
  snippet: "snippet", function: "function", test: "test", endpoint: "endpoint",
};

const hinglishSignals = new Set(Object.keys(romanizedHindi).filter((word) => !["project", "code", "snippet", "function", "test", "endpoint"].includes(word)));

// 120 representative labelled utterances. These are validation/training
// examples for the transparent rule classifier, not user records.
export const hinglishTrainingUtterances: ReadonlyArray<readonly [ConversationIntent, string]> = [
  ...["hi yaar", "hello bhai", "namaste bot", "kaise ho", "kya haal hai", "help chahiye", "mujhe guide karo", "thik hai", "chalo shuru karein", "bot kya kar sakta hai", "mujhe samjhao", "idea discuss karna hai"].map((x) => ["conversation", x] as const),
  ...["naya project banao", "mera api project create karo", "node app scaffold karo", "team ke liye project banana hai", "ek backend project chahiye", "typescript project bana do", "project shuru karo", "mujhe new service scaffold karni hai", "dashboard project banao", "fastapi app create karo", "repo ka starter banao", "project generate kar do"].map((x) => ["project", x] as const),
  ...["function ka snippet likho", "api endpoint code chahiye", "validation snippet bana do", "test code likh do", "typescript function generate karo", "python snippet chahiye", "auth middleware ka code banao", "docker helper likho", "ek parser function do", "unit test snippet chahiye", "error handler code karo", "code sample bana do"].map((x) => ["snippet", x] as const),
  ...["execution mode chalu karo", "ab build karo", "go ahead karo", "kaam shuru karo", "idea ko implement karo", "ab generate kar do", "chalo execute karte hain", "project ya snippet bana do", "deploy plan banao", "ab action lo", "implementation start karo", "kaam aage badhao"].map((x) => ["execution", x] as const),
  ...["mujhe samajh nahi aa raha", "kya choose karun", "kaunsa framework theek rahega", "idea weak lag raha hai", "pehle options batao", "iska scope kya hoga", "kaise plan karein", "thoda clear karo", "requirements discuss karte hain", "yeh sahi hoga kya", "mujhe advice chahiye", "tradeoff batao"].map((x) => ["conversation", x] as const),
  ...["mera project ka naam kya rakhein", "api ke liye scaffold banao", "react project create karo", "service ka starter chahiye", "database wala project banao", "ci ke saath project generate karo", "testing add karke project banao", "microservice scaffold karna hai", "new repo banao", "backend setup chahiye", "project ka flow shuru karo", "app banana hai"].map((x) => ["project", x] as const),
  ...["login function likho", "response validator snippet chahiye", "go mein handler banao", "python test likho", "rate limiter code do", "api client snippet generate karo", "cache helper banao", "json parser likho", "auth test code chahiye", "retry function bana do", "logger snippet likho", "code implement karo"].map((x) => ["snippet", x] as const),
  ...["haan start karo", "yes chalo", "abhi banao", "please generate karo", "idea ko code mein badlo", "implement kar do", "execution mein jao", "kaam karo", "build shuru karo", "next step lo", "ab proceed karo", "ready hoon chalo"].map((x) => ["execution", x] as const),
  ...["hello team", "aaj kya bana sakte hain", "mujhe ek suggestion do", "project idea discuss karein", "confused hoon", "pehle baat karte hain", "kya tum help karoge", "mera plan review karo", "thoda challenge karo", "simple language mein batao", "mere paas ek idea hai", "soch raha hoon"].map((x) => ["conversation", x] as const),
  ...["kuch banana hai", "yeh kar do", "help karo na", "samajh nahi aaya", "kya karein", "ek cheez chahiye", "start karna hai", "idea hai", "code wala kaam", "project ya code", "please guide", "ab kya"].map((x) => ["unknown", x] as const),
];

export function normalizeHinglish(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9_\-\s]/g, " ").split(/\s+/).filter(Boolean)
    .map((token) => romanizedHindi[token] ?? token).join(" ");
}

export function classifyInput(text: string): NluResult {
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hindiHits = tokens.filter((token) => hinglishSignals.has(token)).length;
  const language: InputLanguage = hindiHits > 0 ? "hinglish" : "english";
  const normalized = normalizeHinglish(text);
  const score = (terms: RegExp) => (terms.test(normalized) ? 0.9 : 0);
  // A vague request should be clarified instead of treating a generic "do" as
  // consent to launch work.
  if (/\b(kuch|something|cheez)\b/.test(normalized) && !/\b(project|snippet|code|function|endpoint)\b/.test(normalized)) {
    return { language, intent: "unknown", confidence: 0.42, normalized };
  }
  // A bare mention of a service is often exploratory; require a project cue
  // before launching a scaffold flow.
  const project = score(/\b(new project|project|scaffold|app|repo|backend)\b/);
  const snippet = score(/\b(code snippet|snippet|function|endpoint|handler|middleware|test|code)\b/);
  const execution = score(/\b(execution|create|generate|build|write|implement|start|proceed|do)\b/);
  if (project && !snippet) return { language, intent: "project", confidence: Math.min(0.98, project + hindiHits * 0.02), normalized };
  if (snippet && !project) return { language, intent: "snippet", confidence: Math.min(0.98, snippet + hindiHits * 0.02), normalized };
  if (execution) return { language, intent: "execution", confidence: Math.min(0.9, execution + hindiHits * 0.02), normalized };
  if (hindiHits >= 2) return { language, intent: "conversation", confidence: 0.72, normalized };
  return { language, intent: "unknown", confidence: hindiHits === 1 ? 0.42 : 0.5, normalized };
}
