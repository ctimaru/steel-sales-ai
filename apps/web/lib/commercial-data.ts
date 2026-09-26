import "server-only";

import {
  archiveMetrics,
  commercialRows as demoCommercialRows,
  conversations as demoConversations,
  reviewFlags as demoReviewFlags,
  type CommercialRow,
  type ItemRole,
} from "@/lib/demo-data";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type DataMode = "demo" | "live" | "awaiting_assignment";

export type DashboardData = {
  mode: DataMode;
  metrics: typeof archiveMetrics;
  recent: CommercialRow[];
  operational: {
    rfqs: number;
    offers: number;
    orders: number;
    normalizedLines: number;
    legacyEvidence: number;
  };
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

export type OperationalEntityKind = "rfq" | "offer" | "order";

export type OperationalEntityData = {
  mode: DataMode;
  kind: OperationalEntityKind;
  id: string;
  status: string;
  occurredAt: string;
  company: string;
  companyId: string | null;
  conversationHref: string | null;
  conversationLabel: string | null;
  relationshipLinks: Array<{ label: string; href: string }>;
  metadata: Array<{ label: string; value: string }>;
  lines: Array<{
    id: string;
    product: string;
    grade: string;
    standard: string;
    quantity: string;
    price: string;
    availability: string;
    confidence: number;
    sourceObservationId: number | null;
    sourceFilename: string | null;
    sourceText: string | null;
  }>;
};

export type ConversationData = {
  mode: DataMode;
  subject: string;
  company: string;
  companyId: string | null;
  customerContext: "normalized_company" | "unresolved";
  normalized: {
    rfqs: number;
    offers: number;
    orders: number;
  };
  status: string;
  events: ReadonlyArray<{
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
    return {
      mode: "demo",
      metrics: archiveMetrics,
      recent: demoCommercialRows.slice(0, 4),
      operational: { rfqs: 0, offers: 0, orders: 0, normalizedLines: 0, legacyEvidence: archiveMetrics.observations },
    };
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
      operational: { rfqs: 0, offers: 0, orders: 0, normalizedLines: 0, legacyEvidence: archiveMetrics.observations },
    };
  }

  const metric = metricRows[0] as Record<string, unknown>;
  const [{ data: recentRfqLines }, { count: rfqCount }, { count: offerCount }, { count: orderCount }, { count: legacyEvidence }] =
    await Promise.all([
      supabase
        .from("rfq_lines")
        .select("id,rfq_id,requested_grade,requested_standard,raw_spec_text,source_observation_id,rfqs!inner(requested_at,company_id,conversation_id,companies(name),conversations(external_thread_id))")
        .order("created_at", { ascending: false })
        .limit(4),
      supabase.from("rfqs").select("id", { count: "exact", head: true }),
      supabase.from("offers").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("commercial_observations").select("id", { count: "exact", head: true }),
    ]);

  const recent = (recentRfqLines ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const rfq = nestedThread(row.rfqs) ?? {};
    const company = nestedThread(rfq.companies);
    const conversation = nestedThread(rfq.conversations);
    return {
      id: String(row.id),
      conversationId: String(conversation?.external_thread_id ?? rfq.conversation_id ?? ""),
      date: formatDate(rfq.requested_at),
      company: String(company?.name ?? "Cliente non attribuito"),
      companyId: typeof rfq.company_id === "string" ? rfq.company_id : null,
      sourceKind: "normalized" as const,
      operationalHref: appRoutes.commercial.rfq(String(rfq.id ?? row.rfq_id)),
      product: String(row.raw_spec_text ?? "Prodotto steel"),
      grade: String(row.requested_grade ?? "—"),
      standard: String(row.requested_standard ?? "—"),
      role: "requested" as const,
      availability: "unknown" as const,
      confidence: 1,
    };
  });

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
    recent,
    operational: {
      rfqs: rfqCount ?? 0,
      offers: offerCount ?? 0,
      orders: orderCount ?? 0,
      normalizedLines: recentRfqLines?.length ?? 0,
      legacyEvidence: legacyEvidence ?? 0,
    },
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

  if (filters.role === "delivered") {
    return { mode: "live", rows: [], total: 0, page, pageSize };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { mode: "awaiting_assignment", rows: [], total: 0, page, pageSize };
  }

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) {
    return { mode: "awaiting_assignment", rows: [], total: 0, page, pageSize };
  }

  const { data, error } = await supabase.rpc("p1_normalized_commercial_explorer", {
    p_organization_id: membership.organization_id,
    p_query: filters.q?.trim() || null,
    p_role: filters.role && filters.role !== "all" ? filters.role : null,
    p_grade: filters.grade && filters.grade !== "all" ? filters.grade : null,
    p_standard: filters.standard && filters.standard !== "all" ? filters.standard : null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (error || !data || typeof data !== "object") {
    return { mode: "awaiting_assignment", rows: [], total: 0, page, pageSize };
  }

  const payload = data as {
    total?: number;
    rows?: Array<Record<string, unknown>>;
  };

  const rows: CommercialRow[] = (payload.rows ?? []).map((row) => ({
    id: String(row.id),
    conversationId: String(row.conversation_id ?? ""),
    date: formatDate(row.occurred_at),
    company: String(row.company_name ?? "Cliente non attribuito"),
    companyId: typeof row.company_id === "string" ? row.company_id : null,
    sourceKind: "normalized",
    operationalHref:
      row.role === "requested"
        ? appRoutes.commercial.rfq(String(row.entity_id))
        : row.role === "offered"
          ? appRoutes.commercial.offer(String(row.entity_id))
          : appRoutes.commercial.order(String(row.entity_id)),
    product: String(row.product_text ?? row.canonical_product_key ?? "Prodotto steel"),
    grade: String(row.grade ?? "—"),
    standard: String(row.standard ?? "—"),
    role: row.role as ItemRole,
    price: formatPrice(row),
    availability:
      row.availability_status === "stock" || row.availability_status === "production"
        ? row.availability_status
        : "unknown",
    confidence: Number(row.confidence ?? 1),
  }));

  return {
    mode: "live",
    rows,
    total: Number(payload.total ?? 0),
    page,
    pageSize,
  };
}

export async function getOperationalEntityData(
  kind: OperationalEntityKind,
  id: string,
): Promise<OperationalEntityData | null> {
  if (!isConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await createClient();
  const config = {
    rfq: {
      parentTable: "rfqs",
      lineTable: "rfq_lines",
      parentSelect: "id,status,requested_at,due_at,priority,notes,company_id,conversation_id,companies(name),conversations(external_thread_id)",
      lineSelect: "id,rfq_id,requested_quantity,quantity_unit,requested_grade,requested_standard,raw_spec_text,canonical_product_key,source_observation_id",
      parentFk: "rfq_id",
    },
    offer: {
      parentTable: "offers",
      lineTable: "offer_lines",
      parentSelect: "id,status,offered_at,valid_until,currency,delivery_term,payment_terms,notes,company_id,conversation_id,rfq_id,companies(name),conversations(external_thread_id)",
      lineSelect: "id,offer_id,quantity,quantity_unit,price_value,price_unit,availability_status,raw_spec_text,source_text,confidence,canonical_product_key,source_observation_id,rfq_line_id",
      parentFk: "offer_id",
    },
    order: {
      parentTable: "orders",
      lineTable: "order_lines",
      parentSelect: "id,status,ordered_at,customer_order_ref,notes,company_id,conversation_id,rfq_id,offer_id,companies(name),conversations(external_thread_id)",
      lineSelect: "id,order_id,quantity,quantity_unit,unit_price,price_unit,promised_date,raw_spec_text,canonical_product_key,source_observation_id,offer_line_id",
      parentFk: "order_id",
    },
  }[kind];

  const [{ data: parent, error: parentError }, { data: lines, error: linesError }] = await Promise.all([
    supabase.from(config.parentTable).select(config.parentSelect).eq("id", id).maybeSingle(),
    supabase.from(config.lineTable).select(config.lineSelect).eq(config.parentFk, id).order("created_at", { ascending: true }),
  ]);

  if (parentError || linesError || !parent) return null;

  const parentRow = parent as unknown as Record<string, unknown>;
  const rawLines = (lines ?? []) as unknown as Array<Record<string, unknown>>;
  const sourceIds = rawLines
    .map((line) => Number(line.source_observation_id))
    .filter((value) => Number.isSafeInteger(value) && value > 0);

  const { data: observations } = sourceIds.length
    ? await supabase
        .from("commercial_observations")
        .select("id,thread_id,source_filename,source_text,confidence,grade,standard,currency,availability_status")
        .in("id", sourceIds)
    : { data: [] };

  const observationMap = new Map(
    (observations ?? []).map((row) => [Number(row.id), row as Record<string, unknown>]),
  );

  const company = nestedThread(parentRow.companies);
  const conversation = nestedThread(parentRow.conversations);
  const fallbackThreadId = sourceIds.length
    ? observationMap.get(sourceIds[0])?.thread_id
    : null;
  const conversationId =
    typeof conversation?.external_thread_id === "string"
      ? conversation.external_thread_id
      : typeof fallbackThreadId === "string"
        ? fallbackThreadId
        : null;

  const relationshipLinks: Array<{ label: string; href: string }> = [];
  if (kind !== "rfq" && typeof parentRow.rfq_id === "string") {
    relationshipLinks.push({ label: "RFQ collegata", href: appRoutes.commercial.rfq(String(parentRow.rfq_id)) });
  }
  if (kind === "order" && typeof parentRow.offer_id === "string") {
    relationshipLinks.push({ label: "Offer collegata", href: appRoutes.commercial.offer(String(parentRow.offer_id)) });
  }

  const occurredRaw =
    kind === "rfq" ? parentRow.requested_at : kind === "offer" ? parentRow.offered_at : parentRow.ordered_at;

  const metadata =
    kind === "rfq"
      ? [
          { label: "Priorità", value: String(parentRow.priority ?? "normal") },
          { label: "Scadenza", value: formatDate(parentRow.due_at) },
        ]
      : kind === "offer"
        ? [
            { label: "Validità", value: formatDate(parentRow.valid_until) },
            { label: "Valuta", value: String(parentRow.currency ?? "—") },
            { label: "Resa", value: String(parentRow.delivery_term ?? "—") },
            { label: "Pagamento", value: String(parentRow.payment_terms ?? "—") },
          ]
        : [
            { label: "Rif. ordine cliente", value: String(parentRow.customer_order_ref ?? "—") },
          ];

  return {
    mode: "live",
    kind,
    id,
    status: String(parentRow.status ?? "—"),
    occurredAt: formatDate(occurredRaw),
    company: String(company?.name ?? "Cliente non attribuito"),
    companyId: typeof parentRow.company_id === "string" ? parentRow.company_id : null,
    conversationHref: conversationId ? appRoutes.commercial.conversation(conversationId) : null,
    conversationLabel: conversationId ? "Apri conversation/provenance" : null,
    relationshipLinks,
    metadata,
    lines: rawLines.map((line) => {
      const sourceId = Number(line.source_observation_id);
      const obs = Number.isSafeInteger(sourceId) ? observationMap.get(sourceId) : undefined;
      const quantityValue =
        line.requested_quantity ?? line.quantity;
      const quantityUnit = line.quantity_unit;
      const priceValue = line.price_value ?? line.unit_price;
      const priceUnit = line.price_unit;
      const currency = parentRow.currency ?? obs?.currency;
      return {
        id: String(line.id),
        product: String(line.raw_spec_text ?? line.source_text ?? line.canonical_product_key ?? "Prodotto steel"),
        grade: String(line.requested_grade ?? obs?.grade ?? "—"),
        standard: String(line.requested_standard ?? obs?.standard ?? "—"),
        quantity:
          quantityValue !== null && quantityValue !== undefined
            ? `${decimal(quantityValue)} ${String(quantityUnit ?? "")}`.trim()
            : "—",
        price:
          priceValue !== null && priceValue !== undefined
            ? formatPrice({ price_value: priceValue, price_unit: priceUnit, currency }) ?? "—"
            : "—",
        availability: String(line.availability_status ?? obs?.availability_status ?? "unknown"),
        confidence: Number(line.confidence ?? obs?.confidence ?? 1),
        sourceObservationId: Number.isSafeInteger(sourceId) ? sourceId : null,
        sourceFilename: typeof obs?.source_filename === "string" ? obs.source_filename : null,
        sourceText: typeof obs?.source_text === "string" ? obs.source_text : null,
      };
    }),
  };
}

export async function getConversationData(id: string): Promise<ConversationData | null> {
  if (!isConfigured()) {
    const demo = demoConversations[id as keyof typeof demoConversations];
    return demo ? {
      mode: "demo",
      ...demo,
      companyId: null,
      customerContext: "unresolved",
      normalized: { rfqs: 0, offers: 0, orders: 0 },
    } : null;
  }

  const supabase = await createClient();
  let { data: thread } = await supabase
    .from("commercial_threads")
    .select("id,subject,classification,last_activity_at,source_conversation_id")
    .eq("id", id)
    .maybeSingle();

  if (!thread && /^[0-9a-f-]{36}$/i.test(id)) {
    const { data: normalizedRouteConversation } = await supabase
      .from("conversations")
      .select("external_thread_id")
      .eq("id", id)
      .maybeSingle();

    if (normalizedRouteConversation?.external_thread_id) {
      const resolved = await supabase
        .from("commercial_threads")
        .select("id,subject,classification,last_activity_at,source_conversation_id")
        .eq("source_conversation_id", normalizedRouteConversation.external_thread_id)
        .maybeSingle();
      thread = resolved.data;
    }
  }

  if (!thread) return null;

  const sourceConversationId = thread.source_conversation_id ? String(thread.source_conversation_id) : null;
  const { data: normalizedConversation } = sourceConversationId
    ? await supabase
        .from("conversations")
        .select("id,company_id")
        .eq("external_thread_id", sourceConversationId)
        .maybeSingle()
    : { data: null };

  const normalizedConversationId =
    normalizedConversation && typeof normalizedConversation.id === "string"
      ? normalizedConversation.id
      : null;

  const [{ data: rfqs }, { data: offers }, { data: orders }] = normalizedConversationId
    ? await Promise.all([
        supabase
          .from("rfqs")
          .select("id,company_id")
          .eq("conversation_id", normalizedConversationId),
        supabase
          .from("offers")
          .select("id,company_id")
          .eq("conversation_id", normalizedConversationId),
        supabase
          .from("orders")
          .select("id,company_id")
          .eq("conversation_id", normalizedConversationId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const companyIds = new Set(
    [
      normalizedConversation?.company_id,
      ...(rfqs ?? []).map((row) => row.company_id),
      ...(offers ?? []).map((row) => row.company_id),
      ...(orders ?? []).map((row) => row.company_id),
    ].filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  const companyId = companyIds.size === 1 ? [...companyIds][0] : null;
  const { data: normalizedCompany } = companyId
    ? await supabase.from("companies").select("id,name").eq("id", companyId).maybeSingle()
    : { data: null };

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
    company: normalizedCompany?.name ?? "Cliente non attribuito",
    companyId,
    customerContext: companyId ? "normalized_company" : "unresolved",
    normalized: {
      rfqs: rfqs?.length ?? 0,
      offers: offers?.length ?? 0,
      orders: orders?.length ?? 0,
    },
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
