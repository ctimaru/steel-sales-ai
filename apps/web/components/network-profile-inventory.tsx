import type { NetworkInventoryItem } from "@/lib/network-stock";

const unitLabel: Record<string, string> = {
  t: "t", kg: "kg", m: "m", bars: "barre", pcs: "pz",
};
const kindLabel: Record<string, string> = {
  stock: "Disponibile a magazzino",
  incoming: "Arrivo previsto",
  production: "Produzione programmata",
};
export function networkInventoryDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
export function NetworkProfileInventory({ items }: { items: NetworkInventoryItem[] }) {
  if (!items.length) return null;
  const stock = items.filter((item) => item.kind === "stock");
  const planned = items.filter((item) => item.kind !== "stock");
  const groups = [
    { key: "stock", label: "A magazzino", items: stock },
    { key: "future", label: "Prossimi arrivi / produzioni", items: planned },
  ];
  return (
    <section id="stock" data-testid="network-profile-stock" aria-label="Stock, magazzino, prossimi arrivi e produzioni"
      className="rounded-3xl border border-[#dce6e0] bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#526c5c]">Disponibilità dichiarate</p>
          <h2 className="mt-1 text-lg font-semibold text-[#173f35]">Stock, magazzino e programmazione</h2>
        </div>
        <span className="rounded-full bg-[#edf5f1] px-2.5 py-1 text-xs font-medium text-[#175640]">
          {items.length} {items.length === 1 ? "posizione" : "posizioni"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#596a60]">Quantità e date pubblicate dall'azienda, soggette a conferma prima dell'ordine. Nessuna disponibilità stimata dall'AI.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {groups.filter((group) => group.items.length > 0).map((group) => (
          <div key={group.key} className="min-w-0 overflow-hidden rounded-2xl border border-[#e1e9e4]">
            <h3 className="border-b border-[#e1e9e4] bg-[#f6faf7] px-3 py-2.5 text-sm font-semibold text-[#1a5144]">{group.label}</h3>
            <ul className="divide-y divide-[#e1e9e4]">
              {group.items.map((item) => (
                <li key={item.id} className="p-3 sm:p-4">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-5 text-[#263c30]">{item.product_name}</p>
                      {[item.standard, item.grade, item.dimensions].filter(Boolean).length ? (
                        <p className="mt-1 break-words text-xs leading-5 text-[#53665a]">
                          {[item.standard, item.grade, item.dimensions].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-lg bg-[#e9f4ed] px-2.5 py-1.5 text-sm font-bold tabular-nums text-[#15533b]">
                      {new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(item.quantity)} {unitLabel[item.unit]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#52665a]">
                    <span>{kindLabel[item.kind]}</span>
                    {item.available_on ? <span>Previsto: {networkInventoryDate(item.available_on) ?? item.available_on}</span> : null}
                    {item.location ? <span>{item.location}</span> : null}
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#68786c]">
                    Aggiornato: {new Intl.DateTimeFormat("it-IT", {day:"2-digit",month:"short",year:"numeric"}).format(new Date(item.updated_at))}
                    {" · "}Fonte: azienda
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
