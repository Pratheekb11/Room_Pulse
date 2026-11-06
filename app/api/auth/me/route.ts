import { currentUser, unauthorized } from "@/lib/auth";
import { json, logDbError, unavailable } from "@/lib/http";
import { requireEmailVerification } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await currentUser(req);
    return user
      ? json({
          user: { email: user.email, guest: user.isGuest, emailVerified: user.emailVerified },
          verificationRequired: requireEmailVerification(),
        })
      : unauthorized();
  } catch (err) {
    logDbError("auth:me", err);
    return unavailable();
  }
}
