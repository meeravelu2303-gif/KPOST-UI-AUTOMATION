/**
 * LoginPage — the KPost authentication screen.
 *
 * KPost uses a TWO-STEP login (verified against the live app):
 *   1. Enter the KPOST ID / mobile number → click "Submit".
 *   2. Enter the password → click "Login".
 *
 * ── Verification status (probed against the live app on 2026-08-12) ──
 * VERIFIED · `heading "Sign in to your account"` (level 1).
 * VERIFIED · `textbox "Enter KPOST ID / Mobile number"`, `button "Submit"`
 *            (disabled until an ID is entered), `textbox "Enter your password"`,
 *            `button "Login"`.
 * VERIFIED · A forced logout surfaces `alert` → "Your session has expired.
 *            Please login again."
 * VERIFIED · A successful login lands on `/home` and stores its session in
 *            **localStorage** (`accessToken`, `refreshToken`, `isAuthenticated`,
 *            `Authuser`, `deviceIdentity_primary`, `persist:persist:localhost`).
 *            No auth cookies are set. The session does survive a page reload.
 */
import { type Locator, type Page, expect, test } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Credentials } from '../config/env';

export class LoginPage extends BasePage {
  protected readonly path = '/login';

  private readonly heading: Locator;
  private readonly idInput: Locator;
  private readonly submitIdButton: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly errorAlert: Locator;
  private readonly sessionExpiredAlert: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: /sign in to your account/i });
    this.idInput = page.getByRole('textbox', { name: 'Enter KPOST ID / Mobile number' });
    this.submitIdButton = page.getByRole('button', { name: 'Submit' });
    this.passwordInput = page.getByRole('textbox', { name: 'Enter your password' });
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.errorAlert = page.getByRole('alert');
    this.sessionExpiredAlert = page.getByRole('alert').filter({ hasText: /session has expired/i });
  }

  /** True once the first (ID) step has rendered. */
  async isLoaded(): Promise<boolean> {
    return this.isVisible(this.idInput);
  }

  async expectLoaded(): Promise<void> {
    await test.step('Expect the login screen', async () => {
      await this.expectVisible(this.heading);
      await this.expectVisible(this.idInput);
    });
  }

  // ---- Step 1: KPOST ID ----

  async enterId(id: string): Promise<void> {
    await test.step('Enter the KPOST ID', async () => {
      await this.fill(this.idInput, id);
    });
  }

  async submitId(): Promise<void> {
    await test.step('Submit the KPOST ID', async () => {
      // KPost renders a domain-suggestion overlay (`ul.login__domain-list`,
      // e.g. "@kpostindia.com") directly on top of the Submit button as soon as
      // an "@" is typed. Measured behaviour: it swallows pointer events aimed at
      // Submit, is not itself clickable, and is dismissed by neither Escape nor
      // blur — so a normal click times out, and `{ force: true }` does NOT help
      // (force skips Playwright's actionability check, but the browser still
      // delivers the event to the topmost element, i.e. the overlay).
      //
      // Activating via the keyboard is both the genuine accessible user path and
      // immune to hit-testing, so it is deterministic here. The enabled check is
      // kept because the button ships disabled until an ID is entered.
      //
      // Product-side: an undismissable overlay covering the primary CTA is worth
      // raising as a UX/accessibility defect.
      await expect(this.submitIdButton).toBeEnabled();
      await this.submitIdButton.focus();
      await this.page.keyboard.press('Enter');
    });
  }

  /** Assert the flow advanced to the password step. */
  async expectPasswordStep(): Promise<void> {
    await test.step('Expect the password step', async () => {
      await this.expectVisible(this.passwordInput);
    });
  }

  // ---- Step 2: password ----

  async enterPassword(password: string): Promise<void> {
    await test.step('Enter the password', async () => {
      await this.fill(this.passwordInput, password);
    });
  }

  async submitPassword(): Promise<void> {
    await test.step('Submit the password', async () => {
      await this.click(this.loginButton);
    });
  }

  /** Complete the full two-step login. */
  async login(credentials: Credentials): Promise<void> {
    await test.step(`Log in as ${credentials.email}`, async () => {
      await this.enterId(credentials.email);
      await this.submitId();
      await this.waitForVisible(this.passwordInput);
      await this.enterPassword(credentials.password);
      await this.submitPassword();
    });
  }

  /** Log in and expect to land on the authenticated home shell. */
  async loginExpectingSuccess(credentials: Credentials): Promise<void> {
    await test.step('Log in successfully', async () => {
      await this.login(credentials);
      await expect(this.page).toHaveURL(/\/home/i);
    });
  }

  /**
   * Attempt a login that is expected to fail. Tolerant of BOTH failure points:
   * a bad ID may be rejected at step 1 (the password step never appears), and a
   * bad password is rejected at step 2. Never asserts success.
   */
  async attemptLogin(id: string, password: string): Promise<void> {
    await test.step(`Attempt a login expected to fail (${id})`, async () => {
      await this.enterId(id);
      await this.submitId();
      if (await this.isVisible(this.passwordInput, 5_000)) {
        await this.enterPassword(password);
        await this.submitPassword();
      }
    });
  }

  /** Assert the inline error surface shows the expected message. */
  async expectError(message: string | RegExp): Promise<void> {
    await test.step('Expect a login error', async () => {
      await this.expectVisible(this.errorAlert);
      await this.expectText(this.errorAlert, message);
    });
  }

  /** Assert the app reported a forced logout / expired session. */
  async expectSessionExpired(): Promise<void> {
    await test.step('Expect the session-expired notice', async () => {
      await this.expectVisible(this.sessionExpiredAlert);
    });
  }
}
