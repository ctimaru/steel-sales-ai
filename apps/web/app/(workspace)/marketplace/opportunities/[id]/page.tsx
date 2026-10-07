import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketplaceCountdown } from "@/components/marketplace-countdown";
import { MarketplaceResponseWorkspace } from "@/components/marketplace-response-workspace";
import { canWriteWorkspace } from "@/lib/access-policy";
import {
  getMarketplaceEntitlementState,
  getMarketplaceSupplierWorkspace,
  getMarketplaceTeaser,
  getMarketplaceUnlockedDetail,
  type MarketplaceUnlockedLine,
} from "@/lib/marketplace";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function numberLabel(value: number | undefined) {
  if (value == null) return null;
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 3,
  }).format(value);
}

function dimensionsLabel(line: MarketplaceUnlockedLine) {
  const pieces = [
    line.outer_diameter_mm != null ? `Ø ${numberLabel(line.outer_diameter_mm)}` : null,
    line.width_mm != null ? numberLabel(line.width_mm) : null,
    line.height_mm != null ? `× ${numberLabel(line.height_mm)}` : null,
    line.thickness_mm != null ? `sp. ${numberLabel(line.thickness_mm)}` : null,
    line.length_mm != null ? `L ${numberLabel(line.length_mm)} mm` : null,
  ].filter(Boolean);

  return pieces.join(" · ") || "Non specificate";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function sourceLabel(source: string | null) {
  if (source === "subscription") return "Abbonamento";
  if (source === "credit") return "Credito opportunità";
  if (source === "pilot") return "Pilot";
  if (source === "manual") return "Grant manuale";
  if (source === "system") return "Sistema";
  return "Accesso";
}

export default async function MarketplaceOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ id }, { error, message }, context] = await Promise.all([
    params,
    searchParams,
    getWorkspaceContext(),
  ]);

  const [teaser, initialEntitlement] = await Promise.all([
    getMarketplaceTeaser(context.organizationId, id),
    getMarketplaceEntitlementState(context.organizationId, id),
  ]);

  if (!teaser || !initialEntitlement) notFound();

  let entitlement = initialEntitlement;
  let unlocked =
    entitlement.state === "entitled"
      ? await getMarketplaceUnlockedDetail(context.organizationId, id)
      : null;

  if (entitlement.state === "entitled" && !unlocked) {
    entitlement =
      (await getMarketplaceEntitlementState(context.organizationId, id)) ??
      entitlement;
  }

  const first = teaser.teaser_lines[0];
  const namedBuyer = teaser.buyer.visibility_mode === "named";
  const isUnlocked = entitlement.state === "entitled" && unlocked != null;
  const canRespondRole = canWriteWorkspace(context.role);
  const responseWorkspace =
    isUnlocked && canRespondRole
      ? await getMarketplaceSupplierWorkspace(context.organizationId, id)
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={appRoutes.marketplace.home}
        className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
      >
        ← Torna alle opportunità
      </Link>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                  teaser.effective_status === "closing_soon"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                {teaser.effective_status === "closing_soon" ? "In scadenza" : "Aperta"}
              </span>
              <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                {namedBuyer ? "Buyer visibile" : "Buyer riservato"}
              </span>
              <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-semibold text-[#173f35]">
                Informazioni essenziali
              </span>
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  isUnlocked
                    ? "bg-emerald-50 text-emerald-700"
                    : entitlement.state === "expired"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-[#f2f4f3] text-[#66736e]",
                ].join(" ")}
              >
                {isUnlocked
                  ? "Dettagli disponibili"
                  : entitlement.state === "expired"
                    ? "Accesso scaduto"
                    : "Dettagli protetti"}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2824]">
              {first?.product_family_name || "Ricerca prodotto"}
              {teaser.line_count > 1 ? ` · ${teaser.line_count} linee` : ""}
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Le informazioni essenziali sono visibili subito. Le specifiche complete vengono mostrate solo quando la tua organizzazione dispone del livello di accesso richiesto.
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
                L’identità del buyer resta protetta anche quando i dettagli della richiesta sono accessibili.
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
            Informazioni disponibili
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
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Base"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {isUnlocked && unlocked ? (
        <section className="rounded-3xl border border-[#b8d2c8] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                Dettaglio completo
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">
                Specifiche complete sbloccate
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
                Accesso disponibile tramite {sourceLabel(entitlement.source_kind)}. Il diritto di risposta viene verificato separatamente e la richiesta deve essere ancora aperta.
              </p>
            </div>

            <div className="rounded-2xl bg-[#f3f7f5] px-4 py-3 text-xs text-[#66736e]">
              <p>
                <strong className="text-[#43524c]">Scope:</strong>{" "}
                {entitlement.entitlement_key === "marketplace_access"
                  ? "Marketplace access"
                  : "Singola opportunità"}
              </p>
              <p className="mt-1">
                <strong className="text-[#43524c]">Scadenza accesso:</strong>{" "}
                {formatDate(entitlement.expires_at)}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {unlocked.lines.map((line) => (
              <article
                key={line.line_number}
                className="rounded-2xl border border-[#e2e7e4] bg-[#f8faf9] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#173f35]">
                      Pos. {line.line_number} · {line.product_family_name}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[#1d2824]">
                      {[
                        line.standard_code,
                        line.grade_designation,
                        dimensionsLabel(line),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#173f35]">
                    {numberLabel(line.quantity)} {line.quantity_unit}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Norma / grado
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {line.standard_code || "—"}
                      {line.grade_designation ? ` · ${line.grade_designation}` : ""}
                    </p>
                    {line.material_number ? (
                      <p className="mt-1 text-xs text-[#87938e]">{line.material_number}</p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Dimensioni
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {dimensionsLabel(line)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Certificazione
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {line.certification || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Consegna richiesta
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {line.delivery_country_code}
                      {line.delivery_region ? ` · ${line.delivery_region}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[#87938e]">
                      {formatDate(line.requested_delivery_date)}
                    </p>
                  </div>
                </div>

                {line.notes ? (
                  <div className="mt-4 rounded-xl border border-[#e2e7e4] bg-white px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Note
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#66736e]">{line.notes}</p>
                  </div>
                ) : line.notes_withheld_for_anonymity ? (
                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
                    Le note libere sono trattenute per proteggere l’anonimato del buyer.
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] px-5 py-4">
            <p className="text-sm font-semibold text-[#173f35]">
              Risposta al buyer
            </p>
            <p className="mt-1 text-sm leading-6 text-[#66736e]">
              {canRespondRole
                ? "Il composer sotto usa un diritto di risposta verificato server-side e mantiene separata questa interazione dalla Commercial Memory privata."
                : "Il tuo ruolo può consultare l’opportunità sbloccata, ma non creare o modificare risposte Marketplace."}
            </p>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-[#d9e8e2] bg-[#f3f7f5] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#173f35]">
                Dettaglio protetto
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[#66736e]">
                Accesso ai dettagli richiesto
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                {entitlement.state === "expired"
                  ? "Accesso scaduto"
                  : "Specifiche complete protette"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
                {entitlement.state === "expired"
                  ? "La finestra di accesso della tua organizzazione è terminata. Le specifiche complete sono nuovamente protette."
                  : "Per visualizzare norma, grado, dimensioni, quantità esatta, certificazione e consegna serve un livello di accesso abilitato per la tua organizzazione."}
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-[#87938e]">
                L’accesso è gestito a livello organizzazione e non può essere auto-assegnato da questa pagina.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={appRoutes.marketplace.notifications}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-sm font-semibold text-[#173f35] hover:bg-[#edf5f2]"
              >
                Apri opportunità per te
              </Link>
              <Link
                href={appRoutes.network.manage}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#c8d5d0] bg-white px-4 text-sm font-semibold text-[#43524c] hover:bg-[#f2f4f3]"
              >
                Migliora Company Profile
              </Link>
            </div>
          </div>
        </section>
      )}

      {isUnlocked && unlocked && !canRespondRole ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
            Permessi di risposta
          </p>
          <h2 className="mt-2 text-lg font-semibold text-amber-950">
            Opportunità leggibile, risposta non abilitata per il tuo ruolo
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-800">
            Il ruolo Viewer può consultare il dettaglio sbloccato ma non creare o
            modificare risposte Marketplace. Un amministratore dell’organizzazione deve assegnarti
            un ruolo Member o Admin; questo passaggio non è self-service.
          </p>
          <Link
            href={appRoutes.home}
            className="mt-4 inline-flex rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50"
          >
            Torna al workspace
          </Link>
        </section>
      ) : null}

      {responseWorkspace && unlocked ? (
        <MarketplaceResponseWorkspace
          requestId={id}
          workspace={responseWorkspace}
          unlockedLines={unlocked.lines}
        />
      ) : null}
    </div>
  );
}
