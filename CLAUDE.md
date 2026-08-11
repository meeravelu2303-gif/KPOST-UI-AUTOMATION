# CLAUDE.md — KPost UI Automation

Guidance for working in this repository (for both humans and AI assistants).
Read this before adding tests or page objects so the suite stays consistent.

## What this is

A Playwright + TypeScript **UI** automation framework for the KPost React app
(`https://localhost:3000`), built to sit alongside the existing Playwright API
automation. Architecture is Page Object Model + custom fixtures. See `README.md`
for the full tour; this file is the working contract.

## Golden rules

1. **Import `test`/`expect` from `src/fixtures/fixtures.ts`, never from
   `@playwright/test`.** That's how page objects and session state get injected.
2. **No hard waits.** `page.waitForTimeout` is banned in tests (ESLint enforces).
   The only sanctioned bounded poll lives in `scrollVirtualizedListToItem`.
3. **Locators, in order of preference:** `getByRole` → `getByLabel` →
   `getByText` → `getByTestId`. CSS/XPath only as a genuine last resort.
4. **Web-first assertions only** (`await expect(locator).toBeVisible()`), never
   `expect(await locator.isVisible())` — the former auto-retries, the latter flakes.
5. **Tests are atomic and parallel-safe.** Build unique data with the factories
   (`buildPost`, `buildUser`); never depend on data another test created.
6. **Assertions live in tests and thin POM `expect*` helpers.** Page objects
   model *behavior*; specs express *intent*.
7. **Secrets come from `env` (`src/config/env.ts`), never `process.env` directly
   and never hard-coded.**

## Layout (where things go)

| Need to… | Put it in |
| --- | --- |
| Add a screen | `src/pages/<Name>Page.ts` extending `BasePage` |
| Add a reusable interaction | a `BasePage` method or `src/utils/react-helpers.ts` |
| Inject a new page object / state | `src/fixtures/fixtures.ts` |
| Add test data | `src/data/*.json` (static) or `src/data/factories/*` (per-test) |
| Add a domain type | `src/types/index.ts` |
| Add tests | `tests/<area>/<name>.spec.ts` |

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

## How to add a test

```ts
import { test, expect } from '../../src/fixtures/fixtures';
import { buildPost } from '../../src/data/factories/postFactory';

test('does the thing @regression @area', async ({ dashboardPage, postCreationPage }) => {
  const post = buildPost();                    // unique → parallel-safe
  await dashboardPage.open();                   // starts authenticated (shared state)
  await dashboardPage.goToCreatePost();
  await postCreationPage.composePost(post);
  await postCreationPage.publish();
});
```

- **Tag** every test: `@smoke` (critical happy path) and/or `@regression`, plus an
  area tag (`@auth`, `@posts`, `@dashboard`, `@profile`). CI runs `@smoke` first.
- **Auth tests run logged-out**: add `test.use({ storageState: { cookies: [], origins: [] } })`
  at the top of the describe/file, or use the `anonymousPage` fixture.

## Session / auth model

`src/config/global-setup.ts` logs the standard user in **once** and saves the
session to `.auth/standard.json`. Fixtures load that state by default, so most
tests start signed in. Auth specs opt out (above). The `.auth/` dir is gitignored
— never commit real sessions.

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

## Before you push

Run `npm run ci` (or at minimum `npm run typecheck && npm run lint &&
npx playwright test --list`). All three must be clean. CI's first stage is the
same static gate, so catching it locally saves a round-trip.

## Known follow-ups

- **Locators are conventional guesses** until validated against the real KPost
  DOM. Use `npm run codegen`, confirm the true roles/labels/testids, and adjust
  the locator declarations at the top of each page object. Tests/helpers/fixtures
  should not need to change — only the locators.
- **CI app provisioning** is a `TODO` step in `.github/workflows/playwright.yml`
  — wire in how KPost boots (container / build+serve) and set the GitHub Secrets.
