import {NetworkProCatalog} from "@/components/network-pro-catalog";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {redirect} from "next/navigation";

export default function NetworkProCatalogPage() {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");
  // Workspace layout authenticates the viewer; catalog is informational for Free and PRO.
  return <NetworkProCatalog />;
}
