-- RQG3.2a controlled cleanup AFTER read-only acceptance and explicit operator approval.
-- DO NOT RUN unless both rows remain pending and every marker/organization matches.
-- No Auth user deletion, no Platform role revocation, no deletion of real business data.
begin;
do $rqg32a$
declare
  v_a uuid;
  v_b uuid;
begin
  select id into v_a from public.organizations where slug='rqg32-company-a';
  select id into v_b from public.organizations where slug='rqg32-company-b';
  if v_a is null or v_b is null or v_a=v_b then
    raise exception 'RQG3.2a cleanup: synthetic companies not found';
  end if;
  if (select count(*) from public.commercial_review_queue
      where (id=980321 and organization_id=v_a
             and source_text='RQG32-ORG_A-20261013' and status='pending')
         or (id=980322 and organization_id=v_b
             and source_text='RQG32-ORG_B-20261013' and status='pending'))<>2 then
    raise exception 'RQG3.2a cleanup: review evidence changed; manual investigation required';
  end if;
  if (select count(*) from public.commercial_observations
      where (id=980321 and organization_id=v_a and source_filename='RQG32-SYNTHETIC-A.eml')
         or (id=980322 and organization_id=v_b and source_filename='RQG32-SYNTHETIC-B.eml'))<>2 then
    raise exception 'RQG3.2a cleanup: observation ownership mismatch';
  end if;
  delete from public.commercial_review_queue where id in (980321,980322);
  delete from public.commercial_observations where id in (980321,980322);
  delete from public.commercial_threads
    where id in ('00000000-0000-0000-0000-000000032121',
                 '00000000-0000-0000-0000-000000032122');
  delete from public.commercial_datasets
    where id in ('00000000-0000-0000-0000-000000032101',
                 '00000000-0000-0000-0000-000000032102');
end;
$rqg32a$;
commit;
