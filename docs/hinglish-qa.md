# Hinglish conversation QA

## Reproduction and diagnosis

Before this change, input such as `mera naya project banao` matched only a
small keyword detector. The detector set a locale and stopped processing, so
Conversation Mode never classified the intent or gave a useful follow-up.
The same early hand-off made short code-mixed messages fall into a terse,
English-only path.

The replacement normalizes common romanized Hindi variants, classifies
Hindi-English code-mix as Hinglish, records an intent/confidence result, and
keeps the user's mixed style in the reply. Low-confidence input asks one short
clarifying question instead of guessing.

## Before and after

| Input | Before | After |
| --- | --- | --- |
| `mera naya project banao` | Locale acknowledgement only | `Project ka naam kya hoga? ...` |
| `kuch banana hai` | Locale acknowledgement only | `Main context samajhna chahta hoon. Project scaffold chahiye, code snippet, ya pehle idea discuss karein?` |
| `idea weak lag raha hai` | Generic English prompt | `Achha point hai. Sabse pehle kaunsa outcome important hai, aur kaunsi constraint decision ko shape karegi?` |

## Manual checklist

- Send Hinglish greetings, project requests, snippets, and ambiguous requests.
- Confirm Hinglish intent starts the right flow and button labels stay localized.
- Confirm an ambiguous Hinglish message asks the short clarification above.
- Confirm an English exploratory message retains the professional Conversation Mode reply.
- As the configured owner, open Team settings → Conversation metrics and record a 1–5 quality rating after a sampled conversation.

## Rollback

The change is isolated to `src/nlu.ts` and Conversation Mode. Reverting those
files restores the former routing without touching project, revision, snippet,
or persisted artifact data.
