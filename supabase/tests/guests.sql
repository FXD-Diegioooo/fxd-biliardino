-- Execute in SQL Editor; all temporary users, matches and profiles are rolled back.
begin;
create temporary table guest_test_users as select gen_random_uuid() as auth_id, i from generate_series(1,4) i;
insert into auth.users(id,email,raw_user_meta_data,aud,role,email_confirmed_at)
select auth_id,auth_id::text||'@example.invalid',jsonb_build_object('full_name','Verifica Ospiti '||auth_id::text),'authenticated','authenticated',now() from guest_test_users;
alter table guest_test_users add column player_id uuid;
update guest_test_users t set player_id=p.id from public.profiles p where p.auth_user_id=t.auth_id;
grant select on guest_test_users to authenticated;
select set_config('request.jwt.claim.sub',(select auth_id::text from guest_test_users where i=1),true);
set local role authenticated;
do $$
declare ps uuid[]; gs uuid[]; payload jsonb; mid uuid; repeated uuid; request uuid:=gen_random_uuid(); rejected boolean; touched integer;
begin
 select array_agg(player_id order by i) into ps from guest_test_users;
 select array_agg(id order by id) into gs from public.profiles where is_guest;
 if array_length(gs,1)<>2 then raise exception 'FAIL guest count'; end if;
 payload:=jsonb_build_array(jsonb_build_object('player_id',ps[1],'side','red','role','attack'),jsonb_build_object('player_id',gs[1],'side','red','role','defense'),jsonb_build_object('player_id',ps[2],'side','blue','role','attack'),jsonb_build_object('player_id',gs[2],'side','blue','role','defense'));
 mid:=public.add_match(request,10,7,ps[1],payload);
 repeated:=public.add_match(request,10,7,ps[1],payload);
 if mid<>repeated or (select count(*) from public.match_participants where match_id=mid)<>4 then raise exception 'FAIL saved slots or retry'; end if;
 rejected:=false;begin perform public.add_match(gen_random_uuid(),10,7,gs[1],payload);exception when others then rejected:=true;end;
 if not rejected then raise exception 'FAIL guest MVP';end if;
 rejected:=false;begin perform public.add_match(gen_random_uuid(),10,7,null,jsonb_set(payload,'{3,player_id}',to_jsonb(gs[1])));exception when others then rejected:=true;end;
 if not rejected then raise exception 'FAIL repeated guest';end if;
 payload:=jsonb_set(payload,'{1,player_id}',to_jsonb(ps[3]));
 perform public.add_match(gen_random_uuid(),10,7,null,payload);
 payload:=jsonb_build_array(jsonb_build_object('player_id',ps[1],'side','red','role','attack'),jsonb_build_object('player_id',ps[2],'side','red','role','defense'),jsonb_build_object('player_id',gs[1],'side','blue','role','attack'),jsonb_build_object('player_id',gs[2],'side','blue','role','defense'));
 perform public.add_match(gen_random_uuid(),10,7,null,payload);
 payload:=jsonb_build_array(jsonb_build_object('player_id',ps[1],'side','red','role','single'),jsonb_build_object('player_id',gs[1],'side','blue','role','single'));
 perform public.add_match(gen_random_uuid(),10,7,null,payload);
 rejected:=false;begin perform public.add_match(gen_random_uuid(),10,7,null,jsonb_set(payload,'{0,player_id}',to_jsonb(gs[2])));exception when others then rejected:=true;end;
 if not rejected then raise exception 'FAIL two guests in single';end if;
 rejected:=false;begin perform public.add_match(gen_random_uuid(),10,7,null,jsonb_set(payload,'{1,player_id}',to_jsonb(gen_random_uuid())));exception when others then rejected:=true;end;
 if not rejected then raise exception 'FAIL missing player';end if;
 update public.profiles set full_name='Changed' where id=gs[1];get diagnostics touched=row_count;
 if touched<>0 then raise exception 'FAIL editable guest';end if;
 rejected:=false;begin update public.profiles set is_guest=true where id=ps[1];exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'FAIL client can mark guests';end if;
end $$;
reset role;
select 'Controlli ospiti, MVP, limiti e permessi superati' as risultato;
rollback;
