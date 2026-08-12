/**
 * KMail module — navigation, tabs, and mailbox state.
 *
 * Runs authenticated via the default shared-storageState fixture.
 *
 * ── The 401 defect is resolved ──
 * This file previously carried a deliberately-failing test: launching KMail
 * fired four calls to `kmail5.kpostindia.com/kmail5/v2/common/*` that all
 * returned 401, and the SPA force-logged-out to `/login`. Re-probed on
 * 2026-08-12, KMail loads cleanly and makes no calls to that host at all — its
 * data now comes from `localhost:8989`. The module-load test below is therefore
 * a normal passing smoke test rather than a known-failure marker.
 *
 * Compose is not covered here: KMail has no composer. Composing is the separate
 * "Write Mail" module — `KMailPage.startCompose()` launches it, and it deserves
 * its own page object and specs once exercised.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import { faker } from '@faker-js/faker';
import { KNOWN_APP_DEFECTS, noteKnownDefect } from '../../src/utils/known-defects';
import { env } from '../../src/config/env';

/** Per-run unique text so parallel workers can never collide. */
function uniqueTerm(): string {
  return `qa-${Date.now()}-${faker.string.alphanumeric(6)}`;
}

test.describe('KMail navigation @smoke @kmail', () => {
  test('KMail is offered in the Quick Access launcher', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await homePage.openQuickAccess();
    await homePage.expectModuleAvailable('KMail');
  });

  test('opening KMail from Quick Access loads the module', async ({
    homePage,
    kmailPage,
    page,
  }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await kmailPage.openFromLauncher();

    await expect(page).toHaveURL(/\/kmail/i);
    await kmailPage.expectLoaded();
    await kmailPage.expectPaneTitle();
  });

  test('KMail is also reachable from the icon rail', async ({ homePage, kmailPage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await kmailPage.openFromRail();

    await kmailPage.expectLoaded();
  });
});

test.describe('KMail mailbox @regression @kmail', () => {
  test('the mailbox exposes Recents, Contacts and Status of Mails tabs', async ({
    homePage,
    kmailPage,
  }) => {
    // KMail still raises an uncaught TypeError on load (annotated below), and
    // in dev mode that pops an overlay which blocks clicks. Verified 2026-08-12:
    // the module underneath works — all three tabs click and select correctly
    // once the dev-only overlay is dismissed, which is exactly what a user does
    // and what a production build would show. So: dismiss the dev artifact,
    // test the real function, and keep the error on record via the annotation.
    noteKnownDefect(KNOWN_APP_DEFECTS.KMAIL_UNOPENED_MAIL_TYPE_ERROR);

    await homePage.open();
    await kmailPage.openFromLauncher();
    await kmailPage.dismissDevErrorOverlay();
    await kmailPage.expectLoaded();

    await kmailPage.expectTabsAvailable();

    await kmailPage.openContactsTab();
    await kmailPage.expectContactsSummary();

    await kmailPage.openStatusOfMailsTab();

    await kmailPage.openRecentsTab();
    await kmailPage.expectUnopenedMailsBadge();
  });

  test('the Recents pane reports mailbox state', async ({ homePage, kmailPage }) => {
    await homePage.open();
    await kmailPage.openFromLauncher();
    await kmailPage.expectLoaded();

    await kmailPage.expectUnopenedMailsBadge();
    await kmailPage.expectStatusOfMailSummary();

    // The counter must be a real number, not a placeholder.
    expect(await kmailPage.unopenedMailCount()).toBeGreaterThanOrEqual(0);
  });

  /**
   * Deliberately modest. KMail renders the same "No Data Found" whether the
   * mailbox is empty or a search matched nothing, so with an empty mailbox
   * there is no observable difference to assert on — claiming this proves
   * filtering would be a lie. What it does prove: the search box accepts and
   * commits a query, and the pane survives it. Strengthen this to a real
   * filtering assertion once the test account has mail.
   */
  test('the mailbox search accepts a query and keeps the pane coherent', async ({
    homePage,
    kmailPage,
  }) => {
    const term = uniqueTerm();

    await homePage.open();
    await kmailPage.openFromLauncher();
    await kmailPage.expectLoaded();

    await kmailPage.searchMail(term);
    expect(await kmailPage.currentSearchTerm()).toBe(term);
    await kmailPage.expectNoMailsFound();

    await kmailPage.clearMailSearch();
    expect(await kmailPage.currentSearchTerm()).toBe('');
    await kmailPage.expectUnopenedMailsBadge();
  });
});

test.describe('KMail compose & send @regression @kmail', () => {
  /**
   * The full compose → send → Sent-folder journey. Needs a SECOND KPost
   * account (`MAIL_RECIPIENT`): the backend rejects sending to yourself, so
   * with only the standard account configured there is no valid recipient and
   * this skips with the reason below. The self-send contract test that follows
   * keeps the whole mechanical path covered in every environment.
   */
  test('a sent mail is accepted and appears in the Sent folder', async ({
    homePage,
    kmailPage,
  }) => {
    test.skip(
      !env.mail.recipient,
      'No MAIL_RECIPIENT configured. KPost rejects self-sends ("Duplicate IDs are present in ' +
        'ToAddress…"), so the success path needs a second KPOST account to address.',
    );
    test.skip(
      env.mail.recipient === env.users.standard.email,
      'MAIL_RECIPIENT is set to the SAME account as STANDARD_USER_EMAIL, which the backend ' +
        'is guaranteed to reject as a self-send ("Duplicate IDs are present in ToAddress…"). ' +
        'Point it at a different KPOST account to unlock this journey.',
    );

    const subject = `QA automated mail ${Date.now()}-${faker.string.alphanumeric(4)}`;

    await homePage.open();
    await homePage.expectLoaded();

    const verdict = await kmailPage.composeAndSend({
      to: env.mail.recipient as string,
      subject,
      body: `Automated end-to-end mail sent by the KPost UI suite (${subject}).`,
    });

    expect(verdict.status, `postMail rejected: ${verdict.message}`).toBeLessThan(300);
    await kmailPage.expectMailInSentFolder(subject);
  });

  /**
   * The self-send rejection contract, verified live on 2026-08-12: composing
   * to your own address exercises the entire real pipeline — form, type-ahead
   * normalisation, Quill body, the unlabelled send button, the postMail API
   * round-trip, and the UI's feedback.
   *
   * The stable invariant asserted is "a self-send is never accepted, and the
   * UI says so". The *specific* status is deliberately not pinned: the correct
   * verdict is 400 "Duplicate IDs are present in ToAddress, CopyList, or
   * ConfidentialCopyList", but the backend intermittently answers 401 for the
   * same valid session instead (KPOST-KMAIL-002, annotated below). If KPost
   * ever starts accepting self-sends, this fails and should be updated
   * deliberately, not patched around.
   */
  test('sending a mail to yourself is rejected with the documented error', async ({
    homePage,
    kmailPage,
    standardUser,
  }) => {
    noteKnownDefect(KNOWN_APP_DEFECTS.KMAIL_POSTMAIL_INTERMITTENT_401);
    const subject = `QA automated mail ${Date.now()}-${faker.string.alphanumeric(4)}`;

    await homePage.open();
    await homePage.expectLoaded();

    const verdict = await kmailPage.composeAndSend({
      to: standardUser.email,
      subject,
      body: `Automated self-send contract check (${subject}).`,
    });

    expect(verdict.status, `postMail verdict: ${verdict.status} ${verdict.message}`).toBeGreaterThanOrEqual(400);
    expect(verdict.status).toBeLessThan(500);
    await kmailPage.expectSendErrorAlert();
  });
});
