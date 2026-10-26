export type Role = 'attack' | 'defense';
export type Side = 'red' | 'blue';
export type Period = 'month' | 'year';
export type RankingMode = 'points' | 'strength';
export interface Player { id: string; auth_user_id: string | null; full_name: string; preferred_role: Role; avatar_path: string | null; }
export interface Participant { player_id: string; side: Side; role: Role | 'single'; }
export interface Match { id: string; created_at: string; added_by: string | null; red_score: number; blue_score: number; mvp_id: string | null; participants: Participant[]; }
export interface MatchInput { request_id: string; red_score: number; blue_score: number; mvp_id: string | null; participants: Participant[]; }
export interface Stats { played: number; wins: number; losses: number; points: number; mvps: number; winRate: number; strength: number; streak: number; bestStreak: number; goalsFor: number; goalsAgainst: number; companionId: string | null; companionGames: number; }
export type RankedPlayer = Player & Stats & { position: number };
export const roleLabel = (role: Role | 'single') => ({ attack: 'Attaccante', defense: 'Portiere', single: 'Singolo' })[role];
export const winner = (match: Pick<Match, 'red_score' | 'blue_score'>): Side => match.red_score > match.blue_score ? 'red' : 'blue';
export const italyDate = (date: string | Date, options: Intl.DateTimeFormatOptions = {}) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', ...options }).format(new Date(date));
export function inPeriod(match: Match, period: Period, now = new Date()) {
  const parts = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' }).formatToParts(d);
  const a = parts(new Date(match.created_at)), b = parts(now);
  const val = (p: Intl.DateTimeFormatPart[], key: string) => p.find(x => x.type === key)?.value;
  return val(a, 'year') === val(b, 'year') && (period === 'year' || val(a, 'month') === val(b, 'month'));
}
// Wilson lower bound, z = 1.28. The index rewards a reliable win rate;
// MVP count is a separate tie-breaker and is never counted as a victory.
export function strengthIndex(wins: number, games: number) {
  if (!games) return 0;
  const z = 1.28, p = wins / games, z2 = z * z;
  return Math.round(1000 * (p + z2 / (2 * games) - z * Math.sqrt((p * (1 - p) + z2 / (4 * games)) / games)) / (1 + z2 / games)) / 10;
}
export function getStats(playerId: string, matches: Match[]): Stats {
  const own = matches.filter(m => m.participants.some(p => p.player_id === playerId)).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  let wins = 0, mvps = 0, streak = 0, bestStreak = 0, goalsFor = 0, goalsAgainst = 0;
  const companions = new Map<string, number>();
  for (const match of own) {
    const me = match.participants.find(p => p.player_id === playerId)!;
    const won = winner(match) === me.side;
    if (won) { wins++; streak++; bestStreak = Math.max(streak, bestStreak); } else streak = 0;
    if (match.mvp_id === playerId) mvps++;
    goalsFor += me.side === 'red' ? match.red_score : match.blue_score;
    goalsAgainst += me.side === 'red' ? match.blue_score : match.red_score;
    for (const teammate of match.participants.filter(p => p.side === me.side && p.player_id !== playerId)) companions.set(teammate.player_id, (companions.get(teammate.player_id) || 0) + 1);
  }
  const companion = [...companions].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { played: own.length, wins, losses: own.length - wins, points: wins * 10 + mvps * 5, mvps, winRate: own.length ? Math.round(wins / own.length * 100) : 0, strength: strengthIndex(wins, own.length), streak, bestStreak, goalsFor, goalsAgainst, companionId: companion?.[0] || null, companionGames: companion?.[1] || 0 };
}
export function rankPlayers(players: Player[], matches: Match[], mode: RankingMode): RankedPlayer[] {
  return players.filter(p => p.auth_user_id).map(p => ({ ...p, ...getStats(p.id, matches) })).sort((a, b) => (mode === 'points' ? b.points - a.points : b.strength - a.strength) || b.mvps - a.mvps || b.played - a.played || a.full_name.localeCompare(b.full_name, 'it')).map((p, i) => ({ ...p, position: i + 1 }));
}
export function validateMatch(input: MatchInput) {
  if (!Number.isInteger(input.red_score) || !Number.isInteger(input.blue_score) || input.red_score < 0 || input.blue_score < 0 || input.red_score > 99 || input.blue_score > 99) return 'Inserisci gol interi da 0 a 99.';
  if (input.red_score === input.blue_score) return 'Niente pareggi: una squadra deve vincere.';
  const red = input.participants.filter(p => p.side === 'red'), blue = input.participants.filter(p => p.side === 'blue');
  if ((red.length !== 1 && red.length !== 2) || red.length !== blue.length || red.length + blue.length !== input.participants.length) return 'Scegli tutti i giocatori: 1 contro 1 oppure 2 contro 2.';
  if (new Set(input.participants.map(p => p.player_id)).size !== input.participants.length) return 'Ogni giocatore può partecipare una sola volta.';
  if (input.participants.some(p => !p.player_id)) return 'Completa le due squadre.';
  if (red.length === 2 && [red, blue].some(team => !team.some(p => p.role === 'attack') || !team.some(p => p.role === 'defense'))) return 'Ogni squadra deve avere un attaccante e un portiere.';
  if (red.length === 1 && input.participants.some(p => p.role !== 'single')) return 'Nell’1 contro 1 il ruolo è singolo.';
  if (input.mvp_id && !input.participants.some(p => p.player_id === input.mvp_id)) return 'L’MVP deve aver partecipato alla partita.';
  return null;
}
