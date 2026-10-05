-- PP1 — Padana Publication Readiness
-- Generic publication-readiness audit + public disclosure of non-automated rules.

begin;

create or replace function public.pl1_publication_readiness(
  p_version_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_version public.price_list_versions%rowtype;
  v_source_id uuid;
  v_checksum text;
  v_checksum_algorithm text;
  v_governance_decision text;
  v_structured_visibility text;
  v_item_count integer := 0;
  v_price_m_ready integer := 0;
  v_price_t_ready integer := 0;
  v_review_required_rules integer := 0;
  v_import_error_items integer := 0;
  v_import_review_items integer := 0;
  v_unresolved_standard integer := 0;
  v_special_shape_no_weight integer := 0;
  v_delivery_conflicts integer := 0;
  v_grade_conflicts integer := 0;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_ready boolean := false;
begin
  if (select auth.uid()) is null
     or not (
       public.has_platform_permission('knowledge.read_drafts')
       or public.has_platform_permission('knowledge.review')
       or public.has_platform_permission('knowledge.publish')
     ) then
    raise exception 'Platform permission required: knowledge.read_drafts'
      using errcode='42501';
  end if;

  select *
    into v_version
  from public.price_list_versions
  where id=p_version_id;

  if v_version.id is null then
    return jsonb_build_object(
      'version_id',p_version_id,
      'ready_to_publish',false,
      'blockers',jsonb_build_array(
        jsonb_build_object('code','version_not_found','message','Price-list version not found.')
      ),
      'warnings','[]'::jsonb
    );
  end if;

  select d.source_id,d.content_checksum,d.checksum_algorithm
    into v_source_id,v_checksum,v_checksum_algorithm
  from public.knowledge_documents d
  where d.id=v_version.primary_source_document_id;

  select g.decision,g.structured_data_visibility
    into v_governance_decision,v_structured_visibility
  from public.price_list_source_governance_events g
  where g.knowledge_source_id=v_source_id
    and (g.knowledge_document_id=v_version.primary_source_document_id or g.knowledge_document_id is null)
  order by g.decided_at desc,g.created_at desc,g.id desc
  limit 1;

  select
    count(*)::integer,
    count(*) filter(where r.price_per_m_ready)::integer,
    count(*) filter(where r.price_per_t_ready)::integer,
    count(*) filter(where r.price_per_t_status='unresolved_standard')::integer,
    count(*) filter(where r.price_per_t_status='unsupported_special_shape')::integer
  into
    v_item_count,
    v_price_m_ready,
    v_price_t_ready,
    v_unresolved_standard,
    v_special_shape_no_weight
  from public.price_list_item_pricing_readiness r
  where r.price_list_version_id=p_version_id;

  select count(*)::integer
    into v_review_required_rules
  from public.price_rules r
  where r.price_list_version_id=p_version_id
    and r.status='review_required';

  select
    coalesce(max(ir.error_item_count),0)::integer,
    coalesce(max(ir.review_item_count),0)::integer
  into v_import_error_items,v_import_review_items
  from public.price_list_import_runs ir
  where ir.price_list_version_id=p_version_id
    and ir.status='promoted';

  select
    count(*) filter(where a.code='DELIVERY_TERM_CONFLICT')::integer,
    count(*) filter(where a.code='SOURCE_GRADE_LABEL_CONFLICT')::integer
  into v_delivery_conflicts,v_grade_conflicts
  from public.price_list_import_anomalies a
  join public.price_list_import_runs ir on ir.id=a.import_run_id
  where ir.price_list_version_id=p_version_id
    and ir.status='promoted';

  if coalesce(v_checksum,'')=''
     or lower(coalesce(v_checksum_algorithm,''))<>'sha256' then
    v_blockers := v_blockers || jsonb_build_array(
      jsonb_build_object(
        'code','immutable_source_missing',
        'message','Publication requires an immutable SHA-256 source document.'
      )
    );
  end if;

  if v_governance_decision is distinct from 'approved_public'
     or v_structured_visibility is distinct from 'public' then
    v_blockers := v_blockers || jsonb_build_array(
      jsonb_build_object(
        'code','publication_rights_not_approved',
        'message','Structured public republication rights are not approved.',
        'decision',v_governance_decision,
        'structured_visibility',v_structured_visibility
      )
    );
  end if;

  if v_delivery_conflicts>0 then
    v_blockers := v_blockers || jsonb_build_array(
      jsonb_build_object(
        'code','delivery_term_conflict',
        'message','Source delivery term is inconsistent and remains unresolved.',
        'count',v_delivery_conflicts
      )
    );
  end if;

  if v_item_count=0 or v_price_m_ready<>v_item_count then
    v_blockers := v_blockers || jsonb_build_array(
      jsonb_build_object(
        'code','commercial_price_incomplete',
        'message','Every active commercial row must have governed Base + fixed Extra €/m.',
        'item_count',v_item_count,
        'price_per_m_ready',v_price_m_ready
      )
    );
  end if;

  if v_import_error_items>0 then
    v_blockers := v_blockers || jsonb_build_array(
      jsonb_build_object(
        'code','import_errors_present',
        'message','Promoted import still reports error rows.',
        'count',v_import_error_items
      )
    );
  end if;

  if v_version.status<>'verified' then
    v_blockers := v_blockers || jsonb_build_array(
      jsonb_build_object(
        'code','version_not_verified',
        'message','Version must pass review and enter verified state before publication.',
        'status',v_version.status
      )
    );
  end if;

  if v_version.publication_scope<>'public' then
    v_blockers := v_blockers || jsonb_build_array(
      jsonb_build_object(
        'code','publication_scope_not_public',
        'message','Version publication_scope must be public before final publication.',
        'publication_scope',v_version.publication_scope
      )
    );
  end if;

  if v_price_t_ready<v_item_count then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code','partial_eur_t_coverage',
        'message','Some articles remain €/m-only; the UI must keep €/t unavailable rather than infer weight.',
        'ready',v_price_t_ready,
        'total',v_item_count,
        'missing',v_item_count-v_price_t_ready
      )
    );
  end if;

  if v_import_review_items>0 then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code','bounded_technical_review_rows',
        'message','Commercial rows are preserved but some technical identity fields remain unresolved.',
        'count',v_import_review_items
      )
    );
  end if;

  if v_unresolved_standard>0 then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code','unresolved_standard',
        'message','Rows with unresolved/ambiguous standard remain excluded from governed €/t conversion.',
        'count',v_unresolved_standard
      )
    );
  end if;

  if v_special_shape_no_weight>0 then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code','special_shape_without_weight',
        'message','Special profiles remain €/m-only until a governed weight source is available.',
        'count',v_special_shape_no_weight
      )
    );
  end if;

  if v_review_required_rules>0 then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code','non_automated_source_rules',
        'message','Source rules marked review_required must be disclosed and must not be applied automatically.',
        'count',v_review_required_rules
      )
    );
  end if;

  if v_grade_conflicts>0 then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code','source_grade_label_conflict',
        'message','Conflicting source grade labels are preserved raw and not normalized.',
        'count',v_grade_conflicts
      )
    );
  end if;

  v_ready := jsonb_array_length(v_blockers)=0;

  return jsonb_build_object(
    'version_id',v_version.id,
    'manufacturer_version_code',v_version.manufacturer_version_code,
    'status',v_version.status,
    'publication_scope',v_version.publication_scope,
    'ready_to_publish',v_ready,
    'metrics',jsonb_build_object(
      'item_count',v_item_count,
      'price_per_m_ready',v_price_m_ready,
      'price_per_t_ready',v_price_t_ready,
      'price_per_t_missing',greatest(v_item_count-v_price_t_ready,0),
      'price_per_t_coverage_pct',
        case when v_item_count=0 then 0
             else round((v_price_t_ready::numeric/v_item_count::numeric)*100,1)
        end,
      'import_error_items',v_import_error_items,
      'import_review_items',v_import_review_items,
      'review_required_rules',v_review_required_rules
    ),
    'source_governance',jsonb_build_object(
      'decision',v_governance_decision,
      'structured_visibility',v_structured_visibility,
      'sha256_ready',coalesce(v_checksum,'')<>'' and lower(coalesce(v_checksum_algorithm,''))='sha256'
    ),
    'blockers',v_blockers,
    'warnings',v_warnings
  );
end;
$$;

revoke all on function public.pl1_publication_readiness(uuid)
from public,anon;

grant execute on function public.pl1_publication_readiness(uuid)
to authenticated;

comment on function public.pl1_publication_readiness(uuid) is
  'PP1 internal fail-closed readiness audit for price-list public publication. Requires Knowledge draft/review/publish capability.';

create or replace function public.pl1_price_list_public_notices(
  p_version_id uuid,
  p_include_internal boolean default false
)
returns table(
  notice_code text,
  title text,
  body text,
  severity text,
  calculation_order integer
)
language sql
stable
security invoker
set search_path=''
as $$
  with allowed as (
    select v.id
    from public.price_list_versions v
    where v.id=p_version_id
      and (
        public.pl1_version_visible_to(v.id,'public')
        or (
          p_include_internal
          and public.pl1_can_preview_internal()
          and v.status in ('draft','review','verified')
        )
      )
  )
  select
    case
      when r.rule_type='logistics_discount' then 'logistics_discount_manual'
      when r.rule_type='other'
        and r.rule_payload->>'kind'='melted_and_poured_certificate_extra'
        then 'certificate_extra_manual'
      else 'source_rule_manual'
    end as notice_code,
    case
      when r.rule_type='logistics_discount'
        then 'Sconto logistico non automatizzato'
      when r.rule_type='other'
        and r.rule_payload->>'kind'='melted_and_poured_certificate_extra'
        then 'Extra certificazione su accordo'
      else 'Condizione della fonte non automatizzata'
    end as title,
    coalesce(r.source_text,'Condizione presente nella fonte originale.')
      || ' Questa condizione non viene applicata automaticamente dal calcolo Smart Steel Sales.' as body,
    'warning'::text as severity,
    r.calculation_order
  from allowed a
  join public.price_rules r on r.price_list_version_id=a.id
  where r.status='review_required'
  order by r.calculation_order,r.id;
$$;

revoke all on function public.pl1_price_list_public_notices(uuid,boolean)
from public;

grant execute on function public.pl1_price_list_public_notices(uuid,boolean)
to anon,authenticated;

comment on function public.pl1_price_list_public_notices(uuid,boolean) is
  'PP1 public-safe disclosure of source conditions intentionally excluded from automatic price calculation.';

commit;
