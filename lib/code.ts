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
