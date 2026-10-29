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
type GuidedFollowUp = { evidenceId: string; kind: "context" | "caution" };

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

/** One original teacher illustration reused on mobile and desktop, without any new media or AI. */
function TeacherPortrait({ state, className }: { state: LookupState; className: string }) {
  return (<svg viewBox="0 0 180 180" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="90" cy="77" r="62" fill="#366B50" stroke="#A9D2B8" strokeOpacity=".5"/>
              <path d="M36 154c5-31 24-45 54-45s49 14 54 45" fill="#D3E9DD"/>
              <path d="m72 110 18 18 18-18-5-8H77l-5 8Z" fill="#B4D8BF"/>
              <path d="M64 63c0-22 10-37 26-37s26 15 26 37v13c0 23-12 40-26 40S64 99 64 76V63Z" fill="#EBC7A7"/>
              <path d="M60 70c-2-31 10-49 32-49 20 0 33 17 28 46l-5-9c-2-15-10-23-21-23-7 0-16 9-30 9l-4 26Z" fill="#20392E"/>
              <path d="M67 73h18m10 0h18M85 73h10" stroke="#20392E" strokeWidth="4" strokeLinecap="round"/>
              {state === "loading"
                ? <path d="M83 95h14" stroke="#985E46" strokeWidth="2.5" strokeLinecap="round"/>
                : state === "ready" || state === "topic"
                  ? <path d="M81 94q9 9 18 0" stroke="#985E46" strokeWidth="2.5" strokeLinecap="round"/>
                  : <path d="M83 95c4 3 10 3 14 0" stroke="#985E46" strokeWidth="2.5" strokeLinecap="round"/>}
              <path d="m69 126 20 24 21-24" stroke="#356A4E" strokeWidth="4" strokeLinejoin="round"/>
              <path d="M34 156h112" stroke="#A9D2B8" strokeWidth="3" strokeLinecap="round"/>
            </svg>);
}

/** Public foundation: raw questions remain in the browser, only recognized codes reach public K2. */
export function SchoolTechnicalTutor() {
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [items, setItems] = useState<PublicEvidence[]>([]);
  const [topic, setTopic] = useState<TutorTopic | null>(null);
  const [followUp, setFollowUp] = useState<GuidedFollowUp | null>(null);
  const presence = state === "loading" ? "Consulto le fonti…"
    : state === "ready" ? "Ho trovato le fonti"
    : state === "topic" ? "Ti propongo una lettura"
    : state === "idle" ? "Sono qui per aiutarti"
    : "Verifichiamo insieme le fonti";
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
    setFollowUp(null);
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
      <div className="relative isolate overflow-hidden bg-[#0b251d] px-5 py-5 text-white sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-[position:75%_center] opacity-35" style={{backgroundImage:"url('/home-cine1a-steel.webp')"}} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#0b251d_0%,rgba(11,37,29,.95)_64%,rgba(11,37,29,.62)_100%)]" />
        <div className="relative grid max-w-[930px] items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(145px,210px)] sm:gap-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#b9dfc7]">Smart Steel School · Il Professore</p>
            <h1 id="school-professor-title" className="mt-2 max-w-[17ch] text-[2rem] font-semibold leading-[1.12] tracking-[-.045em] text-white sm:text-[2.55rem]">Come posso aiutarti?</h1>
            <p className="mt-2 max-w-[55ch] text-sm leading-6 text-[#dfefe4]">Chiedimi di norme, acciai o tubi. Partiamo insieme dalle fonti pubblicate.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
              <div data-testid="school-qa3-mobile-portrait" aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#a9d2b8]/50 bg-[#24503b]/75 sm:hidden">
                <TeacherPortrait state={state} className="h-[72px] w-[72px] shrink-0 translate-y-1"/>
              </div>
              <span data-testid="school-tutor3-presence" className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#e1f2e6]">
                <span aria-hidden="true" className={state === "loading"
                  ? "h-2 w-2 rounded-full bg-[#9bdfb8] motion-safe:animate-pulse"
                  : "h-2 w-2 rounded-full bg-[#9bdfb8]"} />
                {presence}
              </span>
              <span className="text-[11px] font-medium text-[#c9e1d2]">Consultazione guidata · Fonti pubblicate K2</span>
            </div>
          </div>
          <div aria-hidden="true" className="hidden h-[176px] w-[176px] items-center justify-center justify-self-center rounded-[30px] border border-[#a9d2b8]/35 bg-[#24503b]/65 shadow-[0_20px_40px_-20px_rgba(2,18,12,.6)] sm:flex">
            <TeacherPortrait state={state} className="h-[155px] w-[155px]"/>
          </div>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-7 sm:py-5">
        <form onSubmit={submit} role="search" aria-label="Consulta il Professore tecnico" className="space-y-2">
          <label htmlFor="tutor-question" className="block text-sm font-semibold text-[#244d3c]">La tua domanda</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="tutor-question" type="search" maxLength={500} value={draft}
              onChange={event => setDraft(event.target.value)} placeholder="Es. Qual è la differenza tra EN 10210 e EN 10219?"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#bfd3c5] bg-white px-4 text-[15px] text-[#1a3027] placeholder:text-[#6a7b70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#247455]" />
            <button type="submit" disabled={!draft.trim() || state === "loading"}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#176747] px-5 text-sm font-bold text-white transition hover:bg-[#23583f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] disabled:cursor-not-allowed disabled:bg-[#dce8df] disabled:text-[#28543c] disabled:hover:bg-[#dce8df]">
              {state === "loading" ? "Consulto le fonti…" : "Chiedi al professore"} <span aria-hidden="true" className="ml-2">→</span>
            </button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="school-qa3-prompt-suggestions">
          <span className="w-full text-xs text-[#607166] sm:w-auto">Puoi iniziare da qui:</span>
          {examples.slice(0, 2).map(example => <button key={example} type="button" onClick={() => void ask(example)}
            disabled={state === "loading"} className="min-h-10 rounded-full border border-[#d4e0d7] bg-[#f4f8f5] px-3 py-2 text-left text-xs font-semibold text-[#25533e] transition hover:border-[#8bb6a0] hover:bg-[#eaf4ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] disabled:opacity-50">
            {example}
          </button>)}
          <details data-testid="school-qa3-more-questions" className="w-full sm:w-auto">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-full border border-[#d4e0d7] bg-white px-3 text-xs font-semibold text-[#25533e] hover:bg-[#f4f8f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] [&::-webkit-details-marker]:hidden">
              Altre domande <span aria-hidden="true" className="ml-2">+</span>
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {examples.slice(2).map(example => <button key={example} type="button" onClick={() => void ask(example)}
                disabled={state === "loading"} className="min-h-10 rounded-full border border-[#d4e0d7] bg-[#f4f8f5] px-3 py-2 text-left text-xs font-semibold text-[#25533e] transition hover:border-[#8bb6a0] hover:bg-[#eaf4ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] disabled:opacity-50">
                {example}
              </button>)}
            </div>
          </details>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[#617469]">Consultazione guidata delle fonti pubblicate, non conversazione AI generativa. La domanda resta nel browser: alla ricerca inviamo solo i codici tecnici riconosciuti.</p>
      </div>
    </section>

    <section aria-live="polite" aria-atomic="false" className="min-h-0">
      {state !== "idle" ? <div className="rounded-[22px] border border-[#d4e1d8] bg-white p-4 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#2b7150]">Il Professore risponde con le fonti</p>
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
          <p className="mt-3 text-sm leading-6 text-[#536b5e]">Ho consultato {items.length} {items.length === 1 ? "riferimento pubblicato" : "riferimenti pubblicati"}. Ti riporto le informazioni disponibili, senza dedurre equivalenze o idoneità del prodotto.</p>
          <div className="mt-4 grid gap-3">
            {items.map(item => {
              const page = item.citations.find(c => c.role === "public_page" && safeUrl(c.url));
              const more = item.citations.filter(c => c.role !== "public_page" && safeUrl(c.url)).slice(0, 2);
              return <article key={item.id} className="flex flex-col rounded-[18px] border border-[#d8e4dc] bg-[#fafcfb] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-lg bg-[#e8f2eb] px-2 py-1 font-mono text-[11px] font-bold text-[#225a40]">{item.code}</span>
                  <span className="text-[11px] text-[#617468]">Rivisto: {item.provenance.k2LastReviewedAt}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-[#193d2e]">{item.title}</h3>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[.1em] text-[#286446]">In breve · Riferimento pubblicato</p>
                <p className="mt-2 text-sm leading-6 text-[#344e3f]">{item.summary}</p>
                <div data-testid="school-tutor3-guided-followups" role="group" aria-label={"Approfondimenti per " + item.code}
                  className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="w-full text-xs font-medium text-[#586d60]">Vuoi approfondire?</span>
                  {([
                    { kind: "context", label: "Approfondisci il contesto tecnico" },
                    { kind: "caution", label: "Che cosa devo verificare?" },
                  ] as const).map(option => {
                    const selected = followUp?.evidenceId === item.id && followUp.kind === option.kind;
                    return <button key={option.kind} type="button"
                      aria-expanded={selected} aria-controls={selected ? "tutor-followup-" + item.id : undefined}
                      onClick={() => setFollowUp(selected ? null : { evidenceId: item.id, kind: option.kind })}
                      className={selected
                        ? "min-h-10 rounded-xl border border-[#247455] bg-[#e9f4ed] px-3 text-xs font-bold text-[#194f38] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"
                        : "min-h-10 rounded-xl border border-[#d3e2d8] bg-white px-3 text-xs font-semibold text-[#225940] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"}>
                      {option.label} <span aria-hidden="true">↗</span>
                    </button>;
                  })}
                </div>
                {followUp?.evidenceId === item.id ? (
                  <div id={"tutor-followup-" + item.id} data-testid="school-tutor3-grounded-followup"
                    className="mt-3 rounded-xl border-l-2 border-[#3a8763] bg-white px-4 py-3"
                    aria-label={followUp.kind === "context" ? "Contesto tratto dalla fonte" : "Cautele e limiti"}>
                    <p className="text-xs font-bold text-[#1a5b3d]">{followUp.kind === "context" ? "Dalla scheda pubblicata" : "Prima di applicare questa informazione"}</p>
                    <p className="mt-1 text-sm leading-6 text-[#425c4d]">{followUp.kind === "context"
                      ? item.technicalContext.slice(0, 500)
                      : item.caution
                        ? item.caution.slice(0, 260)
                        : "La scheda non indica cautele specifiche. Verifica sempre l'edizione ufficiale e le condizioni applicabili al tuo caso."}</p>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#e0eae2] pt-3 text-xs font-bold text-[#176747]">
                  {page ? <a href={page.url} className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">Leggi la scheda completa ↗</a> : null}
                  {more.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">{source.label} ↗</a>)}
                </div>
              </article>;
            })}
          </div>
          <p className="mt-4 text-xs leading-6 text-[#617468]">Verifica sempre l'edizione ufficiale della norma e la specifica applicabile prima di usarla per una richiesta d'offerta. Questa consultazione non certifica materiali e non invia RFQ.</p>
        </> : null}
        <div data-testid="school-tutor3-next-steps" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[#e4ece6] pt-4 text-xs font-semibold">
          <span className="w-full text-[11px] font-bold uppercase tracking-[.1em] text-[#607467]">Continua il tuo percorso</span>
          <Link href="/knowledge/norme" className="text-[#19563b] underline underline-offset-4">Catalogo norme</Link>
          <Link href="/knowledge/gradi" className="text-[#19563b] underline underline-offset-4">Catalogo materiali</Link>
          <Link href="/knowledge/tubes?source=school&surface=tutor#calcolatore-pesi" className="text-[#19563b] underline underline-offset-4">Calcolatore pesi</Link>
        </div>
      </div> : null}
    </section>

  </div>;
}
