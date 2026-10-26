-- Run as postgres. No permanent test accounts or profile changes are retained.
begin;
create temporary table profile_test_users as select gen_random_uuid() as auth_id, i from generate_series(1,2) i;
insert into auth.users(id,email,raw_user_meta_data,aud,role,email_confirmed_at)
select auth_id,auth_id::text||'@example.invalid',jsonb_build_object('full_name','Profile Test '||auth_id::text),'authenticated','authenticated',now() from profile_test_users;
grant select on profile_test_users to authenticated,anon;
do $$
declare test_name text; email_value text; rejected boolean:=false;
begin
  select full_name into test_name from public.profiles where auth_user_id=(select auth_id from profile_test_users where i=1);
  begin
    insert into auth.users(id,email,raw_user_meta_data,aud,role) values(gen_random_uuid(),gen_random_uuid()::text||'@example.invalid',jsonb_build_object('full_name','  '||upper(replace(test_name,' ','   '))||'  '),'authenticated','authenticated');
  exception when unique_violation then rejected:=true; end;
  if not rejected then raise exception 'FAIL: duplicate signup name accepted'; end if;
  rejected:=false;
  select email into email_value from auth.users where id=(select auth_id from profile_test_users where i=1);
  begin
    insert into auth.users(id,email,raw_user_meta_data,aud,role) values(gen_random_uuid(),email_value,jsonb_build_object('full_name','Different '||gen_random_uuid()::text),'authenticated','authenticated');
  exception when unique_violation then rejected:=true; end;
  if not rejected then raise exception 'FAIL: duplicate email accepted'; end if;
  if public.player_name_key('  Ｍａｒｃｏ　 Rossi  ')<>'marco rossi' then raise exception 'FAIL: Unicode normalization'; end if;
end $$;
set local role anon;
do $$ declare existing text; begin
  select 'Profile Test '||auth_id::text into existing from profile_test_users where i=1;
  if public.is_player_name_available(existing) then raise exception 'FAIL: existing name publicly available'; end if;
  if not public.is_player_name_available('Available '||gen_random_uuid()::text) then raise exception 'FAIL: new name unavailable'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select auth_id::text from profile_test_users where i=1),true);
set local role authenticated;
do $$
declare self_id uuid; other_id uuid; other_name text; rejected boolean:=false; changed integer;
begin
  select id into self_id from public.profiles where auth_user_id=auth.uid();
  select p.id,p.full_name into other_id,other_name from public.profiles p join profile_test_users t on t.auth_id=p.auth_user_id where t.i=2;
  if not public.is_player_name_available((select full_name from public.profiles where id=self_id)) then raise exception 'FAIL: cannot retain own name'; end if;
  if public.is_player_name_available(other_name) then raise exception 'FAIL: another name marked available'; end if;
  begin update public.profiles set full_name=upper(other_name) where id=self_id; exception when unique_violation then rejected:=true; end;
  if not rejected then raise exception 'FAIL: rename to existing name accepted'; end if;
  update public.profiles set banner_color='lilac' where id=self_id;
  if (select banner_color from public.profiles where id=self_id)<>'lilac' then raise exception 'FAIL: own banner not saved'; end if;
  update public.profiles set banner_color='peach' where id=other_id;get diagnostics changed=row_count;
  if changed<>0 then raise exception 'FAIL: other banner editable'; end if;
  rejected:=false;begin update public.profiles set banner_color='unknown' where id=self_id;exception when check_violation then rejected:=true;end;
  if not rejected then raise exception 'FAIL: arbitrary banner accepted'; end if;
end $$;
reset role;
-- An active user with the anonymized label must not prevent account removal.
do $$ begin
  if not exists(select 1 from public.profiles where auth_user_id is not null and public.player_name_key(full_name)='giocatore rimosso') then
    insert into auth.users(id,email,raw_user_meta_data,aud,role) values(gen_random_uuid(),gen_random_uuid()::text||'@example.invalid','{"full_name":"Giocatore rimosso"}','authenticated','authenticated');
  end if;
  delete from auth.users where id=(select auth_id from profile_test_users where i=1);
  if not exists(select 1 from public.profiles where auth_user_id is null and full_name='Giocatore rimosso') then raise exception 'FAIL: account removal after name uniqueness'; end if;
end $$;
rollback;
select 'OK: duplicate names, duplicate emails, Unicode normalization, anonymous availability, own-name retention, rename protection, banner persistence and RLS. All test data rolled back.' as result;
