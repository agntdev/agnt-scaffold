# CodeScaffold Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot for small engineering teams that interactively generates code snippets and full project scaffolding. It guides users through step-by-step parameter collection, builds the project, and returns downloadable links to the completed artifacts.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- small engineering teams
- software developers
- technical teams

## Success criteria

- Users can generate and download project scaffolds with a single interaction flow
- Downloadable artifacts are available for 30 days
- Interactive parameter collection completes with minimal user effort

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **/newproject** (command, actor: user, command: /newproject) — Start a new project scaffolding flow
  - inputs: project name, language, framework, features, license, CI configuration, test configuration
  - outputs: downloadable artifact link, README file, installation instructions
- **Request Revision** (button, actor: user, callback: revision:request) — Request a revision of a previously generated project
  - inputs: project parameters to change
  - outputs: updated downloadable artifact link
- **Code Snippet** (button, actor: user, callback: snippet:request) — Request a code snippet generation
  - inputs: snippet type, language, specific requirements
  - outputs: code snippet file, usage instructions

## Flows

### Project Creation Flow
_Trigger:_ /newproject

1. Welcome message and project name collection
2. Language selection
3. Framework selection
4. Feature selection
5. License selection
6. CI configuration
7. Test configuration
8. Final confirmation
9. Generation in progress message
10. Download link delivery

_Data touched:_ Project request, Generated artifact

### Revision Request Flow
_Trigger:_ revision:request

1. Select project to revise
2. Collect changed parameters
3. Confirm changes
4. Generation in progress message
5. Download link delivery

_Data touched:_ Project request, Generated artifact

### Code Snippet Flow
_Trigger:_ snippet:request

1. Select snippet type
2. Select language
3. Collect specific requirements
4. Generate snippet
5. Delivery with instructions

_Data touched:_ Generated artifact

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`env.<KEY>` on Workers). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat ID for group notifications
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` — never ask a user, never treat whoever writes first as the admin.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Project request** _(retention: persistent)_ — Parameters collected from the user for project scaffolding
  - fields: name, language, framework, features, license, ci, tests
- **Generated artifact** _(retention: persistent)_ — Downloadable archive containing the scaffold or code sample
  - fields: url, readme, installation_instructions, timestamp, owner
- **Session** _(retention: session)_ — Interactive flow state for a user
  - fields: current_step, collected_parameters, user_id

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure default languages/frameworks
- Set artifact retention period
- Enable/disable group completion notifications
- View recent project generation history

## Notifications

- Post a short status message in the Telegram group when generation completes

## Permissions & privacy

- No user authentication required
- Artifacts are stored for 30 days
- Only group members can generate projects

## Edge cases

- User abandons interactive flow mid-session
- Multiple users generating projects simultaneously
- Invalid or conflicting project parameters

## Required tests

- Verify project generation flow from start to download link
- Test revision request with parameter changes
- Validate code snippet generation and delivery

## Assumptions

- Default languages/frameworks are sufficient for most users
- 30-day artifact retention meets user needs
- Interactive flow with one question at a time is efficient
