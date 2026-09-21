import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ observationId: string }> },
) {
  const { observationId } = await params;
  const parsedObservationId = Number(observationId);
  if (!Number.isInteger(parsedObservationId) || parsedObservationId <= 0) {
    return NextResponse.json({ error: "Evidence non valida." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const actorUserId = !error && data.user?.id ? data.user.id : null;
  if (!actorUserId) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return NextResponse.json({ error: "Worker non configurato." }, { status: 503 });
  }

  const headers: HeadersInit = { "content-type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }

  const response = await fetch(`${workerUrl}/v1/evidence/${parsedObservationId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ actor_user_id: actorUserId }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { signed_url?: string; detail?: string }
    | null;

  if (!response.ok || !payload?.signed_url) {
    return NextResponse.json(
      { error: payload?.detail ?? "File originale non disponibile." },
      { status: response.status === 404 ? 404 : 502 },
    );
  }

  return NextResponse.redirect(payload.signed_url);
}
