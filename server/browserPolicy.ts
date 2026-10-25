// React's existing dynamic style attributes implement progress, motion and layout.
// Only styles retain an inline exception; scripts/evaluation and remote resources do not.
// The build includes these headers in its PWA fingerprint so policy-only changes
// reach cached shells through the existing explicit, data-safe update protocol.
export const browserSecurityHeaders = {
  "Content-Security-Policy": [
    "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "worker-src 'self'",
    "manifest-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), display-capture=(), payment=(), usb=()",
};
