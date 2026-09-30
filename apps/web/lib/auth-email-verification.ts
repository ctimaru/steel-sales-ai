export const PENDING_SIGNUP_EMAIL_COOKIE = "steel_pending_signup_email";

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "il tuo indirizzo email";

  const visible =
    localPart.length <= 2
      ? localPart.slice(0, 1)
      : localPart.slice(0, Math.min(2, localPart.length));

  return `${visible}${"•".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export const pendingSignupEmailCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60,
};
