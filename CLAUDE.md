# CLAUDE.md — KPost UI Automation

Guidance for working in this repository (for both humans and AI assistants).
Read this before adding tests or page objects so the suite stays consistent.

## What this is

A Playwright + TypeScript **UI** automation framework for the KPost React app
(`https://localhost:3000`), built to sit alongside the existing Playwright API
automation. Architecture is Page Object Model + custom fixtures. See `README.md`
for the full tour, `TEST-BENCH-REPORT.md` for the state-of-the-bench analysis,
and this file for the working contract.

**Current size:** 5 page objects · 5 spec files · 20 tests · 4 browser projects
(chromium, firefox, webkit, mobile-chrome).

## The app under test — verified ground truth

Everything in this section was read off the running app on **2026-08-12**, not
assumed. If you change a locator, verify it the same way.

**Login is two-step.** `/login` → `textbox "Enter KPOST ID / Mobile number"` →
`Submit` → `textbox "Enter your password"` → `Login` → lands on `/home`.

> ⚠ **The Submit button is covered by an undismissable overlay.** Typing an "@"
> pops `ul.login__domain-list` ("@kpostindia.com") directly over Submit. It
> swallows pointer events, is not itself clickable, and closes on neither Escape
> nor blur. `{ force: true }` does **not** fix it — force skips Playwright's
> actionability check but the browser still delivers the event to the topmost
> element. Activate it by keyboard instead (`focus()` + `Enter`), which is both
> the accessible path and immune to hit-testing. See `LoginPage.submitId()`.

**Navigation is via Quick Access, not a sidebar.** The left rail is *icon-only*:
`<div class="... icon-KP_03-KMail">` with no text, no `aria-label`, no `title` —
unreachable by any accessible locator. The accessible path is the **Quick Access
launcher** (top-bar button, or `Ctrl+K`): a real ARIA dialog whose entries are
real buttons with real names, e.g. `button "K KMail Open inbox and mails Open"`.
Use `AppShellPage.launchModule()`. `openModuleFromRail()` exists only to cover
the rail itself and is the one sanctioned CSS-class selector in the codebase.

**Other verified shell facts:**

- `/home` always has one *unrelated* `role="dialog"` in the DOM — always
  disambiguate the launcher with `.filter({ hasText: 'Quick Access' })`.
- The top-bar **Global Search ships disabled** (`aria-label "Global Search
  (Disabled)"`). `Ctrl+K` opens Quick Access, not search.
- Home pane: a real `tablist` with `tab "Recents"` (default) and `tab
  "Contacts"`, plus KNews and KEcommerce panels. Two `searchbox "Search"`
  controls render — scope with `.first()`.
- Logout is the rail icon `icon-KP_18-Logout` → a confirmation modal →
  `button "Logout"` → `/login`.
- Auth lives in **localStorage**, not cookies: `accessToken`, `refreshToken`,
  `isAuthenticated`, `Authuser`, `deviceIdentity_primary`, and an encrypted
  `persist:persist:localhost` redux blob. The session survives a reload.
- **KPost never reaches `networkidle`** — the shell polls news, Firebase, and
  websockets forever. Never wait on it; `waitForAppReady` deliberately does not.
- First authenticated paint regularly exceeds 10s (it boots behind a
  `PersistGate` loader), which is why `AppShellPage` gives the shell assertion
  its own 45s budget while everything after it keeps the normal timeout.

### Module status

| Module | Status |
| --- | --- |
| `KDirectory` | ✅ Works. Routes to `/kdirectory`, no failed requests. Opens a first-run setup wizard (Country / Language / vertical) with `Continue` disabled until filled. Contact search + directory list sit **behind** that wizard. |
| `KMail` | ❌ **Blocked.** Launching it fires four calls to `https://kmail5.kpostindia.com/kmail5/v2/common/*` that all return **401**; the SPA then force-logs-out to `/login` with "Your session has expired." Inbox / Compose / Recents have never been reachable. |

## Golden rules

1. **Import `test`/`expect` from `src/fixtures/fixtures.ts`, never from
   `@playwright/test`** in specs. (Page objects import from `@playwright/test`
   for types and `test.step` — that's expected.)
2. **No hard waits.** `page.waitForTimeout` is banned and ESLint now **errors**
   on it. The only sanctioned bounded poll is in `scrollVirtualizedListToItem`.
   Never wait for `networkidle` on this app (see above).
3. **Locators, in order of preference:** `getByRole` → `getByLabel` →
   `getByPlaceholder` → `getByText` → `getByTestId`. CSS only where the product
   exposes no accessible name at all — today that is exactly one place, the icon
   rail in `AppShellPage`. Declare every locator once, in the constructor.
4. **Web-first assertions only** (`await expect(locator).toBeVisible()`), never
   `expect(await locator.isVisible())`.
5. **Wrap every page-object method body in `test.step()`** with a business-level
   description. That is what makes the HTML report readable. Keep `BasePage`'s
   low-level helpers step-free so the report doesn't drown in noise.
6. **Tests are atomic and parallel-safe** — but see the concurrency caveat below.
7. **Assertions live in tests and thin POM `expect*` helpers.** Page objects
   model *behavior*; specs express *intent*.
8. **Secrets come from `env` (`src/config/env.ts`), never `process.env` directly
   and never hard-coded.** `env.required()` throws on a missing variable — do not
   reintroduce fallback defaults, they turn a config error into a login timeout.
9. **Record verification status in the page-object header.** Every POM says what
   was observed live and what is still conventional. Keep it truthful.

## Known constraints

- **Parallel workers break on the shared account.** A full-parallel smoke run
  failed 6/12; the same run serially passed 8/12. KPost appears to allow one
  active session per account. Until per-worker accounts exist, run app-dependent
  suites with `--workers=1` (`npm run test:serial`).
- **The KMail smoke test is expected to fail** while the 401s above persist.
  That is real signal, not test debt — do not "fix" it by weakening the
  assertion.

## Layout (where things go)

| Need to… | Put it in |
| --- | --- |
| Add a screen | `src/pages/<Name>Page.ts` extending `AppShellPage` (authenticated) or `BasePage` |
| Add shared app-chrome behaviour | `src/pages/AppShellPage.ts` |
| Add a generic interaction helper | `BasePage` or `src/utils/react-helpers.ts` |
| Talk to the API (auth, seeding) | `src/utils/api-helpers.ts` |
| Inject a new page object / state | `src/fixtures/fixtures.ts` |
| Add test data | `src/data/*.json` (static) or `src/data/factories/*` (per-test) |
| Add a domain type | `src/types/index.ts` |
| Add tests | `tests/<area>/<name>.spec.ts` |

Areas in use: `auth/`, `home/`, `kmail/`, `kdirectory/`.

Class hierarchy: `BasePage` (framework-generic) → `AppShellPage` (KPost chrome:
launcher, rail, logout) → `HomePage` / `KMailPage` / `KDirectoryPage`.
`LoginPage` extends `BasePage` directly — there is no shell before sign-in.

## Available fixtures

| Fixture | Scope | Gives you |
| --- | --- | --- |
| `loginPage` `homePage` `kmailPage` `kdirectoryPage` | test | Page objects bound to the current page |
| `anonymousPage` | test | A `Page` in a fresh, logged-out context |
| `standardUser` / `adminUser` | test | Credentials from `env` |
| `apiAuth` | **worker** | One API login (token + cookies) reused across the worker |
| `seedPost(post)` | test | **Legacy.** Blog-era API seed + auto-teardown; no current spec uses it. Kept as the worked arrange-via-API example. |

## How to add a Page Object

```ts
import { type Locator, type Page, expect, test } from '@playwright/test';
import { AppShellPage } from './AppShellPage';

export class ExamplePage extends AppShellPage {
  protected readonly path = '/example';        // relative to baseURL
  private readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.saveButton = page.getByRole('button', { name: /save/i });  // declare once
  }

  async save(): Promise<void> {
    await test.step('Save the form', async () => {   // every method gets a step
      await this.click(this.saveButton);             // BasePage helper, not raw page
      await expect(this.saveButton).toBeEnabled();
    });
  }
}
```

Then expose it in `fixtures.ts`:

```ts
examplePage: async ({ page }, use) => {
  await use(new ExamplePage(page));
},
```

## How to add a test

```ts
import { test, expect } from '../../src/fixtures/fixtures';

test('does the thing @smoke @kdirectory', async ({ homePage, kdirectoryPage }) => {
  await homePage.open();          // starts authenticated (shared storageState)
  await homePage.expectLoaded();
  await kdirectoryPage.openFromLauncher();
  await kdirectoryPage.expectLoaded();
});
```

- **Tag** every test: `@smoke` and/or `@regression`, plus an area tag (`@auth`,
  `@home`, `@kmail`, `@kdirectory`). CI runs `@smoke` first. Put tags in the
  `describe` title so the whole block inherits them.
- **Auth tests run logged-out**: add
  `test.use({ storageState: { cookies: [], origins: [] } })` at the top of the
  file, or use the `anonymousPage` fixture.
- **Conditional skips are allowed** for account/environment state a spec cannot
  control (`test.skip(cond, reason)`); blanket `test.skip()` now fails lint.

## Session / auth model

`src/config/global-setup.ts` logs the standard user in **once** and saves the
session to `.auth/standard.json`. Fixtures load that state by default, so most
tests start signed in. Auth specs opt out. `.auth/` is gitignored — never commit
real sessions.

`AUTH_MODE` selects the strategy and now defaults to **`ui`**: KPost's session is
several localStorage keys plus an encrypted redux blob, so injecting one API
token cannot boot the SPA authenticated. `api` mode remains for when that
contract is wired, and falls back to UI login on failure.

Global setup re-implements the login flow rather than reusing `LoginPage`,
because `test.step()` is illegal outside a running test. **If you change
`LoginPage.submitId()`, change `seedViaUi()` too.**

## Commands

```bash
npm install && npx playwright install     # first-time setup
cp .env.example .env                       # then fill in real test-user creds
npm test                                   # full suite, all browsers
npm run test:smoke                         # @smoke only
npm run test:serial                        # workers=1 — required for app-dependent runs
npm run test:ui                            # time-travel debugging
npm run codegen                            # record real KPost selectors
npm run ci                                 # typecheck → lint → test (the gate)
```

## Before you push

Run `npm run ci` (or at minimum `npm run typecheck && npm run lint &&
npx playwright test --list`). Typecheck and lint must be **clean — zero errors
and zero warnings**; they are today, keep them that way.

## CI shape

`.github/workflows/playwright.yml` — three stages on push/PR to `main`/`develop`,
plus a nightly 02:00 cron and manual dispatch:

1. **static** — typecheck + lint. Always runs, no app needed.
2. **smoke** — chromium, `--grep @smoke`.
3. **e2e** — matrix across chromium / firefox / webkit, artifacts on failure.

Stages 2 and 3 are **gated on the `KPOST_START_CMD` repository variable** and are
skipped while it is unset — so today CI proves the suite compiles and lints, not
that it passes.

## Known follow-ups

- **Unblock KMail** (401s from `kmail5.kpostindia.com`), then write the Inbox /
  Compose / Recents specs against `KMailPage`'s existing methods.
- **Provision a pre-onboarded (or disposable) KDirectory user** so contact search
  and the directory list can be automated past the setup wizard.
- **Give each worker its own account** so the suite can run in parallel again.
- **Wire CI app provisioning**: set `KPOST_START_CMD` and the four user secrets.
- **Raise with the product team**: the login overlay covering Submit, and the
  icon rail having no accessible names — both are real accessibility defects.
- **Decide the fate of the blog-era leftovers**: `data/factories/postFactory.ts`,
  `data/posts.json`, the `Post` types, `apiCreatePost`/`apiDeletePost`, and the
  `seedPost` fixture are unused by any spec.
- **Not yet covered**: accessibility scans, visual regression, file
  upload/download, and the other KPost modules (Katchup, Kall, KCloud, KBooking,
  KDOC, KEcommerce, KNews, KPay, Settings, My Profile).
