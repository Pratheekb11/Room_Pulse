import * as signupRoute from "@/app/api/auth/signup/route";
import * as loginRoute from "@/app/api/auth/login/route";
import * as verifyRoute from "@/app/api/auth/verify/route";
import { sentEmails } from "@/lib/email";

export const ORIGIN = "http://localhost";
export const GOOD_PASSWORD = "correct horse battery";

function post(handler: (req: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = {}) {
  return handler(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  );
}

/** "name=value" part of a Set-Cookie header, ready to send back as a Cookie header. */
export function cookieFrom(res: Response): string | null {
  const set = res.headers.get("set-cookie");
  return set ? set.split(";")[0] : null;
}

/**
 * Signs up. By default also clicks the emailed verification link, so the account
 * can create presentations (pass `verify: false` to keep it unverified).
 */
export async function signUp(email: string, password = GOOD_PASSWORD, { verify = true } = {}) {
  process.env.EMAIL_TRANSPORT = "memory";
  const res = await post(signupRoute.POST, "/api/auth/signup", { email, password });
  if (verify && res.status === 201) {
    const mail = [...sentEmails].reverse().find((m) => m.to === email.trim().toLowerCase());
    const token = mail?.text.match(/\/verify\?token=([A-Za-z0-9_-]+)/)?.[1];
    if (!token) throw new Error("no verification email");
    const v = await post(verifyRoute.POST, "/api/auth/verify", { token });
    if (v.status !== 200) throw new Error(`verify failed: ${v.status}`);
  }
  return { res, cookie: cookieFrom(res) };
}

export async function logIn(email: string, password = GOOD_PASSWORD, headers: Record<string, string> = {}) {
  const res = await post(loginRoute.POST, "/api/auth/login", { email, password }, headers);
  return { res, cookie: cookieFrom(res) };
}
