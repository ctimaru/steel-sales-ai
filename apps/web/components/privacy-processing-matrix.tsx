import { GDPR_PROCESSING_ACTIVITIES, GDPR_REGISTER_VERSION } from "@/lib/gdpr-processing-register";

export function PrivacyProcessingMatrix() {
  return (
    <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
        Registro trattamenti · {GDPR_REGISTER_VERSION}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">
        Finalità, basi giuridiche e conservazione
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#5d6a65]">
        La matrice segue i trattamenti effettivi del prodotto e distingue le attività già operative
        dai punti ancora aperti prima dell&apos;onboarding commerciale.
      </p>
      <div className="mt-6 space-y-4">
        {GDPR_PROCESSING_ACTIVITIES.map((activity) => (
          <article key={activity.id} className="rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-[#173f35]">{activity.title}</h3>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#52615b]">
                {activity.role === "controller"
                  ? "Titolare"
                  : activity.role === "processor_context"
                    ? "Contesto responsabile"
                    : "Gate governance"}
              </span>
              <span className="rounded-full border border-[#cbd8d3] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#52615b]">
                {activity.notice}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-2">
              <div><dt className="font-semibold text-[#43524c]">Finalità</dt><dd>{activity.purpose}</dd></div>
              <div><dt className="font-semibold text-[#43524c]">Base giuridica / ruolo</dt><dd>{activity.legalBasis}</dd></div>
              <div><dt className="font-semibold text-[#43524c]">Categorie dati</dt><dd>{activity.data}</dd></div>
              <div><dt className="font-semibold text-[#43524c]">Fonti</dt><dd>{activity.sources}</dd></div>
              <div><dt className="font-semibold text-[#43524c]">Destinatari</dt><dd>{activity.recipients}</dd></div>
              <div><dt className="font-semibold text-[#43524c]">Conservazione</dt><dd>{activity.retention}</dd></div>
              <div className="md:col-span-2"><dt className="font-semibold text-[#43524c]">Trasferimenti</dt><dd>{activity.transfers}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
