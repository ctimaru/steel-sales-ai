import Link from "next/link";
import { notFound } from "next/navigation";

import { RfqSupplierAddForm } from "@/components/rfq-supplier-add-form";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ rfqId: string }>;

function formatNumber(value: number | string | null, digits: number) {
  if (value === null) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default async function BuyerRfqCampaignPage({ params }: { params: Params }) {
  const { rfqId } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("buyer_rfq_campaigns")
    .select("id,title,status,source_distinta_id,due_at,buyer_message,created_at")
    .eq("id", rfqId)
    .maybeSingle();

  if (!campaign) notFound();

  const [{ data: distinta }, { data: lines }, { data: suppliers }] = await Promise.all([
    supabase
      .from("buyer_distintas")
      .select("id,line_count,total_meters,total_tonnes,target_total_eur")
      .eq("id", campaign.source_distinta_id)
      .maybeSingle(),
    supabase
      .from("buyer_distinta_lines")
      .select("id,line_position,description,standard_code,grade_code,finish_code,quantity_mode,quantity,weight_kg_m,line_meters,line_tonnes,target_eur_t,target_eur_m,note")
      .eq("distinta_id", campaign.source_distinta_id)
      .order("line_position", { ascending: true }),
    supabase
      .from("buyer_rfq_suppliers")
      .select("id,supplier_name,supplier_email_normalized,status,delivery_channel,created_at")
      .eq("rfq_id", campaign.id)
      .order("created_at", { ascending: true }),
  ]);

  const supplierRows = suppliers ?? [];
  const lineRows = lines ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={appRoutes.marketplace.rfqHub}
          className="text-sm font-semibold text-[#52615b] hover:text-[#173f35]"
        >
          ← RFQ Hub
        </Link>
        <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#173f35]">
          {campaign.status}
        </span>
      </div>

      <header className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
          RFQ multi-fornitore
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d2824]">
          {campaign.title}
        </h1>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#718078]">Righe</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{distinta?.line_count ?? lineRows.length}</p>
          </div>
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#718078]">Tonnellate</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{formatNumber(distinta?.total_tonnes ?? null, 3)}</p>
          </div>
          <div className="rounded-xl bg-[#edf5f2] p-3">
            <p className="text-xs text-[#527268]">Fornitori</p>
            <p className="mt-1 text-xl font-semibold text-[#173f35]">{supplierRows.length}</p>
          </div>
        </div>
      </header>

      <RfqSupplierAddForm rfqId={campaign.id} />

      <section className="rounded-2xl border border-[#dce2df] bg-white">
        <div className="border-b border-[#e7ece9] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Fornitori target
          </p>
        </div>
        {supplierRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#66736e]">
            Aggiungi almeno un fornitore per preparare l&apos;invio.
          </p>
        ) : (
          <div className="divide-y divide-[#edf0ee]">
            {supplierRows.map((supplier, index) => (
              <div key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-[#1d2824]">
                    {supplier.supplier_name || "Fornitore " + String(index + 1)}
                  </p>
                  <p className="mt-0.5 text-xs text-[#66736e]">{supplier.supplier_email_normalized}</p>
                </div>
                <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-bold uppercase text-[#52615b]">
                  {supplier.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Distinta
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">Snapshot inviabile</h2>
          </div>
          <span className="text-xs text-[#718078]">
            Target €/t e Target €/m restano congelati nello snapshot.
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[860px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#dce2df] text-[#66736e]">
                <th className="px-2 py-2">Articolo</th>
                <th className="px-2 py-2">Norma</th>
                <th className="px-2 py-2">Grado</th>
                <th className="px-2 py-2 text-right">Quantità</th>
                <th className="px-2 py-2 text-right">kg/m</th>
                <th className="px-2 py-2 text-right">Target €/t</th>
                <th className="px-2 py-2 text-right">Target €/m</th>
              </tr>
            </thead>
            <tbody>
              {lineRows.map((line) => (
                <tr key={line.id} className="border-b border-[#edf0ee]">
                  <td className="px-2 py-3 font-semibold text-[#1d2824]">{line.description}</td>
                  <td className="px-2 py-3 text-[#52615b]">{line.standard_code || "—"}</td>
                  <td className="px-2 py-3 text-[#52615b]">{line.grade_code || "—"}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-[#52615b]">
                    {formatNumber(line.quantity, line.quantity_mode === "tonnes" ? 3 : 2)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-[#52615b]">{formatNumber(line.weight_kg_m, 3)}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-[#173f35]">{formatNumber(line.target_eur_t, 2)}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-[#173f35]">{formatNumber(line.target_eur_m, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[#cddbd6] bg-[#f7faf8] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">RFQH1</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">Campagna pronta per il targeting.</h2>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">
          L&apos;invio governato, il link sicuro per il fornitore e la raccolta strutturata delle offerte entreranno nel blocco RFQH2–RFQH4.
        </p>
      </section>
    </div>
  );
}
