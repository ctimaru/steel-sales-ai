import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <Card className="group overflow-hidden border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.07)]">
      <CardContent className="relative p-5">
        <div className="absolute right-5 top-5 h-2 w-2 rounded-full bg-slate-200 transition group-hover:bg-slate-400" />
        <p className="pr-6 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </p>
        <p className="mt-4 text-[32px] font-semibold leading-none tracking-[-0.035em] text-slate-950">
          {value}
        </p>
        <p className="mt-3 min-h-10 text-[11px] leading-5 text-slate-500">{note}</p>
      </CardContent>
    </Card>
  );
}
