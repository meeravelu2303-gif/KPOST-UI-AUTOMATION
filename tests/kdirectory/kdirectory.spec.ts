/**
 * KDirectory module — navigation, first-run setup gate, and directory search.
 *
 * Runs authenticated via the default shared-storageState fixture.
 *
 * Verified against the live app (re-probed 2026-08-12): KDirectory launches
 * cleanly with zero failed requests, routes to `/kdirectory`, and renders its
 * heading. For an account that has not completed directory onboarding it opens
 * on a setup wizard — Country, Language, and a vertical (Personal / Business /
 * Institution / Government) — whose "Continue" button stays disabled until the
 * required selections are made.
 *
 * The search and result-filter journeys sit behind that wizard. Completing it
 * permanently onboards the account into a vertical, so it is not automated
 * against the shared standard user; those tests guard on the wizard and report
 * why they skipped. Give the suite a pre-onboarded (or disposable) user and
 * they start running with no code change.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import type { DirectoryVertical } from '../../src/pages/KDirectoryPage';
import { faker } from '@faker-js/faker';

const ONBOARDING_REQUIRED =
  'This account has not completed KDirectory onboarding, and the search/list UI is behind that wizard. ' +
  'Completing it permanently onboards the account into a vertical, so it is not done automatically. ' +
  'Provide a pre-onboarded test user to enable this journey.';

test.describe('KDirectory navigation @smoke @kdirectory', () => {
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

test.describe('KDirectory setup wizard @regression @kdirectory', () => {
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

test.describe('KDirectory search @regression @kdirectory', () => {
  test('searching a unique term returns no matches', async ({ homePage, kdirectoryPage }) => {
    await homePage.open();
    await kdirectoryPage.openFromLauncher();
    await kdirectoryPage.expectLoaded();

    test.skip(await kdirectoryPage.isSetupRequired(), ONBOARDING_REQUIRED);

    // Dynamic content: a term generated for this run alone can never match.
    await kdirectoryPage.searchDirectory(`qa-${Date.now()}-${faker.string.alphanumeric(6)}`);

    await kdirectoryPage.expectNoResults();
  });

  test('searching for the signed-in user finds them in the directory', async ({
    homePage,
    kdirectoryPage,
    standardUser,
  }) => {
    await homePage.open();
    await kdirectoryPage.openFromLauncher();
    await kdirectoryPage.expectLoaded();

    test.skip(await kdirectoryPage.isSetupRequired(), ONBOARDING_REQUIRED);

    await kdirectoryPage.searchDirectory(standardUser.email);

    await kdirectoryPage.expectDirectoryListVisible();
    await kdirectoryPage.verifyContactExists(standardUser.email);
  });

  test('the directory offers filters for every vertical', async ({ homePage, kdirectoryPage }) => {
    await homePage.open();
    await kdirectoryPage.openFromLauncher();
    await kdirectoryPage.expectLoaded();

    test.skip(await kdirectoryPage.isSetupRequired(), ONBOARDING_REQUIRED);

    for (const filter of ['Personal', 'Business', 'Institution', 'Government'] as const) {
      await kdirectoryPage.expectFilterAvailable(filter);
    }
  });
});
