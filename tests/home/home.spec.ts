/**
 * Home shell & module navigation.
 *
 * KPost lands authenticated users on `/home`: a top bar (Quick Access launcher,
 * voice command, account), an icon-only left rail, and a Home pane with
 * Recents / Contacts tabs plus KNews and KEcommerce panels.
 *
 * Rewritten against the live app on 2026-08-12. The previous version navigated
 * by clicking sidebar *text* and asserted a top-bar global search; neither
 * exists — the rail is icon-only with no accessible name, and the Global Search
 * button ships disabled. Module navigation goes through Quick Access (Ctrl+K).
 *
 * Runs authenticated via the default shared-storageState fixture.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import type { KPostModule } from '../../src/types';

test.describe('Home shell @smoke @home', () => {
  test('lands on /home and renders the authenticated shell', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectLoaded();
    await homePage.expectTabsAvailable();
  });

  test('the Quick Access launcher offers the core modules', async ({ homePage }) => {
    await homePage.open();
    await homePage.openQuickAccess();

    const modules: KPostModule[] = ['Home', 'KMail', 'KDirectory', 'KEcommerce', 'KNews', 'Settings'];
    for (const module of modules) {
      await homePage.expectModuleAvailable(module);
    }
  });

  test('the Home pane exposes Recents and Contacts tabs', async ({ homePage }) => {
    await homePage.open();
    await homePage.openContactsTab();
    await homePage.openRecentsTab();
  });
});

test.describe('Home navigation @regression @home', () => {
  test('Ctrl+K opens the Quick Access launcher', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await homePage.openQuickAccessByShortcut();
    await homePage.closeQuickAccess();
  });

  test('launching a module from Quick Access leaves the home root', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await homePage.launchModule('KDirectory');

    await expect(page).not.toHaveURL(/\/home\/?$/i);
  });

  test('the Home pane surfaces the KNews and KEcommerce panels', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await homePage.expectNewsPanel();
    await homePage.expectMarketplacePanel();
  });
});
