// Pictures on questions and options. Safe to import from client components.
// The browser shrinks every picture to a JPEG before upload (components/admin/PicturePicker.tsx);
// the server only ever stores and serves JPEGs it has checked.

/** Largest stored picture. */
export const MAX_IMAGE_BYTES = 200_000;
/** Longest side, in pixels. */
export const MAX_IMAGE_SIDE = 1280;
/** Pictures one account may keep (10 questions of 10 options with a picture each is 110). */
export const MAX_IMAGES_PER_ACCOUNT = 300;

/** Where a stored picture is served from. */
export const imageUrl = (id: string) => `/api/img/${encodeURIComponent(id)}`;

/** The size a picture is drawn at so its longest side is at most `max` (never enlarged). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Width and height from a JPEG's header, or null when the bytes aren't a well-formed JPEG
 * (start marker, then segments that stay inside the file, with a size header before the picture data).
 */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  const n = bytes.length;
  if (n < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 4 <= n) {
    if (bytes[pos] !== 0xff) return null;
    const marker = bytes[pos + 1];
    if (marker === 0xff) {
      pos += 1; // fill byte
      continue;
    }
    // picture data or the end before any size header: not usable
    if (marker === 0xd9 || marker === 0xda) return null;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      pos += 2;
      continue;
    }
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (length < 2 || pos + 2 + length > n) return null;
    const isSizeHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSizeHeader) {
      if (length < 8) return null;
      const height = (bytes[pos + 5] << 8) | bytes[pos + 6];
      const width = (bytes[pos + 7] << 8) | bytes[pos + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    pos += 2 + length;
  }
  return null;
}
