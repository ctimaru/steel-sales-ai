-- PL1.7 — FK index hygiene for private pricing.

begin;

create index if not exists price_discount_profiles_owner_user_idx
  on public.price_discount_profiles(owner_user_id)
  where owner_user_id is not null;

create index if not exists price_discount_profiles_price_list_idx
  on public.price_discount_profiles(price_list_id)
  where price_list_id is not null;

create index if not exists price_discount_profiles_section_idx
  on public.price_discount_profiles(section_id)
  where section_id is not null;

create index if not exists price_discount_profiles_created_by_idx
  on public.price_discount_profiles(created_by);

create index if not exists price_discount_profiles_updated_by_idx
  on public.price_discount_profiles(updated_by);

create index if not exists price_discount_profile_events_owner_user_idx
  on public.price_discount_profile_events(owner_user_id)
  where owner_user_id is not null;

create index if not exists price_discount_profile_events_actor_idx
  on public.price_discount_profile_events(actor_id)
  where actor_id is not null;

commit;
