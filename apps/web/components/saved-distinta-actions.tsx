"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  duplicateSavedDistinta, renameSavedDistinta, setSavedDistintaArchived,
} from "@/app/(italian)/(workspace)/rfq-hub/distinte/actions";
import { appRoutes } from "@/lib/routes";

export function SavedDistintaActions({
  id,title,archived,compact=false,
}: {id:string;title:string;archived:boolean;compact?:boolean}) {
  const router=useRouter();
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{setHydrated(true);},[]);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(title);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [pending,startTransition]=useTransition();

  function closeEditing() {setEditing(false);setDraft(title);setError("");}
  function rename() {
    startTransition(async()=>{
      setError("");setMessage("");
      const result=await renameSavedDistinta(id,draft);
      if(!result.ok){setError(result.error||"Impossibile salvare.");return;}
      setEditing(false);setMessage("Nome aggiornato.");router.refresh();
    });
  }
  function archive() {
    startTransition(async()=>{
      setError("");setMessage("");
      const result=await setSavedDistintaArchived(id,!archived);
      if(!result.ok){setError(result.error||"Operazione non riuscita.");return;}
      setMessage(archived?"Distinta ripristinata.":"Distinta archiviata senza cancellarla.");
      router.refresh();
    });
  }
  function duplicate() {
    startTransition(async()=>{
      setError("");setMessage("");
      const result=await duplicateSavedDistinta(id);
      if(!result.ok||!result.distintaId){setError(result.error||"Impossibile duplicare.");return;}
      router.push(appRoutes.rfqHub.savedDistinta(result.distintaId));
      router.refresh();
    });
  }

  return <div data-saved-distinta-actions data-distinta-id={id}
    data-distinta-hydrated={hydrated?"true":"false"}
    className={compact?"flex flex-wrap items-center gap-1.5":"flex flex-wrap items-center gap-2"}>
    {editing?<form onSubmit={e=>{e.preventDefault();rename();}} className="flex min-w-0 flex-wrap items-center gap-2">
      <label className="min-w-0 text-xs font-semibold text-[var(--brand-deep)]">
        Nuovo nome
        <input data-saved-distinta-rename-input autoFocus type="text" required maxLength={120}
          value={draft} onChange={e=>setDraft(e.target.value)}
          className="mt-1 block h-11 w-full min-w-[12rem] max-w-[21rem] rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm font-semibold text-[var(--brand-deep)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"/>
      </label>
      <button disabled={!hydrated||pending||!draft.trim()||draft.trim().length>120} type="submit"
        className="platform-primary min-h-11 rounded-lg px-3 text-xs font-bold">Conferma</button>
      <button disabled={!hydrated||pending} type="button" onClick={closeEditing}
        className="app-secondary min-h-11 rounded-lg px-3 text-xs font-semibold">Annulla</button>
    </form>:<>
      <button type="button" data-action-rename onClick={()=>{setEditing(true);setDraft(title);setMessage("");setError("");}}
        disabled={!hydrated||pending} className="app-secondary min-h-11 rounded-lg px-3 text-xs font-semibold">Rinomina</button>
      <button type="button" data-action-duplicate onClick={duplicate} disabled={!hydrated||pending}
        className="app-secondary min-h-11 rounded-lg px-3 text-xs font-semibold">Duplica</button>
      <button type="button" data-action-archive onClick={archive} disabled={!hydrated||pending}
        aria-label={archived?"Ripristina distinta":"Archivia distinta"}
        className="app-secondary min-h-11 rounded-lg px-3 text-xs font-semibold">
        {archived?"Ripristina":"Archivia"}
      </button>
    </>}
    {pending?<span role="status" className="text-xs text-[var(--text-secondary)]">Operazione in corso…</span>:null}
    {error?<p role="alert" className="w-full text-xs font-semibold text-red-700">{error}</p>:null}
    {message?<p role="status" className="w-full text-xs font-semibold text-[var(--brand-primary)]">{message}</p>:null}
  </div>;
}
