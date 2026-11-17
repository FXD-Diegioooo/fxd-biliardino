begin;

-- Bind the existing account once. Email/user metadata supplied by a browser
-- never grants privileges, and a future signup cannot inherit this role.
create table public.club_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.club_admins enable row level security;
revoke all on public.club_admins from public, anon, authenticated;
do $$
begin
  if (select count(*) from auth.users where lower(email) = 'cogliati.diego001@gmail.com') <> 1 then
    raise exception 'Account amministratore assente o ambiguo: nessun permesso assegnato.';
  end if;
  insert into public.club_admins(auth_user_id)
    select id from auth.users where lower(email) = 'cogliati.diego001@gmail.com';
end $$;

create function public.is_club_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_admins a
    join auth.users u on u.id = a.auth_user_id
    join public.profiles p on p.auth_user_id = u.id
    where u.id = auth.uid() and (u.banned_until is null or u.banned_until <= now())
  );
$$;
revoke all on function public.is_club_admin() from public, anon, authenticated;
grant execute on function public.is_club_admin() to authenticated;

-- Prevent a stale editor from overwriting another administrator's correction.
alter table public.matches add column revision integer not null default 0 check (revision >= 0);

create function public.admin_update_match(
  p_match_id uuid, p_expected_revision integer, p_red_score integer,
  p_blue_score integer, p_mvp_id uuid, p_participants jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_match public.matches;
  preferences jsonb;
  n integer; r integer; b integer;
begin
  if not public.is_club_admin() then
    raise exception 'Operazione riservata agli amministratori.' using errcode = '42501';
  end if;
  select * into current_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partita non disponibile. Ricarica lo storico.'; end if;
  if current_match.revision is distinct from p_expected_revision then
    raise exception 'La partita è stata modificata. Ricarica la pagina prima di riprovare.';
  end if;
  if p_red_score is null or p_blue_score is null or p_red_score not between 0 and 99
    or p_blue_score not between 0 and 99 or p_red_score = p_blue_score then
    raise exception 'Risultato non valido: gol da 0 a 99, senza pareggi.';
  end if;
  if jsonb_typeof(p_participants) is distinct from 'array' then raise exception 'Partecipanti non validi.'; end if;
  n := jsonb_array_length(p_participants);
  if n not in (2,4) then raise exception 'Sono ammesse solo partite 1 contro 1 o 2 contro 2.'; end if;
  if (select count(distinct x.player_id) from jsonb_to_recordset(p_participants) x(player_id uuid)) <> n then
    raise exception 'Ogni giocatore deve essere presente una sola volta.';
  end if;
  -- Retain historical participants whose accounts were removed or banned;
  -- any newly selected participant must be an active member or a guest.
  if exists (
    select 1 from jsonb_to_recordset(p_participants) x(player_id uuid, side text, role text)
    left join public.profiles p on p.id = x.player_id
    left join auth.users u on u.id = p.auth_user_id
    where p.id is null or x.side is null or x.side not in ('red','blue')
      or x.role is null or x.role not in ('single','attack','defense')
      or (not p.is_guest and (p.auth_user_id is null or u.id is null or u.banned_until > now())
        and not exists (select 1 from public.match_participants old where old.match_id = p_match_id and old.player_id = p.id))
  ) then raise exception 'Giocatore o ruolo non valido.'; end if;
  select count(*) filter (where side='red'), count(*) filter (where side='blue') into r,b
    from jsonb_to_recordset(p_participants) x(side text);
  if r <> n/2 or b <> n/2 then raise exception 'Le squadre devono avere lo stesso numero di giocatori.'; end if;
  if n=2 and exists (select 1 from jsonb_to_recordset(p_participants) x(role text) where role <> 'single') then
    raise exception 'Nel singolo il ruolo deve essere singolo.';
  end if;
  if n=4 and ((select count(*) from jsonb_to_recordset(p_participants) x(role text) where role='single') > 0
    or (select count(distinct (x.side,x.role)) from jsonb_to_recordset(p_participants) x(side text,role text)) <> 4) then
    raise exception 'Ogni squadra deve avere un attaccante e un portiere.';
  end if;
  if (select count(*) from jsonb_to_recordset(p_participants) x(player_id uuid)
      join public.profiles p on p.id=x.player_id where p.is_guest) > n/2 then
    raise exception 'Massimo un ospite nel singolo e due nel doppio.';
  end if;
  if p_mvp_id is not null and exists (select 1 from public.profiles where id=p_mvp_id and is_guest) then
    raise exception 'Un ospite non può essere MVP.';
  end if;
  if p_mvp_id is not null and not exists (select 1 from jsonb_to_recordset(p_participants) x(player_id uuid) where x.player_id=p_mvp_id) then
    raise exception 'L’MVP deve essere un partecipante.';
  end if;

  select jsonb_object_agg(player_id::text, preferred_role_at_match) into preferences
    from public.match_participants where match_id=p_match_id;
  update public.matches set red_score=p_red_score, blue_score=p_blue_score,
    mvp_id=p_mvp_id, revision=revision+1 where id=p_match_id;
  delete from public.match_participants where match_id=p_match_id;
  -- The existing insert trigger snapshots preferences for new participants.
  insert into public.match_participants(match_id,player_id,side,role)
    select p_match_id,player_id,side,role from jsonb_to_recordset(p_participants) x(player_id uuid,side text,role text);
  -- Keep the original preference for every retained historical participant,
  -- even when correcting their team/role. Client snapshots are always ignored.
  update public.match_participants mp set preferred_role_at_match = old.value
    from jsonb_each_text(preferences) old
    where mp.match_id=p_match_id and mp.player_id::text=old.key;
  update public.match_reports set status='reviewed' where match_id=p_match_id and status='pending';
  return (select to_jsonb(m) || jsonb_build_object('participants',
    (select jsonb_agg(to_jsonb(mp) order by mp.side,mp.role) from public.match_participants mp where mp.match_id=m.id))
    from public.matches m where m.id=p_match_id);
end;
$$;

create function public.admin_delete_match(p_match_id uuid, p_expected_revision integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_revision integer;
begin
  if not public.is_club_admin() then
    raise exception 'Operazione riservata agli amministratori.' using errcode = '42501';
  end if;
  select revision into current_revision from public.matches where id=p_match_id for update;
  if not found then raise exception 'Partita non disponibile. Ricarica lo storico.'; end if;
  if current_revision is distinct from p_expected_revision then
    raise exception 'La partita è stata modificata. Ricarica la pagina prima di riprovare.';
  end if;
  delete from public.match_reports where match_id=p_match_id;
  delete from public.match_participants where match_id=p_match_id;
  delete from public.matches where id=p_match_id;
  return p_match_id;
end;
$$;
revoke all on function public.admin_update_match(uuid,integer,integer,integer,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.admin_delete_match(uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_update_match(uuid,integer,integer,integer,uuid,jsonb) to authenticated;
grant execute on function public.admin_delete_match(uuid,integer) to authenticated;
-- Table-level write privileges and RLS remain unchanged for all app users.
commit;
