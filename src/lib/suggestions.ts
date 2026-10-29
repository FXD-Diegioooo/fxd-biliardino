import type { Match, Participant, Player, Role } from './domain';
import { isGuestId } from './guests';
import { getRelationships } from './relationships';
import { calculateStrength, STRENGTH } from './strength';

export interface MatchSuggestion {
  participants: Participant[];
  teammateId: string | null;
  sharedGames: number;
  winsTogether: number;
  rolesFit: boolean;
  gap: number;
  provisional: boolean;
  reason: string;
}
const roleCost = (p: Player, role: Role) => p.preferred_role === 'both' || p.preferred_role === role ? 0 : 1;
function assignPair(a: Player, b: Player) {
  const direct = roleCost(a, 'attack') + roleCost(b, 'defense');
  const reverse = roleCost(b, 'attack') + roleCost(a, 'defense');
  return direct <= reverse ? { attack: a, defense: b, cost: direct } : { attack: b, defense: a, cost: reverse };
}

export function suggestMatches(meId: string, players: Player[], matches: Match[]): MatchSuggestion[] {
  const active = players.filter(p => p.auth_user_id && !isGuestId(p.id)).sort((a, b) => a.id.localeCompare(b.id));
  const me = active.find(p => p.id === meId);
  if (!me) return [];
  const others = active.filter(p => p.id !== meId);
  if (!others.length) return [];
  const ratings = calculateStrength(matches, players);
  const rating = (p: Player) => ratings.get(p.id)?.rating ?? STRENGTH.initial;
  const history = getRelationships(meId, matches);
  const provisional = (ids: string[]) => ids.some(id => (ratings.get(id)?.played ?? 0) < STRENGTH.minMatches);
  if (others.length < 3) return others.map(opponent => {
    const played = history.get(opponent.id)?.against ?? 0;
    return { participants: [{ player_id: meId, side: 'red', role: 'single' }, { player_id: opponent.id, side: 'blue', role: 'single' }] as Participant[], teammateId: null, sharedGames: played, winsTogether: 0, rolesFit: true, gap: Math.abs(rating(me) - rating(opponent)), provisional: provisional([meId, opponent.id]), reason: played ? `Vi siete affrontati ${played} ${played === 1 ? 'volta' : 'volte'}. È il momento di una nuova sfida.` : 'Non vi siete ancora affrontati: un rivale da conoscere.' };
  }).sort((a, b) => a.sharedGames - b.sharedGames || a.gap - b.gap || a.participants[1].player_id.localeCompare(b.participants[1].player_id));

  // Consider the twelve least familiar/most role-compatible partners, then
  // find opponents across the entire roster. This bounds pair search cost.
  const partners = others.map(player => ({ player, pair: assignPair(me, player), history: history.get(player.id) }))
    .sort((a, b) => (a.history?.together ?? 0) - (b.history?.together ?? 0) || a.pair.cost - b.pair.cost || a.player.id.localeCompare(b.player.id)).slice(0, 12);
  const results: { suggestion: MatchSuggestion; cost: number; key: string }[] = [];
  for (const partner of partners) {
    const opponents = others.filter(p => p.id !== partner.player.id);
    const redAverage = (rating(me) + rating(partner.player)) / 2;
    let best: { pair: ReturnType<typeof assignPair>; gap: number; cost: number; key: string } | null = null;
    for (let i = 0; i < opponents.length; i++) for (let j = i + 1; j < opponents.length; j++) {
      const pair = assignPair(opponents[i], opponents[j]);
      const gap = Math.abs(redAverage - (rating(opponents[i]) + rating(opponents[j])) / 2);
      const familiarity = Math.min(history.get(opponents[i].id)?.against ?? 0, 20) + Math.min(history.get(opponents[j].id)?.against ?? 0, 20);
      const cost = gap / 10 + pair.cost * 12 + familiarity / 2;
      const key = `${opponents[i].id}:${opponents[j].id}`;
      if (!best || cost < best.cost || (cost === best.cost && key < best.key)) best = { pair, gap, cost, key };
    }
    if (!best) continue;
    const sharedGames = partner.history?.together ?? 0;
    const participants: Participant[] = [
      { player_id: partner.pair.attack.id, side: 'red', role: 'attack' },
      { player_id: partner.pair.defense.id, side: 'red', role: 'defense' },
      { player_id: best.pair.attack.id, side: 'blue', role: 'attack' },
      { player_id: best.pair.defense.id, side: 'blue', role: 'defense' },
    ];
    results.push({ cost: Math.min(sharedGames, 10) * 6 + partner.pair.cost * 12 + best.cost, key: partner.player.id,
      suggestion: { participants, teammateId: partner.player.id, sharedGames, winsTogether: partner.history?.winsTogether ?? 0, rolesFit: partner.pair.cost === 0, gap: best.gap, provisional: provisional(participants.map(p => p.player_id)), reason: sharedGames === 0 ? 'Non avete mai giocato nella stessa squadra. Un’intesa tutta da scoprire.' : `Avete giocato ${sharedGames} ${sharedGames === 1 ? 'partita insieme' : 'partite insieme'}: date un’altra occasione a questa coppia.` } });
  }
  return results.sort((a, b) => a.cost - b.cost || a.key.localeCompare(b.key)).map(result => result.suggestion);
}
