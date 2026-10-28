begin;
alter table public.match_participants add column preferred_role_at_match text;
-- Approximation for historical matches: freeze the preference known today once.
update public.match_participants mp set preferred_role_at_match=p.preferred_role
from public.profiles p where p.id=mp.player_id;
alter table public.match_participants alter column preferred_role_at_match set not null;
alter table public.match_participants add constraint participants_preference_check
  check (preferred_role_at_match in ('attack','defense','both'));
-- Read from the server-side profile, never trust a preference supplied by the client.
create function public.snapshot_match_preference() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select preferred_role into new.preferred_role_at_match from public.profiles where id=new.player_id;
  if new.preferred_role_at_match is null then raise exception 'Giocatore non disponibile.'; end if;
  return new;
end;
$$;
revoke all on function public.snapshot_match_preference() from public,anon,authenticated;
create trigger snapshot_match_preference before insert on public.match_participants
  for each row execute function public.snapshot_match_preference();
commit;
