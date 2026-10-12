import { notFound } from "next/navigation";

import { OperationalEntityDetail } from "@/components/operational-entity-detail";
import { getOperationalEntityData } from "@/lib/commercial-data";

export default async function RFQDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entity = await getOperationalEntityData("rfq", id);

  if (!entity) notFound();

  return <OperationalEntityDetail entity={entity} />;
}
