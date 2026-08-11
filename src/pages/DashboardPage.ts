/**
 * DashboardPage — the authenticated landing page and feed of KPost.
 *
 * Demonstrates handling a (potentially virtualized) post feed, a user menu,
 * and the entry point into post creation.
 */
import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { scrollVirtualizedListToItem } from '../utils/react-helpers';

export class DashboardPage extends BasePage {
  protected readonly path = '/dashboard';

  private readonly welcomeHeading: Locator;
  private readonly createPostButton: Locator;
  private readonly userMenuButton: Locator;
  private readonly logoutMenuItem: Locator;
  private readonly feed: Locator;
  private readonly feedItems: Locator;
  private readonly loadingSpinner: Locator;
  private readonly emptyFeedState: Locator;
  private readonly searchInput: Locator;
  private readonly nextPageButton: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeHeading = page.getByRole('heading', { name: /dashboard|welcome|home/i });
    this.createPostButton = page.getByRole('button', { name: /create post|new post/i });
    this.userMenuButton = page.getByRole('button', { name: /account menu|user menu|profile/i });
    this.logoutMenuItem = page.getByRole('menuitem', { name: /log ?out|sign ?out/i });
    // The feed is a scrollable region; individual posts are articles.
    this.feed = page.getByRole('feed').or(page.getByTestId('post-feed'));
    this.feedItems = this.feed.getByRole('article');
    this.loadingSpinner = page.getByRole('status').filter({ hasText: /loading/i });
    this.emptyFeedState = page.getByText(/no posts yet|nothing here/i);
    this.searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
    this.nextPageButton = page.getByRole('button', { name: /next( page)?/i });
  }

  /** Wait until the dashboard shell and feed have finished loading. */
  async expectLoaded(): Promise<void> {
    await this.expectVisible(this.welcomeHeading);
    // The feed either renders items or an explicit empty state — never a
    // perpetual spinner. Wait the spinner out to avoid asserting mid-load.
    if (await this.isVisible(this.loadingSpinner, 2_000)) {
      await this.waitForHidden(this.loadingSpinner);
    }
  }

  async goToCreatePost(): Promise<void> {
    await this.click(this.createPostButton);
    await this.expectPath(/\/posts\/(new|create)/i);
  }

  /** Number of currently-rendered posts (note: virtualized feeds mount lazily). */
  async visiblePostCount(): Promise<number> {
    return this.feedItems.count();
  }

  /** Locate a post in the feed by its title, scrolling a virtualized list if needed. */
  async findPostByTitle(title: string | RegExp): Promise<Locator> {
    return scrollVirtualizedListToItem(this.feed, title);
  }

  /** Assert a post with the given title is present in the feed. */
  async expectPostVisible(title: string): Promise<void> {
    const post = await this.findPostByTitle(title);
    await expect(post).toBeVisible();
  }

  async expectEmptyFeed(): Promise<void> {
    await this.expectVisible(this.emptyFeedState);
  }

  /**
   * Search the feed. Waits for the results request that the typed query
   * triggers so the assertion runs against the refreshed feed, not the old one.
   */
  async search(term: string): Promise<void> {
    await this.fill(this.searchInput, term);
    await Promise.all([
      this.page.waitForResponse(
        (res) => /\/api\/posts/i.test(res.url()) && /[?&](q|search)=/i.test(res.url()) && res.ok(),
      ),
      this.searchInput.press('Enter'),
    ]);
  }

  /** Advance to the next page of results and wait for the page-2 request. */
  async goToNextPage(): Promise<void> {
    await this.clickAndWaitForResponse(
      this.nextPageButton,
      /\/api\/posts/i,
      (res) => /[?&]page=/i.test(res.url()) && res.ok(),
    );
  }

  /** Open the account menu and log out. */
  async logout(): Promise<void> {
    await this.click(this.userMenuButton);
    await this.click(this.logoutMenuItem);
    await expect(this.page).toHaveURL(/\/login/i);
  }

  /** Assert the signed-in user's name/email is reflected in the header. */
  async expectSignedInAs(identifier: string | RegExp): Promise<void> {
    await this.click(this.userMenuButton);
    await expect(this.page.getByRole('menu')).toContainText(identifier);
    // Close the menu so it doesn't leak into later steps.
    await this.page.keyboard.press('Escape');
  }
}
