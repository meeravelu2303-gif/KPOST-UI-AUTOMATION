# CLAUDE.md — KPost UI Automation

Guidance for working in this repository (for both humans and AI assistants).
Read this before adding tests or page objects so the suite stays consistent.

## What this is

A Playwright + TypeScript **UI** automation framework for the KPost React app
(`https://localhost:3000`), built to sit alongside the existing Playwright API
automation. Architecture is Page Object Model + custom fixtures. See `README.md`
for the full tour, `TEST-BENCH-REPORT.md` for the current state-of-the-bench
analysis, and this file for the working contract.

**Current size:** 7 page objects · 9 spec files · 30 tests · 4 browser projects
(chromium, firefox, webkit, mobile-chrome) → 120 executions per full run.

## The app under test

KPost is a **modular super-app**, not a blog. Authenticated users land on
`/home`: a left sidebar of modules, a top-bar global search (also `Ctrl+K`), and
a Home pane with Recents / Contacts tabs. The module list is typed as
`KPostModule` in `src/types/index.ts` — Home, Write Mail, KMail, Katchup, Kall,
KDirectory, KCloud, KBooking, KEcommerce, KPay, KNews, Broadcast, Settings.

Login is **two-step**: enter KPOST ID / mobile → `Submit` → enter password →
`Login` → lands on `/home`.

> **Fidelity warning.** Only `LoginPage` and `HomePage` carry locators verified
> against the live app (via `npm run codegen`). `DashboardPage`,
> `PostCreationPage`, `PostDetailPage`, and `ProfilePage` still model a generic
> posts app (`/dashboard`, `/posts/new`, `/posts/:id`, `/profile`) and are
> **unverified guesses**. Before trusting a failure from those areas, check
> whether the locator or the product is wrong.

## Golden rules

1. **Import `test`/`expect` from `src/fixtures/fixtures.ts`, never from
   `@playwright/test`.** That's how page objects and session state get injected.
   (Page objects themselves import types from `@playwright/test` — that's fine.)
2. **No hard waits.** `page.waitForTimeout` is banned in tests. ESLint flags it
   (`playwright/no-wait-for-timeout`) — currently at `warn`, so treat it as a
   hard rule regardless of exit code. The only sanctioned bounded poll lives in
   `scrollVirtualizedListToItem`, with an explicit disable comment.
3. **Locators, in order of preference:** `getByRole` → `getByLabel` →
   `getByPlaceholder` → `getByText` → `getByTestId`. CSS/XPath only as a genuine
   last resort. Declare every locator once, in the constructor.
4. **Web-first assertions only** (`await expect(locator).toBeVisible()`), never
   `expect(await locator.isVisible())` — the former auto-retries, the latter flakes.
5. **Tests are atomic and parallel-safe.** Build unique data with the factories
   (`buildPost`, `buildUser`); never depend on data another test created.
6. **Assertions live in tests and thin POM `expect*` helpers.** Page objects
   model *behavior*; specs express *intent*.
7. **Secrets come from `env` (`src/config/env.ts`), never `process.env` directly
   and never hard-coded.**
8. **Arrange via API, act and assert via UI.** If a test needs a precondition,
   use `seedPost` / `api-helpers` rather than composing it through the browser.

## Layout (where things go)

| Need to… | Put it in |
| --- | --- |
| Add a screen | `src/pages/<Name>Page.ts` extending `BasePage` |
| Add a reusable interaction | a `BasePage` method or `src/utils/react-helpers.ts` |
| Talk to the API (auth, seeding) | `src/utils/api-helpers.ts` |
| Inject a new page object / state | `src/fixtures/fixtures.ts` |
| Add test data | `src/data/*.json` (static) or `src/data/factories/*` (per-test) |
| Add a domain type | `src/types/index.ts` |
| Add tests | `tests/<area>/<name>.spec.ts` |

Areas in use: `auth/`, `home/`, `dashboard/`, `posts/`, `profile/`.

## Available fixtures

| Fixture | Scope | Gives you |
| --- | --- | --- |
| `loginPage` `homePage` `dashboardPage` `postCreationPage` `postDetailPage` `profilePage` | test | Page objects bound to the current page |
| `anonymousPage` | test | A `Page` in a fresh, logged-out context |
| `standardUser` / `adminUser` | test | Credentials from `env` |
| `apiAuth` | **worker** | One API login (token + cookies) reused across the worker |
| `seedPost(post)` | test | Creates a post via API, returns its id, auto-deletes in teardown |

## How to add a Page Object

```ts
import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExamplePage extends BasePage {
  protected readonly path = '/example';        // relative to baseURL
  private readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.saveButton = page.getByRole('button', { name: /save/i });  // declare once
  }

  async save(): Promise<void> {
    await this.click(this.saveButton);         // use BasePage helpers, not raw page
  }
}
```

Then expose it in `fixtures.ts`:

```ts
examplePage: async ({ page }, use) => {
  await use(new ExamplePage(page));
},
```

`BasePage` already gives you: `open`, `expectPath`, `click`, `doubleClick`,
`fill`, `type`, `selectByLabel`, `setChecked`, `getText`, `isVisible`,
`waitForVisible`, `waitForHidden`, `expectVisible/Hidden/Text/Value/Enabled/
Disabled/Count`, `clickAndWaitForResponse`, and `screenshot`. Reach for those
before writing raw `page.*` calls.

## How to add a test

```ts
import { test, expect } from '../../src/fixtures/fixtures';
import { buildPost } from '../../src/data/factories/postFactory';

test('does the thing @regression @posts', async ({ homePage, postCreationPage }) => {
  const post = buildPost();                    // unique → parallel-safe
  await homePage.open();                        // starts authenticated (shared state)
  await postCreationPage.open();
  await postCreationPage.composePost(post);
  await postCreationPage.publish();
});
```

- **Tag** every test: `@smoke` (critical happy path) and/or `@regression`, plus an
  area tag (`@auth`, `@home`, `@dashboard`, `@posts`, `@profile`). CI runs
  `@smoke` first. Put tags in the `describe` title so the whole block inherits them.
- **Auth tests run logged-out**: add
  `test.use({ storageState: { cookies: [], origins: [] } })` at the top of the
  file, or use the `anonymousPage` fixture.
- **Prefer `page.route` mocking** for empty / error / boundary states so tests
  don't depend on backend seed data. Reserve real round-trips for the happy paths
  that genuinely need them.

## Session / auth model

`src/config/global-setup.ts` logs the standard user in **once** and saves the
session to `.auth/standard.json`. Fixtures load that state by default, so most
tests start signed in. Auth specs opt out (above). The `.auth/` dir is gitignored
— never commit real sessions.

Two strategies, chosen by `AUTH_MODE`:

- `api` (default) — `POST {API_BASE_URL}{AUTH_LOGIN_PATH}`, then inject the token
  into `localStorage` under `AUTH_TOKEN_STORAGE_KEY` and cookies into the context.
  Fast and deterministic. **Falls back to UI login automatically** if the API
  call fails, logging why.
- `ui` — drives the real two-step login form once. Slower, but works before the
  API contract is wired.

## Commands

```bash
npm install && npx playwright install     # first-time setup
cp .env.example .env                       # then fill in real test-user creds
npm test                                   # full suite, all browsers
npm run test:smoke                         # @smoke only
npm run test:ui                            # time-travel debugging
npm run codegen                            # record real KPost selectors
npm run ci                                 # typecheck → lint → test (the gate)
```

Useful narrower runs: `test:chromium` / `test:firefox` / `test:webkit`,
`test:auth`, `test:serial` (workers=1), `test:headed`, `test:debug`, `report`.

## Before you push

Run `npm run ci` (or at minimum `npm run typecheck && npm run lint &&
npx playwright test --list`). All three must be clean — they are today, keep them
that way. CI's first stage is the same static gate, so catching it locally saves
a round-trip.

## CI shape

`.github/workflows/playwright.yml` — three stages on push/PR to `main`/`develop`,
plus a nightly 02:00 cron and manual dispatch:

1. **static** — typecheck + lint. Always runs, no app needed.
2. **smoke** — chromium, `--grep @smoke`.
3. **e2e** — matrix across chromium / firefox / webkit, artifacts on failure.

Stages 2 and 3 are **gated on the `KPOST_START_CMD` repository variable** and are
skipped while it is unset — so today CI proves the suite compiles and lints, not
that it passes. Setting `KPOST_START_CMD` (plus the four user secrets) turns on
real E2E signal.

## Known follow-ups

- **Re-model the four unverified page objects** (Dashboard, PostCreation,
  PostDetail, Profile) against the real KPost DOM with `npm run codegen`. Tests,
  helpers, and fixtures are locator-agnostic — only the locator declarations and
  `path` values should need to change.
- **Wire CI app provisioning**: set the `KPOST_START_CMD` repository variable and
  the `STANDARD_USER_*` / `ADMIN_USER_*` secrets.
- **`env.required()` never throws** because every credential passes a fallback —
  a missing secret silently runs as a placeholder user. Drop the fallbacks.
- **Unused capability**: `adminUser` credentials and fixture exist but no test
  uses them; no multi-role coverage yet.
- **Not yet covered**: accessibility scans, visual regression, file
  upload/download, and the KPost modules beyond a KMail navigation smoke.

See `TEST-BENCH-REPORT.md` for the full findings list with file references.
