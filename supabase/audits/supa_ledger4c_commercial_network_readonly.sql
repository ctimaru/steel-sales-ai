-- SUPA-LEDGER4C: read-only production catalog assertions, not a migration.
-- Checks source controls and current PostgreSQL metadata without DML or impersonation.
WITH fn AS (
  SELECT n.nspname AS schema_name, p.proname AS function_name, p.oid, pg_get_functiondef(p.oid) AS body
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private')
), checks AS (
SELECT 'P2' area,'public_recovery_rpcs_require_auth' check_name,
  (SELECT count(*)=3 FROM fn
     WHERE schema_name='public' AND function_name IN
       ('p2_recover_legacy_message_identity','p2_finalize_legacy_conversation_identity','p2_rfq_attribution_recovery_status')
       AND NOT has_function_privilege('anon',oid,'EXECUTE')) passes
UNION ALL SELECT 'P2','legacy_recovery_impls_check_membership',
  (SELECT count(*)=2 FROM fn
     WHERE schema_name='private' AND function_name IN
       ('p2_recover_legacy_message_identity_impl','p2_finalize_legacy_conversation_identity_impl')
       AND body ILIKE '%auth.uid%'
       AND body ILIKE '%is_organization_member%')
UNION ALL SELECT 'P2','private_schema_not_accessible_to_anon',
  NOT has_schema_privilege('anon','private','USAGE')
UNION ALL SELECT 'P2','identity_recoveries_rls_enabled',
  (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='commercial_message_identity_recoveries')
UNION ALL SELECT 'P2','identity_recovery_select_tenant_filtered',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='commercial_message_identity_recoveries' AND cmd='SELECT'
    AND qual ILIKE '%is_organization_member(organization_id%')
UNION ALL SELECT 'P2','unique_organization_source_hash',
  to_regclass('public.commercial_message_identity_recoveries_source_uq') IS NOT NULL
UNION ALL SELECT 'P2','recovery_status_requires_organization_access',
  EXISTS (SELECT 1 FROM fn WHERE schema_name='public'
    AND function_name='p2_rfq_attribution_recovery_status'
    AND body ILIKE '%is_organization_member(p_organization_id%')
UNION ALL SELECT 'P4.5','inquiry_eligibility_checks_sender_and_recipient_claim',
  EXISTS (SELECT 1 FROM fn WHERE schema_name='private'
    AND function_name='p4_inquiry_eligibility_impl'
    AND body ILIKE '%organization_memberships%'
    AND body ILIKE '%network_company_claims%'
    AND body ILIKE '%publication_status%'
    AND body ILIKE '%self_inquiry%'
    AND body ILIKE '%network_inquiry_blocks%')
UNION ALL SELECT 'P4.5','inquiry_list_scoped_to_organization_membership',
  EXISTS (SELECT 1 FROM fn WHERE schema_name='private'
    AND function_name='p4_list_inquiries_impl'
    AND body ILIKE '%organization_memberships%'
    AND body ILIKE '%sender_organization_id=p_organization_id%'
    AND body ILIKE '%recipient_organization_id=p_organization_id%')
UNION ALL SELECT 'P4.5','inquiry_public_api_entitlement_gate',
  EXISTS (SELECT 1 FROM fn WHERE schema_name='public'
    AND function_name='p4_inquiry_eligibility'
    AND body ILIKE '%pa1_3_require_network_access%')
UNION ALL SELECT 'P4.5','inquiry_tables_have_rls_and_no_browser_select',
  (SELECT count(*)=3 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN
      ('network_inquiries','network_inquiry_preferences','network_inquiry_blocks')
      AND c.relrowsecurity
      AND NOT has_table_privilege('anon',c.oid,'SELECT')
      AND NOT has_table_privilege('authenticated',c.oid,'SELECT'))
UNION ALL SELECT 'P4.7','public_follow_feed_endpoints_entitlement_gated',
  (SELECT count(*)=7 FROM fn WHERE schema_name='public'
    AND function_name IN
      ('p4_follow_company','p4_unfollow_company','p4_follow_state','p4_list_followed_companies','p4_list_activity_feed','p4_mark_activity_read','p4_mark_all_activity_read')
    AND body ILIKE '%pa1_3_require_network_access%'
    AND NOT has_function_privilege('anon',oid,'EXECUTE'))
UNION ALL SELECT 'P4.7','followers_have_active_membership_gate',
  EXISTS (SELECT 1 FROM fn WHERE schema_name='private'
    AND function_name='p4_7_require_active_membership'
    AND body ILIKE '%auth.uid%'
    AND body ILIKE '%organization_memberships%'
    AND body ILIKE '%status=%active%')
UNION ALL SELECT 'P4.7','feed_restricted_to_followed_published_and_join_time',
  EXISTS (SELECT 1 FROM fn WHERE schema_name='private'
    AND function_name='p4_7_activity_feed_impl'
    AND body ILIKE '%network_company_follows%'
    AND body ILIKE '%publication_status=%published%'
    AND body ILIKE '%e.occurred_at>=f.created_at%'
    AND body ILIKE '%f.user_id=v_user%')
UNION ALL SELECT 'P4.7','activity_read_marker_rejects_unfollowed_events',
  EXISTS (SELECT 1 FROM fn WHERE schema_name='private'
    AND function_name='p4_7_mark_activity_read_impl'
    AND body ILIKE '%network_company_follows%'
    AND body ILIKE '%activity event is not visible to current follower%')
UNION ALL SELECT 'P4.7','follow_and_read_unique_indexes',
  to_regclass('public.network_company_follows_unique') IS NOT NULL
  AND to_regclass('public.network_activity_reads_pkey') IS NOT NULL
  AND to_regclass('public.network_activity_events_event_key_key') IS NOT NULL
UNION ALL SELECT 'P4.7','activity_append_uses_uuid_event_keys_and_clock_time',
  EXISTS (SELECT 1 FROM fn WHERE schema_name='private'
    AND function_name='p4_7_append_activity'
    AND body ILIKE '%gen_random_uuid()::text%'
    AND body ILIKE '%clock_timestamp()%'
    AND body NOT ILIKE '%statement_timestamp()%')
UNION ALL SELECT 'P4.7','all_four_activity_time_defaults_updated',
  (SELECT count(*)=4 FROM pg_attrdef d
    JOIN pg_class c ON c.oid=d.adrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.adnum
    WHERE n.nspname='public'
      AND ((c.relname='network_company_follows' AND a.attname='created_at')
      OR (c.relname='network_activity_events' AND a.attname IN ('occurred_at','created_at'))
      OR (c.relname='network_activity_reads' AND a.attname='read_at'))
      AND pg_get_expr(d.adbin,d.adrelid) ILIKE '%clock_timestamp()%')
UNION ALL SELECT 'P4.7','activity_event_append_only_trigger',
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='network_activity_events'
      AND t.tgname='network_activity_events_append_only'
      AND NOT t.tgisinternal
      AND (t.tgtype & 8) <> 0 AND (t.tgtype & 16) <> 0)
UNION ALL SELECT 'P4.7','network_follow_activity_tables_private_to_browser',
  (SELECT count(*)=3 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN ('network_company_follows','network_activity_events','network_activity_reads')
      AND c.relrowsecurity
      AND NOT has_table_privilege('anon',c.oid,'SELECT')
      AND NOT has_table_privilege('authenticated',c.oid,'SELECT'))
)
SELECT area,check_name,COALESCE(passes,false) passes FROM checks ORDER BY area,check_name;
