import Link from "next/link";

type Role = "trader_distributor" | "processor_service_provider" | "end_user" | "producer";

const paths: {role: Role; heading: string; description: string}[] = [
  { role: "trader_distributor", heading: "Cerco fornitori", description: "Commercianti e distributori" },
  { role: "processor_service_provider", heading: "Cerco terzisti", description: "Lavorazioni e servizi industriali" },
  { role: "end_user", heading: "Cerco clienti", description: "Utilizzatori potenziali" },
  { role: "producer", heading: "Cerco produttori", description: "Aziende della filiera" },
];

function rolePath(role: Role, persona?: string) {
  const qs = new URLSearchParams({role});
  if (persona && ["producer", "trader_distributor", "processor_service_provider", "end_user"].includes(persona))
    qs.set("persona", persona);
  return `/network?${qs.toString()}#network-new-discoveries`;
}

/** Accessible, shared Free/Pro orientation. No inferred location or lead qualification. */
export function NetworkDiscoveryOverview({
  published, discovered, persona, role, region, discoveryUnavailable = false, publishedUnavailable = false,
}: {
  published: number;
  discovered: number;
  persona?: string;
  role?: string;
  region?: string;
  discoveryUnavailable?: boolean;
  publishedUnavailable?: boolean;
}) {
  const total = published + discovered;
  const anyUnavailable = publishedUnavailable || discoveryUnavailable;
  return (
    <section aria-label="Esplora la rete industriale" className="rounded-2xl border border-[#d4e2db] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#277052]">Rete industriale</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#173f35] sm:text-2xl">
            {anyUnavailable ? "Scopri la filiera industriale" : total.toLocaleString("it-IT")+" aziende da esplorare"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#52615b]">
            {publishedUnavailable ? "—" : published.toLocaleString("it-IT")} profili pubblicati · {discoveryUnavailable ? "—" : discovered.toLocaleString("it-IT")} scoperti, da confermare
          </p>
        </div>
        <Link href="/network#network-region-results"
          className="inline-flex min-h-10 items-center rounded-xl border border-[#b8d2c8] bg-[#f4f9f6] px-4 text-xs font-semibold text-[#173f35] hover:bg-[#e6f1eb]">
          Esplora le aziende ↓
        </Link>
      </div>
      <nav aria-label="Trova aziende per attività" className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {paths.map(item => (
          <Link key={item.role} href={rolePath(item.role,persona)}
            aria-current={role === item.role ? "page" : undefined}
            className={"flex min-h-[82px] flex-col justify-center rounded-xl border p-3 transition focus-visible:outline-2 focus-visible:outline-offset-2 " +
              (role === item.role
                ? "border-[#175640] bg-[#e5f0e9] text-[#173f35]"
                : "border-[#dce7e0] bg-[#f9fbf9] text-[#173f35] hover:border-[#9ebfae] hover:bg-[#f0f7f2]")}>
            <span className="text-sm font-semibold">{item.heading}</span>
            <span className="mt-1 text-[11px] leading-4 text-[#52615b]">{item.description}</span>
          </Link>
        ))}
      </nav>
      {region ? (
        <p className="mt-3 rounded-lg bg-[#fff7e6] px-3 py-2 text-xs leading-5 text-[#765821]">
          Il filtro regionale mostra solo sedi pubblicate: le aziende scoperte senza una sede confermata restano fuori.
          {" "}<Link href="/network#network-new-discoveries" className="font-semibold underline">Mostra anche quelle senza regione</Link>
        </p>
      ) : null}
      {discoveryUnavailable ? (
        <p role="status" className="mt-3 rounded-lg border border-[#e2d1a4] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#765821]">
          I profili da confermare non sono momentaneamente disponibili. I profili pubblicati restano consultabili.
        </p>
      ) : null}
    </section>
  );
}
