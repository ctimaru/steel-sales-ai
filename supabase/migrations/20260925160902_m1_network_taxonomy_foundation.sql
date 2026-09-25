create table public.network_company_roles (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  display_name text not null,
  status text not null default 'active' check (status in ('active','deprecated')),
  launch_scope text not null check (launch_scope in ('MVP','Later')),
  sort_order integer not null default 0,
  searchable boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.network_company_subtypes (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  display_name text not null,
  company_role_id uuid not null references public.network_company_roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','deprecated')),
  launch_scope text not null check (launch_scope in ('MVP','Later')),
  sort_order integer not null default 0,
  searchable boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.network_capabilities (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  display_name text not null,
  capability_group text null,
  parent_id uuid null references public.network_capabilities(id) on delete restrict,
  status text not null default 'active' check (status in ('active','deprecated')),
  launch_scope text not null check (launch_scope in ('MVP','Later')),
  sort_order integer not null default 0,
  searchable boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.network_product_families (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  display_name text not null,
  parent_id uuid null references public.network_product_families(id) on delete restrict,
  status text not null default 'active' check (status in ('active','deprecated')),
  launch_scope text not null check (launch_scope in ('MVP','Later')),
  sort_order integer not null default 0,
  searchable boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.network_markets (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  display_name text not null,
  parent_id uuid null references public.network_markets(id) on delete restrict,
  status text not null default 'active' check (status in ('active','deprecated')),
  launch_scope text not null check (launch_scope in ('MVP','Later')),
  sort_order integer not null default 0,
  searchable boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.network_certification_types (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  display_name text not null,
  parent_id uuid null references public.network_certification_types(id) on delete restrict,
  status text not null default 'active' check (status in ('active','deprecated')),
  launch_scope text not null check (launch_scope in ('MVP','Later')),
  sort_order integer not null default 0,
  searchable boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.network_company_roles enable row level security;
alter table public.network_company_subtypes enable row level security;
alter table public.network_capabilities enable row level security;
alter table public.network_product_families enable row level security;
alter table public.network_markets enable row level security;
alter table public.network_certification_types enable row level security;

revoke all on table public.network_company_roles from public, anon, authenticated;
revoke all on table public.network_company_subtypes from public, anon, authenticated;
revoke all on table public.network_capabilities from public, anon, authenticated;
revoke all on table public.network_product_families from public, anon, authenticated;
revoke all on table public.network_markets from public, anon, authenticated;
revoke all on table public.network_certification_types from public, anon, authenticated;

grant select on table public.network_company_roles to authenticated;
grant select on table public.network_company_subtypes to authenticated;
grant select on table public.network_capabilities to authenticated;
grant select on table public.network_product_families to authenticated;
grant select on table public.network_markets to authenticated;
grant select on table public.network_certification_types to authenticated;

grant select,insert,update,delete on table public.network_company_roles to service_role;
grant select,insert,update,delete on table public.network_company_subtypes to service_role;
grant select,insert,update,delete on table public.network_capabilities to service_role;
grant select,insert,update,delete on table public.network_product_families to service_role;
grant select,insert,update,delete on table public.network_markets to service_role;
grant select,insert,update,delete on table public.network_certification_types to service_role;

create policy network_company_roles_authenticated_read
  on public.network_company_roles for select to authenticated using (true);
create policy network_company_subtypes_authenticated_read
  on public.network_company_subtypes for select to authenticated using (true);
create policy network_capabilities_authenticated_read
  on public.network_capabilities for select to authenticated using (true);
create policy network_product_families_authenticated_read
  on public.network_product_families for select to authenticated using (true);
create policy network_markets_authenticated_read
  on public.network_markets for select to authenticated using (true);
create policy network_certification_types_authenticated_read
  on public.network_certification_types for select to authenticated using (true);

insert into public.network_company_roles
(canonical_key,display_name,launch_scope,sort_order,searchable,notes)
values
('producer','Producer','MVP',10,true,'Primary UX door: Produttori.'),
('trader_distributor','Trader / Distributor','MVP',20,true,'Primary UX door: Commercianti.'),
('processor_service_provider','Processor / Service Provider','MVP',30,true,'Canonical internal name for Terzisti.'),
('end_user','End User','MVP',40,true,'Canonical internal name for Utilizzatori.');

insert into public.network_company_subtypes
(canonical_key,display_name,company_role_id,launch_scope,sort_order,searchable,notes)
select v.canonical_key,v.display_name,r.id,v.launch_scope,v.sort_order,true,v.notes
from (values
('integrated_mill','Integrated steel mill','producer','MVP',10,'Primary steelmaking + rolling.'),
('eaf_mill','EAF mill','producer','MVP',20,'Electric arc furnace producer.'),
('rolling_mill','Rolling mill / reroller','producer','MVP',30,'Downstream rolling producer.'),
('tube_pipe_producer','Tube & pipe producer','producer','MVP',40,'Welded/seamless tube and pipe producer.'),
('section_profile_producer','Section / profile producer','producer','MVP',50,'Structural/open/closed profile producer.'),
('wire_rod_producer','Wire / rod producer','producer','MVP',60,'Wire rod / wire producer.'),
('stainless_producer','Stainless producer','producer','MVP',70,'Stainless specialist.'),
('special_steel_producer','Special steel producer','producer','Later',80,'Alloy/tool/bearing and other specialty steel.'),
('international_trader','International trader','trader_distributor','MVP',110,'Cross-border sourcing and resale.'),
('distributor','Distributor','trader_distributor','MVP',120,'Regional/national distributor.'),
('stockholder','Stockholder','trader_distributor','MVP',130,'Maintains physical stock for resale.'),
('importer','Importer','trader_distributor','MVP',140,'Import-focused operator.'),
('exporter','Exporter','trader_distributor','MVP',150,'Export-focused operator.'),
('steel_service_center','Steel service center','trader_distributor','MVP',160,'May also be secondary Processor role.'),
('toll_processor','Toll processor','processor_service_provider','MVP',210,'Processes customer-owned material.'),
('cutting_specialist','Cutting specialist','processor_service_provider','MVP',220,'Laser/plasma/oxy/saw cutting.'),
('fabricator','Fabricator','processor_service_provider','MVP',230,'Fabricates steel parts/components.'),
('coating_galvanizing','Coating / galvanizing specialist','processor_service_provider','MVP',240,'Surface treatment specialist.'),
('machining_specialist','Machining specialist','processor_service_provider','Later',250,'Machining/drilling/milling/turning.'),
('testing_inspection','Testing / inspection provider','processor_service_provider','Later',260,'NDT/lab/inspection services.'),
('logistics_warehousing','Logistics / warehousing provider','processor_service_provider','Later',270,'Steel logistics and storage.'),
('oem','OEM','end_user','MVP',310,'Original equipment manufacturer.'),
('epc_contractor','EPC contractor','end_user','MVP',320,'Engineering/procurement/construction.'),
('automotive_supplier','Automotive supplier','end_user','MVP',330,'Automotive/Tier supplier.'),
('construction_contractor','Construction contractor','end_user','MVP',340,'Construction/infrastructure user.'),
('mechanical_engineering','Mechanical engineering company','end_user','MVP',350,'Machinery/general engineering.'),
('energy_equipment','Energy equipment user','end_user','MVP',360,'Energy sector.'),
('hvac_manufacturer','HVAC manufacturer','end_user','MVP',370,'HVAC equipment.'),
('appliance_manufacturer','Appliance manufacturer','end_user','Later',380,'White goods/appliances.'),
('marine_shipbuilding','Marine / shipbuilding','end_user','Later',390,'Marine and shipbuilding.')
) as v(canonical_key,display_name,role_key,launch_scope,sort_order,notes)
join public.network_company_roles r on r.canonical_key=v.role_key;

insert into public.network_capabilities
(canonical_key,display_name,capability_group,launch_scope,sort_order,searchable,notes)
values
('export_capability','Export capability','commercial','MVP',10,true,'Cross-border commercial capability.'),
('jit_delivery','JIT delivery','commercial','MVP',20,true,'Just-in-time delivery capability.'),
('project_supply','Project supply','commercial','MVP',30,true,'Project-based supply.'),
('small_batch','Small batch','commercial','MVP',40,true,'Can serve low MOQ/small quantities.'),
('bending_forming','Bending / forming','processor_service_provider','MVP',110,true,'Bending, forming, rolling.'),
('cut_to_length','Cut-to-length','processor_service_provider','MVP',120,true,'CTL processing.'),
('galvanizing','Galvanizing','processor_service_provider','MVP',130,true,'Hot dip or other galvanizing.'),
('heat_treatment','Heat treatment','processor_service_provider','Later',140,true,'Thermal processing.'),
('laser_cutting','Laser cutting','processor_service_provider','MVP',150,true,'Laser cutting.'),
('oxy_cutting','Oxy cutting','processor_service_provider','MVP',160,true,'Oxy-fuel cutting.'),
('painting_coating','Painting / coating','processor_service_provider','MVP',170,true,'Protective/decorative coating.'),
('pickling_oiling','Pickling / oiling','processor_service_provider','Later',180,true,'Surface cleaning and oiling.'),
('plasma_cutting','Plasma cutting','processor_service_provider','MVP',190,true,'Plasma cutting.'),
('sawing','Sawing','processor_service_provider','MVP',200,true,'Cutting by saw.'),
('slitting','Slitting','processor_service_provider','MVP',210,true,'Coil slitting.'),
('testing_ndt','Testing / NDT','processor_service_provider','Later',220,true,'Testing/inspection capability.'),
('welding_fabrication','Welding / fabrication','processor_service_provider','MVP',230,true,'Welding and fabricated assemblies.'),
('stockholding','Stockholding','trader_distributor','MVP',310,true,'Physical inventory availability.');

insert into public.network_product_families
(canonical_key,display_name,launch_scope,sort_order,searchable,notes)
values
('flat_products','Flat products','MVP',10,true,'Coils, sheets, plates, strip.'),
('long_products','Long products','MVP',20,true,'Bars, beams, sections, rebar, wire rod.'),
('tubes_pipes','Tubes & pipes','MVP',30,true,'Circular/non-circular tubes and pipes.');

insert into public.network_product_families
(canonical_key,display_name,parent_id,launch_scope,sort_order,searchable,notes)
select v.canonical_key,v.display_name,p.id,v.launch_scope,v.sort_order,true,v.notes
from (values
('coils','Coils','flat_products','MVP',110,'HR/CR/coated coils.'),
('plates','Plates','flat_products','MVP',120,'Heavy/medium plate.'),
('sheets','Sheets','flat_products','MVP',130,'Sheets.'),
('bars','Bars','long_products','MVP',210,'Merchant/special bars.'),
('beams_sections','Beams & sections','long_products','MVP',220,'Structural profiles.'),
('rebar','Rebar','long_products','Later',230,'Reinforcing bar.'),
('wire_rod_wire','Wire rod / wire','long_products','Later',240,'Wire rod and drawn wire.'),
('hollow_sections','Hollow sections','tubes_pipes','MVP',310,'Structural hollow sections.')
) as v(canonical_key,display_name,parent_key,launch_scope,sort_order,notes)
join public.network_product_families p on p.canonical_key=v.parent_key;

insert into public.network_markets
(canonical_key,display_name,launch_scope,sort_order,searchable,notes)
values
('automotive','Automotive','MVP',10,true,'Automotive and suppliers.'),
('construction_infrastructure','Construction & infrastructure','MVP',20,true,'Buildings and infrastructure.'),
('energy','Energy','MVP',30,true,'Power, renewables, oil & gas.'),
('hvac','HVAC','MVP',40,true,'HVAC.'),
('mechanical_engineering_market','Mechanical engineering','MVP',50,true,'Machinery/general engineering.'),
('agri_machinery','Agriculture machinery','Later',60,true,'Agricultural machinery.'),
('appliances','Appliances','Later',70,true,'White goods.'),
('marine','Marine','Later',80,true,'Shipbuilding/marine.');

create index network_company_subtypes_role_idx
  on public.network_company_subtypes(company_role_id,status,sort_order);
create index network_capabilities_group_idx
  on public.network_capabilities(capability_group,status,sort_order);
create index network_product_families_parent_idx
  on public.network_product_families(parent_id,status,sort_order);
create index network_markets_status_idx
  on public.network_markets(status,sort_order);
create index network_certification_types_status_idx
  on public.network_certification_types(status,sort_order);
