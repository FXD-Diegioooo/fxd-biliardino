-- Run as postgres in SQL Editor after the migration. Every fixture and change
-- (including the temporary test administrator) is rolled back.
begin;
do $$
begin
  if (select count(*) from public.club_admins) <> 1 or not exists (
    select 1 from public.club_admins a join auth.users u on u.id=a.auth_user_id
    where lower(u.email)='cogliati.diego001@gmail.com'
  ) then raise exception 'FAIL initial administrator binding'; end if;
  if has_table_privilege('authenticated','public.club_admins','SELECT')
    or has_table_privilege('authenticated','public.club_admins','INSERT')
    or has_table_privilege('authenticated','public.matches','UPDATE')
    or has_table_privilege('authenticated','public.matches','DELETE')
    or has_function_privilege('anon','public.admin_delete_match(uuid,integer)','EXECUTE')
    or has_function_privilege('anon','public.admin_update_match(uuid,integer,integer,integer,uuid,jsonb)','EXECUTE') then
    raise exception 'FAIL privileges';
  end if;
end $$;
create temporary table admin_test_users as select gen_random_uuid() as auth_id, i from generate_series(1,4) i;
insert into auth.users(id,email,raw_user_meta_data,aud,role,email_confirmed_at)
select auth_id,auth_id::text||'@example.invalid',
  jsonb_build_object('full_name','Verifica Admin '||auth_id::text,'email','cogliati.diego001@gmail.com','is_admin',true),
  'authenticated','authenticated',now() from admin_test_users;
alter table admin_test_users add column player_id uuid;
update admin_test_users t set player_id=p.id from public.profiles p where p.auth_user_id=t.auth_id;
insert into public.club_admins select auth_id from admin_test_users where i=1;
create temporary table admin_test_matches(id uuid);
grant select on admin_test_users to authenticated;
grant select,insert on admin_test_matches to authenticated;

-- A regular member cannot self-promote or invoke administrative operations,
-- including when metadata contains the administrator's email and role.
select set_config('request.jwt.claim.sub',(select auth_id::text from admin_test_users where i=2),true);
set local role authenticated;
do $$
declare ps uuid[]; payload jsonb; mid uuid; rejected boolean;
begin
  if public.is_club_admin() then raise exception 'FAIL metadata grants admin'; end if;
  select array_agg(player_id order by i) into ps from admin_test_users;
  payload:=jsonb_build_array(
    jsonb_build_object('player_id',ps[1],'side','red','role','attack'),
    jsonb_build_object('player_id',ps[2],'side','red','role','defense'),
    jsonb_build_object('player_id',ps[3],'side','blue','role','attack'),
    jsonb_build_object('player_id',ps[4],'side','blue','role','defense'));
  mid:=public.add_match(gen_random_uuid(),10,7,ps[1],payload);
  insert into admin_test_matches values(mid);
  perform public.report_match(mid,'Partita di verifica amministrazione');
  rejected:=false; begin perform public.admin_update_match(mid,0,7,10,ps[3],payload); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL regular member edit'; end if;
  rejected:=false; begin perform public.admin_delete_match(mid,0); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL regular member delete'; end if;
  rejected:=false; begin insert into public.club_admins values(auth.uid()); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL self promotion'; end if;
end $$;
reset role;

-- Changing a profile after the match must not rewrite its historical snapshot.
update public.profiles set preferred_role='defense' where id=(select player_id from admin_test_users where i=1);
select set_config('request.jwt.claim.sub',(select auth_id::text from admin_test_users where i=1),true);
set local role authenticated;
do $$
declare ps uuid[]; payload jsonb; invalid jsonb; guest uuid:='00000000-0000-4000-8000-000000000001';
  mid uuid; saved jsonb; original public.matches; rejected boolean;
begin
  if not public.is_club_admin() then raise exception 'FAIL admin denied'; end if;
  select array_agg(player_id order by i) into ps from admin_test_users;
  select id into mid from admin_test_matches;
  select * into original from public.matches where id=mid;
  payload:=jsonb_build_array(
    jsonb_build_object('player_id',ps[1],'side','blue','role','defense','preferred_role_at_match','both'),
    jsonb_build_object('player_id',ps[2],'side','red','role','attack'),
    jsonb_build_object('player_id',ps[3],'side','red','role','defense'),
    jsonb_build_object('player_id',guest,'side','blue','role','attack','preferred_role_at_match','attack'));
  -- Invalid scores, duplicates, unbalanced teams, roles, unknown players,
  -- nonparticipant MVPs, guest MVPs, too many guests, null/nonarray payloads.
  for invalid in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('participants',payload,'red',10,'blue',10),
    jsonb_build_object('participants',payload,'red',-1,'blue',7),
    jsonb_build_object('participants',payload,'red',100,'blue',7),
    jsonb_build_object('participants',payload,'red',null,'blue',7),
    jsonb_build_object('participants',jsonb_set(payload,'{1,player_id}',to_jsonb(ps[1]))),
    jsonb_build_object('participants',jsonb_set(payload,'{1,side}','"blue"'::jsonb)),
    jsonb_build_object('participants',jsonb_set(payload,'{1,role}','"single"'::jsonb)),
    jsonb_build_object('participants',jsonb_set(payload,'{1,side}','null'::jsonb)),
    jsonb_build_object('participants',jsonb_set(payload,'{1,player_id}',to_jsonb(gen_random_uuid()))),
    jsonb_build_object('participants',payload,'mvp',ps[4]),
    jsonb_build_object('participants',payload,'mvp',guest),
    jsonb_build_object('participants',jsonb_build_array(payload->3,jsonb_set(payload->0,'{role}','"single"'::jsonb)),'mvp',ps[1]),
    jsonb_build_object('participants',jsonb_build_array(jsonb_build_object('player_id',guest,'side','red','role','single'),jsonb_build_object('player_id','00000000-0000-4000-8000-000000000002','side','blue','role','single'))),
    jsonb_build_object('participants',null), jsonb_build_object('participants','{}'::jsonb)
  )) loop
    rejected:=false;
    begin perform public.admin_update_match(mid,0,
      case when invalid ? 'red' then (invalid->>'red')::integer else 7 end,
      case when invalid ? 'blue' then (invalid->>'blue')::integer else 10 end,
      (invalid->>'mvp')::uuid,invalid->'participants');
    exception when others then rejected:=true; end;
    if not rejected then raise exception 'FAIL invalid edit accepted: %',invalid; end if;
  end loop;
  if (select revision from public.matches where id=mid)<>0 then raise exception 'FAIL invalid edit persisted'; end if;
  saved:=public.admin_update_match(mid,0,7,10,ps[1],payload);
  if saved->>'id'<>mid::text or (saved->>'revision')::integer<>1 or jsonb_array_length(saved->'participants')<>4 then raise exception 'FAIL returned state'; end if;
  if (select (created_at,added_by,request_id) is distinct from (original.created_at,original.added_by,original.request_id) from public.matches where id=mid) then raise exception 'FAIL historical identity changed'; end if;
  if (select preferred_role_at_match from public.match_participants where match_id=mid and player_id=ps[1])<>'attack' then raise exception 'FAIL historical preference changed'; end if;
  if (select preferred_role_at_match from public.match_participants where match_id=mid and player_id=guest)<>'both' then raise exception 'FAIL forged new snapshot accepted'; end if;
  if exists(select 1 from public.match_participants where match_id=mid and player_id=ps[4]) then raise exception 'FAIL old participant retained'; end if;
  -- A corrected match can switch to singles and remove its MVP.
  saved:=public.admin_update_match(mid,1,10,8,null,jsonb_build_array(
    jsonb_build_object('player_id',ps[1],'side','red','role','single'),
    jsonb_build_object('player_id',ps[2],'side','blue','role','single')));
  if (saved->>'revision')::integer<>2 or saved->>'mvp_id' is not null
    or jsonb_array_length(saved->'participants')<>2 then raise exception 'FAIL format change / remove MVP'; end if;
  rejected:=false; begin perform public.admin_update_match(mid,0,7,10,ps[1],payload); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL stale update'; end if;
  rejected:=false; begin perform public.admin_delete_match(mid,0); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL stale delete'; end if;
  rejected:=false; begin perform public.admin_delete_match(mid,null); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL null revision'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.match_reports where match_id in(select id from admin_test_matches) and status<>'reviewed') then raise exception 'FAIL pending report not reviewed'; end if;
end $$;

-- A blocked admin immediately loses both read-authorization and mutation rights.
update auth.users set banned_until=now()+interval '1 hour' where id=(select auth_id from admin_test_users where i=1);
set local role authenticated;
do $$ declare rejected boolean:=false; begin
  if public.is_club_admin() then raise exception 'FAIL banned admin recognized'; end if;
  begin perform public.admin_delete_match((select id from admin_test_matches),2); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL banned admin mutation'; end if;
end $$;
reset role;
update auth.users set banned_until=null where id=(select auth_id from admin_test_users where i=1);
set local role authenticated;
select public.admin_delete_match((select id from admin_test_matches),2);
reset role;
do $$ begin
  if exists(select 1 from public.matches where id in(select id from admin_test_matches))
    or exists(select 1 from public.match_participants where match_id in(select id from admin_test_matches))
    or exists(select 1 from public.match_reports where match_id in(select id from admin_test_matches)) then raise exception 'FAIL delete left related rows'; end if;
end $$;
delete from auth.users where id=(select auth_id from admin_test_users where i=1);
set local role authenticated;
do $$ begin
  if public.is_club_admin() then raise exception 'FAIL deleted account retains admin'; end if;
end $$;
reset role;
select 'OK: admin binding, permissions, validation, snapshots, revisions, reports, blocked admin and atomic deletion' as risultato;
rollback;
