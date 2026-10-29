import { describe, expect, it } from 'vitest';
import { getRelationships, getNemesis } from '../src/lib/relationships';
import { suggestMatches } from '../src/lib/suggestions';
import { validateMatch } from '../src/lib/domain';
import { guestPlayers, GUEST_IDS } from '../src/lib/guests';
import type { Match, Player } from '../src/lib/domain';
const players:Player[]=['a','b','c','d','e'].map((id,i)=>({id,auth_user_id:id,full_name:id.toUpperCase(),preferred_role:i%2?'defense':'attack',avatar_path:null,banner_color:'blue'}));
const game=(id:string,red:string[],blue:string[],won=false):Match=>({id,created_at:'2026-10-20T12:00:00Z',added_by:'a',red_score:won?10:4,blue_score:won?4:10,mvp_id:null,participants:[...red.map((player_id,i)=>({player_id,side:'red' as const,role:red.length===1?'single' as const:i===0?'attack' as const:'defense' as const})),...blue.map((player_id,i)=>({player_id,side:'blue' as const,role:blue.length===1?'single' as const:i===0?'attack' as const:'defense' as const}))]});
describe('relazioni e acerrimo nemico',()=>{
  it('conta ogni avversario nelle sconfitte senza confonderlo con il compagno',()=>{
    const matches=[game('1',['a','b'],['c','d']),game('2',['a'],['c']),game('3',['a','b'],['c','d'],true)];
    expect(getRelationships('a',matches).get('b')).toEqual({together:2,winsTogether:1,against:0,lossesAgainst:0});
    expect(getNemesis('a',players,matches)).toMatchObject({player:{id:'c'},lossesAgainst:2,against:3});
  });
  it('sceglie le sconfitte assolute, non il solo rateo, ed esclude ospiti e rimossi',()=>{
    const matches=[game('1',['a'],['b']),game('2',['a'],['c']),game('3',['a'],['c']),game('4',['a'],[GUEST_IDS[0]]),game('5',['a'],['c'],true)];
    expect(getNemesis('a',[...players,...guestPlayers],matches)?.player.id).toBe('c');
    expect(getNemesis('a',players.map(p=>p.id==='c'?{...p,auth_user_id:null}:p),matches)?.player.id).toBe('b');
    expect(getNemesis('a',players,[])).toBeNull();
    expect(getNemesis('a',players,[game('won',['a'],['b'],true)])).toBeNull();
  });
  it('risolve le parità con gli incontri contro e poi il nome in modo deterministico',()=>{
    const matches=[game('1',['a'],['b']),game('2',['a'],['c']),game('3',['a'],['c'],true)];
    expect(getNemesis('a',players,matches)?.player.id).toBe('c');
    expect(getNemesis('a',[...players].reverse(),matches.slice(0,2))?.player.id).toBe('b');
  });
});
describe('partite suggerite',()=>{
  it('produce doppi validi senza duplicati, ospiti o utenti rimossi e include sempre il richiedente',()=>{
    const roster=[...players,{...players[0],id:'removed',auth_user_id:null},...guestPlayers];
    const proposals=suggestMatches('a',roster,[]);
    expect(proposals.length).toBeGreaterThan(1);
    for(const proposal of proposals){
      expect(proposal.participants).toHaveLength(4);
      expect(proposal.participants.some(p=>p.player_id==='a')).toBe(true);
      expect(proposal.participants.some(p=>p.player_id==='removed'||GUEST_IDS.some(id=>id===p.player_id))).toBe(false);
      expect(validateMatch({...proposal,request_id:'suggestion',red_score:10,blue_score:7,mvp_id:null})).toBeNull();
    }
  });
  it('privilegia compagni mai provati e ruoli compatibili a parità di forza',()=>{
    const matches=[game('1',['a','b'],['c','d'],true),game('2',['a','b'],['c','d'])];
    const proposal=suggestMatches('a',players,matches)[0];
    expect(proposal.teammateId).not.toBe('b');expect(proposal.sharedGames).toBe(0);expect(proposal.rolesFit).toBe(true);
    const me=proposal.participants.find(p=>p.player_id==='a')!;
    expect(me.role).toBe('attack');
  });
  it('trova avversari di forza vicina senza inventare statistiche per i nuovi iscritti',()=>{
    const roster=players.slice(0,4).map(p=>({...p,preferred_role:'both' as const}));
    const proposal=suggestMatches('a',roster,[])[0];expect(proposal.gap).toBe(0);expect(proposal.provisional).toBe(true);expect(proposal.sharedGames).toBe(0);
    expect(suggestMatches('a',[...roster].reverse(),[])).toEqual(suggestMatches('a',roster,[]));
  });
  it('bilancia un giocatore forte con uno più debole quando tutte le coppie sono nuove',()=>{
    const roster=players.slice(0,4).map(p=>({...p,preferred_role:'both' as const}));
    const history=Array.from({length:6},(_,i)=>game(String(i),['a'],['b'],true));
    const proposal=suggestMatches('a',roster,history)[0];expect(proposal.teammateId).toBe('b');expect(proposal.gap).toBeCloseTo(0);
  });
  it('con due o tre registrati propone singoli e con un solo utente non inventa partite',()=>{
    expect(suggestMatches('a',[players[0],...guestPlayers],[])).toEqual([]);
    expect(suggestMatches('missing',players,[])).toEqual([]);
    const single=suggestMatches('a',players.slice(0,2),[])[0];expect(single.teammateId).toBeNull();expect(single.participants.every(p=>p.role==='single')).toBe(true);
    expect(suggestMatches('a',players.slice(0,3),[])).toHaveLength(2);
    expect(validateMatch({...single,request_id:'single',red_score:10,blue_score:7,mvp_id:null})).toBeNull();
  });
});
