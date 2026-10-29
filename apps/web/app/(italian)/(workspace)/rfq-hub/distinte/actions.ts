"use server";

import { revalidatePath } from "next/cache";

import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

type Result = { ok: boolean; error?: string; distintaId?: string };

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validTitle=(s:string)=>s.trim().length>0 && s.trim().length<=120 && !/[\x00-\x1f\x7f]/.test(s);

function revalidateSaved(id?:string) {
  revalidatePath(appRoutes.rfqHub.savedDistinte);
  revalidatePath(appRoutes.commercial.home);
  if(id) revalidatePath(appRoutes.rfqHub.savedDistinta(id));
}

export async function renameSavedDistinta(id:string,title:string):Promise<Result> {
  if(!UUID_RE.test(id)||typeof title!=="string"||!validTitle(title))
    return {ok:false,error:"Inserisci un nome valido (massimo 120 caratteri)."};
  const ctx=await getWorkspaceContext();
  if(!canWriteWorkspace(ctx.role)) return {ok:false,error:"Accesso in sola lettura."};
  const supabase=await createClient();
  const {data,error}=await supabase.from("buyer_distintas")
    .update({title:title.trim()})
    .eq("id",id).eq("owner_user_id",ctx.userId).eq("organization_id",ctx.organizationId)
    .select("id").maybeSingle();
  if(error||!data) return {ok:false,error:"Impossibile rinominare questa distinta. Verifica permessi e riprova."};
  revalidateSaved(id);
  return {ok:true,distintaId:id};
}

export async function setSavedDistintaArchived(id:string,archived:boolean):Promise<Result> {
  if(!UUID_RE.test(id)||typeof archived!=="boolean")
    return {ok:false,error:"Distinta non valida."};
  const ctx=await getWorkspaceContext();
  if(!canWriteWorkspace(ctx.role)) return {ok:false,error:"Accesso in sola lettura."};
  const supabase=await createClient();
  const {data,error}=await supabase.from("buyer_distintas")
    .update({archived_at:archived?new Date().toISOString():null})
    .eq("id",id).eq("owner_user_id",ctx.userId).eq("organization_id",ctx.organizationId)
    .select("id").maybeSingle();
  if(error||!data) return {ok:false,error:"Impossibile cambiare lo stato della distinta."};
  revalidateSaved(id);
  return {ok:true,distintaId:id};
}

export async function duplicateSavedDistinta(id:string):Promise<Result> {
  if(!UUID_RE.test(id)) return {ok:false,error:"Distinta non valida."};
  const ctx=await getWorkspaceContext();
  if(!canWriteWorkspace(ctx.role)) return {ok:false,error:"Accesso in sola lettura."};
  const supabase=await createClient();
  // Source must be explicitly owned in the active workspace, in addition to
  // RLS. A duplicate is a NEW snapshot and never inherits campaigns or deliveries.
  const {data:source,error:sourceError}=await supabase.from("buyer_distintas")
    .select("id,title,line_count,total_meters,total_tonnes,target_total_eur,document_requirements")
    .eq("id",id).eq("owner_user_id",ctx.userId).eq("organization_id",ctx.organizationId)
    .maybeSingle();
  if(sourceError||!source) return {ok:false,error:"Distinta non trovata o non autorizzata."};
  const {data:lines,error:lineError}=await supabase.from("buyer_distinta_lines")
    .select("line_position,description,standard_code,grade_code,finish_code,quantity_mode,quantity,bar_length_m,weight_kg_m,line_meters,line_tonnes,target_eur_t,target_eur_m,target_total_eur,note")
    .eq("distinta_id",source.id).order("line_position",{ascending:true}).limit(501);
  if(lineError||!lines||!lines.length||lines.length>500||lines.length!==source.line_count)
    return {ok:false,error:"Le righe della distinta non sono disponibili."};
  const copyTitle=("Copia di "+(source.title||"Distinta")).slice(0,120);
  // Use the same invoker-rights transactional RPC as ordinary private saves,
  // keeping canonical stored numeric values, documents and buyer-only prices.
  const {data:newId,error}=await supabase.rpc("buyer_create_distinta_snapshot",{
    p_distinta:{
      title:copyTitle,total_meters:source.total_meters,
      total_tonnes:source.total_tonnes,target_total_eur:source.target_total_eur,
      document_requirements:source.document_requirements??{},
    },
    p_lines:lines.map(line=>({
      description:line.description,standard:line.standard_code,grade:line.grade_code,
      finish:line.finish_code,quantity_mode:line.quantity_mode,quantity:line.quantity,
      bar_length_m:line.bar_length_m??"",weight_kg_m:line.weight_kg_m,
      line_meters:line.line_meters,line_tonnes:line.line_tonnes,
      target_eur_t:line.target_eur_t,target_eur_m:line.target_eur_m,
      target_total_eur:line.target_total_eur,note:line.note,
    })),
  });
  if(error||typeof newId!=="string"||!UUID_RE.test(newId))
    return {ok:false,error:"Impossibile duplicare questa distinta."};
  revalidateSaved(newId);
  return {ok:true,distintaId:newId};
}
