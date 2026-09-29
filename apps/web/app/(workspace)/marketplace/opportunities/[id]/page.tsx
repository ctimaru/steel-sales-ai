import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketplaceCountdown } from "@/components/marketplace-countdown";
import { getMarketplaceTeaser } from "@/lib/marketplace";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export default async function MarketplaceOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, context] = await Promise.all([
    params,
    getWorkspaceContext(),
  ]);

  const teaser = await getMarketplaceTeaser(context.organizationId, id);
  if (!teaser) notFound();

  const first = teaser.teaser_lines[0];
  const namedBuyer = teaser.buyer.visibility_mode === "named";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={appRoutes.marketplace.home}
        className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
      >
        ← Torna alle opportunità
      </Link>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={[
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                teaser.effective_status === "closing_soon"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700",
              ].join(" ")}>
                {teaser.effective_status === "closing_soon" ? "In scadenza" : "Aperta"}
              </span>
              <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                {namedBuyer ? "Named" : "Anonymous"}
              </span>
              <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-semibold text-[#173f35]">
                Teaser P5.2
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2824]">
              {first?.product_family_name || "Ricerca prodotto"}
              {teaser.line_count > 1 ? ` · ${teaser.line_count} linee` : ""}
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Questa vista mostra esclusivamente i dati gratuiti del Demand Board. Le specifiche tecniche
              complete non sono esposte in P5.2.
            </p>
          </div>

          <div className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8782]">
              Tempo residuo
            </p>
            <div className="mt-1">
              <MarketplaceCountdown initialSeconds={teaser.seconds_remaining} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
            Buyer
          </p>

          {teaser.buyer.visibility_mode === "anonymous" ? (
            <>
              <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">Buyer anonimo</h2>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">
                L’identità del buyer non è disponibile nel teaser e non viene rivelata automaticamente.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
                {teaser.buyer.display_name || "Azienda visibile"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                {teaser.buyer.country_code ? (
                  <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[#66736e]">
                    {teaser.buyer.country_code}
                  </span>
                ) : null}
                {teaser.buyer.claimed_status === "claimed" ? (
                  <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[#173f35]">
                    Claimed
                  </span>
                ) : null}
                {teaser.buyer.verification_status === "verified" ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    Verified
                  </span>
                ) : null}
              </div>

              {teaser.buyer.network_company_id ? (
                <Link
                  href={appRoutes.network.company(teaser.buyer.network_company_id)}
                  className="mt-4 inline-flex text-sm font-semibold text-[#173f35] hover:underline"
                >
                  Apri Company Profile →
                </Link>
              ) : null}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
            Opportunità
          </p>
          <div className="mt-4 space-y-3">
            {teaser.teaser_lines.map((line) => (
              <article
                key={line.line_number}
                className="rounded-2xl border border-[#e2e7e4] bg-[#f8faf9] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1d2824]">
                    Pos. {line.line_number} · {line.product_family_name}
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                    {line.quantity_band}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Processo
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {line.manufacturing_process || "Non specificato"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Consegna
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {line.delivery_country_code}
                      {line.delivery_region ? ` · ${line.delivery_region}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Completezza
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {[
                        line.has_standard ? "Norma" : null,
                        line.has_grade ? "Grado" : null,
                        line.has_dimensions ? "Dimensioni" : null,
                        line.has_certification ? "Certificazione" : null,
                      ].filter(Boolean).join(" · ") || "Base"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#d9e8e2] bg-[#f3f7f5] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#173f35]">
              Locked detail
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Specifiche complete non disponibili nel teaser
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
              Norma, grado, dimensioni, quantità esatta, certificazione, lead time, note e diritti di risposta
              saranno governati dal blocco P5.3 Entitlement & Unlock.
            </p>
          </div>
          <span className="inline-flex h-10 items-center justify-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-sm font-semibold text-[#66736e]">
            Unlock · P5.3
          </span>
        </div>
      </section>
    </div>
  );
}
