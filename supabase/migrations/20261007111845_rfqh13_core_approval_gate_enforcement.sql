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

  select count(*)::int,coalesce(sum(l.line_tonnes),0)::numeric,coalesce(sum(l.target_total_eur),0)::numeric
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
    1,v_total_tonnes,0,v_target_eur,0,null
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

CREATE OR REPLACE FUNCTION private.rfqh9_prepare_issue_impl(p_po_draft_id uuid, p_token_hash text, p_idempotency_key text, p_buyer_message text, p_confirmation_due_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid:=auth.uid();
  v_po public.buyer_purchase_order_drafts%rowtype;
  v_org public.organizations%rowtype;
  v_version_no integer;
  v_version_id uuid;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_po_number text;
  v_line_count integer;
  v_approval_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PO token hash';
  end if;

  if nullif(btrim(coalesce(p_idempotency_key,'')),'') is null then
    raise exception 'PO issue idempotency key required';
  end if;

  if p_confirmation_due_at is not null and p_confirmation_due_at<=now() then
    raise exception 'PO confirmation deadline must be in the future';
  end if;

  if p_buyer_message is not null and char_length(p_buyer_message)>4000 then
    raise exception 'Buyer message exceeds maximum length';
  end if;

  select * into v_po
  from public.buyer_purchase_order_drafts p
  where p.id=p_po_draft_id
    and p.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'PO draft not found or not accessible' using errcode='42501';
  end if;

  if v_po.status not in('draft','change_requested','supplier_rejected') then
    raise exception 'PO cannot be issued in current status';
  end if;

  v_approval_id:=private.rfqh13_assert_po_approval(
    v_po.id,p_buyer_message,p_confirmation_due_at
  );

  select * into v_org from public.organizations o where o.id=v_po.organization_id;

  select count(*)::int into v_line_count
  from public.buyer_purchase_order_lines l
  where l.po_draft_id=v_po.id;

  if v_line_count<1 then
    raise exception 'PO has no lines';
  end if;

  select coalesce(max(v.version_no),0)+1
  into v_version_no
  from public.buyer_purchase_order_versions v
  where v.po_draft_id=v_po.id;

  v_po_number:=v_po.po_draft_ref||'/V'||v_version_no::text;

  select jsonb_build_object(
    'po_draft_id',v_po.id,
    'rfq_id',v_po.rfq_id,
    'award_id',v_po.award_id,
    'po_number',v_po_number,
    'version_no',v_version_no,
    'buyer_organization_name',v_org.name,
    'buyer_organization_country',v_org.country_code,
    'supplier_name',v_po.supplier_name_snapshot,
    'supplier_email',v_po.supplier_email_snapshot,
    'currency_code',v_po.currency_code,
    'incoterm',v_po.incoterm,
    'payment_terms',v_po.payment_terms,
    'delivery_date',v_po.delivery_date,
    'lead_time_days',v_po.lead_time_days,
    'total_tonnes',v_po.total_tonnes,
    'total_eur',v_po.total_eur,
    'notes',v_po.notes,
    'lines',coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_po_line_id',l.id,
        'rfq_line_id',l.rfq_line_id,
        'line_position',l.line_position,
        'description',l.description,
        'standard_code',l.standard_code,
        'grade_code',l.grade_code,
        'finish_code',l.finish_code,
        'awarded_tonnes',l.awarded_tonnes,
        'awarded_meters',l.awarded_meters,
        'unit_eur_t',l.unit_eur_t,
        'unit_eur_m',l.unit_eur_m,
        'line_total_eur',l.line_total_eur,
        'lead_time_days',l.lead_time_days,
        'delivery_date',l.delivery_date
      ) order by l.line_position)
      from public.buyer_purchase_order_lines l
      where l.po_draft_id=v_po.id
    ),'[]'::jsonb)
  ) into v_snapshot;

  v_snapshot_hash:=encode(extensions.digest(v_snapshot::text,'sha256'),'hex');

  update public.buyer_purchase_order_versions
  set status='superseded',updated_at=now()
  where po_draft_id=v_po.id
    and status in('issued','supplier_rejected','change_requested');

  insert into public.buyer_purchase_order_versions(
    po_draft_id,rfq_id,supplier_id,owner_user_id,organization_id,
    version_no,status,token_hash,idempotency_key,po_number,
    buyer_organization_name_snapshot,supplier_name_snapshot,supplier_email_snapshot,
    currency_code,incoterm,payment_terms,delivery_date,lead_time_days,
    total_tonnes,total_eur,buyer_message,notes,confirmation_due_at,
    snapshot,snapshot_sha256
  ) values(
    v_po.id,v_po.rfq_id,v_po.supplier_id,v_user_id,v_po.organization_id,
    v_version_no,'issued',p_token_hash,p_idempotency_key,v_po_number,
    v_org.name,v_po.supplier_name_snapshot,v_po.supplier_email_snapshot,
    v_po.currency_code,v_po.incoterm,v_po.payment_terms,v_po.delivery_date,v_po.lead_time_days,
    v_po.total_tonnes,v_po.total_eur,nullif(btrim(coalesce(p_buyer_message,'')),''),
    v_po.notes,p_confirmation_due_at,v_snapshot,v_snapshot_hash
  )
  returning id into v_version_id;

  insert into public.buyer_purchase_order_version_lines(
    po_version_id,source_po_line_id,rfq_line_id,owner_user_id,organization_id,
    line_position,description,standard_code,grade_code,finish_code,
    awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur,
    lead_time_days,delivery_date
  )
  select
    v_version_id,l.id,l.rfq_line_id,v_user_id,v_po.organization_id,
    l.line_position,l.description,l.standard_code,l.grade_code,l.finish_code,
    l.awarded_tonnes,l.awarded_meters,l.unit_eur_t,l.unit_eur_m,l.line_total_eur,
    l.lead_time_days,l.delivery_date
  from public.buyer_purchase_order_lines l
  where l.po_draft_id=v_po.id
  order by l.line_position;

  update public.buyer_purchase_order_drafts
  set status='issued',issued_at=now(),updated_at=now()
  where id=v_po.id;

  perform private.rfqh3_log_event(
    v_po.rfq_id,v_po.supplier_id,v_user_id,v_po.organization_id,
    'purchase_order_issued',
    jsonb_build_object(
      'po_draft_id',v_po.id,
      'po_version_id',v_version_id,
      'version_no',v_version_no,
      'po_number',v_po_number,
      'snapshot_sha256',v_snapshot_hash,
      'confirmation_due_at',p_confirmation_due_at,
      'approval_id',v_approval_id
    ),
    v_user_id
  );

  perform private.rfqh13_consume_approval(v_approval_id,v_user_id);

  return jsonb_build_object(
    'po_draft_id',v_po.id,
    'po_version_id',v_version_id,
    'version_no',v_version_no,
    'po_number',v_po_number,
    'snapshot_sha256',v_snapshot_hash,
    'supplier_name',v_po.supplier_name_snapshot,
    'supplier_email',v_po.supplier_email_snapshot,
    'buyer_organization_name',v_org.name,
    'confirmation_due_at',p_confirmation_due_at
  );
end;
$function$;

notify pgrst,'reload schema';
