import { redirect } from "next/navigation";

import { OperationalAlertActions } from "./operational-alert-actions";
import { OperationalAlertsRefreshButton } from "./refresh-button";
import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { appRoutes } from "@/lib/routes";
import { parseOperationalAlertRows, parseOperationalAlertSummary } from "@/lib/operational-alert-status";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

type OperationalAlertAudit = {
  id: number;
  alert_id: number;
  action: string;
  previous_status: string;
  new_status: string;
  actor_user_id: string | null;
  note: string | null;
  occurred_at: string;
};

function statusLabel(status: string) {
  if (status === "open") return "Aperto";
  if (status === "acknowledged") return "In carico";
  if (status === "resolved") return "Risolto";
  return status;
}

export default async function OperationalAlertsPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!configured) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-slate-950">Alert operativi</h1>
          <p className="mt-2 text-sm text-slate-500">Disponibili solo con workspace Supabase connesso.</p>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw new Error("operational_alerts_auth_unavailable");
  if (!user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id,role,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) throw new Error("operational_alerts_membership_unavailable");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership?.organization_id) redirect("/onboarding");

  const organizationId = membership.organization_id as string;
  const canManage = membership.role === "admin";
  // Failure in either RPC must never be presented as "everything is healthy".
  const [alertsResult, summaryResult] = await Promise.allSettled([
    supabase.rpc("p1_operational_alerts_read", {
      p_organization_id: organizationId,
      p_status: null,
      p_limit: 100,
      p_offset: 0,
    }),
    supabase.rpc("p1_operational_alerts_summary", {
      p_organization_id: organizationId,
    }),
  ]);

  const alerts =
    alertsResult.status === "fulfilled" && !alertsResult.value.error
      ? parseOperationalAlertRows(alertsResult.value.data)
      : null;
  const summary =
    summaryResult.status === "fulfilled" && !summaryResult.value.error
      ? parseOperationalAlertSummary(summaryResult.value.data)
      : null;
  const inconsistentEmptyList =
    alerts?.length === 0 &&
    summary !== null &&
    summary.open_count + summary.acknowledged_count + summary.resolved_count > 0;

  if (!alerts || !summary || inconsistentEmptyList) {
    return (
      <div className="mx-auto max-w-6xl">
        <section role="alert" className="rounded-3xl border border-[#ead7aa] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a6520]">Verifica non disponibile</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Impossibile verificare gli alert operativi
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736e]">
            Non è stato possibile caricare uno stato attendibile. Questo non significa che
            i controlli siano regolari o che non esistano avvisi.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <OperationalAlertsRefreshButton />
            <a href={appRoutes.home} className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">
              Torna al workspace
            </a>
          </div>
        </section>
      </div>
    );
  }

  // A distinct admin-scoped RPC reads history; failure must not look like an empty history.
  const auditResponse = canManage
    ? await supabase.rpc("p1_operational_alert_audit_read", {
        p_organization_id: organizationId,
        p_alert_id: null,
        p_limit: 100,
        p_offset: 0,
      }).then((result) => result).catch(() => null)
    : null;
  const auditData = auditResponse && !auditResponse.error ? auditResponse.data : null;
  const auditRows = Array.isArray(auditData) ? (auditData as OperationalAlertAudit[]) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Controllo operativo</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Alert operativi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Regressioni rilevate automaticamente sui controlli di remediation e recovery. Gli alert aperti richiedono presa in carico o risoluzione esplicita.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={summary.needs_attention ? "red" : summary.active_count > 0 ? "amber" : "green"}>
              {summary.needs_attention ? "Richiede attenzione" : summary.active_count > 0 ? "Alert attivi" : "Nessun alert attivo"}
            </Badge>
            <OperationalAlertsRefreshButton label="Aggiorna" />
          </div>
        </div>

        <p className="mt-4 text-xs text-[#66736e]">
          Dati consultati: {formatDate(summary.generated_at)} · Ultimo alert registrato: {formatDate(summary.last_alert_at)}.
          La consultazione non certifica l'ultima esecuzione del controllo automatico.
        </p>

        {!canManage ? (
          <p className="mt-4 rounded-xl border border-[#dce5e2] bg-[#f2f6f4] px-4 py-3 text-sm text-[#47554f]">
            Consultazione in sola lettura. Presa in carico e risoluzione sono riservate agli amministratori aziendali.
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Aperti", summary.open_count],
            ["In carico", summary.acknowledged_count],
            ["Critici aperti", summary.critical_open_count],
            ["Risolti", summary.resolved_count],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-2xl font-semibold text-slate-950">{Number(value).toLocaleString("it-IT")}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {alerts.length === 0 ? (
        <FirstUseEmptyState
          eyebrow="Nessun alert registrato"
          title="Non risultano alert operativi per questa azienda"
          description="La lettura è riuscita e non risultano avvisi nel registro. Questo elenco copre i controlli operativi disponibili, non la salute complessiva della piattaforma."
          primaryAction={{
            href: appRoutes.operations.review,
            label: "Apri Correzioni",
          }}
          secondaryAction={{
            href: appRoutes.home,
            label: "Torna al workspace",
          }}
          note="Gli alert vengono creati quando un controllo monitorato rileva una regressione. Non tutti i processi sono ancora coperti."
        />
      ) : (
        <section className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={alert.severity === "critical" ? "red" : "amber"}>
                      {alert.severity === "critical" ? "Critico" : "Warning"}
                    </Badge>
                    <Badge tone={alert.status === "resolved" ? "green" : alert.status === "acknowledged" ? "blue" : "red"}>
                      {statusLabel(alert.status)}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-slate-950">{alert.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{alert.summary}</p>
                </div>
                <div className="shrink-0 text-left text-xs text-slate-500 sm:text-right">
                  <p>{alert.occurrence_count} {alert.occurrence_count === 1 ? "occorrenza" : "occorrenze"}</p>
                  <p className="mt-1">Ultima: {formatDate(alert.last_seen_at)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <p>Prima rilevazione: <span className="font-medium text-slate-700">{formatDate(alert.first_seen_at)}</span></p>
                <p>Presa in carico: <span className="font-medium text-slate-700">{formatDate(alert.acknowledged_at)}</span></p>
                <p>Risoluzione: <span className="font-medium text-slate-700">{formatDate(alert.resolved_at)}</span></p>
              </div>

              {canManage ? <OperationalAlertActions alertId={alert.id} status={alert.status} /> : null}
            </Card>
          ))}
        </section>
      )}

      {canManage ? (
        <section className="rounded-3xl border border-[#dce5e2] bg-white p-6 shadow-sm sm:p-8" aria-label="Storico operazioni sugli alert">
          <h2 className="text-lg font-semibold text-[#1d2824]">Storico operazioni</h2>
          <p className="mt-2 text-sm text-[#66736e]">
            Registro delle transizioni degli alert aziendali, consultabile solo dagli amministratori.
            Sono mostrate fino alle ultime 100 operazioni.
          </p>
          {auditRows === null ? (
            <div role="alert" className="mt-4 rounded-xl border border-[#ead7aa] bg-[#fffaf0] p-4 text-sm text-[#785c27]">
              Impossibile verificare lo storico delle operazioni. Aggiorna per riprovare.
            </div>
          ) : auditRows.length === 0 ? (
            <p className="mt-4 text-sm text-[#66736e]">Nessuna transizione registrata da quando è attivo lo storico.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {auditRows.map((event) => (
                <li key={event.id} className="rounded-xl border border-[#dce5e2] bg-[#f8faf9] p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#173f35]">Alert #{event.alert_id} · {statusLabel(event.previous_status)} → {statusLabel(event.new_status)}</span>
                    <time className="text-xs text-[#66736e]">{formatDate(event.occurred_at)}</time>
                  </div>
                  <p className="mt-1 text-xs text-[#66736e]">Responsabile: {event.actor_user_id ? `Utente ${event.actor_user_id.slice(0, 8)}…` : "Processo automatico"}</p>
                  {event.note ? <p className="mt-2 text-sm text-[#47554f]">{event.note}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}
