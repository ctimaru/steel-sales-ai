// Raggruppa, solo in presentazione, le righe consecutive della lista Commerciale
// con stesso tipo, stesso titolo (cliente) e stesso giorno. Non modifica ordine,
// paginazione né dati: le righe restano tutte raggiungibili dentro il gruppo.

export const MIN_GROUP_SIZE = 3;

type GroupableItem = { key: string; kind: string; title: string; at: string | null };

export type CommercialRowEntry<T extends GroupableItem> =
  | { type: "single"; item: T }
  | { type: "group"; id: string; items: T[]; day: string };

const dayFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
});

export function commercialRowDay(at: string | null): string | null {
  if (!at) return null;
  const time = Date.parse(at);
  return Number.isFinite(time) ? dayFormatter.format(new Date(time)) : null;
}

function groupKey(item: GroupableItem): string | null {
  const day = commercialRowDay(item.at);
  const title = item.title.trim().toLocaleLowerCase("it-IT");
  return day && title ? item.kind + "|" + title + "|" + day : null;
}

export function groupCommercialRows<T extends GroupableItem>(items: readonly T[]): CommercialRowEntry<T>[] {
  const entries: CommercialRowEntry<T>[] = [];
  let index = 0;
  while (index < items.length) {
    const key = groupKey(items[index]);
    let end = index + 1;
    while (key && end < items.length && groupKey(items[end]) === key) end++;
    const run = items.slice(index, end);
    if (key && run.length >= MIN_GROUP_SIZE) {
      entries.push({ type: "group", id: "group:" + run[0].key, items: run, day: commercialRowDay(run[0].at) as string });
    } else {
      for (const item of run) entries.push({ type: "single", item });
    }
    index = end;
  }
  return entries;
}
