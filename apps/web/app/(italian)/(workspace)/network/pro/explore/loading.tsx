import { RouteLoading } from "@/components/route-loading";

// NET-PRO-UX2: keeps the explorer from showing the parent "Moduli e prezzi" skeleton.
export default function Loading() {
  return <RouteLoading label="Caricamento elenco Network PRO…" />;
}
