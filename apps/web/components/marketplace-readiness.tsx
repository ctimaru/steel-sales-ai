import Link from "next/link";

import type {
  MarketplaceEntryReadiness,
  MarketplaceReadinessCheck,
} from "@/lib/marketplace-readiness";
import { appRoutes } from "@/lib/routes";

function CheckRow({ check }: { check: MarketplaceReadinessCheck }) {
  const ready = check.status === "ready";
  const blocked = check.status === "blocked";

  return (
    <div className="rounded-2xl border border-[#e2e7e4] bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={[
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            ready
              ? "bg-emerald-50 text-emerald-700"
              : blocked
                ? "bg-amber-50 text-amber-800"
                : "bg-[#edf5f2] text-[#173f35]",
          ].join(" ")}
        >
          {ready ? "✓" : blocked ? "!" : "↗"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#1d2824]">{check.label}</p>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
                ready
                  ? "bg-emerald-50 text-emerald-700"
                  : blocked
                    ? "bg-amber-50 text-amber-800"
                    : "bg-[#edf5f2] text-[#173f35]",
              ].join(" ")}
            >
              {ready ? "Pronto" : blocked ? "Da completare" : "Migliorabile"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#66736e]">
            {check.description}
          </p>
          {check.actionLabel ? (
            check.href ? (
              <Link
                href={check.href}
                className="mt-3 inline-flex text-xs font-semibold text-[#173f35] hover:underline"
              >
                {check.actionLabel} →
              </Link>
            ) : (
              <p className="mt-3 text-xs font-semibold text-[#173f35]">
                Azione: {check.actionLabel}
              </p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function readinessLabel(ready: boolean) {
  return ready ? "Operativo" : "Setup richiesto";
}

export function MarketplaceReadinessPanel({
  readiness,
}: {
  readiness: MarketplaceEntryReadiness;
}) {
  return (
    <section
      className="rounded-3xl border border-[#dce2df] bg-[#f8faf9] p-5 sm:p-6"
      aria-labelledby="marketplace-readiness-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
            Marketplace readiness
          </p>
          <h2
            id="marketplace-readiness-title"
            className="mt-2 text-xl font-semibold text-[#1d2824]"
          >
            Cosa puoi fare adesso
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            Buyer e supplier usano prerequisiti diversi. Qui vedi solo i requisiti
            reali già governati da Network, ruolo aziendale e regole Marketplace.
          </p>
        </div>
        <Link
          href={appRoutes.network.manage}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[#c8d5d0] bg-white px-4 text-xs font-semibold text-[#173f35] hover:bg-[#edf5f2]"
        >
          Gestisci Company Profile
        </Link>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-[#dce2df] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8782]">
                Buyer
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#1d2824]">
                Pubblica una ricerca
              </h3>
            </div>
            <span
              className={[
                "rounded-full px-3 py-1 text-[11px] font-bold",
                readiness.buyer.canWrite
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800",
              ].join(" ")}
            >
              {readinessLabel(readiness.buyer.canWrite)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#66736e]">
            Le bozze Marketplace sono sempre separate da RFQ, offerte e ordini
            della Commercial Memory. La modalità named richiede anche un profilo
            pubblico attivo.
          </p>
          <div className="mt-4 space-y-3">
            {readiness.buyer.checks.map((check) => (
              <CheckRow key={check.key} check={check} />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[#dce2df] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8782]">
                Supplier
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#1d2824]">
                Ricevi match e rispondi
              </h3>
            </div>
            <span
              className={[
                "rounded-full px-3 py-1 text-[11px] font-bold",
                readiness.supplier.matchingReady
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800",
              ].join(" ")}
            >
              {readinessLabel(readiness.supplier.matchingReady)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#66736e]">
            Il matching nasce dal Company Profile pubblico. Entitlement e unlock
            restano controlli separati e vengono verificati sulla singola
            opportunità prima della risposta.
          </p>
          <div className="mt-4 space-y-3">
            {readiness.supplier.checks.map((check) => (
              <CheckRow key={check.key} check={check} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarketplaceRequestReadiness({
  canWrite,
  lineCount,
  visibilityMode,
  namedPublicationReady,
}: {
  canWrite: boolean;
  lineCount: number;
  visibilityMode: "named" | "anonymous";
  namedPublicationReady: boolean;
}) {
  const checks = [
    {
      label: "Permesso di pubblicazione",
      ready: canWrite,
      description: canWrite
        ? "Il tuo ruolo può pubblicare questa ricerca."
        : "Il tuo ruolo è in sola lettura e non può pubblicare.",
      href: canWrite ? undefined : appRoutes.home,
      actionLabel: canWrite ? undefined : "Torna al workspace",
    },
    {
      label: "Linea prodotto",
      ready: lineCount > 0,
      description:
        lineCount > 0
          ? `${lineCount} linea${lineCount === 1 ? "" : "e"} pronta${lineCount === 1 ? "" : "e"} nella richiesta.`
          : "Aggiungi almeno una linea prodotto prima della pubblicazione.",
    },
    {
      label: "Identità buyer",
      ready: visibilityMode === "anonymous" || namedPublicationReady,
      description:
        visibilityMode === "anonymous"
          ? "Modalità anonima: il Company Profile pubblico non è un prerequisito di pubblicazione."
          : namedPublicationReady
            ? "Il Company Profile è pubblicato e può essere mostrato ai supplier."
            : "La modalità azienda visibile richiede un Company Profile collegato e pubblicato.",
      href:
        visibilityMode === "named" && !namedPublicationReady
          ? appRoutes.network.manage
          : undefined,
      actionLabel:
        visibilityMode === "named" && !namedPublicationReady
          ? "Completa Company Profile"
          : undefined,
    },
  ];

  const ready = checks.every((check) => check.ready);

  return (
    <div
      className={[
        "rounded-2xl border p-5",
        ready
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-amber-200 bg-amber-50/50",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
            Readiness pubblicazione
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#1d2824]">
            {ready ? "Ricerca pronta per la pubblicazione" : "Completa i requisiti prima di pubblicare"}
          </h3>
        </div>
        <span
          className={[
            "rounded-full px-3 py-1 text-[11px] font-bold",
            ready
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-900",
          ].join(" ")}
        >
          {ready ? "Ready" : "Blocked"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {checks.map((check) => (
          <div key={check.label} className="rounded-xl border border-white/80 bg-white/80 p-3">
            <p className="text-xs font-semibold text-[#1d2824]">
              {check.ready ? "✓ " : "! "}
              {check.label}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[#66736e]">
              {check.description}
            </p>
            {check.href && check.actionLabel ? (
              <Link
                href={check.href}
                className="mt-2 inline-flex text-[11px] font-semibold text-[#173f35] hover:underline"
              >
                {check.actionLabel} →
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
