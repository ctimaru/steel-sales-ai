"use client";

import type { Rfqc1TimelineItem } from "@/lib/rfqc1-timeline";

type Offer = NonNullable<Rfqc1TimelineItem["quote"]>;

function money(value: number | null, digits: number) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : "€ " + value.toLocaleString("it-IT", {
      minimumFractionDigits: 0, maximumFractionDigits: digits,
    });
}
function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(parsed)
    : "—";
}

export function Rfqc1OfferCard({ offer, status, requestLines }: {
  offer: Offer;
  status?: string;
  requestLines: readonly { id: string; description: string }[];
}) {
  const descriptions = new Map(requestLines.map(line => [line.id, line.description]));
  return (
    <section aria-label={"Offerta revisione " + offer.revision}
      data-testid="rfqc1-offer-card"
      className="mt-3 overflow-hidden rounded-xl border border-[#cbded2] bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-[#e0ebe3] bg-[#f3faf5] px-3 py-2">
        <p className="text-xs font-extrabold text-[#20523b]">
          Offerta ricevuta · Rev. {offer.revision}
        </p>
        {status === "superseded" && (
          <span className="rounded-full border border-[#e4dac1] bg-[#fffcf4] px-2 py-1 text-[10px] font-semibold text-[#675833]">
            Sostituita
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 text-xs sm:grid-cols-4">
        {[
          ["Pagamento", offer.paymentTerms || "Da definire"],
          ["Consegna", offer.deliveryDate ? date(offer.deliveryDate) : offer.leadTimeDays !== null ? offer.leadTimeDays + " gg" : "—"],
          ["Validità", date(offer.validityUntil)],
          ["Incoterm", offer.incoterm || "—"],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg bg-[#f6f8f6] p-2">
            <p className="text-[10px] font-medium text-[#6e7d72]">{label}</p>
            <p className="mt-1 break-words font-bold text-[#244837]">{value}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto border-t border-[#e1ebe5]">
        <table className="w-full min-w-[390px] border-collapse text-left text-xs">
          <thead className="bg-[#fafbfa] text-[10px] uppercase tracking-[.06em] text-[#6c7c71]">
            <tr>
              <th scope="col" className="px-3 py-2">Articolo</th>
              <th scope="col" className="px-3 py-2 text-right">€/t</th>
              <th scope="col" className="px-3 py-2 text-right">€/m</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9efeb]">
            {offer.lines.map(line => (
              <tr key={line.lineId}>
                <td className="px-3 py-2 align-top">
                  <p className="max-w-[260px] font-semibold text-[#2d4235]">
                    {line.position}. {descriptions.get(line.lineId) || "Articolo"}
                  </p>
                  {line.availability !== "quoted" &&
                    <p className="text-[10px] text-[#8b5148]">Non disponibile</p>}
                  {line.deliveryDate && <p className="text-[10px] text-[#738177]">Consegna {date(line.deliveryDate)}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-[#1e5841]">
                  {line.availability === "quoted" ? money(line.priceEurT, 2) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-[#1e5841]">
                  {line.availability === "quoted" ? money(line.priceEurM, 4) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {offer.lines.length === 0 && <p className="p-3 text-xs text-[#68796b]">Nessuna riga offerta disponibile.</p>}
    </section>
  );
}
