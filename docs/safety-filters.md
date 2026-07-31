# Conversation routing safeguards

CodeScaffold does not use a topic blacklist or phrase stoplist. Technical,
creative, and ordinary conversational requests stay available to the normal
conversation and execution routes.

The remaining safeguards are structural rather than keyword filters:

- Telegram commands and callbacks are handled only by their registered flows.
- Owner controls require the configured `ADMIN_CHAT_ID`; the first user is
  never treated as an owner.
- Generated artifacts are limited to the requesting user's persisted records.
- External model use is opt-in, requires its deployment credential, and falls
  back to the built-in generator when unavailable.
- Bot errors and failed notifications do not expose credentials, stack traces,
  or other users' data.

Platform-policy moderation is left to Telegram and the deployment platform;
this bot does not add artificial topic restrictions on top of those controls.
