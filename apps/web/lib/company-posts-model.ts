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

export type CompanyPostItem = {
  kind: "post";
  key: string;
  id: string;
  body: string;
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
  // Only verified companies publish; anything else is not a post we show.
  if (!id || !companyId || !body || !companyName || !createdAt || v.company_verified !== true) return null;
  return {
    kind: "post",
    key: "post:" + id,
    id,
    body,
    companyId,
    companyName,
    createdAt,
    editedAt: typeof v.edited_at === "string" && TIMESTAMP.test(v.edited_at) ? v.edited_at : null,
    isOwnCompany: v.is_own_company === true,
    isMine: v.is_mine === true,
    reportedByMe: v.reported_by_me === true,
  };
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
export function companyPostErrorCopy(message: unknown): string {
  const m = typeof message === "string" ? message : "";
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
