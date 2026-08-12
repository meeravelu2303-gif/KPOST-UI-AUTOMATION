/**
 * KDirectory module — launcher presence, navigation, and the first-run setup gate.
 *
 * Runs authenticated via the default shared-storageState fixture.
 *
 * Every assertion here was verified against the live app on 2026-08-12:
 * KDirectory launches cleanly (no failed requests), routes to `/kdirectory`,
 * and renders its heading. For an account that has not completed directory
 * onboarding it opens on a setup wizard whose "Continue" button stays disabled
 * until Country / Language / vertical are chosen.
 *
 * Contact search and the directory list live behind that wizard. Completing it
 * permanently onboards the account into a vertical, so those journeys are not
 * automated against the shared standard user — they need a disposable fixture
 * user. `KDirectoryPage` already exposes the methods for when one exists.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import type { DirectoryVertical } from '../../src/pages/KDirectoryPage';

test.describe('KDirectory @smoke @kdirectory', () => {
  test('KDirectory is offered in the Quick Access launcher', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await homePage.openQuickAccess();
    await homePage.expectModuleAvailable('KDirectory');
  });

  test('opening KDirectory from Quick Access navigates to the module', async ({
    homePage,
    kdirectoryPage,
    page,
  }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await kdirectoryPage.openFromLauncher();

    await expect(page).toHaveURL(/\/kdirectory/i);
    await kdirectoryPage.expectLoaded();
  });

  test('KDirectory is also reachable from the icon rail', async ({ homePage, kdirectoryPage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await kdirectoryPage.openFromRail();

    await kdirectoryPage.expectLoaded();
  });
});

test.describe('KDirectory setup wizard @smoke @kdirectory', () => {
  test('the wizard keeps Continue disabled until the required choices are made', async ({
    homePage,
    kdirectoryPage,
  }) => {
    await homePage.open();
    await kdirectoryPage.openFromLauncher();
    await kdirectoryPage.expectLoaded();

    test.skip(
      !(await kdirectoryPage.isSetupRequired()),
      'This account has already completed KDirectory onboarding.',
    );

    await kdirectoryPage.expectSetupGate();
  });

  test('the wizard offers every account vertical', async ({ homePage, kdirectoryPage }) => {
    await homePage.open();
    await kdirectoryPage.openFromLauncher();
    await kdirectoryPage.expectLoaded();

    test.skip(
      !(await kdirectoryPage.isSetupRequired()),
      'This account has already completed KDirectory onboarding.',
    );

    const verticals: DirectoryVertical[] = ['Personal', 'Business', 'Institution', 'Government'];
    for (const vertical of verticals) {
      await kdirectoryPage.expectVerticalOffered(vertical);
    }
  });
});
