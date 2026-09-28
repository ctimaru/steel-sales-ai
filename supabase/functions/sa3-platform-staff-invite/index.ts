import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_REDIRECT =
  "https://steel-sales-ai.vercel.app/auth/finish?invited=1&staff=1";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "authentication_required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "server_configuration_missing" });
  }

  const token = authHeader.slice("Bearer ".length);
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await service.auth.getUser(token);

  if (userError || !user) {
    return json(401, { error: "invalid_session" });
  }

  const { data: ownerRole, error: ownerError } = await service
    .from("platform_user_roles")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("role", "platform_superadmin")
    .eq("status", "active")
    .maybeSingle();

  if (ownerError || !ownerRole) {
    return json(403, { error: "platform_owner_required" });
  }

  let payload: { email?: string };
  try {
    payload = (await req.json()) as { email?: string };
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json(400, { error: "valid_email_required" });
  }

  const { data: pendingInvitation, error: invitationError } = await service
    .from("platform_staff_invitations")
    .select("id,email,status,expires_at")
    .eq("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (invitationError) {
    return json(500, {
      error: "invitation_lookup_failed",
      detail: invitationError.message,
    });
  }

  if (!pendingInvitation) {
    return json(409, { error: "pending_platform_invitation_required" });
  }

  const redirectTo =
    Deno.env.get("SA3_PLATFORM_INVITE_REDIRECT_URL") ?? DEFAULT_REDIRECT;

  const { error: inviteError } = await service.auth.admin.inviteUserByEmail(
    email,
    { redirectTo },
  );

  if (!inviteError) {
    return json(200, {
      delivery: "sent",
      invitation_id: pendingInvitation.id,
    });
  }

  const detail = inviteError.message.toLowerCase();
  if (
    detail.includes("already") ||
    detail.includes("registered") ||
    detail.includes("exists")
  ) {
    return json(200, {
      delivery: "existing_user",
      invitation_id: pendingInvitation.id,
      detail: inviteError.message,
    });
  }

  return json(502, {
    error: "auth_invite_delivery_failed",
    detail: inviteError.message,
  });
});
