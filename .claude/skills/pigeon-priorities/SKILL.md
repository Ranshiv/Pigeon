---
name: pigeon-priorities
description: Activate for any task on the Pigeon codebase — API testing/automation tool (Express + React). Drives task triage priority order (security/data-loss > bug > feature > refactor > docs), repo conventions, reuse-vs-add decisions, and UI/styling discipline (read existing design tokens + reusable components first, match monitoring-dashboard aesthetic, suggest 2026 styles when redesigning). Triggered by /pigeon or keywords: pigeon, protocol tester, graphql, grpc, soap, mqtt, websocket, sse, performance test, load test, ai agent tools, marketplace, explore page, dashboard, contract diff.
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

### Tokens — read & match existing, propose if missing

1. **Read first**: `client/src/index.css` defines the centralized token system (light theme default + explicit dark theme). Match these.
2. **Only if tokens are missing/ugly** → propose a 2026-dark-monitoring palette and **ask before applying**.

Current canonical tokens (from `index.css`):
```
--primary-color: #014C75   --primary-hover: #013B5B   --primary-light: #E5F3FF
--accent: var(--primary-color)
--background-color, --card-bg / --card-background, --hover-bg / --hover-background
--text-color, --text-secondary, --text-muted
--border-color   --card-shadow: 0 1px 3px rgba(0,0,0,.08)
--radius-sm:8px  --radius-md:12px  --radius-lg:16px  --radius-xl:22px
--success-color:#28a745  --warning-color:#ffc107  --danger-color:#dc3545  --info-color:#014C75
Fonts: Inter (400-700) body, Roboto Mono (code/metrics)
Dark theme defined explicitly — both supported.
```
Per-section local tokens (match the section's own): e.g. `PerformanceTestsPage.css` uses `--pt-accent`, `--pt-radius`(18px), `--pt-radius-sm`(12px), `--pt-hairline`, `--pt-surface`, `--pt-inset`, `--pt-mono`. Mirror these names inside perf-section work; fall back to global tokens otherwise.

### Core component styles (apply on new UI)

- **Button**: variant by intent (primary=`--accent`, ghost=transparent+border, danger=`--danger-color`). Always hover + focus-visible ring. 2026: subtle scale (1.02) / border-glow on hover, `prefers-reduced-motion` respected.
- **Card**: `--card-bg`, `--radius-lg`, `--card-shadow`, 1px `--border-color`. Hover → lift shadow.
- **Modal**: overlay blur, `--radius-xl`, `--card-bg`, ESC + backdrop-click to close, focus-trap.
- **Input/Select**: `--radius-sm`, focused → `--accent` ring. Erroneous → `--danger-color`.
- **Table**: hairline rows (`--border-color`), sticky header, zebra optional via `--hover-bg`.
- **Tabs**: active = `--accent` underline/pill, inactive = `--text-secondary`.

### Dashboard / monitoring section layout (2026 style)

Use this pattern for monitoring pages, performance dashboards, and their inner sections (teams, metrics, alerts, logs, runs):
```
[ sticky topbar: title + live status + primary actions ]
[ KPI row: 3-4 metric cards (big number + trend + mini-sparkline) ]
[ main grid: left = primary chart/timeline (2/3 width), right = side panel (1/3) ]
[ secondary grid: charts/widgets row, equal cards ]
[ data table: recent runs/events, sticky header, row-density toggle ]
```
- Dark monitoring theme (when section or user picks): elevated surfaces (`--pt-surface`/`--card-bg`), hairline borders, accent-tinted glows (`color-mix(in srgb, var(--pt-accent) 10-12%, transparent)`), mono font (`--pt-mono`) for metrics/latency.
- Live data → smooth transitions, not jumps. Charts: chart.js, re-render on data, axis in `--text-muted`, series in `--accent` + status colors.
- Inner sections (teams, alerts, logs): each gets its card with a header row + body. Reuse `PageShell`/`MainShell` for outer chrome.

### When (and only when) redesigning → suggest 2026 options

Offer these as named options when the user wants a style update:
- **"Observability Dark"** — the monitoring aesthetic above (default for perf/protocol pages).
- **"Clean SaaS"** — light, large radius, soft shadows, generous whitespace (marketplace/explore).
- **"Data-viz"** — bold type, big metric numbers, animated grid, status-color coded (alerts/health).

Ask which for the specific page; pick per-page based on purpose (testing/dashboard=observability, marketplace=clean SaaS).

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

- **NEVER use `npm run build`. ALWAYS `npm run dev`** to verify changes (project rule).
- Backend: `node server.js` (or the dev script). Frontend: `cd client && npm start`.
- Tests: `npm test` (jest, `--passWithNoTests`). Test files in `tests/` or beside component, not root.
- **Before any UI change**: use the browser MCP tools (`chrome-devtools` or `playwright`) to screenshot the current state, make the change, re-screenshot, compare. Catches regressions. (Both MCP toolsets are available.)
- **After any change**: run `npm run dev` and confirm it boots; run relevant jest tests. Report actual results — if a test fails, paste the output.

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
2. Did I match existing tokens/components/style? (§4, §5)
3. Did I verify via `npm run dev` + relevant tests + (for UI) screenshot-before/after? (§7)
4. Any file over 500 lines now? → split or flag.
5. Any new dependency added? → justify or remove (prefer stdlib/installed).
6. Any silent failure / swallowed error / missing boundary validation introduced? → fix.

Report: what rung of §1, what changed, verify output, anything skipped (name the ceiling + when to add it).

## 10. Quick reference

```
Pigeon = Express + React, multi-protocol API testing tool.
Priority: security/data-loss > bug > feature > refactor > docs.
Ask before: multi-file / new feature / UI redesign. Act on: tiny fixes.
Reuse: common/* primitives + installed libs before new code.
Tokens: read index.css (--primary #014C75, --radius-lg 16px, Inter/Roboto Mono). Match section's local tokens.
Verify: npm run dev (NEVER build) + jest + browser screenshot for UI.
Don't: Co-Authored-By, root test files, new deps for what a few lines do, scaffolding-for-later.
```
