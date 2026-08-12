/**
 * LoginPage — the KPost authentication screen.
 *
 * KPost uses a TWO-STEP login (verified against the live app via codegen):
 *   1. Enter the KPOST ID / mobile number → click "Submit".
 *   2. Enter the password → click "Login".
 *
 * Locators below are the real, verified accessible names from the running app.
 */
import { type Locator, type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Credentials } from '../config/env';

export class LoginPage extends BasePage {
  protected readonly path = '/login';

  // ---- Verified locators (from codegen against the live app) ----
  private readonly idInput: Locator;
  private readonly submitIdButton: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly errorAlert: Locator;

  constructor(page: Page) {
    super(page);
    this.idInput = page.getByRole('textbox', { name: 'Enter KPOST ID / Mobile number' });
    this.submitIdButton = page.getByRole('button', { name: 'Submit' });
    this.passwordInput = page.getByRole('textbox', { name: 'Enter your password' });
    this.loginButton = page.getByRole('button', { name: 'Login' });
    // Error surface (message text still to be confirmed against the real app).
    this.errorAlert = page.getByRole('alert');
  }

  /** True once the first (ID) step has rendered. */
  async isLoaded(): Promise<boolean> {
    return this.isVisible(this.idInput);
  }

  async expectLoaded(): Promise<void> {
    await this.expectVisible(this.idInput);
    await this.expectVisible(this.submitIdButton);
  }

  // ---- Step 1: KPOST ID ----
  async enterId(id: string): Promise<void> {
    await this.fill(this.idInput, id);
  }

  async submitId(): Promise<void> {
    await this.click(this.submitIdButton);
  }

  /** Assert the flow advanced to the password step. */
  async expectPasswordStep(): Promise<void> {
    await this.expectVisible(this.passwordInput);
  }

  // ---- Step 2: password ----
  async enterPassword(password: string): Promise<void> {
    await this.fill(this.passwordInput, password);
  }

  async submitPassword(): Promise<void> {
    await this.click(this.loginButton);
  }

  /** Complete the full two-step login. */
  async login(credentials: Credentials): Promise<void> {
    await this.enterId(credentials.email);
    await this.submitId();
    await this.waitForVisible(this.passwordInput);
    await this.enterPassword(credentials.password);
    await this.submitPassword();
  }

  /** Log in and expect to land on the authenticated home shell. */
  async loginExpectingSuccess(credentials: Credentials): Promise<void> {
    await this.login(credentials);
    await expect(this.page).toHaveURL(/\/home/i);
  }

  /**
   * Attempt a login that is expected to fail. Tolerant of BOTH failure points:
   * a bad ID may be rejected at step 1 (the password step never appears), and a
   * bad password is rejected at step 2. Never asserts success.
   */
  async attemptLogin(id: string, password: string): Promise<void> {
    await this.enterId(id);
    await this.submitId();
    // Only proceed to step 2 if the ID was accepted and the password field showed.
    if (await this.isVisible(this.passwordInput, 5_000)) {
      await this.enterPassword(password);
      await this.submitPassword();
    }
  }

  /** Assert the inline error surface shows the expected message. */
  async expectError(message: string | RegExp): Promise<void> {
    await this.expectVisible(this.errorAlert);
    await this.expectText(this.errorAlert, message);
  }
}
