begin;
alter table public.profiles add column if not exists is_guest boolean not null default false;
alter table public.profiles add constraint profiles_guest_identity_check
  check (not is_guest or (auth_user_id is null and id in ('00000000-0000-4000-8000-000000000001'::uuid,'00000000-0000-4000-8000-000000000002'::uuid)));
insert into public.profiles(id,full_name,preferred_role,banner_color,is_guest)
values ('00000000-0000-4000-8000-000000000001','Ospite','both','blue',true),
       ('00000000-0000-4000-8000-000000000002','Ospite','both','blue',true);
-- Guest profiles have no Auth identity. Existing RLS permits no user to edit them.
create or replace function public.add_match(p_request_id uuid,p_red_score integer,p_blue_score integer,p_mvp_id uuid,p_participants jsonb)
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
    where p.id is null or (not p.is_guest and (p.auth_user_id is null or (u.banned_until is not null and u.banned_until>now()))) or x.side is null or x.side not in('red','blue') or x.role is null or x.role not in('single','attack','defense')) then raise exception 'Giocatore o ruolo non valido.'; end if;
  select count(*) filter(where side='red'),count(*) filter(where side='blue') into r,b from jsonb_to_recordset(p_participants) x(side text);
  if r<>n/2 or b<>n/2 then raise exception 'Le squadre devono avere lo stesso numero di giocatori.'; end if;
  if n=2 and exists(select 1 from jsonb_to_recordset(p_participants) x(role text) where role<>'single') then raise exception 'Nel singolo il ruolo deve essere singolo.'; end if;
  if n=4 and ((select count(*) from jsonb_to_recordset(p_participants) x(role text) where role='single')>0 or
    (select count(distinct (x.side,x.role)) from jsonb_to_recordset(p_participants) x(side text,role text))<>4) then raise exception 'Ogni squadra deve avere un attaccante e un portiere.'; end if;
  if (select count(*) from jsonb_to_recordset(p_participants) x(player_id uuid) join public.profiles p on p.id=x.player_id where p.is_guest) > n/2 then raise exception 'Massimo un ospite nel singolo e due nel doppio.'; end if;
  if p_mvp_id is not null and exists(select 1 from public.profiles where id=p_mvp_id and is_guest) then raise exception 'Un ospite non può essere MVP.'; end if;
  if p_mvp_id is not null and not exists(select 1 from jsonb_to_recordset(p_participants) x(player_id uuid) where x.player_id=p_mvp_id) then raise exception 'L’MVP deve essere un partecipante.'; end if;
  insert into public.matches(request_id,added_by,red_score,blue_score,mvp_id) values(p_request_id,actor,p_red_score,p_blue_score,p_mvp_id) returning id into result;
  insert into public.match_participants(match_id,player_id,side,role) select result,player_id,side,role from jsonb_to_recordset(p_participants) x(player_id uuid,side text,role text);
  return result;
end;
$$;
revoke all on function public.add_match(uuid,integer,integer,uuid,jsonb) from public,anon;
grant execute on function public.add_match(uuid,integer,integer,uuid,jsonb) to authenticated;

commit;
