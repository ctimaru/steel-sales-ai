-- NC2.3: source-specific triggers capture only opaque references.
-- Business writes are never aborted by optional notification capture errors.
create or replace function private.nc23_capture_reference()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 kind text; source_id text; revision_no integer:=1; tenant uuid;
begin
 if tg_table_name='buyer_rfq_events' and tg_op='INSERT' then
   case new.event_type
     when 'quote_submitted' then kind:='workspace.rfq.response_received';
     when 'rfq_award_confirmed' then kind:='workspace.rfq.award_confirmed';
     else return new;
   end case;
   source_id:=new.id::text; tenant:=new.organization_id;
 elsif tg_table_name='worker_jobs' then
   if new.status<>'failed' or new.completed_at is null or new.organization_id is null then return new; end if;
   if tg_op='UPDATE' then
     if old.status='failed' and old.attempt_number=new.attempt_number
       and old.completed_at is not distinct from new.completed_at
       and old.organization_id is not distinct from new.organization_id then return new; end if;
   end if;
   kind:='workspace.import.failed'; source_id:=new.id::text;
   revision_no:=new.attempt_number; tenant:=new.organization_id;
 elsif tg_table_name='operational_alerts' then
   if new.status<>'open' or new.severity<>'critical' then return new; end if;
   if tg_op='UPDATE' then
     if old.status='open' and old.severity='critical'
       and old.occurrence_count=new.occurrence_count then return new; end if;
   end if;
   kind:='workspace.operations.regression_detected';
   source_id:=new.id::text;revision_no:=new.occurrence_count;tenant:=new.organization_id;
 elsif tg_table_name='marketplace_notifications' and tg_op='INSERT' then
   if new.notification_kind<>'opportunity_match' then return new; end if;
   kind:='workspace.marketplace.opportunity_matched';
   source_id:=new.id::text;tenant:=new.recipient_organization_id;
 elsif tg_table_name='platform_registration_events' and tg_op='INSERT' then
   case new.event_type
     when 'application_submitted' then kind:='platform.registration.submitted';
     when 'information_provided' then kind:='platform.registration.information_provided';
     else return new;
   end case;
   source_id:=new.id::text;
 elsif tg_table_name='network_company_claims' then
   if new.status<>'requested' then return new; end if;
   if tg_op='UPDATE' then
     if old.status='requested' then return new; end if;
   end if;
   kind:='platform.claim.requested';source_id:=new.id::text;
 elsif tg_table_name='observability_events' and tg_op='INSERT' then
   if new.event_type<>'system' or new.status<>'error'
      or new.environment<>'production'
      or new.organization_id is not null or new.owner_id is not null
      or new.operation not in ('security_incident','infrastructure_critical')
   then return new; end if;
   kind:='platform.infrastructure.critical_incident';source_id:=new.id::text;
 else
   return new;
 end if;
 insert into public.notification_source_bridge_queue(
   event_type,source_event_id,source_revision,organization_id
 ) values(kind,source_id,revision_no,tenant)
 on conflict on constraint nc23_queue_dedupe do nothing;
 return new;
exception when others then
 -- Do not disclose source identifiers or business data in logs.
 raise log 'NC23 capture fault table=% state=%',tg_table_name,sqlstate;
 return new;
end;
$fn$;
revoke all on function private.nc23_capture_reference() from public,anon,authenticated;

create trigger nc23_rfq_capture after insert on public.buyer_rfq_events
 for each row execute function private.nc23_capture_reference();
create trigger nc23_import_capture after insert or update of status,completed_at,attempt_number,organization_id
 on public.worker_jobs for each row execute function private.nc23_capture_reference();
create trigger nc23_alert_capture after insert or update of status,severity,occurrence_count
 on public.operational_alerts for each row execute function private.nc23_capture_reference();
create trigger nc23_marketplace_capture after insert on public.marketplace_notifications
 for each row execute function private.nc23_capture_reference();
create trigger nc23_registration_capture after insert on public.platform_registration_events
 for each row execute function private.nc23_capture_reference();
create trigger nc23_claim_capture after insert or update of status on public.network_company_claims
 for each row execute function private.nc23_capture_reference();
create trigger nc23_infrastructure_capture after insert on public.observability_events
 for each row execute function private.nc23_capture_reference();
