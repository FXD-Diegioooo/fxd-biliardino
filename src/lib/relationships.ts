import type { Match, Player } from './domain';
import { winner } from './domain';
import { isGuestId } from './guests';

export interface Relationship { together: number; winsTogether: number; against: number; lossesAgainst: number; }
export function getRelationships(playerId: string, matches: Match[]): Map<string, Relationship> {
  const result = new Map<string, Relationship>();
  for (const match of matches) {
    const me = match.participants.find(p => p.player_id === playerId);
    if (!me) continue;
    const won = winner(match) === me.side;
    for (const participant of match.participants) {
      if (participant.player_id === playerId || isGuestId(participant.player_id)) continue;
      const pair = result.get(participant.player_id) ?? { together: 0, winsTogether: 0, against: 0, lossesAgainst: 0 };
      if (participant.side === me.side) { pair.together++; if (won) pair.winsTogether++; }
      else { pair.against++; if (!won) pair.lossesAgainst++; }
      result.set(participant.player_id, pair);
    }
  }
  return result;
}
export function getNemesis(playerId: string, players: Player[], matches: Match[]) {
  const relationships = getRelationships(playerId, matches);
  return players.filter(p => p.id !== playerId && p.auth_user_id && !isGuestId(p.id))
    .map(player => ({ player, ...relationships.get(player.id) }))
    .filter((p): p is { player: Player } & Relationship => Boolean(p.lossesAgainst))
    .sort((a, b) => b.lossesAgainst - a.lossesAgainst || b.against - a.against || a.player.full_name.localeCompare(b.player.full_name, 'it') || a.player.id.localeCompare(b.player.id))[0] ?? null;
}
