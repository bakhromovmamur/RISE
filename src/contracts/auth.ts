/** Public BFF metadata only. Provider tokens and opaque cookie values never cross this interface. */
export interface AccountSession {
  signedIn: boolean;
  csrfToken: string;
  delivery: "local-inbox" | "email";
  localInbox?: string;
  reason?: "expired" | "deleted";
  deletion?: import("./accountLifecycle").DeletionStatus;
  account?: { id: string; email: string; remembered: boolean; authenticatedAt: string; expiresAt: string };
}
export interface CodeChallenge { challenge: string; resendAt: string; expiresAt: string; retryAfter: number }
