/**
 * The presenter's results link carries a secret key after "#" (…/dashboard#k=…). Browsers never
 * send that part to any server, so it stays out of logs and Referer headers. We remember it for
 * this browser tab so the results screen still works after the address bar changes.
 */
const storageKey = (code: string) => `liverate:dk:${code}`;

export function readDashboardKey(code: string): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("k");
  try {
    if (fromHash) {
      window.sessionStorage.setItem(storageKey(code), fromHash);
      return fromHash;
    }
    return window.sessionStorage.getItem(storageKey(code));
  } catch {
    return fromHash;
  }
}
