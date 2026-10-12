import { KnowledgeExplorer } from "@/components/knowledge-explorer";

export default function KnowledgeExplorerPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-semibold text-slate-500">Semantic Intelligence</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Knowledge Explorer
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Ricerca libera e strutturata su documenti, offerte, ordini e knowledge aziendale.
          Ogni risultato è grounded nella fonte originale con score e provenance visibili.
        </p>
      </div>

      <div className="mt-7">
        <KnowledgeExplorer />
      </div>
    </div>
  );
}
