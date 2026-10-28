import { describe, expect, it } from 'vitest';
import { guestPlayers, GUEST_IDS } from '../src/lib/guests';
import { calculateStrength } from '../src/lib/strength';
import { getStats, rankPlayers, validateMatch } from '../src/lib/domain';
import type { Match, MatchInput, Player } from '../src/lib/domain';
const [g1,g2]=GUEST_IDS;
const players:Player[]=['a','b','c','d'].map(id=>({id,auth_user_id:id,full_name:id,avatar_path:null,banner_color:'blue',preferred_role:'both'}));
const game=(n:number,red:string[],blue:string[],won=true):Match=>({id:String(n),created_at:new Date(Date.UTC(2026,9,1,0,n)).toISOString(),added_by:'a',red_score:won?10:3,blue_score:won?3:10,mvp_id:null,participants:[...red.map((player_id,i)=>({player_id,side:'red' as const,role:red.length===1?'single' as const:i===0?'attack' as const:'defense' as const})),...blue.map((player_id,i)=>({player_id,side:'blue' as const,role:blue.length===1?'single' as const:i===0?'attack' as const:'defense' as const}))]});
const input=(red:string[],blue:string[]):MatchInput=>({...game(1,red,blue),request_id:'test'});
describe('ospiti',()=>{
  it('accetta uno o due ospiti nei doppi, anche nella stessa squadra, e uno nel singolo',()=>{
    for(const [red,blue] of [[['a',g1],['b','c']],[['a',g1],['b',g2]],[['a','b'],[g1,g2]],[['a'],[g1]]]) expect(validateMatch(input(red,blue))).toBeNull();
    expect(validateMatch(input([g1],[g2]))).toContain('al massimo un ospite');
    expect(validateMatch(input(['a',g1],['b',g1]))).toContain('una sola volta');
    expect(validateMatch({...input(['a'],[g1]),mvp_id:g1})).toContain('non può essere MVP');
  });
  it('non compare nelle classifiche e non diventa miglior compagno',()=>{
    const games=[game(1,['a',g1],['b',g2])];
    expect(rankPlayers([...players,...guestPlayers],games,'points')).toHaveLength(players.length);
    expect(getStats('a',games)).toMatchObject({played:1,wins:1,points:10,companionId:null});
  });
  it('usa la media di tutti gli iscritti, inclusi quelli senza partite, prima del match',()=>{
    const history=[game(1,['a'],['b']),{...game(2,['a'],['b']),mvp_id:'a'}];
    const before=calculateStrength(history,players),average=players.reduce((sum,p)=>sum+(before.get(p.id)?.rating??1000),0)/players.length;
    const expected=32*(1-1/(1+10**((average-1000)/400)));
    const after=calculateStrength([...history,game(3,['c'],[g1])],players);
    expect(after.get('c')!.rating).toBeCloseTo(1000+expected);
    expect(after.has(g1)).toBe(false);expect(after.has(g2)).toBe(false);
  });
  it('due ospiti hanno la stessa forza media, indipendente dalle loro partite precedenti',()=>{
    const history=[game(1,['a'],['b']),game(2,['a'],[g1])];
    const before=calculateStrength(history,players);
    const cBefore=before.get('c')?.rating??1000;
    const after=calculateStrength([...history,game(3,['c',g1],['d',g2])],players);
    expect(after.get('c')!.rating).toBeCloseTo(cBefore+16);
    expect(after.has(g1)).toBe(false);
  });
  it('gli account iscritti dopo la partita non cambiano la media storica dell’ospite',()=>{
    const history=[{...game(1,['a'],['b']),mvp_id:'a'},game(2,['c'],[g1])];
    const future={...players[0],id:'future',auth_user_id:'future',created_at:'2027-01-01T00:00:00Z'};
    expect(calculateStrength(history,[...players,future])).toEqual(calculateStrength(history,players));
  });
});
