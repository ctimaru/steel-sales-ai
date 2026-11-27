-- COMPANY-UX2.D.2: additive, owner-only catalogue status details.
-- Keep the existing authority, organization selection, 20-item bound and all
-- prepare/finalize/withdraw behavior unchanged. No new grants or publications.
-- Rights are read from the exact document grant, never from an analysis state.
do $patch$
declare
  v_definition text := pg_get_functiondef(
    'private.netproducers1_b3c2_catalog_submission(text,jsonb)'::regprocedure
  );
  v_ineligible_before text := $before$
      return jsonb_build_object('contract','netproducers-b3c2-v1',
        'eligible',false,'items','[]'::jsonb);$before$;
  v_ineligible_after text := $after$
      return jsonb_build_object('contract','netproducers-b3c2-v1',
        'details_contract','company-ux2d2-catalog-status-v1','limit',20,
        'eligible',false,'items','[]'::jsonb);$after$;
  v_status_before text := $before$
  if p_operation='status' then
    return jsonb_build_object(
      'contract','netproducers-b3c2-v1','eligible',true,
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'catalog_id',s.catalog_id,'name',s.original_name,'edition',s.edition,
          'format',s.document_format,'state',s.state,
          'created_at',s.created_at,'uploaded_at',s.uploaded_at
        ) order by s.created_at desc)
        from (select * from private.network_producer_catalog_submissions
          where company_id=v_company and organization_id=v_org
          order by created_at desc limit 20) s
      ),'[]'::jsonb)
    );
  end if;$before$;
  v_status_after text := $after$
  if p_operation='status' then
    return jsonb_build_object(
      'contract','netproducers-b3c2-v1','eligible',true,
      'details_contract','company-ux2d2-catalog-status-v1','limit',20,
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'catalog_id',s.catalog_id,'name',s.original_name,'edition',s.edition,
          'format',s.document_format,'state',s.state,
          'created_at',s.created_at,'uploaded_at',s.uploaded_at,
          'source_url',s.source_url,'rights_declared_at',s.rights_declared_at,
          'source_checked_at',s.source_checked_at,'withdrawn_at',s.withdrawn_at,
          'rights_status',case
            when g.catalog_id is null then 'not_verified'
            when g.status='revoked' or g.revoked_at is not null then 'revoked'
            when g.expires_at<=v_now then 'expired'
            when g.status='approved' and g.verified_at<=v_now
              and g.rights @> array['extract','store_derived','use_in_producer_search']::text[]
              and s.state<>'withdrawn'
              and regexp_replace(lower(split_part(g.source_url,'/',3)),'^www\.', '')=
                  regexp_replace(lower(c.website_domain),'^www\.', '')
              then 'active'
            else 'not_verified'
          end,
          'rights_verified_at',g.verified_at,
          'rights_expires_at',g.expires_at,
          'rights_revoked_at',g.revoked_at
        ) order by s.created_at desc)
        from (select * from private.network_producer_catalog_submissions
          where company_id=v_company and organization_id=v_org
          order by created_at desc limit 20) s
        join public.network_companies c on c.id=s.company_id
        left join private.network_producer_catalog_grants g
          on g.catalog_id=s.catalog_id and g.company_id=s.company_id
          and g.document_sha256=s.document_sha256 and g.source_url=s.source_url
          and g.edition=s.edition and g.document_format=s.document_format
      ),'[]'::jsonb)
    );
  end if;$after$;
begin
  if position(v_ineligible_after in v_definition)>0
     and position(v_status_after in v_definition)>0 then
    return;
  end if;
  if (length(v_definition)-length(replace(v_definition,v_ineligible_before,'')))
       / length(v_ineligible_before)<>1
     or (length(v_definition)-length(replace(v_definition,v_status_before,'')))
       / length(v_status_before)<>1 then
    raise exception 'COMPANY-UX2.D.2 status patch did not match the reviewed reader';
  end if;
  v_definition:=replace(v_definition,v_ineligible_before,v_ineligible_after);
  v_definition:=replace(v_definition,v_status_before,v_status_after);
  execute v_definition;
end;
$patch$;
