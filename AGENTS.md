# AGENTS.md - AI Journal

## Project

- AI Journal is a local-first Japanese diary PWA with optional Gemini-assisted reflection.
- The main app is a single-file web app. Keep HTML, CSS, and JavaScript in `index.html`.
- The push notification worker is isolated under `push-server/`.
- Before changing code, read `README.md` and inspect the current Git status.
- When available on the connected host, project state is stored in `C:\Users\smzyt\OneDrive\ドキュメント\Obsidian Vault\dev-os\projects\ai-journal\`.

## Product boundaries

- Preserve the existing quiet, compact UI unless a task explicitly changes it.
- The core diary flow must work without Gemini, Google Calendar, weather, or push services.
- Never commit API keys, OAuth client IDs, VAPID private keys, tokens, diary entries, or exported backups.
- API and network failures must not prevent local diary entries from being saved.
- Keep stored data backward compatible. Add migration logic when changing the schema.
- Preserve mobile behavior at 375px width, keyboard navigation, and offline-capable core flows.

## Implementation

- Do not split `index.html` or add a frontend framework.
- Do not add a CDN or production dependency without explicit approval.
- Match existing naming, section comments, CSS variables, and interaction patterns.
- Update `APP_BUILD` and the service-worker cache name only when app assets or behavior change.
- Keep `push-server/` changes scoped to push functionality.

## Verification

- Run `npm test` for repository smoke checks.
- For UI or behavior changes, serve the repository over HTTP and inspect the affected flow at 375x812 and a desktop viewport.
- Exercise offline and API-failure behavior when the changed flow touches storage or networking.
- Run `git diff --check` and inspect `git status --short` before completion.

## Git and completion

- Use `<type>/<task-id>-<kebab-case-topic>` for task branches when a task ID exists.
- During unattended work, do not commit, push, or merge directly to `main`.
- Commit only after required checks pass. Stage only files relevant to the task.
- Stop before publishing, paid actions, secret entry, destructive user-data changes, or a materially ambiguous product decision.
- Report changed files, checks and results, unverified items, remaining risks, branch, and commit SHA.
