import type { Ctx } from "./bot.js";
import { userLocale } from "./domain.js";

export type Locale = "english" | "hinglish";

const hinglish: Record<string, string> = {
  welcome: "Project scaffold banao ya focused code snippet lo.",
  help: "Menu kholne ke liye /start use karo, phir project, revision, ya code snippet choose karo. Har step par ek clear sawaal hoga. /language se English ya Hinglish choose karo.",
  newProject: "Naya project",
  snippet: "Code snippet",
  revision: "Revision maango",
  settings: "Team settings",
  language: "Language",
  helpButton: "Help",
  back: "Menu par wapas",
  chooseLanguage: "Language choose karo.",
  languageSaved: "Hinglish set ho gaya. Aage ke messages Hinglish mein aayenge.",
  languagePrompt: "Apni preferred language choose karo.",
  detected: "Hinglish detect hua. Aage ke messages Hinglish mein aayenge.",
  projectName: "Project ka naam kya hoga? Letters, numbers, hyphens, ya underscores use karo.",
  chooseFramework: "Framework choose karo.",
  chooseFeatures: "Include karne wale features choose karo. Ready ho to Done tap karo.",
  chooseLicense: "License choose karo.",
  chooseCi: "CI configuration choose karo.",
  chooseTests: "Test setup choose karo.",
  cancel: "Cancel",
  done: "Done",
  generatedProject: "Project generate ho raha hai.",
  expired: "Project setup expire ho gaya. Naya project shuru karke phir try karo.",
  invalidName: "Project name ke liye 2–64 letters, numbers, hyphens, ya underscores use karo.",
  cancelledProject: "Draft cancel ho gaya. Jab ready ho, naya project shuru kar sakte ho.",
  chooseSnippet: "Jo code snippet chahiye uska type choose karo.",
  generateMethod: "Snippet generate karne ka tareeqa choose karo.",
  requirements: "Is snippet ki requirements batao.",
  generatingSnippet: "Code snippet generate ho raha hai.",
  cancelledSnippet: "Snippet request cancel ho gayi.",
  invalidRequirements: "Snippet ko 5–1,000 characters mein describe karo.",
  noProjects: "Abhi koi active project nahi hai — pehle project banao, phir revision maang sakte ho.",
  chooseProject: "Revise karne ke liye project choose karo.",
  changes: "Jo changes chahiye woh batao. Framework, feature, CI, ya test changes include karo.",
  revisionCancelled: "Revision request cancel ho gayi.",
  generatingRevision: "Revised project generate ho raha hai.",
  invalidChanges: "Changes 5–1,000 characters mein describe karo.",
  generateProject: "Project generate karo",
  generateRevision: "Revision generate karo",
  requestRevision: "Revision maango",
  mainMenu: "Main menu",
};

export async function locale(ctx: Ctx): Promise<Locale> {
  return ctx.from ? userLocale(String(ctx.from.id)) : "english";
}

export function tr(localeName: Locale, key: string, english: string): string {
  return localeName === "hinglish" ? (hinglish[key] ?? english) : english;
}

export function hasHinglish(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, " ");
  return /\b(mera|meri|kya|karna|karo|hai|hain|chahiye|banao|kaise|aur|naya)\b/.test(normalized)
    || (/\bdependencies\b/.test(normalized) && /\badd\b/.test(normalized));
}
