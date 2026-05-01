# LibreChat: OpenAI Compatible Only Build

**Date:** 2026-05-01
**Scope:** Strip LibreChat down to `custom` endpoint (OpenAI-compatible) only, remove external access code, lighten frontend and backend.

---

## Goal

- Enable only the `custom` endpoint (OpenAI-compatible, arbitrary `baseURL`)
- Remove code that calls or enables external third-party services
- Reduce bundle/code weight without introducing bugs
- Keep: chat, file upload, memory, MCP, local auth (email/password)
- Keep: MongoDB (required — full data layer is Mongoose-based)

---

## What Stays

| Area | Reason |
|---|---|
| `custom` endpoint client | Core feature |
| Local email/password auth | Primary login |
| File upload (local filesystem) | Chat attachment feature |
| Memory, MCP, presets, prompts | Chat support features |
| Conversation / message / settings API | Core routes |
| Full chat UI | Core screen |
| MongoDB | Required data layer |

---

## What Is Removed

### Backend

#### 1. Endpoint middleware guard
Add middleware to `api/server/` that intercepts endpoint-parameterized routes and returns 403 if `endpoint !== 'custom'`. This acts as a safety net throughout the entire removal process.

Applies to routes with an `:endpoint` path parameter. Exact routes to confirm during implementation by grepping for `router\.(post|get).*:endpoint` in `api/server/routes/`.

#### 2. Social login strategy files (delete entirely)
```
api/strategies/githubStrategy.js
api/strategies/googleStrategy.js
api/strategies/discordStrategy.js
api/strategies/facebookStrategy.js
api/strategies/appleStrategy.js
api/strategies/samlStrategy.js
api/strategies/openidStrategy.js
api/strategies/openIdJwtStrategy.js
```
- Remove corresponding `require()` and `passport.use()` calls from the passport configuration entry point
- Simplify `api/server/routes/oauth.js` — remove per-provider route handlers; retain only the error route and any shared session logic

#### 3. External API tool files (delete entirely)
```
api/app/clients/tools/structured/TavilySearch.js
api/app/clients/tools/structured/TavilySearchResults.js
api/app/clients/tools/structured/TraversaalSearch.js
api/app/clients/tools/structured/FluxAPI.js
```
- Remove exports of these tools from the tool registry index file
- No other files depend on these directly

### Frontend

#### 4. GTM / Analytics
- `client/src/components/Chat/Footer.tsx` — remove GTM initialization block
- `client/src/hooks/Config/useAppStartup.ts` — remove GTM initialization block
- `client/src/common/types.ts` — remove `google_tag_manager` field from window type

#### 5. Social login UI
- Locate social login button components in login/registration pages
- Remove GitHub, Google, Discord, Facebook, Apple, SAML provider entries
- If a component renders only social buttons and nothing else, delete the component file

#### 6. Endpoint selector UI
Remove from the endpoint dropdown and related components:
- `openAI`, `azureOpenAI`, `google`, `anthropic`, `bedrock`, `assistants`, `azureAssistants`, `agents`
- Remove per-endpoint settings panel components (Anthropic settings, Google settings, etc.)
- Remove model selector logic tied to removed endpoints

#### 7. External tool UI
- Remove Tavily, Traversaal, Flux tool entries from any tool selection UI

---

## What Is NOT Removed

| Item | Reason |
|---|---|
| `EModelEndpoint` enum and all type definitions | Shared across packages — removing causes TypeScript errors |
| Backend client code for other providers | Complex interdependencies with `@librechat/agents`; blocked by middleware instead |
| Redis, MeiliSearch, S3, Firebase code | All opt-in via env vars; no code removal needed |
| nodemailer / email code | Opt-in; keep for password reset |
| LDAP strategy | Opt-in via env var; entangled with local auth flow |

---

## Services Required

| Service | Required | Notes |
|---|---|---|
| MongoDB | ✅ Yes | Core data layer — no alternative |
| Redis | No | Set `USE_REDIS=false` (default) |
| MeiliSearch | No | Set `SEARCH=false` |
| S3 / Firebase | No | Default storage is local filesystem |
| SMTP | No | Only needed for password reset emails |

---

## Safety Principles

1. **Middleware first** — block non-custom endpoints at the API layer before touching any client code
2. **Types untouched** — never modify `EModelEndpoint`, shared schemas, or `data-provider` types
3. **Leaf files only** — only delete files that are not imported by other files, or files whose import sites are also being cleaned up in the same change
4. **No partial deletes** — if a file must stay for type reasons, leave it entirely; don't stub or gut it

---

## Out of Scope

- Docker image optimization (user does not use Docker)
- Database migration to SQLite/PostgreSQL
- Removal of backend client code for other LLM providers (Phase C — deferred)
- Redis / MeiliSearch removal
