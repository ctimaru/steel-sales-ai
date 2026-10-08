import { NOTIFICATION_CATALOG, type NotificationEventType } from "@/lib/notification-domain-contract";
import { appRoutes } from "@/lib/routes";
import { formatNotificationTime } from "@/lib/workspace-notifications";

export { formatNotificationTime };
export type PlatformNotificationFilter = "all" | "unread" | "registrations" | "claims" | "incidents" | "archived";
export type PlatformNotificationItem = {
  id:string; eventId:string; eventType:NotificationEventType; priority:"informational"|"action_required"|"critical";
  createdAt:string; occurredAt:string; readAt:string|null; archivedAt:string|null;
  title:string; description:string; href:string;
};
export type PlatformNotificationSnapshot = {
  items:PlatformNotificationItem[]; totalCount:number; unreadCount:number;
  filteredCount:number; limit:number; offset:number;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COPY:Partial<Record<NotificationEventType,{title:string;description:string}>>={
  "platform.registration.submitted":{title:"Nuova registrazione aziendale",description:"Una nuova domanda attende la revisione Platform."},
  "platform.registration.information_provided":{title:"Informazioni integrative ricevute",description:"Una domanda di registrazione è stata aggiornata."},
  "platform.claim.requested":{title:"Richiesta di verifica azienda",description:"Una richiesta di claim richiede valutazione."},
  "platform.infrastructure.critical_incident":{title:"Incidente critico Platform",description:"Un segnale di infrastruttura richiede attenzione."},
};
const integer=(x:unknown):x is number=>typeof x==="number"&&Number.isSafeInteger(x)&&x>=0;
const date=(x:unknown):x is string=>typeof x==="string"&&x.length>0&&Number.isFinite(Date.parse(x));
const optionalDate=(x:unknown):x is string|null=>x===null||date(x);
export function normalizePlatformNotificationFilter(x:unknown):PlatformNotificationFilter {
  return x==="unread"||x==="registrations"||x==="claims"||x==="incidents"||x==="archived"?x:"all";
}
function parseItem(x:unknown):PlatformNotificationItem|null {
  if(!x||typeof x!=="object"||Array.isArray(x))return null;
  const r=x as Record<string,unknown>;
  if(typeof r.id!=="string"||!UUID.test(r.id)||
    typeof r.event_id!=="string"||!UUID.test(r.event_id)||
    typeof r.event_type!=="string"||
    !Object.prototype.hasOwnProperty.call(NOTIFICATION_CATALOG,r.event_type)||
    !r.event_type.startsWith("platform.")||
    !date(r.created_at)||!date(r.occurred_at)||!optionalDate(r.read_at)||!optionalDate(r.archived_at)||
    typeof r.source_event_id!=="string"||r.source_event_id.length>128)return null;
  const eventType=r.event_type as NotificationEventType;
  const def=NOTIFICATION_CATALOG[eventType],copy=COPY[eventType];
  if(def.scope!=="platform"||!copy||r.source_table!==def.sourceTable||r.priority!==def.priority)return null;
  const href=`${appRoutes.platform.notifications}/open/${r.id}`;
  return {id:r.id,eventId:r.event_id as string,eventType,priority:def.priority,
    createdAt:r.created_at,occurredAt:r.occurred_at,readAt:r.read_at,archivedAt:r.archived_at,
    title:copy.title,description:copy.description,href};
}
export function parsePlatformNotificationSnapshot(raw:unknown):PlatformNotificationSnapshot|null {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const d=raw as Record<string,unknown>;
  if(!Array.isArray(d.items)||!integer(d.total_count)||!integer(d.unread_count)||
     !integer(d.filtered_count)||!integer(d.limit)||!integer(d.offset)||
     d.limit<1||d.limit>50||d.offset>1000||d.unread_count>d.total_count||
     d.items.length>d.limit||d.items.length>d.filtered_count)return null;
  const items=d.items.map(parseItem);
  if(items.some(x=>x===null)||new Set(items.map(x=>x?.id)).size!==items.length)return null;
  return {items:items as PlatformNotificationItem[],totalCount:d.total_count,
    unreadCount:d.unread_count,filteredCount:d.filtered_count,limit:d.limit,offset:d.offset};
}
