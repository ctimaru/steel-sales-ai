import { createHash } from "node:crypto";

import type { Metadata } from "next";

import { Rfqh9SupplierPoPortal } from "@/components/rfqh9-supplier-po-portal";
import type { Rfqh9SupplierPortal } from "@/lib/rfqh9-po";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Purchase Order · Smart Steel Sales",
  robots: { index: false, follow: false },
};

type Params = Promise<{ token: string }>;

export default async function SupplierPurchaseOrderPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;
  const cleanToken = token.trim();
  const supabase = await createClient();

  const { data } = await supabase.rpc("rfqh9_supplier_portal", {
    p_token_hash: createHash("sha256").update(cleanToken).digest("hex"),
  });

  const portal =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Rfqh9SupplierPortal)
      : null;

  if (!portal?.valid) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <section className="rounded-3xl border border-[#dce2df] bg-white p-7">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Smart Steel Sales · Purchase Order
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Link ordine non valido
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Il link non corrisponde a una versione PO disponibile. Chiedi al buyer
            di inviarti il collegamento corretto.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f4] print:bg-white">
      <Rfqh9SupplierPoPortal token={cleanToken} portal={portal} />
    </main>
  );
}
