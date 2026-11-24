import { createClient } from "@/lib/supabase/server";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { changeCommunityInterest } from "@/lib/community-interest-owner-actions";
import { communityIntakeConfig } from "@/lib/community-intake-config";
import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
const columns="id,kind,locale,name,email,organization,status,created_at,expires_at";
type Lead={id:string;kind:"partner"|"investor";locale:string;name:string;email:string;organization:string|null;status:"new"|"contacted"|"closed";created_at:string;expires_at:string};
export async function CommunityInterestInbox({feedback}:{feedback?:string}) {
  await requirePlatformSuperadmin();
  const enabled=communityIntakeConfig().enabled;
  const db=await createClient();
  const [leads, partners, investors]=await Promise.all([
    db.from("mkt9_community_interest").select(columns).order("created_at",{ascending:false}).limit(100),
    db.from("mkt9_community_interest").select("id",{count:"exact",head:true}).eq("kind","partner"),
    db.from("mkt9_community_interest").select("id",{count:"exact",head:true}).eq("kind","investor"),
  ]);
  const unavailable=!!(leads.error||partners.error||investors.error);
  const rows=(leads.data??[]) as Lead[];
  return <section id="community-interest" className="scroll-mt-6 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="app-kicker">MKT9 · Pre-lancio</p><h2 className="mt-1 text-2xl font-semibold">Manifestazioni di interesse</h2></div><span className="rounded-full border px-3 py-1 text-xs font-semibold">{enabled?"Modulo configurato":"Acquisizione pubblica chiusa"}</span></div>
    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Contatti non verificati, non sono clienti, adesioni o investimenti. Nessun accesso alla Investor Room viene concesso automaticamente.</p>
    {feedback==="updated"?<p role="status" className="mt-3 text-sm text-[var(--semantic-success)]">Richiesta aggiornata.</p>:feedback==="error"?<p role="alert" className="mt-3 text-sm text-[var(--semantic-error)]">Impossibile aggiornare la richiesta.</p>:null}
    {unavailable?<p role="status" className="mt-4 rounded-xl border p-4 text-sm">Archivio non disponibile. Verificare migrazione e permessi; nessun conteggio dichiarato.</p>:<>
      <div className="mt-4 grid grid-cols-2 gap-3">{([["Aziende",partners.count],["Investitori",investors.count]] as const).map(([label,count])=><div key={label} className="rounded-xl border p-4"><p className="text-xs text-[var(--text-secondary)]">{label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{count??"—"}</p></div>)}</div>
      <p className="mt-4 text-xs text-[var(--text-secondary)]">Ultime 100 richieste. Verifica identità e indirizzo prima di procedere; cancella i dati alla scadenza secondo la policy approvata.</p>
      {rows.length===0?<p className="mt-4 text-sm">Nessuna manifestazione ricevuta.</p>:<div className="mt-4 grid gap-3">{rows.map(row=><article key={row.id} className="min-w-0 rounded-xl border border-[var(--border)] p-4">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{row.kind==="partner"?"Azienda":"Investitore"} · {row.locale.toUpperCase()} · Email non verificata</p>
        <h3 className="mt-1 break-words font-semibold">{row.name}</h3>
        <p className="break-all text-sm">{row.email}</p>{row.organization?<p className="break-words text-sm">{row.organization}</p>:null}
        <p className="mt-2 text-xs text-[var(--text-secondary)]">Ricevuta {new Date(row.created_at).toLocaleDateString("it-IT")} · Scadenza {new Date(row.expires_at).toLocaleDateString("it-IT")}</p>
        <form action={changeCommunityInterest} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={row.id}/><select name="status" defaultValue={row.status} aria-label="Stato richiesta" className="min-h-11 rounded-lg border px-3 text-sm"><option value="new">Nuova</option><option value="contacted">Contattata</option><option value="closed">Chiusa</option></select><button className="platform-primary min-h-11 rounded-lg px-3 text-sm font-semibold">Salva</button></form>
        {row.kind==="investor"&&row.status==="contacted"?<Link className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold underline" href={"/platform/fundraising?communityLead="+encodeURIComponent(row.id)+"#new-investor-target"}>Precompila target nel CRM</Link>:null}
        <form action={changeCommunityInterest} className="mt-2"><input type="hidden" name="id" value={row.id}/><input type="hidden" name="status" value="delete"/><ConfirmSubmitButton title="Eliminare la richiesta?" description="I dati di questa manifestazione saranno cancellati definitivamente dall’archivio. Eventuali contatti già registrati nel CRM vanno gestiti separatamente." confirmLabel="Elimina" className="min-h-11 rounded-lg border px-3 text-sm text-[var(--semantic-error)]">Elimina richiesta</ConfirmSubmitButton></form>
      </article>)}</div>}
    </>}
  </section>;
}
