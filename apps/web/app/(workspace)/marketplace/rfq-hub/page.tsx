import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default async function BuyerRfqHubPage() {
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("buyer_rfq_campaigns")
    .select("id,title,status,due_at,created_at,source_distinta_id")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = campaigns ?? [];

  return (
    <div className="space-y-6">
      <PilotEvent eventName="rfq_hub_viewed" metadata={{ surface: "rfq_hub" }} />
      <header className="rounded-3xl border border-[#244d43] bg-[#123d34] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
          RFQ Hub
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Le tue richieste ai fornitori.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#d8e5e0]">
          Il tuo spazio privato per le RFQ: dalla distinta ai fornitori selezionati, alle offerte,
          alla negoziazione e agli ordini. Il Marketplace viene coinvolto solo se scegli di pubblicare.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={appRoutes.rfqHub.inbox}
            className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-bold text-[#173f35] hover:bg-[#f3f7f5]"
          >
            Apri Inbox acquisti
          </Link>
          <Link
            href={appRoutes.rfqHub.createDistinta}
            className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/[0.08] px-5 text-sm font-bold text-white hover:bg-white/[0.14]"
          >
            Crea nuova distinta
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <section className="rounded-2xl border border-[#dce2df] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#1d2824]">Nessun RFQ ancora creato</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
            Crea una distinta, salvala e scegli “Avvia RFQ multi-fornitore”.
          </p>
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={appRoutes.rfqHub.campaign(row.id)}
              className="rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#9ebfb3] hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                    {row.status}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">{row.title}</h2>
                </div>
                <span className="text-xs text-[#718078]">{formatDate(row.created_at)}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-[#173f35]">Apri RFQ →</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
