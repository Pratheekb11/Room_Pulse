import { requireUser } from "@/lib/auth";
import { badRequest, json, logDbError, readJson, unavailable } from "@/lib/http";
import { jpegSize, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, MAX_IMAGES_PER_ACCOUNT } from "@/lib/images";
import { saveImage } from "@/lib/queries";

export const dynamic = "force-dynamic";

// base64 is 4 characters for every 3 bytes
const MAX_BASE64 = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;

/**
 * A presenter (guests too) uploads one picture for a question or an option: `{ data: <base64 JPEG> }`.
 * The browser has already shrunk it; anything that isn't a small, well-formed JPEG is refused.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    const body = (await readJson(req)) as { data?: unknown } | undefined;
    const data = body?.data;
    if (typeof data !== "string" || !data) return badRequest();
    if (data.length > MAX_BASE64) return json({ error: "image_too_big" }, 413);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return badRequest("not_an_image");
    const bytes = Buffer.from(data, "base64");
    if (bytes.length > MAX_IMAGE_BYTES) return json({ error: "image_too_big" }, 413);
    const size = jpegSize(bytes);
    if (!size || size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) return badRequest("not_an_image");
    const id = await saveImage(user.id, bytes.toString("base64"), size.width, size.height, MAX_IMAGES_PER_ACCOUNT);
    return id ? json({ id }, 201) : json({ error: "image_limit" }, 429);
  } catch (err) {
    logDbError("admin:image", err);
    return unavailable();
  }
}
