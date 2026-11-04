/**
 * CPOST1: pure model for company posts in the Home feed and the staff queue.
 *
 * Parses only the governed RPC payloads (cpost1_feed, cpost1_can_publish,
 * cpost1_staff_queue) and maps their codes to Italian copy. Never grants
 * anything: every permission is re-checked in SQL by the cpost1_* functions.
 * Kept free of runtime imports so it can be unit-tested in isolation.
 */

export const COMPANY_POST_MAX_CHARS = 3000;
export const COMPANY_POST_DAILY_LIMIT = 3;
/** Posts taken per Home feed page. */
export const COMPANY_POSTS_PER_PAGE = 3;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * CPOST2 (founder decision, 4 Nov 2026): typed posts useful to the trade.
 * "Capacità disponibile" comes first; capacity and stock expire after 30 days.
 */
export const COMPANY_POST_TYPES = [
  { value: "capacity", label: "Capacità disponibile", short: "Capacità", hint: "Impianti o lavorazioni liberi in un periodo" },
  { value: "stock", label: "Materiale disponibile", short: "Materiale", hint: "Tubi e prodotti pronti a magazzino" },
  { value: "news", label: "Novità aziendale", short: "Novità", hint: "Impianti, gamme, investimenti, collaborazioni" },
  { value: "event", label: "Evento e fiera", short: "Eventi", hint: "Fiere, open day, presentazioni" },
] as const;

export type CompanyPostType = (typeof COMPANY_POST_TYPES)[number]["value"];

export function isCompanyPostType(value: unknown): value is CompanyPostType {
  return COMPANY_POST_TYPES.some((type) => type.value === value);
}

export function companyPostTypeLabel(value: CompanyPostType): string {
  return COMPANY_POST_TYPES.find((type) => type.value === value)?.label ?? "Novità aziendale";
}

export const CAPACITY_PROCESSES = [
  { value: "taglio", label: "Taglio" },
  { value: "curvatura", label: "Curvatura" },
  { value: "saldatura", label: "Saldatura" },
  { value: "laser", label: "Taglio laser" },
  { value: "foratura", label: "Foratura" },
  { value: "filettatura", label: "Filettatura" },
  { value: "zincatura", label: "Zincatura" },
  { value: "verniciatura", label: "Verniciatura" },
  { value: "trattamento_termico", label: "Trattamento termico" },
  { value: "lavorazione_meccanica", label: "Lavorazione meccanica" },
  { value: "altro", label: "Altro" },
] as const;

/** Only flat string/boolean details survive; everything else is dropped. */
export type CompanyPostDetails = Record<string, string | boolean>;

export type CompanyPostItem = {
  kind: "post";
  key: string;
  id: string;
  postType: CompanyPostType;
  body: string;
  details: CompanyPostDetails;
  expiresAt: string | null;
  companyId: string;
  companyName: string;
  createdAt: string;
  editedAt: string | null;
  isOwnCompany: boolean;
  isMine: boolean;
  reportedByMe: boolean;
};

export type CompanyPostsCursor = { beforeCreatedAt: string; beforeId: string };

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseCompanyPost(value: unknown): CompanyPostItem | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const id = typeof v.id === "string" && UUID.test(v.id) ? v.id : null;
  const companyId = typeof v.network_company_id === "string" && UUID.test(v.network_company_id) ? v.network_company_id : null;
  const body = typeof v.body === "string" ? v.body.trim().slice(0, COMPANY_POST_MAX_CHARS) : "";
  const companyName = text(v.company_name, 255);
  const createdAt = typeof v.created_at === "string" && TIMESTAMP.test(v.created_at) ? v.created_at : null;
  // Posts from before CPOST2 carry no type: they are news.
  const postType: CompanyPostType = v.post_type === undefined || v.post_type === null ? "news"
    : isCompanyPostType(v.post_type) ? v.post_type : ("" as CompanyPostType);
  const details = parseCompanyPostDetails(v.details);
  // Only verified companies publish; anything else is not a post we show.
  if (!id || !companyId || !companyName || !createdAt || v.company_verified !== true || !isCompanyPostType(postType)) return null;
  // News needs text; typed posts need their key detail.
  if (postType === "news" ? !body : !companyPostHasKeyDetail(postType, details)) return null;
  return {
    kind: "post",
    key: "post:" + id,
    id,
    postType,
    body,
    details,
    expiresAt: typeof v.expires_at === "string" && TIMESTAMP.test(v.expires_at) ? v.expires_at : null,
    companyId,
    companyName,
    createdAt,
    editedAt: typeof v.edited_at === "string" && TIMESTAMP.test(v.edited_at) ? v.edited_at : null,
    isOwnCompany: v.is_own_company === true,
    isMine: v.is_mine === true,
    reportedByMe: v.reported_by_me === true,
  };
}

function parseCompanyPostDetails(value: unknown): CompanyPostDetails {
  const out: CompanyPostDetails = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
    if (!/^[a-z_0-9]{1,32}$/.test(key)) continue;
    if (typeof raw === "boolean") out[key] = raw;
    else if (typeof raw === "string" && raw.trim()) out[key] = raw.trim().slice(0, 200);
  }
  return out;
}

function companyPostHasKeyDetail(type: CompanyPostType, details: CompanyPostDetails): boolean {
  if (type === "capacity") return typeof details.process === "string";
  if (type === "stock") return typeof details.product === "string";
  if (type === "event") return typeof details.name === "string" && typeof details.date_from === "string";
  return true;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-14" → "14 nov 2026", without time-zone drift. */
export function companyPostDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function period(from: unknown, to: unknown, prefix: string): string | null {
  const a = companyPostDate(from);
  const b = companyPostDate(to);
  if (a && b) return a === b ? a : a + " – " + b;
  if (a) return "dal " + a;
  if (b) return prefix + b;
  return null;
}

/** The structured part of a typed post, as label/value rows in Italian. */
export function companyPostDetailRows(item: Pick<CompanyPostItem, "postType" | "details">): Array<{ label: string; value: string }> {
  const d = item.details;
  const str = (key: string) => (typeof d[key] === "string" ? (d[key] as string) : null);
  const rows: Array<{ label: string; value: string | null }> = [];
  if (item.postType === "capacity") {
    const process = CAPACITY_PROCESSES.find((p) => p.value === str("process"))?.label ?? null;
    rows.push(
      { label: "Lavorazione", value: str("process") === "altro" ? str("process_detail") ?? process : process },
      { label: "Periodo", value: period(d.available_from, d.available_to, "fino al ") },
      { label: "Quantità", value: str("quantity") },
      { label: "Luogo", value: str("location") },
    );
  } else if (item.postType === "stock") {
    rows.push(
      { label: "Prodotto", value: str("product") },
      { label: "Norma", value: str("standard") },
      { label: "Grado", value: str("grade") },
      { label: "Dimensioni", value: str("dimensions") },
      { label: "Quantità", value: str("quantity") },
      { label: "Luogo", value: str("location") },
      { label: "Certificato", value: d.certificate_31 === true ? "EN 10204 3.1" : null },
    );
  } else if (item.postType === "event") {
    rows.push(
      { label: "Evento", value: str("name") },
      { label: "Date", value: period(d.date_from, d.date_to, "fino al ") },
      { label: "Luogo", value: str("location") },
      { label: "Stand", value: str("stand") },
    );
  }
  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
}

/** Capacity and stock are offers: they show until when and lead to the RFQ page. */
export function companyPostIsOffer(type: CompanyPostType): boolean {
  return type === "capacity" || type === "stock";
}

/**
 * "Chiedi un'offerta": the existing GET-only Commerciale handoff with the
 * company as Network context. Requests still leave only from the RFQ page.
 */
export function companyPostOfferHref(item: Pick<CompanyPostItem, "postType" | "companyId" | "isOwnCompany">): string | null {
  if (!companyPostIsOffer(item.postType) || item.isOwnCompany || !UUID.test(item.companyId)) return null;
  return "/commercial?network=" + encodeURIComponent(item.companyId) + "&compose=1#commercial-compose";
}

export function parseCompanyPostsFeed(value: unknown): { items: CompanyPostItem[]; next: CompanyPostsCursor | null } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.items)) return null;
  const items = v.items.map(parseCompanyPost).filter((item): item is CompanyPostItem => item !== null);
  const raw = v.next_cursor && typeof v.next_cursor === "object" ? (v.next_cursor as Record<string, unknown>) : null;
  const next = raw && typeof raw.before_created_at === "string" && TIMESTAMP.test(raw.before_created_at) &&
    typeof raw.before_id === "string" && UUID.test(raw.before_id)
    ? { beforeCreatedAt: raw.before_created_at, beforeId: raw.before_id }
    : null;
  return { items, next };
}

/**
 * The posts segment of the Home feed cursor: "" = from the newest post,
 * "x" = exhausted, otherwise "<created_at with . as _>~<id>".
 * The main cursor is "."-separated, so the timestamp's "." is escaped.
 */
export function encodeCompanyPostsToken(cursor: CompanyPostsCursor | null): string {
  if (!cursor) return "x";
  return cursor.beforeCreatedAt.replace(/\./g, "_") + "~" + cursor.beforeId;
}

export function decodeCompanyPostsToken(token: unknown): CompanyPostsCursor | "start" | "done" {
  if (token === "" || token === undefined) return "start";
  if (token === "x" || typeof token !== "string" || token.length > 120) return token === "x" ? "done" : "start";
  const [stamp, id] = token.split("~");
  const beforeCreatedAt = (stamp ?? "").replace(/_/g, ".");
  if (!TIMESTAMP.test(beforeCreatedAt) || !id || !UUID.test(id)) return "start";
  return { beforeCreatedAt, beforeId: id };
}

/**
 * Space company posts through a feed page: the first post opens the page,
 * the next ones follow the 3rd and 6th items; leftovers close the page.
 */
export function withCompanyPosts<T>(page: readonly T[], posts: readonly T[]): T[] {
  const queue = [...posts];
  const out: T[] = [];
  if (queue.length) out.push(queue.shift()!);
  page.forEach((item, index) => {
    out.push(item);
    if ((index === 2 || index === 5) && queue.length) out.push(queue.shift()!);
  });
  return [...out, ...queue];
}

export type CompanyPostPublishReason =
  | "feature_disabled"
  | "not_authenticated"
  | "not_member"
  | "role_not_allowed"
  | "no_company_profile"
  | "company_not_verified";

export type CompanyPostPublishState = { canPublish: boolean; reason: CompanyPostPublishReason | null };

const REASONS = new Set<CompanyPostPublishReason>([
  "feature_disabled", "not_authenticated", "not_member", "role_not_allowed", "no_company_profile", "company_not_verified",
]);

export function parseCompanyPostPublishState(value: unknown): CompanyPostPublishState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.can_publish !== "boolean") return null;
  const reason = typeof v.reason === "string" && REASONS.has(v.reason as CompanyPostPublishReason)
    ? (v.reason as CompanyPostPublishReason)
    : null;
  if (!v.can_publish && !reason) return null;
  return { canPublish: v.can_publish, reason: v.can_publish ? null : reason };
}

/**
 * What the Home shows above the feed: the composer, a hint for an
 * allowed role whose company is not verified yet, or nothing at all.
 */
export function companyPostComposerMode(state: CompanyPostPublishState | null): "compose" | "verify_first" | "hidden" {
  if (!state) return "hidden";
  if (state.canPublish) return "compose";
  return state.reason === "company_not_verified" ? "verify_first" : "hidden";
}

export const COMPANY_POST_REPORT_REASONS = [
  { value: "spam", label: "Spam o pubblicità ripetitiva" },
  { value: "inappropriate", label: "Contenuto inappropriato" },
  { value: "fraud_suspicious", label: "Sospetta truffa o identità falsa" },
  { value: "other", label: "Altro" },
] as const;

export type CompanyPostReportReason = (typeof COMPANY_POST_REPORT_REASONS)[number]["value"];

export function isCompanyPostReportReason(value: unknown): value is CompanyPostReportReason {
  return COMPANY_POST_REPORT_REASONS.some((reason) => reason.value === value);
}

export function companyPostReportReasonLabel(value: string): string {
  return COMPANY_POST_REPORT_REASONS.find((reason) => reason.value === value)?.label ?? "Altro";
}

/** Italian copy for the errors the cpost1_* functions raise; anything else is generic. */
const DETAIL_COPY: Record<string, string> = {
  process: "Scegli la lavorazione.",
  process_detail: "Descrivi la lavorazione.",
  product: "Indica il prodotto.",
  name: "Indica il nome dell’evento.",
  date_from: "Indica la data di inizio.",
  location: "Indica il luogo.",
};

export function companyPostErrorCopy(message: unknown): string {
  const m = typeof message === "string" ? message : "";
  const missing = /missing post detail: ([a-z_]+)/.exec(m);
  if (missing) return DETAIL_COPY[missing[1]] ?? "Completa i campi obbligatori.";
  if (m.includes("invalid capacity process")) return DETAIL_COPY.process;
  if (m.includes("already ended")) return "La data di fine è già passata.";
  if (m.includes("ends before it starts")) return "La data di fine è precedente a quella di inizio.";
  if (m.includes("invalid post date")) return "Una delle date non è valida.";
  if (m.includes("post detail too long")) return "Uno dei campi è troppo lungo.";
  if (m.includes("invalid post type")) return "Scegli il tipo di post.";
  if (m.includes("daily post limit")) return "Hai raggiunto il limite di " + COMPANY_POST_DAILY_LIMIT + " post al giorno per la tua azienda. Riprova domani.";
  if (m.includes("exceeds") || m.includes("invalid post body length")) return "Il post supera i " + COMPANY_POST_MAX_CHARS.toLocaleString("it-IT") + " caratteri.";
  if (m.includes("empty")) return "Scrivi il testo del post.";
  if (m.includes("company_not_verified")) return "Solo le aziende verificate possono pubblicare.";
  if (m.includes("role_not_allowed")) return "Possono pubblicare solo gli amministratori e i commerciali dell’azienda.";
  if (m.includes("feature_disabled")) return "La pubblicazione dei post non è attiva in questo momento.";
  if (m.includes("only the author")) return "Solo chi ha scritto il post può modificarlo.";
  if (m.includes("not allowed to delete")) return "Non puoi eliminare questo post.";
  if (m.includes("own company")) return "Non puoi segnalare un post della tua azienda.";
  if (m.includes("post not found") || m.includes("only published")) return "Il post non è più disponibile.";
  return "Operazione non riuscita. Riprova tra poco.";
}

export type CompanyPostQueueReport = { id: string; reason: string; details: string | null; createdAt: string };

export type CompanyPostQueueItem = {
  id: string;
  status: "published" | "hidden";
  body: string;
  companyName: string;
  companyVerification: string;
  organizationId: string;
  createdAt: string;
  editedAt: string | null;
  reportCount: number;
  openReports: number;
  reports: CompanyPostQueueReport[];
};

export function parseCompanyPostQueue(value: unknown): CompanyPostQueueItem[] | null {
  if (!Array.isArray(value)) return null;
  const out: CompanyPostQueueItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const v = row as Record<string, unknown>;
    if (typeof v.id !== "string" || !UUID.test(v.id)) continue;
    if (v.status !== "published" && v.status !== "hidden") continue;
    const reports = Array.isArray(v.reports)
      ? v.reports.flatMap((r) => {
          if (!r || typeof r !== "object") return [];
          const x = r as Record<string, unknown>;
          if (typeof x.id !== "string" || !UUID.test(x.id) || typeof x.reason !== "string") return [];
          return [{
            id: x.id,
            reason: x.reason,
            details: typeof x.details === "string" && x.details.trim() ? x.details.trim().slice(0, 2000) : null,
            createdAt: typeof x.created_at === "string" ? x.created_at : "",
          }];
        })
      : [];
    out.push({
      id: v.id,
      status: v.status,
      body: typeof v.body === "string" ? v.body.slice(0, COMPANY_POST_MAX_CHARS) : "",
      companyName: text(v.company_name, 255) || "Azienda",
      companyVerification: text(v.verification_status, 20) || "unverified",
      organizationId: typeof v.organization_id === "string" ? v.organization_id : "",
      createdAt: typeof v.created_at === "string" ? v.created_at : "",
      editedAt: typeof v.edited_at === "string" ? v.edited_at : null,
      reportCount: typeof v.report_count === "number" ? v.report_count : 0,
      openReports: typeof v.open_reports === "number" ? v.open_reports : reports.length,
      reports,
    });
  }
  return out;
}

export type CompanyPostSettings = {
  enabled: boolean;
  maxBodyChars: number;
  maxPostsPerDay: number;
  autoHideThreshold: number;
  updatedAt: string | null;
  canUpdate: boolean;
  publishedPosts: number;
  hiddenPosts: number;
  openReports: number;
};

function count(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** CPOST1B: the console switch state (cpost1-settings-v1). Unknown payload → null. */
export function parseCompanyPostSettings(value: unknown): CompanyPostSettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.contract !== "cpost1-settings-v1" || typeof v.enabled !== "boolean") return null;
  return {
    enabled: v.enabled,
    maxBodyChars: count(v.max_body_chars) || COMPANY_POST_MAX_CHARS,
    maxPostsPerDay: count(v.max_posts_per_org_per_day) || COMPANY_POST_DAILY_LIMIT,
    autoHideThreshold: count(v.auto_hide_report_threshold) || 3,
    updatedAt: typeof v.updated_at === "string" ? v.updated_at : null,
    canUpdate: v.can_update === true,
    publishedPosts: count(v.published_posts),
    hiddenPosts: count(v.hidden_posts),
    openReports: count(v.open_reports),
  };
}
