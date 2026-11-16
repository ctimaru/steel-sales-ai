import { RouteLoading } from "@/components/route-loading";

// NET-PROFILE-FAST1: keeps this sub-page from showing the company-profile skeleton of its parent segment.
export default function Loading() {
  return <RouteLoading label="Caricamento…" />;
}
