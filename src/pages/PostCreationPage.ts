/**
 * PostCreationPage — the compose/editor screen for authoring a KPost post.
 *
 * Exercises the trickier React UI patterns:
 *  - a custom (portalled) visibility dropdown,
 *  - a tag input that commits chips on Enter,
 *  - a submit that fires an API call and surfaces a success toast.
 */
import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { selectCustomOption, expectToast } from '../utils/react-helpers';
import type { Post } from '../types';

export class PostCreationPage extends BasePage {
  protected readonly path = '/posts/new';

  private readonly titleInput: Locator;
  private readonly bodyEditor: Locator;
  private readonly tagInput: Locator;
  private readonly visibilityTrigger: Locator;
  private readonly publishButton: Locator;
  private readonly saveDraftButton: Locator;
  private readonly titleError: Locator;
  private readonly charCounter: Locator;

  constructor(page: Page) {
    super(page);
    this.titleInput = page.getByLabel(/title/i);
    // Rich-text body is a contenteditable region with an accessible name.
    this.bodyEditor = page.getByRole('textbox', { name: /body|content|what.?s on your mind/i });
    this.tagInput = page.getByLabel(/tags?/i);
    this.visibilityTrigger = page.getByRole('button', { name: /visibility|audience/i });
    this.publishButton = page.getByRole('button', { name: /publish|post/i });
    this.saveDraftButton = page.getByRole('button', { name: /save draft/i });
    this.titleError = page.getByText(/title is required/i);
    this.charCounter = page.getByTestId('char-counter');
  }

  async expectLoaded(): Promise<void> {
    await this.expectVisible(this.titleInput);
    await this.expectVisible(this.publishButton);
  }

  async fillTitle(title: string): Promise<void> {
    await this.fill(this.titleInput, title);
  }

  /** Fill the rich-text body. contenteditable needs click + type, not fill. */
  async fillBody(body: string): Promise<void> {
    await this.bodyEditor.click();
    await this.bodyEditor.fill(body);
    await expect(this.bodyEditor).toContainText(body);
  }

  /** Add tag chips — each tag is committed with Enter. */
  async addTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.tagInput.click();
      await this.tagInput.fill(tag);
      await this.tagInput.press('Enter');
      // Verify the chip rendered before moving on (guards re-render races).
      await expect(this.page.getByRole('listitem').filter({ hasText: tag })).toBeVisible();
    }
  }

  /** Choose a visibility option from the custom portalled dropdown. */
  async setVisibility(visibility: Post['visibility']): Promise<void> {
    const label = { public: /public/i, followers: /followers/i, private: /private/i }[visibility];
    await selectCustomOption(this.page, this.visibilityTrigger, label);
  }

  /**
   * Fill the whole form from a Post model. Composable so tests can also drive
   * individual fields for edge-case coverage.
   */
  async composePost(post: Post): Promise<void> {
    await this.fillTitle(post.title);
    await this.fillBody(post.body);
    if (post.tags.length > 0) await this.addTags(post.tags);
    await this.setVisibility(post.visibility);
  }

  /**
   * Publish and wait for the create-post API call plus the success toast. This
   * is the race-free "action + network + UI feedback" pattern.
   */
  async publish(): Promise<void> {
    await this.clickAndWaitForResponse(
      this.publishButton,
      /\/api\/posts/i,
      (res) => res.request().method() === 'POST' && res.ok(),
    );
    await expectToast(this.page, /post published|published successfully/i);
  }

  async saveDraft(): Promise<void> {
    await this.click(this.saveDraftButton);
    await expectToast(this.page, /draft saved/i);
  }

  // ---- Validation / edge-case assertions ----

  async expectTitleRequiredError(): Promise<void> {
    await this.expectVisible(this.titleError);
  }

  async expectPublishDisabled(): Promise<void> {
    await this.expectDisabled(this.publishButton);
  }

  async expectCharCount(count: number): Promise<void> {
    await this.expectText(this.charCounter, String(count));
  }
}
