
create or replace function public.rfqh11_supplier_directory(
  p_query text default null,
  p_preferred_only boolean default false,
  p_tag text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_user_id uuid:=(select auth.uid());
  v_query text:=nullif(lower(btrim(coalesce(p_query,''))),'');
  v_tag text:=nullif(lower(btrim(coalesce(p_tag,''))),'');
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  with
  profile_base as (
    select p.*
    from public.buyer_supplier_profiles p
    where p.owner_user_id=v_user_id
      and (not coalesce(p_preferred_only,false) or p.preferred)
      and (
        v_query is null
        or lower(coalesce(p.display_name,'')) like '%'||v_query||'%'
        or lower(coalesce(p.email_normalized,'')) like '%'||v_query||'%'
        or exists(
          select 1
          from unnest(p.tags) tag
          where lower(tag) like '%'||v_query||'%'
        )
      )
      and (
        v_tag is null
        or exists(
          select 1
          from unnest(p.tags) tag
          where lower(tag)=v_tag
        )
      )
  ),
  supplier_rows as (
    select
      p.id profile_id,
      s.id supplier_id,
      s.rfq_id,
      s.status supplier_status,
      s.created_at invited_at,
      s.sent_at,
      s.responded_at,
      s.declined_at,
      s.awarded_at
    from profile_base p
    join public.buyer_rfq_suppliers s
      on s.owner_user_id=p.owner_user_id
     and s.identity_key=p.identity_key
    join public.buyer_rfq_campaigns r
      on r.id=s.rfq_id
     and r.organization_id=p.organization_id
  ),
  supplier_stats as (
    select
      profile_id,
      count(distinct rfq_id)::int rfq_count,
      count(distinct rfq_id) filter(where responded_at is not null)::int responded_rfq_count,
      count(distinct rfq_id) filter(where declined_at is not null)::int declined_rfq_count,
      round(avg(
        extract(epoch from (responded_at-coalesce(sent_at,invited_at)))/3600.0
      ) filter(
        where responded_at is not null
          and responded_at>=coalesce(sent_at,invited_at)
      )::numeric,2) avg_response_hours,
      max(responded_at) last_response_at,
      max(invited_at) last_invited_at
    from supplier_rows
    group by profile_id
  ),
  latest_quotes as (
    select *
    from (
      select
        sr.profile_id,
        q.id quote_id,
        q.rfq_id,
        q.revision_no,
        q.status,
        q.submitted_at,
        q.lead_time_days,
        q.incoterm,
        q.payment_terms,
        row_number() over(
          partition by sr.profile_id,q.rfq_id
          order by q.revision_no desc,q.created_at desc,q.id desc
        ) rn
      from supplier_rows sr
      join public.buyer_rfq_quotes q on q.supplier_id=sr.supplier_id
      where q.status in('submitted','superseded')
    ) ranked
    where rn=1
  ),
  quote_stats as (
    select
      profile_id,
      count(*)::int quoted_rfq_count,
      round(avg(lead_time_days)::numeric,1) avg_lead_time_days,
      max(submitted_at) last_quote_at
    from latest_quotes
    group by profile_id
  ),
  award_stats as (
    select
      sr.profile_id,
      count(distinct a.award_id)::int award_count,
      coalesce(sum(a.line_total_eur),0)::numeric(18,2) awarded_total_eur,
      max(aw.confirmed_at) last_award_at
    from supplier_rows sr
    join public.buyer_rfq_award_allocations a
      on a.supplier_id=sr.supplier_id
    join public.buyer_rfq_awards aw on aw.id=a.award_id
    group by sr.profile_id
  ),
  po_stats as (
    select
      sr.profile_id,
      count(distinct po.id)::int po_count,
      count(distinct po.id) filter(where po.status='supplier_confirmed')::int confirmed_po_count,
      max(coalesce(po.issued_at,po.created_at)) last_po_at
    from supplier_rows sr
    join public.buyer_purchase_order_drafts po
      on po.supplier_id=sr.supplier_id
    group by sr.profile_id
  ),
  latest_price as (
    select *
    from (
      select
        sr.profile_id,
        q.rfq_id,
        q.submitted_at,
        q.revision_no,
        dl.description,
        dl.standard_code,
        dl.grade_code,
        dl.finish_code,
        ql.normalized_eur_t,
        ql.normalized_eur_m,
        row_number() over(
          partition by sr.profile_id
          order by q.submitted_at desc nulls last,q.revision_no desc,ql.line_position,ql.id
        ) rn
      from supplier_rows sr
      join public.buyer_rfq_quotes q on q.supplier_id=sr.supplier_id
      join public.buyer_rfq_quote_lines ql on ql.quote_id=q.id
      join public.buyer_distinta_lines dl on dl.id=ql.rfq_line_id
      where q.status in('submitted','superseded')
        and ql.response_status='quoted'
        and q.submitted_at is not null
    ) ranked
    where rn=1
  ),
  enriched as (
    select
      p.*,
      coalesce(ss.rfq_count,0) rfq_count,
      coalesce(ss.responded_rfq_count,0) responded_rfq_count,
      coalesce(ss.declined_rfq_count,0) declined_rfq_count,
      case
        when coalesce(ss.rfq_count,0)=0 then 0::numeric
        else round((100.0*coalesce(ss.responded_rfq_count,0)/ss.rfq_count)::numeric,1)
      end response_rate_pct,
      ss.avg_response_hours,
      ss.last_response_at,
      coalesce(qs.quoted_rfq_count,0) quoted_rfq_count,
      qs.avg_lead_time_days,
      qs.last_quote_at,
      coalesce(a.award_count,0) award_count,
      coalesce(a.awarded_total_eur,0)::numeric(18,2) awarded_total_eur,
      a.last_award_at,
      coalesce(pos.po_count,0) po_count,
      coalesce(pos.confirmed_po_count,0) confirmed_po_count,
      pos.last_po_at,
      lp.rfq_id latest_price_rfq_id,
      lp.submitted_at latest_price_at,
      lp.revision_no latest_price_revision_no,
      lp.description latest_price_description,
      lp.standard_code latest_price_standard_code,
      lp.grade_code latest_price_grade_code,
      lp.finish_code latest_price_finish_code,
      lp.normalized_eur_t latest_price_eur_t,
      lp.normalized_eur_m latest_price_eur_m,
      exists(
        select 1
        from public.network_saved_companies ns
        where ns.user_id=v_user_id
          and ns.organization_id=p.organization_id
          and ns.network_company_id=p.supplier_network_company_id
      ) saved_in_network
    from profile_base p
    left join supplier_stats ss on ss.profile_id=p.id
    left join quote_stats qs on qs.profile_id=p.id
    left join award_stats a on a.profile_id=p.id
    left join po_stats pos on pos.profile_id=p.id
    left join latest_price lp on lp.profile_id=p.id
  )
  select jsonb_build_object(
    'contract','RFQH11-supplier-directory-v1',
    'summary',jsonb_build_object(
      'supplier_count',(select count(*) from enriched),
      'preferred_count',(select count(*) from enriched where preferred),
      'with_quotes_count',(select count(*) from enriched where quoted_rfq_count>0),
      'with_awards_count',(select count(*) from enriched where award_count>0),
      'with_confirmed_po_count',(select count(*) from enriched where confirmed_po_count>0),
      'used_last_90d_count',(
        select count(*) from enriched
        where last_used_at>=now()-interval '90 days'
      )
    ),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,
        'identity_key',e.identity_key,
        'organization_id',e.organization_id,
        'display_name',e.display_name,
        'email',e.email_normalized,
        'preferred',e.preferred,
        'tags',e.tags,
        'notes',e.notes,
        'supplier_organization_id',e.supplier_organization_id,
        'supplier_network_company_id',e.supplier_network_company_id,
        'supplier_company_id',e.supplier_company_id,
        'supplier_contact_id',e.supplier_contact_id,
        'supplier_network_contact_id',e.supplier_network_contact_id,
        'saved_in_network',e.saved_in_network,
        'first_used_at',e.first_used_at,
        'last_used_at',e.last_used_at,
        'last_rfq_id',e.last_rfq_id,
        'rfq_count',e.rfq_count,
        'responded_rfq_count',e.responded_rfq_count,
        'declined_rfq_count',e.declined_rfq_count,
        'response_rate_pct',e.response_rate_pct,
        'avg_response_hours',e.avg_response_hours,
        'last_response_at',e.last_response_at,
        'quoted_rfq_count',e.quoted_rfq_count,
        'avg_lead_time_days',e.avg_lead_time_days,
        'last_quote_at',e.last_quote_at,
        'award_count',e.award_count,
        'awarded_total_eur',e.awarded_total_eur,
        'last_award_at',e.last_award_at,
        'po_count',e.po_count,
        'confirmed_po_count',e.confirmed_po_count,
        'last_po_at',e.last_po_at,
        'latest_price',case
          when e.latest_price_at is null then null
          else jsonb_build_object(
            'rfq_id',e.latest_price_rfq_id,
            'at',e.latest_price_at,
            'revision_no',e.latest_price_revision_no,
            'description',e.latest_price_description,
            'standard_code',e.latest_price_standard_code,
            'grade_code',e.latest_price_grade_code,
            'finish_code',e.latest_price_finish_code,
            'eur_t',e.latest_price_eur_t,
            'eur_m',e.latest_price_eur_m
          )
        end
      ) order by e.preferred desc,e.last_used_at desc,e.display_name nulls last)
      from (
        select *
        from enriched
        order by preferred desc,last_used_at desc,display_name nulls last
        limit v_limit offset v_offset
      ) e
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.rfqh11_supplier_directory(text,boolean,text,integer,integer)
from public,anon,authenticated;
grant execute on function public.rfqh11_supplier_directory(text,boolean,text,integer,integer)
to authenticated;

create or replace function public.rfqh11_supplier_detail(
  p_profile_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_user_id uuid:=(select auth.uid());
  v_profile public.buyer_supplier_profiles%rowtype;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select *
  into v_profile
  from public.buyer_supplier_profiles p
  where p.id=p_profile_id
    and p.owner_user_id=v_user_id;

  if not found then
    raise exception 'Supplier profile not found or not accessible' using errcode='42501';
  end if;

  with
  supplier_rows as (
    select
      s.*,
      r.title rfq_title,
      r.status rfq_status,
      r.due_at rfq_due_at,
      r.created_at rfq_created_at
    from public.buyer_rfq_suppliers s
    join public.buyer_rfq_campaigns r on r.id=s.rfq_id
    where s.owner_user_id=v_user_id
      and r.organization_id=v_profile.organization_id
      and s.identity_key=v_profile.identity_key
  ),
  latest_quote_per_rfq as (
    select *
    from (
      select
        sr.rfq_id,
        q.id quote_id,
        q.revision_no,
        q.status quote_status,
        q.submitted_at,
        q.lead_time_days,
        q.incoterm,
        q.payment_terms,
        row_number() over(
          partition by sr.rfq_id
          order by q.revision_no desc,q.created_at desc,q.id desc
        ) rn
      from supplier_rows sr
      join public.buyer_rfq_quotes q on q.supplier_id=sr.id
      where q.status in('submitted','superseded','declined')
    ) ranked
    where rn=1
  ),
  latest_po_per_rfq as (
    select *
    from (
      select
        sr.rfq_id,
        po.id po_id,
        po.po_draft_ref,
        po.status po_status,
        po.total_eur,
        po.total_tonnes,
        po.issued_at,
        po.delivery_date,
        row_number() over(
          partition by sr.rfq_id
          order by coalesce(po.issued_at,po.created_at) desc,po.id desc
        ) rn
      from supplier_rows sr
      join public.buyer_purchase_order_drafts po on po.supplier_id=sr.id
    ) ranked
    where rn=1
  ),
  rfq_history as (
    select
      sr.rfq_id,
      sr.rfq_title,
      sr.rfq_status,
      sr.rfq_due_at,
      sr.rfq_created_at,
      sr.status supplier_status,
      sr.sent_at,
      sr.responded_at,
      sr.declined_at,
      sr.awarded_at,
      q.quote_id,
      q.revision_no,
      q.quote_status,
      q.submitted_at quote_submitted_at,
      q.lead_time_days quote_lead_time_days,
      q.incoterm,
      q.payment_terms,
      po.po_id,
      po.po_draft_ref,
      po.po_status,
      po.total_eur po_total_eur,
      po.total_tonnes po_total_tonnes,
      po.issued_at po_issued_at,
      po.delivery_date po_delivery_date
    from supplier_rows sr
    left join latest_quote_per_rfq q on q.rfq_id=sr.rfq_id
    left join latest_po_per_rfq po on po.rfq_id=sr.rfq_id
  ),
  price_history as (
    select
      sr.rfq_id,
      sr.rfq_title,
      q.id quote_id,
      q.revision_no,
      q.submitted_at,
      q.lead_time_days,
      q.incoterm,
      q.payment_terms,
      ql.line_position,
      dl.description,
      dl.standard_code,
      dl.grade_code,
      dl.finish_code,
      ql.normalized_eur_t,
      ql.normalized_eur_m,
      ql.offered_quantity,
      ql.offered_quantity_mode
    from supplier_rows sr
    join public.buyer_rfq_quotes q on q.supplier_id=sr.id
    join public.buyer_rfq_quote_lines ql on ql.quote_id=q.id
    join public.buyer_distinta_lines dl on dl.id=ql.rfq_line_id
    where q.status in('submitted','superseded')
      and ql.response_status='quoted'
      and q.submitted_at is not null
  ),
  award_summary as (
    select
      count(distinct a.award_id)::int award_count,
      coalesce(sum(a.line_total_eur),0)::numeric(18,2) awarded_total_eur,
      coalesce(sum(a.awarded_tonnes),0)::numeric(18,6) awarded_total_tonnes
    from supplier_rows sr
    join public.buyer_rfq_award_allocations a on a.supplier_id=sr.id
  ),
  base_summary as (
    select
      count(distinct sr.rfq_id)::int rfq_count,
      count(distinct sr.rfq_id) filter(where sr.responded_at is not null)::int responded_rfq_count,
      round(avg(
        extract(epoch from (sr.responded_at-coalesce(sr.sent_at,sr.created_at)))/3600.0
      ) filter(
        where sr.responded_at is not null
          and sr.responded_at>=coalesce(sr.sent_at,sr.created_at)
      )::numeric,2) avg_response_hours,
      max(sr.responded_at) last_response_at
    from supplier_rows sr
  ),
  po_summary as (
    select
      count(distinct po.id)::int po_count,
      count(distinct po.id) filter(where po.status='supplier_confirmed')::int confirmed_po_count
    from supplier_rows sr
    join public.buyer_purchase_order_drafts po on po.supplier_id=sr.id
  )
  select jsonb_build_object(
    'contract','RFQH11-supplier-detail-v1',
    'profile',jsonb_build_object(
      'id',v_profile.id,
      'identity_key',v_profile.identity_key,
      'organization_id',v_profile.organization_id,
      'display_name',v_profile.display_name,
      'email',v_profile.email_normalized,
      'preferred',v_profile.preferred,
      'tags',v_profile.tags,
      'notes',v_profile.notes,
      'supplier_organization_id',v_profile.supplier_organization_id,
      'supplier_network_company_id',v_profile.supplier_network_company_id,
      'supplier_company_id',v_profile.supplier_company_id,
      'supplier_contact_id',v_profile.supplier_contact_id,
      'supplier_network_contact_id',v_profile.supplier_network_contact_id,
      'first_used_at',v_profile.first_used_at,
      'last_used_at',v_profile.last_used_at,
      'last_rfq_id',v_profile.last_rfq_id
    ),
    'summary',(
      select jsonb_build_object(
        'rfq_count',b.rfq_count,
        'responded_rfq_count',b.responded_rfq_count,
        'response_rate_pct',case
          when b.rfq_count=0 then 0
          else round((100.0*b.responded_rfq_count/b.rfq_count)::numeric,1)
        end,
        'avg_response_hours',b.avg_response_hours,
        'last_response_at',b.last_response_at,
        'award_count',a.award_count,
        'awarded_total_eur',a.awarded_total_eur,
        'awarded_total_tonnes',a.awarded_total_tonnes,
        'po_count',p.po_count,
        'confirmed_po_count',p.confirmed_po_count
      )
      from base_summary b
      cross join award_summary a
      cross join po_summary p
    ),
    'private_company',(
      select jsonb_build_object(
        'id',c.id,
        'name',c.name,
        'country',c.country,
        'vat_number',c.vat_number,
        'website',c.website
      )
      from public.companies c
      where c.id=v_profile.supplier_company_id
        and c.organization_id=v_profile.organization_id
    ),
    'private_contact',(
      select jsonb_build_object(
        'id',ct.id,
        'full_name',ct.full_name,
        'email',ct.email_normalized,
        'phone',ct.phone,
        'role',ct.role
      )
      from public.contacts ct
      where ct.id=v_profile.supplier_contact_id
        and ct.organization_id=v_profile.organization_id
    ),
    'rfq_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'rfq_id',h.rfq_id,
        'rfq_title',h.rfq_title,
        'rfq_status',h.rfq_status,
        'rfq_due_at',h.rfq_due_at,
        'rfq_created_at',h.rfq_created_at,
        'supplier_status',h.supplier_status,
        'sent_at',h.sent_at,
        'responded_at',h.responded_at,
        'declined_at',h.declined_at,
        'awarded_at',h.awarded_at,
        'quote',case when h.quote_id is null then null else jsonb_build_object(
          'id',h.quote_id,
          'revision_no',h.revision_no,
          'status',h.quote_status,
          'submitted_at',h.quote_submitted_at,
          'lead_time_days',h.quote_lead_time_days,
          'incoterm',h.incoterm,
          'payment_terms',h.payment_terms
        ) end,
        'purchase_order',case when h.po_id is null then null else jsonb_build_object(
          'id',h.po_id,
          'ref',h.po_draft_ref,
          'status',h.po_status,
          'total_eur',h.po_total_eur,
          'total_tonnes',h.po_total_tonnes,
          'issued_at',h.po_issued_at,
          'delivery_date',h.po_delivery_date
        ) end
      ) order by h.rfq_created_at desc,h.rfq_id)
      from (
        select * from rfq_history
        order by rfq_created_at desc
        limit 50
      ) h
    ),'[]'::jsonb),
    'price_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'rfq_id',p.rfq_id,
        'rfq_title',p.rfq_title,
        'quote_id',p.quote_id,
        'revision_no',p.revision_no,
        'submitted_at',p.submitted_at,
        'lead_time_days',p.lead_time_days,
        'incoterm',p.incoterm,
        'payment_terms',p.payment_terms,
        'line_position',p.line_position,
        'description',p.description,
        'standard_code',p.standard_code,
        'grade_code',p.grade_code,
        'finish_code',p.finish_code,
        'eur_t',p.normalized_eur_t,
        'eur_m',p.normalized_eur_m,
        'offered_quantity',p.offered_quantity,
        'offered_quantity_mode',p.offered_quantity_mode
      ) order by p.submitted_at desc,p.revision_no desc,p.line_position)
      from (
        select *
        from price_history
        order by submitted_at desc,revision_no desc,line_position
        limit 100
      ) p
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.rfqh11_supplier_detail(uuid)
from public,anon,authenticated;
grant execute on function public.rfqh11_supplier_detail(uuid)
to authenticated;

notify pgrst,'reload schema';
