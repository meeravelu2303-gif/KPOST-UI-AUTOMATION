/**
 * AppShellPage — the persistent KPost application chrome.
 *
 * Every authenticated screen (verified on `/home` and `/kdirectory`) renders the
 * same shell: a top bar (logo, Global Search, voice command, Quick Access,
 * account name, language picker) and a narrow left icon rail. Module pages
 * extend this class so they inherit navigation, launching, and logout.
 *
 * ── How KPost navigation actually works (verified against the live app) ──
 * The left rail is **icon-only**: `<div class="... icon-KP_03-KMail">` with no
 * text, no `aria-label`, no `title`. It is therefore unreachable by any
 * accessible locator — a genuine accessibility gap in the product, and the one
 * place this framework is forced to fall back to a CSS class selector.
 *
 * The robust, accessible path is the **Quick Access launcher** (top-bar button,
 * or Ctrl/Cmd+K): a real ARIA dialog whose module entries are real buttons with
 * real accessible names, e.g. `button "K KMail Open inbox and mails Open"`.
 * `launchModule()` uses that path; `openModuleFromRail()` exists only to cover
 * the rail itself.
 *
 * Note: `/home` always has one background `role="dialog"` in the DOM, so the
 * launcher must be selected by its content, never by role alone.
 */
import { type Locator, type Page, expect, test } from '@playwright/test';
import { BasePage } from './BasePage';
import type { KPostModule } from '../types';

/** CSS classes of the icon-only left rail, read off the live DOM. Last-resort
 *  selectors: the rail exposes no accessible name to target (see class doc).
 *  Partial by design — "KDOC" and "My Profile" are launcher-only entries with
 *  no verified rail icon. */
const RAIL_ICON_CLASS: Partial<Record<KPostModule, string>> = {
  Home: 'icon-KP_01-Home',
  'Write Mail': 'icon-KP_02-Write-Letter',
  KMail: 'icon-KP_03-KMail',
  Katchup: 'icon-KP_04-Katchup',
  Kall: 'icon-KP_05-Kall',
  KDirectory: 'icon-KP_06-KDirectory',
  KCloud: 'icon-KP_295_Cloud-Storage',
  KBooking: 'icon-KP_88-Bus',
  KEcommerce: 'icon-KP_14-KCommerce',
  KNews: 'icon-KP_08-KNews',
  Settings: 'icon-KP_15-Settings',
};

const LOGOUT_RAIL_ICON = 'icon-KP_18-Logout';

/**
 * How long the shell may take to paint after a navigation.
 *
 * Measured, not guessed: KPost boots behind a `PersistGate` loader and the first
 * authenticated paint regularly lands well past the 10s default assertion
 * budget. This is the single slow gate — every assertion *after* the shell is up
 * keeps the normal timeout, so a genuine regression still fails fast.
 */
const SHELL_RENDER_TIMEOUT = 45_000;

export abstract class AppShellPage extends BasePage {
  protected readonly quickAccessButton: Locator;
  protected readonly globalSearchButton: Locator;
  protected readonly voiceCommandButton: Locator;
  protected readonly quickAccessDialog: Locator;
  protected readonly quickAccessSearch: Locator;
  protected readonly sessionExpiredAlert: Locator;
  private readonly logoutRailIcon: Locator;
  private readonly logoutConfirmButton: Locator;

  constructor(page: Page) {
    super(page);
    this.quickAccessButton = page.getByRole('button', { name: /quick access/i });
    // Verified disabled in the current build (aria-label "Global Search (Disabled)").
    this.globalSearchButton = page.getByRole('button', { name: /global search/i });
    this.voiceCommandButton = page.getByRole('button', { name: /start voice command/i });
    // `/home` carries a second, unrelated dialog — always disambiguate by content.
    this.quickAccessDialog = page.getByRole('dialog').filter({ hasText: 'Quick Access' }).first();
    this.quickAccessSearch = this.quickAccessDialog.getByPlaceholder(/search pages, contacts, messages/i);
    this.sessionExpiredAlert = page.getByRole('alert').filter({ hasText: /session has expired/i });
    this.logoutRailIcon = page.locator(`div[class*="${LOGOUT_RAIL_ICON}"]`).first();
    this.logoutConfirmButton = page.getByRole('button', { name: /^\s*log ?out\s*$/i });
  }

  // ---------------------------------------------------------------------------
  // Quick Access launcher
  // ---------------------------------------------------------------------------

  /** Open the launcher from the top-bar button. */
  async openQuickAccess(): Promise<void> {
    await test.step('Open the Quick Access launcher', async () => {
      await this.click(this.quickAccessButton);
      await expect(this.quickAccessDialog).toBeVisible();
    });
  }

  /** Open the launcher via the Ctrl+K shortcut (verified: Ctrl+K → Quick Access,
   *  not the global search, which is disabled in this build). */
  async openQuickAccessByShortcut(): Promise<void> {
    await test.step('Open Quick Access with Ctrl+K', async () => {
      await this.page.keyboard.press('Control+k');
      await expect(this.quickAccessDialog).toBeVisible();
    });
  }

  async closeQuickAccess(): Promise<void> {
    await test.step('Close the Quick Access launcher', async () => {
      await this.page.keyboard.press('Escape');
      await expect(this.quickAccessDialog).toBeHidden();
    });
  }

  /** The launcher card for a module, located by its accessible name. */
  protected moduleCard(module: KPostModule): Locator {
    return this.quickAccessDialog.getByRole('button', { name: new RegExp(`\\b${module}\\b`) }).first();
  }

  /** Assert a module is offered by the launcher (opens it if not already open). */
  async expectModuleAvailable(module: KPostModule): Promise<void> {
    await test.step(`Expect "${module}" to be offered in Quick Access`, async () => {
      if (!(await this.quickAccessDialog.isVisible())) await this.openQuickAccess();
      await expect(this.moduleCard(module)).toBeVisible();
    });
  }

  /** Launch a module from the launcher and wait for the SPA to settle. */
  async launchModule(module: KPostModule): Promise<void> {
    await test.step(`Launch "${module}" from Quick Access`, async () => {
      if (!(await this.quickAccessDialog.isVisible())) await this.openQuickAccess();
      await this.click(this.moduleCard(module));
      await expect(this.quickAccessDialog).toBeHidden();
    });
  }

  /** Type into the launcher's search field. */
  async searchQuickAccess(term: string): Promise<void> {
    await test.step(`Search Quick Access for "${term}"`, async () => {
      await this.fill(this.quickAccessSearch, term);
    });
  }

  // ---------------------------------------------------------------------------
  // Icon rail (CSS-class fallback — see class doc)
  // ---------------------------------------------------------------------------

  /** Navigate via the left icon rail. Only for covering the rail itself;
   *  prefer `launchModule()` everywhere else. */
  async openModuleFromRail(module: KPostModule): Promise<void> {
    const iconClass = RAIL_ICON_CLASS[module];
    if (!iconClass) {
      throw new Error(`"${module}" has no icon in the left rail — launch it with launchModule() instead.`);
    }

    await test.step(`Open "${module}" from the icon rail`, async () => {
      await this.click(this.page.locator(`div[class*="${iconClass}"]`).first());
    });
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  /** Assert the shell is present — the cheapest proof we are still signed in. */
  async expectShellVisible(): Promise<void> {
    await test.step('Expect the authenticated app shell', async () => {
      await expect(this.quickAccessButton).toBeVisible({ timeout: SHELL_RENDER_TIMEOUT });
    });
  }

  /** Assert the app has NOT bounced us to the login screen. */
  async expectStillAuthenticated(): Promise<void> {
    await test.step('Expect the session to still be valid', async () => {
      await expect(this.page).not.toHaveURL(/\/login/i);
      await expect(this.sessionExpiredAlert).toBeHidden();
    });
  }

  /** Log out via the rail icon and its confirmation modal, landing on /login. */
  async logout(): Promise<void> {
    await test.step('Log out', async () => {
      await this.click(this.logoutRailIcon);
      await this.click(this.logoutConfirmButton);
      await expect(this.page).toHaveURL(/\/login/i);
    });
  }
}
