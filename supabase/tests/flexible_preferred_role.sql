begin;
do $$
declare player uuid;
begin
  insert into public.profiles(full_name, preferred_role)
    values ('Verifica preferenza temporanea', 'both') returning id into player;
  update public.profiles set preferred_role='attack' where id=player;
  update public.profiles set preferred_role='defense' where id=player;
  update public.profiles set preferred_role='both' where id=player;
  begin
    update public.profiles set preferred_role='invalid' where id=player;
    raise exception 'Un ruolo non valido è stato accettato';
  exception when check_violation then null;
  end;
  begin
    insert into public.match_participants(match_id, player_id, side, role)
      values (gen_random_uuid(), player, 'red', 'both');
    raise exception 'Entrambi è stato accettato come ruolo in partita';
  exception when check_violation then null;
  end;
end $$;
select 'Preferenza Entrambi accettata; ruoli delle partite verificati' as risultato;
rollback;
