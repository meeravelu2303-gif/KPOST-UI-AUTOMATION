/**
 * Home shell & navigation.
 *
 * KPost lands authenticated users on `/home` — a modular super-app shell with a
 * left sidebar of modules, a top-bar global search, and Recents / Contacts tabs.
 * These tests validate the shell renders and its primary navigation works.
 *
 * Runs authenticated via the default shared-storageState fixture.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import type { KPostModule } from '../../src/types';

test.describe('Home shell @smoke @home', () => {
  test('lands on /home and renders the module sidebar', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    // Core modules visible in the sidebar rail.
    const modules: KPostModule[] = ['Home', 'KMail', 'KDirectory', 'KEcommerce', 'KNews', 'Settings'];
    for (const module of modules) {
      await homePage.expectModuleVisible(module);
    }
  });

  test('the Home pane exposes Recents and Contacts tabs', async ({ homePage }) => {
    await homePage.open();
    await homePage.openContactsTab();
    await homePage.openRecentsTab();
  });
});

test.describe('Home navigation @regression @home', () => {
  test('navigating to KMail from the sidebar leaves the home root', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await homePage.navigateTo('KMail');

    // The exact KMail route is app-specific; assert we navigated off the home
    // root rather than hard-coding a path that may differ.
    await expect(page).not.toHaveURL(/\/home\/?$/i);
  });

  test('global search is available in the top bar', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.globalSearchFor('test');
    // A results surface should appear; at minimum the app must not crash back
    // to login. Kept intentionally loose until the real results DOM is confirmed.
    await expect(page).not.toHaveURL(/\/login/i);
  });
});
