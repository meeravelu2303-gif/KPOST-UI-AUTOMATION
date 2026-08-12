/**
 * KMail module — launcher presence and module load.
 *
 * Runs authenticated via the default shared-storageState fixture.
 *
 * ⚠ KNOWN PRODUCT/ENVIRONMENT DEFECT (observed 2026-08-12)
 * "opening KMail from Quick Access loads the module" is expected to FAIL today,
 * and that failure is correct signal, not test debt. Launching KMail fires four
 * requests at the KMail backend that all return 401:
 *   GET  https://kmail5.kpostindia.com/kmail5/v2/common/frequentKmailContact/
 *   POST https://kmail5.kpostindia.com/kmail5/v2/common/getKmailDashboardMsg/
 *   GET  https://kmail5.kpostindia.com/kmail5/v2/common/unOpenedMailCountBySenderID/
 *   GET  https://kmail5.kpostindia.com/kmail5/v2/common/statusOfKmailsContactsTotalCount/
 * The SPA responds by force-logging-out to `/login` with "Your session has
 * expired. Please login again." Either the standard test user lacks a KMail
 * entitlement or the KMail service rejects the token this environment issues.
 *
 * Inbox / Compose / Recents journeys are intentionally absent: that UI has never
 * been reachable, so any assertion about it would be fiction. `KMailPage`
 * already carries the methods; add the specs once the 401s are resolved.
 */
import { test } from '../../src/fixtures/fixtures';

test.describe('KMail @smoke @kmail', () => {
  test('KMail is offered in the Quick Access launcher', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await homePage.openQuickAccess();
    await homePage.expectModuleAvailable('KMail');
  });

  test('opening KMail from Quick Access loads the module', async ({ homePage, kmailPage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await kmailPage.openFromLauncher();

    // Fails today via the 401 force-logout documented above.
    await kmailPage.expectLoaded();
  });
});
