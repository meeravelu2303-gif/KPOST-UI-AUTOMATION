/**
 * KMailPage — the KPost mail module (route: `/kmail`).
 *
 * ── Verification status (re-probed against the live app on 2026-08-12) ──
 * The 401 force-logout that previously made this module unreachable is GONE.
 * KMail now loads cleanly and makes **no calls at all** to
 * `kmail5.kpostindia.com`; its data now comes from `localhost:8989`. See
 * `TEST-BENCH-REPORT.md` for the evidence that this was never a token
 * propagation problem on our side.
 *
 * VERIFIED · Offered by Quick Access as `button "K KMail Open inbox and mails Open"`.
 * VERIFIED · Launching it routes to `/kmail` and renders the pane title "KMail".
 * VERIFIED · Also reachable from the icon rail (`div.icon-KP_03-KMail`).
 * VERIFIED · A `tablist` of THREE tabs: `Recents` (default), `Contacts`, and
 *            `Status of Mails` — one more than Katchup's two.
 * VERIFIED · An unopened counter rendered as "<n> Unopened Mails" (note: Mails,
 *            where Katchup says Messages).
 * VERIFIED · Two `searchbox "Search"` controls — scope with `.first()`.
 * VERIFIED · Empty states: "No Data Found", "No Frequently Accessed Mail",
 *            "My Contacts • 0", "No Contacts", "No Groups", plus Unknown /
 *            Other Domain Contact sections.
 * VERIFIED · A Status-of-Mail summary: Draft Mails, Sent Mail, "Not Opened • 0",
 *            "Reply Not Received • 0", "Reply Not Sent • 0".
 *
 * ── Where composing actually lives ──
 * KMail has **no compose button**. The whole module exposes 15 interactive
 * elements and none of them starts a mail. Composing is a *separate* module —
 * the launcher offers `button "W Write Mail Compose a new mail Open"`. So
 * `startCompose()` launches Write Mail rather than hunting for a button that
 * does not exist here. The compose *form* itself is unverified; Write Mail
 * deserves its own page object once it is exercised.
 */
import { type Locator, type Page, expect, test } from '@playwright/test';
import { AppShellPage } from './AppShellPage';

export interface MailDraft {
  to: string;
  subject: string;
  body: string;
}

export class KMailPage extends AppShellPage {
  protected readonly path = '/kmail';

  // ---- Verified ----
  private readonly paneTitle: Locator;
  private readonly recentsTab: Locator;
  private readonly contactsTab: Locator;
  private readonly statusOfMailsTab: Locator;
  private readonly mailSearch: Locator;
  private readonly unopenedMails: Locator;
  private readonly noDataState: Locator;
  private readonly myContactsSummary: Locator;
  private readonly draftMails: Locator;
  private readonly sentMail: Locator;

  // ---- Unverified: no mail data on this account ----
  private readonly mailList: Locator;
  private readonly mailListItems: Locator;
  private readonly composeTo: Locator;
  private readonly composeSubject: Locator;
  private readonly composeBody: Locator;
  private readonly sendButton: Locator;

  constructor(page: Page) {
    super(page);
    this.paneTitle = page.getByText(/^\s*KMail\s*$/).first();
    this.recentsTab = page.getByRole('tab', { name: /recents/i });
    this.contactsTab = page.getByRole('tab', { name: /^\s*contacts\s*$/i });
    this.statusOfMailsTab = page.getByRole('tab', { name: /status of mails/i });
    this.mailSearch = page.getByRole('searchbox', { name: /search/i }).first();
    this.unopenedMails = page.getByText(/unopened mails/i);
    this.noDataState = page.getByText(/no data found/i);
    this.myContactsSummary = page.getByText(/my contacts/i);
    this.draftMails = page.getByText(/draft mails/i);
    this.sentMail = page.getByText(/sent mail/i);

    this.mailList = page.getByRole('list', { name: /mails?|inbox|messages/i }).first();
    this.mailListItems = this.mailList.getByRole('listitem');
    this.composeTo = page.getByLabel(/^\s*to\b/i);
    this.composeSubject = page.getByLabel(/subject/i);
    this.composeBody = page.getByRole('textbox', { name: /body|message|content/i });
    this.sendButton = page.getByRole('button', { name: /^\s*send\s*$/i });
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /** Open KMail through the Quick Access launcher (the accessible nav path). */
  async openFromLauncher(): Promise<void> {
    await test.step('Open KMail from Quick Access', async () => {
      await this.launchModule('KMail');
      await this.expectPath(/\/kmail/i);
    });
  }

  /** Open KMail from the left icon rail (`div.icon-KP_03-KMail`). */
  async openFromRail(): Promise<void> {
    await test.step('Open KMail from the icon rail', async () => {
      await this.openModuleFromRail('KMail');
      await this.expectPath(/\/kmail/i);
    });
  }

  /** Assert the module loaded and the session survived (this is the assertion
   *  that used to catch the 401 force-logout). */
  async expectLoaded(): Promise<void> {
    await test.step('Expect the KMail module to be loaded', async () => {
      await this.expectStillAuthenticated();
      await this.expectPath(/\/kmail/i);
      await this.expectShellVisible();
      await expect(this.recentsTab).toBeVisible();
    });
  }

  async expectPaneTitle(): Promise<void> {
    await test.step('Expect the KMail pane title', async () => {
      await expect(this.paneTitle).toBeVisible();
    });
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------

  async expectTabsAvailable(): Promise<void> {
    await test.step('Expect the Recents, Contacts and Status of Mails tabs', async () => {
      await expect(this.recentsTab).toBeVisible();
      await expect(this.contactsTab).toBeVisible();
      await expect(this.statusOfMailsTab).toBeVisible();
    });
  }

  async openRecentsTab(): Promise<void> {
    await test.step('Open the Recents tab', async () => {
      await this.click(this.recentsTab);
      await expect(this.recentsTab).toHaveAttribute('aria-selected', 'true');
    });
  }

  async openContactsTab(): Promise<void> {
    await test.step('Open the Contacts tab', async () => {
      await this.click(this.contactsTab);
      await expect(this.contactsTab).toHaveAttribute('aria-selected', 'true');
    });
  }

  async openStatusOfMailsTab(): Promise<void> {
    await test.step('Open the Status of Mails tab', async () => {
      await this.click(this.statusOfMailsTab);
      await expect(this.statusOfMailsTab).toHaveAttribute('aria-selected', 'true');
    });
  }

  // ---------------------------------------------------------------------------
  // Inbox / Recents
  // ---------------------------------------------------------------------------

  async expectUnopenedMailsBadge(): Promise<void> {
    await test.step('Expect the unopened-mail counter', async () => {
      await expect(this.unopenedMails).toBeVisible();
    });
  }

  /** The number in "<n> Unopened Mails", or 0 when it cannot be read. */
  async unopenedMailCount(): Promise<number> {
    return test.step('Read the unopened-mail count', async () => {
      const text = await this.getText(this.unopenedMails);
      const match = /(\d+)/.exec(text);
      return match ? Number(match[1]) : 0;
    });
  }

  async expectEmptyMailbox(): Promise<void> {
    await test.step('Expect the empty-mailbox state', async () => {
      await expect(this.noDataState).toBeVisible();
    });
  }

  async expectStatusOfMailSummary(): Promise<void> {
    await test.step('Expect the Status of Mail summary', async () => {
      await expect(this.draftMails).toBeVisible();
      await expect(this.sentMail).toBeVisible();
    });
  }

  /** How many mails are listed. Returns 0 when the list never renders. */
  async inboxCount(): Promise<number> {
    return test.step('Count inbox items', async () => {
      if (!(await this.isVisible(this.mailList, 5_000))) return 0;
      return this.mailListItems.count();
    });
  }

  async openMailBySubject(subject: string | RegExp): Promise<void> {
    await test.step(`Open the mail "${subject}"`, async () => {
      await this.click(this.mailListItems.filter({ hasText: subject }).first());
    });
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async searchMail(term: string): Promise<void> {
    await test.step(`Search mail for "${term}"`, async () => {
      await this.fill(this.mailSearch, term);
    });
  }

  async clearMailSearch(): Promise<void> {
    await test.step('Clear the mail search', async () => {
      await this.fill(this.mailSearch, '');
    });
  }

  /**
   * Assert the mailbox reports "no mails".
   *
   * Note KMail does NOT distinguish "your search matched nothing" from "your
   * mailbox is empty" — both render the same "No Data Found". (Katchup, by
   * contrast, has a distinct "No results found".) So this cannot be used to
   * prove a search actually filtered; it only proves the pane is still showing
   * a coherent empty state. Verified 2026-08-12 by searching a term that cannot
   * match and diffing the DOM against the unfiltered pane.
   */
  async expectNoMailsFound(): Promise<void> {
    await test.step('Expect the "No Data Found" mailbox state', async () => {
      await expect(this.noDataState).toBeVisible();
    });
  }

  /** The text currently in the mailbox search box. */
  async currentSearchTerm(): Promise<string> {
    return test.step('Read the mailbox search term', async () => this.mailSearch.inputValue());
  }

  async expectContactsSummary(): Promise<void> {
    await test.step('Expect the My Contacts summary', async () => {
      await expect(this.myContactsSummary).toBeVisible();
    });
  }

  // ---------------------------------------------------------------------------
  // Compose — lives in the separate "Write Mail" module (see class doc)
  // ---------------------------------------------------------------------------

  /** Launch the Write Mail module, which is where composing actually happens. */
  async startCompose(): Promise<void> {
    await test.step('Open the Write Mail composer', async () => {
      await this.launchModule('Write Mail');
    });
  }

  /** UNVERIFIED — the compose form has not been observed. */
  async fillDraft(draft: MailDraft): Promise<void> {
    await test.step(`Fill the draft "${draft.subject}"`, async () => {
      await this.fill(this.composeTo, draft.to);
      await this.fill(this.composeSubject, draft.subject);
      await this.composeBody.click();
      await this.composeBody.fill(draft.body);
    });
  }

  /** UNVERIFIED — the compose form has not been observed. */
  async send(): Promise<void> {
    await test.step('Send the mail', async () => {
      await this.click(this.sendButton);
    });
  }
}
