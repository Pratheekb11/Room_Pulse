// Browser only: turns any picture the presenter picks into a small JPEG before upload,
// so phones on mobile data load it fast and the server only ever stores JPEGs.
import { fitWithin, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE } from "./images";

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
    } catch {
      /* fall through to an <img> (some formats only decode there) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("That file isn't a picture we can read. Try a JPG or PNG.");
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

/** The picture as a JPEG of at most MAX_IMAGE_SIDE pixels a side and MAX_IMAGE_BYTES bytes (see-through parts turn white). */
export async function shrinkToJpeg(file: Blob): Promise<Blob> {
  const picture = await decode(file);
  try {
    if (!picture.width || !picture.height) throw new Error("That picture is empty.");
    let side = MAX_IMAGE_SIDE;
    for (let attempt = 0; attempt < 5; attempt++) {
      const size = fitWithin(picture.width, picture.height, side);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(picture.source, 0, 0, size.width, size.height);
      for (const quality of [0.82, 0.7, 0.55]) {
        const blob = await toBlob(canvas, quality);
        if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
      }
      side = Math.round(side * 0.7); // still too heavy: make it smaller and try again
    }
    throw new Error("We couldn't make that picture small enough. Try another one.");
  } finally {
    picture.done();
  }
}

/** A blob's bytes as base64 (what POST /api/admin/images takes). */
export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("We couldn't read that picture."));
    reader.readAsDataURL(blob);
  });
}

/** A caption from a file name: "team-photo_2.JPG" becomes "team photo 2". */
export function captionFromFile(name: string, maxLength: number): string {
  return name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
