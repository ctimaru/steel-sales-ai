-- =====================================================================
-- CPOST1B — Stato dei post delle aziende leggibile dalla console
-- Founder request (4 Nov 2026): the console must show whether company posts
-- are on and let a superadmin switch them, instead of calling the staff
-- function by hand. Read-only addition: the switch itself stays
-- cpost1_staff_update_settings (superadmin only, unchanged).
-- =====================================================================

create function private.cpost1_staff_settings_impl()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_settings private.cpost1_settings%rowtype;
begin
  perform private.require_platform_permission('network_trust.posts_read');

  select * into v_settings from private.cpost1_settings where singleton;

  return jsonb_build_object(
    'contract',                   'cpost1-settings-v1',
    'enabled',                    coalesce(v_settings.enabled, false),
    'max_body_chars',             v_settings.max_body_chars,
    'max_posts_per_org_per_day',  v_settings.max_posts_per_org_per_day,
    'auto_hide_report_threshold', v_settings.auto_hide_report_threshold,
    'updated_at',                 v_settings.updated_at,
    'can_update',                 private.is_platform_superadmin(),
    'published_posts',            (select count(*) from public.company_posts p where p.status = 'published'),
    'hidden_posts',               (select count(*) from public.company_posts p where p.status = 'hidden'),
    'open_reports',               (select count(*) from public.company_post_reports r where r.status = 'open')
  );
end;
$$;

create function public.cpost1_staff_settings()
returns jsonb language sql stable set search_path = '' as
$$ select private.cpost1_staff_settings_impl(); $$;

-- Same grants as the other CPOST1 functions: authenticated only, never anon.
revoke all on function private.cpost1_staff_settings_impl() from public, anon;
grant execute on function private.cpost1_staff_settings_impl() to authenticated;
revoke all on function public.cpost1_staff_settings() from public, anon;
grant execute on function public.cpost1_staff_settings() to authenticated;
