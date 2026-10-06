create or replace function public.rfqh5_quote_comparison(p_rfq_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
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
      coalesce(sum(target_total_eur),0)::numeric as target_total_eur
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
      coalesce(sum(lq.line_comparable_target_eur) filter (where lq.response_status='quoted'),0)::numeric as comparable_target_eur,
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
$$;

revoke all on function public.rfqh5_quote_comparison(uuid) from public,anon,authenticated;
grant execute on function public.rfqh5_quote_comparison(uuid) to authenticated;
notify pgrst,'reload schema';
