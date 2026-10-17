import Link from "next/link";

import { ProductAnalyticsRefresh } from "@/components/product-analytics-refresh";
import type {
  AnalyticsFunnelStep,
  PlatformAnalyticsSnapshot,
} from "@/lib/platform-product-analytics";
import { appRoutes } from "@/lib/routes";

function formatCount(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTrendLabel(value: string, hourly: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return hourly
    ? date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function MiniTrend({
  snapshot,
}: {
  snapshot: PlatformAnalyticsSnapshot;
}) {
  const max = Math.max(
    1,
    ...snapshot.trend.map((point) => Math.max(point.pageviews, point.visitors)),
  );
  const hourly = snapshot.range === "1d";

  if (snapshot.trend.length === 0) {
    return (
      <div className="mt-5 flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-[#d9e1dd] bg-[#fafcfb] px-4 text-center text-sm text-[#7b8882]">
        Il trend inizierà a popolarsi con i primi pageview raccolti da AN1.
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <div
        className="grid min-w-[620px] items-end gap-2"
        style={{
          gridTemplateColumns: `repeat(${snapshot.trend.length}, minmax(28px, 1fr))`,
        }}
      >
        {snapshot.trend.map((point) => (
          <div key={point.label} className="group">
            <div className="flex h-44 items-end justify-center gap-1 rounded-xl bg-[#f8faf9] px-1.5 pb-2 pt-3">
              <div
                title={`${point.pageviews} pageview`}
                className="w-2.5 rounded-t bg-[#1a5144] transition group-hover:bg-[#123d34]"
                style={{
                  height: `${Math.max(3, (point.pageviews / max) * 100)}%`,
                }}
              />
              <div
                title={`${point.visitors} visitatori`}
                className="w-2.5 rounded-t bg-[#c8924a] transition group-hover:bg-[#ad7630]"
                style={{
                  height: `${Math.max(3, (point.visitors / max) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 truncate text-center text-[9px] font-semibold text-[#7d8984]">
              {formatTrendLabel(point.label, hourly)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[10px] font-semibold text-[#66736e]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#1a5144]" />
          Pageview
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#c8924a]" />
          Visitatori
        </span>
      </div>
    </div>
  );
}

function RankedList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; pageviews: number; visitors: number }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.pageviews));

  return (
    <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-[#1d2824]">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-[#f8faf9] p-4 text-sm text-[#7a8781]">
            Nessun dato ancora disponibile.
          </p>
        ) : (
          rows.map((row, index) => (
            <div key={row.label + index}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-semibold text-[#43524c]">
                  {row.label || "Direct / none"}
                </p>
                <p className="shrink-0 text-[11px] tabular-nums text-[#718078]">
                  {formatCount(row.pageviews)} pv · {formatCount(row.visitors)} visit.
                </p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1ef]">
                <div
                  className="h-full rounded-full bg-[#1a5144]"
                  style={{ width: `${Math.max(2, (row.pageviews / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Funnel({
  title,
  subtitle,
  steps,
}: {
  title: string;
  subtitle: string;
  steps: AnalyticsFunnelStep[];
}) {
  const max = Math.max(1, ...steps.map((step) => step.value));

  return (
    <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
        Funnel
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1d2824]">
        {title}
      </h2>
      <p className="mt-2 text-xs leading-5 text-[#718078]">{subtitle}</p>
      <p className="mt-1 text-[11px] leading-5 text-[#87938e]">
        I passaggi confrontano volumi aggregati di eventi: non sono conversioni di utenti unici o coorti. Le differenze non quantificano abbandoni reali.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className="relative overflow-hidden rounded-2xl border border-[#e1e7e4] bg-[#f8faf9] p-4"
          >
            <span className="absolute right-3 top-3 text-[10px] font-bold text-[#a0aaa5]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="text-2xl font-semibold tabular-nums text-[#173f35]">
              {formatCount(step.value)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#52615b]">{step.label}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-[#c8924a]"
                style={{
                  width: `${Math.max(2, (step.value / max) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[#87938e]">
              {step.conversionFromPrevious == null
                ? "base eventi"
                : `${step.conversionFromPrevious}% rapporto eventi con step precedente`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}


function Bd18ReadinessPanel({ snapshot }: { snapshot: PlatformAnalyticsSnapshot }) {
  const { bd18Readiness: read, ingestion } = snapshot;
  const headlines: Record<typeof read.state, string> = {
    token_missing: "Accesso ai dati non configurato",
    api_error: "Accesso alla Web Analytics API non riuscito",
    partial_data: "Aggregazioni parziali · valutazione sospesa",
    awaiting_data: "Nessun traffico confermato",
    awaiting_exposure: "Traffico presente · nessuna esposizione BD17 misurata",
    invalid_counts: "Anomalia fra clic e visualizzazioni",
    sample_imbalance: "Ripartizione A/B da verificare",
    collecting: "Esperimento in raccolta",
    exploratory_ready: "Dati pronti per una lettura esplorativa",
  };
  return (
    <section aria-labelledby="bd18-readiness" className="rounded-3xl border border-[#dce2df] bg-white p-4 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">BD18 · Funnel Data Readiness</p>
      <h2 id="bd18-readiness" className="mt-2 text-lg font-semibold text-[#173f35]">
        {headlines[read.state]}
      </h2>
      <p className="mt-2 text-xs leading-5 text-[#52615b]">
        Fonte: Web Analytics aggregata, {snapshot.rangeLabel.toLowerCase()}. Qualità raccolta: {ingestion.state}.
        La pubblicazione Vercel non garantisce che la raccolta degli eventi sia attiva.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {read.checks.map((check) => (
          <div key={check.label} className="rounded-xl border border-[#e2e9e5] bg-[#fafcfb] p-3">
            <p className="text-xs font-bold text-[#17483a]">{check.label}</p>
            <p className="mt-1 text-xs leading-5 text-[#52615b]">{check.detail}</p>
            <p className="mt-1 text-[11px] font-medium text-[#697b72]">
              {check.status === "ok" ? "Riscontro presente" : check.status === "warning" ? "Richiede verifica" : "In attesa"}
            </p>
          </div>
        ))}
      </div>
      <p role="status" className="mt-4 border-t border-[#e0e8e3] pt-3 text-xs leading-5 font-semibold text-[#17483a]">
        Prossima azione: {read.nextAction}
      </p>
      {read.usableForComparison && read.deltaClickRatePp !== null ? (
        <p className="mt-2 text-xs leading-5 text-[#52615b]">
          Differenza osservata (messaggio esplicito − testo attuale):
          <strong className="ml-1 tabular-nums">{read.deltaClickRatePp > 0 ? "+" : ""}{read.deltaClickRatePp.toLocaleString("it-IT")} punti percentuali</strong>.
          Solo indicatore descrittivo: non prova causale, non vincitore, non conversione a registrazione/RFQ.
        </p>
      ) : null}
    </section>
  );
}

export function ProductAnalyticsDashboard({
  snapshot,
}: {
  snapshot: PlatformAnalyticsSnapshot;
}) {
  if (!snapshot.configured) {
    return (
      <div className="space-y-4">
      <section className="rounded-3xl border border-[#e7d4ae] bg-[#fffaf1] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8b5d21]">
          Connessione Analytics
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#3d3429]">
          Connessione Vercel Analytics da configurare.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6253]">
          La raccolta effettiva degli eventi non è ancora verificabile da questa console. AN1.1 legge la Web Analytics API solo dal server e
          richiede un access token Vercel salvato come secret
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs">VERCEL_ANALYTICS_TOKEN</code>.
          Il token non viene mai inviato al browser.
        </p>
        <p className="mt-3 text-xs leading-5 text-[#7f725f]">
          Dopo l&apos;aggiunta del secret è sufficiente un redeploy production: questa
          pagina inizierà a mostrare i dati senza altre modifiche.
        </p>
      </section>
      <Bd18ReadinessPanel snapshot={snapshot} />
      </div>
    );
  }

  if (snapshot.error) {
    return (
      <div className="space-y-4">
      <section className="rounded-3xl border border-[#efc5bd] bg-[#fff5f3] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9f2f24]">
          Analytics temporaneamente non disponibile
        </p>
        <p className="mt-2 text-sm leading-6 text-[#744b45]">Impossibile leggere le aggregazioni. Verifica accesso API, permessi del progetto e disponibilità del servizio.</p>
      </section>
      <Bd18ReadinessPanel snapshot={snapshot} />
      </div>
    );
  }

  const viewsPerVisitor =
    snapshot.totals.visitors != null &&
    snapshot.totals.visitors > 0 &&
    snapshot.totals.pageviews != null
      ? snapshot.totals.pageviews / snapshot.totals.visitors
      : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="platform-kicker">AN1.1 · Production Analytics</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d2824]">
              Product Analytics Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Traffico reale, acquisizione e attivazione prodotto. I dati arrivano
              dalla Web Analytics API di Vercel e restano separati dalle raw request
              infrastrutturali.
            </p>
          </div>
          <ProductAnalyticsRefresh generatedAt={snapshot.generatedAt} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["1d", "24h"],
            ["7d", "7 giorni"],
            ["30d", "30 giorni"],
          ].map(([range, label]) => (
            <Link
              key={range}
              href={appRoutes.platform.productAnalytics + "?range=" + range}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                snapshot.range === range
                  ? "platform-selected-solid border border-[#173f35]"
                  : "border border-[#d7dfdb] bg-white text-[#5f6d67] hover:bg-[#f4f7f5]",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {snapshot.ingestion.state === "awaiting_data" ? (
        <section className="rounded-2xl border border-[#e7d4ae] bg-[#fffaf1] p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b5d21]">
            Ingestion AN1.2 · collector cablato
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6e6253]">
            La Web Analytics API risponde correttamente ma non restituisce ancora traffico nel periodo selezionato.
            Dopo il deploy AN1.2 i nuovi pageview e custom event iniziano a popolare questa dashboard; se resta a zero,
            verifica che Web Analytics sia abilitato sul progetto Vercel.
          </p>
        </section>
      ) : null}

      {snapshot.ingestion.state === "partial_data" ? (
        <section role="status" className="rounded-2xl border border-[#e7d4ae] bg-[#fffaf1] p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b5d21]">
            Dati parziali · conteggi Vercel da verificare
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6e6253]">
            Le aggregazioni Vercel contengono traffico, ma alcuni contatori restituiscono zero
            o dati mancanti. Le pageview possono essere ricostruite dalle fasce temporali;
            i visitatori unici non vengono sommati fra fasce o paesi, per evitare stime errate.
            Un trattino indica un valore non affidabile, non uno zero reale.
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Visitatori", snapshot.totals.visitors, "utenti unici stimati da Vercel"],
          ["Pageview", snapshot.totals.pageviews, snapshot.rangeLabel],
          ["Pagine / visitatore", viewsPerVisitor == null ? null : viewsPerVisitor.toFixed(2).replace(".", ","), "engagement medio"],
          ["Custom events", snapshot.totals.events, "azioni AN1 tracciate"],
          ["Utenti con eventi", snapshot.totals.eventVisitors, "visitatori che hanno attivato eventi"],
        ].map(([label, value, detail]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[#dce2df] bg-white p-4"
          >
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-[#173f35]">
              {value == null ? "—" : typeof value === "number" ? formatCount(value) : String(value)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#52615b]">{String(label)}</p>
            <p className="mt-1 text-[10px] leading-4 text-[#87938e]">{String(detail)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Traffic trend
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Visitatori e pageview
            </h2>
          </div>
          <p className="text-[10px] text-[#87938e]">{snapshot.rangeLabel}</p>
        </div>
        <MiniTrend snapshot={snapshot} />
      </section>

      <Funnel
        title="Acquisition → registrazione"
        subtitle="Misura quante persone passano dalla ricerca azienda alla richiesta aziendale effettivamente inviata."
        steps={snapshot.acquisitionFunnel}
      />

      <Bd18ReadinessPanel snapshot={snapshot} />

      <Funnel
        title="BD16 · Conversione calcolatore → RFQ"
        subtitle="Dal primo articolo inserito fino all’invio della RFQ. I rapporti confrontano operazioni nel periodo, non persone uniche o la stessa coorte. Non rappresentano abbandoni certi."
        steps={snapshot.rfqConversionFunnel}
      />

      <section aria-labelledby="international-rfq-funnel-title" className="rounded-3xl border border-[#dce2df] bg-white p-4 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">CALC-INT3E.4 · International RFQ</p>
        <h2 id="international-rfq-funnel-title" className="mt-1 text-xl font-semibold text-[#1d2824]">
          Calcolatore → distinta → copia → registrazione
        </h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-[#66736e]">
          Conteggi di eventi con consenso analytics, separati per lingua della distinta.
          Sono azioni aggregate, non utenti unici né coorti: non calcolare tassi di abbandono
          o conversioni individuali dividendo le colonne. La registrazione indica solo il clic
          verso il modulo, NON la creazione effettiva di un account.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#dce5e0]">
          <table className="w-full min-w-[570px] text-left text-xs">
            <thead className="bg-[#f2f7f4] text-[#345749]">
              <tr>
                <th scope="col" className="p-3">Lingua</th>
                <th scope="col" className="p-3 text-right">Aggiunte RFQ</th>
                <th scope="col" className="p-3 text-right">Distinte aperte</th>
                <th scope="col" className="p-3 text-right">Email copiate</th>
                <th scope="col" className="p-3 text-right">Clic registrazione</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.internationalRfqFunnel.map((row)=>(
                <tr key={row.locale} className="border-t border-[#e5ece8]">
                  <th scope="row" className="p-3 font-semibold uppercase text-[#173f35]">{row.locale}</th>
                  <td className="p-3 text-right tabular-nums">{formatCount(row.handoff)}</td>
                  <td className="p-3 text-right tabular-nums">{formatCount(row.billOpened)}</td>
                  <td className="p-3 text-right tabular-nums">{formatCount(row.emailCopied)}</td>
                  <td className="p-3 text-right tabular-nums">{formatCount(row.registrationClicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-6 text-[#66736e]">
          Sistema EN/USA e norma di origine sono categorie a basso numero di valori negli eventi Vercel.
          La sezione Paesi rappresenta traffico geografico aggregato, NON un&apos;attribuzione paese → RFQ.
          La distinta italiana continua ad avere la propria misurazione BD16; non è mischiata a questa.
        </p>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[#173f35]">Distinte copiate senza invio</h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-[#173f35]">{formatCount(snapshot.rfqBillCopies)}</p>
        <p className="mt-1 text-xs text-[#66736e]">Percorso alternativo gratuito: copia conclusa. Non è una RFQ creata o inviata.</p>
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">BD17 · Esperimento CTA</p>
        <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">Dalla distinta gratuita alla scelta dei fornitori</h2>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-[#66736e]">
          A/B 50/50 sul messaggio di accesso nella distinta pubblica. La variante resta nella singola
          scheda del browser. Visualizzazioni e clic si contano una volta per scheda e solo con consenso
          analytics valido. Il clic apre il login: non è un&apos;iscrizione, una RFQ completata o un utente unico.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([snapshot.bd17CtaExperiment.control, snapshot.bd17CtaExperiment.clarity]).map((arm) => (
            <div key={arm.label} className="rounded-2xl border border-[#e1e7e4] bg-[#f8faf9] p-4">
              <h3 className="text-sm font-bold text-[#173f35]">{arm.label}</h3>
              <p className="mt-2 text-xs text-[#52615b]">
                <strong className="tabular-nums">{formatCount(arm.views)}</strong> visualizzazioni qualificate ·
                <strong className="ml-1 tabular-nums">{formatCount(arm.clicks)}</strong> clic verso login
              </p>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-[#173f35]">
                {arm.clickRatePercent == null ? "—" : arm.clickRatePercent.toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%"}
              </p>
              <p className="mt-1 text-[11px] text-[#718078]">
                {arm.consistency === "invalid_counts"
                  ? "Conteggi non confrontabili: alcuni clic ricadono fuori dalla finestra delle visualizzazioni."
                  : "Rapporto clic / visualizzazioni qualificate; non conversione utenti unici."}
              </p>
            </div>
          ))}
        </div>
        <p role="status" className="mt-4 text-xs leading-5 text-[#52615b]">
          {snapshot.bd17CtaExperiment.sampleSufficient
            ? "Entrambe le versioni hanno almeno 100 visualizzazioni misurate. Risultato esplorativo: non prova statistica, nessun vincitore automatico."
            : "Campione insufficiente per confrontare le versioni: servono almeno 100 visualizzazioni misurate per variante. Nessuna conclusione sul vincitore."}
        </p>
        <p className="mt-1 text-[11px] text-[#87938e]">
          Il consenso può ridurre la copertura del test. I dati sono aggregati per eventi, senza identificatori condivisi
          tra login e RFQ; le differenze nel funnel BD16 non dimostrano abbandoni individuali.
        </p>
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6" aria-labelledby="calculator-funnel-heading">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">CALC-UX3.5 · Conversioni</p>
        <h2 id="calculator-funnel-heading" className="mt-2 text-xl font-semibold text-[#1d2824]">Dal calcolatore alla RFQ privata</h2>
        <p className="mt-2 text-xs leading-5 text-[#66736e]">
          Eventi aggregati con consenso analytics, per tutte le lingue. I clic su registrazione e login
          non rappresentano account creati; le RFQ private create non equivalgono a richieste inviate ai fornitori.
          Le azioni possono ripetersi e non descrivono utenti unici né un percorso individuale.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.calculatorFunnel.map((step) => (
            <div key={step.key} className="rounded-xl border border-[#dfe8e2] bg-[#f8faf9] p-4">
              <p className="text-2xl font-bold tabular-nums text-[#174b37]">{formatCount(step.value)}</p>
              <p className="mt-1 text-xs font-semibold text-[#52615b]">{step.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[#dae5dd] bg-[#f8faf9] p-4" role="status">
          <p className="text-xs font-bold text-[#174b37]">
            Qualità dati: {snapshot.calculatorFunnelQuality.state === "unavailable" ? "da verificare"
              : snapshot.calculatorFunnelQuality.state === "awaiting_events" ? "in attesa di eventi"
              : snapshot.calculatorFunnelQuality.state === "partial" ? "raccolta parziale" : "tutte le fasi osservate"}
          </p>
          <p className="mt-1 text-xs text-[#52615b]">
            {snapshot.calculatorFunnelQuality.observedSteps} / {snapshot.calculatorFunnelQuality.totalSteps} fasi con eventi osservati.
            {" "}{snapshot.calculatorFunnelQuality.note}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><p className="text-xl font-bold tabular-nums text-[#174b37]">{formatCount(snapshot.calculatorFunnelQuality.registrationAccounts)}</p>
              <p className="text-xs text-[#52615b]">Account creati · sito intero</p></div>
            <div><p className="text-xl font-bold tabular-nums text-[#174b37]">{formatCount(snapshot.calculatorFunnelQuality.registrationSubmissions)}</p>
              <p className="text-xs text-[#52615b]">Registrazioni inviate · sito intero</p></div>
          </div>
          <p className="mt-2 text-xs text-[#66736e]">Metriche indipendenti, non attribuite al calcolatore. Attivazioni aziendali approvate: non disponibili in questa fonte; verificare nel ledger registrazioni.</p>
        </div>
        <p className="mt-3 text-xs text-[#718078]">
          Fonte: Vercel Web Analytics · {snapshot.rangeLabel.toLowerCase()}. Nessun prezzo, nominativo o identificativo RFQ raccolto.
          I conteggi zero possono indicare assenza di consenso o traffico, non necessariamente assenza di attività.
        </p>
      </section>

      <Funnel
        title="Utility → RFQ Hub"
        subtitle="Misura il percorso dalle utility concrete fino all'avvio e dispatch di una RFQ multi-fornitore."
        steps={snapshot.activationFunnel}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        <RankedList title="Pagine più viste" rows={snapshot.topPages} />
        <RankedList title="Referrer" rows={snapshot.referrers} />
        <RankedList title="Paesi" rows={snapshot.countries} />
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Product signals
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Eventi AN1
            </h2>
          </div>
          <p className="text-[10px] text-[#87938e]">
            Nessun payload contiene email, P.IVA, nomi azienda, prezzi o testo RFQ.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#e1e7e4]">
          <table className="min-w-[620px] w-full text-left text-xs">
            <thead className="bg-[#f8faf9] text-[#66736e]">
              <tr>
                <th className="px-4 py-3 font-semibold">Evento</th>
                <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                <th className="px-4 py-3 text-right font-semibold">Visitatori</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[#87938e]">
                    Nessun custom event ancora raccolto nel periodo selezionato.
                  </td>
                </tr>
              ) : (
                snapshot.events.map((event) => (
                  <tr key={event.name} className="border-t border-[#eef2f0]">
                    <td className="px-4 py-3 font-mono text-[11px] font-semibold text-[#43524c]">
                      {event.name}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCount(event.count)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#66736e]">
                      {formatCount(event.visitors)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
          Lettura corretta
        </p>
        <p className="mt-2 text-sm leading-6 text-[#52615b]">
          Web Analytics è near real-time, ma non va usato come ledger transazionale:
          per ordini, RFQ, claim e registrazioni i sistemi canonici restano Supabase e
          i relativi audit ledger. Questa dashboard serve a misurare discovery,
          engagement e conversione prodotto.
        </p>
      </section>
    </div>
  );
}
