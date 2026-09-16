import { GroundedAssistant } from "@/components/grounded-assistant";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
          Commercial intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          AI Assistant
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Interroga la Commercial Memory in linguaggio naturale. Ogni risposta sensibile resta collegata a
          evidence verificabili: citazione, snippet, documento o thread originale. Se le fonti non bastano,
          l&apos;assistente dichiara che l&apos;evidence è insufficiente invece di inventare i dati mancanti.
        </p>
      </div>

      <GroundedAssistant />
    </div>
  );
}
