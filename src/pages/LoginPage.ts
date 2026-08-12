/**
 * LoginPage — the KPost authentication screen.
 *
 * Locators favor accessible, user-facing queries (getByRole / getByLabel) and
 * fall back to `data-testid` only for elements with no stable accessible name.
 * This keeps the suite resilient to copy tweaks and CSS refactors.
 */
import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Credentials } from '../config/env';

export class LoginPage extends BasePage {
  protected readonly path = '/login';

  // ---- Locators (declared once, reused everywhere) ----
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorAlert: Locator;
  private readonly forgotPasswordLink: Locator;
  private readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /sign in|log in/i });
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole('button', { name: /sign in|log in/i });
    // Error banner is an ARIA alert region; text is asserted by callers.
    this.errorAlert = page.getByRole('alert');
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
  }

  /** True once the login form has finished rendering. */
  async isLoaded(): Promise<boolean> {
    return this.isVisible(this.submitButton);
  }

  async expectLoaded(): Promise<void> {
    await this.expectVisible(this.heading);
    await this.expectVisible(this.emailInput);
    await this.expectVisible(this.passwordInput);
  }

  /** Fill the credentials without submitting — useful for validation tests. */
  async enterCredentials(email: string, password: string): Promise<void> {
    await this.fill(this.emailInput, email);
    await this.fill(this.passwordInput, password);
  }

  /**
   * Complete a login and wait for the auth request to resolve. Returns the
   * HTTP status so tests can assert on both UI and network outcomes.
   */
  async login(credentials: Credentials): Promise<number> {
    await this.enterCredentials(credentials.email, credentials.password);
    const response = await this.clickAndWaitForResponse(
      this.submitButton,
      /\/api\/(auth\/)?login/i,
      () => true, // capture both success and failure responses
    );
    return response.status();
  }

  /** Submit and expect to land on the authenticated home shell (happy path). */
  async loginExpectingSuccess(credentials: Credentials): Promise<void> {
    await this.enterCredentials(credentials.email, credentials.password);
    await this.click(this.submitButton);
    await expect(this.page).toHaveURL(/\/home/i);
  }

  /** Assert the inline error banner shows the expected message. */
  async expectError(message: string | RegExp): Promise<void> {
    await this.expectVisible(this.errorAlert);
    await this.expectText(this.errorAlert, message);
  }

  /** Assert the submit button is disabled (e.g. empty form / invalid state). */
  async expectSubmitDisabled(): Promise<void> {
    await this.expectDisabled(this.submitButton);
  }

  async goToForgotPassword(): Promise<void> {
    await this.click(this.forgotPasswordLink);
  }
}
