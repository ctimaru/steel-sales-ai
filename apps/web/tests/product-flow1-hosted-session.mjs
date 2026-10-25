/** Existing-QA-only hosted acceptance; credentials and cookies stay in memory. */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const HOSTED_PROJECT_REF = "lwrrrphakpbjhbzljqhn";
export const HOSTED_SUPABASE_URL = "https://lwrrrphakpbjhbzljqhn.supabase.co";
export const HOSTED_QA = Object.freeze({
  A: Object.freeze({ userId: "c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5", email: "sr2b-admin-a@smartsteelsales.test" }),
  B: Object.freeze({ userId: "dbc50941-f6d7-4e51-85c9-cdbf6d16f36e", email: "sr2b-admin-b@smartsteelsales.test" }),
});
const CURRENT_ACCOUNT_LEGAL_VERSION = "2026-10-04-lr5-v1";
// Reviewed READY preview, QA branch SHA 584cdf9ac16d9e1b911a80110f6c478193741952.
// Deployment dpl_6LQEzvGc3x9dD9MdPBStAQCkjS9g; custom/production aliases are excluded.
const ALLOWED_PREVIEW_ORIGINS = new Set([
  "https://steel-sales-ik587c5yr-ctimaru-5113.vercel.app",
]);

class HostedSessionCheckError extends Error {}

function requireCondition(condition, label) {
  if (!condition) throw new HostedSessionCheckError(label);
}

export function hostedConfig() {
  requireCondition(process.env.CI === "true", "FLOW1_HOSTED_CI_REQUIRED");
  requireCondition(process.env.GITHUB_REF === "refs/heads/main", "FLOW1_HOSTED_MAIN_REQUIRED");
  requireCondition(process.env.GITHUB_EVENT_NAME === "workflow_dispatch", "FLOW1_HOSTED_DISPATCH_REQUIRED");
  requireCondition(process.env.REQUESTED_PROJECT_REF === HOSTED_PROJECT_REF, "FLOW1_HOSTED_PROJECT_DENIED");
  requireCondition(process.env.FLOW1_HOSTED_APPROVAL === "FLOW1_HOSTED_EXISTING_QA_ONLY", "FLOW1_HOSTED_SCOPE_DENIED");
  requireCondition(process.env.STAGING_READY2B_SUPABASE_URL === HOSTED_SUPABASE_URL, "FLOW1_HOSTED_SUPABASE_DENIED");
  const rawPreview = process.env.FLOW1_HOSTED_PREVIEW_URL ?? "";
  requireCondition(/^https:\/\/steel-sales-[a-z0-9-]+-ctimaru-5113\.vercel\.app\/?$/.test(rawPreview), "FLOW1_HOSTED_PREVIEW_DENIED");
  const previewUrl = new URL(rawPreview).origin;
  requireCondition(ALLOWED_PREVIEW_ORIGINS.has(previewUrl), "FLOW1_HOSTED_PREVIEW_NOT_REVIEWED");
  const publishableKey = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY ?? "";
  const bypassSecret = process.env.UI4_VERCEL_BYPASS ?? "";
  requireCondition(publishableKey.length > 20, "FLOW1_HOSTED_PUBLIC_KEY_REQUIRED");
  requireCondition(bypassSecret.length > 20, "FLOW1_HOSTED_PREVIEW_BYPASS_REQUIRED");
  return Object.freeze({ previewUrl, supabaseUrl: HOSTED_SUPABASE_URL, publishableKey, bypassSecret });
}

const authOptions = Object.freeze({
  persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
});

function stagingFetch(input, init) {
  const target = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  requireCondition(target.origin === HOSTED_SUPABASE_URL, "FLOW1_HOSTED_AUTH_DESTINATION_DENIED");
  return fetch(input, { ...init, redirect: "error", signal: init?.signal ?? AbortSignal.timeout(30000) });
}

function identityMatches(user, persona) {
  return user?.id === persona.userId && user?.email === persona.email;
}

/** Generates a link for a verified existing user, then uses normal GoTrue OTP verification. */
export async function openHostedSession(label, config = hostedConfig()) {
  const checked = hostedConfig();
  requireCondition(config.previewUrl === checked.previewUrl && config.supabaseUrl === checked.supabaseUrl &&
    config.publishableKey === checked.publishableKey && config.bypassSecret === checked.bypassSecret,
  "FLOW1_HOSTED_CONFIG_DENIED");
  requireCondition(label === "A" || label === "B", "FLOW1_HOSTED_IDENTITY_DENIED");
  const persona = HOSTED_QA[label];
  const adminKey = process.env.STAGING_READY2B_AUTH_SECRET_KEY ?? "";
  requireCondition(adminKey.length > 20, "FLOW1_HOSTED_ADMIN_KEY_REQUIRED");
  const admin = createClient(HOSTED_SUPABASE_URL, adminKey, {
    auth: authOptions, global: { fetch: stagingFetch },
  });
  const api = createClient(HOSTED_SUPABASE_URL, checked.publishableKey, {
    auth: authOptions, global: { fetch: stagingFetch },
  });
  const cookieJar = new Map();
  let hasSession = false;
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    try {
      if (hasSession) {
        const result = await api.auth.signOut({ scope: "local" });
        requireCondition(!result.error, "FLOW1_HOSTED_LOCAL_LOGOUT_FAILED");
      }
    } catch {
      throw new Error("FLOW1_HOSTED_LOCAL_LOGOUT_FAILED");
    } finally {
      cookieJar.clear();
    }
  }
  try {
    const existing = await admin.auth.admin.getUserById(persona.userId);
    requireCondition(!existing.error && identityMatches(existing.data.user, persona), "FLOW1_HOSTED_EXISTING_USER_MISMATCH");
    requireCondition(typeof existing.data.user.email_confirmed_at === "string" &&
      Number.isFinite(Date.parse(existing.data.user.email_confirmed_at)),
    "FLOW1_HOSTED_CONFIRMED_EXISTING_EMAIL_REQUIRED");
    const factors = existing.data.user.factors ?? [];
    requireCondition(Array.isArray(factors) && !factors.some(factor => factor.status === "verified"),
      "FLOW1_HOSTED_MFA_ACCOUNT_DENIED");
    // No signUp, invitation, password change, profile update or legal write.
    const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: persona.email });
    requireCondition(!generated.error && identityMatches(generated.data.user, persona), "FLOW1_HOSTED_LINK_IDENTITY_MISMATCH");
    const tokenHash = generated.data.properties?.hashed_token;
    requireCondition(typeof tokenHash === "string" && tokenHash.length > 20, "FLOW1_HOSTED_LINK_TOKEN_MISSING");
    const verified = await api.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    hasSession = Boolean(verified.data.session);
    requireCondition(!verified.error && hasSession && identityMatches(verified.data.user, persona), "FLOW1_HOSTED_OTP_FAILED");
    const session = verified.data.session;
    const [claimsResult, userResult, assurance] = await Promise.all([
      api.auth.getClaims(session.access_token), api.auth.getUser(session.access_token),
      api.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    const claims = claimsResult.data?.claims;
    const authenticatedAudience = claims?.aud === "authenticated" ||
      (Array.isArray(claims?.aud) && claims.aud.length === 1 && claims.aud[0] === "authenticated");
    requireCondition(!claimsResult.error && !userResult.error && identityMatches(userResult.data.user, persona) &&
      claims?.sub === persona.userId && claims?.iss === HOSTED_SUPABASE_URL + "/auth/v1" &&
      authenticatedAudience && claims?.role === "authenticated" && claims?.email === persona.email &&
      typeof claims?.session_id === "string" && claims.session_id.length > 0,
    "FLOW1_HOSTED_SIGNED_IDENTITY_FAILED");
    requireCondition(!assurance.error && assurance.data?.currentLevel === "aal1" &&
      assurance.data?.nextLevel === "aal1", "FLOW1_HOSTED_MFA_UPGRADE_REQUIRED");
    const legal = await api.rpc("lr5_current_legal_acceptance_state");
    requireCondition(!legal.error && legal.data?.authenticated === true && legal.data?.accepted === true &&
      legal.data?.privacy_acknowledged === true && legal.data?.terms_accepted === true &&
      legal.data?.privacy_notice_version === CURRENT_ACCOUNT_LEGAL_VERSION &&
      legal.data?.terms_version === CURRENT_ACCOUNT_LEGAL_VERSION &&
      ["registration", "first_login", "team_invite", "account"].includes(legal.data?.acceptance_source) &&
      typeof legal.data?.accepted_at === "string" && Number.isFinite(Date.parse(legal.data.accepted_at)),
    "FLOW1_HOSTED_EXISTING_CURRENT_LEGAL_REQUIRED");
    const cookieClient = createServerClient(HOSTED_SUPABASE_URL, checked.publishableKey, {
      global: { fetch: stagingFetch },
      cookieOptions: { path: "/", secure: true, sameSite: "lax" },
      cookies: {
        getAll: () => Array.from(cookieJar, ([name, cookie]) => ({ name, value: cookie.value })),
        setAll: cookies => {
          for (const cookie of cookies) {
            if (!cookie.value || cookie.options?.maxAge === 0) cookieJar.delete(cookie.name);
            else cookieJar.set(cookie.name, { value: cookie.value, options: cookie.options });
          }
        },
      },
    });
    // The installed SSR SDK serializes and chunks the genuine GoTrue session.
    const serialized = await cookieClient.auth.setSession({
      access_token: session.access_token, refresh_token: session.refresh_token,
    });
    requireCondition(!serialized.error && identityMatches(serialized.data.user, persona) && cookieJar.size > 0,
      "FLOW1_HOSTED_SDK_COOKIE_SERIALIZATION_FAILED");
    return Object.freeze({
      userId: persona.userId,
      api,
      async addCookies(context) {
        requireCondition(!closed, "FLOW1_HOSTED_SESSION_CLOSED");
        try {
          // Playwright derives the exact host and path '/' from this URL;
          // specifying both url and path is rejected by its cookie API.
          await context.addCookies(Array.from(cookieJar, ([name, cookie]) => ({
            name, value: cookie.value, url: checked.previewUrl + "/",
            secure: true, sameSite: "Lax", httpOnly: Boolean(cookie.options?.httpOnly),
          })));
        } catch {
          throw new Error("FLOW1_HOSTED_BROWSER_COOKIE_INSTALL_FAILED");
        }
      },
      close,
    });
  } catch (error) {
    await close().catch(() => {});
    // SDK/network errors may contain token-bearing URLs: never propagate them.
    if (error instanceof HostedSessionCheckError) throw error;
    throw new Error("FLOW1_HOSTED_SESSION_FAILED");
  }
}
