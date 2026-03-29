# CLAUDE.md — ValuSampleApp

## What This Is

A reference iframe application embedded inside the Valusocial platform. Demonstrates the Valu API (`@arkeytyp/valu-api`) for developers building iframe-based mini-apps. Runs in two modes: standalone (React Router) or embedded in Valusocial (iframe postMessage bridge).

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — TypeScript check + production build
- `npm run lint` — ESLint (0 warnings policy)
- `npm run preview` — Preview production build

## Tech Stack

- **React 18** + **TypeScript** (strict mode)
- **Vite 5** (build tool)
- **Tailwind CSS 3** (utility-first styling, class-based dark mode)
- **shadcn/ui** components (Radix UI + CVA) in `src/components/ui/`
- **`@arkeytyp/valu-api`** — iframe bridge to Valusocial parent
- **react-router-dom 7** — routing in standalone mode only
- **react-markdown** — documentation page renderer
- **lucide-react** — icons

## Architecture

### Dual-Mode Operation

```
Standalone (browser)          iFrame (inside Valusocial)
─────────────────────         ──────────────────────────
React Router navigation  →    ValuApi ON_ROUTE events
Local demo data          →    Real Valu API calls
localStorage files       →    CMS service calls
```

Detection: `window.self !== window.top`

### Key Directories

```
src/
├── Hooks/useValuApi.tsx          # ValuApi singleton hook (globalThis.valuApi)
├── components/
│   ├── ui/                       # shadcn/ui primitives (button, input, select, scroll-area)
│   ├── lib/utils.ts              # cn() utility for Tailwind class merging
│   ├── TopBar.tsx                # Nav header with user info + tabs
│   ├── Console.tsx               # Terminal-style command executor
│   ├── SampleApiCalls.tsx        # Quick API demo buttons
│   ├── ApplicationStorage.tsx    # File storage browser (complex)
│   ├── Documentation.tsx         # Markdown docs viewer
│   └── Footer.tsx                # Footer links
├── page.tsx                      # Root app component (mode switch + routing)
├── main.tsx                      # Entry point
└── globals.css                   # Tailwind base + custom styles
```

### Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/console` (default) | Console + SampleApiCalls | API command testing terminal |
| `/storage` | ApplicationStorage | File browser with scopes, search, pagination |
| `/documentation` | Documentation | Markdown API docs from GitHub |

## Valu API Integration Patterns

### Initialization

```typescript
const valuApi = useValuAPI();  // singleton from globalThis.valuApi

// Register app lifecycle handler
class ReactValuApp extends ValuApplication {
  async onCreate(intent) { }
  async onNewIntent(intent) { }
  onIntent(intent) { }
  onUpdateRouterContext(context) { }
  onDestroy() { }
}
valuApi.setApplication(new ReactValuApp());
```

### Common API Calls

```typescript
// Get API pointer then call methods
const usersApi = await valuApi.getApi('users');
const currentUser = await usersApi.run('current');
const icon = await usersApi.run('get-icon', { userId });

// Call a service
const result = await valuApi.callService(new Intent('CMS', 'resource-search', params));

// Send intent to another app
await valuApi.sendIntent(new Intent('textchat', 'open-channel', { userId }));

// Route management
valuApi.pushRoute('/storage');
valuApi.addEventListener(ValuApi.ON_ROUTE, (route) => { ... });
```

### Services Used

- **Users API** — `current`, `get-icon`
- **CMS Service** — `resource-search` (files by scope + query + pagination)
- **Resources Service** — `get-thumbnail-url`, `generate-direct-public-url`
- **TextChat App** — `open-channel` intent
- **VideoChat App** — default intent

## Conventions

- **Components:** PascalCase, functional only, arrow functions
- **Hooks:** `useXxx` prefix, in `src/Hooks/`
- **Types:** PascalCase interfaces inline or at file top
- **Constants:** SCREAMING_SNAKE_CASE
- **State:** React hooks only (no Redux/Zustand)
- **Styling:** Tailwind utility classes only, no CSS modules
- **Imports:** `@/` alias maps to `src/`
- **Error handling:** try/catch in async, user-friendly console output

## Parent Project

This app is registered in Valusocial as `iframe_demo_app` in `Application_Manifests_Metaverse.js`. The iframe URL is configured there. When developing locally, point it to `http://localhost:5174/` (or whatever port Vite picks).
