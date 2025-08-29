-- Add missing 'none' state to payment_status enum used by appointments seed
do $$ begin
  alter type public.payment_status add value if not exists 'none' before 'created';
exception when others then null; end $$;


