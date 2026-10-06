-- RFQH4 advisor hardening: cover foreign-key access paths used by quote lifecycle.

create index if not exists buyer_rfq_quote_lines_rfq_line_idx
  on public.buyer_rfq_quote_lines(rfq_line_id);

create index if not exists buyer_rfq_quotes_organization_idx
  on public.buyer_rfq_quotes(organization_id);

create index if not exists buyer_rfq_quotes_supplier_idx
  on public.buyer_rfq_quotes(supplier_id);
