import { NextResponse } from "next/server";

import { queryPublicCompany } from "@/lib/public-company-lookup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const state = await queryPublicCompany(
      formData.get("company_query"),
      formData.get("company_website"),
    );

    return NextResponse.json(state, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { status: "error", mode: null, items: [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
