/**
 * Registry of known **application** defects that currently fail tests.
 *
 * Why this exists: a red test is only useful if the reader can tell, in one
 * glance, whether the *suite* is broken or the *app* is. Each entry below is a
 * defect confirmed by direct observation against the live app, together with
 * the evidence. `noteKnownDefect()` attaches it to the test so it shows up in
 * the HTML report and in the failure message.
 *
 * Rules of engagement:
 *  - Never weaken an assertion to make one of these go green. The assertion
 *    describes correct behaviour; the app does not meet it yet.
 *  - When a defect is fixed, delete its entry and the `noteKnownDefect()` call.
 *    A stale entry is worse than none — it excuses a real regression.
 *  - This is documentation, not suppression: annotated tests still fail.
 */
import { test } from '@playwright/test';

export interface KnownDefect {
  /** Short stable handle, quotable in a bug tracker. */
  readonly id: string;
  /** One-line statement of what the app does wrong. */
  readonly summary: string;
  /** The observed evidence — errors, endpoints, reproduction. */
  readonly evidence: string;
  /** What the test asserts, i.e. the behaviour we expect once fixed. */
  readonly expected: string;
}

export const KNOWN_APP_DEFECTS = {
  /** KMail's unopened-mail thunk throws an uncaught error on load. */
  KMAIL_UNOPENED_MAIL_TYPE_ERROR: {
    id: 'KPOST-KMAIL-001',
    summary: 'KMail raises an uncaught TypeError on load (UnopenedMailAsync).',
    evidence:
      "Uncaught \"TypeError: Cannot read properties of undefined (reading 'status')\" at " +
      'UnopenedMailAsync, thrown as soon as /kmail loads. Verified 2026-08-12: the module ' +
      'underneath still functions — all three tabs work once the dev-only overlay is ' +
      'dismissed — so the suite dismisses the overlay (recording it as a ' +
      '"dismissed-app-error" annotation) and verifies the real behaviour. The error ' +
      'itself remains unfixed: in a production build it would surface as the ' +
      'unopened-mail feature failing silently.',
    expected: 'KMail loads without raising any uncaught error.',
  },

  /** Katchup's contacts backend 500s and the app does not handle it. */
  KATCHUP_CONTACTS_500_UNHANDLED: {
    id: 'KPOST-KATCHUP-001',
    summary: 'Katchup does not handle a failing contacts backend; it raises instead of degrading.',
    evidence:
      'GET localhost:8989/v2/contacts/getImportedPhoneContacts/ and POST ' +
      'localhost:8989/v2/contacts/myUnknownKatchupContacts/ intermittently return 500. ' +
      'The app then raises an unhandled "[object Object]" at handleError rather than ' +
      'degrading, and the conversation/search surface never renders. This is why these ' +
      'tests pass in isolation but fail when the backend happens to error.',
    expected:
      'A failing contacts call degrades gracefully — the pane still renders and search ' +
      'still reports its result state.',
  },

  /** The mail backend intermittently 401s requests from a valid session. */
  KMAIL_POSTMAIL_INTERMITTENT_401: {
    id: 'KPOST-KMAIL-002',
    summary: 'POST /v2/sentMail/postMail/ intermittently returns 401 for a valid session.',
    evidence:
      'The same self-send, from a freshly logged-in session with an unexpired token ' +
      '(24h JWT lifetime), is sometimes answered 400 "Duplicate IDs are present in ' +
      'ToAddress, CopyList, or ConfidentialCopyList" (the expected validation) and ' +
      'sometimes 401 — observed switching between the two across consecutive runs on ' +
      '2026-08-12. A backend that authenticates a session for one request and rejects ' +
      'it for the next is failing auth intermittently; the historical KMail 401 ' +
      'force-logout (now fixed) was the same category of fault.',
    expected: 'A valid session is authenticated consistently; postMail never 401s it.',
  },

  /** Logging out does not guard protected routes. */
  LOGOUT_NO_ROUTE_GUARD: {
    id: 'KPOST-AUTH-001',
    summary: 'After logout, protected routes are not redirected back to /login.',
    evidence:
      'Logout correctly clears accessToken, refreshToken, Authuser and ' +
      'deviceIdentity_primary and lands on /login. But navigating back to /home ' +
      'afterwards stays on /home and renders a dead, shell-less page (the Quick Access ' +
      'button never appears) instead of redirecting to the login screen.',
    expected: 'Visiting a protected route while signed out redirects to /login.',
  },
} as const satisfies Record<string, KnownDefect>;

/**
 * Attach a known defect to the running test.
 *
 * Adds a report annotation (visible in the HTML report next to the test) and
 * returns a formatted description suitable for use as an `expect()` message, so
 * the failure output explains itself without anyone opening this file.
 */
export function noteKnownDefect(defect: KnownDefect): string {
  const description = `${defect.id} — ${defect.summary}\nEvidence: ${defect.evidence}\nExpected: ${defect.expected}`;

  test.info().annotations.push({
    type: 'known-app-defect',
    description,
  });

  return (
    `KNOWN APPLICATION DEFECT ${defect.id}: ${defect.summary}\n` +
    `This is an app-side bug, not a broken test — the assertion below describes the ` +
    `behaviour the app should have.\n${defect.evidence}`
  );
}
