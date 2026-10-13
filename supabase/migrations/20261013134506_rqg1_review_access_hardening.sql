-- RQG1 temporary company-admin boundary. Keep all private evidence tenant-isolated.
create or replace function public.rqg1_require_review_admin(p_organization_id uuid)
returns void language plpgsql stable security invoker set search_path=''
as $rqg$
begin
  if p_organization_id is null or (select auth.uid()) is null or not exists (
    select 1 from public.organization_memberships m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid())
      and m.status='active' and m.role='admin'
  ) then
    raise exception using errcode='42501',message='company review administrator required';
  end if;
end;
$rqg$;
revoke all on function public.rqg1_require_review_admin(uuid) from public,anon,authenticated;
grant execute on function public.rqg1_require_review_admin(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.confirm_contact_company_mapping(p_contact_id uuid, p_company_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_review_org uuid;
begin
  select c.organization_id into v_review_org from public.contacts c where c.id=p_contact_id;
  perform public.rqg1_require_review_admin(v_review_org);
  return private.confirm_contact_company_mapping_impl(
    p_contact_id,p_company_id,p_metadata
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_activate_operational_relationship(p_organization_id uuid, p_relationship_type text, p_source_entity_id uuid, p_target_entity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.activate_operational_relationship_impl(
    p_organization_id,p_relationship_type,p_source_entity_id,p_target_entity_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_adopt_offer_reparse_candidate(p_organization_id uuid, p_candidate_id bigint, p_target_observation_id bigint, p_selected_fields text[], p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.adopt_offer_reparse_candidate_impl(
    p_organization_id,p_candidate_id,p_target_observation_id,p_selected_fields,p_note
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_apply_commercial_review_correction(p_review_id bigint, p_corrected_values jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_review public.commercial_review_queue%rowtype;
  v_obs public.commercial_observations%rowtype;
  v_allowed text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm',
    'length_mm','quantity','quantity_unit',
    'price_value','price_unit','currency','discount_percentage',
    'availability_status','note'
  ];
  v_key text;
  v_product_id uuid;
  v_product_type text;
  v_grade text;
  v_standard text;
  v_material_number text;
  v_od numeric;
  v_width numeric;
  v_height numeric;
  v_thickness numeric;
  v_length numeric;
  v_quantity numeric;
  v_quantity_unit text;
  v_price numeric;
  v_price_unit text;
  v_currency text;
  v_discount numeric;
  v_availability text;
  v_note text;
  v_original jsonb;
  v_result jsonb;
  v_event_id bigint;
begin
  if v_actor is null then
    raise exception using errcode='28000',message='authentication required';
  end if;

  if p_review_id is null or p_review_id <= 0 then
    raise exception using errcode='22023',message='valid review id required';
  end if;

  if p_corrected_values is null
     or jsonb_typeof(p_corrected_values)<>'object'
     or p_corrected_values='{}'::jsonb then
    raise exception using errcode='22023',message='at least one corrected value is required';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_corrected_values) k
    where not (k=any(v_allowed))
  ) then
    raise exception using errcode='22023',message='unsupported correction field';
  end if;

  select * into v_review
  from public.commercial_review_queue
  where id=p_review_id
  for update;

  if v_review.id is null then
    raise exception using errcode='P0002',message='review item not found';
  end if;
  perform public.rqg1_require_review_admin(v_review.organization_id);

  if v_review.status<>'pending' then
    raise exception using errcode='55000',message='review item is already completed';
  end if;

  if v_review.observation_id is null then
    raise exception using errcode='22023',message='review item is not linked to a commercial observation';
  end if;

  if v_review.organization_id is null
     or not public.is_organization_member(v_review.organization_id,true) then
    raise exception using errcode='42501',message='active tenant membership required';
  end if;

  select * into v_obs
  from public.commercial_observations
  where id=v_review.observation_id
  for update;

  if v_obs.id is null
     or v_obs.organization_id is distinct from v_review.organization_id
     or v_obs.dataset_id is distinct from v_review.dataset_id
     or v_obs.thread_id is distinct from v_review.thread_id then
    raise exception using errcode='55000',message='review/observation provenance mismatch';
  end if;

  v_product_type := case when p_corrected_values ? 'product_type'
    then nullif(btrim(p_corrected_values->>'product_type'),'')
    else v_obs.product_type end;
  v_grade := case when p_corrected_values ? 'grade'
    then nullif(btrim(p_corrected_values->>'grade'),'')
    else v_obs.grade end;
  v_standard := case when p_corrected_values ? 'standard'
    then nullif(btrim(p_corrected_values->>'standard'),'')
    else v_obs.standard end;
  v_material_number := case when p_corrected_values ? 'material_number'
    then nullif(btrim(p_corrected_values->>'material_number'),'')
    else v_obs.material_number end;

  v_od := case when p_corrected_values ? 'outer_diameter_mm'
    then nullif(btrim(p_corrected_values->>'outer_diameter_mm'),'')::numeric
    else v_obs.outer_diameter_mm end;
  v_width := case when p_corrected_values ? 'width_mm'
    then nullif(btrim(p_corrected_values->>'width_mm'),'')::numeric
    else v_obs.width_mm end;
  v_height := case when p_corrected_values ? 'height_mm'
    then nullif(btrim(p_corrected_values->>'height_mm'),'')::numeric
    else v_obs.height_mm end;
  v_thickness := case when p_corrected_values ? 'thickness_mm'
    then nullif(btrim(p_corrected_values->>'thickness_mm'),'')::numeric
    else v_obs.thickness_mm end;
  v_length := case when p_corrected_values ? 'length_mm'
    then nullif(btrim(p_corrected_values->>'length_mm'),'')::numeric
    else v_obs.length_mm end;
  v_quantity := case when p_corrected_values ? 'quantity'
    then nullif(btrim(p_corrected_values->>'quantity'),'')::numeric
    else v_obs.quantity end;
  v_quantity_unit := case when p_corrected_values ? 'quantity_unit'
    then nullif(btrim(p_corrected_values->>'quantity_unit'),'')
    else v_obs.quantity_unit end;
  v_price := case when p_corrected_values ? 'price_value'
    then nullif(btrim(p_corrected_values->>'price_value'),'')::numeric
    else v_obs.price_value end;
  v_price_unit := case when p_corrected_values ? 'price_unit'
    then nullif(btrim(p_corrected_values->>'price_unit'),'')
    else v_obs.price_unit end;
  v_currency := case when p_corrected_values ? 'currency'
    then upper(nullif(btrim(p_corrected_values->>'currency'),''))
    else v_obs.currency end;
  v_discount := case when p_corrected_values ? 'discount_percentage'
    then nullif(btrim(p_corrected_values->>'discount_percentage'),'')::numeric
    else v_obs.discount_percentage end;
  v_availability := case when p_corrected_values ? 'availability_status'
    then nullif(btrim(p_corrected_values->>'availability_status'),'')
    else v_obs.availability_status end;
  v_note := nullif(btrim(p_corrected_values->>'note'),'');

  if v_quantity is not null and v_quantity<0 then
    raise exception using errcode='22023',message='quantity cannot be negative';
  end if;
  if v_price is not null and v_price<0 then
    raise exception using errcode='22023',message='price cannot be negative';
  end if;
  if v_discount is not null and (v_discount<0 or v_discount>100) then
    raise exception using errcode='22023',message='discount percentage must be between 0 and 100';
  end if;

  v_original := jsonb_build_object(
    'product_type',v_obs.product_type,
    'grade',v_obs.grade,
    'standard',v_obs.standard,
    'material_number',v_obs.material_number,
    'outer_diameter_mm',v_obs.outer_diameter_mm,
    'width_mm',v_obs.width_mm,
    'height_mm',v_obs.height_mm,
    'thickness_mm',v_obs.thickness_mm,
    'length_mm',v_obs.length_mm,
    'quantity',v_obs.quantity,
    'quantity_unit',v_obs.quantity_unit,
    'price_value',v_obs.price_value,
    'price_unit',v_obs.price_unit,
    'currency',v_obs.currency,
    'discount_percentage',v_obs.discount_percentage,
    'availability_status',v_obs.availability_status
  );

  update public.commercial_observations
  set
    product_type=v_product_type,
    grade=v_grade,
    standard=v_standard,
    material_number=v_material_number,
    outer_diameter_mm=v_od,
    width_mm=v_width,
    height_mm=v_height,
    thickness_mm=v_thickness,
    length_mm=v_length,
    quantity=v_quantity,
    quantity_unit=v_quantity_unit,
    price_value=v_price,
    price_unit=v_price_unit,
    currency=v_currency,
    discount_percentage=v_discount,
    availability_status=v_availability,
    search_text=lower(concat_ws(' ',
      v_product_type,v_grade,v_standard,v_material_number,
      v_od::text,v_width::text,v_height::text,v_thickness::text,v_length::text,
      v_quantity::text,v_quantity_unit,v_price::text,v_price_unit,v_currency,
      v_availability
    ))
  where id=v_obs.id;

  select canonical_product_key,canonical_product_id
  into v_key,v_product_id
  from public.commercial_observations
  where id=v_obs.id;

  v_result := jsonb_build_object(
    'product_type',v_product_type,
    'grade',v_grade,
    'standard',v_standard,
    'material_number',v_material_number,
    'outer_diameter_mm',v_od,
    'width_mm',v_width,
    'height_mm',v_height,
    'thickness_mm',v_thickness,
    'length_mm',v_length,
    'quantity',v_quantity,
    'quantity_unit',v_quantity_unit,
    'price_value',v_price,
    'price_unit',v_price_unit,
    'currency',v_currency,
    'discount_percentage',v_discount,
    'availability_status',v_availability
  );

  insert into public.commercial_correction_events (
    organization_id,review_id,observation_id,corrected_by,
    original_values,requested_values,resulting_values,
    previous_canonical_product_key,resulting_canonical_product_key,
    previous_canonical_product_id,resulting_canonical_product_id,note
  ) values (
    v_review.organization_id,v_review.id,v_obs.id,v_actor,
    v_original,p_corrected_values,v_result,
    v_obs.canonical_product_key,v_key,
    v_obs.canonical_product_id,v_product_id,v_note
  )
  returning id into v_event_id;

  update public.commercial_review_queue
  set
    status='corrected',
    corrected_values=p_corrected_values,
    reviewed_at=now(),
    reviewed_by=v_actor
  where id=v_review.id;

  return jsonb_build_object(
    'review_id',v_review.id,
    'observation_id',v_obs.id,
    'correction_event_id',v_event_id,
    'status','corrected',
    'canonical_product_key',v_key,
    'canonical_product_id',v_product_id,
    'resulting_values',v_result
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.p1_apply_conversation_backfill(p_organization_id uuid, p_entity_type text, p_entity_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.apply_conversation_backfill_impl(
    p_organization_id,p_entity_type,p_entity_id,p_conversation_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_close_offer_reparse_remediation(p_organization_id uuid, p_remediation_queue_id bigint, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.close_offer_reparse_remediation_impl(
    p_organization_id,p_remediation_queue_id,p_note
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_conversation_backfill_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with entities as (
      select 'rfq'::text entity_type,r.id entity_id,r.conversation_id,r.source_message_id,
             rl.source_observation_id
      from public.rfqs r
      join public.rfq_lines rl
        on rl.organization_id=r.organization_id and rl.rfq_id=r.id
      where r.organization_id=p_organization_id

      union all

      select 'offer',o.id,o.conversation_id,o.source_message_id,ol.source_observation_id
      from public.offers o
      join public.offer_lines ol
        on ol.organization_id=o.organization_id and ol.offer_id=o.id
      where o.organization_id=p_organization_id

      union all

      select 'order',o.id,o.conversation_id,o.source_message_id,ol.source_observation_id
      from public.orders o
      join public.order_lines ol
        on ol.organization_id=o.organization_id and ol.order_id=o.id
      where o.organization_id=p_organization_id
    ),
    evidence as (
      select
        e.*,
        m.conversation_id message_conversation_id,
        c.id source_conversation_match
      from entities e
      left join public.messages m
        on m.organization_id=p_organization_id
       and m.id=e.source_message_id
      left join public.commercial_observations obs
        on obs.organization_id=p_organization_id
       and obs.id=e.source_observation_id
      left join public.conversations c
        on c.organization_id=p_organization_id
       and c.external_thread_id=obs.source_conversation_id::text
       and obs.source_conversation_id is not null
    ),
    grouped as (
      select
        entity_type,
        entity_id,
        min(conversation_id::text)::uuid existing_conversation_id,
        count(*) line_count,
        count(distinct message_conversation_id) filter(where message_conversation_id is not null) message_candidate_count,
        min(message_conversation_id::text) filter(where message_conversation_id is not null)::uuid message_candidate_id,
        count(distinct source_conversation_match) filter(where source_conversation_match is not null) source_candidate_count,
        min(source_conversation_match::text) filter(where source_conversation_match is not null)::uuid source_candidate_id
      from evidence
      group by entity_type,entity_id
    ),
    classified as (
      select
        g.*,
        case
          when existing_conversation_id is not null then 'already_linked'
          when message_candidate_count=1
               and source_candidate_count in (0,1)
               and (source_candidate_count=0 or source_candidate_id=message_candidate_id)
            then 'ready'
          when message_candidate_count=0 and source_candidate_count=1
            then 'ready'
          when message_candidate_count>1
            or source_candidate_count>1
            or (message_candidate_count=1 and source_candidate_count=1 and source_candidate_id<>message_candidate_id)
            then 'blocked'
          else 'unresolved'
        end readiness_status,
        case
          when message_candidate_count=1
               and source_candidate_count in (0,1)
               and (source_candidate_count=0 or source_candidate_id=message_candidate_id)
            then message_candidate_id
          when message_candidate_count=0 and source_candidate_count=1
            then source_candidate_id
          else null
        end candidate_conversation_id,
        case
          when message_candidate_count=1
               and source_candidate_count in (0,1)
               and (source_candidate_count=0 or source_candidate_id=message_candidate_id)
            then 'source_message'
          when message_candidate_count=0 and source_candidate_count=1
            then 'source_conversation_id'
          else null
        end evidence_type,
        array_remove(array[
          case when message_candidate_count>1 then 'multiple_message_conversations' end,
          case when source_candidate_count>1 then 'multiple_source_conversations' end,
          case when message_candidate_count=1 and source_candidate_count=1
                    and source_candidate_id<>message_candidate_id then 'conflicting_structured_identity' end,
          case when existing_conversation_id is null
                    and message_candidate_count=0 and source_candidate_count=0 then 'no_structured_conversation_match' end
        ]::text[],null) reasons
      from grouped g
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'entities_total',(select count(*) from classified),
        'ready',(select count(*) from classified where readiness_status='ready'),
        'already_linked',(select count(*) from classified where readiness_status='already_linked'),
        'blocked',(select count(*) from classified where readiness_status='blocked'),
        'unresolved',(select count(*) from classified where readiness_status='unresolved'),
        'rfq_ready',(select count(*) from classified where readiness_status='ready' and entity_type='rfq'),
        'offer_ready',(select count(*) from classified where readiness_status='ready' and entity_type='offer'),
        'order_ready',(select count(*) from classified where readiness_status='ready' and entity_type='order')
      ),
      'candidates',coalesce((
        select jsonb_agg(jsonb_build_object(
          'entity_type',entity_type,
          'entity_id',entity_id,
          'candidate_conversation_id',candidate_conversation_id,
          'evidence_type',evidence_type,
          'line_count',line_count,
          'reasons',to_jsonb(reasons)
        ) order by entity_type,entity_id)
        from (
          select * from classified
          where readiness_status='ready'
          limit greatest(1,least(coalesce(p_limit,100),500))
        ) q
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'source_message_exact',true,
        'source_conversation_id_exact',true,
        'subject_inference',false,
        'email_domain_inference',false,
        'free_text_inference',false,
        'legacy_thread_similarity',false,
        'bulk_auto_backfill',false
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_enqueue_offer_remediation_thread(p_organization_id uuid, p_thread_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.enqueue_offer_remediation_impl(p_organization_id,p_thread_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_execute_offer_recovery_disposition_batch(p_organization_id uuid, p_remediation_queue_ids bigint[], p_confirmed_count integer, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.execute_offer_recovery_disposition_batch_impl(
    p_organization_id,
    p_remediation_queue_ids,
    p_confirmed_count,
    p_note
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_expand_structured_conversation(p_organization_id uuid, p_commercial_thread_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.expand_structured_conversation_impl(
    p_organization_id,p_commercial_thread_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_normalization_coverage(p_organization_id uuid, p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id, false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with observations as (
      select
        o.id,o.item_role,o.thread_id,o.confidence,o.grade,o.standard,o.direction,
        o.source_filename,o.source_text,o.canonical_product_key,o.canonical_product_id,
        o.quantity,o.quantity_unit,o.length_mm,o.price_value,o.price_unit,o.currency,
        case
          when o.item_role='requested' then exists (
            select 1 from public.current_commercial_entity_promotions p
            where p.organization_id=o.organization_id and p.observation_id=o.id
              and p.entity_type='rfq_line' and p.status='applied'
          )
          when o.item_role='offered' then exists (
            select 1 from public.current_commercial_entity_promotions p
            where p.organization_id=o.organization_id and p.observation_id=o.id
              and p.entity_type='offer_line' and p.status='applied'
          )
          when o.item_role='ordered' then exists (
            select 1 from public.current_commercial_entity_promotions p
            where p.organization_id=o.organization_id and p.observation_id=o.id
              and p.entity_type='order_line' and p.status='applied'
          )
          else false
        end normalized,
        exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id and q.observation_id=o.id and q.status='pending'
        ) pending_review,
        (select count(*) from public.commercial_observations x
          where x.organization_id=o.organization_id and x.thread_id=o.thread_id and x.item_role=o.item_role) same_role_lines,
        (select count(*) from public.commercial_observations x
          where x.organization_id=o.organization_id and x.thread_id=o.thread_id and x.item_role='offered'
            and coalesce(x.confidence,0)>=0.90 and x.direction='outbound'
            and x.canonical_product_id is not null and x.canonical_product_key is not null
            and x.quantity is not null and x.quantity_unit is not null
            and x.price_value is not null and x.price_unit is not null and x.currency is not null
            and nullif(btrim(coalesce(x.source_text,'')),'') is not null
            and not exists(select 1 from public.commercial_review_queue q
              where q.organization_id=x.organization_id and q.observation_id=x.id and q.status='pending')
            and not exists(select 1 from public.current_commercial_entity_promotions p
              where p.organization_id=x.organization_id and p.observation_id=x.id
                and p.entity_type='offer_line' and p.status='applied')
        ) offered_eligible_lines,
        (select count(distinct x.currency) from public.commercial_observations x
          where x.organization_id=o.organization_id and x.thread_id=o.thread_id and x.item_role='offered'
            and x.currency is not null) offered_currency_count,
        (select count(*) from public.commercial_observations x
          where x.organization_id=o.organization_id and x.thread_id=o.thread_id and x.item_role='ordered'
            and coalesce(x.confidence,0)>=0.90 and x.direction='inbound'
            and x.canonical_product_id is not null and x.canonical_product_key is not null
            and x.quantity is not null and x.quantity_unit is not null
            and nullif(btrim(coalesce(x.source_text,'')),'') is not null
            and not exists(select 1 from public.commercial_review_queue q
              where q.organization_id=x.organization_id and q.observation_id=x.id and q.status='pending')
            and not exists(select 1 from public.current_commercial_entity_promotions p
              where p.organization_id=x.organization_id and p.observation_id=x.id
                and p.entity_type='order_line' and p.status='applied')
        ) ordered_eligible_lines
      from public.commercial_observations o
      where o.organization_id=p_organization_id
    ),
    classified as (
      select *,
        case
          when normalized then 'normalized'
          when item_role='delivered' then 'evidence_only'
          when pending_review then 'needs_review'
          when item_role='requested'
            and coalesce(confidence,0)>=0.90 and canonical_product_key is not null
            and quantity is not null and quantity_unit is not null and length_mm is not null
            and nullif(btrim(coalesce(source_text,'')),'') is not null and same_role_lines=1
            then 'ready'
          when item_role='offered'
            and offered_eligible_lines=same_role_lines and offered_currency_count=1
            then 'ready'
          when item_role='ordered'
            and ordered_eligible_lines=same_role_lines
            then 'ready'
          else 'blocked'
        end backlog_status,
        array_remove(array[
          case when pending_review then 'pending_review' end,
          case when coalesce(confidence,0)<0.90 then 'low_confidence' end,
          case when canonical_product_key is null then 'missing_canonical_identity' end,
          case when quantity is null or quantity_unit is null then 'missing_quantity' end,
          case when length_mm is null and item_role='requested' then 'missing_length' end,
          case when nullif(btrim(coalesce(source_text,'')),'') is null then 'missing_source_text' end,
          case when item_role='requested' and same_role_lines>1 then 'multi_line_thread' end,
          case when item_role='offered' and direction is distinct from 'outbound' then 'non_outbound_offer' end,
          case when item_role='offered' and (price_value is null or price_unit is null) then 'missing_price' end,
          case when item_role='offered' and currency is null then 'missing_currency' end,
          case when item_role='offered' and offered_currency_count>1 then 'mixed_currency_thread' end,
          case when item_role='offered' and offered_eligible_lines<same_role_lines then 'incomplete_offer_thread' end,
          case when item_role='ordered' and direction is distinct from 'inbound' then 'non_inbound_order' end,
          case when item_role='ordered' and ordered_eligible_lines<same_role_lines then 'incomplete_order_thread' end,
          case when item_role='delivered' then 'delivery_is_evidence_only' end
        ]::text[],null) reasons
      from observations
    ),
    summary as (
      select jsonb_build_object(
        'observations_total',count(*),
        'normalized_total',count(*) filter(where normalized),
        'backlog_total',count(*) filter(where backlog_status in ('ready','needs_review','blocked')),
        'ready',count(*) filter(where backlog_status='ready'),
        'needs_review',count(*) filter(where backlog_status='needs_review'),
        'blocked',count(*) filter(where backlog_status='blocked'),
        'evidence_only',count(*) filter(where backlog_status='evidence_only'),
        'requested_total',count(*) filter(where item_role='requested'),
        'requested_normalized',count(*) filter(where item_role='requested' and normalized),
        'offered_total',count(*) filter(where item_role='offered'),
        'offered_normalized',count(*) filter(where item_role='offered' and normalized),
        'ordered_total',count(*) filter(where item_role='ordered'),
        'ordered_normalized',count(*) filter(where item_role='ordered' and normalized),
        'delivered_total',count(*) filter(where item_role='delivered'),
        'coverage_pct',round(100.0*count(*) filter(where normalized) /
          nullif(count(*) filter(where item_role in ('requested','offered','ordered')),0),2)
      ) value
      from classified
    ),
    rows as (
      select jsonb_build_object(
        'observation_id',id,'item_role',item_role,'backlog_status',backlog_status,
        'reasons',to_jsonb(reasons),'thread_id',thread_id,'confidence',confidence,
        'grade',grade,'standard',standard,'canonical_product_key',canonical_product_key,
        'source_filename',source_filename,'source_text',source_text
      ) value
      from classified
      where backlog_status in ('ready','needs_review','blocked')
      order by case backlog_status when 'ready' then 0 when 'needs_review' then 1 else 2 end,
        confidence desc nulls last,id desc
      limit greatest(1,least(coalesce(p_limit,25),200))
    )
    select jsonb_build_object(
      'summary',(select value from summary),
      'backlog',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb),
      'policy',jsonb_build_object(
        'requested_promotion_enabled',true,
        'offer_promotion_enabled',true,
        'order_promotion_enabled',true,
        'delivered_operational_entity_enabled',false,
        'bulk_auto_promotion',false,
        'legacy_is_evidence',true
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_evidence_remediation_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with offered as (
      select
        o.*,
        coalesce((
          coalesce(o.confidence,0)>=0.90
          and o.direction='outbound'
          and o.canonical_product_id is not null
          and o.canonical_product_key is not null
          and o.quantity is not null
          and o.quantity_unit is not null
          and o.price_value is not null
          and o.price_unit is not null
          and o.currency is not null
          and nullif(btrim(coalesce(o.source_text,'')),'') is not null
          and not exists (
            select 1
            from public.commercial_review_queue q
            where q.organization_id=o.organization_id
              and q.observation_id=o.id
              and q.status='pending'
          )
        ),false) complete_line,
        (
          coalesce(o.source_text,'') ~* '(€|eur|euro)'
          or coalesce(o.source_clause,'') ~* '(€|eur|euro)'
        ) explicit_currency_marker,
        (
          coalesce(o.source_text,'') ~* '(\bton\.?\b|\btons?\b|\bbarre?\b|\bverghe?\b|\bpacch[io]\b|\bmt\.?\b|\bmetri\b)'
          or coalesce(o.source_clause,'') ~* '(\bton\.?\b|\btons?\b|\bbarre?\b|\bverghe?\b|\bpacch[io]\b|\bmt\.?\b|\bmetri\b)'
        ) explicit_quantity_marker
      from public.commercial_observations o
      where o.organization_id=p_organization_id
        and o.item_role='offered'
    ),
    thread_stats as (
      select
        o.thread_id,
        count(*)::int observation_count,
        count(*) filter(where o.complete_line)::int complete_count,
        count(*) filter(where not o.complete_line)::int incomplete_count,
        count(*) filter(where o.direction is distinct from 'outbound')::int direction_issue_count,
        count(*) filter(where coalesce(o.confidence,0)<0.90)::int low_confidence_count,
        count(*) filter(where o.canonical_product_id is null or o.canonical_product_key is null)::int product_identity_gap_count,
        count(*) filter(where o.quantity is null or o.quantity_unit is null)::int quantity_gap_count,
        count(*) filter(where o.price_value is null or o.price_unit is null)::int price_gap_count,
        count(*) filter(where o.currency is null)::int currency_gap_count,
        count(*) filter(
          where (o.price_value is null or o.price_unit is null or o.currency is null)
            and o.explicit_currency_marker
        )::int explicit_price_currency_marker_gap_count,
        count(*) filter(
          where (o.quantity is null or o.quantity_unit is null)
            and o.explicit_quantity_marker
        )::int explicit_quantity_marker_gap_count,
        count(*) filter(
          where exists (
            select 1 from public.commercial_review_queue q
            where q.organization_id=o.organization_id
              and q.observation_id=o.id
              and q.status='pending'
          )
        )::int pending_review_count,
        count(*) filter(
          where exists (
            select 1 from public.current_commercial_entity_promotions p
            where p.organization_id=o.organization_id
              and p.observation_id=o.id
              and p.entity_type='offer_line'
              and p.status='applied'
          )
        )::int promoted_count,
        min(o.source_filename) source_filename
      from offered o
      group by o.thread_id
    ),
    classified as (
      select
        s.*,
        t.subject,
        t.source_conversation_id,
        c.id conversation_id,
        q.id queue_id,
        q.status queue_status,
        case
          when s.direction_issue_count>0
            then 'direction_conflict'
          when s.complete_count>0 and s.complete_count<s.observation_count
            then 'mixed_complete_unique_incomplete'
          when s.product_identity_gap_count>0
            then 'product_identity_gap'
          when s.price_gap_count>0 or s.currency_gap_count>0 or s.quantity_gap_count>0
            then 'source_reparse_required'
          else null
        end category,
        case
          when s.direction_issue_count>0
            then 'manual_direction_review'
          when s.complete_count>0 and s.complete_count<s.observation_count
            then 'manual_scope_review'
          when s.product_identity_gap_count>0
            then 'product_identity_review'
          when s.price_gap_count>0 or s.currency_gap_count>0 or s.quantity_gap_count>0
            then 'source_email_reparse'
          else null
        end recommended_action
      from thread_stats s
      join public.commercial_threads t
        on t.organization_id=p_organization_id
       and t.id=s.thread_id
      left join public.conversations c
        on c.organization_id=p_organization_id
       and c.external_thread_id=t.source_conversation_id::text
      left join public.commercial_offer_remediation_queue q
        on q.organization_id=p_organization_id
       and q.thread_id=s.thread_id
      where not exists (
        select 1
        from public.commercial_offer_recoveries r
        where r.organization_id=p_organization_id
          and r.thread_id=s.thread_id
      )
        and s.promoted_count=0
    ),
    eligible as (
      select *
      from classified
      where category is not null
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'blocked_threads',(select count(*) from eligible),
        'direction_conflict',(select count(*) from eligible where category='direction_conflict'),
        'mixed_complete_unique_incomplete',(select count(*) from eligible where category='mixed_complete_unique_incomplete'),
        'product_identity_gap',(select count(*) from eligible where category='product_identity_gap'),
        'source_reparse_required',(select count(*) from eligible where category='source_reparse_required'),
        'queued_pending',(select count(*) from eligible where queue_status='pending'),
        'not_enqueued',(select count(*) from eligible where queue_id is null),
        'price_gap_threads',(select count(*) from eligible where price_gap_count>0),
        'currency_gap_threads',(select count(*) from eligible where currency_gap_count>0),
        'quantity_gap_threads',(select count(*) from eligible where quantity_gap_count>0),
        'threads_with_explicit_missing_field_marker',(
          select count(*) from eligible
          where explicit_price_currency_marker_gap_count>0
             or explicit_quantity_marker_gap_count>0
        )
      ),
      'candidates',coalesce((
        select jsonb_agg(jsonb_build_object(
          'thread_id',e.thread_id,
          'subject',e.subject,
          'source_filename',e.source_filename,
          'source_conversation_id',e.source_conversation_id,
          'conversation_id',e.conversation_id,
          'category',e.category,
          'recommended_action',e.recommended_action,
          'queue_id',e.queue_id,
          'queue_status',e.queue_status,
          'observation_count',e.observation_count,
          'complete_count',e.complete_count,
          'incomplete_count',e.incomplete_count,
          'direction_issue_count',e.direction_issue_count,
          'low_confidence_count',e.low_confidence_count,
          'product_identity_gap_count',e.product_identity_gap_count,
          'quantity_gap_count',e.quantity_gap_count,
          'price_gap_count',e.price_gap_count,
          'currency_gap_count',e.currency_gap_count,
          'explicit_price_currency_marker_gap_count',e.explicit_price_currency_marker_gap_count,
          'explicit_quantity_marker_gap_count',e.explicit_quantity_marker_gap_count,
          'pending_review_count',e.pending_review_count,
          'observations',(
            select coalesce(jsonb_agg(jsonb_build_object(
              'observation_id',o.id,
              'direction',o.direction,
              'confidence',o.confidence,
              'canonical_product_key',o.canonical_product_key,
              'quantity',o.quantity,
              'quantity_unit',o.quantity_unit,
              'price_value',o.price_value,
              'price_unit',o.price_unit,
              'currency',o.currency,
              'source_text',o.source_text,
              'source_clause',o.source_clause
            ) order by o.id),'[]'::jsonb)
            from offered o
            where o.thread_id=e.thread_id
          )
        ) order by
          case e.category
            when 'direction_conflict' then 1
            when 'mixed_complete_unique_incomplete' then 2
            when 'product_identity_gap' then 3
            else 4
          end,
          e.thread_id)
        from (
          select *
          from eligible
          limit greatest(1,least(coalesce(p_limit,100),500))
        ) e
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'pa217_contract_unchanged',true,
        'pa225_contract_unchanged',true,
        'observation_mutation',false,
        'automatic_role_reclassification',false,
        'automatic_direction_correction',false,
        'automatic_price_fill',false,
        'automatic_quantity_fill',false,
        'automatic_product_identity_fill',false,
        'source_reparse_requires_original_source',true,
        'bulk_auto_remediation',false
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_promotion_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with offered as (
      select
        o.*,
        exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id
            and q.observation_id=o.id
            and q.status='pending'
        ) pending_review,
        p.id promotion_id,
        p.entity_id promoted_offer_line_id,
        ol.offer_id promoted_offer_id,
        (
          coalesce(o.confidence,0)>=0.90
          and o.direction='outbound'
          and o.canonical_product_id is not null
          and o.canonical_product_key is not null
          and o.quantity is not null
          and o.quantity_unit is not null
          and o.price_value is not null
          and o.price_unit is not null
          and o.currency is not null
          and nullif(btrim(coalesce(o.source_text,'')),'') is not null
          and not exists (
            select 1 from public.commercial_review_queue q
            where q.organization_id=o.organization_id
              and q.observation_id=o.id
              and q.status='pending'
          )
          and p.id is null
        ) eligible
      from public.commercial_observations o
      left join public.current_commercial_entity_promotions p
        on p.organization_id=o.organization_id
       and p.observation_id=o.id
       and p.entity_type='offer_line'
       and p.status='applied'
      left join public.offer_lines ol
        on ol.organization_id=o.organization_id
       and ol.id=p.entity_id
      where o.organization_id=p_organization_id
        and o.item_role='offered'
    ),
    groups as (
      select
        organization_id,
        thread_id,
        count(*)::int line_count,
        count(*) filter(where eligible)::int eligible_count,
        count(*) filter(where promotion_id is not null)::int promoted_count,
        count(distinct promoted_offer_id) filter(where promoted_offer_id is not null)::int promoted_offer_count,
        count(distinct currency) filter(where currency is not null)::int currency_count,
        min(promoted_offer_id::text) filter(where promoted_offer_id is not null)::uuid promoted_offer_id,
        bool_or(coalesce(confidence,0)<0.90) has_low_confidence,
        bool_or(direction is distinct from 'outbound') has_non_outbound,
        bool_or(canonical_product_id is null or canonical_product_key is null) has_missing_canonical,
        bool_or(quantity is null or quantity_unit is null) has_missing_quantity,
        bool_or(price_value is null or price_unit is null) has_missing_price,
        bool_or(currency is null) has_missing_currency,
        bool_or(pending_review) has_pending_review,
        bool_or(nullif(btrim(coalesce(source_text,'')),'') is null) has_missing_source_text
      from offered
      group by organization_id,thread_id
    ),
    classified as (
      select
        g.*,
        case
          when promoted_count=line_count and promoted_offer_count=1 then 'already_promoted'
          when promoted_count>0 then 'partial_promoted'
          when eligible_count=line_count and currency_count=1 then 'ready'
          else 'blocked'
        end readiness_status,
        array_remove(array[
          case when promoted_count>0 and not (promoted_count=line_count and promoted_offer_count=1) then 'partial_promotion_state' end,
          case when has_pending_review then 'pending_review' end,
          case when has_low_confidence then 'low_confidence' end,
          case when has_non_outbound then 'non_outbound_offer' end,
          case when has_missing_canonical then 'missing_canonical_identity' end,
          case when has_missing_quantity then 'missing_quantity' end,
          case when has_missing_price then 'missing_price' end,
          case when has_missing_currency then 'missing_currency' end,
          case when has_missing_source_text then 'missing_source_text' end,
          case when currency_count>1 then 'mixed_currency_thread' end,
          case when promoted_count=0 and eligible_count<line_count then 'incomplete_offer_thread' end
        ]::text[],null) reasons
      from groups g
    ),
    summary as (
      select jsonb_build_object(
        'offer_threads',count(*),
        'offered_observations',(select count(*) from offered),
        'ready_threads',count(*) filter(where readiness_status='ready'),
        'ready_observations',coalesce(sum(line_count) filter(where readiness_status='ready'),0),
        'blocked_threads',count(*) filter(where readiness_status='blocked'),
        'partial_promoted_threads',count(*) filter(where readiness_status='partial_promoted'),
        'already_promoted_threads',count(*) filter(where readiness_status='already_promoted')
      ) value
      from classified
    ),
    rows as (
      select jsonb_build_object(
        'thread_id',c.thread_id,
        'readiness_status',c.readiness_status,
        'reasons',to_jsonb(c.reasons),
        'line_count',c.line_count,
        'eligible_count',c.eligible_count,
        'promoted_count',c.promoted_count,
        'promoted_offer_id',c.promoted_offer_id,
        'source_filename',(
          select min(o.source_filename) from offered o where o.thread_id=c.thread_id
        ),
        'lines',coalesce((
          select jsonb_agg(jsonb_build_object(
            'observation_id',o.id,
            'direction',o.direction,
            'confidence',o.confidence,
            'canonical_product_key',o.canonical_product_key,
            'quantity',o.quantity,
            'quantity_unit',o.quantity_unit,
            'price_value',o.price_value,
            'price_unit',o.price_unit,
            'currency',o.currency,
            'source_text',o.source_text
          ) order by o.id)
          from offered o where o.thread_id=c.thread_id
        ),'[]'::jsonb)
      ) value
      from classified c
      order by
        case c.readiness_status when 'ready' then 0 when 'blocked' then 1 when 'partial_promoted' then 2 else 3 end,
        c.line_count asc,c.thread_id
      limit greatest(1,least(coalesce(p_limit,100),500))
    )
    select jsonb_build_object(
      'summary',(select value from summary),
      'threads',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb),
      'policy',jsonb_build_object(
        'confidence_threshold',0.90,
        'requires_outbound',true,
        'requires_complete_thread',true,
        'requires_single_currency',true,
        'requires_canonical_identity',true,
        'requires_quantity',true,
        'requires_price',true,
        'requires_no_pending_review',true,
        'company_inference',false,
        'rfq_inference',false,
        'bulk_auto_promotion',false
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_recovery_candidate_decision_readiness(p_organization_id uuid, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  identity_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm'
  ];
  adoptable_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm',
    'quantity','quantity_unit','price_value','price_unit','currency',
    'discount_percentage','availability_status'
  ];
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with candidates as (
      select
        c.id candidate_id,
        c.run_id,
        r.remediation_queue_id,
        c.thread_id,
        c.candidate_index,
        c.source_text,
        c.item_role,
        c.candidate_evidence,
        c.review_status,
        d.id decision_id,
        d.decision,
        d.target_observation_id decided_target_observation_id,
        d.selected_fields decided_fields,
        d.decided_at,
        s.id reingest_id,
        s.status reingest_status,
        private.offer_reparse_source_binding_state(
          p_organization_id,r.id
        )->>'binding_status' source_binding_status
      from public.commercial_offer_reparse_candidates c
      join public.commercial_offer_reparse_runs r
        on r.id=c.run_id and r.organization_id=c.organization_id
      join public.commercial_offer_source_reingests s
        on s.organization_id=c.organization_id
       and s.successor_run_id=r.id
      left join public.commercial_offer_reparse_candidate_decisions d
        on d.organization_id=c.organization_id
       and d.candidate_id=c.id
      where c.organization_id=p_organization_id
        and r.supersedes_run_id is not null
        and r.status='completed'
        and s.status='consumed'
        and not exists (
          select 1
          from public.commercial_offer_reparse_run_invalidations i
          where i.organization_id=r.organization_id
            and i.run_id=r.id
        )
      order by c.id
      limit greatest(1,least(coalesce(p_limit,200),500))
    ),
    target_rows as (
      select
        c.candidate_id,
        o.id observation_id,
        o.source_text observation_source_text,
        (
          select count(*)::int
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f = c.candidate_evidence->f
        ) identity_equal_count,
        (
          select count(*)::int
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f is distinct from c.candidate_evidence->f
        ) identity_conflict_count,
        (
          select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
          from unnest(adoptable_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and (to_jsonb(o)->f is null or to_jsonb(o)->f='null'::jsonb)
        ) fields_available_to_adopt
      from candidates c
      join public.commercial_observations o
        on o.organization_id=p_organization_id
       and o.thread_id=c.thread_id
       and o.item_role='offered'
      where c.item_role='offered'
    ),
    classified as (
      select
        c.*,
        coalesce((select count(*) from target_rows t
          where t.candidate_id=c.candidate_id),0)::int offered_target_count,
        coalesce((select count(*) from target_rows t
          where t.candidate_id=c.candidate_id
            and t.identity_conflict_count=0
            and t.identity_equal_count>0),0)::int anchored_target_count,
        coalesce((select count(*) from target_rows t
          where t.candidate_id=c.candidate_id
            and t.identity_conflict_count=0),0)::int nonconflicting_target_count
      from candidates c
    ),
    decision_scope as (
      select
        c.*,
        case
          when c.decision_id is not null or c.review_status<>'pending_review'
            then 'decision_terminal'
          when c.item_role is distinct from 'offered'
            then 'preserved_out_of_scope_role'
          when c.offered_target_count=0
            then 'offered_no_target'
          when c.anchored_target_count=1
            then 'offered_explicit_decision_ready'
          when c.anchored_target_count>1
            then 'offered_manual_target_selection'
          when c.nonconflicting_target_count=1
            then 'offered_manual_confirmation_required'
          when c.nonconflicting_target_count>1
            then 'offered_manual_target_selection'
          else 'offered_no_compatible_target'
        end decision_readiness
      from classified c
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'candidate_count',(select count(*) from decision_scope),
        'offered_candidate_count',(select count(*) from decision_scope where item_role='offered'),
        'out_of_scope_role_count',(select count(*) from decision_scope where item_role is distinct from 'offered'),
        'decision_terminal',(select count(*) from decision_scope where decision_readiness='decision_terminal'),
        'offered_explicit_decision_ready',(select count(*) from decision_scope where decision_readiness='offered_explicit_decision_ready'),
        'offered_manual_confirmation_required',(select count(*) from decision_scope where decision_readiness='offered_manual_confirmation_required'),
        'offered_manual_target_selection',(select count(*) from decision_scope where decision_readiness='offered_manual_target_selection'),
        'offered_no_target',(select count(*) from decision_scope where decision_readiness='offered_no_target'),
        'offered_no_compatible_target',(select count(*) from decision_scope where decision_readiness='offered_no_compatible_target')
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'candidate_id',c.candidate_id,
          'run_id',c.run_id,
          'remediation_queue_id',c.remediation_queue_id,
          'reingest_id',c.reingest_id,
          'thread_id',c.thread_id,
          'candidate_index',c.candidate_index,
          'source_text',c.source_text,
          'item_role',c.item_role,
          'candidate_evidence',c.candidate_evidence,
          'review_status',c.review_status,
          'decision_readiness',c.decision_readiness,
          'source_binding_status',c.source_binding_status,
          'offered_target_count',c.offered_target_count,
          'anchored_target_count',c.anchored_target_count,
          'nonconflicting_target_count',c.nonconflicting_target_count,
          'decision',case when c.decision_id is null then null else jsonb_build_object(
            'id',c.decision_id,
            'decision',c.decision,
            'target_observation_id',c.decided_target_observation_id,
            'selected_fields',c.decided_fields,
            'decided_at',c.decided_at
          ) end,
          'target_observations',coalesce((
            select jsonb_agg(jsonb_build_object(
              'observation_id',t.observation_id,
              'source_text',t.observation_source_text,
              'identity_equal_count',t.identity_equal_count,
              'identity_conflict_count',t.identity_conflict_count,
              'identity_anchored',(t.identity_conflict_count=0 and t.identity_equal_count>0),
              'compatible',(t.identity_conflict_count=0),
              'fields_available_to_adopt',t.fields_available_to_adopt
            ) order by t.observation_id)
            from target_rows t
            where t.candidate_id=c.candidate_id
          ),'[]'::jsonb)
        ) order by c.candidate_id)
        from decision_scope c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'recovery_successor_only',true,
        'offer_decision_scope_role','offered',
        'out_of_scope_roles_are_preserved',true,
        'out_of_scope_roles_are_not_rejected',true,
        'explicit_target_selection_required',true,
        'explicit_field_selection_required',true,
        'automatic_candidate_adoption',false,
        'automatic_candidate_rejection',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.11'
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_recovery_candidate_reentry_audit(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with target as (
      select
        q.id remediation_queue_id,
        q.thread_id,
        q.status remediation_status,
        t.subject,
        t.source_conversation_id,
        (
          select r0.id
          from public.commercial_offer_reparse_runs r0
          join public.commercial_offer_reparse_run_invalidations i0
            on i0.organization_id=r0.organization_id and i0.run_id=r0.id
          where r0.organization_id=q.organization_id
            and r0.remediation_queue_id=q.id
          order by r0.id desc
          limit 1
        ) invalidated_predecessor_run_id,
        (
          select s0.id
          from public.commercial_offer_source_reingests s0
          where s0.organization_id=q.organization_id
            and s0.remediation_queue_id=q.id
          order by s0.id desc
          limit 1
        ) latest_reingest_id,
        coalesce((
          select jsonb_agg(distinct o.source_filename order by o.source_filename)
            filter(where o.source_filename is not null and o.item_role='offered')
          from public.commercial_observations o
          where o.organization_id=q.organization_id
            and o.thread_id=q.thread_id
        ),'[]'::jsonb) offered_source_filenames
      from public.commercial_offer_remediation_queue q
      join public.commercial_threads t
        on t.organization_id=q.organization_id and t.id=q.thread_id
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    ),
    enriched as (
      select
        x.*,
        s.status reingest_status,
        s.requested_from_run_id,
        s.source_job_id reingest_source_job_id,
        s.successor_run_id,
        s.selected_source_filename,
        s.source_selection_mode,
        s.requested_at,
        s.completed_at reingest_completed_at,
        r.status successor_status,
        r.source_job_id successor_source_job_id,
        r.source_snapshot successor_source_snapshot,
        r.supersedes_run_id,
        private.offer_reparse_source_binding_state(
          p_organization_id,
          r.id
        ) successor_binding,
        i.id successor_invalidation_id,
        i.reason successor_invalidation_reason,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.id
        ),0) candidate_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.id
            and c.item_role='offered'
        ),0) offered_candidate_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.id
            and c.review_status='pending_review'
        ),0) pending_review_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidate_decisions d
          where d.organization_id=p_organization_id
            and d.run_id=r.id
        ),0) decision_count
      from target x
      left join public.commercial_offer_source_reingests s
        on s.id=x.latest_reingest_id
       and s.organization_id=p_organization_id
      left join public.commercial_offer_reparse_runs r
        on r.id=s.successor_run_id
       and r.organization_id=p_organization_id
      left join public.commercial_offer_reparse_run_invalidations i
        on i.organization_id=p_organization_id
       and i.run_id=r.id
    ),
    classified as (
      select
        e.*,
        case
          when e.remediation_status<>'pending' then 'remediation_closed'
          when e.latest_reingest_id is null
               and jsonb_array_length(e.offered_source_filenames)>1
            then 'ambiguous_selection_required'
          when e.latest_reingest_id is null
            then 'reingest_not_started'
          when e.reingest_status='requested'
            then 'reingest_requested'
          when e.reingest_status='uploading'
            then 'reingest_uploading'
          when e.reingest_status='failed'
            then 'reingest_failed'
          when e.reingest_status='consumed' and e.successor_run_id is null
            then 'successor_missing'
          when e.successor_invalidation_id is not null
            then 'successor_provenance_invalid'
          when e.supersedes_run_id is distinct from e.requested_from_run_id
            then 'successor_chain_mismatch'
          when e.successor_source_job_id is distinct from e.reingest_source_job_id
            then 'successor_source_job_mismatch'
          when coalesce(e.successor_binding->>'binding_status','') not in (
            'valid_direct_thread','valid_source_thread'
          ) then 'successor_binding_invalid'
          when e.successor_status='queued'
            then 'successor_queued'
          when e.successor_status='processing'
            then 'successor_processing'
          when e.successor_status='failed'
            then 'successor_failed'
          when e.successor_status<>'completed'
            then 'successor_not_completed'
          when e.candidate_count=0
            then 'completed_no_candidates'
          when e.pending_review_count>0
            then 'candidate_review_ready'
          when e.decision_count=e.candidate_count
            then 'candidate_review_terminal'
          else 'candidate_review_incomplete'
        end reentry_status
      from enriched e
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from classified),
        'reingest_not_started',(select count(*) from classified where reentry_status='reingest_not_started'),
        'ambiguous_selection_required',(select count(*) from classified where reentry_status='ambiguous_selection_required'),
        'reingest_in_progress',(select count(*) from classified where reentry_status in ('reingest_requested','reingest_uploading')),
        'recovery_failed',(select count(*) from classified where reentry_status in (
          'reingest_failed','successor_missing','successor_provenance_invalid',
          'successor_chain_mismatch','successor_source_job_mismatch',
          'successor_binding_invalid','successor_failed','successor_not_completed'
        )),
        'successor_in_progress',(select count(*) from classified where reentry_status in ('successor_queued','successor_processing')),
        'completed_no_candidates',(select count(*) from classified where reentry_status='completed_no_candidates'),
        'candidate_review_ready',(select count(*) from classified where reentry_status='candidate_review_ready'),
        'candidate_review_terminal',(select count(*) from classified where reentry_status='candidate_review_terminal'),
        'candidate_review_incomplete',(select count(*) from classified where reentry_status='candidate_review_incomplete'),
        'total_successor_candidates',(select coalesce(sum(candidate_count),0) from classified),
        'total_pending_review_candidates',(select coalesce(sum(pending_review_count),0) from classified)
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'remediation_queue_id',c.remediation_queue_id,
          'thread_id',c.thread_id,
          'subject',c.subject,
          'remediation_status',c.remediation_status,
          'invalidated_predecessor_run_id',c.invalidated_predecessor_run_id,
          'reingest_id',c.latest_reingest_id,
          'reingest_status',c.reingest_status,
          'requested_from_run_id',c.requested_from_run_id,
          'selected_source_filename',c.selected_source_filename,
          'source_selection_mode',c.source_selection_mode,
          'offered_source_filenames',c.offered_source_filenames,
          'successor_run_id',c.successor_run_id,
          'successor_status',c.successor_status,
          'successor_source_job_id',c.successor_source_job_id,
          'successor_binding_status',c.successor_binding->>'binding_status',
          'successor_binding',c.successor_binding,
          'successor_invalidation_id',c.successor_invalidation_id,
          'successor_invalidation_reason',c.successor_invalidation_reason,
          'candidate_count',c.candidate_count,
          'offered_candidate_count',c.offered_candidate_count,
          'pending_review_count',c.pending_review_count,
          'decision_count',c.decision_count,
          'reentry_status',c.reentry_status
        ) order by c.remediation_queue_id)
        from classified c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'reentry_requires_consumed_reingest',true,
        'reentry_requires_completed_successor',true,
        'reentry_requires_valid_thread_binding',true,
        'reentry_requires_successor_chain_match',true,
        'reentry_requires_source_job_match',true,
        'invalidated_successor_review_allowed',false,
        'invalidated_predecessor_candidates_remain_quarantined',true,
        'automatic_candidate_adoption',false,
        'automatic_remediation_closure',false,
        'observation_mutation',false,
        'promotion_mutation',false,
        'control_phase','PA2.30.5'
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_recovery_disposition_batch_history(p_organization_id uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.offer_recovery_disposition_batch_history(
    p_organization_id,p_limit
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_recovery_matching_readiness(p_organization_id uuid, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  identity_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm'
  ];
  commercial_fields constant text[] := array[
    'quantity','quantity_unit','price_value','price_unit','currency',
    'discount_percentage','availability_status'
  ];
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with recovery_candidates as (
      select
        c.id candidate_id,
        c.run_id,
        c.thread_id,
        c.candidate_index,
        c.source_text,
        c.candidate_evidence,
        c.review_status,
        r.status run_status,
        r.supersedes_run_id,
        s.id reingest_id,
        s.status reingest_status,
        i.id successor_invalidation_id,
        private.offer_reparse_source_binding_state(
          p_organization_id,
          r.id
        ) source_binding
      from public.commercial_offer_reparse_candidates c
      join public.commercial_offer_reparse_runs r
        on r.id=c.run_id and r.organization_id=c.organization_id
      join public.commercial_offer_source_reingests s
        on s.organization_id=c.organization_id
       and s.successor_run_id=r.id
      left join public.commercial_offer_reparse_run_invalidations i
        on i.organization_id=c.organization_id
       and i.run_id=r.id
      where c.organization_id=p_organization_id
        and c.item_role='offered'
        and c.review_status='pending_review'
        and r.supersedes_run_id is not null
        and s.status='consumed'
        and r.status='completed'
        and i.id is null
        and coalesce(
          private.offer_reparse_source_binding_state(
            p_organization_id,
            r.id
          )->>'binding_status',''
        ) in ('valid_direct_thread','valid_source_thread')
      order by c.id
      limit greatest(1,least(coalesce(p_limit,200),500))
    ),
    target_rows as (
      select
        c.candidate_id,
        c.run_id,
        c.thread_id,
        c.candidate_index,
        c.source_text candidate_source_text,
        c.candidate_evidence,
        c.review_status,
        c.reingest_id,
        c.source_binding->>'binding_status' source_binding_status,
        o.id observation_id,
        o.source_text observation_source_text,
        (
          select count(*)::int
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f = c.candidate_evidence->f
        ) identity_equal_count,
        (
          select count(*)::int
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f is distinct from c.candidate_evidence->f
        ) identity_conflict_count,
        (
          select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f = c.candidate_evidence->f
        ) identity_equal_fields,
        (
          select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f is distinct from c.candidate_evidence->f
        ) identity_conflicting_fields,
        (
          select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
          from unnest(commercial_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and (to_jsonb(o)->f is null or to_jsonb(o)->f='null'::jsonb)
        ) recoverable_gap_fields,
        (
          select count(*)::int
          from unnest(commercial_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and (to_jsonb(o)->f is null or to_jsonb(o)->f='null'::jsonb)
        ) recoverable_gap_count
      from recovery_candidates c
      join public.commercial_observations o
        on o.organization_id=p_organization_id
       and o.thread_id=c.thread_id
       and o.item_role='offered'
    ),
    candidate_stats as (
      select
        c.*,
        coalesce((
          select count(*)::int
          from public.commercial_observations o
          where o.organization_id=p_organization_id
            and o.thread_id=c.thread_id
            and o.item_role='offered'
        ),0) offered_target_count,
        coalesce((
          select count(*)::int from target_rows t
          where t.candidate_id=c.candidate_id
            and t.identity_conflict_count=0
            and t.identity_equal_count>0
        ),0) anchored_compatible_target_count,
        coalesce((
          select count(*)::int from target_rows t
          where t.candidate_id=c.candidate_id
            and t.identity_conflict_count=0
        ),0) nonconflicting_target_count,
        coalesce((
          select count(*)::int from target_rows t
          where t.candidate_id=c.candidate_id
            and t.recoverable_gap_count>0
        ),0) gap_fill_target_count
      from recovery_candidates c
    ),
    classified as (
      select
        s.*,
        case
          when s.offered_target_count=0 then 'no_offered_target'
          when s.anchored_compatible_target_count=1 then 'single_anchored_compatible_target'
          when s.anchored_compatible_target_count>1 then 'multiple_anchored_compatible_targets'
          when s.anchored_compatible_target_count=0
               and s.nonconflicting_target_count=1
            then 'single_unanchored_nonconflicting_target'
          when s.anchored_compatible_target_count=0
               and s.nonconflicting_target_count>1
            then 'multiple_unanchored_nonconflicting_targets'
          else 'no_compatible_target'
        end matching_status
      from candidate_stats s
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'candidate_count',(select count(*) from classified),
        'single_anchored_compatible_target',(select count(*) from classified where matching_status='single_anchored_compatible_target'),
        'multiple_anchored_compatible_targets',(select count(*) from classified where matching_status='multiple_anchored_compatible_targets'),
        'single_unanchored_nonconflicting_target',(select count(*) from classified where matching_status='single_unanchored_nonconflicting_target'),
        'multiple_unanchored_nonconflicting_targets',(select count(*) from classified where matching_status='multiple_unanchored_nonconflicting_targets'),
        'no_compatible_target',(select count(*) from classified where matching_status='no_compatible_target'),
        'no_offered_target',(select count(*) from classified where matching_status='no_offered_target')
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'candidate_id',c.candidate_id,
          'run_id',c.run_id,
          'reingest_id',c.reingest_id,
          'thread_id',c.thread_id,
          'candidate_index',c.candidate_index,
          'source_text',c.source_text,
          'candidate_evidence',c.candidate_evidence,
          'review_status',c.review_status,
          'source_binding_status',c.source_binding->>'binding_status',
          'matching_status',c.matching_status,
          'offered_target_count',c.offered_target_count,
          'anchored_compatible_target_count',c.anchored_compatible_target_count,
          'nonconflicting_target_count',c.nonconflicting_target_count,
          'gap_fill_target_count',c.gap_fill_target_count,
          'target_observations',coalesce((
            select jsonb_agg(jsonb_build_object(
              'observation_id',t.observation_id,
              'source_text',t.observation_source_text,
              'identity_equal_count',t.identity_equal_count,
              'identity_conflict_count',t.identity_conflict_count,
              'identity_equal_fields',t.identity_equal_fields,
              'identity_conflicting_fields',t.identity_conflicting_fields,
              'recoverable_gap_fields',t.recoverable_gap_fields,
              'recoverable_gap_count',t.recoverable_gap_count,
              'compatible',
                (t.identity_conflict_count=0),
              'identity_anchored',
                (t.identity_conflict_count=0 and t.identity_equal_count>0)
            ) order by t.observation_id)
            from target_rows t
            where t.candidate_id=c.candidate_id
          ),'[]'::jsonb)
        ) order by c.candidate_id)
        from classified c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'recovery_successor_only',true,
        'offered_candidates_only',true,
        'offered_observations_only',true,
        'identity_conflict_blocks_compatibility',true,
        'identity_anchor_requires_equal_identity_field',true,
        'single_compatible_target_is_not_automatic_match',true,
        'explicit_target_selection_required',true,
        'explicit_field_selection_required',true,
        'automatic_candidate_match',false,
        'automatic_candidate_adoption',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.7'
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_recovery_outcome_reconciliation(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with target as (
      select
        q.id remediation_queue_id,
        q.thread_id,
        q.status remediation_status,
        t.subject,
        q.evidence_snapshot,
        coalesce((q.evidence_snapshot->>'price_gap_count')::int,0) price_gap_count,
        coalesce((q.evidence_snapshot->>'currency_gap_count')::int,0) currency_gap_count,
        coalesce((q.evidence_snapshot->>'quantity_gap_count')::int,0) quantity_gap_count,
        (
          select s0.id
          from public.commercial_offer_source_reingests s0
          where s0.organization_id=q.organization_id
            and s0.remediation_queue_id=q.id
          order by s0.id desc
          limit 1
        ) latest_reingest_id
      from public.commercial_offer_remediation_queue q
      join public.commercial_threads t
        on t.organization_id=q.organization_id and t.id=q.thread_id
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    ),
    recovery as (
      select
        x.*,
        s.status reingest_status,
        s.successor_run_id,
        s.selected_source_filename,
        s.source_selection_mode,
        r.status successor_status,
        i.id successor_invalidation_id,
        private.offer_reparse_source_binding_state(
          p_organization_id,
          r.id
        ) successor_binding
      from target x
      left join public.commercial_offer_source_reingests s
        on s.id=x.latest_reingest_id
       and s.organization_id=p_organization_id
      left join public.commercial_offer_reparse_runs r
        on r.id=s.successor_run_id
       and r.organization_id=p_organization_id
      left join public.commercial_offer_reparse_run_invalidations i
        on i.organization_id=p_organization_id
       and i.run_id=r.id
    ),
    evidence as (
      select
        r.*,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
        ),0) candidate_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
            and c.item_role='offered'
        ),0) offered_candidate_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
            and c.item_role='offered'
            and c.candidate_evidence ? 'price_value'
            and c.candidate_evidence->'price_value' is not null
            and c.candidate_evidence->'price_value'<>'null'::jsonb
        ),0) price_signal_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
            and c.item_role='offered'
            and c.candidate_evidence ? 'currency'
            and c.candidate_evidence->'currency' is not null
            and c.candidate_evidence->'currency'<>'null'::jsonb
        ),0) currency_signal_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
            and c.item_role='offered'
            and c.candidate_evidence ? 'quantity'
            and c.candidate_evidence->'quantity' is not null
            and c.candidate_evidence->'quantity'<>'null'::jsonb
        ),0) quantity_signal_count
      from recovery r
    ),
    reconciled as (
      select
        e.*,
        (e.price_gap_count>0) requires_price,
        (e.currency_gap_count>0) requires_currency,
        (e.quantity_gap_count>0) requires_quantity,
        (e.price_gap_count>0 and e.price_signal_count>0) price_signal_recovered,
        (e.currency_gap_count>0 and e.currency_signal_count>0) currency_signal_recovered,
        (e.quantity_gap_count>0 and e.quantity_signal_count>0) quantity_signal_recovered,
        (
          (case when e.price_gap_count>0 then 1 else 0 end) +
          (case when e.currency_gap_count>0 then 1 else 0 end) +
          (case when e.quantity_gap_count>0 then 1 else 0 end)
        ) required_evidence_type_count,
        (
          (case when e.price_gap_count>0 and e.price_signal_count>0 then 1 else 0 end) +
          (case when e.currency_gap_count>0 and e.currency_signal_count>0 then 1 else 0 end) +
          (case when e.quantity_gap_count>0 and e.quantity_signal_count>0 then 1 else 0 end)
        ) recovered_evidence_type_count
      from evidence e
    ),
    classified as (
      select
        r.*,
        case
          when r.remediation_status<>'pending' then 'remediation_closed'
          when r.latest_reingest_id is null then 'recovery_not_started'
          when r.reingest_status in ('requested','uploading') then 'recovery_in_progress'
          when r.reingest_status='failed' then 'recovery_failed'
          when r.successor_run_id is null then 'successor_missing'
          when r.successor_invalidation_id is not null then 'successor_provenance_invalid'
          when coalesce(r.successor_binding->>'binding_status','') not in (
            'valid_direct_thread','valid_source_thread'
          ) then 'successor_binding_invalid'
          when r.successor_status in ('queued','processing') then 'successor_in_progress'
          when r.successor_status='failed' then 'successor_failed'
          when r.successor_status<>'completed' then 'successor_not_completed'
          when r.candidate_count=0 then 'completed_no_candidates'
          when r.offered_candidate_count=0 then 'completed_no_offered_candidates'
          when r.recovered_evidence_type_count=0 then 'no_required_evidence_recovered'
          when r.recovered_evidence_type_count<r.required_evidence_type_count
            then 'partial_required_evidence_recovered'
          when r.required_evidence_type_count>0
            and r.recovered_evidence_type_count=r.required_evidence_type_count
            then 'all_required_evidence_types_present'
          else 'completed_candidates_present'
        end reconciliation_status
      from reconciled r
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from classified),
        'recovery_not_started',(select count(*) from classified where reconciliation_status='recovery_not_started'),
        'recovery_in_progress',(select count(*) from classified where reconciliation_status in ('recovery_in_progress','successor_in_progress')),
        'recovery_failed',(select count(*) from classified where reconciliation_status in (
          'recovery_failed','successor_missing','successor_provenance_invalid',
          'successor_binding_invalid','successor_failed','successor_not_completed'
        )),
        'completed_no_candidates',(select count(*) from classified where reconciliation_status='completed_no_candidates'),
        'completed_no_offered_candidates',(select count(*) from classified where reconciliation_status='completed_no_offered_candidates'),
        'no_required_evidence_recovered',(select count(*) from classified where reconciliation_status='no_required_evidence_recovered'),
        'partial_required_evidence_recovered',(select count(*) from classified where reconciliation_status='partial_required_evidence_recovered'),
        'all_required_evidence_types_present',(select count(*) from classified where reconciliation_status='all_required_evidence_types_present'),
        'total_successor_candidates',(select coalesce(sum(candidate_count),0) from classified),
        'total_offered_successor_candidates',(select coalesce(sum(offered_candidate_count),0) from classified)
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'remediation_queue_id',c.remediation_queue_id,
          'thread_id',c.thread_id,
          'subject',c.subject,
          'remediation_status',c.remediation_status,
          'reingest_id',c.latest_reingest_id,
          'reingest_status',c.reingest_status,
          'selected_source_filename',c.selected_source_filename,
          'source_selection_mode',c.source_selection_mode,
          'successor_run_id',c.successor_run_id,
          'successor_status',c.successor_status,
          'successor_binding_status',c.successor_binding->>'binding_status',
          'successor_invalidation_id',c.successor_invalidation_id,
          'candidate_count',c.candidate_count,
          'offered_candidate_count',c.offered_candidate_count,
          'original_gap_counts',jsonb_build_object(
            'price',c.price_gap_count,
            'currency',c.currency_gap_count,
            'quantity',c.quantity_gap_count
          ),
          'recovered_signal_counts',jsonb_build_object(
            'price',c.price_signal_count,
            'currency',c.currency_signal_count,
            'quantity',c.quantity_signal_count
          ),
          'required_evidence_types',jsonb_build_object(
            'price',c.requires_price,
            'currency',c.requires_currency,
            'quantity',c.requires_quantity
          ),
          'recovered_evidence_types',jsonb_build_object(
            'price',c.price_signal_recovered,
            'currency',c.currency_signal_recovered,
            'quantity',c.quantity_signal_recovered
          ),
          'required_evidence_type_count',c.required_evidence_type_count,
          'recovered_evidence_type_count',c.recovered_evidence_type_count,
          'reconciliation_status',c.reconciliation_status
        ) order by c.remediation_queue_id)
        from classified c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'evidence_type_presence_is_not_gap_resolution',true,
        'candidate_observation_matching_required_before_resolution',true,
        'offered_candidates_only_for_recovery_signals',true,
        'invalidated_successor_evidence_allowed',false,
        'automatic_candidate_adoption',false,
        'automatic_remediation_closure',false,
        'observation_mutation',false,
        'promotion_mutation',false,
        'control_phase','PA2.30.6'
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_recovery_remediation_disposition_readiness(p_organization_id uuid, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with states as (
      select private.offer_recovery_remediation_disposition_state(
        p_organization_id,q.id
      ) state
      from public.commercial_offer_remediation_queue q
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,200),500))
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'remediation_count',(select count(*) from states),
        'recovery_not_ready',(select count(*) from states where state->>'disposition_status'='recovery_not_ready'),
        'recovery_in_progress',(select count(*) from states where state->>'disposition_status'='recovery_in_progress'),
        'ready_dismiss_no_offered_evidence',(select count(*) from states where state->>'disposition_status'='ready_dismiss_no_offered_evidence'),
        'offer_decision_required',(select count(*) from states where state->>'disposition_status'='offer_decision_required'),
        'offer_decisions_incomplete',(select count(*) from states where state->>'disposition_status'='offer_decisions_incomplete'),
        'ready_resolve',(select count(*) from states where state->>'disposition_status'='ready_resolve'),
        'ready_dismiss_no_recovery',(select count(*) from states where state->>'disposition_status'='ready_dismiss_no_recovery'),
        'residual_evidence_gap',(select count(*) from states where state->>'disposition_status'='residual_evidence_gap'),
        'conflict_review_required',(select count(*) from states where state->>'disposition_status'='conflict_review_required'),
        'already_closed',(select count(*) from states where state->>'disposition_status'='already_closed'),
        'total_offered_candidates',coalesce((select sum((state->>'offered_candidate_count')::int) from states),0),
        'total_preserved_out_of_scope_candidates',coalesce((select sum((state->>'out_of_scope_candidate_count')::int) from states),0)
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'remediation_queue_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'recovery_successor_required',true,
        'decision_scope_role','offered',
        'out_of_scope_candidates_preserved',true,
        'out_of_scope_candidates_do_not_block_offer_disposition',true,
        'no_offered_candidate_recovery_requires_explicit_dismissal',true,
        'dismissal_note_required',true,
        'automatic_candidate_rejection',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.12'
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_recovery_residual_candidate_resolution_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with candidate_ids as (
      select c.id
      from public.commercial_offer_reparse_candidates c
      join public.commercial_offer_reparse_runs r
        on r.id=c.run_id and r.organization_id=c.organization_id
      join public.commercial_offer_remediation_queue q
        on q.id=r.remediation_queue_id and q.organization_id=r.organization_id
      where c.organization_id=p_organization_id
        and r.supersedes_run_id is not null
        and c.item_role='offered'
        and c.review_status='pending_review'
        and q.status='pending'
      order by c.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    ),
    states as (
      select private.offer_recovery_residual_candidate_resolution_state(
        p_organization_id,id
      ) state
      from candidate_ids
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'candidate_count',(select count(*) from states),
        'source_provenance_target_ready',(
          select count(*) from states
          where state->>'status'='source_provenance_target_ready'
        ),
        'blocked',(select count(*) from states where state->>'status'='blocked'),
        'terminal',(select count(*) from states where state->>'status'='terminal')
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'candidate_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'same_thread_required',true,
        'same_source_filename_required',true,
        'candidate_text_containment_required',true,
        'unique_source_target_required',true,
        'pa2308_adoption_guard_required',true,
        'explicit_target_confirmation_required',true,
        'explicit_field_confirmation_required',true,
        'automatic_candidate_adoption',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.14'
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_recovery_residual_gap_reconciliation_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with states as (
      select private.offer_recovery_residual_gap_reconciliation_state(
        p_organization_id,q.id
      ) state
      from public.commercial_offer_remediation_queue q
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'remediation_count',(select count(*) from states),
        'ready_finalize_no_price_present',(
          select count(*) from states
          where state->>'status'='ready_finalize_no_price_present'
        ),
        'ready_finalize_recovered_evidence',(
          select count(*) from states
          where state->>'status'='ready_finalize_recovered_evidence'
        ),
        'blocked',(
          select count(*) from states
          where state->>'status' like 'blocked_%'
        ),
        'already_closed',(
          select count(*) from states
          where state->>'status'='already_closed'
        )
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'remediation_queue_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'thread_level_evidence_reconciliation',true,
        'per_observation_completeness_not_required',true,
        'price_required_only_when_source_marker_present',true,
        'currency_required_only_when_price_source_marker_present',true,
        'quantity_required_when_source_quantity_evidence_present',true,
        'accepted_offer_candidate_required',true,
        'explicit_finalization_required',true,
        'finalization_note_required',true,
        'automatic_observation_fill',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.15'
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_reparse_candidate_review(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.offer_reparse_candidate_review_guarded_impl(
    p_organization_id,p_limit
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_reparse_remediation_closure_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with states as (
      select private.offer_reparse_remediation_closure_state(
        p_organization_id,q.id
      ) state
      from public.commercial_offer_remediation_queue q
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'remediation_count',(select count(*) from states),
        'ready_resolve',(select count(*) from states where state->>'closure_status'='ready_resolve'),
        'ready_dismiss',(select count(*) from states where state->>'closure_status' in (
          'ready_dismiss_no_candidates','ready_dismiss_no_recovery'
        )),
        'waiting_on_run',(select count(*) from states where state->>'closure_status' in (
          'run_queued','run_processing'
        )),
        'run_failed',(select count(*) from states where state->>'closure_status'='run_failed'),
        'run_provenance_invalid',(select count(*) from states where state->>'closure_status'='run_provenance_invalid'),
        'candidate_decisions_pending',(select count(*) from states where state->>'closure_status' in (
          'candidates_pending','decisions_incomplete'
        )),
        'conflict_review_required',(select count(*) from states where state->>'closure_status'='conflict_review_required'),
        'residual_evidence_gap',(select count(*) from states where state->>'closure_status'='residual_evidence_gap'),
        'already_closed',(select count(*) from states where state->>'closure_status'='already_closed')
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'remediation_queue_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'explicit_close_required',true,
        'automatic_closure',false,
        'invalid_source_run_closure_allowed',false,
        'reingest_required_after_provenance_invalidation',true,
        'observation_mutation',false,
        'promotion_mutation',false
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_offer_source_reingest_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with target as (
      select
        q.id remediation_queue_id,
        q.thread_id,
        t.subject,
        t.source_conversation_id,
        ir.id invalidated_run_id,
        sr.id reingest_id,
        sr.status reingest_status,
        sr.source_job_id,
        sr.successor_run_id,
        sr.filename,
        sr.error,
        (
          select coalesce(jsonb_agg(distinct o.source_filename order by o.source_filename),'[]'::jsonb)
          from public.commercial_observations o
          where o.organization_id=q.organization_id
            and o.thread_id=q.thread_id
            and o.source_filename is not null
        ) expected_source_filenames,
        (
          select coalesce(jsonb_agg(distinct o.source_filename order by o.source_filename),'[]'::jsonb)
          from public.commercial_observations o
          where o.organization_id=q.organization_id
            and o.thread_id=q.thread_id
            and o.source_filename is not null
            and o.item_role='offered'
        ) offered_source_filenames
      from public.commercial_offer_remediation_queue q
      join public.commercial_threads t
        on t.organization_id=q.organization_id and t.id=q.thread_id
      left join lateral (
        select r.id
        from public.commercial_offer_reparse_runs r
        join public.commercial_offer_reparse_run_invalidations i
          on i.organization_id=r.organization_id and i.run_id=r.id
        where r.organization_id=q.organization_id
          and r.remediation_queue_id=q.id
        order by r.id desc limit 1
      ) ir on true
      left join lateral (
        select s.*
        from public.commercial_offer_source_reingests s
        where s.organization_id=q.organization_id
          and s.remediation_queue_id=q.id
        order by s.id desc limit 1
      ) sr on true
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
        and q.status='pending'
    ),
    enriched as (
      select
        target.*,
        case
          when jsonb_array_length(offered_source_filenames)=1
            then offered_source_filenames->>0
          else null
        end preferred_source_filename,
        case
          when jsonb_array_length(offered_source_filenames)=1 then 'unique_offered_source'
          when jsonb_array_length(offered_source_filenames)>1 then 'ambiguous_offered_source'
          else 'missing_offered_source'
        end source_selection_status
      from target
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from enriched),
        'needs_reingest',(select count(*) from enriched where invalidated_run_id is not null and reingest_id is null),
        'requested',(select count(*) from enriched where reingest_status='requested'),
        'uploading',(select count(*) from enriched where reingest_status='uploading'),
        'recovered',(select count(*) from enriched where reingest_status='consumed'),
        'failed',(select count(*) from enriched where reingest_status='failed'),
        'batch_auto_match_ready',(select count(*) from enriched
          where invalidated_run_id is not null
            and coalesce(reingest_status,'') not in ('uploading','consumed')
            and source_selection_status='unique_offered_source'),
        'batch_ambiguous',(select count(*) from enriched
          where invalidated_run_id is not null
            and coalesce(reingest_status,'') not in ('uploading','consumed')
            and source_selection_status='ambiguous_offered_source')
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'remediation_queue_id',x.remediation_queue_id,
          'thread_id',x.thread_id,
          'subject',x.subject,
          'source_conversation_id',x.source_conversation_id,
          'invalidated_run_id',x.invalidated_run_id,
          'reingest_id',x.reingest_id,
          'reingest_status',x.reingest_status,
          'source_job_id',x.source_job_id,
          'successor_run_id',x.successor_run_id,
          'filename',x.filename,
          'error',x.error,
          'expected_source_filenames',x.expected_source_filenames,
          'offered_source_filenames',x.offered_source_filenames,
          'preferred_source_filename',x.preferred_source_filename,
          'source_selection_status',x.source_selection_status,
          'action_status',case
            when x.invalidated_run_id is null then 'not_required'
            when x.reingest_status='consumed' then 'recovered'
            when x.reingest_status='requested' then 'awaiting_upload'
            when x.reingest_status='uploading' then 'uploading'
            when x.reingest_status='failed' then 'retry_allowed'
            else 'needs_reingest'
          end
        ) order by x.thread_id)
        from (
          select * from enriched
          limit greatest(1,least(coalesce(p_limit,100),500))
        ) x
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'allowed_extensions',jsonb_build_array('.eml'),
        'bulk_archive_extension','.zip',
        'source_only',true,
        'thread_binding_required',true,
        'checksum_required',true,
        'observation_mutation',false,
        'automatic_promotion',false,
        'successor_run_candidate_only',true,
        'batch_auto_match_requires_unique_offered_source',true,
        'ambiguous_source_requires_manual_selection',true
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_operational_relationship_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with offer_rfq_raw as (
      select o.id source_id,r.id target_id,o.conversation_id,
             count(*) over(partition by o.id) candidate_count
      from public.offers o
      join public.rfqs r
        on r.organization_id=o.organization_id
       and r.conversation_id=o.conversation_id
       and o.conversation_id is not null
      where o.organization_id=p_organization_id
        and o.rfq_id is null
        and private.normalized_line_multiset_matches(p_organization_id,'offer',o.id,'rfq',r.id)
    ),
    offer_rfq as (
      select 'offer_rfq'::text relationship_type,source_id,target_id,conversation_id
      from offer_rfq_raw where candidate_count=1
    ),
    order_offer_raw as (
      select o.id source_id,f.id target_id,o.conversation_id,
             count(*) over(partition by o.id) candidate_count
      from public.orders o
      join public.offers f
        on f.organization_id=o.organization_id
       and f.conversation_id=o.conversation_id
       and o.conversation_id is not null
      where o.organization_id=p_organization_id
        and o.offer_id is null
        and private.normalized_line_multiset_matches(p_organization_id,'order',o.id,'offer',f.id)
    ),
    order_offer as (
      select 'order_offer'::text relationship_type,source_id,target_id,conversation_id
      from order_offer_raw where candidate_count=1
    ),
    order_rfq_raw as (
      select o.id source_id,r.id target_id,o.conversation_id,
             count(*) over(partition by o.id) candidate_count
      from public.orders o
      join public.rfqs r
        on r.organization_id=o.organization_id
       and r.conversation_id=o.conversation_id
       and o.conversation_id is not null
      where o.organization_id=p_organization_id
        and o.rfq_id is null
        and private.normalized_line_multiset_matches(p_organization_id,'order',o.id,'rfq',r.id)
    ),
    order_rfq as (
      select 'order_rfq'::text relationship_type,source_id,target_id,conversation_id
      from order_rfq_raw where candidate_count=1
    ),
    candidates as (
      select * from offer_rfq
      union all select * from order_offer
      union all select * from order_rfq
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'ready_total',(select count(*) from candidates),
        'offer_rfq_ready',(select count(*) from candidates where relationship_type='offer_rfq'),
        'order_offer_ready',(select count(*) from candidates where relationship_type='order_offer'),
        'order_rfq_ready',(select count(*) from candidates where relationship_type='order_rfq')
      ),
      'candidates',coalesce((
        select jsonb_agg(jsonb_build_object(
          'relationship_type',relationship_type,
          'source_entity_id',source_id,
          'target_entity_id',target_id,
          'conversation_id',conversation_id,
          'evidence_type','shared_normalized_conversation_exact_product'
        ) order by relationship_type,source_id)
        from (select * from candidates limit greatest(1,least(coalesce(p_limit,100),500))) q
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'requires_shared_normalized_conversation',true,
        'requires_exact_product_multiset',true,
        'requires_unique_candidate',true,
        'company_inference',false,
        'email_domain_inference',false,
        'legacy_thread_similarity',false,
        'bulk_auto_activation',false
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_order_promotion_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with ordered as (
      select
        o.*,
        exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id
            and q.observation_id=o.id
            and q.status='pending'
        ) pending_review,
        p.id promotion_id,
        p.entity_id promoted_order_line_id,
        ol.order_id promoted_order_id,
        (
          coalesce(o.confidence,0)>=0.90
          and o.direction='inbound'
          and o.canonical_product_id is not null
          and o.canonical_product_key is not null
          and o.quantity is not null
          and o.quantity_unit is not null
          and nullif(btrim(coalesce(o.source_text,'')),'') is not null
          and not exists (
            select 1 from public.commercial_review_queue q
            where q.organization_id=o.organization_id
              and q.observation_id=o.id
              and q.status='pending'
          )
          and p.id is null
        ) eligible
      from public.commercial_observations o
      left join public.current_commercial_entity_promotions p
        on p.organization_id=o.organization_id
       and p.observation_id=o.id
       and p.entity_type='order_line'
       and p.status='applied'
      left join public.order_lines ol
        on ol.organization_id=o.organization_id
       and ol.id=p.entity_id
      where o.organization_id=p_organization_id
        and o.item_role='ordered'
    ),
    groups as (
      select
        organization_id,
        thread_id,
        count(*)::int line_count,
        count(*) filter(where eligible)::int eligible_count,
        count(*) filter(where promotion_id is not null)::int promoted_count,
        count(distinct promoted_order_id) filter(where promoted_order_id is not null)::int promoted_order_count,
        min(promoted_order_id::text) filter(where promoted_order_id is not null)::uuid promoted_order_id,
        bool_or(coalesce(confidence,0)<0.90) has_low_confidence,
        bool_or(direction is distinct from 'inbound') has_non_inbound,
        bool_or(canonical_product_id is null or canonical_product_key is null) has_missing_canonical,
        bool_or(quantity is null or quantity_unit is null) has_missing_quantity,
        bool_or(pending_review) has_pending_review,
        bool_or(nullif(btrim(coalesce(source_text,'')),'') is null) has_missing_source_text
      from ordered
      group by organization_id,thread_id
    ),
    classified as (
      select
        g.*,
        case
          when promoted_count=line_count and promoted_order_count=1 then 'already_promoted'
          when promoted_count>0 then 'partial_promoted'
          when eligible_count=line_count then 'ready'
          else 'blocked'
        end readiness_status,
        array_remove(array[
          case when promoted_count>0 and not (promoted_count=line_count and promoted_order_count=1) then 'partial_promotion_state' end,
          case when has_pending_review then 'pending_review' end,
          case when has_low_confidence then 'low_confidence' end,
          case when has_non_inbound then 'non_inbound_order' end,
          case when has_missing_canonical then 'missing_canonical_identity' end,
          case when has_missing_quantity then 'missing_quantity' end,
          case when has_missing_source_text then 'missing_source_text' end,
          case when promoted_count=0 and eligible_count<line_count then 'incomplete_order_thread' end
        ]::text[],null) reasons
      from groups g
    ),
    summary as (
      select jsonb_build_object(
        'order_threads',count(*),
        'ordered_observations',(select count(*) from ordered),
        'ready_threads',count(*) filter(where readiness_status='ready'),
        'ready_observations',coalesce(sum(line_count) filter(where readiness_status='ready'),0),
        'blocked_threads',count(*) filter(where readiness_status='blocked'),
        'partial_promoted_threads',count(*) filter(where readiness_status='partial_promoted'),
        'already_promoted_threads',count(*) filter(where readiness_status='already_promoted')
      ) value
      from classified
    ),
    rows as (
      select jsonb_build_object(
        'thread_id',c.thread_id,
        'readiness_status',c.readiness_status,
        'reasons',to_jsonb(c.reasons),
        'line_count',c.line_count,
        'eligible_count',c.eligible_count,
        'promoted_count',c.promoted_count,
        'promoted_order_id',c.promoted_order_id,
        'source_filename',(
          select min(o.source_filename) from ordered o where o.thread_id=c.thread_id
        ),
        'lines',coalesce((
          select jsonb_agg(jsonb_build_object(
            'observation_id',o.id,
            'direction',o.direction,
            'confidence',o.confidence,
            'canonical_product_key',o.canonical_product_key,
            'quantity',o.quantity,
            'quantity_unit',o.quantity_unit,
            'price_value',o.price_value,
            'price_unit',o.price_unit,
            'currency',o.currency,
            'source_text',o.source_text
          ) order by o.id)
          from ordered o where o.thread_id=c.thread_id
        ),'[]'::jsonb)
      ) value
      from classified c
      order by
        case c.readiness_status when 'ready' then 0 when 'blocked' then 1 when 'partial_promoted' then 2 else 3 end,
        c.line_count asc,c.thread_id
      limit greatest(1,least(coalesce(p_limit,100),500))
    )
    select jsonb_build_object(
      'summary',(select value from summary),
      'threads',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb),
      'policy',jsonb_build_object(
        'confidence_threshold',0.90,
        'requires_inbound',true,
        'requires_complete_thread',true,
        'requires_canonical_identity',true,
        'requires_quantity',true,
        'requires_price',false,
        'requires_no_pending_review',true,
        'company_inference',false,
        'rfq_inference',false,
        'offer_inference',false,
        'bulk_auto_promotion',false
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_promote_ready_offer_thread(p_organization_id uuid, p_thread_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.promote_offered_thread_impl(p_organization_id,p_thread_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_promote_ready_order_thread(p_organization_id uuid, p_thread_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.promote_ordered_thread_impl(p_organization_id,p_thread_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_promote_ready_rfq_observation(p_organization_id uuid, p_observation_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  obs public.commercial_observations%rowtype;
  requested_lines_in_thread integer;
  result jsonb;
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_organization_member(p_organization_id, true) then
    raise exception 'Active organization write membership required';
  end if;

  select *
  into obs
  from public.commercial_observations
  where organization_id=p_organization_id
    and id=p_observation_id
  ;

  if not found then
    raise exception 'Observation not found in organization';
  end if;

  if exists (
    select 1 from public.current_commercial_entity_promotions p
    where p.organization_id=p_organization_id
      and p.observation_id=p_observation_id
      and p.entity_type='rfq_line'
      and p.status='applied'
  ) then
    return private.promote_requested_observation_impl(p_observation_id);
  end if;

  if obs.item_role <> 'requested' then
    raise exception 'Only requested observations are eligible';
  end if;

  select count(*)
  into requested_lines_in_thread
  from public.commercial_observations x
  where x.organization_id=p_organization_id
    and x.thread_id=obs.thread_id
    and x.item_role='requested';

  if coalesce(obs.confidence,0)<0.90
     or obs.canonical_product_id is null
     or obs.canonical_product_key is null
     or obs.quantity is null
     or obs.quantity_unit is null
     or obs.length_mm is null
     or nullif(btrim(coalesce(obs.source_text,'')),'') is null
     or requested_lines_in_thread<>1
     or exists (
       select 1 from public.commercial_review_queue q
       where q.organization_id=p_organization_id
         and q.observation_id=p_observation_id
         and q.status='pending'
     )
  then
    raise exception 'Observation is not PA2.15 ready for controlled RFQ promotion';
  end if;

  result := private.promote_requested_observation_impl(p_observation_id);

  if result->>'status' not in ('promoted','already_promoted') then
    raise exception 'Unexpected promotion result';
  end if;

  return result || jsonb_build_object(
    'control_phase','PA2.16',
    'execution_mode','single_explicit'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_recover_shadow_duplicate_offer(p_organization_id uuid, p_thread_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.recover_shadow_duplicate_offer_impl(p_organization_id,p_thread_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_reject_offer_reparse_candidate(p_organization_id uuid, p_candidate_id bigint, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.reject_offer_reparse_candidate_impl(
    p_organization_id,p_candidate_id,p_note
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_relationship_gap_offer_recovery_audit(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with rfq as (
      select r.id rfq_id,r.conversation_id,rl.canonical_product_key
      from public.rfqs r
      join public.rfq_lines rl
        on rl.organization_id=r.organization_id and rl.rfq_id=r.id
      where r.organization_id=p_organization_id
    ),
    ord as (
      select o.id order_id,o.conversation_id,ol.canonical_product_key
      from public.orders o
      join public.order_lines ol
        on ol.organization_id=o.organization_id and ol.order_id=o.id
      where o.organization_id=p_organization_id
    ),
    relationship_pairs as (
      select distinct r.conversation_id,r.rfq_id,o.order_id
      from rfq r
      join ord o on o.conversation_id=r.conversation_id
    ),
    relationship_exact_pairs as (
      select distinct r.conversation_id,r.rfq_id,o.order_id
      from rfq r
      join ord o
        on o.conversation_id=r.conversation_id
       and o.canonical_product_key=r.canonical_product_key
    ),
    offered as (
      select
        o.*,
        exists (
          select 1 from public.commercial_review_queue q
          where q.organization_id=o.organization_id
            and q.observation_id=o.id
            and q.status='pending'
        ) pending_review,
        exists (
          select 1 from public.current_commercial_entity_promotions p
          where p.organization_id=o.organization_id
            and p.observation_id=o.id
            and p.entity_type='offer_line'
            and p.status='applied'
        ) already_promoted,
        coalesce((
          coalesce(o.confidence,0)>=0.90
          and o.direction='outbound'
          and o.canonical_product_id is not null
          and o.canonical_product_key is not null
          and o.quantity is not null
          and o.quantity_unit is not null
          and o.price_value is not null
          and o.price_unit is not null
          and o.currency is not null
          and nullif(btrim(coalesce(o.source_text,'')),'') is not null
          and not exists (
            select 1 from public.commercial_review_queue q
            where q.organization_id=o.organization_id
              and q.observation_id=o.id
              and q.status='pending'
          )
        ),false) complete_line
      from public.commercial_observations o
      where o.organization_id=p_organization_id
        and o.item_role='offered'
    ),
    offer_threads as (
      select
        o.thread_id,
        count(*)::int observation_count,
        count(*) filter(where o.complete_line)::int complete_count,
        count(*) filter(where not o.complete_line)::int incomplete_count,
        count(distinct o.currency) filter(where o.complete_line)::int complete_currency_count,
        bool_or(o.pending_review) has_pending_review,
        bool_or(o.already_promoted) has_existing_promotion,
        bool_and(
          o.complete_line
          or (
            coalesce(o.confidence,0)>=0.90
            and o.direction='outbound'
            and o.canonical_product_key is not null
            and nullif(btrim(coalesce(o.source_text,'')),'') is not null
            and not o.pending_review
            and exists (
              select 1
              from offered c
              where c.thread_id=o.thread_id
                and c.complete_line
                and c.canonical_product_key=o.canonical_product_key
                and (
                  o.quantity is null
                  or (
                    o.quantity=c.quantity
                    and o.quantity_unit=c.quantity_unit
                  )
                )
            )
          )
        ) all_incomplete_shadowed,
        count(*) filter(
          where not o.complete_line
            and not exists (
              select 1
              from offered c
              where c.thread_id=o.thread_id
                and c.complete_line
                and c.canonical_product_key=o.canonical_product_key
                and (
                  o.quantity is null
                  or (
                    o.quantity=c.quantity
                    and o.quantity_unit=c.quantity_unit
                  )
                )
            )
        )::int unique_incomplete_count
      from offered o
      group by o.thread_id
    ),
    recovery as (
      select
        t.*,
        ct.subject,
        ct.source_conversation_id,
        c.id conversation_id,
        case
          when exists (
            select 1 from public.commercial_offer_recoveries r
            where r.organization_id=p_organization_id and r.thread_id=t.thread_id
          ) then 'already_recovered'
          when t.has_existing_promotion then 'blocked'
          when t.complete_count=0 then 'blocked'
          when t.complete_currency_count<>1 then 'blocked'
          when t.has_pending_review then 'blocked'
          when c.id is null then 'blocked'
          when not t.all_incomplete_shadowed then 'blocked'
          when t.unique_incomplete_count>0 then 'blocked'
          else 'ready'
        end recovery_status,
        array_remove(array[
          case when t.complete_count=0 then 'no_complete_priced_offer_line' end,
          case when t.complete_currency_count<>1 then 'invalid_complete_currency_set' end,
          case when t.has_pending_review then 'pending_review' end,
          case when t.has_existing_promotion then 'existing_offer_promotion' end,
          case when c.id is null then 'missing_normalized_conversation' end,
          case when not t.all_incomplete_shadowed then 'incomplete_lines_not_all_shadow_duplicates' end,
          case when t.unique_incomplete_count>0 then 'unique_incomplete_product_evidence' end
        ]::text[],null) reasons
      from offer_threads t
      join public.commercial_threads ct
        on ct.organization_id=p_organization_id and ct.id=t.thread_id
      left join public.conversations c
        on c.organization_id=p_organization_id
       and c.external_thread_id=ct.source_conversation_id::text
    )
    select jsonb_build_object(
      'relationship_gap',jsonb_build_object(
        'rfq_total',(select count(distinct rfq_id) from rfq),
        'order_total',(select count(distinct order_id) from ord),
        'shared_conversation_pairs',(select count(*) from relationship_pairs),
        'shared_conversation_exact_product_pairs',(select count(*) from relationship_exact_pairs),
        'normalized_offer_total',(select count(*) from public.offers where organization_id=p_organization_id)
      ),
      'offer_gap',jsonb_build_object(
        'offered_observations',(select count(*) from offered),
        'offer_threads',(select count(*) from offer_threads),
        'complete_observations',(select count(*) from offered where complete_line),
        'threads_with_any_complete_line',(select count(*) from offer_threads where complete_count>0),
        'safe_subset_recovery_ready',(select count(*) from recovery where recovery_status='ready'),
        'already_recovered',(select count(*) from recovery where recovery_status='already_recovered'),
        'blocked_recovery_threads',(select count(*) from recovery where recovery_status='blocked')
      ),
      'candidates',coalesce((
        select jsonb_agg(jsonb_build_object(
          'thread_id',r.thread_id,
          'subject',r.subject,
          'conversation_id',r.conversation_id,
          'source_conversation_id',r.source_conversation_id,
          'recovery_status',r.recovery_status,
          'reasons',to_jsonb(r.reasons),
          'observation_count',r.observation_count,
          'complete_count',r.complete_count,
          'incomplete_count',r.incomplete_count,
          'unique_incomplete_count',r.unique_incomplete_count,
          'complete_lines',(
            select coalesce(jsonb_agg(jsonb_build_object(
              'observation_id',o.id,
              'canonical_product_key',o.canonical_product_key,
              'quantity',o.quantity,
              'quantity_unit',o.quantity_unit,
              'price_value',o.price_value,
              'price_unit',o.price_unit,
              'currency',o.currency,
              'source_text',o.source_text
            ) order by o.id),'[]'::jsonb)
            from offered o
            where o.thread_id=r.thread_id and o.complete_line
          ),
          'retained_evidence_lines',(
            select coalesce(jsonb_agg(jsonb_build_object(
              'observation_id',o.id,
              'canonical_product_key',o.canonical_product_key,
              'quantity',o.quantity,
              'quantity_unit',o.quantity_unit,
              'source_text',o.source_text
            ) order by o.id),'[]'::jsonb)
            from offered o
            where o.thread_id=r.thread_id and not o.complete_line
          )
        ) order by case r.recovery_status when 'ready' then 0 when 'blocked' then 1 else 2 end,r.thread_id)
        from (
          select * from recovery
          limit greatest(1,least(coalesce(p_limit,100),500))
        ) r
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'pa217_contract_unchanged',true,
        'recovery_type','shadow_duplicate_subset',
        'requires_at_least_one_complete_priced_line',true,
        'requires_every_incomplete_line_shadowed',true,
        'requires_no_unique_incomplete_products',true,
        'requires_single_currency',true,
        'requires_normalized_conversation',true,
        'company_inference',false,
        'rfq_inference',false,
        'bulk_auto_recovery',false
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_request_offer_source_reingest(p_organization_id uuid, p_thread_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.request_offer_source_reingest_impl(
    p_organization_id,p_thread_id,p_note
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_resolve_offer_recovery_residual_candidate(p_organization_id uuid, p_candidate_id bigint, p_target_observation_id bigint, p_selected_fields text[], p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  return private.resolve_offer_recovery_residual_candidate_impl(
    p_organization_id,
    p_candidate_id,
    p_target_observation_id,
    p_selected_fields,
    p_note
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.p1_structured_conversation_coverage_readiness(p_organization_id uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  perform public.rqg1_require_review_admin(p_organization_id);
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with threads as (
      select
        t.id commercial_thread_id,
        t.owner_id,
        t.source_conversation_id,
        t.subject,
        t.started_at,
        t.last_activity_at,
        t.email_count,
        c.id existing_conversation_id,
        case
          when c.id is not null then 'already_normalized'
          when t.owner_id is null then 'blocked'
          when t.source_conversation_id is null then 'blocked'
          else 'ready'
        end readiness_status,
        array_remove(array[
          case when t.owner_id is null then 'missing_owner' end,
          case when t.source_conversation_id is null then 'missing_source_conversation_id' end
        ]::text[],null) reasons
      from public.commercial_threads t
      left join public.conversations c
        on c.organization_id=t.organization_id
       and c.external_thread_id=t.source_conversation_id::text
      where t.organization_id=p_organization_id
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'commercial_threads',(select count(*) from threads),
        'conversation_ready',(select count(*) from threads where readiness_status='ready'),
        'conversation_already_normalized',(select count(*) from threads where readiness_status='already_normalized'),
        'conversation_blocked',(select count(*) from threads where readiness_status='blocked'),
        'message_ready',0,
        'message_identity_unavailable',(select count(*) from threads),
        'source_email_count',coalesce((select sum(email_count) from threads),0)
      ),
      'candidates',coalesce((
        select jsonb_agg(jsonb_build_object(
          'commercial_thread_id',commercial_thread_id,
          'source_conversation_id',source_conversation_id,
          'subject',subject,
          'started_at',started_at,
          'last_activity_at',last_activity_at,
          'email_count',email_count,
          'readiness_status',readiness_status,
          'reasons',to_jsonb(reasons)
        ) order by last_activity_at desc nulls last,commercial_thread_id)
        from (
          select *
          from threads
          where readiness_status='ready'
          limit greatest(1,least(coalesce(p_limit,100),500))
        ) q
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'conversation_identity','commercial_threads.source_conversation_id -> conversations.external_thread_id',
        'conversation_subject_copy',true,
        'conversation_timestamps_copy',true,
        'company_inference',false,
        'message_synthesis',false,
        'message_reason','no structured per-message identity in legacy source',
        'bulk_auto_expansion',false
      )
    )
  );
end;
$function$;

-- Confirm via atomic reviewed-by RPC, NOT UPDATE from authenticated role.
create or replace function public.rqg1_confirm_review_item(p_review_id bigint)
returns jsonb language plpgsql security definer set search_path=''
as $rqg$
declare
  v_actor uuid := (select auth.uid());
  v_row public.commercial_review_queue%rowtype;
begin
  if v_actor is null or p_review_id is null or p_review_id<=0 then
    raise exception using errcode='42501',message='company review administrator required';
  end if;
  select * into v_row from public.commercial_review_queue where id=p_review_id for update;
  if v_row.id is null then
    raise exception using errcode='42501',message='company review administrator required';
  end if;
  perform public.rqg1_require_review_admin(v_row.organization_id);
  if v_row.status<>'pending' then
    raise exception using errcode='55000',message='review item already decided';
  end if;
  update public.commercial_review_queue set
    status='confirmed',reviewed_at=now(),reviewed_by=v_actor
  where id=v_row.id and status='pending';
  if not found then
    raise exception using errcode='55000',message='review item already decided';
  end if;
  return jsonb_build_object('id',v_row.id,'status','confirmed');
end;
$rqg$;
revoke all on function public.rqg1_confirm_review_item(bigint) from public,anon,authenticated;
grant execute on function public.rqg1_confirm_review_item(bigint) to authenticated;

-- RLS: viewers/members cannot inspect queues or correction evidence directly.
drop policy if exists commercial_review_queue_organization_select on public.commercial_review_queue;
create policy commercial_review_queue_organization_select
on public.commercial_review_queue for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id=commercial_review_queue.organization_id
    and m.user_id=(select auth.uid())
    and m.status='active' and m.role='admin'
));
drop policy if exists commercial_review_queue_organization_update on public.commercial_review_queue;
-- Historical schemas may still have a browser UPDATE GRANT even though the
-- production schema did not. Remove both the privilege and its RLS policy.
-- Reviewed mutations are ONLY allowed through audited, admin-gated RPCs.
revoke update on table public.commercial_review_queue from public,anon,authenticated;
drop policy if exists commercial_correction_events_organization_select on public.commercial_correction_events;
create policy commercial_correction_events_organization_select
on public.commercial_correction_events for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id=commercial_correction_events.organization_id
    and m.user_id=(select auth.uid())
    and m.status='active' and m.role='admin'
));
