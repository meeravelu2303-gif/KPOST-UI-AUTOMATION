/**
 * PostDetailPage — a single post's view, with edit and delete affordances.
 *
 * Demonstrates confirmation-dialog handling (a common React modal pattern) and
 * action+response coupling for a destructive DELETE.
 */
import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { expectToast } from '../utils/react-helpers';

export class PostDetailPage extends BasePage {
  // Detail routes are dynamic (/posts/:id); `open()` is not used here — callers
  // arrive by navigating from the feed. `path` is the collection root.
  protected readonly path = '/posts';

  private readonly title: Locator;
  private readonly body: Locator;
  private readonly editButton: Locator;
  private readonly deleteButton: Locator;
  private readonly confirmDialog: Locator;
  private readonly confirmDeleteButton: Locator;
  private readonly cancelDeleteButton: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByRole('heading', { level: 1 });
    this.body = page.getByTestId('post-body');
    this.editButton = page.getByRole('button', { name: /edit/i });
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    // Destructive actions surface an ARIA dialog for confirmation.
    this.confirmDialog = page.getByRole('dialog', { name: /delete post|are you sure/i });
    this.confirmDeleteButton = this.confirmDialog.getByRole('button', { name: /delete|confirm/i });
    this.cancelDeleteButton = this.confirmDialog.getByRole('button', { name: /cancel/i });
  }

  /** Navigate directly to a post's detail page by id. */
  async openById(id: string): Promise<void> {
    await this.page.goto(`/posts/${id}`, { waitUntil: 'domcontentloaded' });
  }

  async expectLoaded(title: string): Promise<void> {
    await this.expectText(this.title, title);
  }

  async expectBody(text: string | RegExp): Promise<void> {
    await this.expectText(this.body, text);
  }

  async startEditing(): Promise<void> {
    await this.click(this.editButton);
    await this.expectPath(/\/posts\/.+\/edit/i);
  }

  /** Open the delete confirmation dialog but do not confirm. */
  async openDeleteDialog(): Promise<void> {
    await this.click(this.deleteButton);
    await this.expectVisible(this.confirmDialog);
  }

  /** Cancel a pending delete — the post must remain. */
  async cancelDelete(): Promise<void> {
    await this.click(this.cancelDeleteButton);
    await this.expectHidden(this.confirmDialog);
  }

  /** Confirm deletion, wait for the DELETE call, and assert the success toast. */
  async confirmDelete(): Promise<void> {
    await this.clickAndWaitForResponse(
      this.confirmDeleteButton,
      /\/api\/posts\/.+/i,
      (res) => res.request().method() === 'DELETE' && res.ok(),
    );
    await expect(this.confirmDialog).toBeHidden();
    await expectToast(this.page, /post deleted/i);
  }
}
