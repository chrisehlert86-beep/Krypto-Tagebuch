begin;

create or replace function public.reserve_invite(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.invites
  set reserved = true, reserved_at = now(), reserved_until = now() + interval '15 minutes'
  where invite_code = p_code and active = true and used = false
    and (reserved = false or reserved_until <= now())
  returning id into v_id;
  return v_id is not null;
end;
$$;
revoke execute on function public.reserve_invite(text) from public, anon, authenticated;
grant execute on function public.reserve_invite(text) to service_role;

create or replace function public.submit_application(
  p_invite_code text, p_first_name text, p_last_name text,
  p_telegram_user_id text, p_telegram_username text, p_disclaimer_version text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_application_id uuid;
begin
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
    p_invite_code, trim(p_first_name), trim(p_last_name), p_telegram_user_id,
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

create or replace function public.consume_admin_login(
  p_login_request_id uuid, p_session_id uuid, p_session_expires_at timestamptz
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.admin_sessions where expires_at <= now();
  delete from public.admin_login_requests
  where id = p_login_request_id and approved = true and rejected = false
    and approved_at is not null and expires_at > now();
  if not found then return false; end if;
  insert into public.admin_sessions (id, expires_at)
  values (p_session_id, p_session_expires_at);
  return true;
end;
$$;
revoke execute on function public.consume_admin_login(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_admin_login(uuid, uuid, timestamptz)
  to service_role;

create or replace function public.queue_member_status_change(p_member_id uuid)
returns table(status text, command text)
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members%rowtype;
  v_command text;
  v_status text;
begin
  select * into v_member from public.members where id = p_member_id for update;
  if not found then return; end if;
  if v_member.status = 'active' then
    v_status := 'inactive'; v_command := 'member_suspend';
  else
    v_status := v_member.status; v_command := 'member_restore';
  end if;
  update public.members
  set status = v_status, telegram_sync_status = 'pending', telegram_sync_error = null
  where id = p_member_id;
  insert into public.bot_commands (command, status, payload)
  values (v_command, 'pending', jsonb_build_object(
    'memberId', v_member.id, 'telegramUserId', v_member.telegram_user_id,
    'firstName', v_member.first_name
  ));
  return query select v_status, v_command;
end;
$$;
revoke execute on function public.queue_member_status_change(uuid)
  from public, anon, authenticated;
grant execute on function public.queue_member_status_change(uuid) to service_role;

commit;
