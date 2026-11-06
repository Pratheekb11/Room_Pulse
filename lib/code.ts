export const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE_LENGTH = 6;

/** Random 6-character session code using an unbiased crypto source. */
export function generateCode(): string {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n); // reject bytes that would bias the result
  let out = "";
  while (out.length < CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % n];
    }
  }
  return out;
}

/** Normalise user input ("#AB3-K9Q " → "ab3k9q"). */
export function normalizeCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Secret for the presenter's results link: 24 random bytes, URL-safe base64 (32 chars). */
export function generateDashboardKey(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

const GUEST_CODE_LENGTH = 8;

/** Guest sign-in code, e.g. "K7QM-3XPA": 8 characters from 31 (about 40 bits), no 0/O/1/I/L. */
export function generateGuestCode(): string {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let out = "";
  while (out.length < GUEST_CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < limit && out.length < GUEST_CODE_LENGTH) out += CODE_ALPHABET[b % n];
    }
  }
  return out.toUpperCase().replace(/(.{4})(?=.)/g, "$1-");
}

/** "k7qm 3xpa" → "K7QM3XPA", or null if it can't be a guest code. */
export function normalizeGuestCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== GUEST_CODE_LENGTH) return null;
  const alphabet = CODE_ALPHABET.toUpperCase();
  return [...s].every((c) => alphabet.includes(c)) ? s : null;
}
