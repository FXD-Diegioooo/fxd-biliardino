import { describe, expect, it } from 'vitest';
import { getStats, inPeriod, rankPlayers, strengthIndex, validateMatch } from '../src/lib/domain';
import type { Match, MatchInput, Player } from '../src/lib/domain';
const players: Player[] = ['a','b','c','d'].map(id => ({ id, auth_user_id:id, full_name:id, avatar_path:null, preferred_role:'attack' }));
const make = (n: number, won = true, mvp: string | null = null): Match => ({id:String(n),created_at:`2026-10-${String(n).padStart(2,'0')}T10:00:00Z`,added_by:'a',red_score:won?10:3,blue_score:won?3:10,mvp_id:mvp,participants:[{player_id:'a',side:'red',role:'attack'},{player_id:'b',side:'red',role:'defense'},{player_id:'c',side:'blue',role:'attack'},{player_id:'d',side:'blue',role:'defense'}]});
const input = (): MatchInput => ({...make(1),request_id:'request'});
describe('statistiche e classifiche', () => {
  it('conta vittorie, sconfitte, bonus MVP anche nella squadra perdente e streak', () => {
    const stats = getStats('a',[make(5,true,'a'),make(2,true),make(1,true),make(4,true),make(3,false,'a')]);
    expect(stats).toMatchObject({played:5,wins:4,losses:1,points:50,mvps:2,streak:2,bestStreak:2,companionId:'b',companionGames:5,goalsFor:43,goalsAgainst:22});
  });
  it('non confonde compagni e avversari o le partite singole',()=>{
    const m=make(1);m.participants=[{player_id:'a',side:'red',role:'single'},{player_id:'c',side:'blue',role:'single'}];
    expect(getStats('a',[m]).companionId).toBeNull();
  });
  it('premia una buona media consolidata rispetto a una sola vittoria',()=>{
    expect(strengthIndex(8,10)).toBeGreaterThan(strengthIndex(1,1));
    expect(strengthIndex(16,20)).toBeGreaterThan(strengthIndex(8,10));
    expect(strengthIndex(0,0)).toBe(0);expect(strengthIndex(0,10)).toBe(0);
  });
  it('gli MVP decidono a parità di forza',()=>{
    const games=[make(1,true,'b'),make(2,true,'b'),make(3,true,'a')];
    const ranked=rankPlayers(players,games,'strength');expect(ranked[0].id).toBe('b');expect(ranked[0].strength).toBe(ranked[1].strength);
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
