begin;

-- Remove obsolete, publicly executable SECURITY DEFINER functions.
revoke execute on function public.approve_application(uuid) from public, anon, authenticated;
revoke execute on function public.consume_invite(text) from public, anon, authenticated;
drop function if exists public.approve_application(uuid);
drop function if exists public.consume_invite(text);

-- Remove legacy policies. All access is mediated by trusted server code.
drop policy if exists allow_application_insert on public.applications;
drop policy if exists allow_invite_check on public.invites;
drop policy if exists allow_use_invite on public.invites;

-- Reset client-facing table privileges. RLS remains enabled as a second boundary.
revoke all privileges on table public.applications from anon, authenticated;
revoke all privileges on table public.members from anon, authenticated;
revoke all privileges on table public.admin_login_requests from anon, authenticated;
revoke all privileges on table public.invites from anon, authenticated;
revoke all privileges on table public.bot_runtime from anon, authenticated;
revoke all privileges on table public.bot_commands from anon, authenticated;
revoke all privileges on table public.api_rate_limits from anon, authenticated;
revoke all privileges on table public.admin_sessions from anon, authenticated;
revoke all privileges on table public.admin_audit_log from anon, authenticated;

-- Apply least-privilege service access instead of inherited broad grants.
revoke all privileges on table public.applications from service_role;
revoke all privileges on table public.members from service_role;
revoke all privileges on table public.admin_login_requests from service_role;
revoke all privileges on table public.invites from service_role;
revoke all privileges on table public.bot_runtime from service_role;
revoke all privileges on table public.bot_commands from service_role;
revoke all privileges on table public.api_rate_limits from service_role;
revoke all privileges on table public.admin_sessions from service_role;
revoke all privileges on table public.admin_audit_log from service_role;

grant select, insert, update, delete on table public.applications to service_role;
grant select, insert, update, delete on table public.members to service_role;
grant select, insert, update, delete on table public.admin_login_requests to service_role;
grant select, insert, update, delete on table public.invites to service_role;
grant select, insert, update on table public.bot_runtime to service_role;
grant select, insert, update, delete on table public.bot_commands to service_role;
grant select, insert, update, delete on table public.api_rate_limits to service_role;
grant select, insert, update, delete on table public.admin_sessions to service_role;
grant select, insert on table public.admin_audit_log to service_role;

-- Drop unused columns left over from the first Telegram onboarding model.
alter table public.applications
  drop column if exists telegram,
  drop column if exists telegram_join_requested,
  drop column if exists telegram_join_date,
  drop column if exists telegram_approved,
  drop column if exists telegram_approved_at,
  drop column if exists telegram_joined,
  drop column if exists telegram_joined_at,
  drop column if exists welcome_message_sent,
  drop column if exists welcome_message_sent_at,
  drop column if exists approval_notification_sent,
  drop column if exists approval_notification_sent_at,
  drop column if exists telegram_join_requested_at,
  drop column if exists telegram_join_approved_at;

commit;
