import "server-only";

import {
  archiveMetrics,
  commercialRows as demoCommercialRows,
  conversations as demoConversations,
  reviewFlags as demoReviewFlags,
  type CommercialRow,
  type ItemRole,
} from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

export type DataMode = "demo" | "live" | "awaiting_assignment";

export type DashboardData = {
  mode: DataMode;
  metrics: typeof archiveMetrics;
  recent: CommercialRow[];
};

export type ExplorerFilters = {
  q?: string;
  role?: ItemRole | "all";
  grade?: string;
  standard?: string;
  page?: number;
};

export type ExplorerData = {
  mode: DataMode;
  rows: CommercialRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ConversationData = {
  mode: DataMode;
  subject: string;
  company: string;
  status: string;
  events: Array<{
    role: ItemRole;
    at: string;
    title: string;
    product: string;
    detail: string;
    source: string;
    confidence: number;
  }>;
};

export type ReviewItem = {
  id: string;
  subject: string;
  product: string;
  inferred: string;
  status: string;
  source: string;
  confidence: number;
  reviewStatus: "pending" | "confirmed" | "corrected";
};

function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

function decimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString("it-IT", { maximumFractionDigits: 3 });
}

function formatProduct(row: Record<string, unknown>) {
  const length = decimal(row.length_mm);
  const suffix = length ? ` x ${length}` : "";

  if (row.product_type === "round_tube") {
    const od = decimal(row.outer_diameter_mm) ?? "?";
    const thickness = decimal(row.thickness_mm) ?? "?";
    return `Tondo ${od} x ${thickness}${suffix} mm`;
  }

  if (row.product_type === "square_tube") {
    const width = decimal(row.width_mm) ?? "?";
    const height = decimal(row.height_mm) ?? width;
    const thickness = decimal(row.thickness_mm) ?? "?";
    return `Quadro ${width} x ${height} x ${thickness}${suffix} mm`;
  }

  if (row.product_type === "rectangular_tube") {
    const width = decimal(row.width_mm) ?? "?";
    const height = decimal(row.height_mm) ?? "?";
    const thickness = decimal(row.thickness_mm) ?? "?";
    return `Rettangolare ${width} x ${height} x ${thickness}${suffix} mm`;
  }

  return "Prodotto non classificato";
}

function formatPrice(row: Record<string, unknown>) {
  if (row.price_value === null || row.price_value === undefined) return undefined;
  const value = Number(row.price_value).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const currency = row.currency === "EUR" ? "€" : String(row.currency ?? "");
  const unit = row.price_unit === "M" ? "/ m" : row.price_unit === "T" ? "/ t" : "";
  return `${currency} ${value} ${unit}`.trim();
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().replace(/,/g, ".").replace(/\s*x\s*/g, "x");
}

function nestedThread(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value as Record<string, unknown>;
}

function mapObservation(row: Record<string, unknown>): CommercialRow {
  const thread = nestedThread(row.commercial_threads);
  return {
    id: String(row.id),
    conversationId: String(row.thread_id),
    date: formatDate(thread?.last_activity_at),
    company: String(thread?.subject ?? row.source_filename ?? "Thread archivio"),
    product: formatProduct(row),
    grade: String(row.grade ?? "—"),
    standard: String(row.standard ?? "—"),
    role: row.item_role as ItemRole,
    price: formatPrice(row),
    availability:
      row.availability_status === "stock" || row.availability_status === "production"
        ? row.availability_status
        : "unknown",
    confidence: Number(row.confidence ?? 0),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!isConfigured()) {
    return { mode: "demo", metrics: archiveMetrics, recent: demoCommercialRows.slice(0, 4) };
  }

  const supabase = await createClient();
  const { data: metricRows, error: metricError } = await supabase.rpc(
    "commercial_dashboard_metrics",
  );

  if (metricError || !metricRows?.length) {
    return {
      mode: "awaiting_assignment",
      metrics: archiveMetrics,
      recent: demoCommercialRows.slice(0, 4),
    };
  }

  const metric = metricRows[0] as Record<string, unknown>;
  const { data: recentRows } = await supabase
    .from("commercial_observations")
    .select(
      "id,thread_id,item_role,product_type,grade,standard,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,price_value,price_unit,currency,availability_status,confidence,source_filename,commercial_threads(subject,last_activity_at)",
    )
    .order("id", { ascending: false })
    .limit(4);

  return {
    mode: "live",
    metrics: {
      emails: Number(metric.emails ?? 0),
      threads: Number(metric.threads ?? 0),
      messages: Number(metric.messages ?? 0),
      observations: Number(metric.observations ?? 0),
      requested: Number(metric.requested ?? 0),
      offered: Number(metric.offered ?? 0),
      ordered: Number(metric.ordered ?? 0),
      delivered: Number(metric.delivered ?? 0),
      reviewFlags: Number(metric.review_pending ?? 0),
      avgConfidence: Number(metric.avg_confidence ?? 0) * 100,
    },
    recent: (recentRows ?? []).map((row) => mapObservation(row as Record<string, unknown>)),
  };
}

export async function getExplorerData(filters: ExplorerFilters): Promise<ExplorerData> {
  const pageSize = 50;
  const page = Math.max(1, filters.page ?? 1);

  if (!isConfigured()) {
    return {
      mode: "demo",
      rows: demoCommercialRows,
      total: demoCommercialRows.length,
      page: 1,
      pageSize,
    };
  }

  const supabase = await createClient();
  let query = supabase
    .from("commercial_observations")
    .select(
      "id,thread_id,item_role,product_type,grade,standard,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,price_value,price_unit,currency,availability_status,confidence,source_filename,commercial_threads(subject,last_activity_at)",
      { count: "exact" },
    )
    .order("id", { ascending: false });

  if (filters.role && filters.role !== "all") query = query.eq("item_role", filters.role);
  if (filters.grade && filters.grade !== "all") query = query.eq("grade", filters.grade);
  if (filters.standard && filters.standard !== "all") query = query.eq("standard", filters.standard);
  if (filters.q?.trim()) query = query.ilike("search_text", `%${normalizeSearch(filters.q)}%`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await query.range(from, to);

  if (error) {
    return { mode: "awaiting_assignment", rows: [], total: 0, page, pageSize };
  }

  if ((count ?? 0) === 0) {
    const { count: datasetCount } = await supabase
      .from("commercial_datasets")
      .select("id", { count: "exact", head: true });
    if (!datasetCount) {
      return { mode: "awaiting_assignment", rows: [], total: 0, page, pageSize };
    }
  }

  return {
    mode: "live",
    rows: (data ?? []).map((row) => mapObservation(row as Record<string, unknown>)),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getConversationData(id: string): Promise<ConversationData | null> {
  if (!isConfigured()) {
    const demo = demoConversations[id as keyof typeof demoConversations];
    return demo ? { mode: "demo", ...demo } : null;
  }

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("commercial_threads")
    .select("id,subject,classification,last_activity_at")
    .eq("id", id)
    .maybeSingle();

  if (!thread) return null;

  const { data: observations } = await supabase
    .from("commercial_observations")
    .select(
      "id,item_role,direction,product_type,grade,standard,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,quantity,quantity_unit,price_value,price_unit,currency,availability_status,source_text,confidence",
    )
    .eq("thread_id", id)
    .order("id", { ascending: true });

  return {
    mode: "live",
    subject: thread.subject ?? "Thread commerciale",
    company: "Archivio commerciale",
    status: thread.classification ?? "open",
    events: (observations ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      const details = [
        row.grade,
        row.standard,
        row.quantity && row.quantity_unit ? `${decimal(row.quantity)} ${row.quantity_unit}` : null,
        formatPrice(row),
        row.availability_status,
      ].filter(Boolean);
      const role = row.item_role as ItemRole;
      return {
        role,
        at: `${formatDate(thread.last_activity_at)} · ${String(row.direction ?? "")}`,
        title:
          role === "requested"
            ? "Richiesta"
            : role === "offered"
              ? "Offerta"
              : role === "ordered"
                ? "Ordine"
                : "Consegna",
        product: formatProduct(row),
        detail: details.join(" · ") || "—",
        source: String(row.source_text ?? "Fonte non disponibile"),
        confidence: Number(row.confidence ?? 0),
      };
    }),
  };
}

export async function getReviewItems(): Promise<{ mode: DataMode; items: ReviewItem[] }> {
  if (!isConfigured()) {
    return {
      mode: "demo",
      items: demoReviewFlags.map((flag) => ({ ...flag, reviewStatus: "pending" as const })),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commercial_review_queue")
    .select(
      "id,reason,severity,source_text,status,commercial_threads(subject),commercial_observations(product_type,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,availability_status,confidence)",
    )
    .order("id", { ascending: true });

  if (error || !data?.length) {
    const { count } = await supabase
      .from("commercial_datasets")
      .select("id", { count: "exact", head: true });
    if (!count) return { mode: "awaiting_assignment", items: [] };
  }

  return {
    mode: "live",
    items: (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      const thread = nestedThread(row.commercial_threads);
      const observation = nestedThread(row.commercial_observations) ?? {};
      return {
        id: String(row.id),
        subject: String(thread?.subject ?? "Thread commerciale"),
        product: formatProduct(observation),
        inferred: String(row.reason ?? "review"),
        status: String(observation.availability_status ?? "unknown"),
        source: String(row.source_text ?? "Fonte non disponibile"),
        confidence: Number(observation.confidence ?? 0),
        reviewStatus: (row.status as ReviewItem["reviewStatus"]) ?? "pending",
      };
    }),
  };
}
