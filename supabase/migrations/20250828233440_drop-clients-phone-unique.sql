-- Drop unique constraint on clients.phone to allow historical dupes
do $$ begin
  alter table public.clients drop constraint if exists clients_phone_unique;
exception when others then null; end $$;


