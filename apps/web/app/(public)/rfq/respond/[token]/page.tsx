import { createHash } from "node:crypto";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Richiesta di offerta · Smart Steel Sales",
  robots: { index: false, follow: false },
};

type Params = Promise<{ token: string }>;

type InviteLine = {
  position: number;
  description: string;
  standard: string | null;
  grade: string | null;
  finish: string | null;
  quantity_mode: string;
  quantity: number | string;
  bar_length_m: number | string | null;
  weight_kg_m: number | string;
  line_meters: number | string;
  line_tonnes: number | string;
  note: string | null;
};

type InvitePayload = {
  valid?: boolean;
  title?: string;
  buyer_organization_name?: string;
  supplier_name?: string | null;
  due_at?: string | null;
  expired?: boolean;
  buyer_message?: string | null;
  line_count?: number;
  total_tonnes?: number | string;
  lines?: InviteLine[];
};

function formatNumber(value: number | string | null | undefined, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatDue(value: string | null | undefined) {
  if (!value) return "Nessuna scadenza indicata";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Nessuna scadenza indicata";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default async function SupplierRfqInvitePage({ params }: { params: Params }) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rfqh3_open_invite", {
    p_token_hash: tokenHash,
  });

  const invite =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as InvitePayload)
      : null;

  if (error || !invite?.valid) {
    return (
      <main className="min-h-screen bg-[#f2f4f3] px-4 py-12 text-[#1d2824]">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#dce2df] bg-white p-7">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Smart Steel Sales · RFQ
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Link RFQ non disponibile</h1>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Il link può essere scaduto, revocato oppure non valido. Contatta il buyer che ti ha inviato la richiesta.
          </p>
        </div>
      </main>
    );
  }

  const lines = Array.isArray(invite.lines) ? invite.lines : [];

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-8 text-[#1d2824] sm:py-12">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl border border-[#244d43] bg-[#123d34] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
            Smart Steel Sales · Richiesta di offerta
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
            {invite.title || "Richiesta di offerta"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#d8e5e0]">
            Da <strong>{invite.buyer_organization_name || "Buyer Smart Steel Sales"}</strong>
            {invite.supplier_name ? " · Per " + invite.supplier_name : ""}
          </p>
          <p className="mt-2 text-sm text-[#d8e5e0]">
            Scadenza: {formatDue(invite.due_at)}
          </p>
        </header>

        {invite.expired ? (
          <div className="rounded-2xl border border-[#ead9c0] bg-[#fffaf1] px-5 py-4 text-sm font-semibold text-[#7b5e2b]">
            La scadenza indicata dal buyer è già trascorsa.
          </div>
        ) : null}

        {invite.buyer_message ? (
          <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Messaggio del buyer
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52615b]">
              {invite.buyer_message}
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[#dce2df] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ece9] px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                Distinta richiesta
              </p>
              <p className="mt-1 text-xs text-[#718078]">
                {invite.line_count ?? lines.length} righe · {formatNumber(invite.total_tonnes, 3)} t
              </p>
            </div>
            <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold text-[#173f35]">
              Target buyer non condiviso
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#dce2df] text-[#66736e]">
                  <th className="px-4 py-3">Articolo</th>
                  <th className="px-4 py-3">Norma</th>
                  <th className="px-4 py-3">Grado</th>
                  <th className="px-4 py-3">Finitura</th>
                  <th className="px-4 py-3 text-right">Quantità</th>
                  <th className="px-4 py-3 text-right">kg/m</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.position} className="border-b border-[#edf0ee]">
                    <td className="px-4 py-3 font-semibold">{line.description}</td>
                    <td className="px-4 py-3 text-[#52615b]">{line.standard || "—"}</td>
                    <td className="px-4 py-3 text-[#52615b]">{line.grade || "—"}</td>
                    <td className="px-4 py-3 text-[#52615b]">{line.finish || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#52615b]">
                      {formatNumber(line.quantity, line.quantity_mode === "tonnes" ? 3 : 2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#52615b]">
                      {formatNumber(line.weight_kg_m, 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-[#cddbd6] bg-[#f7faf8] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">RFQH3</p>
          <h2 className="mt-1 text-lg font-semibold">Richiesta verificata.</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Questo link è personale e identifica il destinatario della richiesta. Nel prossimo blocco RFQH4 questa pagina consentirà di compilare e inviare l&apos;offerta riga per riga.
          </p>
        </section>
      </div>
    </main>
  );
}
