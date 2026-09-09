import { UploadForm } from "@/components/upload-form";

export default function UploadsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
          Ingestion
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Upload documenti
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Invia un archivio o un documento commerciale al worker per l&apos;estrazione
          strutturata e la successiva revisione.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <UploadForm />
      </div>
    </div>
  );
}
