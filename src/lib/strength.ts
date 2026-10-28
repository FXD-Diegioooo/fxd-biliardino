import type { Match } from './domain';

// Club rules, inspired by team Elo. MVP is a small individual adjustment,
// so ratings are intentionally not a zero-sum exchange.
export const STRENGTH = { initial: 1000, k: 32, scale: 400, minMatches: 5, mvpWeight: 0.2 } as const;
export interface StrengthRating { rating: number; played: number; }

export function calculateStrength(matches: Match[]): Map<string, StrengthRating> {
  const ratings = new Map<string, StrengthRating>();
  const get = (id: string) => ratings.get(id) ?? { rating: STRENGTH.initial, played: 0 };
  const ordered = [...matches].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  for (const match of ordered) {
    const red = match.participants.filter(p => p.side === 'red');
    const blue = match.participants.filter(p => p.side === 'blue');
    if (![1, 2].includes(red.length) || red.length !== blue.length || match.red_score === match.blue_score || new Set(match.participants.map(p => p.player_id)).size !== match.participants.length) continue;
    const average = (team: typeof red) => team.reduce((sum, p) => sum + get(p.player_id).rating, 0) / team.length;
    // Snapshot both teams before updating anyone: participant order has no effect.
    const expectedRed = 1 / (1 + 10 ** ((average(blue) - average(red)) / STRENGTH.scale));
    const redDelta = STRENGTH.k * ((match.red_score > match.blue_score ? 1 : 0) - expectedRed);
    for (const participant of match.participants) {
      const previous = get(participant.player_id);
      const delta = participant.side === 'red' ? redDelta : -redDelta;
      const adjusted = delta * (participant.player_id === match.mvp_id ? (delta > 0 ? 1 + STRENGTH.mvpWeight : 1 - STRENGTH.mvpWeight) : 1);
      ratings.set(participant.player_id, { rating: previous.rating + adjusted, played: previous.played + 1 });
    }
  }
  return ratings;
}
