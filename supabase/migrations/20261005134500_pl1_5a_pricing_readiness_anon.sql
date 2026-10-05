-- PL1.5A — allow public readiness reads through security-invoker RLS.
begin;

grant select on public.price_list_item_pricing_readiness to anon;

commit;
