/**
 * KMailPage — the KPost mail module (Compose · Inbox · Recents).
 *
 * ── Verification status (probed against the live app on 2026-08-12) ──
 * VERIFIED  · KMail is offered by the Quick Access launcher as
 *             `button "K KMail Open inbox and mails Open"`.
 * BLOCKED   · Launching the module currently fails for the standard test user.
 *             Four calls to the KMail backend return 401:
 *               GET  https://kmail5.kpostindia.com/kmail5/v2/common/frequentKmailContact/
 *               POST https://kmail5.kpostindia.com/kmail5/v2/common/getKmailDashboardMsg/
 *               GET  https://kmail5.kpostindia.com/kmail5/v2/common/unOpenedMailCountBySenderID/
 *               GET  https://kmail5.kpostindia.com/kmail5/v2/common/statusOfKmailsContactsTotalCount/
 *             The SPA reacts by force-logging-out: it redirects to `/login` and
 *             raises "Your session has expired. Please login again."
 *
 * Consequence: the inbox, compose form, and recents list below could not be
 * observed, so those locators are **conventional, not verified**. They are
 * written role-first so that once the 401s are resolved only the locator
 * declarations in this constructor should need revisiting — not the methods and
 * not the specs. `kmail.spec.ts` deliberately asserts only the verified surface
 * plus the module-loads contract, so the suite reports the real defect instead
 * of silently passing.
 */
import { type Locator, type Page, expect, test } from '@playwright/test';
import { AppShellPage } from './AppShellPage';

export interface MailDraft {
  to: string;
  subject: string;
  body: string;
}

export class KMailPage extends AppShellPage {
  /** Unverified: the module never rendered, so its route is inferred from the
   *  sibling modules' pattern (`/kdirectory` is verified). */
  protected readonly path = '/kmail';

  private readonly moduleHeading: Locator;
  private readonly composeButton: Locator;
  private readonly inboxNav: Locator;
  private readonly mailList: Locator;
  private readonly mailListItems: Locator;
  private readonly recentsList: Locator;
  private readonly recentsListItems: Locator;
  private readonly mailSearch: Locator;
  private readonly composeTo: Locator;
  private readonly composeSubject: Locator;
  private readonly composeBody: Locator;
  private readonly sendButton: Locator;
  private readonly emptyMailboxState: Locator;

  constructor(page: Page) {
    super(page);
    this.moduleHeading = page.getByRole('heading', { name: /^\s*kmail\s*$/i });
    // ---- Unverified below: see the module-blocked note in the class doc ----
    this.composeButton = page.getByRole('button', { name: /compose|new mail|write mail/i });
    this.inboxNav = page.getByRole('link', { name: /^\s*inbox\s*$/i })
      .or(page.getByRole('button', { name: /^\s*inbox\s*$/i }))
      .first();
    this.mailList = page.getByRole('list', { name: /mail|inbox|messages/i }).first();
    this.mailListItems = this.mailList.getByRole('listitem');
    this.recentsList = page.getByRole('list', { name: /recent/i }).first();
    this.recentsListItems = this.recentsList.getByRole('listitem');
    this.mailSearch = page.getByRole('searchbox').first();
    this.composeTo = page.getByLabel(/^\s*to\b/i);
    this.composeSubject = page.getByLabel(/subject/i);
    this.composeBody = page.getByRole('textbox', { name: /body|message|content/i });
    this.sendButton = page.getByRole('button', { name: /^\s*send\s*$/i });
    this.emptyMailboxState = page.getByText(/no mails|no messages|nothing here/i);
  }

  // ---------------------------------------------------------------------------
  // Launch & load
  // ---------------------------------------------------------------------------

  /** Open KMail through the Quick Access launcher (the accessible nav path). */
  async openFromLauncher(): Promise<void> {
    await test.step('Open KMail from Quick Access', async () => {
      await this.launchModule('KMail');
    });
  }

  /** Assert the KMail module actually rendered and did not bounce to login.
   *  This is the assertion that currently catches the 401 force-logout. */
  async expectLoaded(): Promise<void> {
    await test.step('Expect the KMail module to be loaded', async () => {
      await this.expectStillAuthenticated();
      await expect(this.moduleHeading.or(this.composeButton).first()).toBeVisible();
    });
  }

  // ---------------------------------------------------------------------------
  // Inbox
  // ---------------------------------------------------------------------------

  async openInbox(): Promise<void> {
    await test.step('Open the Inbox', async () => {
      await this.click(this.inboxNav);
      await expect(this.mailList).toBeVisible();
    });
  }

  async expectInboxVisible(): Promise<void> {
    await test.step('Expect the inbox list to be visible', async () => {
      await expect(this.mailList).toBeVisible();
    });
  }

  /** Number of mails currently rendered in the inbox. */
  async inboxCount(): Promise<number> {
    return test.step('Count inbox items', async () => this.mailListItems.count());
  }

  async openMailBySubject(subject: string | RegExp): Promise<void> {
    await test.step(`Open the mail "${subject}"`, async () => {
      await this.click(this.mailListItems.filter({ hasText: subject }).first());
    });
  }

  async searchMail(term: string): Promise<void> {
    await test.step(`Search mail for "${term}"`, async () => {
      await this.fill(this.mailSearch, term);
      await this.mailSearch.press('Enter');
    });
  }

  async expectEmptyMailbox(): Promise<void> {
    await test.step('Expect the empty-mailbox state', async () => {
      await expect(this.emptyMailboxState).toBeVisible();
    });
  }

  // ---------------------------------------------------------------------------
  // Recents
  // ---------------------------------------------------------------------------

  async expectRecentsVisible(): Promise<void> {
    await test.step('Expect the Recents list', async () => {
      await expect(this.recentsList).toBeVisible();
    });
  }

  async recentsCount(): Promise<number> {
    return test.step('Count Recents entries', async () => this.recentsListItems.count());
  }

  async openRecent(name: string | RegExp): Promise<void> {
    await test.step(`Open recent entry "${name}"`, async () => {
      await this.click(this.recentsListItems.filter({ hasText: name }).first());
    });
  }

  // ---------------------------------------------------------------------------
  // Compose
  // ---------------------------------------------------------------------------

  async startCompose(): Promise<void> {
    await test.step('Start composing a mail', async () => {
      await this.click(this.composeButton);
      await expect(this.composeSubject).toBeVisible();
    });
  }

  async fillDraft(draft: MailDraft): Promise<void> {
    await test.step(`Fill the draft "${draft.subject}"`, async () => {
      await this.fill(this.composeTo, draft.to);
      await this.fill(this.composeSubject, draft.subject);
      await this.composeBody.click();
      await this.composeBody.fill(draft.body);
    });
  }

  async send(): Promise<void> {
    await test.step('Send the mail', async () => {
      await this.click(this.sendButton);
    });
  }

  /** Compose and send in one call. */
  async composeAndSend(draft: MailDraft): Promise<void> {
    await test.step(`Compose and send "${draft.subject}"`, async () => {
      await this.startCompose();
      await this.fillDraft(draft);
      await this.send();
    });
  }
}
