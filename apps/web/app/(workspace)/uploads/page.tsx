import Link from "next/link";

import { BulkUploadForm } from "@/components/bulk-upload-form";

export const dynamic = "force-dynamic";

export default function UploadsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
            Importa documenti
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Aggiungi documenti allo storico
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Carica email, PDF ed Excel in un’unica operazione. Puoi seguire l’avanzamento di ogni file e riprovare solo quelli che richiedono attenzione.
          </p>
        </div>
        <Link
          href="/data-sources"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Vedi import precedenti
        </Link>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BulkUploadForm />
      </div>
    </div>
  );
}
