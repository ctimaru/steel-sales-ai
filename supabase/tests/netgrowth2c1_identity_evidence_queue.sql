-- NET-GROWTH2C.1 — no publication, no identity proof, no tenant leakage.
begin;
do $contract$
declare v_lead uuid; v_event uuid; v_total integer; v_unpublished integer;
begin
 if to_regprocedure('public.netgrowth2c1_identity_recovery_page(text,integer,integer)') is null
   then raise exception 'Identity recovery RPC not installed'; end if;
 if has_function_privilege('anon','public.netgrowth2c1_identity_recovery_page(text,integer,integer)','EXECUTE')
   then raise exception 'Anon identity queue access'; end if;
 if not has_function_privilege('authenticated','public.netgrowth2c1_identity_recovery_page(text,integer,integer)','EXECUTE')
   then raise exception 'Platform RPC invoke grant missing'; end if;
 if position('private.require_platform_permission' in
   pg_get_functiondef('public.netgrowth2c1_identity_recovery_page(text,integer,integer)'::regprocedure))=0
   then raise exception 'Platform permission guard missing'; end if;
 if has_table_privilege('anon','private.netgrowth2c1_identity_evidence','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','private.netgrowth2c1_identity_evidence','SELECT,INSERT,UPDATE,DELETE')
   then raise exception 'Browser access to private evidence ledger'; end if;
 if not (select relrowsecurity from pg_class where oid='private.netgrowth2c1_identity_evidence'::regclass)
   then raise exception 'Identity evidence RLS missing'; end if;
 select count(*) into v_total from private.net_growth2b_identity_recovery;
 select count(*) into v_unpublished
   from public.network_core_target_leads l
   where not exists(select 1 from private.net_pipeline1b2p_publication_ledger p where p.lead_id=l.id);
 if v_total<>v_unpublished then raise exception 'Recovery count not based on unpromoted leads'; end if;
 if exists(select 1 from private.net_growth2b_identity_recovery r
   join private.net_pipeline1b2p_publication_ledger p on p.lead_id=r.lead_id)
   then raise exception 'Published leads leaked into recovery'; end if;

 select lead_id into v_lead from private.net_growth2b_identity_recovery limit 1;
 if v_lead is not null then
   begin
     insert into private.netgrowth2c1_identity_evidence
       (lead_id,event_state,observed_legal_name,source_url,evidence_note)
     values (v_lead,'source_observed','Sample Co S.p.A.','https://example.com','unreviewed source cannot be accepted');
     raise exception 'Source observation without reviewer incorrectly accepted';
   exception when check_violation then null; end;
   insert into private.netgrowth2c1_identity_evidence(lead_id,event_state,evidence_note)
     values(v_lead,'review_started','test only') returning id into v_event;
   begin
     update private.netgrowth2c1_identity_evidence set evidence_note='changed' where id=v_event;
     raise exception 'Append-only evidence update unexpectedly accepted';
   exception when insufficient_privilege then null; end;
   begin
     delete from private.netgrowth2c1_identity_evidence where id=v_event;
     raise exception 'Append-only evidence deletion unexpectedly accepted';
   exception when insufficient_privilege then null; end;
 end if;
end
$contract$;
rollback;
