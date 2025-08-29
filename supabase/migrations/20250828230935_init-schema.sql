-- Initial schema for Blue Room Spa OS (MVP)
-- Conventions: UUID v4 PKs, snake_case, UTC timestamps, soft-delete via deleted_at when applicable
-- Note: RLS and policies are added in a separate migration

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Enums
-- Removed user_role enum; roles handled via admins table

do $$ begin
  create type public.appointment_status as enum ('requested','approved','denied','cancelled','completed','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('created','authorized','captured','voided','refunded','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_source as enum ('booking','order');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.integration_provider as enum ('square','ghl');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.integration_status as enum ('connected','disconnected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending','paid','fulfilled','cancelled','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recipient_type as enum ('admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('in_app');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.webhook_destination as enum ('ghl');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_payments_mode as enum ('authorize','capture');
exception when duplicate_object then null; end $$;

-- Admin membership (mark which auth.users are admins)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- People
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  first_name text,
  last_name text,
  phone text,
  dob date,
  notes text,
  ghl_contact_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clients_email_unique unique (email),
  constraint clients_phone_unique unique (phone)
);

create table if not exists public.addresses (
  id uuid primary key default uuid_generate_v4(),
  owner_type text not null check (owner_type in ('client','business')),
  owner_id uuid not null,
  line1 text,
  line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists addresses_owner_idx on public.addresses(owner_type, owner_id);

create table if not exists public.consents (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('email','sms','liability','privacy')),
  granted boolean not null default false,
  granted_at timestamptz,
  meta jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists consents_unique on public.consents(client_id, type);

-- Services & Catalog
create table if not exists public.service_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  base_price_cents int not null default 0,
  base_duration_min int not null default 0,
  buffer_before_min int not null default 0,
  buffer_after_min int not null default 0,
  visible boolean not null default true,
  draft boolean not null default false,
  existing_clients_only boolean not null default false,
  processing_time_min int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_options (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  price_delta_cents int not null default 0,
  duration_delta_min int not null default 0,
  sort_order int not null default 0,
  visible boolean not null default true
);
create index if not exists service_options_service_idx on public.service_options(service_id);

-- Global addons + eligibility matrix
create table if not exists public.addons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  price_delta_cents int not null default 0,
  duration_delta_min int not null default 0,
  color text,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_addon_links (
  service_id uuid not null references public.services(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete cascade,
  primary key (service_id, addon_id)
);

create table if not exists public.service_prices (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid not null references public.services(id) on delete cascade,
  start_date date not null,
  end_date date,
  price_cents int not null
);
create index if not exists service_prices_service_idx on public.service_prices(service_id);

create table if not exists public.service_blocks (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid not null references public.services(id) on delete cascade,
  rule jsonb not null
);

-- Availability & Calendar
create table if not exists public.business_hours (
  id uuid primary key default uuid_generate_v4(),
  weekday int not null check (weekday between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean not null default false
);

create table if not exists public.blackout_dates (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  reason text
);

create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  service_option_id uuid references public.service_options(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.appointment_status not null default 'requested',
  payment_status public.payment_status not null default 'created',
  notes text,
  hold_expires_at timestamptz,
  square_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_client_idx on public.appointments(client_id, start_at desc);
create index if not exists appointments_start_idx on public.appointments(start_at);

create table if not exists public.appointment_addons (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete restrict
);
create unique index if not exists appointment_addons_unique on public.appointment_addons(appointment_id, addon_id);

create table if not exists public.appointment_status_history (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text
);

-- Payments & Commerce
create table if not exists public.integration_accounts (
  id uuid primary key default uuid_generate_v4(),
  provider public.integration_provider not null,
  status public.integration_status not null default 'disconnected',
  credentials jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  square_customer_id text,
  square_card_id text,
  brand text,
  last4 text,
  exp_month int,
  exp_year int,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_methods_client_idx on public.payment_methods(client_id);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete set null,
  amount_cents int not null,
  currency text not null default 'USD',
  status public.payment_status not null default 'created',
  square_payment_id text,
  source public.payment_source not null,
  source_id uuid,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_source_idx on public.payments(source, source_id);

create table if not exists public.refunds (
  id uuid primary key default uuid_generate_v4(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount_cents int not null,
  reason text,
  square_refund_id text,
  status public.payment_status not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  brand text,
  image_url text,
  price_cents int not null default 0,
  compare_at_price_cents int,
  affiliate_url text,
  in_house boolean not null default false,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_category_links (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create table if not exists public.inventory (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_on_hand int not null default 0,
  quantity_reserved int not null default 0,
  reorder_threshold int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete set null,
  session_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default uuid_generate_v4(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity int not null default 1,
  price_cents_snapshot int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete set null,
  status public.order_status not null default 'pending',
  subtotal_cents int not null default 0,
  tax_cents int not null default 0,
  shipping_cents int not null default 0,
  total_cents int not null default 0,
  pickup_in_store boolean not null default false,
  affiliate boolean not null default false,
  affiliate_url_snapshot text,
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  unit_price_cents int not null,
  quantity int not null default 1,
  total_cents int not null,
  created_at timestamptz not null default now()
);

-- Content
create table if not exists public.modules (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  description text,
  content jsonb,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default uuid_generate_v4(),
  owner_type text not null,
  owner_id uuid not null,
  url text not null,
  alt_text text,
  created_at timestamptz not null default now()
);

-- Webhooks & Audit
create table if not exists public.webhook_outbox (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  payload jsonb not null,
  destination public.webhook_destination not null,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_inbox (
  id uuid primary key default uuid_generate_v4(),
  source text not null check (source in ('square')),
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text,
  error text
);

create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_type text not null check (actor_type in ('user','system')),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Settings
create table if not exists public.business_settings (
  id uuid primary key default uuid_generate_v4(),
  business_name text,
  phone text,
  email text,
  address jsonb,
  timezone text not null default 'America/Los_Angeles',
  cancellation_window_hours int not null default 24,
  reschedule_limit int not null default 2,
  booking_increment_min int not null default 15,
  min_start_lead_min int not null default 60,
  max_booking_horizon_days int not null default 60,
  payments_mode public.booking_payments_mode not null default 'capture',
  tax_rate_pct numeric(6,3) not null default 0,
  shipping_config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful computed constraints (partial; overlap guard will be in edge function)
create or replace function public.enforce_appointment_end_time()
returns trigger as $$
begin
  if (new.end_at <= new.start_at) then
    raise exception 'end_at must be after start_at';
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_enforce_appointment_end_time on public.appointments;
create trigger trg_enforce_appointment_end_time
before insert or update on public.appointments
for each row execute procedure public.enforce_appointment_end_time();


-- Helper functions

-- Returns true if current auth user is an admin
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

-- Link a pre-existing client (by email) to the current auth user
create or replace function public.link_client_to_current_user()
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return;
  end if;
  update public.clients c
    set user_id = auth.uid()
  where c.user_id is null
    and lower(c.email) = lower(v_email)
    and not exists (
      select 1 from public.clients c2 where c2.user_id = auth.uid()
    );
end;
$$;

-- Create-or-get a client by email for guest flow
create or replace function public.get_or_create_client_by_email_guest(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_client_id uuid;
begin
  if p_email is null then
    raise exception 'email is required';
  end if;
  select id into v_client_id from public.clients where lower(email) = lower(p_email) order by created_at asc limit 1;
  if v_client_id is null then
    insert into public.clients(id, email, first_name, last_name, phone)
    values (uuid_generate_v4(), p_email, p_first_name, p_last_name, p_phone)
    returning id into v_client_id;
  end if;
  return v_client_id;
end;
$$;

-- Guest appointment create (atomic)
create or replace function public.guest_create_appointment(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_service_id uuid,
  p_service_option_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_notes text,
  p_addon_ids uuid[]
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_client_id uuid;
  v_appt_id uuid;
  v_addon_id uuid;
begin
  v_client_id := public.get_or_create_client_by_email_guest(p_email, p_first_name, p_last_name, p_phone);

  insert into public.appointments(id, client_id, service_id, service_option_id, start_at, end_at, notes)
  values (uuid_generate_v4(), v_client_id, p_service_id, p_service_option_id, p_start_at, p_end_at, p_notes)
  returning id into v_appt_id;

  if p_addon_ids is not null then
    foreach v_addon_id in array p_addon_ids loop
      insert into public.appointment_addons(appointment_id, addon_id)
      values (v_appt_id, v_addon_id)
      on conflict do nothing;
    end loop;
  end if;

  return v_appt_id;
end;
$$;


