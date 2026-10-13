import Link from "next/link";

import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import { visiblePlatformReviewLanes } from "@/lib/review-boundaries";

export const dynamic = "force-dynamic";

export default async function PlatformReviewPage() {
  // Authenticated Platform context is separate from organization membership.
  // Each linked domain enforces its own permission in its Server Actions/RPCs.
  const context = await requirePlatformConsoleContext();
  const lanes = visiblePlatformReviewLanes(context.permissions);

  return (
    <FocusPage className="space-y-5">
      <FocusHeader
        eyebrow="Platform · Governance"
        title="Platform Review"
        description="Verifiche di competenza della piattaforma: registrazioni, Network e Knowledge pubblico. Nessun dato commerciale privato dei clienti viene letto in questa vista."
        actions={
          <Link
            href="/platform"
            className="inline-flex min-h-10 items-center rounded-xl border border-[#dce2df] bg-white px-4 text-sm font-semibold text-[#1a5144] hover:bg-[#f2f7f4]"
          >
            Centro di controllo
          </Link>
        }
      />

      <section aria-labelledby="platform-review-domains" className="space-y-3">
        <div>
          <h2 id="platform-review-domains" className="text-lg font-semibold text-[#1d2824]">
            Code di governance abilitate
          </h2>
          <p className="mt-1 text-sm text-[#5e6c65]">
            Apri il dominio per consultare le evidenze. Solo i permessi decisionali specifici consentono approvazioni o modifiche.
          </p>
        </div>
        {lanes.length === 0 ? (
          <p className="rounded-xl border border-[#dce2df] bg-white p-5 text-sm text-[#53635d]">
            Il tuo profilo non ha ancora permessi di lettura su alcuna coda di governance.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {lanes.map((lane) => {
              const canDecide = context.permissions.includes(lane.decisionPermission);
              return (
                <Link
                  key={lane.key}
                  href={lane.href}
                  className="group flex min-h-36 flex-col justify-between rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#96b9aa] hover:bg-[#f7faf8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]"
                >
                  <div>
                    <h3 className="text-base font-semibold text-[#173f35]">{lane.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#56655e]">{lane.description}</p>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-[#1a5144]">
                    {canDecide ? "Apri la revisione" : "Consulta la coda"} <span aria-hidden="true">→</span>
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-[#66736e]">
        Le correzioni di estrazione, normalizzazione ed evidenza commerciale restano nella Quality Review dell’azienda proprietaria e non vengono aggregate qui.
      </p>
    </FocusPage>
  );
}
