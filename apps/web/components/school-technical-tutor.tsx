"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { parseSteelAssistantInput } from "@/lib/school-assistant-intent.mjs";
import { matchSchoolTutorTopic } from "@/lib/school-tutor-topics.mjs";

type PublicCitation = { url: string; label: string; role: string };
type PublicEvidence = {
  id: string; code: string; kind: "standards" | "grades";
  title: string; summary: string; technicalContext: string;
  caution: string | null; rfqGuidance: string | null;
  citations: PublicCitation[];
  provenance: { status: "k2_published"; k2LastReviewedAt: string };
};
type LookupState = "idle" | "loading" | "ready" | "topic" | "need_code" | "no_evidence" | "error";
type TutorTopic = { id: string; title: string; description: string; href: string };

const examples = [
  "Qual è la differenza tra EN 10210 e EN 10219?",
  "Cosa indica S355J2H?",
  "Come si producono i tubi saldati e senza saldatura?",
  "Cosa specifica EN 10216-2?",
];
const safeUrl = (url: unknown) => typeof url === "string" && /^https:\/\//i.test(url) ? url : null;
function validEvidence(value: unknown): PublicEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PublicEvidence => {
    if (!item || typeof item !== "object") return false;
    const x = item as Partial<PublicEvidence>;
    return typeof x.id === "string" && typeof x.code === "string" &&
      (x.kind === "standards" || x.kind === "grades") &&
      typeof x.title === "string" && typeof x.summary === "string" &&
      typeof x.technicalContext === "string" && Array.isArray(x.citations) &&
      x.provenance?.status === "k2_published" &&
      typeof x.provenance.k2LastReviewedAt === "string";
  }).slice(0, 4);
}

/** Public foundation: raw questions remain in the browser, only recognized codes reach public K2. */
export function SchoolTechnicalTutor() {
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [items, setItems] = useState<PublicEvidence[]>([]);
  const [topic, setTopic] = useState<TutorTopic | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function ask(value: string) {
    const text = value.trim().slice(0, 500);
    if (!text) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setQuestion(text);
    setItems([]);
    setTopic(null);
    setDraft("");
    const codes = parseSteelAssistantInput(text).codes.slice(0, 2);
    if (!codes.length) {
      const guide = matchSchoolTutorTopic(text);
      setTopic(guide);
      setState(guide ? "topic" : "need_code");
      return;
    }
    setState("loading");
    try {
      const responses = await Promise.all(codes.map(async (code: string) => {
        const qs = new URLSearchParams({ q: code, locale: "it", limit: "2" });
        const response = await fetch("/api/public/school-evidence?" + qs.toString(), {
          method: "GET", credentials: "omit", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Public source unavailable");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !Array.isArray((result as {items?: unknown}).items))
          throw new Error("Invalid public source result");
        return validEvidence((result as {items: unknown[]}).items);
      }));
      if (controller.signal.aborted) return;
      const verified = [...new Map(responses.flat().map(item => [item.id, item])).values()].slice(0, 4);
      setItems(verified);
      setState(verified.length ? "ready" : "no_evidence");
    } catch {
      if (controller.signal.aborted) return;
      setState("error");
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "loading") return;
    void ask(draft);
  }

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-[26px] border border-[#d1ded5] bg-white shadow-[0_12px_45px_-35px_rgba(9,44,30,.5)]" aria-labelledby="school-professor-title">
      <div className="relative isolate overflow-hidden bg-[#0b251d] px-5 py-7 text-white sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-[position:75%_center] opacity-35" style={{backgroundImage:"url('/home-cine1a-steel.webp')"}} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#0b251d_0%,rgba(11,37,29,.95)_64%,rgba(11,37,29,.62)_100%)]" />
        <div className="relative flex max-w-3xl items-start gap-4">
          <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#87b9a0]/40 bg-[#254e3d] shadow-inner sm:h-16 sm:w-16">
            <svg viewBox="0 0 48 48" className="h-9 w-9 text-[#d3efdb]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 24 9l17 8-17 8L7 17Z" /><path d="M14 22v8c6 5 14 5 20 0v-8M41 17v13" /><path d="M16 39c5-3 11-3 16 0" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#b9dfc7]">Smart Steel School · Professore tecnico</p>
            <h1 id="school-professor-title" className="mt-2 text-3xl font-semibold tracking-[-.04em] text-white sm:text-[2.6rem]">Ciao, cosa vuoi capire?</h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-7 text-[#dfefe4]">Partiamo dalle fonti pubblicate. Chiedimi una norma o un grado di acciaio: ti accompagno alle spiegazioni e agli strumenti giusti.</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <form onSubmit={submit} role="search" aria-label="Consulta il Professore tecnico" className="space-y-3">
          <label htmlFor="tutor-question" className="block text-sm font-semibold text-[#244d3c]">La tua domanda</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="tutor-question" type="search" maxLength={500} value={draft}
              onChange={event => setDraft(event.target.value)} placeholder="Es. Qual è la differenza tra EN 10210 e EN 10219?"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#bfd3c5] bg-white px-4 text-[15px] text-[#1a3027] placeholder:text-[#6a7b70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#247455]" />
            <button type="submit" disabled={!draft.trim() || state === "loading"}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#176747] px-5 text-sm font-bold text-white transition hover:bg-[#23583f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] disabled:cursor-not-allowed disabled:opacity-50">
              {state === "loading" ? "Consulto le fonti…" : "Chiedi al professore"} <span aria-hidden="true" className="ml-2">→</span>
            </button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#607166]">Puoi iniziare da qui:</span>
          {examples.map(example => <button key={example} type="button" onClick={() => void ask(example)}
            disabled={state === "loading"} className="rounded-full border border-[#d4e0d7] bg-[#f4f8f5] px-3 py-2 text-left text-xs font-semibold text-[#25533e] transition hover:border-[#8bb6a0] hover:bg-[#eaf4ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] disabled:opacity-50">
            {example}
          </button>)}
        </div>
        <p className="mt-4 text-xs leading-5 text-[#617469]">Modalità iniziale: consultazione guidata delle fonti verificate, non conversazione AI generativa. La domanda completa rimane nel browser; vengono trasmessi solo i codici tecnici riconosciuti.</p>
      </div>
    </section>

    <section aria-live="polite" aria-atomic="false" className="min-h-0">
      {state !== "idle" ? <div className="rounded-[22px] border border-[#d4e1d8] bg-white p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#2b7150]">Consultazione tecnica</p>
        <h2 className="mt-2 text-lg font-semibold text-[#173c2d]">{question}</h2>
        {state === "loading" ? <p className="mt-3 text-sm text-[#536b5e]">Verifico i riferimenti pubblicati…</p> : null}
        {state === "topic" && topic ? <div className="mt-4 rounded-[18px] border border-[#d2e3d6] bg-[#f4f8f5] p-4">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[#246548]">Percorso di approfondimento</p>
          <h3 className="mt-2 text-lg font-semibold text-[#194330]">{topic.title}</h3>
          <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[#52695a]">{topic.description}</p>
          <Link href={topic.href} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#176747] px-4 text-sm font-bold text-white hover:bg-[#23583f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">Apri la guida con fonti →</Link>
        </div> : null}
        {state === "need_code" ? <p className="mt-3 text-sm leading-6 text-[#536b5e]">Per questa prima versione indicami una norma precisa (per esempio EN 10219) o una designazione completa (per esempio S355J2H). Non deduco sigle o requisiti mancanti.</p> : null}
        {state === "no_evidence" ? <p className="mt-3 text-sm leading-6 text-[#536b5e]">Non ho trovato schede pubblicate verificabili per questi codici. Non significa che la norma o il materiale non esistano: puoi cercare direttamente nel catalogo.</p> : null}
        {state === "error" ? <p className="mt-3 text-sm leading-6 text-[#536b5e]">Le fonti non sono disponibili in questo momento. Non presenterò spiegazioni tecniche senza riscontro.</p> : null}
        {state === "ready" ? <>
          <p className="mt-3 text-sm leading-6 text-[#536b5e]">Ho trovato {items.length} {items.length === 1 ? "scheda pubblicata" : "schede pubblicate"}. Ecco cosa riportano le fonti, senza dedurre equivalenze o idoneità del prodotto.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {items.map(item => {
              const page = item.citations.find(c => c.role === "public_page" && safeUrl(c.url));
              const more = item.citations.filter(c => c.role !== "public_page" && safeUrl(c.url)).slice(0, 2);
              return <article key={item.id} className="flex flex-col rounded-[18px] border border-[#d8e4dc] bg-[#fafcfb] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-lg bg-[#e8f2eb] px-2 py-1 font-mono text-[11px] font-bold text-[#225a40]">{item.code}</span>
                  <span className="text-[11px] text-[#617468]">Rivisto: {item.provenance.k2LastReviewedAt}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-[#193d2e]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#4c6055]">{item.summary}</p>
                <p className="mt-2 text-sm leading-6 text-[#4c6055]">{item.technicalContext.slice(0, 500)}</p>
                {item.caution ? <p className="mt-3 border-l-2 border-[#a0b9a8] pl-3 text-xs leading-5 text-[#516b5c]">{item.caution.slice(0, 260)}</p> : null}
                <div className="mt-auto flex flex-wrap gap-3 border-t border-[#e0eae2] pt-4 text-xs font-bold text-[#176747]">
                  {page ? <a href={page.url} className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">Leggi la scheda completa ↗</a> : null}
                  {more.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">{source.label} ↗</a>)}
                </div>
              </article>;
            })}
          </div>
          <p className="mt-4 text-xs leading-6 text-[#617468]">Verifica sempre l'edizione ufficiale della norma e la specifica applicabile prima di usarla per una richiesta d'offerta. Questa consultazione non certifica materiali e non invia RFQ.</p>
        </> : null}
        <div className="mt-5 flex flex-wrap gap-3 border-t border-[#e4ece6] pt-4 text-xs font-semibold">
          <Link href="/knowledge/norme" className="text-[#19563b] underline underline-offset-4">Catalogo norme</Link>
          <Link href="/knowledge/gradi" className="text-[#19563b] underline underline-offset-4">Catalogo materiali</Link>
          <Link href="/knowledge/tubes?source=school&surface=tutor#calcolatore-pesi" className="text-[#19563b] underline underline-offset-4">Calcolatore pesi</Link>
        </div>
      </div> : null}
    </section>

    <section className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#d6e3db] bg-[#eef5f0] p-4 sm:px-5">
      <div>
        <p className="text-sm font-semibold text-[#1e4a35]">Vuoi continuare nell'area aziendale?</p>
        <p className="mt-1 max-w-xl text-xs leading-5 text-[#556d5c]">L'assistente riservato permette un dialogo guidato e, solo quando abilitata, una sintesi AI con fonti e controlli di utilizzo.</p>
      </div>
      <Link href="/school/assistant" className="inline-flex min-h-10 items-center rounded-xl border border-[#b5d0bf] bg-white px-4 text-xs font-bold text-[#1c5138] hover:bg-[#e7f1e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">Apri l'assistente aziendale ↗</Link>
    </section>
  </div>;
}
