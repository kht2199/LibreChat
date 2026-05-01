# OpenAI Compatible Only Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip LibreChat to `custom` endpoint only — remove social logins, external API tools, analytics, and non-custom endpoint UI so the app is pre-configured and users only choose a model.

**Architecture:** Add an endpoint guard middleware first as a safety net, then delete isolated files (social strategies, external tools), then clean up frontend components. TypeScript types and shared schemas are never touched.

**Tech Stack:** Node.js/Express (backend), React/TypeScript (frontend), Jest (tests), passport.js (auth)

**Spec:** `docs/superpowers/specs/2026-05-01-openai-compatible-only-design.md`

---

## File Map

### Backend — delete entirely
- `api/server/socialLogins.js`
- `api/strategies/githubStrategy.js`
- `api/strategies/googleStrategy.js`
- `api/strategies/discordStrategy.js`
- `api/strategies/facebookStrategy.js`
- `api/strategies/appleStrategy.js`
- `api/strategies/samlStrategy.js`
- `api/strategies/openidStrategy.js`
- `api/strategies/openIdJwtStrategy.js`
- `api/app/clients/tools/structured/TavilySearch.js`
- `api/app/clients/tools/structured/TavilySearchResults.js`
- `api/app/clients/tools/structured/TraversaalSearch.js`
- `api/app/clients/tools/structured/FluxAPI.js`

### Backend — modify
- `api/server/routes/agents/chat.js` — add `custom`-only guard before `router.post('/:endpoint',...)`
- `api/server/index.js` — remove `configureSocialLogins` import and call
- `api/strategies/index.js` — remove social strategy exports, keep `passportLogin`, `jwtLogin`, `ldapLogin`
- `api/server/routes/oauth.js` — replace entire file with error-only router
- `api/app/clients/tools/index.js` — remove Tavily/Traversaal/Flux require and exports

### Frontend — delete entirely
- `client/src/components/Auth/SocialLoginRender.tsx`
- `client/src/components/Auth/SocialButton.tsx`

### Frontend — modify
- `client/src/components/Chat/Footer.tsx` — remove GTM block
- `client/src/hooks/Config/useAppStartup.ts` — remove GTM block
- `client/src/common/types.ts` — remove `google_tag_manager` field
- `client/src/components/Auth/AuthLayout.tsx` — remove `SocialLoginRender` import and usage
- `client/src/components/Auth/Login.tsx` — remove `SocialButton` import and usage

### Config — create
- `librechat.yaml` — server default config with `custom` endpoint

---

## Task 1: Endpoint guard middleware

**Files:**
- Modify: `api/server/routes/agents/chat.js`
- Create: `api/server/routes/agents/__tests__/chat.endpoint-guard.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api/server/routes/agents/__tests__/chat.endpoint-guard.test.js
const request = require('supertest');
const express = require('express');

// Minimal router under test — isolate the guard only
const chat = require('../chat');

const app = express();
app.use(express.json());

// Stub the middleware chain that chat.js uses (moderateText, checkAgentAccess, etc.)
// We only want to test the guard, so we short-circuit everything with a simple 200 after the guard
jest.mock('~/server/middleware', () => ({
  moderateText: (req, res, next) => next(),
  validateConvoAccess: (req, res, next) => next(),
  buildEndpointOption: (req, res, next) => next(),
}));
jest.mock('@librechat/api', () => ({
  generateCheckAccess: () => () => (req, res, next) => next(),
  skipAgentCheck: false,
}));
jest.mock('librechat-data-provider', () => ({
  PermissionTypes: {},
  Permissions: {},
  PermissionBits: { VIEW: 1 },
}));
jest.mock('~/server/middleware', () => ({
  moderateText: (req, res, next) => next(),
  validateConvoAccess: (req, res, next) => next(),
  buildEndpointOption: (req, res, next) => next(),
}));
jest.mock('~/server/services/Endpoints/agents', () => ({ initializeClient: jest.fn() }));
jest.mock('~/server/controllers/agents/request', () => jest.fn((req, res) => res.status(200).json({ ok: true })));
jest.mock('~/server/services/Endpoints/agents/title', () => jest.fn());
jest.mock('~/models', () => ({ getRoleByName: jest.fn() }));

app.use('/', chat);

describe('endpoint guard', () => {
  it('returns 403 for non-custom endpoint', async () => {
    const res = await request(app).post('/openAI').send({});
    expect(res.status).toBe(403);
  });

  it('returns 403 for anthropic endpoint', async () => {
    const res = await request(app).post('/anthropic').send({});
    expect(res.status).toBe(403);
  });

  it('passes through for custom endpoint', async () => {
    const res = await request(app).post('/custom').send({});
    // guard passes → controller mock returns 200
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/htkim/IdeaProjects/LibreChat/api && npx jest routes/agents/__tests__/chat.endpoint-guard --no-coverage 2>&1 | tail -20
```
Expected: FAIL — `custom` endpoint returns 200 but non-custom endpoints also pass through (guard doesn't exist yet).

- [ ] **Step 3: Add guard to `api/server/routes/agents/chat.js`**

Open `api/server/routes/agents/chat.js`. After line `router.use(buildEndpointOption);` and before the existing `router.post('/:endpoint', controller)`, add:

```js
router.post('/:endpoint', (req, res, next) => {
  if (req.params.endpoint !== 'custom') {
    return res.status(403).json({ error: 'Endpoint not available' });
  }
  next();
}, controller);
```

Also **remove** the existing `router.post('/:endpoint', controller);` line (it is now replaced by the guarded version above).

The final route block in the file should look like:

```js
router.post('/', controller);

router.post('/:endpoint', (req, res, next) => {
  if (req.params.endpoint !== 'custom') {
    return res.status(403).json({ error: 'Endpoint not available' });
  }
  next();
}, controller);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/htkim/IdeaProjects/LibreChat/api && npx jest routes/agents/__tests__/chat.endpoint-guard --no-coverage 2>&1 | tail -20
```
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add api/server/routes/agents/chat.js api/server/routes/agents/__tests__/chat.endpoint-guard.test.js
git commit -m "feat: block non-custom endpoints with 403 guard"
```

---

## Task 2: Delete social login configuration

**Files:**
- Delete: `api/server/socialLogins.js`
- Modify: `api/server/index.js`
- Replace: `api/server/routes/oauth.js`

- [ ] **Step 1: Remove `configureSocialLogins` from `api/server/index.js`**

In `api/server/index.js`, find and remove these two lines:

```js
// Line ~34 — remove this import:
const configureSocialLogins = require('./socialLogins');

// Line ~145 — remove this call:
    await configureSocialLogins(app);
```

- [ ] **Step 2: Delete `api/server/socialLogins.js`**

```bash
rm /Users/htkim/IdeaProjects/LibreChat/api/server/socialLogins.js
```

- [ ] **Step 3: Replace `api/server/routes/oauth.js` with error-only router**

The existing file has 203 lines of per-provider OAuth routes. Replace the entire file with:

```js
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { ErrorTypes } = require('librechat-data-provider');

const router = express.Router();

const domains = {
  client: process.env.DOMAIN_CLIENT,
};

router.get('/error', (req, res) => {
  const errorMessage = req.session?.messages?.pop() || 'Unknown OAuth error';
  logger.error('Error in OAuth authentication:', { message: errorMessage });
  res.redirect(`${domains.client}/login?redirect=false&error=${ErrorTypes.AUTH_FAILED}`);
});

module.exports = router;
```

- [ ] **Step 4: Run API tests to verify nothing breaks**

```bash
cd /Users/htkim/IdeaProjects/LibreChat/api && npx jest --no-coverage 2>&1 | tail -30
```
Expected: all existing tests pass (social login tests, if any, will be gone since the files are deleted).

- [ ] **Step 5: Commit**

```bash
git add api/server/index.js api/server/routes/oauth.js
git rm api/server/socialLogins.js
git commit -m "feat: remove social login configuration and OAuth provider routes"
```

---

## Task 3: Delete social login strategy files

**Files:**
- Modify: `api/strategies/index.js`
- Delete: `api/strategies/githubStrategy.js`, `googleStrategy.js`, `discordStrategy.js`, `facebookStrategy.js`, `appleStrategy.js`, `samlStrategy.js`, `openidStrategy.js`, `openIdJwtStrategy.js`

- [ ] **Step 1: Replace `api/strategies/index.js` with minimal exports**

Replace the entire file with:

```js
const passportLogin = require('./localStrategy');
const ldapLogin = require('./ldapStrategy');
const jwtLogin = require('./jwtStrategy');

module.exports = {
  passportLogin,
  ldapLogin,
  jwtLogin,
};
```

- [ ] **Step 2: Delete the social strategy files**

```bash
rm api/strategies/githubStrategy.js \
   api/strategies/googleStrategy.js \
   api/strategies/discordStrategy.js \
   api/strategies/facebookStrategy.js \
   api/strategies/appleStrategy.js \
   api/strategies/samlStrategy.js \
   api/strategies/openidStrategy.js \
   api/strategies/openIdJwtStrategy.js
```

- [ ] **Step 3: Run API tests**

```bash
cd /Users/htkim/IdeaProjects/LibreChat/api && npx jest --no-coverage 2>&1 | tail -30
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add api/strategies/index.js
git rm api/strategies/githubStrategy.js \
       api/strategies/googleStrategy.js \
       api/strategies/discordStrategy.js \
       api/strategies/facebookStrategy.js \
       api/strategies/appleStrategy.js \
       api/strategies/samlStrategy.js \
       api/strategies/openidStrategy.js \
       api/strategies/openIdJwtStrategy.js
git commit -m "feat: remove social login strategy files"
```

---

## Task 4: Delete external API tool files

**Files:**
- Modify: `api/app/clients/tools/index.js`
- Delete: `api/app/clients/tools/structured/TavilySearch.js`, `TavilySearchResults.js`, `TraversaalSearch.js`, `FluxAPI.js`

- [ ] **Step 1: Remove tool references from `api/app/clients/tools/index.js`**

Open `api/app/clients/tools/index.js`. Remove the `require` lines and any `module.exports` entries for:
- `FluxAPI`
- `TraversaalSearch`
- `TavilySearchResults`
- `TavilySearch` / `createTavilySearchTool`

Verify the remaining file compiles:

```bash
node -e "require('./api/app/clients/tools/index.js'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 2: Delete the tool files**

```bash
rm api/app/clients/tools/structured/TavilySearch.js \
   api/app/clients/tools/structured/TavilySearchResults.js \
   api/app/clients/tools/structured/TraversaalSearch.js \
   api/app/clients/tools/structured/FluxAPI.js
```

- [ ] **Step 3: Run API tests**

```bash
cd /Users/htkim/IdeaProjects/LibreChat/api && npx jest --no-coverage 2>&1 | tail -30
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add api/app/clients/tools/index.js
git rm api/app/clients/tools/structured/TavilySearch.js \
       api/app/clients/tools/structured/TavilySearchResults.js \
       api/app/clients/tools/structured/TraversaalSearch.js \
       api/app/clients/tools/structured/FluxAPI.js
git commit -m "feat: remove external API tool files (Tavily, Traversaal, FluxAPI)"
```

---

## Task 5: Remove GTM / analytics from frontend

**Files:**
- Modify: `client/src/components/Chat/Footer.tsx`
- Modify: `client/src/hooks/Config/useAppStartup.ts`
- Modify: `client/src/common/types.ts`

- [ ] **Step 1: Remove GTM block from `client/src/components/Chat/Footer.tsx`**

Find and delete the `useEffect` block that references `analyticsGtmId`:

```ts
// DELETE this entire useEffect block:
useEffect(() => {
  if (config?.analyticsGtmId != null && typeof window.google_tag_manager === 'undefined') {
    // ... GTM initialization
    gtmId: config.analyticsGtmId,
    // ...
  }
}, [config?.analyticsGtmId]);
```

Also remove any `import` of the GTM library (`@gtm-support/react-gtm-module` or similar) in that file.

- [ ] **Step 2: Remove GTM block from `client/src/hooks/Config/useAppStartup.ts`**

Find and delete the `useEffect` block that references `analyticsGtmId`:

```ts
// DELETE this entire useEffect block:
useEffect(() => {
  if (startupConfig?.analyticsGtmId != null && typeof window.google_tag_manager === 'undefined') {
    // ... GTM initialization
    gtmId: startupConfig.analyticsGtmId,
    // ...
  }
}, [startupConfig?.analyticsGtmId]);
```

Also remove any GTM library import in that file.

- [ ] **Step 3: Remove `google_tag_manager` from `client/src/common/types.ts`**

Find the Window interface extension and remove the `google_tag_manager` property:

```ts
// REMOVE this line:
google_tag_manager?: unknown;
```

- [ ] **Step 4: Build frontend to verify no TypeScript errors**

```bash
cd /Users/htkim/IdeaProjects/LibreChat && npm run build:data-provider 2>&1 | tail -10
cd client && npx tsc --noEmit 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Chat/Footer.tsx \
        client/src/hooks/Config/useAppStartup.ts \
        client/src/common/types.ts
git commit -m "feat: remove Google Tag Manager / analytics from frontend"
```

---

## Task 6: Remove social login UI

**Files:**
- Delete: `client/src/components/Auth/SocialLoginRender.tsx`
- Delete: `client/src/components/Auth/SocialButton.tsx`
- Modify: `client/src/components/Auth/AuthLayout.tsx`
- Modify: `client/src/components/Auth/Login.tsx`

- [ ] **Step 1: Update `client/src/components/Auth/AuthLayout.tsx`**

Remove the `SocialLoginRender` import and its JSX usage:

```ts
// REMOVE this import:
import SocialLoginRender from './SocialLoginRender';

// REMOVE this JSX line:
<SocialLoginRender startupConfig={startupConfig} />
```

- [ ] **Step 2: Update `client/src/components/Auth/Login.tsx`**

Remove the `SocialButton` import and any JSX that renders `<SocialButton ...>` for OAuth providers.

```ts
// REMOVE:
import SocialButton from '~/components/Auth/SocialButton';

// REMOVE all <SocialButton ... /> usages in the JSX
```

- [ ] **Step 3: Delete the social component files**

```bash
rm client/src/components/Auth/SocialLoginRender.tsx \
   client/src/components/Auth/SocialButton.tsx
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
cd /Users/htkim/IdeaProjects/LibreChat/client && npx tsc --noEmit 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Auth/AuthLayout.tsx \
        client/src/components/Auth/Login.tsx
git rm client/src/components/Auth/SocialLoginRender.tsx \
       client/src/components/Auth/SocialButton.tsx
git commit -m "feat: remove social login buttons from auth UI"
```

---

## Task 7: Remove endpoint selector from chat UI

**Files:**
- Modify: `client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx`

The goal is to keep the model selector (so users can choose a model) but remove the endpoint selection UI. Since only `custom` will be in `endpointsConfig`, `getDefaultEndpoint` will auto-select it — so the endpoint dropdown itself is never shown.

- [ ] **Step 1: Inspect which component renders the endpoint dropdown**

```bash
grep -rn "mappedEndpoints\|EndpointItem\|endpointIndex" /Users/htkim/IdeaProjects/LibreChat/client/src/components/Chat/Menus/Endpoints/ --include="*.tsx" | head -20
```

This tells you which JSX renders the per-endpoint items.

- [ ] **Step 2: Remove endpoint iteration from the render**

In the component that maps over `mappedEndpoints` to render endpoint choices, remove the mapping/rendering of all non-`custom` entries. The simplest approach: if `mappedEndpoints` has only one entry (which it will after server config), the endpoint dropdown either won't render or will show a single locked entry.

If a component renders the endpoint dropdown list, wrap or guard it:

```ts
// In the component that renders endpoint items, filter to custom only:
const visibleEndpoints = mappedEndpoints.filter(
  (ep) => ep.value === 'custom' || ep.value?.startsWith('custom:'),
);
// Use visibleEndpoints instead of mappedEndpoints for the dropdown
```

If the endpoint dropdown only renders when there are 2+ endpoints, no code change is needed — just verify it hides with a single endpoint.

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd /Users/htkim/IdeaProjects/LibreChat/client && npx tsc --noEmit 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx
git commit -m "feat: filter endpoint selector to custom only"
```

---

## Task 8: Create server default `librechat.yaml`

**Files:**
- Create: `librechat.yaml` (project root)

- [ ] **Step 1: Create `librechat.yaml`**

```yaml
version: 1.2.1

cache: true

interface:
  endpointSelector: false   # hide endpoint dropdown; only model selector visible

endpoints:
  custom:
    - name: 'My API'
      apiKey: '${CUSTOM_API_KEY}'
      baseURL: '${CUSTOM_API_BASE_URL}'
      models:
        default:
          - 'default-model'   # shown before /models fetch completes
        fetch: true            # fetches model list from GET {baseURL}/models at startup
      titleConvo: true
      modelDisplayLabel: 'My API'

registration:
  socialLogins: []   # disable all social login buttons (belt-and-suspenders)
```

Add to `.env` (or `.env.example`):

```
CUSTOM_API_KEY=your-api-key-here
CUSTOM_API_BASE_URL=http://localhost:8000/v1
```

- [ ] **Step 2: Verify yaml is valid**

```bash
cd /Users/htkim/IdeaProjects/LibreChat && node -e "
const yaml = require('js-yaml');
const fs = require('fs');
yaml.load(fs.readFileSync('librechat.yaml', 'utf8'));
console.log('yaml valid');
"
```
Expected: `yaml valid`

- [ ] **Step 3: Commit**

```bash
git add librechat.yaml .env.example
git commit -m "feat: add default librechat.yaml for custom endpoint with model fetch"
```

---

## Verification

After all tasks are complete, do a final smoke-check:

```bash
# Backend starts without errors
cd /Users/htkim/IdeaProjects/LibreChat && npm run backend 2>&1 | head -30

# No references to deleted strategy files remain
grep -r "githubStrategy\|googleStrategy\|discordStrategy\|facebookStrategy\|appleStrategy\|samlStrategy\|openidStrategy\|openIdJwtStrategy" api/ --include="*.js" | grep -v node_modules

# No references to deleted tool files remain
grep -r "TavilySearch\|TraversaalSearch\|FluxAPI" api/app/clients/ --include="*.js" | grep -v node_modules

# Frontend builds cleanly
cd client && npx tsc --noEmit 2>&1 | tail -5
```
