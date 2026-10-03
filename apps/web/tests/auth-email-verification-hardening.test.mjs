import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const loginActions = fs.readFileSync(
  new URL("../app/login/actions.ts", import.meta.url),
  "utf8",
);
const verifyActions = fs.readFileSync(
  new URL("../app/verify-email/actions.ts", import.meta.url),
  "utf8",
);
const verifyPage = fs.readFileSync(
  new URL("../app/verify-email/page.tsx", import.meta.url),
  "utf8",
);
const registerActions = fs.readFileSync(
  new URL("../app/register/actions.ts", import.meta.url),
  "utf8",
);
const helper = fs.readFileSync(
  new URL("../lib/auth-email-verification.ts", import.meta.url),
  "utf8",
);
const supabaseConfig = fs.readFileSync(
  new URL("../../../supabase/config.toml", import.meta.url),
  "utf8",
);
const confirmationTemplate = fs.readFileSync(
  new URL("../../../supabase/templates/confirmation.html", import.meta.url),
  "utf8",
);
const recoveryTemplate = fs.readFileSync(
  new URL("../../../supabase/templates/recovery.html", import.meta.url),
  "utf8",
);
const confirmRoute = fs.readFileSync(
  new URL("../app/auth/confirm/route.ts", import.meta.url),
  "utf8",
);

test("email verification uses a dedicated pending-email gate", () => {
  assert.match(loginActions, /PENDING_SIGNUP_EMAIL_COOKIE/);
  assert.match(loginActions, /\/verify-email\?sent=1&next=/);
  assert.match(loginActions, /error\.code === "email_not_confirmed"/);
  assert.match(loginActions, /\/verify-email\?source=login/);
  assert.match(registerActions, /\/verify-email\?source=registration&next=/);
});

test("signup fails closed if Supabase unexpectedly returns an authenticated session", () => {
  assert.match(loginActions, /if \(data\.session\)/);
  assert.match(loginActions, /await supabase\.auth\.signOut\(\)/);
  assert.match(loginActions, /L’accesso è stato bloccato per sicurezza/);
});

test("verification page supports privacy-safe resend without putting email in the URL", () => {
  assert.match(verifyPage, /Controlla la tua email/);
  assert.match(verifyPage, /Reinvia email di verifica/);
  assert.match(verifyPage, /maskEmail\(pendingEmail\)/);
  assert.doesNotMatch(verifyPage, /searchParams[^\n]*email/);
  assert.match(helper, /httpOnly: true/);
  assert.match(helper, /sameSite: "lax"/);
  assert.match(helper, /maxAge: 60 \* 60/);
});

test("resend uses the Supabase signup confirmation API and preserves the auth callback", () => {
  assert.match(verifyActions, /supabase\.auth\.resend\(\{/);
  assert.match(verifyActions, /type: "signup"/);
  assert.match(verifyActions, /\/auth\/finish\?signup=1&next=/);
  assert.match(verifyActions, /safeInternalNext/);
  assert.match(verifyActions, /over_email_send_rate_limit/);
  assert.match(verifyActions, /email_address_not_authorized/);
});

test("local Supabase explicitly enforces email confirmations and loads the branded template", () => {
  assert.match(supabaseConfig, /\[auth\.email\]/);
  assert.match(supabaseConfig, /enable_confirmations = true/);
  assert.match(supabaseConfig, /\[auth\.email\.template\.confirmation\]/);
  assert.match(
    supabaseConfig,
    /subject = "Conferma il tuo indirizzo email — Smart Steel Sales"/,
  );
  assert.match(
    supabaseConfig,
    /content_path = "\.\/supabase\/templates\/confirmation\.html"/,
  );
});

test("confirmation email stays transactional and uses a device-independent token hash callback", () => {
  assert.match(confirmationTemplate, /Conferma il tuo indirizzo email/);
  assert.match(confirmationTemplate, /\{\{ \.SiteURL \}\}\/auth\/confirm/);
  assert.match(confirmationTemplate, /token_hash=\{\{ \.TokenHash \}\}/);
  assert.match(confirmationTemplate, /type=email/);
  assert.match(confirmationTemplate, /next=\/register/);
  assert.doesNotMatch(confirmationTemplate, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(confirmationTemplate, />\s*Conferma email\s*</);
  assert.match(
    confirmationTemplate,
    /Se non hai richiesto tu la creazione dell’account/,
  );
  assert.doesNotMatch(confirmationTemplate, /offerta|sconto|newsletter|promozione/i);
});


test("server-side confirmation endpoint verifies the token hash and rejects unsafe next URLs", () => {
  assert.match(confirmRoute, /verifyOtp\(\{/);
  assert.match(confirmRoute, /token_hash: tokenHash/);
  assert.match(confirmRoute, /type,/);
  assert.match(confirmRoute, /value\.startsWith\("\/"\)/);
  assert.match(confirmRoute, /value\.startsWith\("\/\/"\)/);
  assert.match(confirmRoute, /PENDING_SIGNUP_EMAIL_COOKIE/);
  assert.match(confirmRoute, /response\.cookies\.delete/);
  assert.match(confirmRoute, /Il link di verifica non è valido o è scaduto/);
});


test("password recovery email uses the same server-side token-hash confirmation endpoint", () => {
  assert.match(supabaseConfig, /\[auth\.email\.template\.recovery\]/);
  assert.match(
    supabaseConfig,
    /subject = "Reimposta la tua password — Smart Steel Sales"/,
  );
  assert.match(recoveryTemplate, /Smart Steel Sales/);
  assert.match(recoveryTemplate, /\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}/);
  assert.match(recoveryTemplate, /type=recovery/);
  assert.match(recoveryTemplate, /next=\/reset-password/);
  assert.doesNotMatch(recoveryTemplate, /newsletter|promozione|offerta|sconto/i);
});
