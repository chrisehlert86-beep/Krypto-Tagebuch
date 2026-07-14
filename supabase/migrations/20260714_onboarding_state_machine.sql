-- Verlässlicher Bewerbungs- und Telegram-Beitrittsablauf.
-- Kann gefahrlos mehrfach ausgeführt werden.

alter table public.applications
  add column if not exists disclaimer_accepted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists telegram_invite_link text,
  add column if not exists telegram_invite_link_expires_at timestamptz,
  add column if not exists invite_created_at timestamptz,
  add column if not exists join_requested_at timestamptz,
  add column if not exists joined_at timestamptz;

create unique index if not exists applications_telegram_invite_link_key
  on public.applications (telegram_invite_link)
  where telegram_invite_link is not null;

create index if not exists applications_status_invite_created_idx
  on public.applications (status, invite_created_at);

update public.applications
set disclaimer_accepted_at = coalesce(disclaimer_accepted_at, created_at)
where disclaimer_accepted = true
  and disclaimer_accepted_at is null;

update public.applications
set approved_at = coalesce(approved_at, created_at)
where status in ('approved', 'active')
  and approved_at is null;

update public.applications
set rejected_at = coalesce(rejected_at, created_at)
where status = 'rejected'
  and rejected_at is null;

update public.applications
set joined_at = coalesce(joined_at, created_at)
where status = 'active'
  and joined_at is null;
