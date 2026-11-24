-- C.5 candidate: run only after restricted role and adapter are verified.
begin;
revoke execute on function public.mkt9_reserve_email(uuid,text,text,text,jsonb), public.mkt9_confirm_email(uuid,text) from service_role;
revoke insert(kind,locale,name,email,organization,notice_version,challenge_digest,email_verified_at) on public.mkt9_community_interest from service_role;
revoke all on public.mkt9_community_pending,public.mkt9_community_rate from service_role;
revoke update(attempts) on public.mkt9_community_pending from service_role;
commit;
