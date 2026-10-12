import { redirect } from "next/navigation";

export default async function LegacyAdminRegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect("/platform/registrations/" + id);
}
