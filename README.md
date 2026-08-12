# KPost UI Automation Framework

Production-grade UI test automation for the **KPost** ReactJS application
(`https://localhost:3000`), built with **Playwright + TypeScript**.

It is designed to live alongside your existing Playwright **API** automation in
the same ecosystem, sharing tooling, conventions, and CI while remaining an
independent, cleanly-layered UI suite.

---

## Table of contents

1. [Highlights](#highlights)
2. [Architecture & folder structure](#architecture--folder-structure)
3. [Prerequisites](#prerequisites)
4. [Getting started](#getting-started)
5. [Running tests](#running-tests)
6. [Core design patterns](#core-design-patterns)
7. [Handling React-specific UI challenges](#handling-react-specific-ui-challenges)
8. [Test data management](#test-data-management)
9. [Writing a new test — quickstart](#writing-a-new-test--quickstart)
10. [CI/CD](#cicd)
11. [Flaky-test prevention playbook](#flaky-test-prevention-playbook)
12. [Conventions & standards](#conventions--standards)

---

## Highlights

- **Page Object Model** with a rich, resilient `BasePage` foundation.
- **Custom fixtures** for page-object injection and session/auth state.
- **Shared authenticated session** via `globalSetup` (login once, reuse everywhere).
- **Cross-browser**: Chromium, Firefox, WebKit (+ mobile emulation).
- **React-aware helpers**: re-render waits, custom dropdowns, virtualized lists, toasts.
- **Deterministic data** via a Factory pattern (unique per test → true parallelism).
- **Network interception/mocking** for empty/error/edge states without seed data.
- **Full diagnostics**: trace, screenshot, and video retained on failure.
- **CI-ready**: sharded GitHub Actions matrix, artifact upload, secrets-based creds.
- **Quality gates**: TypeScript strict mode, ESLint (with Playwright rules), Prettier.

---

## Architecture & folder structure

```text
KPOST-UI-AUTOMATION/
├── .github/
│   └── workflows/
│       └── playwright.yml          # CI: cross-browser matrix, artifacts, secrets
├── src/
│   ├── config/
│   │   ├── env.ts                  # Type-safe, frozen environment config (single source of truth)
│   │   └── global-setup.ts         # One-time UI login → persisted storageState
│   ├── pages/
│   │   ├── BasePage.ts             # Abstract base: safe click/fill, waits, dynamic assertions
│   │   ├── AppShellPage.ts         # KPost chrome: Quick Access launcher, icon rail, logout
│   │   ├── LoginPage.ts            # POM for the two-step auth screen
│   │   ├── HomePage.ts             # POM for the /home pane (Recents/Contacts, KNews, KEcommerce)
│   │   ├── KMailPage.ts            # POM for the mail module (Compose · Inbox · Recents)
│   │   ├── KDirectoryPage.ts       # POM for the directory module (search · list · setup wizard)
│   │   ├── KatchupPage.ts          # POM for the chats module (Recents/Contacts · search · threads)
│   │   ├── SettingsPage.ts         # POM for the settings module (sections · profile · language)
│   │   └── KEcommercePage.ts       # POM for the marketplace module (merchant catalog)
│   ├── fixtures/
│   │   └── fixtures.ts             # Custom test/expect: injects page objects + session state
│   ├── utils/
│   │   ├── logger.ts               # Lightweight leveled logger (report-friendly)
│   │   └── react-helpers.ts        # Re-render/virtualized-list/dropdown/toast helpers
│   ├── data/
│   │   ├── users.json              # Static: invalid-login data-driven scenarios
│   │   ├── posts.json              # Static: canonical post + boundary constants
│   │   └── factories/
│   │       ├── userFactory.ts      # Unique, registrable users (Faker-backed)
│   │       └── postFactory.ts      # Unique posts per test (no collisions in parallel)
│   └── types/
│       └── index.ts                # Shared domain models (User, Post, Toast, …)
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts           # Valid/invalid/validation (data-driven), runs logged-out
│   │   └── logout.spec.ts          # Logout + protected-route redirect
│   ├── dashboard/
│   │   ├── dashboard.spec.ts       # Shell + empty/populated/error feed via route mocking
│   │   └── feed-search.spec.ts     # Search filtering + pagination via query-keyed mocking
│   ├── posts/
│   │   ├── post-creation.spec.ts   # Happy path + validation + boundary + API-failure edge cases
│   │   └── post-management.spec.ts # Edit + delete (confirm dialog) via route mocking
│   └── profile/
│       └── profile.spec.ts         # View + update display name + validation
├── CLAUDE.md                       # Repo working contract (conventions, how to add tests/POMs)
├── .auth/                          # (gitignored) persisted storageState from globalSetup
├── playwright-report/              # (gitignored) HTML report
├── test-results/                   # (gitignored) traces, videos, screenshots, JSON/JUnit
├── .env.example                    # Template for local secrets (copy → .env)
├── .gitignore
├── .eslintrc.cjs                   # ESLint + @typescript-eslint + eslint-plugin-playwright
├── .prettierrc.json
├── playwright.config.ts            # Central Playwright config (browsers, retries, reporters…)
├── tsconfig.json                   # Strict TS, path aliases (@pages/*, @utils/*, …)
├── package.json
└── README.md
```

### Layering (dependency direction)

```text
tests/  ──uses──▶  fixtures/  ──injects──▶  pages/  ──extends──▶  BasePage
   │                                           │                     │
   └──uses──▶ data/ (factories + json)         └──uses──▶ utils/ (react-helpers, logger)
                                               config/env is imported anywhere it's needed
```

Tests never touch `process.env`, raw selectors, or `page.goto` details directly
— those concerns live in `config`, `pages`, and `fixtures`.

---

## Prerequisites

- **Node.js ≥ 18** (CI uses 20).
- The **KPost app running at `https://localhost:3000`** with seeded test users
  matching your `.env` (or provide equivalents).
- npm (or pnpm/yarn — scripts assume npm).

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers (first run only)
npx playwright install

# 3. Configure environment
cp .env.example .env
#    → edit .env with real (non-production) test-user credentials

# 4. Make sure the KPost app is up at https://localhost:3000

# 5. Run the suite
npm test
```

> **SSL note:** KPost serves over HTTPS with a self-signed dev certificate.
> `ignoreHTTPSErrors: true` is set globally in `playwright.config.ts` and in
> `global-setup.ts`, so localhost cert warnings won't break the run.

---

## Running tests

| Command | What it does |
| --- | --- |
| `npm test` | Full suite, all projects, parallel |
| `npm run test:headed` | Headed mode |
| `npm run test:ui` | Playwright UI mode (time-travel debugging) |
| `npm run test:debug` | Inspector / step debugging |
| `npm run test:chromium` | Chromium only (also `:firefox`, `:webkit`) |
| `npm run test:smoke` | Tests tagged `@smoke` |
| `npm run test:regression` | Tests tagged `@regression` |
| `npm run test:auth` | Only `tests/auth` |
| `npm run report` | Open the last HTML report |
| `npm run codegen` | Record selectors against the app |
| `npm run ci` | typecheck → lint → test (the full gate) |

Tests are **tagged** (`@smoke`, `@regression`, `@auth`, `@posts`) so CI can run
fast smoke checks on every PR and full regression nightly.

---

## Core design patterns

### 1. `BasePage` — resilient interaction layer

Every page object extends `BasePage`, which wraps Playwright's auto-waiting with
intent-revealing, hardened methods:

- `click()` / `doubleClick()` — visible + scrolled-into-view + optional nav wait.
- `fill()` / `type()` — clears, fills, and **verifies the committed value** so
  controlled React inputs that revert on re-render fail loudly.
- `isVisible()` (non-throwing) vs `waitForVisible()` / `waitForHidden()`.
- `clickAndWaitForResponse()` — race-free "action + matching API response".
- Thin dynamic assertions (`expectVisible`, `expectText`, `expectCount`, …) that
  delegate to Playwright's **auto-retrying web-first assertions**.

No `waitForTimeout`/hard sleeps anywhere — every wait is condition-based.

### 2. Custom fixtures — injection + session state

`src/fixtures/fixtures.ts` extends Playwright's `test` to:

- Inject ready-to-use page objects (`loginPage`, `homePage`, `kmailPage`, `kdirectoryPage`).
- Apply the **shared authenticated `storageState`** by default, so most tests
  start logged in (fast, and login is off the critical path).
- Provide an **`anonymousPage`** (fresh, logged-out context) and let auth specs
  opt out of shared auth with `test.use({ storageState: { cookies: [], origins: [] } })`.
- Expose seeded `standardUser` / `adminUser` credentials.

Import `test`/`expect` **from the fixtures file**, not from `@playwright/test`.

### 3. Session strategy — `globalSetup`

`global-setup.ts` logs in **once** through the real UI and saves cookies +
localStorage to `.auth/standard.json`. This shares auth *state*, not runtime, so
tests stay independent while avoiding dozens of redundant logins.

---

## Handling React-specific UI challenges

All in `src/utils/react-helpers.ts`, consumed by the page objects:

| Challenge | Helper | Approach |
| --- | --- | --- |
| Re-renders / async state | `waitForAppReady` | `networkidle` + a `requestAnimationFrame` commit tick |
| Controlled inputs reverting | `fillReactInput` / `BasePage.fill` | fill, verify committed value, fall back to sequential typing |
| Custom portalled dropdowns | `selectCustomOption` | open trigger → wait `role=listbox` → click `role=option` → assert close |
| Virtualized/windowed lists | `scrollVirtualizedListToItem` | incrementally scroll viewport until the row mounts |
| Toast notifications | `expectToast` | assert `role=status/alert` text, then wait for auto-dismiss so it can't leak |

> Prefer Playwright's web-first assertions in tests; the coarse `waitForAppReady`
> gate is only for post-navigation "app has settled" moments.

---

## Test data management

Two complementary mechanisms:

1. **Static JSON fixtures** (`src/data/*.json`) — canonical examples, boundary
   constants, and **data-driven scenario tables** (e.g. invalid-login matrix).
2. **Factory pattern** (`src/data/factories/*`) — `buildPost()` / `buildUser()`
   generate **unique, realistic** records per test (timestamp + sequence + Faker).
   Uniqueness is what makes the suite safe to run **fully in parallel** against a
   shared backend — no two tests fight over the same title/email.

Rule of thumb: **read** constants/scenarios from JSON; **create** per-test
mutable instances from factories. Never generate credentials for accounts that
must pre-exist (those come from `env`).

---

## Writing a new test — quickstart

```ts
import { test, expect } from '../../src/fixtures/fixtures';

test('opens the directory module @smoke @kdirectory', async ({ homePage, kdirectoryPage }) => {
  await homePage.open();                    // starts authenticated (shared state)
  await homePage.expectLoaded();

  await kdirectoryPage.openFromLauncher();  // Quick Access — the accessible nav path
  await kdirectoryPage.expectLoaded();      // POM encapsulates all locators
});
```

Checklist for every test: **atomic**, **independent**, **unique data**,
**accessible locators**, **no hard sleeps**, **web-first assertions**.

---

## CI/CD

`.github/workflows/playwright.yml`:

- Triggers on push/PR to `main`/`develop` and manual dispatch.
- **Matrix-shards** the run across `chromium` / `firefox` / `webkit` (parallel
  jobs, `fail-fast: false` for isolated, readable failures).
- `npm ci` + `playwright install --with-deps <project>`.
- Pulls credentials from **GitHub Secrets** (`STANDARD_USER_EMAIL`, etc.).
- Uploads the **HTML report** always, and **traces/videos on failure**.
- Includes a clearly-marked placeholder step to provision the KPost app —
  replace it with your container/`docker compose`/`wait-on` startup.

Retries and worker counts auto-tune for CI via `env.isCI` in the config.

---

## Flaky-test prevention playbook

- ✅ **Web-first assertions** (`expect(locator).toBeVisible()`) — auto-retry.
- ✅ **Action + response** coupling via `clickAndWaitForResponse` — no "clicked
  before request fired" races.
- ✅ **No `waitForTimeout`** in tests (lint-flagged). Only bounded polling inside
  the virtualized-list helper.
- ✅ **Unique data per test** → no cross-test interference.
- ✅ **Deterministic states via mocking** for empty/error/edge feeds.
- ✅ **Auto-dismiss toasts waited out** so notifications don't leak.
- ✅ **Retries on CI only** (2×) so flakiness is visible locally but doesn't fail
  the build on transient blips; `trace: retain-on-failure` makes every failure
  debuggable via `npm run trace`.
- ✅ **Pinned `locale`/`timezoneId`** (en-US/UTC) for stable date/number rendering.
- ✅ **Clean teardown**: `anonymousPage` closes its own context; fixtures scope
  everything per test so nothing leaks between tests.

---

## Conventions & standards

- **Locators:** prefer `getByRole` → `getByLabel` → `getByText` → `getByTestId`.
  Reserve CSS/XPath for genuine last resorts.
- **TypeScript:** `strict` mode, no `any` (lint-warned), path aliases (`@pages/*`).
- **Lint/format:** ESLint (`@typescript-eslint` + `eslint-plugin-playwright`) and
  Prettier. Run `npm run ci` before pushing.
- **Naming:** page objects `*Page.ts`, specs `*.spec.ts`, one journey per describe.
- **Assertions live in tests** (and thin POM assert helpers); page objects model
  behavior, not test intent.

---

### Adapting to the real KPost DOM

The locators here target conventional, accessible KPost markup (roles, labels,
a few `data-testid`s). When wiring against the real app, run
`npm run codegen`, confirm the accessible names/roles, and adjust the locator
declarations at the top of each page object — the tests and helpers won't need
to change.
