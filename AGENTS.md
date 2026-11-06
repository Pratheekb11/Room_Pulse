<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Not finished

### Email verification and password reset — built, not switched on (INCOMPLETE)

The code and tests exist (`app/api/auth/{verify,resend-verification,forgot,reset}`, `lib/email.ts`, `lib/email-links.ts`, `test/email-auth.test.ts`), but **production has no email provider configured**, so:

- No verification or password-reset emails are sent in production.
- Verification is **not enforced**: `lib/policy.ts` `requireEmailVerification()` only returns true once `RESEND_API_KEY` is set (or `REQUIRE_EMAIL_VERIFICATION=true`). Until then, new accounts can create presentations without verifying.
- "Forgot password?" in production answers normally but no email arrives.

To finish:

1. Add Resend from the Vercel Marketplace (or resend.com), verify a sending domain.
2. Set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel (production + preview) and redeploy. Verification is enforced automatically from then on.
3. Decide what to do with accounts created while verification was off. They have `email_verified_at` null and will see the "verify your email" banner and be blocked from creating presentations. Either let them verify, or mark them verified with a one-off SQL update.
4. Test sign-up → verify, and forgot → reset, against production.

The owner decided accounts existing before email verification shipped should be marked verified. At deploy time (2026-11-06) production had no accounts, so nothing needed marking.
