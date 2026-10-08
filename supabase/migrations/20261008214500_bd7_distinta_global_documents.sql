-- BD7: documentation is a request-level commercial condition, never a per-tube note.
-- Existing records have no requirements by default; no sensitive documents are exposed.
alter table public.buyer_distintas
  add column if not exists document_requirements jsonb not null default '{}'::jsonb;

alter table public.buyer_distintas
  add constraint bd7_document_requirements_shape
  check (
    jsonb_typeof(document_requirements) = 'object'
    and length(document_requirements::text) <= 1200
    and coalesce(document_requirements->>'inspectionDocument', '') in ('', '2.1', '2.2', '3.1', '3.2')
    and (not (document_requirements ? 'ceDop') or jsonb_typeof(document_requirements->'ceDop') = 'boolean')
    and (not (document_requirements ? 'iso9001') or jsonb_typeof(document_requirements->'iso9001') = 'boolean')
  );

-- Preserve the existing invoker-rights/authenticated snapshot contract and RLS.
create or replace function public.buyer_create_distinta_snapshot(p_distinta jsonb, p_lines jsonb)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_distinta_id uuid;
  v_line_count integer;
  v_row jsonb;
  v_position integer := 0;
  v_documents jsonb := coalesce(p_distinta->'document_requirements', '{}'::jsonb);
begin
  if v_user_id is null then raise exception 'Authenticated user required' using errcode='42501'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'lines must be an array'; end if;
  v_line_count := jsonb_array_length(p_lines);
  if v_line_count < 1 or v_line_count > 500 then raise exception 'line_count out of range'; end if;
  if jsonb_typeof(v_documents) <> 'object' or length(v_documents::text) > 1200 then
    raise exception 'invalid document requirements';
  end if;

  v_org_id := public.default_organization_for_user(v_user_id);
  insert into public.buyer_distintas(
    owner_user_id,organization_id,title,line_count,total_meters,total_tonnes,
    target_total_eur,document_requirements
  )
  values(
    v_user_id,v_org_id,
    coalesce(nullif(btrim(p_distinta->>'title'),''),'Richiesta di offerta'),
    v_line_count,
    coalesce((p_distinta->>'total_meters')::numeric,0),
    coalesce((p_distinta->>'total_tonnes')::numeric,0),
    (p_distinta->>'target_total_eur')::numeric,
    v_documents
  )
  returning id into v_distinta_id;
  for v_row in select value from jsonb_array_elements(p_lines)
  loop
    v_position := v_position + 1;
    insert into public.buyer_distinta_lines(
      distinta_id,line_position,description,standard_code,grade_code,finish_code,
      quantity_mode,quantity,bar_length_m,weight_kg_m,line_meters,line_tonnes,
      target_eur_t,target_eur_m,target_total_eur,note
    )
    values(
      v_distinta_id,v_position,
      nullif(btrim(v_row->>'description'),''),
      nullif(btrim(v_row->>'standard'),''),
      nullif(btrim(v_row->>'grade'),''),
      nullif(btrim(v_row->>'finish'),''),
      v_row->>'quantity_mode',
      (v_row->>'quantity')::numeric,
      nullif(v_row->>'bar_length_m','')::numeric,
      (v_row->>'weight_kg_m')::numeric,
      (v_row->>'line_meters')::numeric,
      (v_row->>'line_tonnes')::numeric,
      (v_row->>'target_eur_t')::numeric,
      (v_row->>'target_eur_m')::numeric,
      (v_row->>'target_total_eur')::numeric,
      nullif(btrim(v_row->>'note'),'')
    );
  end loop;
  return v_distinta_id;
end;
$function$;
