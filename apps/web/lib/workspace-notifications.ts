import { appRoutes } from "@/lib/routes";
import { NOTIFICATION_CATALOG, type NotificationEventType } from "@/lib/notification-domain-contract";

export type WorkspaceNotificationFilter = "all" | "unread" | "commercial" | "system" | "archived";

export type WorkspaceNotificationItem = {
  id: string;
  eventId: string;
  eventType: NotificationEventType;
  priority: "informational" | "action_required" | "critical";
  createdAt: string;
  occurredAt: string;
  sourceEventId: string;
  readAt: string | null;
  archivedAt: string | null;
  title: string;
  description: string;
  href: string;
};

export type WorkspaceNotificationSnapshot = {
  items: WorkspaceNotificationItem[];
  totalCount: number;
  unreadCount: number;
  filteredCount: number;
  limit: number;
  offset: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRESENTATION: Partial<Record<NotificationEventType, { title: string; description: string }>> = {
  "workspace.rfq.response_received": {
    title: "Risposta a richiesta di offerta",
    description: "È disponibile una nuova risposta nella tua RFQ.",
  },
  "workspace.rfq.award_confirmed": {
    title: "Aggiudicazione RFQ confermata",
    description: "Un'aggiudicazione è stata confermata.",
  },
  "workspace.marketplace.opportunity_matched": {
    title: "Opportunità Marketplace",
    description: "Un'opportunità è disponibile per la tua azienda.",
  },
  "workspace.import.failed": {
    title: "Importazione non riuscita",
    description: "Un'importazione richiede una verifica.",
  },
  "workspace.operations.regression_detected": {
    title: "Alert operativo critico",
    description: "Un controllo operativo richiede attenzione.",
  },
  // The two NC1.3 RFQ candidates below remain blocked by NC2.3 but are
  // represented safely if a future, reviewed producer activates them.
  "workspace.rfq.clarification_requested": {
    title: "Chiarimento RFQ richiesto",
    description: "È presente una richiesta di chiarimento.",
  },
  "workspace.rfq.supplier_confirmation_received": {
    title: "Conferma del fornitore",
    description: "È disponibile una conferma commerciale.",
  },
};

export function normalizeWorkspaceNotificationFilter(value: unknown): WorkspaceNotificationFilter {
  return value === "unread" || value === "commercial" || value === "system" || value === "archived"
    ? value : "all";
}

function validCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function validOptionalTimestamp(value: unknown): value is string | null {
  return value === null || validTimestamp(value);
}

function parseItem(value: unknown): WorkspaceNotificationItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !UUID.test(row.id) ||
    typeof row.event_id !== "string" || !UUID.test(row.event_id) ||
    typeof row.event_type !== "string" ||
    !(row.event_type in NOTIFICATION_CATALOG) ||
    !row.event_type.startsWith("workspace.") ||
    typeof row.source_event_id !== "string" || row.source_event_id.length > 128 ||
    !validTimestamp(row.created_at) || !validTimestamp(row.occurred_at) ||
    !validOptionalTimestamp(row.read_at) || !validOptionalTimestamp(row.archived_at)) return null;

  const eventType = row.event_type as NotificationEventType;
  const definition = NOTIFICATION_CATALOG[eventType];
  if (definition.scope !== "workspace" || !PRESENTATION[eventType] ||
    row.source_table !== definition.sourceTable || row.priority !== definition.priority) return null;

  const presentation = PRESENTATION[eventType];
  const href =
    eventType.startsWith("workspace.rfq.") || eventType === "workspace.marketplace.opportunity_matched"
      ? `/notifications/open/${row.id}`
      : eventType === "workspace.import.failed"
        ? appRoutes.operations.uploads : appRoutes.operations.alerts;
  return {
    id: row.id, eventId: row.event_id as string, eventType,
    priority: definition.priority, sourceEventId: row.source_event_id,
    createdAt: row.created_at, occurredAt: row.occurred_at,
    readAt: row.read_at, archivedAt: row.archived_at,
    title: presentation!.title, description: presentation!.description, href,
  };
}

/** Fail closed: unknown or incomplete RPC output is not an empty inbox. */
export function parseWorkspaceNotificationSnapshot(value: unknown): WorkspaceNotificationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.items) || !validCount(data.total_count) ||
    !validCount(data.unread_count) || !validCount(data.filtered_count) ||
    !validCount(data.limit) || !validCount(data.offset) ||
    data.limit < 1 || data.limit > 50 || data.offset > 1000 ||
    data.unread_count > data.total_count || data.items.length > data.limit ||
    data.items.length > data.filtered_count) return null;
  const items = data.items.map(parseItem);
  if (items.some((item) => item === null) ||
      new Set(items.map((item) => item?.id)).size !== items.length) return null;
  return {
    items: items as WorkspaceNotificationItem[],
    unreadCount: data.unread_count, totalCount: data.total_count,
    filteredCount: data.filtered_count, limit: data.limit, offset: data.offset,
  };
}

export function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}
