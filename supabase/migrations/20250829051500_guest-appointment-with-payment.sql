create or replace function public.guest_create_appointment_with_payment(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_service_id uuid,
  p_service_option_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_notes text,
  p_addon_ids uuid[],
  p_payment_status public.payment_status,
  p_square_payment_id text
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

  insert into public.appointments(id, client_id, service_id, service_option_id, start_at, end_at, notes, payment_status, square_payment_id)
  values (uuid_generate_v4(), v_client_id, p_service_id, p_service_option_id, p_start_at, p_end_at, p_notes, coalesce(p_payment_status,'authorized'), p_square_payment_id)
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


