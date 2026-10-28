-- All test users, profile changes and matches are rolled back.
begin;
create temporary table role_test_users as select gen_random_uuid() as auth_id, i from generate_series(1,2) i;
insert into auth.users(id,email,raw_user_meta_data,aud,role,email_confirmed_at)
select auth_id,auth_id::text||'@example.invalid',jsonb_build_object('full_name','Verifica Ruolo '||auth_id::text),'authenticated','authenticated',now() from role_test_users;
alter table role_test_users add column player_id uuid;
update role_test_users t set player_id=p.id from public.profiles p where p.auth_user_id=t.auth_id;
grant select on role_test_users to authenticated;
select set_config('request.jwt.claim.sub',(select auth_id::text from role_test_users where i=1),true);
set local role authenticated;
do $$
declare ps uuid[]; gs uuid[]; payload jsonb; mid uuid; next_mid uuid; request uuid:=gen_random_uuid(); rejected boolean;
begin
 select array_agg(player_id order by i) into ps from role_test_users;
 select array_agg(id order by id) into gs from public.profiles where is_guest;
 update public.profiles set preferred_role='defense' where id=ps[1];
 payload:=jsonb_build_array(jsonb_build_object('player_id',ps[1],'side','red','role','attack','preferred_role_at_match','attack'),jsonb_build_object('player_id',gs[1],'side','red','role','defense'),jsonb_build_object('player_id',ps[2],'side','blue','role','attack'),jsonb_build_object('player_id',gs[2],'side','blue','role','defense'));
 mid:=public.add_match(request,10,7,ps[1],payload);
 if (select preferred_role_at_match from public.match_participants where match_id=mid and player_id=ps[1])<>'defense' then raise exception 'FAIL server snapshot or forged preference';end if;
 if (select count(*) from public.match_participants where match_id=mid and player_id=any(gs) and preferred_role_at_match='both')<>2 then raise exception 'FAIL guest preference';end if;
 update public.profiles set preferred_role='attack' where id=ps[1];
 if public.add_match(request,10,7,ps[1],payload)<>mid then raise exception 'FAIL retry';end if;
 if (select preferred_role_at_match from public.match_participants where match_id=mid and player_id=ps[1])<>'defense' then raise exception 'FAIL history changed';end if;
 next_mid:=public.add_match(gen_random_uuid(),10,7,null,payload);
 if (select preferred_role_at_match from public.match_participants where match_id=next_mid and player_id=ps[1])<>'attack' then raise exception 'FAIL updated preference not captured';end if;
 rejected:=false;begin update public.match_participants set preferred_role_at_match='both' where match_id=mid;exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'FAIL client can edit history';end if;
end $$;
reset role;
select 'Snapshot server, storico immutato, retry e permessi verificati' as risultato;
rollback;
