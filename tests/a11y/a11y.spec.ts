/**
 * Accessibility conformance — WCAG 2.1 A/AA via axe-core.
 *
 * ⚠ UNVERIFIED against the live app: written from the axe API and this bench's
 * conventions, never yet executed against a running KPost. Two accessibility
 * defects are already documented in CLAUDE.md (the login overlay that swallows
 * the Submit click, and the icon rail with no accessible names), so the first
 * real run is expected to be red.
 *
 * That red is signal, not debt. A violation here is an APPLICATION defect:
 * register it in `known-defects.ts` once observed and attach it with
 * `noteKnownDefect()`. Never widen `disableRules` or drop a tag to reach green.
 *
 * These scans are also self-serving in the best way — the rail's missing
 * accessible names are exactly why `AppShellPage` needs a CSS selector, so
 * every fix here removes brittleness from the suite.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { formatViolations, scanA11y } from '../../src/utils/a11y';

test.describe('Accessibility — signed out @regression @a11y', () => {
  // The login screen is reachable without a session, so this file's first block
  // opts out of the shared authenticated state rather than using a fixture.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the login screen has no WCAG A/AA violations', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.open();
    await loginPage.expectLoaded();

    const violations = await scanA11y(page);

    expect(violations, formatViolations(violations, 'the login screen')).toEqual([]);
  });
});

test.describe('Accessibility — signed in @regression @a11y', () => {
  test('the Home pane has no WCAG A/AA violations', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.expectLoaded();

    const violations = await scanA11y(page);

    expect(violations, formatViolations(violations, 'the Home pane')).toEqual([]);
  });

  test('every navigation control exposes an accessible name', async ({ homePage, page }) => {
    /*
     * Scoped to the rail on purpose. This is the defect that shapes the whole
     * navigation strategy: the rail renders as `div.icon-KP_03-KMail` with no
     * text, no aria-label and no title, so no accessible locator can reach it
     * and `AppShellPage.openModuleFromRail()` has to fall back to a CSS class.
     * Narrowing the scan means this test reports on that specific contract
     * rather than being masked by unrelated page-level violations.
     */
    await homePage.open();
    await homePage.expectLoaded();

    const violations = await scanA11y(page, { include: 'nav, [role="navigation"]' });

    expect(violations, formatViolations(violations, 'the navigation rail')).toEqual([]);
  });

  test('the Quick Access launcher has no WCAG A/AA violations', async ({ homePage, page }) => {
    /*
     * The launcher is the accessible navigation path the whole suite depends
     * on — a real ARIA dialog whose entries are real buttons with real names.
     * If it ever regresses, module navigation has no accessible route left at
     * all, so it is worth its own scan while it is open.
     */
    await homePage.open();
    await homePage.expectLoaded();
    await homePage.openQuickAccess();

    const violations = await scanA11y(page, { include: '[role="dialog"]' });

    expect(violations, formatViolations(violations, 'the Quick Access launcher')).toEqual([]);
  });
});
