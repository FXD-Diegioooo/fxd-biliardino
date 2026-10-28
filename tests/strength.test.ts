import { describe, expect, it } from 'vitest';
import { calculateStrength } from '../src/lib/strength';
import { getStats, rankPlayers } from '../src/lib/domain';
import type { Match, Player } from '../src/lib/domain';
const game = (n: number, red = ['a'], blue = ['b'], won = true, mvp: string | null = null): Match => ({
  id: String(n).padStart(3,'0'),created_at: new Date(Date.UTC(2026,9,1,0,n)).toISOString(),added_by:null,
  red_score: won ? 10 : 3,blue_score:won ? 3 : 10,mvp_id:mvp,
  participants:[...red.map(player_id=>({player_id,side:'red' as const,role:'attack' as const})),...blue.map(player_id=>({player_id,side:'blue' as const,role:'defense' as const}))],
});
const value = (games:Match[],id='a') => calculateStrength(games).get(id)!.rating;
describe('forza retroattiva a squadre',()=>{
  it('parte da 1000 e applica una variazione simmetrica in un incontro equilibrato',()=>{
    expect(value([game(1)])).toBe(1016);expect(value([game(1)],'b')).toBe(984);
    expect(getStats('absent',[])).toMatchObject({strength:1000,strengthQualified:false});
  });
  it('premia maggiormente una sorpresa e penalizza maggiormente una sconfitta da favoriti',()=>{
    const history=Array.from({length:8},(_,i)=>game(i+1));const before=value(history);
    const expectedWin=value([...history,game(9)]),unexpectedLoss=value([...history,game(9,['a'],['b'],false)]);
    expect(expectedWin-before).toBeLessThan(16);expect(before-unexpectedLoss).toBeGreaterThan(16);
    expect(value([...history,game(9,['a'],['b'],false)],'b')-value(history,'b')).toBeGreaterThan(16);
  });
  it('considera il compagno forte: la stessa vittoria vale meno nella squadra favorita',()=>{
    const history=Array.from({length:8},(_,i)=>game(i+1));
    const carried=value([...history,game(9,['c','a'],['d','b'])],'c');
    const upset=value([...history,game(9,['c','b'],['d','a'])],'c');
    expect(carried).toBeLessThan(1016);expect(upset).toBeGreaterThan(1016);
  });
  it('l’MVP migliora del 20% il risultato individuale senza trasformare una sconfitta in crescita',()=>{
    expect(value([game(1,['a'],['b'],true,'a')])).toBeCloseTo(1019.2);
    expect(value([game(1,['a'],['b'],false,'a')])).toBeCloseTo(987.2);
    expect(value([game(1,['a','c'],['b','d'],true,'a')],'c')).toBe(1016);
  });
  it('riproduce lo storico indipendentemente dall’ordine ricevuto e dalla posizione dei partecipanti',()=>{
    const games=[game(1),game(2,['a','c'],['b','d'],false,'d'),game(3,['c'],['a'],true,'c')];
    expect(calculateStrength([...games].reverse())).toEqual(calculateStrength(games));
    expect(calculateStrength(games.map(m=>({...m,participants:[...m.participants].reverse()})))).toEqual(calculateStrength(games));
    const tied=games.map(m=>({...m,created_at:games[0].created_at}));
    expect(calculateStrength([...tied].reverse())).toEqual(calculateStrength(tied));
  });
  it('le prime quattro partite valgono per il calcolo e la quinta sblocca il punteggio',()=>{
    const games=Array.from({length:5},(_,i)=>game(i+1));
    expect(getStats('a',games.slice(0,4)).strengthQualified).toBe(false);
    expect(getStats('a',games).strengthQualified).toBe(true);
    expect(getStats('a',games).strength).toBeGreaterThan(1016);
    const players=['a','b','c'].map(id=>({id,auth_user_id:id,full_name:id,preferred_role:'both',avatar_path:null,banner_color:'blue'} as Player));
    const ranked=rankPlayers(players,[...games,game(6,['c'],['b'])],'strength');
    expect(ranked.find(p=>p.id==='c')?.position).toBeNull();expect(ranked[0].id).toBe('a');
    expect(rankPlayers([{...players[0],auth_user_id:null},...players.slice(1)],games,'strength').some(p=>p.id==='a')).toBe(false);
    expect(calculateStrength(games).has('a')).toBe(true);
  });
});
