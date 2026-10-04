import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("lr5_account_export");
  if (error) {
    return NextResponse.json({ error: "account_export_failed" }, { status: 500 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data ?? {}, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="smart-steel-sales-account-export-' + date + '.json"',
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
