-- SP7.1 — Owner-only read model for pilot rights readiness.
-- This migration grants no publication/ingestion privileges and changes no source.
create function public.sp71_pilot_source_readiness()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  s steel_pulse_private.sources%rowtype;
  v_enabled boolean := false;
  v_items bigint := 0;
  v_cards bigint := 0;
  v_valid_rights boolean := false;
begin
  if (select auth.uid()) is null or
     (select auth.role()) is distinct from 'authenticated' or
     not private.is_platform_superadmin()
  then
    raise exception 'SP7.1 Platform Owner required' using errcode='42501';
  end if;

  select * into s from steel_pulse_private.sources where id='ec_dg_trade';
  select coalesce(p.enabled,false) into v_enabled
    from steel_pulse_private.publication_settings p where p.singleton=true;
  select count(*) into v_items from steel_pulse_private.items i
    where i.source_id='ec_dg_trade';
  select count(*) into v_cards from steel_pulse_private.editorial_cards c
    join steel_pulse_private.items i on i.id=c.item_id
    where i.source_id='ec_dg_trade' and c.status='published';

  v_valid_rights := coalesce(s.status='approved' and
    s.license_basis <> 'unverified' and
    'discover_metadata'=any(s.approved_operations) and
    s.reviewer_user_id is not null and
    s.legal_reviewer_user_id is not null and
    s.reviewer_user_id<>s.legal_reviewer_user_id and
    s.policy_url is not null and s.approval_evidence_url is not null and
    s.approval_reason is not null and
    s.approved_at is not null and s.approval_expires_at>now() and
    s.terms_reviewed_at >= now()-interval '90 days',false);

  return jsonb_build_object(
    'source_found',s.id is not null,
    'source_status',coalesce(s.status,'missing'),
    'license_basis',coalesce(s.license_basis,'unverified'),
    'rights_valid',v_valid_rights,
    'source_review_assigned',s.reviewer_user_id is not null,
    'independent_legal_reviewer_assigned',
      s.legal_reviewer_user_id is not null and
      s.reviewer_user_id is distinct from s.legal_reviewer_user_id,
    'policy_registered',s.policy_url is not null,
    'approval_evidence_registered',s.approval_evidence_url is not null,
    'terms_reviewed',coalesce(s.terms_reviewed_at>=now()-interval '90 days',false),
    'rss_registered',s.feed_url is not null,
    'public_enabled',v_enabled,
    'items_staged',v_items,
    'cards_published',v_cards,
    'ready_to_ingest',v_valid_rights and s.feed_url is not null
  );
end;
$$;
revoke all on function public.sp71_pilot_source_readiness()
  from public,anon,authenticated;
grant execute on function public.sp71_pilot_source_readiness()
  to authenticated;

comment on function public.sp71_pilot_source_readiness() is
'Owner-only production readiness status for DG Trade SP7.1; no source modification, no identities or unpublished content in response.';
