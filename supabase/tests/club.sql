-- Run as postgres in the Supabase SQL Editor. Everything is rolled back.
begin;
create temporary table club_test_players as
select gen_random_uuid() as auth_id, 'Club Test '||i as name from generate_series(1,4) i;
insert into auth.users(id,email,raw_user_meta_data,aud,role,email_confirmed_at)
select auth_id, auth_id::text||'@example.invalid',jsonb_build_object('full_name',name),'authenticated','authenticated',now() from club_test_players;
alter table club_test_players add column player_id uuid;
update club_test_players t set player_id=p.id from public.profiles p where p.auth_user_id=t.auth_id;
grant select on club_test_players to authenticated;
select set_config('request.jwt.claim.sub',(select auth_id::text from club_test_players where name='Club Test 1'),true);
set local role authenticated;
do $$
declare ps uuid[]; payload jsonb; mid uuid; repeated uuid; rid uuid; request uuid:=gen_random_uuid(); rejected boolean; total integer;
begin
  select array_agg(player_id order by name) into ps from club_test_players;
  if not public.is_club_member() then raise exception 'FAIL: signup profile or membership'; end if;
  payload:=jsonb_build_array(jsonb_build_object('player_id',ps[1],'side','red','role','attack'),jsonb_build_object('player_id',ps[2],'side','red','role','defense'),jsonb_build_object('player_id',ps[3],'side','blue','role','attack'),jsonb_build_object('player_id',ps[4],'side','blue','role','defense'));
  mid:=public.add_match(request,10,7,ps[1],payload);
  repeated:=public.add_match(request,10,7,ps[1],payload);
  if mid<>repeated or (select count(*) from public.matches where id=mid)<>1 or (select count(*) from public.match_participants where match_id=mid)<>4 then raise exception 'FAIL: atomic save or idempotency'; end if;
  rejected:=false; begin perform public.add_match(gen_random_uuid(),7,7,null,payload); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL: draw accepted'; end if;
  rejected:=false; begin perform public.add_match(gen_random_uuid(),10,7,gen_random_uuid(),payload); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL: outsider MVP accepted'; end if;
  rejected:=false; begin perform public.add_match(gen_random_uuid(),10,7,null,jsonb_set(payload,'{1,player_id}',to_jsonb(ps[1]))); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL: duplicate player accepted'; end if;
  rejected:=false; begin perform public.add_match(gen_random_uuid(),10,7,null,jsonb_set(payload,'{1,role}','"attack"')); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL: duplicate role accepted'; end if;
  rejected:=false; begin insert into public.matches(request_id,red_score,blue_score) values(gen_random_uuid(),10,7); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL: direct match insertion permitted'; end if;
  update public.profiles set full_name='Unauthorized' where id=ps[2]; get diagnostics total=row_count;
  if total<>0 then raise exception 'FAIL: other profile editable'; end if;
  update public.profiles set preferred_role='defense' where id=ps[1]; get diagnostics total=row_count;
  if total<>1 then raise exception 'FAIL: own profile not editable'; end if;
  rid:=public.report_match(mid,'Test: risultato non corretto');
  if public.report_match(mid,'Retry dello stesso problema')<>rid then raise exception 'FAIL: duplicate report'; end if;
  if (select count(*) from public.match_reports where id=rid)<>1 then raise exception 'FAIL: own report not readable'; end if;
  rejected:=false; begin perform 1 from public.segnalazioni_partite; exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL: admin inbox exposed'; end if;
  perform set_config('request.jwt.claim.sub',(select auth_id::text from club_test_players where name='Club Test 2'),true);
  if (select count(*) from public.match_reports where id=rid)<>0 then raise exception 'FAIL: report visible to another user'; end if;
  perform set_config('request.jwt.claim.sub',(select auth_id::text from club_test_players where name='Club Test 1'),true);
  for i in 1..4 loop
    repeated:=public.add_match(gen_random_uuid(),10,7,null,payload);
    perform public.report_match(repeated,'Test: ulteriore segnalazione');
  end loop;
  repeated:=public.add_match(gen_random_uuid(),10,7,null,payload);
  rejected:=false; begin perform public.report_match(repeated,'Test: oltre limite orario'); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL: report rate limit not enforced'; end if;
  payload:=jsonb_build_array(jsonb_build_object('player_id',ps[1],'side','red','role','single'),jsonb_build_object('player_id',ps[3],'side','blue','role','single'));
  perform public.add_match(gen_random_uuid(),10,0,null,payload);
end $$;
reset role;
-- Deletion is temporary: ROLLBACK below restores everything.
delete from auth.users where id=(select auth_id from club_test_players where name='Club Test 4');
do $$ begin
  if not exists(select 1 from public.profiles p join club_test_players t on t.player_id=p.id where t.name='Club Test 4' and p.auth_user_id is null and p.full_name='Giocatore rimosso') then raise exception 'FAIL: removed account history'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select auth_id::text from club_test_players where name='Club Test 4'),true);
set local role authenticated;
do $$ begin
  if public.is_club_member() or (select count(*) from public.matches)<>0 then raise exception 'FAIL: deleted account retains access'; end if;
end $$;
reset role;
rollback;
select 'OK: signup, 1v1, 2v2, atomic save, idempotency, scores, MVP, roles, RLS, reports, rate limit, account removal. All test data rolled back.' as result;
