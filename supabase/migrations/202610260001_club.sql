begin;
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 60),
  preferred_role text not null default 'attack' check (preferred_role in ('attack','defense')),
  avatar_path text,
  created_at timestamptz not null default now()
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  red_score smallint not null check (red_score between 0 and 99),
  blue_score smallint not null check (blue_score between 0 and 99),
  mvp_id uuid references public.profiles(id),
  check (red_score <> blue_score),
  unique(added_by,request_id)
);
create table public.match_participants (
  match_id uuid not null references public.matches(id),
  player_id uuid not null references public.profiles(id),
  side text not null check (side in ('red','blue')),
  role text not null check (role in ('attack','defense','single')),
  primary key(match_id, player_id),
  unique(match_id, side, role)
);
create table public.match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id),
  reporter_id uuid not null references public.profiles(id),
  reason text not null check (char_length(trim(reason)) between 5 and 1000),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
  unique(match_id, reporter_id)
);
create index matches_created_at_idx on public.matches(created_at desc, id);
create index participants_player_idx on public.match_participants(player_id);
create index reports_reporter_time_idx on public.match_reports(reporter_id, created_at desc);
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.match_reports enable row level security;

create function public.is_club_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id=p.auth_user_id
    where p.auth_user_id=auth.uid() and (u.banned_until is null or u.banned_until <= now()));
$$;
revoke all on function public.is_club_member() from public, anon;
grant execute on function public.is_club_member() to authenticated;
create policy "Members read profiles" on public.profiles for select to authenticated using(public.is_club_member());
create policy "Members edit own profile" on public.profiles for update to authenticated
  using(auth_user_id=auth.uid() and public.is_club_member()) with check(auth_user_id=auth.uid() and public.is_club_member());
create policy "Members read matches" on public.matches for select to authenticated using(public.is_club_member());
create policy "Members read participants" on public.match_participants for select to authenticated using(public.is_club_member());
create policy "Members read own reports" on public.match_reports for select to authenticated
  using(public.is_club_member() and reporter_id in(select id from public.profiles where auth_user_id=auth.uid()));
revoke all on public.profiles, public.matches, public.match_participants, public.match_reports from anon, authenticated;
grant select on public.profiles, public.matches, public.match_participants, public.match_reports to authenticated;
grant update(full_name,preferred_role,avatar_path) on public.profiles to authenticated;
grant all on public.profiles, public.matches, public.match_participants, public.match_reports to service_role;

create function public.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(auth_user_id,full_name) values(new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Giocatore del club'),60));
  return new;
end;
$$;
create trigger club_signup after insert on auth.users for each row execute function public.on_signup();
create function public.on_account_delete() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set full_name='Giocatore rimosso',avatar_path=null where auth_user_id=old.id;
  return old;
end;
$$;
create trigger club_account_delete before delete on auth.users for each row execute function public.on_account_delete();
-- Also handle accounts created before applying the migration.
insert into public.profiles(auth_user_id,full_name)
select id,left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'),''),'Giocatore del club'),60) from auth.users
on conflict(auth_user_id) do nothing;

create function public.add_match(p_request_id uuid,p_red_score integer,p_blue_score integer,p_mvp_id uuid,p_participants jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; result uuid; n integer; r integer; b integer;
begin
  if not public.is_club_member() then raise exception 'Accedi al club per aggiungere una partita.'; end if;
  select id into actor from public.profiles where auth_user_id=auth.uid();
  if p_request_id is null then raise exception 'Identificativo richiesta mancante.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select id into result from public.matches where added_by=actor and request_id=p_request_id;
  if result is not null then return result; end if;
  if p_red_score is null or p_blue_score is null or p_red_score not between 0 and 99 or p_blue_score not between 0 and 99 or p_red_score=p_blue_score then raise exception 'Risultato non valido: gol da 0 a 99, senza pareggi.'; end if;
  if jsonb_typeof(p_participants) is distinct from 'array' then raise exception 'Partecipanti non validi.'; end if;
  n:=jsonb_array_length(p_participants);
  if n not in(2,4) then raise exception 'Sono ammesse solo partite 1 contro 1 o 2 contro 2.'; end if;
  if (select count(distinct x.player_id) from jsonb_to_recordset(p_participants) x(player_id uuid))<>n then raise exception 'Ogni giocatore deve essere presente una sola volta.'; end if;
  if exists(select 1 from jsonb_to_recordset(p_participants) x(player_id uuid,side text,role text)
    left join public.profiles p on p.id=x.player_id left join auth.users u on u.id=p.auth_user_id
    where p.auth_user_id is null or (u.banned_until is not null and u.banned_until>now()) or x.side is null or x.side not in('red','blue') or x.role is null or x.role not in('single','attack','defense')) then raise exception 'Giocatore o ruolo non valido.'; end if;
  select count(*) filter(where side='red'),count(*) filter(where side='blue') into r,b from jsonb_to_recordset(p_participants) x(side text);
  if r<>n/2 or b<>n/2 then raise exception 'Le squadre devono avere lo stesso numero di giocatori.'; end if;
  if n=2 and exists(select 1 from jsonb_to_recordset(p_participants) x(role text) where role<>'single') then raise exception 'Nel singolo il ruolo deve essere singolo.'; end if;
  if n=4 and ((select count(*) from jsonb_to_recordset(p_participants) x(role text) where role='single')>0 or
    (select count(distinct (x.side,x.role)) from jsonb_to_recordset(p_participants) x(side text,role text))<>4) then raise exception 'Ogni squadra deve avere un attaccante e un portiere.'; end if;
  if p_mvp_id is not null and not exists(select 1 from jsonb_to_recordset(p_participants) x(player_id uuid) where x.player_id=p_mvp_id) then raise exception 'L’MVP deve essere un partecipante.'; end if;
  insert into public.matches(request_id,added_by,red_score,blue_score,mvp_id) values(p_request_id,actor,p_red_score,p_blue_score,p_mvp_id) returning id into result;
  insert into public.match_participants(match_id,player_id,side,role) select result,player_id,side,role from jsonb_to_recordset(p_participants) x(player_id uuid,side text,role text);
  return result;
end;
$$;
revoke all on function public.add_match(uuid,integer,integer,uuid,jsonb) from public,anon;
grant execute on function public.add_match(uuid,integer,integer,uuid,jsonb) to authenticated;

-- The caller's identity is taken from Auth, never from user input.
create function public.report_match(p_match_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; report public.match_reports;
begin
  if not public.is_club_member() then raise exception 'Accedi al club per segnalare una partita.'; end if;
  select id into actor from public.profiles where auth_user_id=auth.uid();
  if p_reason is null or char_length(trim(p_reason)) not between 5 and 1000 then raise exception 'Descrivi il problema usando da 5 a 1000 caratteri.'; end if;
  if not exists(select 1 from public.matches where id=p_match_id) then raise exception 'Partita non disponibile.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  select * into report from public.match_reports where match_id=p_match_id and reporter_id=actor;
  if report.id is not null then return report.id; end if;
  if (select count(*) from public.match_reports where reporter_id=actor and created_at>now()-interval '1 hour')>=5 then raise exception 'Hai già inviato 5 segnalazioni nell’ultima ora. Riprova più tardi.'; end if;
  insert into public.match_reports(match_id,reporter_id,reason) values(p_match_id,actor,trim(p_reason)) returning * into report;
  return report.id;
end;
$$;
revoke all on function public.report_match(uuid,text) from public,anon;
grant execute on function public.report_match(uuid,text) to authenticated;
revoke all on function public.on_signup(),public.on_account_delete() from public,anon,authenticated;

-- Dashboard-only inbox. No access is granted to application users.
create view public.segnalazioni_partite with (security_invoker=true) as
select r.id as segnalazione_id,r.status as stato,r.created_at as segnalata_il,
  p.full_name as segnalata_da,r.reason as motivo,m.id as partita_id,
  m.created_at as partita_del,m.red_score as gol_rossi,m.blue_score as gol_blu,
  (select string_agg(p2.full_name || ' (' || case mp.role when 'attack' then 'attacco' when 'defense' then 'difesa' else 'singolo' end || ')', ', ' order by mp.role)
    from public.match_participants mp join public.profiles p2 on p2.id=mp.player_id where mp.match_id=m.id and mp.side='red') as squadra_rossa,
  (select string_agg(p2.full_name || ' (' || case mp.role when 'attack' then 'attacco' when 'defense' then 'difesa' else 'singolo' end || ')', ', ' order by mp.role)
    from public.match_participants mp join public.profiles p2 on p2.id=mp.player_id where mp.match_id=m.id and mp.side='blue') as squadra_blu,
  mvp.full_name as mvp
from public.match_reports r join public.matches m on m.id=r.match_id
join public.profiles p on p.id=r.reporter_id left join public.profiles mvp on mvp.id=m.mvp_id;
revoke all on public.segnalazioni_partite from public,anon,authenticated;
grant select on public.segnalazioni_partite to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "Upload own avatar" on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text and public.is_club_member());
create policy "Delete own avatar" on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text and public.is_club_member());
create policy "Read avatars" on storage.objects for select to authenticated using(bucket_id='avatars' and public.is_club_member());
commit;
