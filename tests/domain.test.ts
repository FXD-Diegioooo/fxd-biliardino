import { describe, expect, it } from 'vitest';
import { getStats, inPeriod, rankPlayers, validateMatch } from '../src/lib/domain';
import type { Match, MatchInput, Player } from '../src/lib/domain';
const players: Player[] = ['a','b','c','d'].map(id => ({ id, auth_user_id:id, full_name:id, avatar_path:null, preferred_role:'attack', banner_color:'blue' }));
const make = (n: number, won = true, mvp: string | null = null): Match => ({id:String(n),created_at:`2026-10-${String(n).padStart(2,'0')}T10:00:00Z`,added_by:'a',red_score:won?10:3,blue_score:won?3:10,mvp_id:mvp,participants:[{player_id:'a',side:'red',role:'attack'},{player_id:'b',side:'red',role:'defense'},{player_id:'c',side:'blue',role:'attack'},{player_id:'d',side:'blue',role:'defense'}]});
const input = (): MatchInput => ({...make(1),request_id:'request'});
describe('statistiche e classifiche', () => {
  it('conta vittorie, sconfitte, bonus MVP anche nella squadra perdente e streak', () => {
    const stats = getStats('a',[make(5,true,'a'),make(2,true),make(1,true),make(4,true),make(3,false,'a')]);
    expect(stats).toMatchObject({played:5,wins:4,losses:1,points:46,mvps:2,streak:2,bestStreak:2,companionId:'b',companionGames:5,goalsFor:43,goalsAgainst:22});
  });
  it('non confonde compagni e avversari o le partite singole',()=>{
    const m=make(1);m.participants=[{player_id:'a',side:'red',role:'single'},{player_id:'c',side:'blue',role:'single'}];
    expect(getStats('a',[m]).companionId).toBeNull();
  });
  it('include nella forza ufficiale solo chi ha almeno cinque partite',()=>{
    expect(rankPlayers(players,[make(1),make(2),make(3),make(4)],'strength').every(p=>p.position===null)).toBe(true);
    const ranked=rankPlayers(players,[make(1,true,'b'),make(2),make(3),make(4),make(5)],'strength');
    expect(ranked[0].id).toBe('b');expect(ranked[0].position).toBe(1);expect(ranked[0].strength).toBeGreaterThan(ranked[1].strength);
  });
  it('esclude gli account rimossi dalla classifica conservando lo storico',()=>{
    expect(rankPlayers([{...players[0],auth_user_id:null},...players.slice(1)],[make(1)],'points').some(p=>p.id==='a')).toBe(false);
    expect(getStats('b',[make(1)]).wins).toBe(1);
  });
  it('usa il calendario italiano sui confini del mese e anno',()=>{
    const m={...make(1),created_at:'2026-10-31T23:30:00Z'};
    expect(inPeriod(m,'month',new Date('2026-11-01T12:00:00Z'))).toBe(true);
    expect(inPeriod({...m,created_at:'2025-12-31T23:30:00Z'},'year',new Date('2026-06-01'))).toBe(true);
    expect(inPeriod({...m,created_at:'2025-12-31T22:30:00Z'},'year',new Date('2026-06-01'))).toBe(false);
  });
});
describe('validazione partite',()=>{
  it('accetta una doppia completa',()=>expect(validateMatch(input())).toBeNull());
  it('rifiuta pareggi, score frazionari, negativi, mancanti e oltre limite',()=>{for(const score of [3,1.5,-1,NaN,100]){expect(validateMatch({...input(),red_score:score,blue_score:3})).toBeTruthy();}});
  it('rifiuta giocatori duplicati, estranei MVP e squadre non bilanciate',()=>{
    const duplicate=input();duplicate.participants[3].player_id='a';expect(validateMatch(duplicate)).toBeTruthy();
    expect(validateMatch({...input(),mvp_id:'outsider'})).toBeTruthy();
    expect(validateMatch({...input(),participants:input().participants.slice(0,3)})).toBeTruthy();
  });
  it('rifiuta ruoli duplicati e accetta soltanto singolo in 1v1',()=>{
    const doubled=input();doubled.participants[1].role='attack';expect(validateMatch(doubled)).toBeTruthy();
    const single=input();single.participants=[{player_id:'a',side:'red',role:'single'},{player_id:'c',side:'blue',role:'single'}];expect(validateMatch(single)).toBeNull();
    single.participants[0].role='attack';expect(validateMatch(single)).toBeTruthy();
  });
});

import { leadingRankings, nameKey, normalizeDisplayName } from '../src/lib/profile';
describe('identità e corone', () => {
  it('normalizza maiuscole, spazi e caratteri Unicode equivalenti', () => {
    expect(nameKey('  Ｄｉｅｇｏ　 Cogliati  ')).toBe(nameKey('diego cogliati'));
    expect(normalizeDisplayName('  Diego\t  Cogliati ')).toBe('Diego Cogliati');
  });
  it('assegna la corona ai primi di una qualsiasi delle quattro classifiche', () => {
    const games = [1,2,3,4,5].map(n=>make(n,true,'a'));
    expect(leadingRankings('a',players,games,new Date('2026-10-20'))).toHaveLength(4);
    expect(leadingRankings('b',players,games,new Date('2026-10-20'))).toEqual([]);
  });
  it('non assegna corone senza partite e considera anche il vincitore annuale fuori mese', () => {
    expect(leadingRankings('a',players,[],new Date('2026-11-20'))).toEqual([]);
    expect(leadingRankings('a',players,[make(1,true,'a')],new Date('2026-11-20'))).toHaveLength(1);
    expect(leadingRankings('a',players,[make(1,true,'a')],new Date('2027-01-20'))).toEqual([]);
  });
});
