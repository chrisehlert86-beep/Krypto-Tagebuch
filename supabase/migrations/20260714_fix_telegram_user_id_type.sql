begin;

create or replace function public.submit_application(
  p_invite_code text, p_first_name text, p_last_name text,
  p_telegram_user_id text, p_telegram_username text, p_disclaimer_version text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_application_id uuid;
begin
  if p_telegram_user_id !~ '^[1-9][0-9]{0,18}$' then
    raise exception using errcode = '22023', message = 'invalid_telegram_user_id';
  end if;

  update public.invites
  set used = true, used_at = now(), reserved = false,
      reserved_at = null, reserved_until = null
  where invite_code = p_invite_code and active = true and used = false
    and reserved = true and reserved_until > now();
  if not found then
    raise exception using errcode = 'P0001', message = 'invite_unavailable';
  end if;

  insert into public.applications (
    invite_code, first_name, last_name, telegram_user_id, telegram_username,
    telegram_verified, disclaimer_accepted, disclaimer_read, risks_understood,
    no_advice_acknowledged, disclaimer_version, disclaimer_accepted_at, status
  ) values (
    p_invite_code, trim(p_first_name), trim(p_last_name), p_telegram_user_id::bigint,
    nullif(trim(p_telegram_username), ''), true, true, true, true, true,
    p_disclaimer_version, now(), 'pending'
  ) returning id into v_application_id;
  return v_application_id;
end;
$$;

revoke execute on function public.submit_application(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_application(text, text, text, text, text, text)
  to service_role;

commit;
