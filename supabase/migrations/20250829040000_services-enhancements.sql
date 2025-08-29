alter table if exists public.services add column if not exists image_url text;
alter table if exists public.services add column if not exists color text;
alter table if exists public.services add column if not exists deposit_cents int not null default 0;
alter table if exists public.service_options add column if not exists deposit_cents int not null default 0;
alter table if exists public.service_options add column if not exists processing_time_min int not null default 0;


