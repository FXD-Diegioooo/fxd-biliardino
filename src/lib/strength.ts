import { isGuestId } from './guests';
import type { Match, Participant, Player } from './domain';

// Club rules, inspired by team Elo. MVP is a small individual adjustment,
// so ratings are intentionally not a zero-sum exchange.
export const STRENGTH = { initial: 1000, k: 32, scale: 400, minMatches: 5, mvpWeight: 0.2, offRoleWeight: 0.1 } as const;
export interface StrengthRating { rating: number; played: number; }

export function isOutOfPreferredRole(participant: Participant, doubles: boolean): boolean {
  return doubles && !isGuestId(participant.player_id)
    && (participant.preferred_role_at_match === 'attack' || participant.preferred_role_at_match === 'defense')
    && participant.role !== participant.preferred_role_at_match;
}

export function calculateStrength(matches: Match[], players?: Player[]): Map<string, StrengthRating> {
  const ratings = new Map<string, StrengthRating>();
  const get = (id: string) => ratings.get(id) ?? { rating: STRENGTH.initial, played: 0 };
  const fallbackIds = [...new Set(matches.flatMap(m => m.participants.map(p => p.player_id)))].filter(id => !isGuestId(id));
  const ordered = [...matches].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  for (const match of ordered) {
    const red = match.participants.filter(p => p.side === 'red');
    const blue = match.participants.filter(p => p.side === 'blue');
    if (![1, 2].includes(red.length) || red.length !== blue.length || match.red_score === match.blue_score || new Set(match.participants.map(p => p.player_id)).size !== match.participants.length) continue;
    const registered = players ? players.filter(p => p.auth_user_id && !isGuestId(p.id) && (!p.created_at || Date.parse(p.created_at) <= Date.parse(match.created_at))).map(p => p.id) : fallbackIds;
    const guestRating = registered.length ? registered.reduce((sum, id) => sum + get(id).rating, 0) / registered.length : STRENGTH.initial;
    const average = (team: typeof red) => team.reduce((sum, p) => sum + (isGuestId(p.player_id) ? guestRating : get(p.player_id).rating), 0) / team.length;
    // Snapshot both teams before updating anyone: participant order has no effect.
    const expectedRed = 1 / (1 + 10 ** ((average(blue) - average(red)) / STRENGTH.scale));
    const redDelta = STRENGTH.k * ((match.red_score > match.blue_score ? 1 : 0) - expectedRed);
    for (const participant of match.participants) {
      if (isGuestId(participant.player_id)) continue;
      const previous = get(participant.player_id);
      const delta = participant.side === 'red' ? redDelta : -redDelta;
      const modifier = (participant.player_id === match.mvp_id ? STRENGTH.mvpWeight : 0)
        + (isOutOfPreferredRole(participant, red.length === 2) ? STRENGTH.offRoleWeight : 0);
      const adjusted = delta * (delta > 0 ? 1 + modifier : 1 - modifier);
      ratings.set(participant.player_id, { rating: previous.rating + adjusted, played: previous.played + 1 });
    }
  }
  return ratings;
}
