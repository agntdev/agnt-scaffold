import type { StorageAdapter } from "grammy";
import { RedisSessionStorage } from "./toolkit/session/redis.js";
import { MemorySessionStorage } from "./toolkit/session/memory.js";
import type { ProjectParameters, SnippetParameters } from "./bot.js";

export interface Artifact {
  id: string;
  url: string;
  readme: string;
  installationInstructions: string;
  timestamp: number;
  expiresAt: number;
  owner: string;
  kind: "project" | "snippet";
}

export interface ProjectRecord extends ProjectParameters {
  id: string;
  owner: string;
  createdAt: number;
  artifact: Artifact;
}

export interface OwnerSettings {
  languages: string[];
  frameworks: string[];
  retentionDays: number;
  notificationsEnabled: boolean;
}

export interface UserSettings { locale: "english" | "hinglish"; }
export interface ModeChangeEvent {
  owner: string;
  from: "conversation" | "execution";
  to: "conversation" | "execution";
  timestamp: number;
  reason: string;
}

const defaults: OwnerSettings = {
  languages: ["TypeScript", "Python", "Go"],
  frameworks: ["Node.js", "FastAPI", "Go standard library"],
  retentionDays: 30,
  notificationsEnabled: true,
};

// This adapter is Redis-backed whenever REDIS_URL is configured. The memory
// fallback exists only for local replay, where no durable service is available.
const redisUrl = typeof process === "undefined" ? undefined : process.env.REDIS_URL;
const storage: StorageAdapter<unknown> = redisUrl
  ? new RedisSessionStorage<unknown>(createRedisClient(redisUrl), "codescaffold:")
  : new MemorySessionStorage<unknown>();

function createRedisClient(url: string) {
  let client: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<unknown>;
    del(key: string): Promise<unknown>;
    keys(pattern: string): Promise<string[]>;
  } | undefined;
  const ready = async (): Promise<NonNullable<typeof client>> => {
    if (!client) {
      // Keep the Node-only Redis client out of the Cloudflare bundle. This
      // branch is unreachable there (redisUrl is undefined), while Node loads
      // the real client only when durable Redis has been configured.
      const load = new Function("name", "return import(name)") as (name: string) => Promise<typeof import("ioredis")>;
      const mod = await load("ioredis");
      const Redis = (mod.default ?? mod) as unknown as new (u: string) => typeof client;
      client = new Redis(url);
    }
    return client!;
  };
  return {
    get: async (key: string) => (await ready()).get(key),
    set: async (key: string, value: string) => (await ready()).set(key, value),
    del: async (key: string) => (await ready()).del(key),
    // Required by the toolkit adapter interface. Domain reads always use the
    // explicit project indexes above; this method is never used to enumerate data.
    keys: async (key: string) => (await ready()).keys(key),
  };
}

async function read<T>(key: string): Promise<T | undefined> {
  return (await storage.read(key)) as T | undefined;
}
async function write<T>(key: string, value: T): Promise<void> {
  await storage.write(key, value);
}
function projectKey(id: string) { return `project:${id}`; }
function userIndex(owner: string) { return `owner:${owner}:projects`; }
function userSettingsKey(owner: string) { return `user:${owner}:settings`; }

export async function userLocale(owner: string): Promise<"english" | "hinglish"> {
  return (await read<UserSettings>(userSettingsKey(owner)))?.locale ?? "english";
}
export async function saveUserLocale(owner: string, locale: "english" | "hinglish"): Promise<void> {
  await write(userSettingsKey(owner), { locale });
}

/** Bounded analytics, kept behind an explicit index rather than a key scan. */
export async function recordModeChange(event: ModeChangeEvent): Promise<void> {
  const previous = (await read<ModeChangeEvent[]>("mode-change-events")) ?? [];
  await write("mode-change-events", [event, ...previous].slice(0, 500));
}

export async function settings(): Promise<OwnerSettings> {
  return (await read<OwnerSettings>("settings")) ?? defaults;
}
export async function saveSettings(next: OwnerSettings): Promise<void> { await write("settings", next); }
export async function projectsFor(owner: string, now: number): Promise<ProjectRecord[]> {
  const ids = (await read<string[]>(userIndex(owner))) ?? [];
  const records = await Promise.all(ids.map((id) => read<ProjectRecord>(projectKey(id))));
  return records.filter((record): record is ProjectRecord => Boolean(record && record.artifact.expiresAt > now));
}
export async function saveProject(record: ProjectRecord): Promise<void> {
  await write(projectKey(record.id), record);
  const index = (await read<string[]>(userIndex(record.owner))) ?? [];
  if (!index.includes(record.id)) await write(userIndex(record.owner), [...index, record.id]);
}
export async function recentProjects(now: number, max = 10): Promise<ProjectRecord[]> {
  const ids = (await read<string[]>("recent-projects")) ?? [];
  const records = await Promise.all(ids.map((id) => read<ProjectRecord>(projectKey(id))));
  return records.filter((record): record is ProjectRecord => Boolean(record && record.artifact.expiresAt > now)).slice(0, max);
}
export async function recordRecent(id: string): Promise<void> {
  const previous = (await read<string[]>("recent-projects")) ?? [];
  await write("recent-projects", [id, ...previous.filter((item) => item !== id)].slice(0, 50));
}
export async function saveSnippet(owner: string, params: SnippetParameters, now: number): Promise<Artifact> {
  const cfg = await settings();
  const id = `snippet-${now}-${owner}`;
  const artifact = artifactFor(id, owner, "snippet", now, cfg.retentionDays, `${params.type} in ${params.language}`);
  await write(`artifact:${id}`, artifact);
  return artifact;
}
export function artifactFor(id: string, owner: string, kind: Artifact["kind"], now: number, retentionDays: number, title: string): Artifact {
  return {
    id,
    url: "Telegram document delivery",
    readme: `# ${title}\n\nGenerated by CodeScaffold.`,
    installationInstructions: "Download the delivered archive, then follow its README to install dependencies and start the project.",
    timestamp: now,
    expiresAt: now + retentionDays * 24 * 60 * 60 * 1000,
    owner,
    kind,
  };
}

export function projectDocument(params: ProjectParameters, locale: "english" | "hinglish" = "english"): string {
  const features = params.features.length ? params.features.join(", ") : "No optional features";
  if (locale === "hinglish") return `# ${params.name}\n\nGenerated scaffold\n\n- Language: ${params.language}\n- Framework: ${params.framework}\n- Features: ${features}\n- License: ${params.license}\n- CI: ${params.ci}\n- Tests: ${params.tests}\n\n## Install\n\nApne ${params.framework} setup ko follow karo, dependencies install karo, phir configured test command run karo.\n`;
  return `# ${params.name}\n\nGenerated scaffold\n\n- Language: ${params.language}\n- Framework: ${params.framework}\n- Features: ${features}\n- License: ${params.license}\n- CI: ${params.ci}\n- Tests: ${params.tests}\n\n## Install\n\nFollow your ${params.framework} setup, install dependencies, then run the configured test command.\n`;
}

export function snippetDocument(params: SnippetParameters): string {
  return `// ${params.type} generated for ${params.language}\n// Requirements: ${params.requirements}\n\nexport function generatedSnippet<T>(value: T): T {\n  return value;\n}\n`;
}
