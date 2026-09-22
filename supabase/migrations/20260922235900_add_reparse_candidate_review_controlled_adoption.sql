-- PA2.29 — Reparse Candidate Review & Controlled Adoption.
-- Candidate evidence may only be adopted by an authenticated tenant member after
-- explicitly selecting BOTH the target observation and the fields to adopt.
-- Existing non-null observation values are never overwritten in this phase.
-- Adoption reuses the P1.11 human correction loop and appends a dedicated decision ledger.

create table if not exists public.commercial_offer_reparse_candidate_decisions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  candidate_id bigint not null unique
    references public.commercial_offer_reparse_candidates(id) on delete restrict,
  run_id bigint not null
    references public.commercial_offer_reparse_runs(id) on delete restrict,
  thread_id uuid not null
    references public.commercial_threads(id) on delete restrict,
  decision text not null check (decision in ('adopted','rejected')),
  target_observation_id bigint
    references public.commercial_observations(id) on delete restrict,
  selected_fields text[] not null default '{}'::text[],
  review_id bigint
    references public.commercial_review_queue(id) on delete restrict,
  correction_event_id bigint
    references public.commercial_correction_events(id) on delete restrict,
  candidate_snapshot jsonb not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  note text,
  decided_at timestamptz not null default now(),
  constraint commercial_offer_reparse_candidate_decisions_shape_check check (
    (
      decision='adopted'
      and target_observation_id is not null
      and cardinality(selected_fields)>0
      and review_id is not null
      and correction_event_id is not null
    )
    or (
      decision='rejected'
      and target_observation_id is null
      and cardinality(selected_fields)=0
      and review_id is null
      and correction_event_id is null
    )
  )
);

create index if not exists commercial_offer_reparse_candidate_decisions_org_idx
  on public.commercial_offer_reparse_candidate_decisions(organization_id,decided_at desc);
create index if not exists commercial_offer_reparse_candidate_decisions_run_idx
  on public.commercial_offer_reparse_candidate_decisions(run_id);
create index if not exists commercial_offer_reparse_candidate_decisions_thread_idx
  on public.commercial_offer_reparse_candidate_decisions(thread_id);
create index if not exists commercial_offer_reparse_candidate_decisions_target_idx
  on public.commercial_offer_reparse_candidate_decisions(target_observation_id)
  where target_observation_id is not null;
create index if not exists commercial_offer_reparse_candidate_decisions_review_idx
  on public.commercial_offer_reparse_candidate_decisions(review_id)
  where review_id is not null;
create index if not exists commercial_offer_reparse_candidate_decisions_event_idx
  on public.commercial_offer_reparse_candidate_decisions(correction_event_id)
  where correction_event_id is not null;

alter table public.commercial_offer_reparse_candidate_decisions enable row level security;

revoke all on public.commercial_offer_reparse_candidate_decisions from public,anon,authenticated;
grant select on public.commercial_offer_reparse_candidate_decisions to authenticated,service_role;
grant insert on public.commercial_offer_reparse_candidate_decisions to service_role;
grant usage,select on sequence public.commercial_offer_reparse_candidate_decisions_id_seq to service_role;

drop policy if exists commercial_offer_reparse_candidate_decisions_member_select
  on public.commercial_offer_reparse_candidate_decisions;
create policy commercial_offer_reparse_candidate_decisions_member_select
on public.commercial_offer_reparse_candidate_decisions
for select to authenticated
using (public.is_organization_member(organization_id,false));

create or replace function private.prevent_offer_reparse_candidate_decision_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception using
    errcode='55000',
    message='commercial_offer_reparse_candidate_decisions is append-only';
end;
$$;

revoke all on function private.prevent_offer_reparse_candidate_decision_mutation()
from public,anon,authenticated;

drop trigger if exists commercial_offer_reparse_candidate_decisions_immutable
on public.commercial_offer_reparse_candidate_decisions;
create trigger commercial_offer_reparse_candidate_decisions_immutable
before update or delete on public.commercial_offer_reparse_candidate_decisions
for each row execute function private.prevent_offer_reparse_candidate_decision_mutation();

create or replace function public.p1_offer_reparse_candidate_review(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  allowed_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm',
    'quantity','quantity_unit','price_value','price_unit','currency',
    'discount_percentage','availability_status'
  ];
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with candidate_rows as (
      select
        c.id candidate_id,
        c.run_id,
        c.thread_id,
        c.candidate_index,
        c.source_text,
        c.item_role,
        c.candidate_evidence,
        c.comparison_snapshot,
        c.review_status,
        c.created_at,
        r.status run_status,
        d.id decision_id,
        d.decision,
        d.target_observation_id,
        d.selected_fields,
        d.review_id,
        d.correction_event_id,
        d.decided_at
      from public.commercial_offer_reparse_candidates c
      join public.commercial_offer_reparse_runs r
        on r.id=c.run_id and r.organization_id=c.organization_id
      left join public.commercial_offer_reparse_candidate_decisions d
        on d.candidate_id=c.id and d.organization_id=c.organization_id
      where c.organization_id=p_organization_id
        and r.status='completed'
      order by c.created_at,c.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'candidate_count',(select count(*) from candidate_rows),
        'pending_review',(select count(*) from candidate_rows where review_status='pending_review'),
        'accepted',(select count(*) from candidate_rows where review_status='accepted'),
        'rejected',(select count(*) from candidate_rows where review_status='rejected')
      ),
      'items',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'candidate_id',c.candidate_id,
            'run_id',c.run_id,
            'thread_id',c.thread_id,
            'candidate_index',c.candidate_index,
            'source_text',c.source_text,
            'item_role',c.item_role,
            'candidate_evidence',c.candidate_evidence,
            'comparison_snapshot',c.comparison_snapshot,
            'review_status',c.review_status,
            'decision',case when c.decision_id is null then null else jsonb_build_object(
              'id',c.decision_id,
              'decision',c.decision,
              'target_observation_id',c.target_observation_id,
              'selected_fields',c.selected_fields,
              'review_id',c.review_id,
              'correction_event_id',c.correction_event_id,
              'decided_at',c.decided_at
            ) end,
            'target_observations',coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'observation_id',o.id,
                  'source_text',o.source_text,
                  'current_values',jsonb_build_object(
                    'product_type',o.product_type,
                    'grade',o.grade,
                    'standard',o.standard,
                    'material_number',o.material_number,
                    'outer_diameter_mm',o.outer_diameter_mm,
                    'width_mm',o.width_mm,
                    'height_mm',o.height_mm,
                    'thickness_mm',o.thickness_mm,
                    'length_mm',o.length_mm,
                    'quantity',o.quantity,
                    'quantity_unit',o.quantity_unit,
                    'price_value',o.price_value,
                    'price_unit',o.price_unit,
                    'currency',o.currency,
                    'discount_percentage',o.discount_percentage,
                    'availability_status',o.availability_status
                  ),
                  'adoptable_fields',(
                    select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
                    from unnest(allowed_fields) f
                    where c.candidate_evidence ? f
                      and c.candidate_evidence->f is not null
                      and c.candidate_evidence->f <> 'null'::jsonb
                      and (
                        to_jsonb(o)->f is null
                        or to_jsonb(o)->f='null'::jsonb
                      )
                  ),
                  'conflicting_fields',(
                    select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
                    from unnest(allowed_fields) f
                    where c.candidate_evidence ? f
                      and c.candidate_evidence->f is not null
                      and c.candidate_evidence->f <> 'null'::jsonb
                      and to_jsonb(o)->f is not null
                      and to_jsonb(o)->f <> 'null'::jsonb
                      and to_jsonb(o)->f is distinct from c.candidate_evidence->f
                  ),
                  'equal_fields',(
                    select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
                    from unnest(allowed_fields) f
                    where c.candidate_evidence ? f
                      and c.candidate_evidence->f is not null
                      and c.candidate_evidence->f <> 'null'::jsonb
                      and to_jsonb(o)->f = c.candidate_evidence->f
                  )
                )
                order by o.id
              )
              from public.commercial_observations o
              where o.organization_id=p_organization_id
                and o.thread_id=c.thread_id
                and o.item_role='offered'
            ),'[]'::jsonb)
          )
          order by c.candidate_id
        )
        from candidate_rows c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'explicit_target_required',true,
        'explicit_fields_required',true,
        'automatic_candidate_match',false,
        'overwrite_non_null_fields',false,
        'reuse_human_correction_loop',true,
        'automatic_remediation_resolution',false
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_reparse_candidate_review(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_reparse_candidate_review(uuid,integer)
to authenticated,service_role;

create or replace function private.adopt_offer_reparse_candidate_impl(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_target_observation_id bigint,
  p_selected_fields text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  c public.commercial_offer_reparse_candidates%rowtype;
  r public.commercial_offer_reparse_runs%rowtype;
  o public.commercial_observations%rowtype;
  existing public.commercial_offer_reparse_candidate_decisions%rowtype;
  allowed_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm',
    'quantity','quantity_unit','price_value','price_unit','currency',
    'discount_percentage','availability_status'
  ];
  selected_field text;
  values_to_apply jsonb := '{}'::jsonb;
  final_values jsonb;
  review_id bigint;
  correction_result jsonb;
  correction_event_id bigint;
  decision_id bigint;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;
  if p_candidate_id is null or p_candidate_id<=0
     or p_target_observation_id is null or p_target_observation_id<=0 then
    raise exception 'valid candidate and target observation are required' using errcode='22023';
  end if;
  if p_selected_fields is null or cardinality(p_selected_fields)=0 then
    raise exception 'at least one selected field is required' using errcode='22023';
  end if;
  if cardinality(p_selected_fields) <> cardinality(array(select distinct x from unnest(p_selected_fields) x)) then
    raise exception 'selected fields must be unique' using errcode='22023';
  end if;
  if exists (
    select 1 from unnest(p_selected_fields) f
    where not (f=any(allowed_fields))
  ) then
    raise exception 'unsupported adoption field' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'offer-reparse-adopt:'||p_organization_id::text||':'||p_candidate_id::text,0));

  select * into c
  from public.commercial_offer_reparse_candidates
  where id=p_candidate_id and organization_id=p_organization_id
  for update;

  if not found then
    return jsonb_build_object('status','blocked','reason','candidate_not_found');
  end if;

  select * into existing
  from public.commercial_offer_reparse_candidate_decisions
  where organization_id=p_organization_id and candidate_id=c.id;

  if found then
    return jsonb_build_object(
      'status','already_decided',
      'decision_id',existing.id,
      'decision',existing.decision,
      'candidate_id',c.id
    );
  end if;

  if c.review_status<>'pending_review' then
    return jsonb_build_object('status','blocked','reason','candidate_not_pending');
  end if;
  if c.item_role is distinct from 'offered' then
    return jsonb_build_object('status','blocked','reason','candidate_not_offered');
  end if;

  select * into r
  from public.commercial_offer_reparse_runs
  where id=c.run_id and organization_id=p_organization_id
  for share;

  if not found or r.status<>'completed' then
    return jsonb_build_object('status','blocked','reason','reparse_run_not_completed');
  end if;

  select * into o
  from public.commercial_observations
  where id=p_target_observation_id
    and organization_id=p_organization_id
    and thread_id=c.thread_id
    and item_role='offered'
  for update;

  if not found then
    return jsonb_build_object('status','blocked','reason','target_observation_provenance_mismatch');
  end if;

  foreach selected_field in array p_selected_fields loop
    if not (c.candidate_evidence ? selected_field)
       or c.candidate_evidence->selected_field is null
       or c.candidate_evidence->selected_field='null'::jsonb then
      raise exception 'selected field % is absent from candidate evidence',selected_field
        using errcode='22023';
    end if;

    if to_jsonb(o)->selected_field is not null
       and to_jsonb(o)->selected_field <> 'null'::jsonb then
      raise exception 'selected field % would overwrite an existing value',selected_field
        using errcode='55000';
    end if;

    values_to_apply := values_to_apply
      || jsonb_build_object(selected_field,c.candidate_evidence->selected_field);
  end loop;

  final_values := to_jsonb(o) || values_to_apply;

  if (
    ('quantity'=any(p_selected_fields) or 'quantity_unit'=any(p_selected_fields))
    and (
      final_values->'quantity' is null or final_values->'quantity'='null'::jsonb
      or final_values->'quantity_unit' is null or final_values->'quantity_unit'='null'::jsonb
    )
  ) then
    raise exception 'quantity adoption must leave quantity and quantity_unit complete'
      using errcode='22023';
  end if;

  if (
    ('price_value'=any(p_selected_fields) or 'price_unit'=any(p_selected_fields) or 'currency'=any(p_selected_fields))
    and (
      final_values->'price_value' is null or final_values->'price_value'='null'::jsonb
      or final_values->'price_unit' is null or final_values->'price_unit'='null'::jsonb
      or final_values->'currency' is null or final_values->'currency'='null'::jsonb
    )
  ) then
    raise exception 'price adoption must leave price_value, price_unit and currency complete'
      using errcode='22023';
  end if;

  if nullif(btrim(coalesce(p_note,'')),'') is not null then
    values_to_apply := values_to_apply
      || jsonb_build_object('note',left(btrim(p_note),1000));
  end if;

  insert into public.commercial_review_queue(
    owner_id,dataset_id,thread_id,source_review_id,source_extraction_ordinal,
    reason,severity,source_text,status,observation_id,organization_id
  ) values (
    actor_id,o.dataset_id,o.thread_id,-c.id,c.candidate_index,
    'offer_reparse_candidate','warning',c.source_text,'pending',o.id,p_organization_id
  )
  returning id into review_id;

  correction_result := public.p1_apply_commercial_review_correction(
    review_id,
    values_to_apply
  );

  correction_event_id := nullif(correction_result->>'correction_event_id','')::bigint;
  if correction_event_id is null or correction_result->>'status'<>'corrected' then
    raise exception 'human correction loop did not complete adoption';
  end if;

  insert into public.commercial_offer_reparse_candidate_decisions(
    organization_id,candidate_id,run_id,thread_id,decision,
    target_observation_id,selected_fields,review_id,correction_event_id,
    candidate_snapshot,decided_by,note
  ) values (
    p_organization_id,c.id,c.run_id,c.thread_id,'adopted',
    o.id,p_selected_fields,review_id,correction_event_id,
    c.candidate_evidence,actor_id,left(nullif(btrim(coalesce(p_note,'')),''),1000)
  )
  returning id into decision_id;

  update public.commercial_offer_reparse_candidates
  set review_status='accepted'
  where id=c.id;

  return jsonb_build_object(
    'status','adopted',
    'candidate_id',c.id,
    'target_observation_id',o.id,
    'selected_fields',to_jsonb(p_selected_fields),
    'review_id',review_id,
    'correction_event_id',correction_event_id,
    'decision_id',decision_id,
    'observation_mutation_via_existing_correction_loop',true,
    'automatic_candidate_match',false,
    'automatic_remediation_resolution',false,
    'control_phase','PA2.29'
  );
end;
$$;

revoke all on function private.adopt_offer_reparse_candidate_impl(uuid,bigint,bigint,text[],text)
from public,anon;
grant execute on function private.adopt_offer_reparse_candidate_impl(uuid,bigint,bigint,text[],text)
to authenticated,service_role;

create or replace function public.p1_adopt_offer_reparse_candidate(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_target_observation_id bigint,
  p_selected_fields text[],
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.adopt_offer_reparse_candidate_impl(
    p_organization_id,p_candidate_id,p_target_observation_id,p_selected_fields,p_note
  );
$$;

revoke all on function public.p1_adopt_offer_reparse_candidate(uuid,bigint,bigint,text[],text)
from public,anon;
grant execute on function public.p1_adopt_offer_reparse_candidate(uuid,bigint,bigint,text[],text)
to authenticated,service_role;

create or replace function private.reject_offer_reparse_candidate_impl(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  c public.commercial_offer_reparse_candidates%rowtype;
  existing public.commercial_offer_reparse_candidate_decisions%rowtype;
  decision_id bigint;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;
  if p_candidate_id is null or p_candidate_id<=0 then
    raise exception 'valid candidate is required' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'offer-reparse-reject:'||p_organization_id::text||':'||p_candidate_id::text,0));

  select * into c
  from public.commercial_offer_reparse_candidates
  where id=p_candidate_id and organization_id=p_organization_id
  for update;

  if not found then
    return jsonb_build_object('status','blocked','reason','candidate_not_found');
  end if;

  select * into existing
  from public.commercial_offer_reparse_candidate_decisions
  where organization_id=p_organization_id and candidate_id=c.id;

  if found then
    return jsonb_build_object(
      'status','already_decided',
      'decision_id',existing.id,
      'decision',existing.decision,
      'candidate_id',c.id
    );
  end if;

  if c.review_status<>'pending_review' then
    return jsonb_build_object('status','blocked','reason','candidate_not_pending');
  end if;

  insert into public.commercial_offer_reparse_candidate_decisions(
    organization_id,candidate_id,run_id,thread_id,decision,
    target_observation_id,selected_fields,review_id,correction_event_id,
    candidate_snapshot,decided_by,note
  ) values (
    p_organization_id,c.id,c.run_id,c.thread_id,'rejected',
    null,'{}'::text[],null,null,c.candidate_evidence,actor_id,
    left(nullif(btrim(coalesce(p_note,'')),''),1000)
  )
  returning id into decision_id;

  update public.commercial_offer_reparse_candidates
  set review_status='rejected'
  where id=c.id;

  return jsonb_build_object(
    'status','rejected',
    'candidate_id',c.id,
    'decision_id',decision_id,
    'observation_mutation',false,
    'automatic_remediation_resolution',false,
    'control_phase','PA2.29'
  );
end;
$$;

revoke all on function private.reject_offer_reparse_candidate_impl(uuid,bigint,text)
from public,anon;
grant execute on function private.reject_offer_reparse_candidate_impl(uuid,bigint,text)
to authenticated,service_role;

create or replace function public.p1_reject_offer_reparse_candidate(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.reject_offer_reparse_candidate_impl(
    p_organization_id,p_candidate_id,p_note
  );
$$;

revoke all on function public.p1_reject_offer_reparse_candidate(uuid,bigint,text)
from public,anon;
grant execute on function public.p1_reject_offer_reparse_candidate(uuid,bigint,text)
to authenticated,service_role;
