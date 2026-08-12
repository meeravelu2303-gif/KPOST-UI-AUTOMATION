/**
 * KDirectoryPage — the KPost contact directory module.
 *
 * ── Verification status (probed against the live app on 2026-08-12) ──
 * VERIFIED · Offered by Quick Access as `button "K KDirectory Open directory Open"`.
 * VERIFIED · Launching it navigates to `https://localhost:3000/kdirectory` with
 *            zero failed requests, and renders `heading "KDirectory"`.
 * VERIFIED · Reachable from the left icon rail too (`div.icon-KP_06-KDirectory`).
 * VERIFIED · For a not-yet-onboarded account the module opens on a **first-run
 *            setup wizard** — Country, Language, and a vertical (Personal /
 *            Business / Institution / Government) — with `button "Continue"`
 *            disabled until the required selections are made.
 *
 * GATED    · The contact search and directory list sit behind that wizard, so
 *            they could not be observed with the standard test user. Completing
 *            the wizard permanently onboards the account into a vertical, which
 *            is a real account mutation — deliberately not performed during
 *            discovery. Those locators are therefore conventional, not verified,
 *            and are written role-first so only these declarations should need
 *            revisiting once a pre-onboarded fixture user exists.
 */
import { type Locator, type Page, expect, test } from '@playwright/test';
import { AppShellPage } from './AppShellPage';

export type DirectoryVertical = 'Personal' | 'Business' | 'Institution' | 'Government';

export class KDirectoryPage extends AppShellPage {
  protected readonly path = '/kdirectory';

  // ---- Verified ----
  private readonly moduleHeading: Locator;
  private readonly continueButton: Locator;
  private readonly countryLabel: Locator;
  private readonly languageLabel: Locator;

  // ---- Gated behind the setup wizard (conventional locators) ----
  private readonly contactSearch: Locator;
  private readonly directoryList: Locator;
  private readonly directoryEntries: Locator;
  private readonly addContactButton: Locator;
  private readonly noResultsState: Locator;

  constructor(page: Page) {
    super(page);
    this.moduleHeading = page.getByRole('heading', { name: /^\s*kdirectory\s*$/i });
    this.continueButton = page.getByRole('button', { name: /^\s*continue\s*$/i });
    this.countryLabel = page.getByText(/select country/i);
    this.languageLabel = page.getByText(/choose language/i);

    this.contactSearch = page.getByRole('searchbox').first();
    this.directoryList = page.getByRole('list').first();
    this.directoryEntries = this.directoryList.getByRole('listitem');
    this.addContactButton = page.getByRole('button', { name: /add contact|new contact/i });
    this.noResultsState = page.getByText(/no data found|no contacts|no results/i);
  }

  // ---------------------------------------------------------------------------
  // Launch & load
  // ---------------------------------------------------------------------------

  /** Open KDirectory through the Quick Access launcher (accessible nav path). */
  async openFromLauncher(): Promise<void> {
    await test.step('Open KDirectory from Quick Access', async () => {
      await this.launchModule('KDirectory');
      await this.expectPath(/\/kdirectory/i);
    });
  }

  /** Open KDirectory from the icon rail (covers the rail itself). */
  async openFromRail(): Promise<void> {
    await test.step('Open KDirectory from the icon rail', async () => {
      await this.openModuleFromRail('KDirectory');
      await this.expectPath(/\/kdirectory/i);
    });
  }

  async expectLoaded(): Promise<void> {
    await test.step('Expect the KDirectory module to be loaded', async () => {
      await this.expectStillAuthenticated();
      await expect(this.moduleHeading).toBeVisible();
    });
  }

  // ---------------------------------------------------------------------------
  // First-run setup wizard
  // ---------------------------------------------------------------------------

  /** True when the account still has to complete directory onboarding. */
  async isSetupRequired(): Promise<boolean> {
    return test.step('Check whether KDirectory setup is required', async () =>
      this.isVisible(this.continueButton, 5_000));
  }

  /** Assert the wizard is showing and refuses to continue until it is filled in. */
  async expectSetupGate(): Promise<void> {
    await test.step('Expect the setup wizard to gate Continue', async () => {
      await expect(this.countryLabel).toBeVisible();
      await expect(this.languageLabel).toBeVisible();
      await expect(this.continueButton).toBeDisabled();
    });
  }

  /** Assert each vertical option is offered by the wizard. */
  async expectVerticalOffered(vertical: DirectoryVertical): Promise<void> {
    await test.step(`Expect the "${vertical}" vertical to be offered`, async () => {
      await expect(this.page.getByText(vertical, { exact: true }).first()).toBeVisible();
    });
  }

  /**
   * Choose a vertical. NOTE: completing this wizard permanently onboards the
   * account, so only call it from a test that owns a disposable user.
   */
  async chooseVertical(vertical: DirectoryVertical): Promise<void> {
    await test.step(`Choose the "${vertical}" vertical`, async () => {
      await this.click(this.page.getByText(vertical, { exact: true }).first());
    });
  }

  async continueSetup(): Promise<void> {
    await test.step('Continue past the setup wizard', async () => {
      await this.click(this.continueButton);
    });
  }

  // ---------------------------------------------------------------------------
  // Contact search
  // ---------------------------------------------------------------------------

  async searchContacts(term: string): Promise<void> {
    await test.step(`Search the directory for "${term}"`, async () => {
      await this.fill(this.contactSearch, term);
      await this.contactSearch.press('Enter');
    });
  }

  async expectContactVisible(name: string | RegExp): Promise<void> {
    await test.step(`Expect contact "${name}" in the results`, async () => {
      await expect(this.directoryEntries.filter({ hasText: name }).first()).toBeVisible();
    });
  }

  async expectNoResults(): Promise<void> {
    await test.step('Expect the no-results state', async () => {
      await expect(this.noResultsState).toBeVisible();
    });
  }

  // ---------------------------------------------------------------------------
  // Directory list
  // ---------------------------------------------------------------------------

  async expectDirectoryListVisible(): Promise<void> {
    await test.step('Expect the directory list', async () => {
      await expect(this.directoryList).toBeVisible();
    });
  }

  async directoryCount(): Promise<number> {
    return test.step('Count directory entries', async () => this.directoryEntries.count());
  }

  async openContact(name: string | RegExp): Promise<void> {
    await test.step(`Open contact "${name}"`, async () => {
      await this.click(this.directoryEntries.filter({ hasText: name }).first());
    });
  }

  async startAddContact(): Promise<void> {
    await test.step('Start adding a contact', async () => {
      await this.click(this.addContactButton);
    });
  }
}
