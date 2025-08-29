-- updated_at trigger and attachments

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach to tables that have updated_at
-- user_profiles removed

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_clients';
  if not found then
    execute 'create trigger trg_set_updated_at_clients before update on public.clients for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_addresses';
  if not found then
    execute 'create trigger trg_set_updated_at_addresses before update on public.addresses for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_service_categories';
  if not found then
    execute 'create trigger trg_set_updated_at_service_categories before update on public.service_categories for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_services';
  if not found then
    execute 'create trigger trg_set_updated_at_services before update on public.services for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_addons';
  if not found then
    execute 'create trigger trg_set_updated_at_addons before update on public.addons for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_service_prices';
  if not found then
    execute 'create trigger trg_set_updated_at_service_prices before update on public.service_prices for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_appointments';
  if not found then
    execute 'create trigger trg_set_updated_at_appointments before update on public.appointments for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_integration_accounts';
  if not found then
    execute 'create trigger trg_set_updated_at_integration_accounts before update on public.integration_accounts for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_payment_methods';
  if not found then
    execute 'create trigger trg_set_updated_at_payment_methods before update on public.payment_methods for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_payments';
  if not found then
    execute 'create trigger trg_set_updated_at_payments before update on public.payments for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_products';
  if not found then
    execute 'create trigger trg_set_updated_at_products before update on public.products for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_product_categories';
  if not found then
    execute 'create trigger trg_set_updated_at_product_categories before update on public.product_categories for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_carts';
  if not found then
    execute 'create trigger trg_set_updated_at_carts before update on public.carts for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_cart_items';
  if not found then
    execute 'create trigger trg_set_updated_at_cart_items before update on public.cart_items for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_orders';
  if not found then
    execute 'create trigger trg_set_updated_at_orders before update on public.orders for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_modules';
  if not found then
    execute 'create trigger trg_set_updated_at_modules before update on public.modules for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_webhook_outbox';
  if not found then
    execute 'create trigger trg_set_updated_at_webhook_outbox before update on public.webhook_outbox for each row execute procedure public.set_updated_at()';
  end if;
end $$;

do $$ begin
  perform 1 from pg_trigger where tgname = 'trg_set_updated_at_business_settings';
  if not found then
    execute 'create trigger trg_set_updated_at_business_settings before update on public.business_settings for each row execute procedure public.set_updated_at()';
  end if;
end $$;


