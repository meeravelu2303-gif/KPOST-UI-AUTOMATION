/**
 * Shared domain types for the KPost automation framework.
 * Kept framework-agnostic so both UI page objects and (future) API helpers
 * can reuse the same models.
 */

export type UserRole = 'standard' | 'admin';

/**
 * KPost is a modular super-app. These are the left-sidebar modules as they
 * appear in the running application (verified from the live UI). Used to drive
 * type-safe sidebar navigation from the HomePage.
 */
export type KPostModule =
  | 'Home'
  | 'Write Mail'
  | 'KMail'
  | 'Katchup'
  | 'Kall'
  | 'KDirectory'
  | 'KCloud'
  | 'KBooking'
  | 'KEcommerce'
  | 'KPay'
  | 'KNews'
  | 'Broadcast'
  | 'Settings';

export interface User {
  email: string;
  password: string;
  displayName?: string;
  role: UserRole;
}

export type PostVisibility = 'public' | 'followers' | 'private';

export interface Post {
  title: string;
  body: string;
  tags: string[];
  visibility: PostVisibility;
}

/** Shape of an in-app toast notification the UI surfaces to users. */
export interface Toast {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
