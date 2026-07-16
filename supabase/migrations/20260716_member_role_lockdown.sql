begin;

update public.members set role = 'member' where role is distinct from 'member';
alter table public.members drop constraint if exists members_role_check;
alter table public.members
  add constraint members_role_check check (role = 'member');

commit;
