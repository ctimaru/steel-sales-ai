import { redirect } from "next/navigation";

import { OperationalAlertActions } from "./operational-alert-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type OperationalAlert = {
  id: number;
  alert_type: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  is_active: boolean;
  needs_attention: boolean;
};

type AlertSummary = {
  open_count: number;
  acknowledged_count: number;
  resolved_count: number;
  critical_open_count: number;
  active_count: number;
  needs_attention: boolean;
  last_alert_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

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
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership?.organization_id) redirect("/onboarding");

  const organizationId = membership.organization_id as string;
  const [{ data: alertsData, error: alertsError }, { data: summaryData, error: summaryError }] =
    await Promise.all([
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

  const alerts = (alertsError ? [] : alertsData ?? []) as OperationalAlert[];
  const summary = (summaryError || !summaryData
    ? {
        open_count: 0,
        acknowledged_count: 0,
        resolved_count: 0,
        critical_open_count: 0,
        active_count: 0,
        needs_attention: false,
        last_alert_at: null,
      }
    : summaryData) as AlertSummary;

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
          <Badge tone={summary.needs_attention ? "red" : "green"}>
            {summary.needs_attention ? "Richiede attenzione" : "Controlli regolari"}
          </Badge>
        </div>

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
        <Card className="p-8 text-center">
          <p className="text-base font-semibold text-slate-950">Nessun alert operativo</p>
          <p className="mt-2 text-sm text-slate-500">
            Il regression guard non ha rilevato anomalie rispetto alla baseline controllata.
          </p>
        </Card>
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

              <OperationalAlertActions alertId={alert.id} status={alert.status} />
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
