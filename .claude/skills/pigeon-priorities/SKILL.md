---
name: pigeon-priorities
description: Activate for any task on the Pigeon codebase — API testing/automation tool (Express + React). Drives task triage priority order (security/data-loss > bug > feature > refactor > docs), repo conventions, reuse-vs-add decisions, and UI/styling discipline using ONLY the project's existing BLUE palette tokens + reusable components (never introduce off-palette colors, never run dev servers/npm start/build, never drive the browser). Triggered by /pigeon or keywords: pigeon, protocol tester, graphql, grpc, soap, mqtt, websocket, sse, performance test, load test, ai agent tools, marketplace, explore page, dashboard, contract diff.
---

# Pigeon Priorities

Pigeon = Express + React API testing & automation tool. Multi-protocol testers (REST, GraphQL, gRPC, SOAP, MQTT, WebSocket, SSE), performance/load testing, contract diffing, AI agent tools, marketplace. This skill encodes HOW to work on it, in WHAT order, with WHAT guardrails. Invoke on every Pigeon task.

## 1. Priority Order (the ladder)

Work top-down. Never skip a higher rung for a lower one.

1. **Security & data loss** — leaked secrets, auth bypass, destructive mutation without guardrails, unvalidated input at trust boundaries (routes, sockets, file uploads). Block everything else.
2. **Bugs** — wrong output, crashes, silent-failure-swallowed errors. Reproduce first.
3. **User-facing features** — things the operator sees/uses.
4. **Refactors / code health** — only if not changing behavior, and only if asked or blocking real work.
5. **Docs / style polish** — last. Never create docs unless explicitly requested (project rule).

**Hard invariants** (never simplify away):
- Validate input at system boundaries (routes, socket handlers, uploads, CLI args).
- Error handling that prevents data loss — never swallow to `undefined`/empty fallback silently.
- Accessibility: keyboard nav, focus rings, ARIA on protocol testers & forms, color contrast.
- Anything explicitly requested by the user.

State the priority rung you're on before acting. If a task mixes rungs, split it and name them.

## 2. Ask-Before-Act (big changes only)

- **Tiny fix / single-line / obvious bug** → act, then report. No pause.
- **Multi-file, new feature, or style/UI redesign** → STOP. Ask the user:
  1. *What kind of update?* (bug fix vs new feature vs style redesign vs refactor)
  2. *Scope* (single component vs whole section vs full page)
  3. For UI redesign only: offer 2026 style options (see §5) and ask which.
- Do not over-ask. Respect the project rule: *do what was asked, nothing more, nothing less.*

## 3. Reuse-or-Add Decision Tree

Before writing **any** new code or file, walk this tree:

1. **Is this a one-line/trivial fix in an existing file?** → Edit in place. Done.
2. **Does an existing reusable component/util solve it?** → Reuse (see §4 inventory). Alter only if user explicitly asks.
3. **Missing capability — does a sibling file already do 80% of it?** → Copy the sibling's pattern, extend minimally. Prefer editing over new file.
4. **Genuinely new, justified?** → New file under the correct dir (see §6 layout). State why a new file is needed out loud.
5. **Am I about to create scaffolding "for later" / an interface with one impl / a factory for one product?** → STOP. Don't. YAGNI.

**Match existing style while reusing**: read the target file (and 1–2 neighbors) for naming, comment density, indentation, idiom. Write code that reads like the surrounding code.

## 4. Reusable Component Inventory (prefer these — do not reinvent)

`client/src/components/common/`:
- `Button` (variants, hover/focus) — **default for all buttons**
- `Modal` — overlays; used for forms like "Create New Test"
- `AppSelect` / `Select` / `ModernDropdown` — dropdowns
- `TabBar` — tabbed sections
- `UrlBar` / `MethodBadge` (HTTP method chips) — request builders
- `LatencyBadge` — perf metrics display
- `MainShell` / `PageShell` — page wrappers (use for layout, don't hand-roll)
- `PageLoader` — loading states

Libraries already installed — use instead of hand-rolling:
- Charts → `chart.js` (perf dashboards already use it)
- Code editor → `@monaco-editor/react`
- Graphs/flows → `cytoscape` + `cytoscape-dagre`
- PDF → `pdfkit` / `html-pdf-node` / `jspdf` / `md-to-pdf`
- Icons → whatever is already imported in the neighbor file (check before adding a new icon lib)

## 5. UI / Styling Discipline

### Tokens — read & match the project's blue palette, never introduce off-palette colors

**Hard rule: the project uses a Blue palette. Use only the existing blue-based tokens. Do NOT introduce green/teal/purple gradients or random accent colors; do NOT switch to a dark-theme-default. Status colors (success/warning/danger) remain as-is.**

1. **Read first**: `client/src/index.css` defines the centralized blue token system (light theme default; dark theme available but stay on light default unless user asks). Match these.
2. **Only if blue tokens are genuinely missing** → propose a blue-consistent value and **ask before applying**. Never invent off-palette colors.

Canonical blue tokens (from `index.css`) — use these:
```
--primary-color: #014C75   --primary-hover: #013B5B   --primary-light: #E5F3FF
--accent: var(--primary-color)        /* the blue accent — accent for all primary UI */
--info-color: #014C75  --info-light: #E5F3FF         /* also blue */
--background-color, --card-bg / --card-background, --hover-bg / --hover-background
--text-color, --text-secondary, --text-muted
--border-color   --card-shadow: 0 1px 3px rgba(0,0,0,.08)
--radius-sm:8px  --radius-md:12px  --radius-lg:16px  --radius-xl:22px
--success-color:#28a745  --warning-color:#ffc107  --danger-color:#dc3545   (status only)
Fonts: Inter (400-700) body, Roboto Mono (code/metrics)
```
Per-section local tokens (match the section's own, and keep them blue-anchored): e.g. `PerformanceTestsPage.css` uses `--pt-accent` (defaults to `--accent` = blue), `--pt-radius`(18px), `--pt-radius-sm`(12px), `--pt-hairline`, `--pt-surface`, `--pt-inset`, `--pt-mono`. Mirror these names inside perf-section work; fall back to global blue tokens otherwise. Glows/tints must derive from the blue accent via `color-mix(in srgb, var(--accent) 10%, transparent)`, not a foreign hue.

### Core component styles (apply on new UI)

- **Button**: variant by intent (primary=`--accent` the blue, ghost=transparent+`--border-color`, danger=`--danger-color`). Always hover + focus-visible ring. 2026: subtle scale (1.02) / blue border-glow on hover, `prefers-reduced-motion` respected.
- **Card**: `--card-bg`, `--radius-lg`, `--card-shadow`, 1px `--border-color`. Hover → lift shadow; blue hairline/glow optional.
- **Modal**: overlay blur, `--radius-xl`, `--card-bg`, ESC + backdrop-click to close, focus-trap.
- **Input/Select**: `--radius-sm`, focused → blue `--accent` ring. Erroneous → `--danger-color`.
- **Table**: hairline rows (`--border-color`), sticky header, zebra optional via `--hover-bg`.
- **Tabs**: active = blue `--accent` underline/pill, inactive = `--text-secondary`.

### Dashboard / monitoring section layout (blue theme, light default)

Use this pattern for monitoring pages, performance dashboards, and their inner sections (teams, metrics, alerts, logs, runs):
```
[ sticky topbar: title + live status + primary actions (blue buttons) ]
[ KPI row: 3-4 metric cards (big number + trend + mini-sparkline) ]
[ main grid: left = primary chart/timeline (2/3 width), right = side panel (1/3) ]
[ secondary grid: charts/widgets row, equal cards ]
[ data table: recent runs/events, sticky header, row-density toggle ]
```
- Light monitoring theme (default): elevated surfaces (`--pt-surface`/`--card-bg`), hairline borders, blue accent-tinted glows (`color-mix(in srgb, var(--pt-accent) 10-12%, transparent)`, blue), mono font (`--pt-mono`) for metrics/latency. Dark theme only if user explicitly asks.
- Live data → smooth transitions, not jumps. Charts: chart.js, re-render on data, axis in `--text-muted`, primary series in blue `--accent`, status series in success/warning/danger.
- Inner sections (teams, alerts, logs): each gets its card with a header row + body. Reuse `PageShell`/`MainShell` for outer chrome.

### When (and only when) redesigning → offer blue-palette layout options

If the user wants a style update, offer blue-palette *layout* directions (never off-palette colors — the hue stays blue):
- **"Observability (light blue)"** — the monitoring layout above (default for perf/protocol pages): KPI cards, charts, data table, blue accents.
- **"Clean SaaS (blue)"** — light, large radius, soft shadows, generous whitespace (marketplace/explore).
- **"Data-viz (blue)"** — bold type, big metric numbers, animated grid, blue primary series + status-color coded series (alerts/health).

All three stay on the blue palette. Ask which for the specific page; pick per-page based on purpose (testing/dashboard=observability, marketplace=clean SaaS). Dark theme only if user explicitly asks, and even then keep it blue-anchored (`--primary-color` family).

## 6. Repo Layout & Conventions

Backend (Express, root):
- `routes/` — all Express routers. New endpoints here.
- `models/` — Mongoose schemas (e.g. `LoadTestRun.js`).
- `features/` — domain logic (e.g. `performance-testing/LoadTestRunner.js`, `PerformanceAnalyzer.js`).
- `middleware/` — auth, validation, error handling.
- `services/`, `utils/`, `schemas/`, `config/`, `scripts/`, `cli/`, `views/` (EJS).
- `server.js` / `server/` — entrypoints and socket setup.
- Entry: `server.js` → `app.listen` + `utils/socket/socket-server.js` (socket.io).

Frontend (`client/`):
- `client/src/components/` — React components by domain.
  - `Protocols/` — REST/GraphQL/gRPC/SOAP/MQTT/WebSocket/SSE testers + `ProtocolSelector`, `ProtocolConverterUI`.
  - `GraphQL/` — GraphQLTester.
  - `performanceTesting/` — PerformanceTestsPage (dashboard, modal for "Create New Test").
  - `marketplace/` — ExplorePage, etc.
  - `common/` — reusable primitives (see §4).
- Each component = `.js` + `.css` co-located. Match existing structure when adding.

Rules:
- Keep files **under 500 lines**. Split if larger.
- **NEVER create files unless absolutely necessary** — edit existing first.
- **NEVER commit secrets / .env.**
- **NEVER add a Co-Authored-By trailer** to commits (project rule).
- Prefix CSS class names per the section's convention (perf uses `.pt-*`; protocols use their own). Don't introduce a new prefix for one file.

## 7. Build / Test / Verify (mandate)

- **NEVER run the app or dev servers.** Do NOT execute `npm start`, `npm run dev`, `npm run build`, `node server.js`, `cd client && npm start`, or any other command that boots the app/servers. The user runs and verifies changes themselves; you write code, you do not launch it. (If the user explicitly asks you to run a command, still prefer handing it to them via the `! <command>` prompt prefix.)
- Tests: `npm test` (jest, `--passWithNoTests`) is allowed ONLY if the user asks for tests to be run; otherwise assume the user will run them. Test files go in `tests/` or beside the component, never in root.
- **Do NOT open or drive the browser.** Do NOT use `chrome-devtools` or `playwright` MCP tools to screenshot, navigate, or verify UI. Visual verification is the user's job. You may *read* existing screenshot files the user has shared for context, but do not launch/click/screenshot the app.
- After a change: report what you changed and let the user run `npm run dev` to verify. Do not claim "verified" — you didn't run it. State plainly: "not run/false — please verify with npm run dev."

## 8. Domain Gotchas

### Protocol testers (`components/Protocols/`)
Each protocol has a paired `.js`+`.css`. Real libs: `grpc` (`@grpc/grpc-js`+`proto-loader`), `soap`, `mqtt`, `ws`+`socket.io`, `eventsource` (SSE), `graphql`+`graphql-ws`. Don't reinvent client logic — wire to the installed lib. `ProtocolSelector` and `ProtocolConverterUI` are shared chrome; reuse, don't duplicate. MethodBadge for HTTP verbs.

### Performance testing
- `autocannon` drives load. Results stream over socket.io (`utils/socket/socket-server.js`) — verify the channel name before adding emits.
- `models/LoadTestRun.js` schema; `features/performance-testing/LoadTestRunner.js` (run) + `PerformanceAnalyzer.js` (analyze). `routes/performanceTesting.js` router.
- Frontend `PerformanceTestsPage` = dashboard; "Create New Test" is a **modal overlay** (not inline) — keep it that way. Charts via chart.js; metric cards + split resource charts are the recent redesign pattern.

### AI agent tools + marketplace
- AI via `ai` + `@ai-sdk/openai` packages. Don't reach for other LLM SDKs.
- `components/AIAgentToolsSection*` and `components/marketplace/ExplorePage`. Note: there are "- Copy" variants in working tree from prior sessions — prefer the canonical (non-Copy) file when editing, confirm with user if ambiguous.
- Marketplace/explore = "Clean SaaS" styling candidate, not monitoring-dark.

### Backend: DB / auth / routes
- MongoDB via `mongoose`; redis client installed; `mongodb-memory-server` for tests.
- Auth: `passport` + `passport-google-oauth20` + `express-session`. Sessions — don't break session cookies when touching auth/middleware.
- Routes mount in `server.js`; new route file → register there. Validate body via `schemas/` or inline joi-equivalent before model writes.
- `crypto`, `multer` (uploads), `node-cron` (scheduling) are present — use them, don't add deps.

## 9. Self-Audit (before reporting done)

1. Did I touch **only what was asked**? (project rule)
2. Did I use only the existing **blue** palette tokens? No foreign hue introduced? (§5)
3. Did I reuse `common/*` primitives + installed libs instead of reinventing? (§4)
4. Did I **run/launch anything**? If yes and not explicitly told to → STOP, undo the launch, report it. Code is written, never executed here. (§7)
5. Any file over 500 lines now? → split or flag.
6. Any new dependency added? → justify or remove (prefer stdlib/installed).
7. Any silent failure / swallowed error / missing boundary validation introduced? → fix.

Report: what rung of §1, what changed, the blue tokens used, and say plainly "not run — please verify with npm run dev" (do not claim verified). Name anything skipped with its ceiling + when to add it.

## 10. Quick reference

```
Pigeon = Express + React, multi-protocol API testing tool.
Priority: security/data-loss > bug > feature > refactor > docs.
Ask before: multi-file / new feature / UI redesign. Act on: tiny fixes.
Reuse: common/* primitives + installed libs before new code.
Palette: BLUE only. Read index.css (--primary #014C75, --accent, --info, --radius-lg 16px, Inter/Roboto Mono). Match section's local tokens. Status colors (green/amber/red) only for status, never as primary accents.
Do NOT run: no npm start/dev/build, no node server.js, no launching servers. User verifies.
Do NOT drive: no chrome-devtools/playwright browser actions/screenshots. Visual verify = user's job.
Don't: claim "verified" (you didn't run), Co-Authored-By, root test files, new deps for what a few lines do, off-palette colors, scaffolding-for-later.
```
