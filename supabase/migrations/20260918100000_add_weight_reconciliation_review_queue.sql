-- P1.15 / SK4.5d — reconciliation review queue.
--
-- Read model joining live reconciliation candidates to the decision ledger.
-- No writes, promotions or canonical mutations.

create or replace function public.p1_shared_steel_weight_reconciliation_review_queue(
  p_tolerance_pct numeric default 0.50,
  p_review_state text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  left_reference_id uuid,
  right_reference_id uuid,
  geometry_id uuid,
  geometry_key text,
  product_family text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  left_source_key text,
  right_source_key text,
  left_weight_kg_m numeric,
  right_weight_kg_m numeric,
  delta_pct numeric,
  reconciliation_status text,
  eligible_for_cross_verification boolean,
  review_state text,
  decision_id uuid,
  rationale text,
  decided_by uuid,
  decided_at timestamptz
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_tolerance_pct is null or p_tolerance_pct < 0 then
    raise exception using errcode='22023',message='reconciliation review tolerance must be non-negative';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using errcode='22023',message='reconciliation review limit must be between 1 and 1000';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception using errcode='22023',message='reconciliation review offset must be non-negative';
  end if;
  if p_review_state is not null and p_review_state not in ('unreviewed','accepted','rejected','needs_review') then
    raise exception using errcode='22023',message='review state must be unreviewed, accepted, rejected, needs_review, or null';
  end if;

  return query
  select
    c.left_reference_id,c.right_reference_id,c.geometry_id,c.geometry_key,c.product_family,
    c.outer_diameter_mm,c.width_mm,c.height_mm,c.thickness_mm,
    c.left_source_key,c.right_source_key,c.left_weight_kg_m,c.right_weight_kg_m,
    c.delta_pct,c.reconciliation_status,c.eligible_for_cross_verification,
    coalesce(d.decision,'unreviewed') as review_state,
    d.id as decision_id,d.rationale,d.decided_by,d.decided_at
  from public.p1_shared_steel_weight_reconciliation_candidates(p_tolerance_pct,null,1000,0) c
  left join public.steel_weight_reconciliation_decisions d
    on d.left_reference_id=c.left_reference_id and d.right_reference_id=c.right_reference_id
  where p_review_state is null or coalesce(d.decision,'unreviewed')=p_review_state
  order by
    case coalesce(d.decision,'unreviewed')
      when 'needs_review' then 1
      when 'unreviewed' then 2
      when 'rejected' then 3
      else 4
    end,
    case c.reconciliation_status when 'mismatch' then 1 when 'within_tolerance' then 2 else 3 end,
    c.delta_pct desc,c.geometry_key,c.left_reference_id,c.right_reference_id
  limit p_limit offset p_offset;
end
$$;

comment on function public.p1_shared_steel_weight_reconciliation_review_queue(numeric,text,integer,integer) is
  'Read-only reconciliation review queue joining live candidates with accepted/rejected/needs_review decisions; undecided pairs are unreviewed.';

revoke all on function public.p1_shared_steel_weight_reconciliation_review_queue(numeric,text,integer,integer) from public,anon;
grant execute on function public.p1_shared_steel_weight_reconciliation_review_queue(numeric,text,integer,integer) to authenticated,service_role;

do $$
declare
  v_total integer; v_needs integer; v_unreviewed integer; v_sample record;
begin
  select count(*),
    count(*) filter(where review_state='needs_review'),
    count(*) filter(where review_state='unreviewed')
  into v_total,v_needs,v_unreviewed
  from public.p1_shared_steel_weight_reconciliation_review_queue(0.50,null,1000,0);

  if v_total <> 5 then raise exception 'SK4.5d baseline candidate count regression: %',v_total; end if;
  -- Clean CI has no persistent decisions; production may contain reviewed rows.
  if v_needs <> 0 or v_unreviewed <> 5 then
    raise exception 'SK4.5d clean rebuild review-state regression: needs %, unreviewed %',v_needs,v_unreviewed;
  end if;

  select * into v_sample
  from public.p1_shared_steel_weight_reconciliation_review_queue(0.50,'unreviewed',1000,0)
  where geometry_key='round|od=168.3|t=7.11' limit 1;
  if v_sample.left_reference_id is null or v_sample.review_state <> 'unreviewed'
     or v_sample.reconciliation_status <> 'exact_match' then
    raise exception 'SK4.5d expected unreviewed exact candidate missing';
  end if;

  if has_function_privilege('anon','public.p1_shared_steel_weight_reconciliation_review_queue(numeric,text,integer,integer)','EXECUTE') then
    raise exception 'SK4.5d anon must not execute review queue';
  end if;
  if not has_function_privilege('authenticated','public.p1_shared_steel_weight_reconciliation_review_queue(numeric,text,integer,integer)','EXECUTE') then
    raise exception 'SK4.5d authenticated execute missing';
  end if;
end
$$;
