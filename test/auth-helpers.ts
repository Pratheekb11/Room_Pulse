import * as signupRoute from "@/app/api/auth/signup/route";
import * as loginRoute from "@/app/api/auth/login/route";

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

export async function signUp(email: string, password = GOOD_PASSWORD) {
  const res = await post(signupRoute.POST, "/api/auth/signup", { email, password });
  return { res, cookie: cookieFrom(res) };
}

export async function logIn(email: string, password = GOOD_PASSWORD, headers: Record<string, string> = {}) {
  const res = await post(loginRoute.POST, "/api/auth/login", { email, password }, headers);
  return { res, cookie: cookieFrom(res) };
}
