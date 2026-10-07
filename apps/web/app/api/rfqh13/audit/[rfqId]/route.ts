import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ rfqId: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { rfqId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("rfqh13_export_audit", {
    p_rfq_id: rfqId,
  });

  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json({ error: "rfqh13_audit_export_failed" }, { status });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data ?? {}, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="smart-steel-sales-rfq-audit-' + date + '.json"',
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
