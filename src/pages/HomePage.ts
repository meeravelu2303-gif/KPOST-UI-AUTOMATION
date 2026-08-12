/**
 * HomePage — the authenticated KPost application shell (route: `/home`).
 *
 * KPost is a modular super-app: a persistent left sidebar of modules (Home,
 * KMail, KDirectory, KEcommerce, KNews, Settings, …), a top bar with a global
 * search + account menu, and a Home pane with Recents / Contacts tabs.
 *
 * Sidebar entries are clickable text nodes (verified via codegen:
 * `page.getByText('KDirectory').click()`), and the top-bar global search uses a
 * "Global Search" placeholder (Ctrl+K also opens it).
 */
import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import type { KPostModule } from '../types';

export class HomePage extends BasePage {
  protected readonly path = '/home';

  private readonly globalSearch: Locator;
  private readonly recentsTab: Locator;
  private readonly contactsTab: Locator;
  private readonly logoutItem: Locator;

  constructor(page: Page) {
    super(page);
    // Top-bar global search (placeholder "Global Search"; Ctrl+K also opens it).
    this.globalSearch = page.getByPlaceholder(/global search/i);
    // Home pane tabs (fall back to text if not exposed as ARIA tabs).
    this.recentsTab = page
      .getByRole('tab', { name: /recents/i })
      .or(page.getByText(/^\s*recents\s*$/i))
      .first();
    this.contactsTab = page
      .getByRole('tab', { name: /contacts/i })
      .or(page.getByText(/^\s*contacts\s*$/i))
      .first();
    this.logoutItem = this.sidebarItem('Logout');
  }

  async expectLoaded(): Promise<void> {
    await this.expectPath(/\/home/i);
    // A stable sidebar module confirms the authenticated shell rendered.
    await this.expectVisible(this.sidebarItem('KMail'));
  }

  /**
   * Locate a sidebar module by its clickable text. Sidebar labels are unique to
   * the rail (e.g. "KMail"), so the first text match is the nav entry.
   */
  private sidebarItem(module: KPostModule | 'Logout'): Locator {
    return this.page.getByText(new RegExp(`^\\s*${module}\\s*$`, 'i')).first();
  }

  /** Assert a module is present in the sidebar. */
  async expectModuleVisible(module: KPostModule): Promise<void> {
    await this.expectVisible(this.sidebarItem(module));
  }

  /** Navigate to a module via the sidebar. */
  async navigateTo(module: KPostModule): Promise<void> {
    await this.click(this.sidebarItem(module));
  }

  /** Type into the global search and submit. */
  async globalSearchFor(term: string): Promise<void> {
    await this.fill(this.globalSearch, term);
    await this.globalSearch.press('Enter');
  }

  /** Open the global search via the Ctrl+K shortcut. */
  async openGlobalSearchShortcut(): Promise<void> {
    await this.page.keyboard.press('Control+k');
    await this.expectVisible(this.globalSearch);
  }

  async openRecentsTab(): Promise<void> {
    await this.click(this.recentsTab);
  }

  async openContactsTab(): Promise<void> {
    await this.click(this.contactsTab);
  }

  /** Assert the signed-in user's name is reflected in the shell (top bar). */
  async expectSignedInAs(name: string | RegExp): Promise<void> {
    await this.expectVisible(this.page.getByText(name).first());
  }

  /** Log out via the sidebar and land back on the login screen. */
  async logout(): Promise<void> {
    await this.click(this.logoutItem);
    await expect(this.page).toHaveURL(/\/login/i);
  }
}
