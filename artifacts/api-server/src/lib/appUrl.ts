export function getAppBaseUrl(): string {
  // Always link to the canonical public domain. Never fall back to the
  // temporary Replit dev domain: the dev server shares the live database
  // and SMTP settings, so any email it sends goes to REAL parents — those
  // links must always point at the main site.
  return process.env["APP_URL"] ?? "https://join.kjihc.org";
}
