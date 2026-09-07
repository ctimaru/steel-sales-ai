create index if not exists commercial_threads_dataset_id_idx on public.commercial_threads(dataset_id);
create index if not exists commercial_observations_dataset_id_idx on public.commercial_observations(dataset_id);
create index if not exists commercial_observations_thread_id_idx on public.commercial_observations(thread_id);
create index if not exists commercial_review_queue_dataset_id_idx on public.commercial_review_queue(dataset_id);
create index if not exists commercial_review_queue_thread_id_idx on public.commercial_review_queue(thread_id);
create index if not exists commercial_review_queue_observation_id_idx on public.commercial_review_queue(observation_id);
