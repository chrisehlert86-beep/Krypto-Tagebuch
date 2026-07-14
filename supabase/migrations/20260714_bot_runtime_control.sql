create table if not exists public.bot_runtime (
  id text primary key,
  last_heartbeat timestamptz not null,
  started_at timestamptz not null,
  version text not null
);

create table if not exists public.bot_commands (
  id uuid primary key default gen_random_uuid(),
  command text not null check (command in ('restart', 'test_message')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  result text
);

create index if not exists bot_commands_pending_idx
  on public.bot_commands (requested_at)
  where status = 'pending';

alter table public.bot_runtime enable row level security;
alter table public.bot_commands enable row level security;

revoke all on table public.bot_runtime from anon, authenticated;
revoke all on table public.bot_commands from anon, authenticated;

grant select, insert, update on table public.bot_runtime to service_role;
grant select, insert, update, delete on table public.bot_commands to service_role;
