import Link from "next/link";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

import { reviewCompanyChannels } from "./actions";

export const dynamic = "force-dynamic";

type Pending = {
  contact_id: string; company_id: string; company_name: string; website_domain: string | null;
  contact_type: string; email: string | null; phone: string | null; source_url: string | null;
  source_obtained_at: string | null;
};
type Queue = { contract?: string; pending?: number; items?: Pending[] };

/** NET-CONTACT1 — Platform bulk review of public company channels.
 * Only generic company mailboxes on the company's own domain and switchboard
 * phones reach this queue (enforced in SQL). Approval goes through LR4 as
 * company_channel; rejection archives the row. Nothing is published without it.
 */
export default async function CompanyChannelsReviewPage({
  searchParams,
}: { searchParams: Promise<{ message?: string; error?: string }> }) {
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netcontact1_pending_company_channels", { p_limit: 200 });
  const queue = (data as Queue | null)?.contract === "netcontact1-review-v1" ? (data as Queue) : null;
  const items = queue?.items ?? [];
  const phone = (value: string) => value.replace(/^\+39/, "+39 ");

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Link href="/platform/company-discovery" className="text-sm font-semibold underline">← Discovery aziende</Link>
      <header className="space-y-2">
        <p className="platform-kicker">NET-CONTACT1 · Contatti pubblici aziendali</p>
        <h1 className="text-3xl font-semibold">Revisione canali aziendali</h1>
        <p className="text-sm leading-6 text-[#52615b]">
          Email generiche sul dominio dell&apos;azienda (info@, commerciale@, vendite@…) e centralino, letti dal sito
          ufficiale. Approvando, il contatto diventa <strong>canale aziendale</strong> pubblico per 12 mesi e l&apos;azienda
          può ricevere RFQ via email. Nomi di persona e cellulari non entrano mai in questa coda.
        </p>
      </header>
      {params.message ? <p role="status" className="rounded-xl border border-emerald-200 p-4 text-sm text-emerald-800">{params.message}</p> : null}
      {params.error || error ? <p role="alert" className="rounded-xl border border-rose-200 p-4 text-sm text-rose-800">{params.error ?? "Impossibile leggere la coda."}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#52615b]">Da revisionare</p><p className="mt-1 text-2xl font-bold">{queue?.pending ?? 0}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#52615b]">Raccolta</p>
          <a href="https://github.com/ctimaru/steel-sales-ai/actions/workflows/netcontact1-public-contacts.yml" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold underline">Lotti dal sito ufficiale (25 per volta) ↗</a>
        </div>
      </div>
      {items.length ? (
        <form action={reviewCompanyChannels} className="space-y-3 rounded-2xl border bg-white p-4">
          <p className="text-sm text-[#52615b]">Tutte le righe sono preselezionate: deseleziona quelle da non pubblicare, oppure scartale.</p>
          <ul className="divide-y rounded-lg border" data-testid="netcontact1-review-list">
            {items.map((item) => (
              <li key={item.contact_id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                <input type="checkbox" name="contact_id" value={item.contact_id} defaultChecked
                  aria-label={"Seleziona " + item.company_name} className="mt-1 h-5 w-5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.company_name} <span className="font-normal text-[#52615b]">· {item.website_domain}</span></p>
                  <p className="break-all">
                    {item.email ? <span className="mr-3">✉ {item.email}</span> : null}
                    {item.phone ? <span>☎ {phone(item.phone)}</span> : null}
                  </p>
                  {item.source_url ? (
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-[#52615b] underline">
                      Fonte: {item.source_url}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <label className="grid gap-1 text-sm">Nota per lo scarto (facoltativa)
            <input name="note" maxLength={1000} className="min-h-11 rounded-lg border px-3" placeholder="Es. numero di fax, email di una persona" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button name="decision" value="approve" className="min-h-11 rounded-lg bg-[#173f35] px-4 font-semibold text-white">
              Pubblica selezionati come canale aziendale
            </button>
            <button name="decision" value="reject" className="min-h-11 rounded-lg border px-4 text-sm font-semibold">
              Scarta selezionati
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border p-4 text-sm text-[#52615b]">Nessun canale in attesa. I nuovi lotti raccolti dai siti ufficiali compariranno qui.</p>
      )}
    </main>
  );
}
