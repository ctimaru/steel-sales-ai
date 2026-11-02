import { NextResponse } from "next/server";

import { optOutRfqRecipient } from "@/lib/rfq-opt-out";

/** RFQ-MAIL1 — RFC 8058 one-click unsubscribe (List-Unsubscribe-Post).
 * POST only: a GET from a link scanner never unsubscribes. */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await optOutRfqRecipient(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}

export function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405, headers: { Allow: "POST" } });
}
