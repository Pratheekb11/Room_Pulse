import "server-only";
import { requireUser } from "./auth";
import { notFound } from "./http";
import { getOwnedSessionIsOpen } from "./queries";
import { codeSchema } from "./validation";

/**
 * For /api/admin/sessions/[code]/… routes: checks sign-in and that the session
 * belongs to the user. Someone else's session looks exactly like a missing one (404).
 */
export async function requireOwnedSession(
  req: Request,
  rawCode: string,
): Promise<Response | { code: string; isOpen: boolean; userId: string }> {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  const code = codeSchema.safeParse(rawCode);
  if (!code.success) return notFound();
  const isOpen = await getOwnedSessionIsOpen(code.data, user.id);
  if (isOpen === null) return notFound();
  return { code: code.data, isOpen, userId: user.id };
}
