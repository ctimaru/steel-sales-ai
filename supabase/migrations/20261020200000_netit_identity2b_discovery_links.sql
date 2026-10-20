-- NET-IT IDENTITY2B -- research-only, reversible discovery link proposals.
-- Existing public.network_identity_resolution_candidates applies only to published network_companies.
-- This isolated private ledger supports discovery UUIDs without modifying or merging them.
create table if not exists private.netit_identity_link_proposals (
 id uuid primary key default gen_random_uuid(),
 entity_a_id uuid not null,
 entity_b_id uuid not null,
 relation_hint text not null check(relation_hint in ('possible_alias','possible_brand_alias','shared_group_signal')),
 source_url text not null check(source_url ~ '^https://[^[:space:]<>@]+' and length(source_url)<=500),
 source_note text not null check(length(source_note) between 35 and 900),
 observation_batch text not null check(length(observation_batch) between 12 and 90),
 proposal_status text not null default 'candidate' check(proposal_status='candidate'),
 legal_identity_verified boolean not null default false check(not legal_identity_verified),
 merge_performed boolean not null default false check(not merge_performed),
 source_reuse_rights text not null default 'not_assessed' check(source_reuse_rights='not_assessed'),
 created_at timestamptz not null default now(),
 constraint netit_identity2b_pair_order check (entity_a_id<entity_b_id),
 constraint netit_identity2b_unique unique(entity_a_id,entity_b_id,relation_hint)
);
alter table private.netit_identity_link_proposals enable row level security;
revoke all on private.netit_identity_link_proposals from PUBLIC,anon,authenticated;
grant select on private.netit_identity_link_proposals to service_role;
comment on table private.netit_identity_link_proposals is
 'Research-only non-destructive crosswalk across discovery UUIDs; not an accepted duplicate, a legal verification, or a merge.';

with src(domain_a,domain_b,relation_hint,url,note) as(values
('aermec.it','global.aermec.com','possible_alias','https://global.aermec.com/it/contatti/','La pagina ufficiale Aermec S.p.A. identifica il sito globale e l''azienda; la corrispondenza con il profilo del sito aermec.it necessita consolidamento non distruttivo.'),
('energreen.it','en.energreen.it','possible_alias','https://en.energreen.it/contacts/','Pagina inglese Energreen S.p.A. indica il sito italiano e gli stessi contatti; due record distinti richiedono risoluzione editoriale.'),
('cinelli.it','cinelli-milano.com','possible_brand_alias','https://cinelli-milano.com/it/pages/history','Lo storico Cinelli sul sito del marchio è rilevante, ma non conferma da solo la titolarità legale dell''altro dominio.'),
('isottafraschini.it','isottafraschini.com','possible_brand_alias','https://www.isottafraschini.it/azienda/','La fonte descrive Isotta Fraschini Motori S.p.A.; il secondo dominio deve essere attribuito prima di ricondurre due record allo stesso soggetto.'),
('guaresi.com','agricolaitaliana.it','shared_group_signal','https://www.fyeld.eu/it/marchi','Fyeld elenca Guaresi e Agricola Italiana nel proprio portfolio; segnala collegamento societario/marchi e non una fusione di soggetti.'),
('guaresi.com','hortech.it','shared_group_signal','https://www.hortech.it/azienda/','Hortech è ricondotta a Fyeld S.p.A. nella fonte aziendale e Guaresi appare nel portfolio Fyeld; possibile gruppo comune, società autonome non escluse.')
), entities as(
select d.id,d.domain from private.netfast_discovered_records d
), candidates as(
select least(a.id,b.id) id_a, greatest(a.id,b.id) id_b,
s.relation_hint,s.url,s.note
from src s
join entities a on a.domain=s.domain_a
join entities b on b.domain=s.domain_b
where a.id<>b.id
  and (select count(*) from entities e where e.domain=s.domain_a)=1
  and (select count(*) from entities e where e.domain=s.domain_b)=1
  and not exists (select 1 from private.netdata1b5_source_holds h where h.entity_kind='discovered' and h.entity_id in(a.id,b.id))
)
insert into private.netit_identity_link_proposals
 (entity_a_id,entity_b_id,relation_hint,source_url,source_note,observation_batch)
select id_a,id_b,relation_hint,url,note,'net-it-identity2b-source-v1'
from candidates
where (select count(*) from candidates)=6
on conflict(entity_a_id,entity_b_id,relation_hint) do nothing;
