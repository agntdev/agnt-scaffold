import { describe, expect, it } from "vitest";
import { classifyInput, hinglishTrainingUtterances, normalizeHinglish } from "../src/nlu.js";

describe("Hinglish NLU", () => {
  it("covers a representative Hinglish corpus across the supported intents", () => {
    expect(hinglishTrainingUtterances).toHaveLength(120);
    const intents = new Set(hinglishTrainingUtterances.map(([intent]) => intent));
    expect(intents).toEqual(new Set(["conversation", "project", "snippet", "execution", "unknown"]));
  });

  it("normalizes common romanized Hindi variants without forcing English", () => {
    expect(normalizeHinglish("Mera naya project bnao, thik hai")).toBe("my new project create okay is");
    expect(classifyInput("mera naya API project banao")).toMatchObject({ language: "hinglish", intent: "project" });
    expect(classifyInput("validation function ka code likho")).toMatchObject({ language: "hinglish", intent: "snippet" });
  });

  it("keeps ambiguous Hinglish below the clarification threshold", () => {
    const result = classifyInput("kuch banana hai");
    expect(result).toMatchObject({ language: "hinglish", intent: "unknown" });
    expect(result.confidence).toBeLessThan(0.6);
  });
});
