/**
 * ProfilePage — the authenticated user's profile view and edit form.
 *
 * Demonstrates a settings-style form with a persisted save (PATCH) and inline
 * validation feedback.
 */
import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { expectToast } from '../utils/react-helpers';

export class ProfilePage extends BasePage {
  protected readonly path = '/profile';

  private readonly heading: Locator;
  private readonly displayNameInput: Locator;
  private readonly bioInput: Locator;
  private readonly emailField: Locator;
  private readonly saveButton: Locator;
  private readonly displayNameError: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /profile|account/i });
    this.displayNameInput = page.getByLabel(/display name/i);
    this.bioInput = page.getByLabel(/bio/i);
    // Email is typically read-only on the profile screen.
    this.emailField = page.getByLabel(/email/i);
    this.saveButton = page.getByRole('button', { name: /save changes|save/i });
    this.displayNameError = page.getByText(/display name is required/i);
  }

  async expectLoaded(): Promise<void> {
    await this.expectVisible(this.heading);
    await this.expectVisible(this.displayNameInput);
  }

  async expectEmail(email: string): Promise<void> {
    await this.expectValue(this.emailField, email);
  }

  async updateDisplayName(name: string): Promise<void> {
    await this.fill(this.displayNameInput, name);
  }

  async updateBio(bio: string): Promise<void> {
    await this.fill(this.bioInput, bio);
  }

  /** Save and wait for the PATCH to resolve, then assert the success toast. */
  async save(): Promise<void> {
    await this.clickAndWaitForResponse(
      this.saveButton,
      /\/api\/(users\/)?(me|profile)/i,
      (res) => ['PATCH', 'PUT'].includes(res.request().method()) && res.ok(),
    );
    await expectToast(this.page, /profile updated|changes saved/i);
  }

  /** Clear the required field and try to save — expect inline validation. */
  async expectDisplayNameRequired(): Promise<void> {
    await this.fill(this.displayNameInput, '');
    await this.click(this.saveButton);
    await this.expectVisible(this.displayNameError);
  }
}
