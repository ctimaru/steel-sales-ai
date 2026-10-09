import Link from "next/link";

import {
  investorDemoCommercialMemory,
  investorDemoMeta,
  investorDemoNetwork,
  investorDemoProcurementIntelligence,
  investorDemoRfqHub,
  investorDemoSurfaces,
  type InvestorDemoSurface,
} from "@/lib/marketing-private-demo-data";
import { appRoutes } from "@/lib/routes";

function DemoBanner({ surface }: { surface: InvestorDemoSurface }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-900">{investorDemoMeta.label}</p>
        <p className="mt-1 text-xs text-amber-950">MKT6 · {surface} · synthetic fixture · excluded from analytics</p>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-900">
        owner-only
      </span>
    </div>
  );
}

function CommercialMemoryDemo() {
  const data = investorDemoCommercialMemory;
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-6">
        <p className="app-kicker">Commercial Memory</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#173f35]">La memoria commerciale, leggibile in pochi secondi.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">Ricerca per prodotto, cliente, RFQ, offerta, ordine o prezzo.</p>
      </header>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries(data.metrics).map(([label,value])=>(
          <div key={label} className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-2xl font-semibold text-[#173f35]">{value}</p>
            <p className="mt-1 text-xs font-semibold capitalize text-[#5d6a65]">{label}</p>
          </div>
        ))}
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
        {data.rows.map((row,index)=>(
          <div key={row.id} className={["grid gap-3 p-4 sm:grid-cols-[120px_1fr_auto]", index ? "border-t border-[#edf1ef]" : ""].join(" ")}>
            <div>
              <span className="rounded-full bg-[#edf5f2] px-2 py-1 text-[10px] font-bold uppercase text-[#173f35]">{row.role}</span>
              <p className="mt-2 text-xs text-[#718078]">{row.date}</p>
            </div>
            <div>
              <p className="font-semibold text-[#1d2824]">{row.product}</p>
              <p className="mt-1 text-xs text-[#66736e]">{row.grade} · {row.standard} · {row.company}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#173f35]">{row.price}</p>
              <p className="mt-1 text-xs text-[#718078]">{Math.round(row.confidence*100)}% evidence confidence</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function RfqHubDemo() {
  const data=investorDemoRfqHub;
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-[#244d43] bg-[#123d34] p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">RFQ Hub · multi-supplier</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{data.campaign.title}</h2>
        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          {[["Righe",data.campaign.lines],["Tonnellate",data.campaign.tonnes],["Fornitori",data.campaign.suppliers],["Scadenza",data.campaign.due]].map(([l,v])=>(
            <div key={String(l)} className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
              <p className="text-[10px] uppercase text-white/55">{l}</p><p className="mt-1 text-lg font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </header>
      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-[#dce2df] bg-white">
          <div className="border-b border-[#edf0ee] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">Fornitori target</p></div>
          {data.suppliers.map((s,index)=>(
            <div key={s.name} className={["px-5 py-4",index?"border-t border-[#edf0ee]":""].join(" ")}>
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#1d2824]">{s.name}</p><p className="mt-1 text-xs text-[#718078]">{s.email}</p></div><span className="rounded-full bg-[#edf5f2] px-2 py-1 text-[9px] font-bold uppercase text-[#173f35]">{s.status}</span></div>
              <p className="mt-2 text-[10px] text-[#718078]">{s.channel}</p>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
          <div className="border-b border-[#edf0ee] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">Quote comparison</p></div>
          <table className="w-full text-left text-xs">
            <thead><tr className="text-[#66736e]"><th className="px-4 py-3">Supplier</th><th>Coverage</th><th className="text-right">€/t</th><th className="text-right">Lead</th><th className="px-4 text-right">Delta target</th></tr></thead>
            <tbody>{data.comparison.map((r)=>(
              <tr key={r.supplier} className="border-t border-[#edf0ee]"><td className="px-4 py-4 font-semibold">{r.supplier}</td><td>{r.coverage}</td><td className="text-right font-semibold text-[#173f35]">{r.eurT}</td><td className="text-right">{r.lead}</td><td className="px-4 text-right font-semibold text-[#1a6a54]">{r.delta}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function NetworkDemo() {
  const data=investorDemoNetwork;
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-6">
        <p className="app-kicker">Network</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#173f35]">Trova aziende steel per ruolo e capability.</h2>
        <div className="mt-4 flex flex-wrap gap-2">{data.filters.map(f=><span key={f} className="rounded-full border border-[#cfe0d9] bg-white px-3 py-1.5 text-xs font-semibold text-[#43524c]">{f}</span>)}</div>
        <Link href="/platform/marketing/demo-room/companies" className="mt-4 inline-flex rounded-xl border border-[#afcabe] bg-white px-4 py-2.5 text-xs font-semibold text-[#173f35]">Apri DEMOTEST1 · Quattro aziende e matrice di collaudo →</Link>
      </header>
      <div className="flex items-baseline justify-between"><p className="text-sm font-semibold text-[#52615b]">Directory demo</p><p className="text-2xl font-semibold text-[#173f35]">{data.total.toLocaleString("it-IT")} aziende</p></div>
      <section className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
        {data.companies.map((c,index)=>(
          <div key={c.name} className={["grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]",index?"border-t border-[#edf1ef]":""].join(" ")}>
            <div><p className="text-[10px] font-bold uppercase text-[#718078]">{c.country}</p><p className="mt-1 font-semibold text-[#1d2824]">{c.name}</p><p className="mt-1 text-xs text-[#66736e]">{c.verification}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-[#718078]">Ruolo</p><span className="mt-2 inline-block rounded-full bg-[#edf5f2] px-2.5 py-1 text-xs font-semibold text-[#173f35]">{c.role}</span></div>
            <div><p className="text-[10px] font-bold uppercase text-[#718078]">Capability</p><div className="mt-2 flex flex-wrap gap-1.5">{c.capabilities.map(x=><span key={x} className="rounded-full border border-[#dce2df] px-2.5 py-1 text-xs text-[#43524c]">{x}</span>)}</div></div>
            <div className="self-center"><span className="app-primary inline-flex rounded-xl px-3.5 py-2.5 text-xs font-semibold">Apri</span></div>
          </div>
        ))}
      </section>
    </div>
  );
}

function ProcurementIntelligenceDemo() {
  const data=investorDemoProcurementIntelligence;
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-[#dce2df] bg-white p-6">
        <p className="app-kicker">Procurement Intelligence</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d2824]">Dallo storico acquisti a decisioni misurabili.</h2>
        <p className="mt-2 text-sm text-[#66736e]">Metriche separate, evidence esplicita, nessun ranking opaco.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{data.summary.map(([l,v])=><div key={l} className="rounded-2xl border border-[#dce2df] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">{l}</p><p className="mt-1 text-xl font-semibold text-[#1d2824]">{v}</p></div>)}</section>
      <section className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">Funnel procurement</p><div className="mt-4 space-y-3 text-sm">{Object.entries(data.funnel).map(([k,v])=><div key={k} className="flex justify-between gap-3"><span className="capitalize text-[#66736e]">{k}</span><strong>{v}</strong></div>)}</div></div>
        <div className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white"><div className="border-b border-[#edf0ee] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">Supplier performance</p></div><table className="w-full text-left text-xs"><thead><tr className="text-[#66736e]"><th className="px-4 py-3">Supplier</th><th>Response</th><th>Coverage</th><th>Lead</th><th className="px-4 text-right">Saving</th></tr></thead><tbody>{data.suppliers.map(s=><tr key={s.name} className="border-t border-[#edf0ee]"><td className="px-4 py-4 font-semibold">{s.name}</td><td>{s.response}</td><td>{s.coverage}</td><td>{s.lead}</td><td className="px-4 text-right font-semibold text-[#1a6a54]">{s.saving}</td></tr>)}</tbody></table></div>
      </section>
      <section className="rounded-2xl border border-[#dce2df] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">Article intelligence</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="font-semibold text-[#1d2824]">{data.article.description}</p><p className="mt-1 text-xs text-[#66736e]">{data.article.samples} campioni demo</p></div><div className="text-right"><p className="text-2xl font-semibold text-[#173f35]">{data.article.latest}</p><p className="mt-1 text-xs font-semibold text-[#1a6a54]">{data.article.change} vs precedente</p></div></div></section>
    </div>
  );
}

export function PrivateProductDemoRoom({ surface }: { surface: InvestorDemoSurface }) {
  const content =
    surface === "commercial-memory" ? <CommercialMemoryDemo /> :
    surface === "rfq-hub" ? <RfqHubDemo /> :
    surface === "network" ? <NetworkDemo /> :
    <ProcurementIntelligenceDemo />;

  return (
    <div className="space-y-5">
      <DemoBanner surface={surface} />
      <nav className="flex flex-wrap gap-2">
        {investorDemoSurfaces.map(item=>(
          <Link key={item.key} href={appRoutes.platform.marketingDemoRoom(item.key)} className={["rounded-full border px-3.5 py-2 text-xs font-semibold transition", item.key===surface?"border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]":"border-[var(--border)] bg-white text-[var(--text-secondary)]"].join(" ")}>{item.label}</Link>
        ))}
      </nav>
      {content}
    </div>
  );
}
