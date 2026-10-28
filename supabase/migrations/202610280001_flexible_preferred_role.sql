begin;
-- Profile preference only. Match participants still have a single assigned role.
alter table public.profiles drop constraint if exists profiles_preferred_role_check;
alter table public.profiles add constraint profiles_preferred_role_check
  check (preferred_role in ('attack', 'defense', 'both'));
commit;
