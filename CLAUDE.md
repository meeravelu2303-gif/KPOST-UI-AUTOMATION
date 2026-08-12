# CLAUDE.md — KPost UI Automation

Guidance for working in this repository (for both humans and AI assistants).
Read this before adding tests or page objects so the suite stays consistent.

## What this is

A Playwright + TypeScript **UI** automation framework for the KPost React app
(`https://localhost:3000`), built to sit alongside the existing Playwright API
automation. Architecture is Page Object Model + custom fixtures. See `README.md`
for the full tour, `TEST-BENCH-REPORT.md` for the state-of-the-bench analysis,
and this file for the working contract.

**Current size:** 8 page objects · 8 spec files · 47 tests · 4 browser projects
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
| `Katchup` | ✅ Works. Routes to `/katchup`. It is a **chats & contacts** module, *not* a social feed — no post composer, no feed of posts; the whole module exposes 14 interactive elements. Recents/Contacts tabs, an "<n> Unopened Messages" counter, and a conversation search that renders "No results found". Backend 500s from `localhost:8989/v2/contacts/*` are noisy but non-fatal. Conversation threads are unverified: the test account has "My Contacts • 0". |
| `KMail` | ✅ **Works** (the earlier 401 force-logout is fixed; it never calls `kmail5.kpostindia.com` now — data comes from `localhost:8989`). Loads at `/kmail`. Three tabs — `Recents`, `Contacts`, `Status of Mails` — all verified clickable; an "<n> Unopened Mails" counter and a Status-of-Mail summary. ⚠ Still raises an uncaught `TypeError … (reading 'status')` in `UnopenedMailAsync` on load (KPOST-KMAIL-001) — and it **refires on the pane's refresh cycle**, so `KMailPage.send()` re-dismisses the overlay right before its click; the suite records each dismissal as a `dismissed-app-error` annotation. **KMail has no composer** — composing is the separate "Write Mail" module. |
| `Write Mail` | ✅ Works (composer, route `/writemail`, renders alongside the KMail pane). Fields ship **no labels**: To is `input[name="to"]`, Subject `input.toInput`, body a Quill `div.ql-editor`, and Send an icon-only `button.post_button_size` with no accessible name. The To field **normalises on blur** (full native address → bare KPOST ID) while still submitting the full address — never press Enter to "commit" it, that can eat the recipient. Send fires `POST /v2/sentMail/postMail/`. **Self-sends are rejected** (400 "Duplicate IDs are present in ToAddress…" → alert "Some Error Occurred!"), so the success path needs `MAIL_RECIPIENT` (a second account); the backend also intermittently 401s valid sessions (KPOST-KMAIL-002). |
| `Settings` | ✅ Works. Routes to `/settings` (rail: `icon-KP_15-Settings`). Six sections as **plain clickable text, not ARIA tabs** — Profile Creation, Digital Card Settings, General Settings, KMail Settings, KNews Settings, My Account — and selecting one does not change the URL. Renders the signed-in user's name + avatar + "Add Cover Photo". **No toggles, switches, or theme controls exist**; the app's only preference control is the header language `<select>` (English/Russian/Japanese), modelled on `AppShellPage`. Only KNews Settings carries its own Submit; "My Account" opened directly renders no controls. |
| `KEcommerce` | ✅ Works. Routes to **`/e-commerce`** (hyphenated — not `/kecommerce`); rail: `icon-KP_14-KCommerce`. Zero failed requests. The catalog is ~60 merchant-logo images with alt text (amazon, flipkart, myntra, …) and **nothing else** — no heading, search, filters, or cart; the only interactive elements are the shell header controls. |

### Reporting known app defects

When a test fails because the *app* is wrong, register it in
`src/utils/known-defects.ts` and call `noteKnownDefect()` at the top of the test.
That attaches a `known-app-defect` annotation (visible in the HTML and JSON
reports) and returns a message to pass as the `expect()` message, so the failure
output opens with e.g. `KNOWN APPLICATION DEFECT KPOST-AUTH-001: …` instead of a
bare assertion diff.

Three rules: never weaken an assertion to make one go green; delete the entry the
moment the app is fixed (a stale one excuses a real regression); and remember
this documents, it does not suppress — annotated tests still fail.

**Logout does not guard protected routes.** Logging out correctly clears
`accessToken`, `refreshToken`, `Authuser`, and `deviceIdentity_primary`, and
lands on `/login`. But navigating back to `/home` afterwards **stays on `/home`**
and renders a dead, shell-less page instead of redirecting to `/login`. The
`tests/auth/logout.spec.ts` case that asserts the redirect fails for this reason
— that is correct signal; do not weaken it.

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

Areas in use: `auth/`, `home/`, `kmail/`, `kdirectory/`, `katchup/`,
`settings/`, `kecommerce/`.

Class hierarchy: `BasePage` (framework-generic) → `AppShellPage` (KPost chrome:
launcher, rail, language picker, logout) → `HomePage` / `KMailPage` /
`KDirectoryPage` / `KatchupPage` / `SettingsPage` / `KEcommercePage`.
`LoginPage` extends `BasePage` directly — there is no shell before sign-in.

**When the app raises an error.** `assertNoAppErrorOverlay()` detects the
dev-server overlay (`#webpack-dev-server-client-overlay`) and throws the real
cause — compiler message or runtime stack — instead of letting it surface as
"element not found" or "iframe intercepts pointer events". It runs from
`waitForAppReady` (after every navigation) and from `BasePage.click` (when a
click fails). Note the overlay blocks **clicks but not reads**, so a partly
broken app shows up as "assertions pass, clicks fail". The overlay is dev-only:
in a production build the same error would instead be a silently broken
feature, so treat anything it reports as a genuine app defect.

## Available fixtures

| Fixture | Scope | Gives you |
| --- | --- | --- |
| `loginPage` `homePage` `kmailPage` `kdirectoryPage` `katchupPage` `settingsPage` `kecommercePage` | test | Page objects bound to the current page |
| `directoryUser` | test | The pre-onboarded directory account when configured, else the standard user |
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

After seeding, `verifySession()` loads the saved state into a clean context and
requires `/home` to render the authenticated shell. Without it, a session that
fails to propagate shows up as every authenticated test failing on a confusing
"element not found", several layers from the cause.

**Second, optional account.** Set `DIRECTORY_USER_EMAIL` /
`DIRECTORY_USER_PASSWORD` to an account that has *already* completed KDirectory
onboarding and global setup stores a second session at `.auth/directory.json`
(`DIRECTORY_STORAGE_STATE`). The gated KDirectory specs select it via
`test.use({ storageState: … })` and stop skipping. Leave both unset and they skip
with a reason; set only one and `env.ts` fails fast. A configured-but-broken
directory user is fatal, not a warning — opting in is a statement that the
account exists. The full chain (env → seeding → verification → spec selection →
wizard detection) is verified working; only a genuinely onboarded account is
still missing.

**Optional mail recipient.** `MAIL_RECIPIENT` (a second KPOST account) unlocks
the full send-success E2E ("a sent mail is accepted and appears in the Sent
folder"). Without it that test skips, and the always-running self-send contract
test covers the whole compose/send pipeline against the documented rejection.

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

- **Fix the `UnopenedMailAsync` TypeError** in KMail (KPOST-KMAIL-001). It no
  longer blocks any test — the suite dismisses the dev overlay and verifies the
  tabs beneath — but the uncaught error is still real, and in production the
  unopened-mail feature would fail silently.
- **Give "Write Mail" its own page object and specs**; it, not KMail, is where
  composing happens.
- **Provision a pre-onboarded KDirectory user.** The plumbing is done — set
  `DIRECTORY_USER_EMAIL` / `DIRECTORY_USER_PASSWORD` and the three gated specs
  run. Only the account itself is missing. First run against a real one, narrow
  `KDirectoryPage`'s unverified locators (results list, filters, empty-state
  string) to what the DOM actually shows.
- **Seed at least one Katchup contact** for the test user so the conversation
  thread journey (`KatchupPage.openFirstConversation` / `sendMessage` /
  `expectMessageVisible`) stops skipping and gets verified.
- **Fix the missing post-logout route guard** (see above), then the failing
  `logout.spec.ts` case turns green on its own.
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
