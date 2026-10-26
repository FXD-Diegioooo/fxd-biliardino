begin;
alter table public.profiles add column banner_color text not null default 'blue'
  check (banner_color in ('blue','mint','peach','lilac','butter','rose'));
grant update(banner_color) on public.profiles to authenticated;

create function public.player_name_key(p_name text) returns text
language sql immutable strict parallel safe set search_path = '' as $$
  select lower(regexp_replace(trim(normalize(p_name,NFKC)), '[[:space:]]+', ' ', 'g'));
$$;
-- Creation fails safely if existing accounts have conflicting names.
-- Removed profiles don't reserve a name and may share their anonymized label.
create unique index profiles_unique_active_name on public.profiles(public.player_name_key(full_name))
  where auth_user_id is not null;

create function public.is_player_name_available(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select char_length(trim(normalize(p_name,NFKC))) between 2 and 60 and not exists(
    select 1 from public.profiles where auth_user_id is not null
      and auth_user_id is distinct from auth.uid()
      and public.player_name_key(full_name)=public.player_name_key(p_name)
  );
$$;
revoke all on function public.is_player_name_available(text) from public;
grant execute on function public.is_player_name_available(text) to anon,authenticated;

create or replace function public.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(auth_user_id,full_name) values(new.id,
    regexp_replace(trim(normalize(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Giocatore ' || left(new.id::text,8)),NFKC)), '[[:space:]]+', ' ', 'g'));
  return new;
end;
$$;
revoke all on function public.on_signup() from public,anon,authenticated;
-- Clear the Auth reference in the same statement as anonymization, so an
-- existing active name cannot prevent an administrator from removing an account.
create or replace function public.on_account_delete() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set auth_user_id=null,full_name='Giocatore rimosso',avatar_path=null where auth_user_id=old.id;
  return old;
end;
$$;
revoke all on function public.on_account_delete() from public,anon,authenticated;
commit;
