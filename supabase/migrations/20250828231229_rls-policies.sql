-- Enable RLS and add initial policies

-- Enable RLS on all relevant tables
-- user_profiles removed; using admins table for role
alter table public.clients enable row level security;
alter table public.addresses enable row level security;
alter table public.consents enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_options enable row level security;
alter table public.addons enable row level security;
alter table public.service_addon_links enable row level security;
alter table public.service_prices enable row level security;
alter table public.service_blocks enable row level security;
alter table public.business_hours enable row level security;
alter table public.blackout_dates enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_addons enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.integration_accounts enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_category_links enable row level security;
alter table public.inventory enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.modules enable row level security;
alter table public.media_assets enable row level security;
alter table public.webhook_outbox enable row level security;
alter table public.webhook_inbox enable row level security;
alter table public.audit_log enable row level security;
alter table public.business_settings enable row level security;

-- is_admin() now defined in init schema using admins table

-- admins: allow a user to read their own row; mutations restricted (managed via service role)
alter table public.admins enable row level security;
create policy admins_read_self on public.admins for select using (user_id = auth.uid());
create policy admins_no_mutations on public.admins for all using (false) with check (false);

-- clients: self via user_id; admin all
create policy clients_self_read on public.clients for select using (user_id = auth.uid() or public.is_admin());
create policy clients_self_update on public.clients for update using (user_id = auth.uid() or public.is_admin());
create policy clients_self_insert on public.clients for insert with check (user_id = auth.uid());
create policy clients_admin_insert on public.clients for insert with check (public.is_admin());
create policy clients_admin_delete on public.clients for delete using (public.is_admin());

-- addresses: owner or admin
create policy addresses_owner_read on public.addresses for select using (
  (owner_type = 'client' and owner_id in (select id from public.clients where user_id = auth.uid()))
  or public.is_admin()
);
create policy addresses_owner_mutate on public.addresses for all using (
  (owner_type = 'client' and owner_id in (select id from public.clients where user_id = auth.uid()))
  or public.is_admin()
) with check (
  (owner_type = 'client' and owner_id in (select id from public.clients where user_id = auth.uid()))
  or public.is_admin()
);

-- consents: client self or admin
create policy consents_self on public.consents for select using (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);
create policy consents_self_mutate on public.consents for all using (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
) with check (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);

-- Catalog visibility to public
create policy service_categories_public_read on public.service_categories for select using (visible = true or public.is_admin());
create policy services_public_read on public.services for select using ((visible = true and draft = false) or public.is_admin());
create policy service_options_public_read on public.service_options for select using (
  service_id in (select id from public.services where (visible = true and draft = false)) or public.is_admin()
);
create policy addons_public_read on public.addons for select using (visible = true or public.is_admin());
create policy service_addon_links_public_read on public.service_addon_links for select using (
  exists (select 1 from public.services s where s.id = service_id and s.visible = true and s.draft = false) or public.is_admin()
);
create policy products_public_read on public.products for select using (visible = true or public.is_admin());
create policy product_categories_public_read on public.product_categories for select using (true);
create policy product_category_links_public_read on public.product_category_links for select using (true);

-- Admin manage catalog
create policy catalog_admin_all_service_categories on public.service_categories for all using (public.is_admin());
create policy catalog_admin_all_services on public.services for all using (public.is_admin());
create policy catalog_admin_all_service_options on public.service_options for all using (public.is_admin());
create policy catalog_admin_all_addons on public.addons for all using (public.is_admin());
create policy catalog_admin_all_service_addon_links on public.service_addon_links for all using (public.is_admin());
create policy catalog_admin_all_service_prices on public.service_prices for all using (public.is_admin());
create policy catalog_admin_all_service_blocks on public.service_blocks for all using (public.is_admin());
create policy catalog_admin_all_products on public.products for all using (public.is_admin());
create policy catalog_admin_all_product_categories on public.product_categories for all using (public.is_admin());
create policy catalog_admin_all_product_category_links on public.product_category_links for all using (public.is_admin());

-- Availability public read (for booking)
create policy business_hours_public_read on public.business_hours for select using (true);
create policy blackout_dates_public_read on public.blackout_dates for select using (true);

-- Appointments: client sees own, admin all
create policy appointments_client_read on public.appointments for select using (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);
create policy appointments_client_insert on public.appointments for insert with check (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);
create policy appointments_client_update on public.appointments for update using (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);
create policy appointment_addons_client on public.appointment_addons for all using (
  appointment_id in (
    select a.id from public.appointments a join public.clients c on a.client_id = c.id
    where c.user_id = auth.uid()
  ) or public.is_admin()
) with check (
  appointment_id in (
    select a.id from public.appointments a join public.clients c on a.client_id = c.id
    where c.user_id = auth.uid()
  ) or public.is_admin()
);
create policy appointment_status_history_read on public.appointment_status_history for select using (
  appointment_id in (
    select a.id from public.appointments a join public.clients c on a.client_id = c.id
    where c.user_id = auth.uid()
  ) or public.is_admin()
);

-- Payments & Orders: client sees own, admin all
create policy payments_client_read on public.payments for select using (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);
create policy payments_admin_mutate on public.payments for all using (public.is_admin());

-- Payment methods: client manage own
create policy payment_methods_client_read on public.payment_methods for select using (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);
create policy payment_methods_client_insert on public.payment_methods for insert with check (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);
create policy payment_methods_client_delete on public.payment_methods for delete using (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);

create policy orders_client_read on public.orders for select using (
  client_id in (select id from public.clients where user_id = auth.uid()) or public.is_admin()
);
create policy orders_admin_mutate on public.orders for all using (public.is_admin());

create policy order_items_client_read on public.order_items for select using (
  order_id in (select id from public.orders where client_id in (select id from public.clients where user_id = auth.uid())) or public.is_admin()
);

create policy carts_self on public.carts for all using (
  (client_id in (select id from public.clients where user_id = auth.uid())) or client_id is null or public.is_admin()
) with check (
  (client_id in (select id from public.clients where user_id = auth.uid())) or client_id is null or public.is_admin()
);
create policy cart_items_self on public.cart_items for all using (
  cart_id in (select id from public.carts where client_id in (select id from public.clients where user_id = auth.uid()) or client_id is null) or public.is_admin()
) with check (
  cart_id in (select id from public.carts where client_id in (select id from public.clients where user_id = auth.uid()) or client_id is null) or public.is_admin()
);

-- Misc admin-only
create policy integration_accounts_admin on public.integration_accounts for all using (public.is_admin());
create policy refunds_admin on public.refunds for all using (public.is_admin());
create policy inventory_admin on public.inventory for all using (public.is_admin());
create policy modules_public_read on public.modules for select using (visible = true or public.is_admin());
create policy modules_admin on public.modules for all using (public.is_admin());
create policy media_assets_admin on public.media_assets for all using (public.is_admin());
create policy webhook_outbox_admin on public.webhook_outbox for all using (public.is_admin());
create policy webhook_inbox_admin on public.webhook_inbox for all using (public.is_admin());
create policy audit_log_admin on public.audit_log for all using (public.is_admin());
create policy business_settings_public_read on public.business_settings for select using (true);
create policy business_settings_admin on public.business_settings for all using (public.is_admin());


