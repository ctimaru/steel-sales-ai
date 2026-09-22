-- PA2.29 follow-up — cover the decided_by foreign key used by the candidate decision ledger.
create index if not exists commercial_offer_reparse_candidate_decisions_decided_by_idx
  on public.commercial_offer_reparse_candidate_decisions(decided_by,decided_at desc);
