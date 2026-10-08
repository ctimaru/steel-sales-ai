-- BD3 — Target €/t is optional on buyer RFQs. Absence is NULL, never a fabricated zero.
-- Expand-only nullable schema change; existing records and role-based RLS stay intact.
alter table public.buyer_distintas
  alter column target_total_eur drop not null,
  alter column target_total_eur drop default;
alter table public.buyer_distinta_lines
  alter column target_eur_t drop not null,
  alter column target_eur_m drop not null,
  alter column target_total_eur drop not null;

alter table public.buyer_distinta_lines
  add constraint bd3_target_fields_all_or_none check (
    (target_eur_t is null and target_eur_m is null and target_total_eur is null)
    or
    (target_eur_t > 0 and target_eur_m > 0 and target_total_eur > 0)
  );

-- Award conversion must accept requests with no target and not invent negative savings.
alter table public.buyer_rfq_awards
  alter column target_total_eur drop not null,
  alter column savings_eur drop not null;
alter table public.buyer_rfq_award_allocations
  alter column target_eur_t drop not null,
  alter column target_total_eur drop not null,
  alter column savings_eur drop not null;

-- The comparison only reports aggregate target and delta if *all* RFQ lines have targets.

CREATE OR REPLACE FUNCTION public.rfqh5_quote_comparison(p_rfq_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.buyer_rfq_campaigns r
    where r.id=p_rfq_id
      and r.owner_user_id=auth.uid()
  ) then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  with
  source_lines as (
    select
      l.id,l.line_position,l.description,l.standard_code,l.grade_code,l.finish_code,
      l.quantity_mode,l.quantity,l.bar_length_m,l.weight_kg_m,l.line_meters,l.line_tonnes,
      l.target_eur_t,l.target_eur_m,l.target_total_eur
    from public.buyer_rfq_campaigns r
    join public.buyer_distinta_lines l on l.distinta_id=r.source_distinta_id
    where r.id=p_rfq_id
  ),
  request_totals as (
    select count(*)::int as total_lines,
      coalesce(sum(line_tonnes),0)::numeric as total_tonnes,
      coalesce(sum(line_meters),0)::numeric as total_meters,
      case when count(*) filter(where target_eur_t is null)>0 then null else sum(target_total_eur)::numeric end as target_total_eur
    from source_lines
  ),
  latest_quote_state as (
    select distinct on (q.supplier_id) q.supplier_id,q.id,q.revision_no,q.status
    from public.buyer_rfq_quotes q
    where q.rfq_id=p_rfq_id
    order by q.supplier_id,q.revision_no desc
  ),
  comparable_quotes as (
    select distinct on (q.supplier_id) q.*
    from public.buyer_rfq_quotes q
    where q.rfq_id=p_rfq_id and q.status in ('submitted','superseded')
    order by q.supplier_id,q.revision_no desc
  ),
  line_quotes_raw as (
    select
      cq.supplier_id,s.supplier_name,s.supplier_email_normalized,cq.id as quote_id,
      cq.revision_no,cq.status as quote_status,lqs.status as latest_quote_status,
      lqs.revision_no as latest_revision_no,
      (lqs.status='draft' and lqs.revision_no>cq.revision_no) as revision_in_progress,
      ql.rfq_line_id,ql.line_position,ql.response_status,ql.price_basis,ql.unit_price,
      ql.normalized_eur_t,ql.normalized_eur_m,ql.offered_quantity,ql.offered_quantity_mode,
      ql.moq_tonnes as line_moq_tonnes,ql.lead_time_days as line_lead_time_days,
      ql.delivery_date as line_delivery_date,ql.notes as line_notes,cq.incoterm,cq.payment_terms,
      cq.validity_until,cq.lead_time_days as quote_lead_time_days,
      cq.delivery_date as quote_delivery_date,cq.moq_tonnes as quote_moq_tonnes,
      cq.notes as quote_notes,cq.attachment_name,cq.submitted_at,sl.line_tonnes,sl.line_meters,
      sl.bar_length_m,sl.weight_kg_m,sl.target_eur_t,sl.target_eur_m,sl.target_total_eur,
      case
        when ql.response_status<>'quoted' then 0::numeric
        when ql.offered_quantity is null then sl.line_tonnes
        when ql.offered_quantity_mode='tonnes' then ql.offered_quantity
        when ql.offered_quantity_mode='meters' then ql.offered_quantity*sl.weight_kg_m/1000
        when ql.offered_quantity_mode='bars'
          and sl.bar_length_m is not null
          and sl.weight_kg_m>0
          then ql.offered_quantity*sl.bar_length_m*sl.weight_kg_m/1000
        else sl.line_tonnes
      end as offered_tonnes,
      coalesce(ql.lead_time_days,cq.lead_time_days) as effective_lead_time_days
    from comparable_quotes cq
    join public.buyer_rfq_suppliers s on s.id=cq.supplier_id
    join latest_quote_state lqs on lqs.supplier_id=cq.supplier_id
    join public.buyer_rfq_quote_lines ql on ql.quote_id=cq.id
    join source_lines sl on sl.id=ql.rfq_line_id
  ),
  line_quotes_base as (
    select
      lqr.*,
      case
        when lqr.response_status='quoted'
          then greatest(0::numeric,least(lqr.line_tonnes,lqr.offered_tonnes))
        else 0::numeric
      end as covered_tonnes,
      case
        when lqr.response_status='quoted' and lqr.line_tonnes>0
          then greatest(0::numeric,least(100::numeric,(lqr.offered_tonnes/lqr.line_tonnes)*100))
        when lqr.response_status='quoted' then 100::numeric
        else 0::numeric
      end as quantity_coverage_pct,
      (
        lqr.response_status='quoted'
        and (
          lqr.line_tonnes<=0
          or lqr.offered_tonnes>=lqr.line_tonnes
        )
      ) as is_full_line_coverage
    from line_quotes_raw lqr
  ),
  line_quotes as (
    select
      lqb.*,
      case
        when lqb.response_status='quoted' and lqb.normalized_eur_t is not null
          then lqb.normalized_eur_t*lqb.covered_tonnes
      end as line_offer_total_eur,
      case
        when lqb.response_status='quoted' and lqb.target_eur_t is not null
          then lqb.target_eur_t*lqb.covered_tonnes
      end as line_comparable_target_eur,
      case
        when lqb.response_status='quoted' and lqb.normalized_eur_t is not null
          then lqb.normalized_eur_t-lqb.target_eur_t
      end as delta_eur_t,
      case
        when lqb.response_status='quoted'
          and lqb.normalized_eur_t is not null
          and lqb.target_eur_t>0
          then ((lqb.normalized_eur_t-lqb.target_eur_t)/lqb.target_eur_t)*100
      end as delta_pct,
      case
        when lqb.response_status='quoted'
          and lqb.is_full_line_coverage
          and lqb.normalized_eur_t is not null
          then dense_rank() over (
            partition by lqb.rfq_line_id
            order by (not lqb.is_full_line_coverage),lqb.normalized_eur_t
          )
      end as line_price_rank,
      case
        when lqb.response_status='quoted'
          and lqb.is_full_line_coverage
          and lqb.normalized_eur_t is not null
          and lqb.normalized_eur_t=min(lqb.normalized_eur_t) filter (
            where lqb.response_status='quoted'
              and lqb.is_full_line_coverage
              and lqb.normalized_eur_t is not null
          ) over (partition by lqb.rfq_line_id)
          then true
        else false
      end as is_best_line_price
    from line_quotes_base lqb
  ),
  supplier_metrics_base as (
    select
      cq.supplier_id,s.supplier_name,s.supplier_email_normalized,cq.id as quote_id,
      cq.revision_no,cq.status as quote_status,lqs.status as latest_quote_status,
      lqs.revision_no as latest_revision_no,
      (lqs.status='draft' and lqs.revision_no>cq.revision_no) as revision_in_progress,
      cq.incoterm,cq.payment_terms,cq.validity_until,cq.lead_time_days,cq.delivery_date,
      cq.moq_tonnes,cq.notes,cq.attachment_name,cq.submitted_at,rt.total_lines,rt.total_tonnes,
      rt.target_total_eur,
      count(lq.rfq_line_id) filter (where lq.response_status='quoted')::int as quoted_lines,
      count(lq.rfq_line_id) filter (where lq.is_full_line_coverage)::int as fully_covered_lines,
      count(lq.rfq_line_id) filter (where lq.response_status='not_available')::int as unavailable_lines,
      coalesce(sum(lq.covered_tonnes) filter (where lq.response_status='quoted'),0)::numeric as quoted_tonnes,
      coalesce(sum(lq.line_offer_total_eur) filter (where lq.response_status='quoted'),0)::numeric as comparable_offer_eur,
      case when rt.target_total_eur is null then null else coalesce(sum(lq.line_comparable_target_eur) filter (where lq.response_status='quoted'),0)::numeric end as comparable_target_eur,
      max(lq.effective_lead_time_days) filter (where lq.response_status='quoted') as effective_lead_time_days
    from comparable_quotes cq
    join public.buyer_rfq_suppliers s on s.id=cq.supplier_id
    join latest_quote_state lqs on lqs.supplier_id=cq.supplier_id
    cross join request_totals rt
    left join line_quotes lq on lq.quote_id=cq.id
    group by cq.supplier_id,s.supplier_name,s.supplier_email_normalized,cq.id,cq.revision_no,cq.status,
      lqs.status,lqs.revision_no,cq.incoterm,cq.payment_terms,cq.validity_until,
      cq.lead_time_days,cq.delivery_date,cq.moq_tonnes,cq.notes,cq.attachment_name,cq.submitted_at,
      rt.total_lines,rt.total_tonnes,rt.target_total_eur
  ),
  supplier_metrics as (
    select smb.*,
      case when smb.total_lines>0 then (smb.fully_covered_lines::numeric/smb.total_lines::numeric)*100 else 0 end as line_coverage_pct,
      case when smb.total_tonnes>0 then (smb.quoted_tonnes/smb.total_tonnes)*100
        else case when smb.total_lines>0 then (smb.quoted_lines::numeric/smb.total_lines::numeric)*100 else 0 end end as tonne_coverage_pct,
      case when smb.quoted_tonnes>0 then smb.comparable_offer_eur/smb.quoted_tonnes end as weighted_eur_t,
      case when smb.comparable_target_eur>0 then smb.comparable_offer_eur-smb.comparable_target_eur end as comparable_delta_eur,
      case when smb.comparable_target_eur>0 then ((smb.comparable_offer_eur-smb.comparable_target_eur)/smb.comparable_target_eur)*100 end as comparable_delta_pct,
      case when smb.fully_covered_lines=smb.total_lines and smb.total_lines>0 then smb.comparable_offer_eur end as full_request_total_eur,
      case when smb.fully_covered_lines=smb.total_lines and smb.total_lines>0 and smb.target_total_eur>0 then smb.comparable_offer_eur-smb.target_total_eur end as full_delta_eur,
      case when smb.fully_covered_lines=smb.total_lines and smb.total_lines>0 and smb.target_total_eur>0 then ((smb.comparable_offer_eur-smb.target_total_eur)/smb.target_total_eur)*100 end as full_delta_pct
    from supplier_metrics_base smb
  ),
  ranked_suppliers as (
    select sm.*,
      case when sm.full_request_total_eur is not null then dense_rank() over (
        order by (sm.full_request_total_eur is null),sm.full_request_total_eur
      ) end as full_price_rank,
      dense_rank() over (order by sm.tonne_coverage_pct desc,sm.line_coverage_pct desc) as coverage_rank,
      case when sm.effective_lead_time_days is not null then dense_rank() over (
        order by (sm.effective_lead_time_days is null),sm.effective_lead_time_days
      ) end as lead_time_rank,
      case when sm.full_request_total_eur is not null and sm.full_request_total_eur=min(sm.full_request_total_eur) filter (
        where sm.full_request_total_eur is not null
      ) over () then true else false end as is_best_full_price,
      case when sm.tonne_coverage_pct=max(sm.tonne_coverage_pct) over () then true else false end as is_best_coverage,
      case when sm.effective_lead_time_days is not null and sm.effective_lead_time_days=min(sm.effective_lead_time_days) filter (
        where sm.effective_lead_time_days is not null
      ) over () then true else false end as is_best_lead_time
    from supplier_metrics sm
  ),
  line_best as (
    select sl.id as rfq_line_id,
      min(lq.line_offer_total_eur) filter (
        where lq.response_status='quoted' and lq.is_full_line_coverage and lq.line_offer_total_eur is not null
      ) as best_line_total_eur,
      count(lq.supplier_id) filter (
        where lq.response_status='quoted' and lq.normalized_eur_t is not null
      )::int as quoted_supplier_count,
      count(lq.supplier_id) filter (
        where lq.response_status='quoted' and lq.is_full_line_coverage and lq.normalized_eur_t is not null
      )::int as full_coverage_supplier_count
    from source_lines sl
    left join line_quotes lq on lq.rfq_line_id=sl.id
    group by sl.id
  ),
  split_summary as (
    select count(*)::int as total_lines,count(best_line_total_eur)::int as covered_lines,
      coalesce(sum(best_line_total_eur),0)::numeric as covered_total_eur
    from line_best
  )
  select jsonb_build_object(
    'rfq_id',p_rfq_id,
    'target',jsonb_build_object(
      'total_eur',rt.target_total_eur,'total_tonnes',rt.total_tonnes,
      'weighted_eur_t',case when rt.total_tonnes>0 then rt.target_total_eur/rt.total_tonnes end
    ),
    'summary',jsonb_build_object(
      'supplier_count',(select count(*) from public.buyer_rfq_suppliers s where s.rfq_id=p_rfq_id),
      'comparable_supplier_count',(select count(*) from ranked_suppliers),
      'declined_supplier_count',(select count(*) from public.buyer_rfq_suppliers s where s.rfq_id=p_rfq_id and s.status='declined'),
      'complete_offer_count',(select count(*) from ranked_suppliers rs where rs.full_request_total_eur is not null)
    ),
    'split_benchmark',jsonb_build_object(
      'covered_lines',ss.covered_lines,'total_lines',ss.total_lines,
      'coverage_pct',case when ss.total_lines>0 then (ss.covered_lines::numeric/ss.total_lines::numeric)*100 else 0 end,
      'total_eur',case when ss.covered_lines=ss.total_lines and ss.total_lines>0 then ss.covered_total_eur end,
      'delta_eur',case when ss.covered_lines=ss.total_lines and ss.total_lines>0 and rt.target_total_eur>0 then ss.covered_total_eur-rt.target_total_eur end,
      'delta_pct',case when ss.covered_lines=ss.total_lines and ss.total_lines>0 and rt.target_total_eur>0 then ((ss.covered_total_eur-rt.target_total_eur)/rt.target_total_eur)*100 end
    ),
    'suppliers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'supplier_id',rs.supplier_id,'supplier_name',rs.supplier_name,'supplier_email',rs.supplier_email_normalized,
        'quote_id',rs.quote_id,'revision_no',rs.revision_no,'quote_status',rs.quote_status,
        'latest_quote_status',rs.latest_quote_status,'latest_revision_no',rs.latest_revision_no,
        'revision_in_progress',rs.revision_in_progress,'submitted_at',rs.submitted_at,
        'incoterm',rs.incoterm,'payment_terms',rs.payment_terms,'validity_until',rs.validity_until,
        'lead_time_days',rs.lead_time_days,'effective_lead_time_days',rs.effective_lead_time_days,
        'delivery_date',rs.delivery_date,'moq_tonnes',rs.moq_tonnes,'attachment_name',rs.attachment_name,
        'quoted_lines',rs.quoted_lines,'fully_covered_lines',rs.fully_covered_lines,'unavailable_lines',rs.unavailable_lines,'total_lines',rs.total_lines,
        'line_coverage_pct',rs.line_coverage_pct,'quoted_tonnes',rs.quoted_tonnes,'total_tonnes',rs.total_tonnes,
        'tonne_coverage_pct',rs.tonne_coverage_pct,'comparable_offer_eur',rs.comparable_offer_eur,
        'comparable_target_eur',rs.comparable_target_eur,'weighted_eur_t',rs.weighted_eur_t,
        'comparable_delta_eur',rs.comparable_delta_eur,'comparable_delta_pct',rs.comparable_delta_pct,
        'full_request_total_eur',rs.full_request_total_eur,'full_delta_eur',rs.full_delta_eur,
        'full_delta_pct',rs.full_delta_pct,'full_price_rank',rs.full_price_rank,
        'coverage_rank',rs.coverage_rank,'lead_time_rank',rs.lead_time_rank,
        'is_best_full_price',rs.is_best_full_price,'is_best_coverage',rs.is_best_coverage,
        'is_best_lead_time',rs.is_best_lead_time
      ) order by rs.tonne_coverage_pct desc,rs.full_request_total_eur asc nulls last,rs.supplier_name asc nulls last)
      from ranked_suppliers rs
    ),'[]'::jsonb),
    'lines',coalesce((
      select jsonb_agg(jsonb_build_object(
        'line_id',sl.id,'position',sl.line_position,'description',sl.description,
        'standard',sl.standard_code,'grade',sl.grade_code,'finish',sl.finish_code,
        'quantity_mode',sl.quantity_mode,'quantity',sl.quantity,'weight_kg_m',sl.weight_kg_m,
        'line_meters',sl.line_meters,'line_tonnes',sl.line_tonnes,'target_eur_t',sl.target_eur_t,
        'target_eur_m',sl.target_eur_m,'target_total_eur',sl.target_total_eur,
        'quoted_supplier_count',lb.quoted_supplier_count,'full_coverage_supplier_count',lb.full_coverage_supplier_count,
        'quotes',coalesce((
          select jsonb_agg(jsonb_build_object(
            'supplier_id',lq.supplier_id,'supplier_name',lq.supplier_name,'quote_id',lq.quote_id,
            'revision_no',lq.revision_no,'revision_in_progress',lq.revision_in_progress,
            'response_status',lq.response_status,'normalized_eur_t',lq.normalized_eur_t,
            'normalized_eur_m',lq.normalized_eur_m,'line_offer_total_eur',lq.line_offer_total_eur,
            'delta_eur_t',lq.delta_eur_t,'delta_pct',lq.delta_pct,
            'offered_quantity',lq.offered_quantity,'offered_quantity_mode',lq.offered_quantity_mode,
            'offered_tonnes',lq.offered_tonnes,'quantity_coverage_pct',lq.quantity_coverage_pct,
            'is_full_line_coverage',lq.is_full_line_coverage,'moq_tonnes',lq.line_moq_tonnes,'lead_time_days',lq.effective_lead_time_days,
            'delivery_date',coalesce(lq.line_delivery_date,lq.quote_delivery_date),
            'line_price_rank',lq.line_price_rank,'is_best_price',lq.is_best_line_price
          ) order by lq.normalized_eur_t asc nulls last,lq.supplier_name asc nulls last)
          from line_quotes lq where lq.rfq_line_id=sl.id
        ),'[]'::jsonb)
      ) order by sl.line_position)
      from source_lines sl join line_best lb on lb.rfq_line_id=sl.id
    ),'[]'::jsonb)
  ) into v_result
  from request_totals rt cross join split_summary ss;

  return coalesce(v_result,'{}'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION private.rfqh7_confirm_award_impl(p_rfq_id uuid, p_reason text, p_allocations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_award public.buyer_rfq_awards%rowtype;
  v_alloc jsonb;
  v_line public.buyer_distinta_lines%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
  v_quote public.buyer_rfq_quotes%rowtype;
  v_quote_line public.buyer_rfq_quote_lines%rowtype;
  v_awarded_tonnes numeric;
  v_offered_tonnes numeric;
  v_awarded_meters numeric;
  v_existing_line_award numeric;
  v_line_total numeric;
  v_target_total numeric;
  v_total_eur numeric;
  v_total_tonnes numeric;
  v_target_eur numeric;
  v_supplier_count integer;
  v_line_count integer;
  v_mode text;
  v_po_id uuid;
  v_po_seq integer:=0;
  v_po record;
  v_po_json jsonb:='[]'::jsonb;
  v_reason text;
  v_approval_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  v_reason:=btrim(coalesce(p_reason,''));
  if char_length(v_reason)<3 or char_length(v_reason)>2000 then
    raise exception 'Award reason must be between 3 and 2000 characters';
  end if;

  if jsonb_typeof(coalesce(p_allocations,'[]'::jsonb))<>'array'
    or jsonb_array_length(coalesce(p_allocations,'[]'::jsonb))=0 then
    raise exception 'At least one award allocation is required';
  end if;

  if jsonb_array_length(p_allocations)>500 then
    raise exception 'Too many award allocations';
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id
    and r.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  if v_campaign.status not in('launched','collecting') then
    raise exception 'RFQ is not eligible for award';
  end if;

  if exists(select 1 from public.buyer_rfq_awards a where a.rfq_id=p_rfq_id) then
    raise exception 'RFQ award is already confirmed';
  end if;

  v_approval_id:=private.rfqh13_assert_award_approval(
    p_rfq_id,v_reason,p_allocations
  );

  select count(*)::int,coalesce(sum(l.line_tonnes),0)::numeric,
    case when count(*) filter(where l.target_eur_t is null)>0 then null else sum(l.target_total_eur)::numeric end
  into v_line_count,v_total_tonnes,v_target_eur
  from public.buyer_distinta_lines l
  where l.distinta_id=v_campaign.source_distinta_id;

  if v_line_count<=0 then
    raise exception 'RFQ has no source lines';
  end if;

  insert into public.buyer_rfq_awards(
    rfq_id,owner_user_id,organization_id,award_mode,reason,line_count,
    supplier_count,total_tonnes,total_eur,target_total_eur,savings_eur,savings_pct
  ) values(
    p_rfq_id,v_user_id,v_campaign.organization_id,'split',v_reason,v_line_count,
    1,v_total_tonnes,0,v_target_eur,null,null
  )
  returning * into v_award;

  for v_alloc in select value from jsonb_array_elements(p_allocations)
  loop
    if nullif(v_alloc->>'line_id','') is null
      or nullif(v_alloc->>'supplier_id','') is null
      or nullif(v_alloc->>'awarded_tonnes','') is null then
      raise exception 'Award allocation requires line, supplier and awarded tonnes';
    end if;

    v_awarded_tonnes:=(v_alloc->>'awarded_tonnes')::numeric;
    if v_awarded_tonnes<=0 then
      raise exception 'Awarded tonnes must be positive';
    end if;

    select * into v_line
    from public.buyer_distinta_lines l
    where l.id=(v_alloc->>'line_id')::uuid
      and l.distinta_id=v_campaign.source_distinta_id;

    if not found then
      raise exception 'Award line does not belong to this RFQ';
    end if;

    select * into v_supplier
    from public.buyer_rfq_suppliers s
    where s.id=(v_alloc->>'supplier_id')::uuid
      and s.rfq_id=p_rfq_id
      and s.owner_user_id=v_user_id;

    if not found then
      raise exception 'Award supplier does not belong to this RFQ';
    end if;

    if v_supplier.status in('declined','bounced','complained','failed','cancelled','not_awarded') then
      raise exception 'Supplier is not eligible for award';
    end if;

    select * into v_quote
    from public.buyer_rfq_quotes q
    where q.rfq_id=p_rfq_id
      and q.supplier_id=v_supplier.id
    order by q.revision_no desc
    limit 1;

    if not found or v_quote.status<>'submitted' then
      raise exception 'Supplier latest quote must be submitted before award';
    end if;

    select * into v_quote_line
    from public.buyer_rfq_quote_lines ql
    where ql.quote_id=v_quote.id
      and ql.rfq_line_id=v_line.id;

    if not found or v_quote_line.response_status<>'quoted'
      or v_quote_line.normalized_eur_t is null
      or v_quote_line.normalized_eur_m is null then
      raise exception 'Selected supplier did not submit a comparable quote for this line';
    end if;

    v_offered_tonnes:=case
      when v_quote_line.offered_quantity is null then v_line.line_tonnes
      when v_quote_line.offered_quantity_mode='tonnes' then v_quote_line.offered_quantity
      when v_quote_line.offered_quantity_mode='meters' then v_quote_line.offered_quantity*v_line.weight_kg_m/1000
      when v_quote_line.offered_quantity_mode='bars'
        and v_line.bar_length_m is not null
        then v_quote_line.offered_quantity*v_line.bar_length_m*v_line.weight_kg_m/1000
      else v_line.line_tonnes
    end;

    if v_offered_tonnes is null or v_offered_tonnes<=0 then
      raise exception 'Selected supplier has no allocatable quantity for this line';
    end if;

    if v_awarded_tonnes>v_offered_tonnes+0.000001 then
      raise exception 'Award exceeds supplier offered quantity on line %',v_line.line_position;
    end if;

    select coalesce(sum(a.awarded_tonnes),0)
    into v_existing_line_award
    from public.buyer_rfq_award_allocations a
    where a.award_id=v_award.id
      and a.rfq_line_id=v_line.id;

    if v_existing_line_award+v_awarded_tonnes>v_line.line_tonnes+0.000001 then
      raise exception 'Award exceeds requested quantity on line %',v_line.line_position;
    end if;

    if exists(
      select 1
      from public.buyer_rfq_award_allocations a
      where a.award_id=v_award.id
        and a.rfq_line_id=v_line.id
        and a.supplier_id=v_supplier.id
    ) then
      raise exception 'Duplicate supplier allocation on line %',v_line.line_position;
    end if;

    v_awarded_meters:=case
      when v_line.weight_kg_m>0 then v_awarded_tonnes*1000/v_line.weight_kg_m
      else 0 end;
    v_line_total:=round(v_quote_line.normalized_eur_t*v_awarded_tonnes,2);
    v_target_total:=round(v_line.target_eur_t*v_awarded_tonnes,2);

    insert into public.buyer_rfq_award_allocations(
      award_id,rfq_id,rfq_line_id,supplier_id,quote_id,quote_line_id,
      owner_user_id,organization_id,line_position,description,
      awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur,
      target_eur_t,target_total_eur,savings_eur,lead_time_days,delivery_date
    ) values(
      v_award.id,p_rfq_id,v_line.id,v_supplier.id,v_quote.id,v_quote_line.id,
      v_user_id,v_campaign.organization_id,v_line.line_position,v_line.description,
      v_awarded_tonnes,v_awarded_meters,v_quote_line.normalized_eur_t,
      v_quote_line.normalized_eur_m,v_line_total,v_line.target_eur_t,
      v_target_total,round(v_target_total-v_line_total,2),
      coalesce(v_quote_line.lead_time_days,v_quote.lead_time_days),
      coalesce(v_quote_line.delivery_date,v_quote.delivery_date)
    );
  end loop;

  if exists(
    select 1
    from public.buyer_distinta_lines l
    left join (
      select a.rfq_line_id,sum(a.awarded_tonnes) as awarded_tonnes
      from public.buyer_rfq_award_allocations a
      where a.award_id=v_award.id
      group by a.rfq_line_id
    ) x on x.rfq_line_id=l.id
    where l.distinta_id=v_campaign.source_distinta_id
      and abs(coalesce(x.awarded_tonnes,0)-l.line_tonnes)>0.000001
  ) then
    raise exception 'Award must cover 100%% of every RFQ line';
  end if;

  select
    count(distinct a.supplier_id)::int,
    coalesce(sum(a.line_total_eur),0)::numeric,
    coalesce(sum(a.awarded_tonnes),0)::numeric
  into v_supplier_count,v_total_eur,v_total_tonnes
  from public.buyer_rfq_award_allocations a
  where a.award_id=v_award.id;

  v_mode:=case when v_supplier_count=1 then 'full' else 'split' end;

  update public.buyer_rfq_awards
  set award_mode=v_mode,
      supplier_count=v_supplier_count,
      total_tonnes=v_total_tonnes,
      total_eur=round(v_total_eur,2),
      savings_eur=round(v_target_eur-v_total_eur,2),
      savings_pct=case when v_target_eur>0 then ((v_target_eur-v_total_eur)/v_target_eur)*100 else null end
  where id=v_award.id
  returning * into v_award;

  for v_po in
    select
      a.supplier_id,
      min(a.quote_id::text)::uuid as quote_id,
      sum(a.awarded_tonnes)::numeric as total_tonnes,
      sum(a.line_total_eur)::numeric as total_eur
    from public.buyer_rfq_award_allocations a
    where a.award_id=v_award.id
    group by a.supplier_id
    order by a.supplier_id
  loop
    v_po_seq:=v_po_seq+1;

    select * into v_supplier
    from public.buyer_rfq_suppliers s where s.id=v_po.supplier_id;

    select * into v_quote
    from public.buyer_rfq_quotes q where q.id=v_po.quote_id;

    insert into public.buyer_purchase_order_drafts(
      award_id,rfq_id,supplier_id,quote_id,owner_user_id,organization_id,
      po_draft_ref,supplier_name_snapshot,supplier_email_snapshot,
      supplier_company_id,supplier_network_company_id,supplier_organization_id,
      quote_revision_no,incoterm,payment_terms,validity_until,lead_time_days,
      delivery_date,total_tonnes,total_eur,notes
    ) values(
      v_award.id,p_rfq_id,v_supplier.id,v_quote.id,v_user_id,v_campaign.organization_id,
      'PO-'||upper(substr(replace(v_award.id::text,'-',''),1,8))||'-'||lpad(v_po_seq::text,2,'0'),
      v_supplier.supplier_name,v_supplier.supplier_email_normalized,
      v_supplier.supplier_company_id,v_supplier.supplier_network_company_id,
      v_supplier.supplier_organization_id,v_quote.revision_no,v_quote.incoterm,
      v_quote.payment_terms,v_quote.validity_until,v_quote.lead_time_days,
      v_quote.delivery_date,round(v_po.total_tonnes,6),round(v_po.total_eur,2),
      'Generato da RFQ award '||v_award.id::text||'. Bozza: nessun ordine è stato inviato automaticamente.'
    )
    returning id into v_po_id;

    insert into public.buyer_purchase_order_lines(
      po_draft_id,award_allocation_id,rfq_line_id,owner_user_id,organization_id,
      line_position,description,standard_code,grade_code,finish_code,
      awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur,
      lead_time_days,delivery_date
    )
    select
      v_po_id,a.id,a.rfq_line_id,v_user_id,v_campaign.organization_id,
      a.line_position,a.description,l.standard_code,l.grade_code,l.finish_code,
      a.awarded_tonnes,a.awarded_meters,a.unit_eur_t,a.unit_eur_m,a.line_total_eur,
      a.lead_time_days,a.delivery_date
    from public.buyer_rfq_award_allocations a
    join public.buyer_distinta_lines l on l.id=a.rfq_line_id
    where a.award_id=v_award.id
      and a.supplier_id=v_supplier.id
    order by a.line_position;

    v_po_json:=v_po_json||jsonb_build_array(jsonb_build_object(
      'po_draft_id',v_po_id,
      'supplier_id',v_supplier.id,
      'supplier_name',v_supplier.supplier_name,
      'po_draft_ref','PO-'||upper(substr(replace(v_award.id::text,'-',''),1,8))||'-'||lpad(v_po_seq::text,2,'0'),
      'total_tonnes',round(v_po.total_tonnes,6),
      'total_eur',round(v_po.total_eur,2)
    ));

    perform private.rfqh3_log_event(
      p_rfq_id,v_supplier.id,v_user_id,v_campaign.organization_id,
      'purchase_order_draft_created',
      jsonb_build_object(
        'award_id',v_award.id,
        'po_draft_id',v_po_id,
        'total_tonnes',round(v_po.total_tonnes,6),
        'total_eur',round(v_po.total_eur,2)
      ),
      v_user_id
    );
  end loop;

  update public.buyer_rfq_campaigns
  set status='awarded',awarded_at=now(),updated_at=now()
  where id=p_rfq_id;

  update public.buyer_rfq_suppliers s
  set status='awarded',awarded_at=now(),updated_at=now()
  where s.rfq_id=p_rfq_id
    and exists(
      select 1 from public.buyer_rfq_award_allocations a
      where a.award_id=v_award.id and a.supplier_id=s.id
    );

  update public.buyer_rfq_suppliers s
  set status='not_awarded',updated_at=now()
  where s.rfq_id=p_rfq_id
    and s.status not in('awarded','declined','bounced','complained','failed','cancelled')
    and not exists(
      select 1 from public.buyer_rfq_award_allocations a
      where a.award_id=v_award.id and a.supplier_id=s.id
    );

  update public.buyer_rfq_negotiation_threads
  set status='closed',active_request_type=null,request_due_at=null,
      active_request_at=null,updated_at=now()
  where rfq_id=p_rfq_id
    and status<>'closed';

  perform private.rfqh3_log_event(
    p_rfq_id,null,v_user_id,v_campaign.organization_id,
    'rfq_award_confirmed',
    jsonb_build_object(
      'award_id',v_award.id,
      'award_mode',v_award.award_mode,
      'supplier_count',v_award.supplier_count,
      'line_count',v_award.line_count,
      'total_tonnes',v_award.total_tonnes,
      'total_eur',v_award.total_eur,
      'target_total_eur',v_award.target_total_eur,
      'savings_eur',v_award.savings_eur,
      'savings_pct',v_award.savings_pct,
      'reason',v_award.reason,
      'approval_id',v_approval_id
    ),
    v_user_id
  );

  perform private.rfqh13_consume_approval(v_approval_id,v_user_id);

  return jsonb_build_object(
    'award_id',v_award.id,
    'award_mode',v_award.award_mode,
    'supplier_count',v_award.supplier_count,
    'line_count',v_award.line_count,
    'total_tonnes',v_award.total_tonnes,
    'total_eur',v_award.total_eur,
    'target_total_eur',v_award.target_total_eur,
    'savings_eur',v_award.savings_eur,
    'savings_pct',v_award.savings_pct,
    'po_drafts',v_po_json
  );
end;
$function$;
