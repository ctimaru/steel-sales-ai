-- PL1.3A fail-closed fix — NULL governance can never authorize publication.

begin;

create or replace function private.pl1_guard_price_list_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_predecessor_list_id uuid;
  v_doc_source_id uuid;
  v_doc_checksum text;
  v_doc_algorithm text;
  v_governance_decision text;
  v_structured_visibility text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New PL1 versions must start in draft'
        using errcode = '23514';
    end if;
  elsif tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft PL1 versions may be deleted'
        using errcode = '55000';
    end if;
    return old;
  else
    if old.status is distinct from new.status then
      if not (
        (old.status = 'draft' and new.status = 'review')
        or (old.status = 'review' and new.status in ('draft','verified'))
        or (old.status = 'verified' and new.status in ('review','published'))
        or (old.status = 'published' and new.status in ('superseded','withdrawn'))
        or (old.status = 'superseded' and new.status = 'withdrawn')
      ) then
        raise exception 'Invalid PL1 version transition: % -> %', old.status, new.status
          using errcode = '23514';
      end if;
    end if;

    if old.status in ('published','superseded','withdrawn') then
      if row(
        new.price_list_id,
        new.primary_source_document_id,
        new.manufacturer_version_code,
        new.manufacturer_revision_code,
        new.source_date,
        new.valid_from,
        new.valid_to,
        new.platform_revision,
        new.supersedes_version_id,
        new.supersession_reason,
        new.publication_scope,
        new.calculation_contract_version,
        new.created_by,
        new.published_by,
        new.published_at
      ) is distinct from row(
        old.price_list_id,
        old.primary_source_document_id,
        old.manufacturer_version_code,
        old.manufacturer_revision_code,
        old.source_date,
        old.valid_from,
        old.valid_to,
        old.platform_revision,
        old.supersedes_version_id,
        old.supersession_reason,
        old.publication_scope,
        old.calculation_contract_version,
        old.created_by,
        old.published_by,
        old.published_at
      ) then
        raise exception 'Published/superseded/withdrawn PL1 version identity is immutable'
          using errcode = '55000';
      end if;
    end if;
  end if;

  if new.supersedes_version_id is not null then
    select price_list_id
      into v_predecessor_list_id
    from public.price_list_versions
    where id = new.supersedes_version_id;

    if v_predecessor_list_id is null or v_predecessor_list_id <> new.price_list_id then
      raise exception 'PL1 supersedes_version_id must belong to the same price list'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'withdrawn'
     and coalesce(btrim(new.withdrawal_reason),'') = '' then
    raise exception 'PL1 withdrawal requires a reason'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status <> 'published' and new.status = 'published' then
    select d.source_id, d.content_checksum, d.checksum_algorithm
      into v_doc_source_id, v_doc_checksum, v_doc_algorithm
    from public.knowledge_documents d
    where d.id = new.primary_source_document_id;

    if v_doc_source_id is null
       or coalesce(v_doc_checksum,'') = ''
       or lower(coalesce(v_doc_algorithm,'')) <> 'sha256' then
      raise exception 'PL1 publication requires an immutable SHA-256 source document'
        using errcode = '23514';
    end if;

    select g.decision, g.structured_data_visibility
      into v_governance_decision, v_structured_visibility
    from public.price_list_source_governance_events g
    where g.knowledge_source_id = v_doc_source_id
      and (g.knowledge_document_id = new.primary_source_document_id or g.knowledge_document_id is null)
    order by g.decided_at desc, g.created_at desc, g.id desc
    limit 1;

    if new.publication_scope = 'public' then
      if v_governance_decision is distinct from 'approved_public'
         or v_structured_visibility is distinct from 'public' then
        raise exception 'PL1 public publication is blocked by source governance'
          using errcode = '42501';
      end if;
    elsif new.publication_scope = 'authenticated' then
      if v_governance_decision is null
         or v_structured_visibility is null
         or v_governance_decision not in ('approved_public','approved_authenticated')
         or v_structured_visibility not in ('public','authenticated') then
        raise exception 'PL1 authenticated publication is blocked by source governance'
          using errcode = '42501';
      end if;
    else
      if v_governance_decision is null
         or v_structured_visibility is null
         or v_governance_decision in ('pending_review','blocked')
         or v_structured_visibility = 'blocked' then
        raise exception 'PL1 internal publication is blocked by source governance'
          using errcode = '42501';
      end if;
    end if;

    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(new.published_by, auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_guard_price_list_version()
  from public, anon, authenticated;

commit;
