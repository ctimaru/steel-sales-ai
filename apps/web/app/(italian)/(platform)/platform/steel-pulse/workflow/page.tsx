import Link from "next/link";
import {redirect} from "next/navigation";
import {requirePlatformConsoleContext} from "@/lib/platform-admin";
import {createClient} from "@/lib/supabase/server";
import {saveSteelPulseDraft,submitSteelPulseDraft,reviewSteelPulseDraft} from "./actions";

export const dynamic="force-dynamic";
const BASE="/platform/steel-pulse/workflow";
const FILTERS=["all","unassigned","draft","in_review","editor_approved"];
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
type Item={item_id:string;status:string;headline:string|null;source_name:string};
type Card={id:string;status:string;revision:number;authored_by:string;headline:string;summary:string;relevance:string;topic:string;language_code:string};
type Detail={source:{item_id:string;source_status:string;source_name:string};card:Card|null;history:{event:string;revision:number}[]};
function rec(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function queue(v:unknown,s:string):Item[]|null{return rec(v)&&v.state===s&&v.limit===25&&Array.isArray(v.items)&&v.items.length<=25&&v.items.every((x:unknown)=>rec(x)&&typeof x.item_id==="string"&&UUID.test(x.item_id)&&typeof x.status==="string"&&typeof x.source_name==="string")?v.items:null;}
function detail(v:unknown,id:string):Detail|null {if(!rec(v)||!rec(v.source)||v.source.item_id!==id||typeof v.source.source_status!=="string"||!Array.isArray(v.history))return null;const c=v.card;if(c!==null&&(!rec(c)||typeof c.id!=="string"||!UUID.test(c.id)||typeof c.status!=="string"||typeof c.revision!=="number"||typeof c.authored_by!=="string"))return null;return v as Detail;}
const field="w-full rounded-lg border border-[#bdd1c3] bg-white px-3 py-2.5 text-sm text-[#173f35]";
const button="min-h-11 rounded-lg bg-[#176045] px-4 text-xs font-semibold text-white";
export default async function Workflow({searchParams}:{searchParams:Promise<{status?:string;item?:string;outcome?:string}>}){
 const a=await requirePlatformConsoleContext();if(!a.permissions.includes("knowledge.read_drafts"))redirect("/platform");
 const p=await searchParams,s=FILTERS.includes(p.status??"")?p.status!:"all",id=p.item&&UUID.test(p.item)?p.item:null;
 let items:Item[]|null=null,d:Detail|null=null;
 try{const db=await createClient(),q=await db.rpc("sp3_editorial_queue",{p_state:s,p_limit:25});
 if(!q.error)items=queue(q.data,s);
 if(items&&id&&items.some(x=>x.item_id===id)){const r=await db.rpc("sp3_editorial_detail",{p_item_id:id});if(!r.error)d=detail(r.data,id);}
 }catch{items=null;}
 const selected=items?.find(x=>x.item_id===id),c=d?.card,own=c?.authored_by===a.user_id;
 const save=!!selected&&!!d&&a.permissions.includes("knowledge.edit")&&d.source.source_status==="approved"&&(!c||(c.status==="draft"&&own));
 const submit=!!c&&own&&a.permissions.includes("knowledge.edit")&&c.status==="draft";
 const review=!!c&&!own&&a.permissions.includes("knowledge.review")&&c.status==="in_review";
 const labels:Record<string,string>={saved:"Bozza salvata privatamente.",submitted:"Inviata in revisione.",approved:"Fact-check approvato: nessuna pubblicazione.",rejected:"Correzioni richieste.",invalid:"Dati non validi.",denied:"Operazione negata o revisione scaduta."};
 return <main className="mx-auto max-w-6xl min-w-0 space-y-4 pb-10">
 <header className="rounded-2xl border border-[#d8e5dd] bg-white p-5"><p className="text-xs font-bold uppercase text-[#22634f]">SP8.B · Editorial Workflow</p><h1 className="mt-1 text-2xl font-semibold text-[#173f35]">Steel Pulse · Bozze e revisioni</h1><p className="mt-2 text-sm text-[#52645a]">Bozze originali e fact-check indipendente. SP7.2 sospeso: nessuna fonte o pubblicazione attivata.</p><Link href="/platform/knowledge" className="mt-3 inline-flex text-xs font-semibold text-[#176045] underline">Knowledge Operations →</Link></header>
 {p.outcome&&labels[p.outcome]?<p role="status" className="rounded-lg bg-[#e9f6ec] p-3 text-sm">{labels[p.outcome]}</p>:null}
 <nav aria-label="Fasi Steel Pulse" className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map(f=><Link key={f} href={BASE+"?status="+f} aria-current={s===f?"page":undefined} className="min-h-10 shrink-0 rounded-lg border border-[#cad9cf] bg-white px-3 py-2 text-xs font-semibold text-[#175640]">{f.replaceAll("_"," ")}</Link>)}</nav>
 <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
 <section aria-label="Coda editoriale" className="min-w-0 rounded-2xl border border-[#d8e5dd] bg-white p-4"><h2 className="font-semibold text-[#173f35]">Coda editoriale</h2>{!items?<p role="alert" className="mt-3 text-sm">Coda non verificabile.</p>:!items.length?<p role="status" className="mt-3 text-sm text-[#52645a]">Nessuna fonte acquisita: le demo della Home non sono bozze.</p>:items.map(x=><Link key={x.item_id} href={BASE+"?status="+s+"&item="+x.item_id} className="mt-2 block rounded-lg border border-[#d8e5dd] p-3 text-sm text-[#173f35]"><span className="text-xs text-[#52645a]">{x.status} · {x.source_name}</span><p className="mt-1 font-semibold">{x.headline||"Materiale senza bozza"}</p><span className="text-xs text-[#176045]">Apri →</span></Link>)}</section>
 <section aria-label="Scheda editoriale" className="min-w-0 space-y-4 rounded-2xl border border-[#d8e5dd] bg-white p-4"><h2 className="text-lg font-semibold text-[#173f35]">Scheda e prossima azione</h2>
 {!selected?<p className="text-sm text-[#52645a]">Seleziona una scheda nella coda.</p>:!d?<p role="alert">Dettaglio non verificabile.</p>:<>
 <p className="text-xs text-[#52645a]">{c?.status??"unassigned"} · Rev. {c?.revision??0} · Fonte {d.source.source_status}</p>
 {save?<form action={saveSteelPulseDraft} className="space-y-2 rounded-xl bg-[#f5faf6] p-3"><h3 className="font-semibold">Bozza originale</h3><input type="hidden" name="item" value={selected.item_id}/><input type="hidden" name="revision" value={c?.revision??0}/>
 <label className="block text-xs">Titolo (25–160)<input name="headline" required minLength={25} maxLength={160} defaultValue={c?.headline??""} className={field}/></label>
 <label className="block text-xs">Sintesi (60–650)<textarea name="summary" required minLength={60} maxLength={650} rows={3} defaultValue={c?.summary??""} className={field}/></label>
 <label className="block text-xs">Rilevanza (40–380)<textarea name="relevance" required minLength={40} maxLength={380} rows={2} defaultValue={c?.relevance??""} className={field}/></label>
 <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs">Tema<select name="topic" defaultValue={c?.topic??"market"} className={field}>{["market","trade","regulation","raw_materials","technology","companies"].map(v=><option key={v} value={v}>{v}</option>)}</select></label><label className="text-xs">Lingua<select name="language" defaultValue={c?.language_code??"it"} className={field}><option value="it">IT</option><option value="en">EN</option></select></label></div>
 <button type="submit" className={button}>Salva bozza privata</button></form>:c?<article className="rounded-lg bg-[#f5faf6] p-3"><h3 className="font-semibold">{c.headline}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{c.summary}</p><p className="mt-2 text-sm">{c.relevance}</p></article>:null}
 {submit?<form action={submitSteelPulseDraft} className="space-y-2 rounded-lg border border-[#c8dfce] p-3"><input type="hidden" name="item" value={selected.item_id}/><input type="hidden" name="revision" value={c!.revision}/><label className="block text-xs">Nota al revisore<textarea name="reason" required minLength={8} maxLength={2000} rows={2} className={field}/></label><button className={button}>Invia a revisione indipendente</button></form>:null}
 {review?<div className="space-y-2 rounded-lg border border-[#c8dfce] p-3"><h3 className="font-semibold">Revisione indipendente</h3>{(["editor_approve","editor_reject"] as const).map(decision=><form key={decision} action={reviewSteelPulseDraft} className="space-y-2 border-t pt-2"><input type="hidden" name="item" value={selected.item_id}/><input type="hidden" name="revision" value={c!.revision}/><input type="hidden" name="decision" value={decision}/>{decision==="editor_approve"?<label className="block text-xs">Fonte per fact-check (HTTPS)<input required name="evidence" type="url" maxLength={1024} className={field}/></label>:null}<label className="block text-xs">Motivazione<textarea name="reason" required minLength={8} maxLength={2000} rows={2} className={field}/></label><button className={button}>{decision==="editor_approve"?"Approva fact-check (non pubblica)":"Richiedi correzioni"}</button></form>)}</div>:null}
 {!save&&!submit&&!review?<p role="status" className="text-sm text-[#52645a]">Nessuna azione consentita: verifica ruoli, fonte e indipendenza autore/revisore.</p>:null}
 <section aria-label="Cronologia" className="rounded-lg border p-3"><h3 className="font-semibold">Audit</h3>{d.history.map((h,i)=><p key={i} className="mt-1 text-xs">{h.event} · rev. {h.revision}</p>)}</section>
 </>}
 </section></div><p className="text-xs text-[#52645a]">Niente approvazione legale, crawler o pubblicazione in SP8.B.</p></main>;
}
