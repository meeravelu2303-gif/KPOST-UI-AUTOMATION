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
  /** Severity as reported to the QA dashboard. */
  readonly severity: 'High' | 'Medium' | 'Low';
  /** The KPost module the defect lives in, as shown on the QA dashboard. */
  readonly module: string;
  /**
   * OPTIONAL assignee override. Omit and the defect goes to `env.defectOwner`
   * (the UI team lead) — correct for almost everything this bench finds, since
   * it only tests the UI. Set it when a defect genuinely belongs to another
   * team, so the dashboard routes it to someone who can actually fix it.
   */
  readonly owner?: string;
}

export const KNOWN_APP_DEFECTS = {
  /** KMail's unopened-mail thunk throws an uncaught error on load. */
  KMAIL_UNOPENED_MAIL_TYPE_ERROR: {
    id: 'KPOST-KMAIL-001',
    severity: 'Medium',
    module: 'KMail',
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
    severity: 'Medium',
    module: 'Katchup',
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
    severity: 'High',
    module: 'KMail',
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

  /** The KEcommerce merchant catalog intermittently renders empty. */
  KECOMMERCE_CATALOG_INTERMITTENTLY_EMPTY: {
    id: 'KPOST-KECOM-001',
    severity: 'Medium',
    module: 'KEcommerce',
    summary: 'The KEcommerce catalog intermittently renders as an empty pane.',
    evidence:
      'During a full serial suite run on 2026-08-12, /e-commerce rendered only the ' +
      'app-shell header with zero merchant tiles (the page snapshot shows an empty ' +
      'content area), failing both catalog tests; the same tests pass 5/5 when the ' +
      'spec runs in isolation, before and after. The module shows no error state ' +
      'when this happens — the catalog is simply missing. Root cause not yet ' +
      'captured (no failed catalog request has been observed; the tile source may ' +
      'be a data call that fails silently or an app-side race under longer sessions).',
    expected: 'The catalog renders its merchant tiles on every load, or shows an error state.',
  },

  /** KNews renders an empty feed with no error state when its sources fail. */
  KNEWS_EMPTY_FEED_ON_SOURCE_FAILURE: {
    id: 'KPOST-KNEWS-001',
    severity: 'Medium',
    module: 'KNews',
    summary: 'KNews renders an empty feed with no error state when its news bridges fail.',
    evidence:
      'KNews fetches content through public RSS bridges (corsproxy.io, rss2json.com) ' +
      'that intermittently answer 503/422/429 — rss2json rate-limiting (429) was ' +
      'captured directly. When that happens the main feed renders zero cards and no ' +
      'error or empty-state message (page snapshot: a main landmark with no links), ' +
      'minutes after the same feed rendered normally. A news feed with nothing in it ' +
      'and no explanation is indistinguishable from a broken app to the user.',
    expected:
      'When the news sources fail, the feed shows an error/retry state instead of ' +
      'silently rendering nothing.',
  },

  /** The rail advertises a KPay module that does not exist. */
  KPAY_DEAD_NAV_ENTRY: {
    id: 'KPOST-KPAY-001',
    severity: 'Low',
    module: 'KPay',
    summary: 'The icon rail shows a KPay entry that silently does nothing.',
    evidence:
      'The rail renders div.icon-KP_12-KWallet and its expanded labels include ' +
      '"KPay", but clicking either leaves the URL unchanged, Quick Access does not ' +
      'offer the module, and /kpay, /kwallet, and /pay all render the 404 page ' +
      '(verified 2026-08-13). A visible nav entry that silently does nothing is ' +
      'broken UX from the user’s side, whatever the roadmap says — it should be ' +
      'hidden, disabled with an affordance, or wired up.',
    expected: 'Rail entries either navigate somewhere or are visibly disabled/absent.',
  },

  /** Logging out does not guard protected routes. */
  LOGOUT_NO_ROUTE_GUARD: {
    id: 'KPOST-AUTH-001',
    severity: 'High',
    module: 'Auth',
    summary: 'After logout, protected routes are not redirected back to /login.',
    evidence:
      'Logout correctly clears accessToken, refreshToken, Authuser and ' +
      'deviceIdentity_primary and lands on /login. But navigating back to /home ' +
      'afterwards stays on /home and renders a dead, shell-less page (the Quick Access ' +
      'button never appears) instead of redirecting to the login screen.',
    expected: 'Visiting a protected route while signed out redirects to /login.',
  },

  /*
   * Accessibility defects, all observed by the axe-core scans in `tests/a11y/`
   * on 2026-08-16 (chromium, WCAG 2.1 A/AA). These are not style opinions:
   * `best-practice` rules are excluded from the scan, so every entry here is a
   * conformance failure. Several are also the direct cause of this bench's
   * ugliest workarounds — see KPOST-A11Y-001.
   */

  /** Form controls render with no accessible name. */
  A11Y_UNLABELLED_FORM_CONTROLS: {
    id: 'KPOST-A11Y-001',
    severity: 'High',
    module: 'Accessibility',
    summary: 'Form controls render with no accessible name (label, select-name).',
    evidence:
      'axe-core, 2026-08-16: two CRITICAL violations. On /login the combobox input ' +
      '#react-select-2-input trips "label — Form elements must have labels"; the ' +
      'language <select> trips "select-name — Select element must have an accessible ' +
      'name" on both /login and /home. A screen-reader user cannot tell what either ' +
      'control is for. This is the same root cause that forces the suite to reach for ' +
      'CSS selectors in WriteMailPage and AppShellPage, so fixing it removes real ' +
      'brittleness from the tests as well as unblocking assistive tech.',
    expected:
      'Every form control exposes an accessible name via <label>, aria-label or ' +
      'aria-labelledby.',
  },

  /** Pinch-zoom is disabled for everyone. */
  A11Y_ZOOM_DISABLED: {
    id: 'KPOST-A11Y-002',
    severity: 'Medium',
    module: 'Accessibility',
    summary: 'Zooming and scaling are disabled via the viewport meta tag.',
    evidence:
      'axe-core, 2026-08-16: "meta-viewport — Zooming and scaling must not be ' +
      'disabled" on meta[name="viewport"], present on /login and /home and therefore ' +
      'on every page of the SPA. Users who need to magnify text cannot, which is a ' +
      'WCAG 1.4.4 failure and affects far more people than it appears to — it is a ' +
      'one-line fix in index.html.',
    expected: 'The viewport meta tag permits user scaling (no user-scalable=no, no maximum-scale=1).',
  },

  /** Text fails minimum contrast in several places. */
  A11Y_INSUFFICIENT_CONTRAST: {
    id: 'KPOST-A11Y-003',
    severity: 'Medium',
    module: 'Accessibility',
    summary: 'Several UI elements fall below the minimum colour-contrast ratio.',
    evidence:
      'axe-core, 2026-08-16: "color-contrast — Elements must meet minimum color ' +
      'contrast ratio thresholds" (SERIOUS). Four elements on /home — .Katchup_Name, ' +
      '#slider-tab-example-tab-Recent, .Calender_icon and .ecomm_font — plus the ' +
      'secondary text inside the Quick Access launcher. Low-contrast text is unreadable ' +
      'in bright light and for low-vision users.',
    expected: 'Text meets the WCAG AA contrast ratio (4.5:1 normal, 3:1 large).',
  },

  /** A scrollable pane cannot be reached from the keyboard. */
  A11Y_SCROLL_REGION_NOT_FOCUSABLE: {
    id: 'KPOST-A11Y-004',
    severity: 'Medium',
    module: 'Accessibility',
    summary: 'The KEcommerce scroll area is unreachable by keyboard.',
    evidence:
      'axe-core, 2026-08-16: "scrollable-region-focusable — Scrollable region must ' +
      'have keyboard access" (SERIOUS) on .ecommerce-scroll-area on /home. The pane ' +
      'scrolls with a mouse or trackpad but has no tabindex, so a keyboard-only user ' +
      'cannot scroll it and simply cannot see the content past the fold.',
    expected: 'Scrollable regions are focusable (tabindex="0") or expose a keyboard-operable alternative.',
  },

  /** Quick Access nests interactive controls inside one another. */
  A11Y_NESTED_INTERACTIVE_CONTROLS: {
    id: 'KPOST-A11Y-005',
    severity: 'Medium',
    module: 'Accessibility',
    summary: 'Quick Access nests interactive controls inside its result buttons.',
    evidence:
      'axe-core, 2026-08-16: "nested-interactive — Interactive controls must not be ' +
      'nested" (SERIOUS) across 13 elements, every ' +
      'button[data-quick-search-item-index="n"] in the launcher. Nesting a focusable ' +
      'control inside another makes the inner one unreachable for screen readers and ' +
      'produces an unpredictable tab order. Quick Access is the ONLY accessible ' +
      'navigation path in KPost (the icon rail exposes no names at all), so a defect ' +
      'here has no fallback.',
    expected: 'Interactive controls are siblings, never nested inside one another.',
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
