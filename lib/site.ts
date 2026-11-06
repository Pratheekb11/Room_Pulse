/** Public base URL for share links. Call only in the browser. */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return env || window.location.origin;
}

export const voterUrl = (code: string) => `${siteUrl()}/s/${code}`;
/** Private results link: the key sits after "#", which browsers never send to any server. */
export const dashboardUrl = (code: string, key?: string) => `${siteUrl()}/s/${code}/dashboard${key ? `#k=${key}` : ""}`;

/** "https://x.vercel.app/s/abc123" → "x.vercel.app/s/abc123" */
export const shortUrl = (url: string) => url.replace(/^https?:\/\//, "");
