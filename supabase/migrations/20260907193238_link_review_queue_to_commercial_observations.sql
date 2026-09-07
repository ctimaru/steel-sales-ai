alter table public.commercial_review_queue
  add column observation_id bigint references public.commercial_observations(id) on delete set null;

create index commercial_review_queue_observation_idx
  on public.commercial_review_queue(owner_id, observation_id);
