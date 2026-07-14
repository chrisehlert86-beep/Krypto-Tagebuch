-- Sicherheitshärtung für Webanwendung, Admin-Sitzungen und Telegram-Synchronisierung.
-- Vorhandene unbenutzte Einladungscodes werden deaktiviert, da sie vor dieser
-- Migration über den öffentlichen Anon-Key auslesbar waren.

alter table public.invites enable row level security;
revoke all on table public.invites from anon, authenticated;
grant select, insert, update, delete on table public.invites to service_role;

revoke execute on function public.reserve_invite(text) from public, anon, authenticated;
grant execute on function public.reserve_invite(text) to service_role;

update public.invites
set active = false,
    reserved = false,
    reserved_at = null,
    reserved_until = null
where used = false;

create table if not exists public.api_rate_limits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (bucket, key_hash, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_window_seconds < 1 or p_limit < 1 then
    raise exception 'invalid rate limit configuration';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (bucket, key_hash, window_start, request_count)
  values (p_bucket, p_key_hash, v_window_start, 1)
  on conflict (bucket, key_hash, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  delete from public.api_rate_limits
  where window_start < now() - interval '2 days';

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

create table if not exists public.admin_sessions (
  id uuid primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists admin_sessions_active_idx
  on public.admin_sessions (expires_at)
  where revoked_at is null;

alter table public.admin_sessions enable row level security;
revoke all on table public.admin_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_sessions to service_role;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select, insert on table public.admin_audit_log to service_role;

alter table public.applications
  add column if not exists disclaimer_read boolean not null default false,
  add column if not exists risks_understood boolean not null default false,
  add column if not exists no_advice_acknowledged boolean not null default false;

update public.applications
set disclaimer_read = disclaimer_accepted,
    risks_understood = disclaimer_accepted,
    no_advice_acknowledged = disclaimer_accepted
where disclaimer_accepted = true;

alter table public.members
  add column if not exists telegram_sync_status text not null default 'synced',
  add column if not exists telegram_sync_error text,
  add column if not exists telegram_synced_at timestamptz;

alter table public.members
  drop constraint if exists members_telegram_sync_status_check;
alter table public.members
  add constraint members_telegram_sync_status_check
  check (telegram_sync_status in ('pending', 'synced', 'failed'));

alter table public.bot_commands
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.bot_commands
  drop constraint if exists bot_commands_command_check;
alter table public.bot_commands
  add constraint bot_commands_command_check
  check (command in ('restart', 'test_message', 'member_suspend', 'member_restore'));

delete from public.admin_login_requests
where expires_at < now() - interval '1 day';

delete from public.bot_commands
where processed_at < now() - interval '30 days';
