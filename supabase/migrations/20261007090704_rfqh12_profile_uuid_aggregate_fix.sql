create or replace function public.rfqh12_procurement_intelligence(
  p_days integer default 365
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_days integer := least(greatest(coalesce(p_days,365),0),3650);
  v_cutoff timestamptz;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  v_cutoff := case
    when v_days=0 then null
    else now() - make_interval(days => v_days)
  end;

  with
  eligible_rfqs as (
    select
      r.id,
      r.organization_id,
      r.source_distinta_id,
      r.title,
      r.status,
      r.created_at,
      r.due_at
    from public.buyer_rfq_campaigns r
    where r.owner_user_id=v_user_id
      and (v_cutoff is null or r.created_at>=v_cutoff)
  ),
  rfq_lines as (
    select
      er.id rfq_id,
      l.id line_id,
      l.line_position,
      l.description,
      l.standard_code,
      l.grade_code,
      l.finish_code,
      l.line_tonnes,
      l.line_meters,
      l.target_eur_t,
      l.target_eur_m,
      l.target_total_eur
    from eligible_rfqs er
    join public.buyer_distinta_lines l on l.distinta_id=er.source_distinta_id
  ),
  rfq_totals as (
    select
      rfq_id,
      count(*)::int line_count,
      coalesce(sum(line_tonnes),0)::numeric total_tonnes,
      coalesce(sum(target_total_eur),0)::numeric target_total_eur
    from rfq_lines
    group by rfq_id
  ),
  supplier_rows as (
    select
      s.id supplier_id,
      s.rfq_id,
      er.organization_id,
      s.identity_key,
      coalesce(p.id::text,s.id::text) analytics_supplier_key,
      p.id profile_id,
      coalesce(p.display_name,s.supplier_name,s.supplier_email_normalized,'Supplier') display_name,
      p.email_normalized profile_email,
      p.preferred,
      p.tags,
      s.status supplier_status,
      s.created_at invited_at,
      s.sent_at,
      s.responded_at,
      s.declined_at
    from eligible_rfqs er
    join public.buyer_rfq_suppliers s on s.rfq_id=er.id
    left join public.buyer_supplier_profiles p
      on p.owner_user_id=v_user_id
     and p.organization_id=er.organization_id
     and p.identity_key=s.identity_key
  ),
  latest_quotes as (
    select distinct on (q.supplier_id)
      q.id quote_id,
      q.rfq_id,
      q.supplier_id,
      q.revision_no,
      q.status,
      q.submitted_at,
      q.lead_time_days,
      q.incoterm,
      q.payment_terms
    from public.buyer_rfq_quotes q
    join supplier_rows sr on sr.supplier_id=q.supplier_id
    where q.status in('submitted','superseded')
      and q.submitted_at is not null
    order by q.supplier_id,q.revision_no desc,q.created_at desc,q.id desc
  ),
  latest_quote_stats as (
    select
      sr.analytics_supplier_key,
      sr.profile_id,
      sr.supplier_id,
      sr.rfq_id,
      lq.quote_id,
      lq.submitted_at,
      lq.lead_time_days,
      rt.line_count total_lines,
      count(ql.id) filter(
        where ql.response_status='quoted'
          and (ql.normalized_eur_t is not null or ql.normalized_eur_m is not null)
      )::int quoted_lines,
      case
        when rt.line_count>0 then round(
          (
            100.0 *
            count(ql.id) filter(
              where ql.response_status='quoted'
                and (ql.normalized_eur_t is not null or ql.normalized_eur_m is not null)
            ) / rt.line_count
          )::numeric,
          1
        )
        else 0::numeric
      end quote_coverage_pct
    from supplier_rows sr
    join latest_quotes lq on lq.supplier_id=sr.supplier_id
    join rfq_totals rt on rt.rfq_id=sr.rfq_id
    left join public.buyer_rfq_quote_lines ql on ql.quote_id=lq.quote_id
    group by
      sr.analytics_supplier_key,sr.profile_id,sr.supplier_id,sr.rfq_id,
      lq.quote_id,lq.submitted_at,lq.lead_time_days,rt.line_count
  ),
  supplier_core as (
    select
      sr.analytics_supplier_key,
      (array_agg(sr.profile_id order by sr.profile_id::text) filter(where sr.profile_id is not null))[1] profile_id,
      max(sr.display_name) display_name,
      max(sr.profile_email) profile_email,
      bool_or(coalesce(sr.preferred,false)) preferred,
      coalesce(
        (
          select array_agg(distinct tag order by tag)
          from supplier_rows sr2
          cross join lateral unnest(coalesce(sr2.tags,'{}'::text[])) tag
          where sr2.analytics_supplier_key=sr.analytics_supplier_key
        ),
        '{}'::text[]
      ) tags,
      count(distinct sr.rfq_id)::int rfq_count,
      count(distinct sr.rfq_id) filter(where sr.responded_at is not null)::int responded_rfq_count,
      count(distinct sr.rfq_id) filter(where sr.declined_at is not null)::int declined_rfq_count,
      round(avg(
        extract(epoch from (sr.responded_at-coalesce(sr.sent_at,sr.invited_at)))/3600.0
      ) filter(
        where sr.responded_at is not null
          and sr.responded_at>=coalesce(sr.sent_at,sr.invited_at)
      )::numeric,2) avg_response_hours,
      count(distinct lqs.rfq_id)::int quoted_rfq_count,
      count(distinct lqs.rfq_id) filter(where lqs.quote_coverage_pct>=99.999)::int complete_quote_count,
      round(avg(lqs.quote_coverage_pct)::numeric,1) avg_quote_coverage_pct,
      round(avg(lqs.lead_time_days)::numeric,1) avg_lead_time_days,
      max(lqs.submitted_at) last_quote_at,
      max(sr.responded_at) last_response_at
    from supplier_rows sr
    left join latest_quote_stats lqs on lqs.supplier_id=sr.supplier_id
    group by sr.analytics_supplier_key
  ),
  award_by_supplier as (
    select
      sr.analytics_supplier_key,
      count(distinct a.award_id)::int award_count,
      coalesce(sum(a.line_total_eur),0)::numeric(18,2) awarded_total_eur,
      coalesce(sum(a.savings_eur),0)::numeric(18,2) savings_total_eur,
      max(aw.confirmed_at) last_award_at
    from supplier_rows sr
    join public.buyer_rfq_award_allocations a on a.supplier_id=sr.supplier_id
    join public.buyer_rfq_awards aw on aw.id=a.award_id
    where v_cutoff is null or aw.confirmed_at>=v_cutoff
    group by sr.analytics_supplier_key
  ),
  po_by_supplier as (
    select
      sr.analytics_supplier_key,
      count(distinct po.id)::int po_count,
      count(distinct po.id) filter(where po.status='supplier_confirmed')::int confirmed_po_count,
      max(coalesce(po.issued_at,po.created_at)) last_po_at
    from supplier_rows sr
    join public.buyer_purchase_order_drafts po on po.supplier_id=sr.supplier_id
    where v_cutoff is null or coalesce(po.issued_at,po.created_at)>=v_cutoff
    group by sr.analytics_supplier_key
  ),
  supplier_performance as (
    select
      sc.*,
      case
        when sc.rfq_count>0 then round((100.0*sc.responded_rfq_count/sc.rfq_count)::numeric,1)
        else 0::numeric
      end response_rate_pct,
      case
        when sc.quoted_rfq_count>0 then round(
          (100.0*coalesce(ab.award_count,0)/sc.quoted_rfq_count)::numeric,1
        )
        else 0::numeric
      end award_rate_pct,
      coalesce(ab.award_count,0) award_count,
      coalesce(ab.awarded_total_eur,0)::numeric(18,2) awarded_total_eur,
      coalesce(ab.savings_total_eur,0)::numeric(18,2) savings_total_eur,
      ab.last_award_at,
      coalesce(pb.po_count,0) po_count,
      coalesce(pb.confirmed_po_count,0) confirmed_po_count,
      case
        when coalesce(pb.po_count,0)>0 then round(
          (100.0*coalesce(pb.confirmed_po_count,0)/pb.po_count)::numeric,1
        )
        else 0::numeric
      end po_confirmation_rate_pct,
      pb.last_po_at
    from supplier_core sc
    left join award_by_supplier ab on ab.analytics_supplier_key=sc.analytics_supplier_key
    left join po_by_supplier pb on pb.analytics_supplier_key=sc.analytics_supplier_key
  ),
  award_summary as (
    select
      count(*)::int award_count,
      coalesce(sum(a.total_eur),0)::numeric(18,2) awarded_total_eur,
      coalesce(sum(a.target_total_eur),0)::numeric(18,2) target_total_eur,
      coalesce(sum(a.savings_eur),0)::numeric(18,2) savings_eur
    from public.buyer_rfq_awards a
    join eligible_rfqs er on er.id=a.rfq_id
    where v_cutoff is null or a.confirmed_at>=v_cutoff
  ),
  quote_summary as (
    select
      count(*)::int comparable_quote_count,
      coalesce(sum(quoted_lines),0)::numeric quoted_lines,
      coalesce(sum(total_lines),0)::numeric offered_line_opportunities,
      count(*) filter(where quote_coverage_pct>=99.999)::int complete_quote_count,
      round(avg(lead_time_days)::numeric,1) avg_lead_time_days
    from latest_quote_stats
  ),
  response_summary as (
    select
      count(*)::int supplier_invite_count,
      count(*) filter(where responded_at is not null)::int supplier_response_count
    from supplier_rows
  ),
  price_samples_base as (
    select
      sr.profile_id,
      sr.display_name supplier_name,
      lq.rfq_id,
      er.title rfq_title,
      lq.quote_id,
      lq.revision_no,
      lq.submitted_at,
      ql.line_position,
      rl.description,
      rl.standard_code,
      rl.grade_code,
      rl.finish_code,
      ql.normalized_eur_t,
      ql.normalized_eur_m,
      lq.lead_time_days,
      lower(concat_ws('|',
        coalesce(rl.standard_code,''),
        coalesce(rl.grade_code,''),
        coalesce(rl.finish_code,''),
        coalesce(rl.description,'')
      )) article_key
    from latest_quotes lq
    join supplier_rows sr on sr.supplier_id=lq.supplier_id
    join eligible_rfqs er on er.id=lq.rfq_id
    join public.buyer_rfq_quote_lines ql on ql.quote_id=lq.quote_id
    join rfq_lines rl on rl.rfq_id=lq.rfq_id and rl.line_id=ql.rfq_line_id
    where ql.response_status='quoted'
      and (ql.normalized_eur_t is not null or ql.normalized_eur_m is not null)
      and (v_cutoff is null or lq.submitted_at>=v_cutoff)
  ),
  price_samples as (
    select
      psb.*,
      row_number() over(
        partition by article_key
        order by submitted_at desc,quote_id desc,line_position
      ) article_recency_rank
    from price_samples_base psb
  ),
  article_rollup as (
    select
      article_key,
      max(description) description,
      max(standard_code) standard_code,
      max(grade_code) grade_code,
      max(finish_code) finish_code,
      count(*)::int sample_count,
      count(distinct coalesce(profile_id::text,supplier_name))::int supplier_count,
      min(normalized_eur_t) min_eur_t,
      max(normalized_eur_t) max_eur_t,
      round(avg(normalized_eur_t)::numeric,2) avg_eur_t,
      max(submitted_at) latest_at,
      max(normalized_eur_t) filter(where article_recency_rank=1) latest_eur_t,
      max(normalized_eur_t) filter(where article_recency_rank=2) previous_eur_t,
      max(normalized_eur_m) filter(where article_recency_rank=1) latest_eur_m
    from price_samples
    group by article_key
  ),
  awards_detail as (
    select
      a.id award_id,
      a.rfq_id,
      er.title rfq_title,
      a.award_mode,
      a.supplier_count,
      a.confirmed_at,
      a.total_eur,
      a.target_total_eur,
      a.savings_eur,
      case
        when a.target_total_eur>0 then round((100.0*a.savings_eur/a.target_total_eur)::numeric,2)
        else null
      end savings_pct
    from public.buyer_rfq_awards a
    join eligible_rfqs er on er.id=a.rfq_id
    where v_cutoff is null or a.confirmed_at>=v_cutoff
  )
  select jsonb_build_object(
    'contract','RFQH12-procurement-intelligence-v1',
    'period',jsonb_build_object(
      'days',v_days,
      'cutoff',v_cutoff
    ),
    'summary',jsonb_build_object(
      'rfq_count',(select count(*) from eligible_rfqs),
      'supplier_count',(select count(*) from supplier_performance),
      'supplier_invite_count',rs.supplier_invite_count,
      'supplier_response_count',rs.supplier_response_count,
      'response_rate_pct',case
        when rs.supplier_invite_count>0 then round(
          (100.0*rs.supplier_response_count/rs.supplier_invite_count)::numeric,1
        )
        else 0
      end,
      'comparable_quote_count',qs.comparable_quote_count,
      'complete_quote_count',qs.complete_quote_count,
      'quote_coverage_pct',case
        when qs.offered_line_opportunities>0 then round(
          (100.0*qs.quoted_lines/qs.offered_line_opportunities)::numeric,1
        )
        else 0
      end,
      'avg_lead_time_days',qs.avg_lead_time_days,
      'award_count',asum.award_count,
      'awarded_total_eur',asum.awarded_total_eur,
      'target_total_eur',asum.target_total_eur,
      'savings_eur',asum.savings_eur,
      'savings_pct',case
        when asum.target_total_eur>0 then round(
          (100.0*asum.savings_eur/asum.target_total_eur)::numeric,2
        )
        else null
      end,
      'price_sample_count',(select count(*) from price_samples)
    ),
    'supplier_performance',coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id',sp.profile_id,
        'name',sp.display_name,
        'email',sp.profile_email,
        'preferred',sp.preferred,
        'tags',sp.tags,
        'rfq_count',sp.rfq_count,
        'responded_rfq_count',sp.responded_rfq_count,
        'response_rate_pct',sp.response_rate_pct,
        'avg_response_hours',sp.avg_response_hours,
        'quoted_rfq_count',sp.quoted_rfq_count,
        'complete_quote_count',sp.complete_quote_count,
        'avg_quote_coverage_pct',sp.avg_quote_coverage_pct,
        'avg_lead_time_days',sp.avg_lead_time_days,
        'award_count',sp.award_count,
        'award_rate_pct',sp.award_rate_pct,
        'awarded_total_eur',sp.awarded_total_eur,
        'savings_total_eur',sp.savings_total_eur,
        'po_count',sp.po_count,
        'confirmed_po_count',sp.confirmed_po_count,
        'po_confirmation_rate_pct',sp.po_confirmation_rate_pct,
        'last_response_at',sp.last_response_at,
        'last_quote_at',sp.last_quote_at,
        'last_award_at',sp.last_award_at,
        'last_po_at',sp.last_po_at
      ) order by
        sp.awarded_total_eur desc,
        sp.avg_quote_coverage_pct desc nulls last,
        sp.response_rate_pct desc,
        sp.display_name)
      from (
        select *
        from supplier_performance
        order by awarded_total_eur desc,avg_quote_coverage_pct desc nulls last,response_rate_pct desc
        limit 100
      ) sp
    ),'[]'::jsonb),
    'articles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'article_key',ar.article_key,
        'description',ar.description,
        'standard_code',ar.standard_code,
        'grade_code',ar.grade_code,
        'finish_code',ar.finish_code,
        'sample_count',ar.sample_count,
        'supplier_count',ar.supplier_count,
        'min_eur_t',ar.min_eur_t,
        'max_eur_t',ar.max_eur_t,
        'avg_eur_t',ar.avg_eur_t,
        'latest_at',ar.latest_at,
        'latest_eur_t',ar.latest_eur_t,
        'previous_eur_t',ar.previous_eur_t,
        'change_eur_t',case
          when ar.latest_eur_t is not null and ar.previous_eur_t is not null
          then ar.latest_eur_t-ar.previous_eur_t
          else null
        end,
        'change_pct',case
          when ar.latest_eur_t is not null and ar.previous_eur_t>0
          then round(((ar.latest_eur_t-ar.previous_eur_t)/ar.previous_eur_t*100)::numeric,2)
          else null
        end,
        'latest_eur_m',ar.latest_eur_m
      ) order by ar.latest_at desc,ar.sample_count desc)
      from (
        select *
        from article_rollup
        order by latest_at desc,sample_count desc
        limit 100
      ) ar
    ),'[]'::jsonb),
    'price_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id',ph.profile_id,
        'supplier_name',ph.supplier_name,
        'rfq_id',ph.rfq_id,
        'rfq_title',ph.rfq_title,
        'quote_id',ph.quote_id,
        'revision_no',ph.revision_no,
        'submitted_at',ph.submitted_at,
        'line_position',ph.line_position,
        'description',ph.description,
        'standard_code',ph.standard_code,
        'grade_code',ph.grade_code,
        'finish_code',ph.finish_code,
        'eur_t',ph.normalized_eur_t,
        'eur_m',ph.normalized_eur_m,
        'lead_time_days',ph.lead_time_days
      ) order by ph.submitted_at desc,ph.supplier_name,ph.line_position)
      from (
        select *
        from price_samples
        order by submitted_at desc
        limit 200
      ) ph
    ),'[]'::jsonb),
    'awards',coalesce((
      select jsonb_agg(jsonb_build_object(
        'award_id',ad.award_id,
        'rfq_id',ad.rfq_id,
        'rfq_title',ad.rfq_title,
        'award_mode',ad.award_mode,
        'supplier_count',ad.supplier_count,
        'confirmed_at',ad.confirmed_at,
        'total_eur',ad.total_eur,
        'target_total_eur',ad.target_total_eur,
        'savings_eur',ad.savings_eur,
        'savings_pct',ad.savings_pct
      ) order by ad.confirmed_at desc)
      from (
        select *
        from awards_detail
        order by confirmed_at desc
        limit 50
      ) ad
    ),'[]'::jsonb)
  )
  into v_result
  from quote_summary qs
  cross join response_summary rs
  cross join award_summary asum;

  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.rfqh12_procurement_intelligence(integer)
from public,anon,authenticated;
grant execute on function public.rfqh12_procurement_intelligence(integer)
to authenticated;

notify pgrst,'reload schema';
