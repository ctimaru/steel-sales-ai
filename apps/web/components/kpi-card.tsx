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
    <Card>
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
      </CardContent>
    </Card>
  );
}
