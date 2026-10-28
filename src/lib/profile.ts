import { inPeriod, rankPlayers } from './domain';
import type { Match, Player } from './domain';
export const banners = [
  { id: 'blue', label: 'Blu' }, { id: 'mint', label: 'Salvia' },
  { id: 'peach', label: 'Pesca' }, { id: 'lilac', label: 'Lavanda' },
  { id: 'butter', label: 'Miele' }, { id: 'rose', label: 'Rosa' },
] as const;
export type BannerColor = typeof banners[number]['id'];
export const normalizeDisplayName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
export const nameKey = (name: string) => normalizeDisplayName(name).toLocaleLowerCase('it');
export const duplicateNameMessage = 'Questo nome è già utilizzato. Scegli un nome diverso per distinguerti nel club.';
export function leadingRankings(playerId: string, players: Player[], matches: Match[], now = new Date()): string[] {
  const titles: string[] = [];
  for (const period of ['month', 'year'] as const) {
    const selected = matches.filter(m => inPeriod(m, period, now));
    if (!selected.length) continue;
    for (const mode of ['points', 'strength'] as const) {
      const leader = rankPlayers(players, selected, mode)[0];
      if (leader?.id === playerId && leader.position === 1 && leader.played > 0) titles.push(`Primo per ${mode === 'points' ? 'punti' : 'forza'} ${period === 'month' ? 'questo mese' : 'quest’anno'}`);
    }
  }
  return titles;
}
