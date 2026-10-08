-- SP3 Steel Pulse: editorial dual-review and governed publication.
-- IMPORTANT: records remain PRIVATE. SP4 is the first separate public read-surface review.
create table steel_pulse_private.editorial_cards (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references steel_pulse_private.items(id) on delete restrict,
  revision integer not null default 1 check (revision between 1 and 1000000),
  status text not null default 'draft'
    check(status in ('draft','in_review','editor_approved','legal_approved','published','withdrawn')),
  headline text not null check(char_length(headline) between 25 and 160 and headline !~ '[<>]'),
  summary text not null check(char_length(summary) between 60 and 650 and summary !~ '[<>]'),
  relevance text not null check(char_length(relevance) between 40 and 380 and relevance !~ '[<>]'),
  topic text not null check(topic in ('market','trade','regulation','raw_materials','technology','companies')),
  language_code text not null default 'it' check(language_code in ('it','en')),
  authored_by uuid not null references auth.users(id) on delete restrict,
  editor_reviewed_by uuid references auth.users(id) on delete restrict,
  editor_reviewed_at timestamptz,
  fact_evidence_url text,
  legal_reviewed_by uuid references auth.users(id) on delete restrict,
  legal_reviewed_at timestamptz,
  item_rights_evidence_url text,
  legal_attestation text check(legal_attestation is null or char_length(legal_attestation) between 30 and 2000),
  published_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz,
  published_until timestamptz,
  withdrawn_by uuid references auth.users(id) on delete restrict,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status <> 'published') or
    (published_by is not null and published_at is not null and published_until > published_at)
  )
);
create index sp3_editorial_state_updated_idx
  on steel_pulse_private.editorial_cards(status, updated_at desc);

create table steel_pulse_private.editorial_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references steel_pulse_private.editorial_cards(id) on delete restrict,
  revision integer not null,
  event_type text not null check(event_type in
    ('draft_saved','submitted','editor_approved','editor_rejected',
     'legal_approved','legal_rejected','published','withdrawn')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check(char_length(reason) between 8 and 2000),
  occurred_at timestamptz not null default now()
);
create index sp3_editorial_event_history_idx
  on steel_pulse_private.editorial_events(card_id,occurred_at desc,id desc);
create trigger sp3_editorial_events_immutable
  before update or delete on steel_pulse_private.editorial_events
  for each row execute function steel_pulse_private.sp2_deny_ledger_changes();

alter table steel_pulse_private.editorial_cards enable row level security;
alter table steel_pulse_private.editorial_events enable row level security;
revoke all on steel_pulse_private.editorial_cards,steel_pulse_private.editorial_events
  from public,anon,authenticated;
grant select on steel_pulse_private.editorial_cards,steel_pulse_private.editorial_events to service_role;

-- Recheck source rights on EVERY publication attempt and on every future feed query.
-- A revocation/expiry immediately removes a card from any eligible read.
create function steel_pulse_private.sp3_source_is_publishable(p_item_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from steel_pulse_private.items i
    join steel_pulse_private.sources s on s.id=i.source_id
    where i.id=p_item_id
      and i.editorial_state='staged'
      and s.status='approved'
      and s.license_basis <> 'unverified'
      and 'publish_news_card'=any(s.approved_operations)
      and s.approval_evidence_url is not null
      and s.approval_reason is not null
      and s.policy_url is not null
      and s.reviewer_user_id is not null
      and s.legal_reviewer_user_id is not null
      and s.reviewer_user_id <> s.legal_reviewer_user_id
      and s.approved_at <= now() and s.approval_expires_at > now()
      and s.terms_reviewed_at between now()-interval '90 days' and now()
      and i.rights_evidence_url=s.approval_evidence_url
      and i.canonical_url ~ '^https://'
      and lower(substring(i.canonical_url from '^https://([a-zA-Z0-9.-]+)(?:/|$)'))
          = any(s.allowed_hosts)
  );
$$;
revoke all on function steel_pulse_private.sp3_source_is_publishable(uuid)
  from public,anon,authenticated;

-- Plain text only; no original publisher HTML/images, links or tracking strings in copy.
create function steel_pulse_private.sp3_validate_copy(p_headline text,p_summary text,p_relevance text)
returns void language plpgsql set search_path=''
as $$
begin
  if char_length(btrim(coalesce(p_headline,''))) not between 25 and 160
    or char_length(btrim(coalesce(p_summary,''))) not between 60 and 650
    or char_length(btrim(coalesce(p_relevance,''))) not between 40 and 380
    or concat(coalesce(p_headline,''),coalesce(p_summary,''),coalesce(p_relevance,'')) ~* '(<|>|https?://|www\.)'
  then
    raise exception 'SP3 requires plain original editorial copy of approved length'
      using errcode='22023';
  end if;
end;
$$;
revoke all on function steel_pulse_private.sp3_validate_copy(text,text,text)
  from public,anon,authenticated;

create function public.sp3_save_draft(
  p_item_id uuid,p_expected_revision integer,p_headline text,
  p_summary text,p_relevance text,p_topic text,p_language text default 'it'
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());
        v_card steel_pulse_private.editorial_cards%rowtype;
        v_revision integer;
begin
  if v_actor is null or not public.has_platform_permission('knowledge.edit') then
    raise exception 'SP3 edit permission required' using errcode='42501';
  end if;
  perform steel_pulse_private.sp3_validate_copy(p_headline,p_summary,p_relevance);
  if p_topic is null or p_topic not in
    ('market','trade','regulation','raw_materials','technology','companies')
    or p_language is null or p_language not in ('it','en') then
    raise exception 'Invalid Steel Pulse topic or language' using errcode='22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Expected revision required' using errcode='22023';
  end if;
  perform 1 from steel_pulse_private.items i
   join steel_pulse_private.sources s on s.id=i.source_id
   where i.id=p_item_id and i.editorial_state='staged' and s.status='approved';
  if not found then
    raise exception 'SP3 item not in approved staging' using errcode='42501';
  end if;
  select * into v_card from steel_pulse_private.editorial_cards
    where item_id=p_item_id for update;
  if found then
    if v_card.status <> 'draft' or v_card.revision <> p_expected_revision
      or v_card.authored_by <> v_actor then
      raise exception 'SP3 draft state, author or revision conflict' using errcode='42501';
    end if;
    update steel_pulse_private.editorial_cards set
      headline=btrim(p_headline),summary=btrim(p_summary),relevance=btrim(p_relevance),
      topic=p_topic,language_code=p_language,revision=revision+1,updated_at=now(),
      editor_reviewed_by=null,editor_reviewed_at=null,fact_evidence_url=null,
      legal_reviewed_by=null,legal_reviewed_at=null,item_rights_evidence_url=null,
      legal_attestation=null
    where id=v_card.id returning revision into v_revision;
  else
    if p_expected_revision<>0 then
      raise exception 'SP3 expected a new draft' using errcode='22023';
    end if;
    insert into steel_pulse_private.editorial_cards(
      item_id,headline,summary,relevance,topic,language_code,authored_by
    ) values (
      p_item_id,btrim(p_headline),btrim(p_summary),btrim(p_relevance),
      p_topic,p_language,v_actor
    ) returning id,revision into v_card.id,v_revision;
  end if;
  insert into steel_pulse_private.editorial_events(card_id,revision,event_type,actor_user_id,reason)
    values(v_card.id,v_revision,'draft_saved',v_actor,'New original editorial draft version');
  return jsonb_build_object('card_id',v_card.id,'revision',v_revision,'status','draft');
end;
$$;
revoke all on function public.sp3_save_draft(uuid,integer,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.sp3_save_draft(uuid,integer,text,text,text,text,text)
  to authenticated;

-- A single transition RPC covers review stages; all decisions are signed by authenticated people.
create function public.sp3_decide(
  p_card_id uuid,p_revision integer,p_action text,p_evidence_url text default null,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());
        v_card steel_pulse_private.editorial_cards%rowtype;
        v_new text; v_event text; v_evidence text:=btrim(coalesce(p_evidence_url,''));
begin
  if v_actor is null then
    raise exception 'SP3 login required' using errcode='42501';
  end if;
  select * into v_card from steel_pulse_private.editorial_cards where id=p_card_id for update;
  if not found or p_revision is distinct from v_card.revision then
    raise exception 'SP3 card/revision not found' using errcode='22023';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 8 and 2000 then
    raise exception 'SP3 decision reason required' using errcode='22023';
  end if;
  if p_action='submit' then
    if not public.has_platform_permission('knowledge.edit')
      or v_card.status<>'draft' or v_card.authored_by<>v_actor then
      raise exception 'SP3 submit denied' using errcode='42501';
    end if;
    v_new:='in_review';v_event:='submitted';
  elsif p_action in ('editor_approve','editor_reject') then
    if not public.has_platform_permission('knowledge.review')
      or v_card.status<>'in_review' or v_card.authored_by=v_actor then
      raise exception 'SP3 independent editorial review required' using errcode='42501';
    end if;
    if p_action='editor_approve' and
      (v_evidence !~ '^https://[^[:space:]]+$' or char_length(v_evidence)>1024) then
      raise exception 'SP3 fact evidence HTTPS URL required' using errcode='22023';
    end if;
    v_new:=case when p_action='editor_approve' then 'editor_approved' else 'draft' end;
    v_event:=case when p_action='editor_approve' then 'editor_approved' else 'editor_rejected' end;
  elsif p_action in ('legal_approve','legal_reject') then
    -- Rights assessment is deliberately reserved to Platform Owner until a
    -- separate, auditable legal-reviewer permission process is introduced.
    if not private.is_platform_superadmin()
      or v_card.status<>'editor_approved'
      or v_card.authored_by=v_actor or v_card.editor_reviewed_by=v_actor then
      raise exception 'SP3 independent owner rights approval required' using errcode='42501';
    end if;
    if p_action='legal_approve' then
      if not steel_pulse_private.sp3_source_is_publishable(v_card.item_id) then
        raise exception 'SP3 source rights not valid for publication' using errcode='42501';
      end if;
      if v_evidence !~ '^https://[^[:space:]]+$' or char_length(v_evidence)>1024 then
        raise exception 'SP3 item-level rights evidence URL required' using errcode='22023';
      end if;
      if char_length(btrim(p_reason))<30 then
        raise exception 'SP3 item-specific legal attestation too short' using errcode='22023';
      end if;
    end if;
    v_new:=case when p_action='legal_approve' then 'legal_approved' else 'draft' end;
    v_event:=case when p_action='legal_approve' then 'legal_approved' else 'legal_rejected' end;
  elsif p_action='publish' then
    if not public.has_platform_permission('knowledge.publish')
      or v_card.status<>'legal_approved'
      or v_card.authored_by=v_actor or v_card.editor_reviewed_by=v_actor
      or v_card.legal_reviewed_by is null or v_card.editor_reviewed_by is null
      or v_card.fact_evidence_url is null or v_card.item_rights_evidence_url is null
      or v_card.legal_attestation is null
      or not steel_pulse_private.sp3_source_is_publishable(v_card.item_id) then
      raise exception 'SP3 publication gate denied' using errcode='42501';
    end if;
    v_new:='published';v_event:='published';
  elsif p_action='withdraw' then
    if not public.has_platform_permission('knowledge.publish')
       or v_card.status<>'published' then
      raise exception 'SP3 withdrawal denied' using errcode='42501';
    end if;
    v_new:='withdrawn';v_event:='withdrawn';
  else
    raise exception 'Invalid SP3 action' using errcode='22023';
  end if;

  update steel_pulse_private.editorial_cards set
    status=v_new,updated_at=now(),
    editor_reviewed_by=case when p_action='editor_approve' then v_actor
      when p_action in ('editor_reject','legal_reject') then null else editor_reviewed_by end,
    editor_reviewed_at=case when p_action='editor_approve' then now()
      when p_action in ('editor_reject','legal_reject') then null else editor_reviewed_at end,
    fact_evidence_url=case when p_action='editor_approve' then v_evidence
      when p_action in ('editor_reject','legal_reject') then null else fact_evidence_url end,
    legal_reviewed_by=case when p_action='legal_approve' then v_actor
      when p_action in ('editor_reject','legal_reject') then null else legal_reviewed_by end,
    legal_reviewed_at=case when p_action='legal_approve' then now()
      when p_action in ('editor_reject','legal_reject') then null else legal_reviewed_at end,
    item_rights_evidence_url=case when p_action='legal_approve' then v_evidence
      when p_action in ('editor_reject','legal_reject') then null else item_rights_evidence_url end,
    legal_attestation=case when p_action='legal_approve' then btrim(p_reason)
      when p_action in ('editor_reject','legal_reject') then null else legal_attestation end,
    published_by=case when p_action='publish' then v_actor else published_by end,
    published_at=case when p_action='publish' then now() else published_at end,
    published_until=case when p_action='publish' then (
       select least(s.approval_expires_at,now()+interval '90 days')
       from steel_pulse_private.items i
       join steel_pulse_private.sources s on s.id=i.source_id
       where i.id=v_card.item_id
    ) else published_until end,
    withdrawn_by=case when p_action='withdraw' then v_actor else withdrawn_by end,
    withdrawn_at=case when p_action='withdraw' then now() else withdrawn_at end
  where id=v_card.id;

  insert into steel_pulse_private.editorial_events(card_id,revision,event_type,actor_user_id,reason)
    values(v_card.id,v_card.revision,v_event,v_actor,btrim(p_reason));
  return jsonb_build_object('card_id',v_card.id,'revision',v_card.revision,'status',v_new);
end;
$$;
revoke all on function public.sp3_decide(uuid,integer,text,text,text)
  from public,anon,authenticated;
grant execute on function public.sp3_decide(uuid,integer,text,text,text)
  to authenticated;

-- Private fail-closed projection, no grants to anon/authenticated; SP4 must implement
-- a new public API with filtering, sanitization, rate limits and cache invalidation.
create view steel_pulse_private.sp3_currently_eligible_cards
with (security_barrier=true) as
select c.id,c.item_id,c.revision,c.headline,c.summary,c.relevance,c.topic,
  c.language_code,i.canonical_url,i.published_at as source_published_at,
  s.display_name as source_name,c.published_at,c.published_until
from steel_pulse_private.editorial_cards c
join steel_pulse_private.items i on i.id=c.item_id
join steel_pulse_private.sources s on s.id=i.source_id
where c.status='published' and c.published_until>now()
  and c.editor_reviewed_by is not null
  and c.legal_reviewed_by is not null
  and c.authored_by<>c.editor_reviewed_by
  and c.authored_by<>c.legal_reviewed_by
  and c.editor_reviewed_by<>c.legal_reviewed_by
  and steel_pulse_private.sp3_source_is_publishable(c.item_id);
revoke all on steel_pulse_private.sp3_currently_eligible_cards from public,anon,authenticated;
grant select on steel_pulse_private.sp3_currently_eligible_cards to service_role;

comment on view steel_pulse_private.sp3_currently_eligible_cards is
'Private SP3 rights-current projection, NOT a publicly exposed feed. SP4 must add public boundary.';
