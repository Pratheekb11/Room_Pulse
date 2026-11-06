/** Public base URL for share links. Call only in the browser. */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return env || window.location.origin;
}

export const voterUrl = (code: string) => `${siteUrl()}/s/${code}`;
export const dashboardUrl = (code: string) => `${siteUrl()}/s/${code}/dashboard`;

/** "https://x.vercel.app/s/abc123" → "x.vercel.app/s/abc123" */
export const shortUrl = (url: string) => url.replace(/^https?:\/\//, "");
