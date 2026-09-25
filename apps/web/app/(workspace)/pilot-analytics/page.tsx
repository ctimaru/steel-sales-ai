import { redirect } from "next/navigation";

import { HumanTimeEvidenceForm } from "@/components/human-time-evidence-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type UsageSummary = {
  weekly_active_users: number;
  active_users: number;
  searches: number;
  search_success_rate: number | null;
  product_views: number;
  company_views: number;
  price_history_views: number;
  evidence_opens: number;
  review_views: number;
  corrections_completed: number;
  uploads_completed: number;
  event_count: number;
};

type Criterion = { target: number; actual: number | null; passed: boolean };

type ActivePilot = {
  id: string;
  status: "active";
  label: string;
  started_at: string;
  ended_at: string | null;
  baseline_event_count: number;
  protocol_version: string;
};

type Checkpoint = {
  checkpoint_ready: boolean;
  human_evidence: {
    sample_count: number;
    task_type_count: number;
    faster_count: number;
    same_count: number;
    slower_count: number;
    median_steel_sales_seconds: number | null;
    median_previous_method_seconds: number | null;
    median_improvement_percent: number | null;
    minimum_samples_target: number;
    minimum_task_types_target: number;
    evidence_sufficient: boolean;
  };
};

type Readiness = {
  metrics: {
    active_days: number;
    searches: number;
    search_success_rate: number | null;
    core_surface_count: number;
    successful_uploads: number;
    event_count: number;
    avg_search_duration_ms: number | null;
  };
  criteria: {
    active_days: Criterion;
    searches: Criterion;
    search_success_rate: Criterion;
    core_surface_count: Criterion;
    successful_uploads: Criterion;
  };
  criteria_passed_count: number;
  criteria_total: number;
  pilot_evidence_ready: boolean;
};

function percent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function integer(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("it-IT");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

const criteriaLabels: Record<keyof Readiness["criteria"], { label: string; help: string; format?: "percent" }> = {
  active_days: { label: "Giorni attivi", help: "Uso reale distribuito su più giornate, non una singola sessione di test." },
  searches: { label: "Ricerche completate", help: "Volume minimo per valutare il comportamento della ricerca commerciale." },
  search_success_rate: { label: "Ricerche con risultato", help: "Quota di ricerche che restituiscono almeno un risultato.", format: "percent" },
  core_surface_count: { label: "Superfici core utilizzate", help: "Product, Company, Price History, Evidence e Review." },
  successful_uploads: { label: "Import riusciti", help: "Almeno un ciclo reale di acquisizione dati completato con successo." },
};

export default async function PilotAnalyticsPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!configured) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-slate-950">Pilot analytics</h1>
          <p className="mt-2 text-sm text-slate-500">Disponibile quando il workspace è connesso a Supabase.</p>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership?.organization_id) redirect("/onboarding");

  const organizationId = membership.organization_id as string;
  const { data: pilotData, error: pilotError } = await supabase.rpc("p1_active_pilot_run", {
    p_organization_id: organizationId,
  });

  if (pilotError) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card className="border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-semibold text-rose-950">Pilot analytics non disponibile</h1>
          <p className="mt-2 text-sm text-rose-800">Il marker di pilot controllato non è leggibile dal workspace.</p>
        </Card>
      </div>
    );
  }

  const pilot = (pilotData ?? null) as ActivePilot | null;
  if (!pilot) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card className="border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-950">Pilot controllato non avviato</h1>
          <p className="mt-2 text-sm text-amber-800">
            La telemetria è pronta, ma manca ancora un kickoff ufficiale per delimitare l'evidenza reale.
          </p>
        </Card>
      </div>
    );
  }

  const pilotStartedAt = new Date(pilot.started_at);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sincePilot = pilot.started_at;
  const since7 = (pilotStartedAt > sevenDaysAgo ? pilotStartedAt : sevenDaysAgo).toISOString();

  const [
    { data: summaryPilotData, error: summaryPilotError },
    { data: summary7Data, error: summary7Error },
    { data: readinessData, error: readinessError },
    { data: checkpointData, error: checkpointError },
  ] = await Promise.all([
    supabase.rpc("p1_pilot_usage_summary", { p_organization_id: organizationId, p_since: sincePilot }),
    supabase.rpc("p1_pilot_usage_summary", { p_organization_id: organizationId, p_since: since7 }),
    supabase.rpc("p1_pilot_exit_readiness", { p_organization_id: organizationId, p_since: sincePilot }),
    supabase.rpc("p1_pilot_checkpoint", { p_organization_id: organizationId }),
  ]);

  if (summaryPilotError || summary7Error || readinessError || checkpointError || !summaryPilotData || !summary7Data || !readinessData || !checkpointData) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card className="border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-semibold text-rose-950">Pilot analytics non disponibile</h1>
          <p className="mt-2 text-sm text-rose-800">Il read model P1.12 non è al momento leggibile dal workspace.</p>
        </Card>
      </div>
    );
  }

  const summaryPilot = summaryPilotData as UsageSummary;
  const summary7 = summary7Data as UsageSummary;
  const readiness = readinessData as Readiness;
  const checkpoint = checkpointData as Checkpoint;
  const noPilotData = summaryPilot.event_count === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">P1.12 · Pilot Analytics</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Il pilot sta producendo evidenza sufficiente?
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Misuriamo utilizzo reale, qualità della ricerca e copertura del workflow commerciale.
              La telemetria non salva query, nomi cliente, prezzi o contenuto dei documenti.
            </p>
          </div>
          <Badge tone={readiness.pilot_evidence_ready ? "green" : noPilotData ? "neutral" : "amber"}>
            {readiness.pilot_evidence_ready
              ? "Evidenza pilot sufficiente"
              : noPilotData
                ? "Pilot attivo · raccolta avviata"
                : String(readiness.criteria_passed_count) + "/" + String(readiness.criteria_total) + " criteri"}
          </Badge>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["WAU", summary7.weekly_active_users, "utenti attivi negli ultimi 7 giorni"],
            ["Ricerche · dal kickoff", summaryPilot.searches, "ricerche commerciali completate"],
            ["Successo ricerca", percent(summaryPilot.search_success_rate), "ricerche con almeno un risultato"],
            ["Eventi pilot", summaryPilot.event_count, "azioni misurate dal kickoff"],
          ].map(([label, value, help]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{String(value)}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{help}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="border-indigo-100 bg-indigo-50/60 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-950">Pilot controllato attivo</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Avviato il {formatDateTime(pilot.started_at)}. Tutti i KPI di questa pagina sono calcolati
              esclusivamente dagli eventi raccolti dopo questo kickoff.
            </p>
          </div>
          <Badge tone="blue">{pilot.protocol_version}</Badge>
        </div>
        {noPilotData ? (
          <p className="mt-4 rounded-xl bg-white/80 p-3 text-xs leading-5 text-indigo-800">
            Nessuna attività reale ancora registrata dopo il kickoff. È corretto: non vengono inseriti eventi sintetici.
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Protocollo operativo del pilot</h2>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-900">Lavora normalmente.</strong><p className="mt-1 text-xs leading-5">Usa Steel Sales AI solo quando serve davvero nel lavoro commerciale.</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-900">Non inseguire i KPI.</strong><p className="mt-1 text-xs leading-5">Le soglie servono a valutare il pilot, non a generare click artificiali.</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-900">Correggi solo casi reali.</strong><p className="mt-1 text-xs leading-5">Review e correzioni devono riflettere problemi effettivamente incontrati.</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-900">Annota il tempo umano.</strong><p className="mt-1 text-xs leading-5">Per alcuni casi confronta mentalmente quanto avresti impiegato con email/Excel.</p></div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Tempo umano · registra solo casi reali</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Inserisci il confronto subito dopo un'attività concreta. Non serve farlo ogni volta:
              per il checkpoint bastano almeno 3 casi distribuiti su 2 tipi di attività.
            </p>
          </CardHeader>
          <CardContent>
            <HumanTimeEvidenceForm />
          </CardContent>
        </Card>

        <Card className={checkpoint.human_evidence.evidence_sufficient ? "border-emerald-200" : "border-slate-200"}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">Evidenza umana raccolta</h2>
              <Badge tone={checkpoint.human_evidence.evidence_sufficient ? "green" : "neutral"}>
                {checkpoint.human_evidence.sample_count}/{checkpoint.human_evidence.minimum_samples_target} casi
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xl font-semibold text-slate-950">{checkpoint.human_evidence.task_type_count}</p>
                <p className="text-xs text-slate-500">tipi di attività / {checkpoint.human_evidence.minimum_task_types_target}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xl font-semibold text-slate-950">
                  {checkpoint.human_evidence.median_improvement_percent === null ? "—" : checkpoint.human_evidence.median_improvement_percent.toLocaleString("it-IT") + "%"}
                </p>
                <p className="text-xs text-slate-500">differenza mediana stimata</p>
              </div>
            </div>
            <p>
              Più veloce: <strong className="text-slate-900">{checkpoint.human_evidence.faster_count}</strong>
              {" · "}uguale: <strong className="text-slate-900">{checkpoint.human_evidence.same_count}</strong>
              {" · "}più lento: <strong className="text-slate-900">{checkpoint.human_evidence.slower_count}</strong>
            </p>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Questi tempi sono stime auto-riferite: servono come evidenza pratica del pilot, non come misurazione causale precisa.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-950">Criteri P1.12</h2>
          <p className="mt-1 text-sm text-slate-500">
            Soglie minime per considerare il pilot quantitativamente informativo, non un test occasionale.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-5">
          {(Object.entries(readiness.criteria) as Array<[keyof Readiness["criteria"], Criterion]>).map(([key, criterion]) => {
            const meta = criteriaLabels[key];
            const actual = meta.format === "percent" ? percent(criterion.actual) : integer(criterion.actual);
            const target = meta.format === "percent" ? percent(criterion.target) : integer(criterion.target);
            return (
              <Card key={key} className={criterion.passed ? "border-emerald-200" : "border-slate-200"}>
                <CardContent className="p-4">
                  <Badge tone={criterion.passed ? "green" : "neutral"}>
                    {criterion.passed ? "Raggiunto" : "Da raggiungere"}
                  </Badge>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{meta.label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {actual} <span className="text-xs font-medium text-slate-400">/ {target}</span>
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{meta.help}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Uso delle superfici commerciali · dal kickoff</h2>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ["Product 360", summaryPilot.product_views],
              ["Company 360", summaryPilot.company_views],
              ["Price History", summaryPilot.price_history_views],
              ["Evidenze originali", summaryPilot.evidence_opens],
              ["Correzioni aperte", summaryPilot.review_views],
              ["Correzioni completate", summaryPilot.corrections_completed],
              ["Import completati", summaryPilot.uploads_completed],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-950">{integer(Number(value))}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Interpretazione dell'exit P1</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
            <p>
              <strong className="text-slate-900">Readiness quantitativa:</strong>{" "}
              {readiness.pilot_evidence_ready
                ? "i cinque criteri minimi risultano soddisfatti."
                : "sono soddisfatti " + String(readiness.criteria_passed_count) + " criteri su " + String(readiness.criteria_total) + "."}
            </p>
            <p>
              <strong className="text-slate-900">Checkpoint complessivo:</strong>{" "}
              {checkpoint.checkpoint_ready
                ? "readiness quantitativa ed evidenza umana risultano entrambe sufficienti."
                : "non ancora pronto: devono risultare sufficienti sia i KPI automatici sia l'evidenza umana."}
            </p>
            <p>
              <strong className="text-slate-900">Latenza tecnica ricerca:</strong>{" "}
              {readiness.metrics.avg_search_duration_ms === null
                ? "nessun campione ancora disponibile."
                : integer(readiness.metrics.avg_search_duration_ms) + " ms medi."}
            </p>
            <p>
              <strong className="text-slate-900">Tempo umano per trovare un'informazione:</strong>{" "}
              resta una evidenza separata. La latenza tecnica non viene usata come proxy del tempo realmente
              risparmiato dal commerciale.
            </p>
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              La chiusura P1 richiederà sia criteri quantitativi pilot sufficienti sia una breve
              acceptance umana sul time-to-answer rispetto al metodo precedente.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
