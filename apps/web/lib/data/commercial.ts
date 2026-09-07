import {
  archiveMetrics,
  commercialRows,
  conversations,
  reviewFlags,
  type CommercialRow,
  type ItemRole,
} from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

export type DataMode = "demo" | "live" | "empty";

export type DashboardMetrics = typeof archiveMetrics;

export type DashboardData = {
  mode: DataMode;
  metrics: DashboardMetrics;
  recent: CommercialRow[];
};

export type ConversationEvent = {
  role: ItemRole;
  at: string;
  title: string;
  product: string;
  detail: string;
  source: string;
  confidence: number;
};

export type ConversationDetail = {
  subject: string;
  company: string;
  status: string;
  events: ConversationEvent[];
};

export type ReviewFlagView = {
  id: string;
  subject: string;
  product: string;
  inferred: string;
  availability: string;
  source: string;
  confidence: number;
  reviewStatus: "pending" | "confirmed" | "corrected";
};

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

function emptyMetrics(): DashboardMetrics {
  return {
    emails: 0,
    threads: 0,
    messages: 0,
    observations: 0,
    requested: 0,
    offered: 0,
    ordered: 0,
    delivered: 0,
    reviewFlags: 0,
    avgConfidence: 0,
  };
}

function numberLabel(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(numeric);
}

function productLabel(row: Record<string, unknown>) {
  const od = numberLabel(row.outer_diameter_mm);
  const width = numberLabel(row.width_mm);
  const height = numberLabel(row.height_mm);
  const thickness = numberLabel(row.thickness_mm);
  const length = numberLabel(row.length_mm);

  const dimensions: string[] = [];
  let prefix = "Prodotto";

  if (row.product_type === "round_tube") {
    prefix = "Tondo";
    if (od) dimensions.push(od);
    if (thickness) dimensions.push(thickness);
  } else if (row.product_type === "square_tube") {
    prefix = "Quadro";
    if (width) dimensions.push(width);
    if (height) dimensions.push(height);
    if (thickness) dimensions.push(thickness);
  } else if (row.product_type === "rectangular_tube") {
    prefix = "Rettangolare";
    if (width) dimensions.push(width);
    if (height) dimensions.push(height);
    if (thickness) dimensions.push(thickness);
  }

  if (length) dimensions.push(length);
  return dimensions.length ? `${prefix} ${dimensions.join(" x ")} mm` : prefix;
}

function priceLabel(row: Record<string, unknown>) {
  const value = numberLabel(row.price_value);
  if (!value) return undefined;

  const currency = row.currency === "EUR" ? "€" : String(row.currency ?? "").trim();
  const unit = row.price_unit === "M" ? " / m" : row.price_unit === "T" ? " / t" : "";
  return `${currency ? `${currency} ` : ""}${value}${unit}`;
}

function dateLabel(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

async function fetchAllObservations() {
  const supabase = await createClient();
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("commercial_observations")
      .select(
        "id,thread_id,item_role,role_method,direction,product_type,grade,standard,material_number,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,quantity,quantity_unit,price_value,price_unit,currency,discount_percentage,availability_status,source_filename,source_text,source_clause,confidence,flags,source_extraction_id",
      )
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`commercial_observations: ${error.message}`);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function threadMap(threadIds: string[]) {
  if (!threadIds.length) return new Map<string, Record<string, unknown>>();
  const supabase = await createClient();
  const unique = Array.from(new Set(threadIds));
  const result = new Map<string, Record<string, unknown>>();

  for (let offset = 0; offset < unique.length; offset += 500) {
    const ids = unique.slice(offset, offset + 500);
    const { data, error } = await supabase
      .from("commercial_threads")
      .select("id,subject,classification,started_at,last_activity_at,email_count")
      .in("id", ids);
    if (error) throw new Error(`commercial_threads: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      result.set(String(row.id), row);
    }
  }
  return result;
}

export async function getCommercialRows(): Promise<{ mode: DataMode; rows: CommercialRow[] }> {
  if (!isSupabaseConfigured()) return { mode: "demo", rows: commercialRows };

  const observations = await fetchAllObservations();
  if (!observations.length) return { mode: "empty", rows: [] };

  const threads = await threadMap(observations.map((row) => String(row.thread_id)));
  const rows: CommercialRow[] = observations.map((row) => {
    const thread = threads.get(String(row.thread_id));
    const availability = String(row.availability_status ?? "unknown");

    return {
      id: String(row.id),
      conversationId: String(row.thread_id),
      date: dateLabel(thread?.last_activity_at ?? thread?.started_at),
      company: "Archivio email",
      product: productLabel(row),
      grade: String(row.grade ?? "—"),
      standard: String(row.standard ?? "—"),
      role: row.item_role as ItemRole,
      price: priceLabel(row),
      availability:
        availability === "stock" ||
        availability === "production" ||
        availability === "unavailable"
          ? availability
          : "unknown",
      confidence: Number(row.confidence ?? 0),
    };
  });

  return { mode: "live", rows };
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) {
    return { mode: "demo", metrics: archiveMetrics, recent: commercialRows.slice(0, 4) };
  }

  const supabase = await createClient();
  const { data: dataset, error: datasetError } = await supabase
    .from("commercial_datasets")
    .select("email_count,thread_count,message_count,extraction_count")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (datasetError) throw new Error(`commercial_datasets: ${datasetError.message}`);
  if (!dataset) return { mode: "empty", metrics: emptyMetrics(), recent: [] };

  const { mode, rows } = await getCommercialRows();
  const pending = await supabase
    .from("commercial_review_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (pending.error) throw new Error(`commercial_review_queue: ${pending.error.message}`);

  const roleCount = (role: ItemRole) => rows.filter((row) => row.role === role).length;
  const avgConfidence = rows.length
    ? (rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length) * 100
    : 0;

  return {
    mode,
    metrics: {
      emails: Number(dataset.email_count ?? 0),
      threads: Number(dataset.thread_count ?? 0),
      messages: Number(dataset.message_count ?? 0),
      observations: Number(dataset.extraction_count ?? rows.length),
      requested: roleCount("requested"),
      offered: roleCount("offered"),
      ordered: roleCount("ordered"),
      delivered: roleCount("delivered"),
      reviewFlags: pending.count ?? 0,
      avgConfidence: Math.round(avgConfidence * 10) / 10,
    },
    recent: rows.slice(0, 4),
  };
}

function observationDetail(row: Record<string, unknown>) {
  const parts = [
    row.grade,
    row.standard,
    row.quantity ? `${numberLabel(row.quantity)} ${String(row.quantity_unit ?? "")}`.trim() : null,
    priceLabel(row),
    row.discount_percentage ? `sconto ${numberLabel(row.discount_percentage)}%` : null,
    row.availability_status,
  ].filter(Boolean);
  return parts.join(" · ") || "Nessun dettaglio commerciale aggiuntivo";
}

export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  if (!isSupabaseConfigured()) {
    return conversations[id as keyof typeof conversations] ?? null;
  }

  const supabase = await createClient();
  const { data: thread, error: threadError } = await supabase
    .from("commercial_threads")
    .select("id,subject,classification,last_activity_at")
    .eq("id", id)
    .maybeSingle();
  if (threadError) throw new Error(`commercial_threads: ${threadError.message}`);
  if (!thread) return null;

  const { data, error } = await supabase
    .from("commercial_observations")
    .select(
      "id,item_role,role_method,direction,product_type,grade,standard,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,quantity,quantity_unit,price_value,price_unit,currency,discount_percentage,availability_status,source_text,source_clause,confidence,source_extraction_id",
    )
    .eq("thread_id", id)
    .order("source_extraction_id", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`commercial_observations: ${error.message}`);

  const events: ConversationEvent[] = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    role: row.item_role as ItemRole,
    at: [row.direction, row.role_method].filter(Boolean).map(String).join(" · ") || dateLabel(thread.last_activity_at),
    title:
      row.item_role === "requested"
        ? "Richiesta"
        : row.item_role === "offered"
          ? "Offerta"
          : row.item_role === "ordered"
            ? "Ordine"
            : "Consegna",
    product: productLabel(row),
    detail: observationDetail(row),
    source: String(row.source_text ?? row.source_clause ?? "—"),
    confidence: Number(row.confidence ?? 0),
  }));

  return {
    subject: String(thread.subject ?? "Thread commerciale"),
    company: "Archivio email",
    status: String(thread.classification ?? "commercial"),
    events,
  };
}

export async function getReviewQueue(): Promise<{ mode: DataMode; flags: ReviewFlagView[] }> {
  if (!isSupabaseConfigured()) {
    return {
      mode: "demo",
      flags: reviewFlags.map((flag) => ({
        id: flag.id,
        subject: flag.subject,
        product: flag.product,
        inferred: flag.inferred,
        availability: flag.status,
        source: flag.source,
        confidence: flag.confidence,
        reviewStatus: "pending",
      })),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commercial_review_queue")
    .select("id,thread_id,observation_id,reason,severity,source_text,status")
    .order("id", { ascending: true });
  if (error) throw new Error(`commercial_review_queue: ${error.message}`);
  const queue = (data ?? []) as Record<string, unknown>[];
  if (!queue.length) return { mode: "empty", flags: [] };

  const threads = await threadMap(queue.map((row) => String(row.thread_id)));
  const observationIds = queue
    .map((row) => row.observation_id)
    .filter((value): value is number => typeof value === "number");
  const observations = new Map<string, Record<string, unknown>>();

  if (observationIds.length) {
    const { data: obsData, error: obsError } = await supabase
      .from("commercial_observations")
      .select(
        "id,product_type,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,availability_status,confidence",
      )
      .in("id", observationIds);
    if (obsError) throw new Error(`commercial_observations: ${obsError.message}`);
    for (const row of (obsData ?? []) as Record<string, unknown>[]) {
      observations.set(String(row.id), row);
    }
  }

  return {
    mode: "live",
    flags: queue.map((row) => {
      const thread = threads.get(String(row.thread_id));
      const observation = observations.get(String(row.observation_id));
      return {
        id: String(row.id),
        subject: String(thread?.subject ?? "Thread commerciale"),
        product: observation ? productLabel(observation) : "Prodotto da verificare",
        inferred: String(row.reason ?? "review"),
        availability: String(observation?.availability_status ?? "unknown"),
        source: String(row.source_text ?? "—"),
        confidence: Number(observation?.confidence ?? 0),
        reviewStatus: (row.status as ReviewFlagView["reviewStatus"]) ?? "pending",
      };
    }),
  };
}
