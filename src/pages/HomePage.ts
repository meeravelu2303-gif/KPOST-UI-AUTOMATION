/**
 * HomePage — the authenticated KPost application shell (route: `/home`).
 *
 * KPost is a modular super-app: a persistent left sidebar of modules (Home,
 * KMail, KDirectory, KEcommerce, KNews, Settings, …), a top bar with a global
 * search + account menu, and a Home pane with Recents / Contacts tabs.
 *
 * Locators here were modeled from the live application UI. Field- and
 * testid-level details should be confirmed with `npm run codegen` against the
 * running app and adjusted in the declarations below if the real roles differ —
 * the methods and specs should not need to change.
 */
import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import type { KPostModule } from '../types';

export class HomePage extends BasePage {
  protected readonly path = '/home';

  private readonly sidebar: Locator;
  private readonly globalSearch: Locator;
  private readonly recentsTab: Locator;
  private readonly contactsTab: Locator;
  private readonly logoutItem: Locator;

  constructor(page: Page) {
    super(page);
    // The module rail is the primary navigation landmark.
    this.sidebar = page.getByRole('navigation');
    // Top-bar global search (has a "Global Search" placeholder + Ctrl+K hint).
    this.globalSearch = page.getByPlaceholder(/global search/i);
    // Home pane tabs.
    this.recentsTab = page.getByRole('tab', { name: /recents/i });
    this.contactsTab = page.getByRole('tab', { name: /contacts/i });
    // Logout lives in the sidebar rail.
    this.logoutItem = this.sidebarItem('Logout' as KPostModule);
  }

  async expectLoaded(): Promise<void> {
    await this.expectPath(/\/home/i);
    await this.expectVisible(this.sidebar);
  }

  /** Locate a sidebar module by its exact accessible name (link or button). */
  private sidebarItem(module: KPostModule | 'Logout'): Locator {
    const name = new RegExp(`^\\s*${module}\\s*$`, 'i');
    return this.sidebar
      .getByRole('link', { name })
      .or(this.sidebar.getByRole('button', { name }))
      .first();
  }

  /** Assert a module is present in the sidebar. */
  async expectModuleVisible(module: KPostModule): Promise<void> {
    await this.expectVisible(this.sidebarItem(module));
  }

  /** Navigate to a module via the sidebar and wait for the app to settle. */
  async navigateTo(module: KPostModule): Promise<void> {
    await this.click(this.sidebarItem(module));
  }

  /** Type into the global search and submit. */
  async globalSearchFor(term: string): Promise<void> {
    await this.fill(this.globalSearch, term);
    await this.globalSearch.press('Enter');
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
