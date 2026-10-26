import type { Match, Player } from './domain';
export const demoPlayers: Player[] = [
  ['diego', 'Diego Cogliati', 'attack'], ['giulia', 'Giulia Rossi', 'defense'], ['marco', 'Marco Bianchi', 'attack'], ['sara', 'Sara Ferrari', 'defense'], ['luca', 'Luca Colombo', 'attack'], ['ale', 'Alessandro Riva', 'defense'], ['francesca', 'Francesca Villa', 'attack'], ['matteo', 'Matteo Galli', 'defense']
].map(([id, full_name, preferred_role]) => ({ id, auth_user_id: id, full_name, preferred_role: preferred_role as Player['preferred_role'], avatar_path: null }));
export function makeDemoMatches(): Match[] {
  const result: Match[] = [];
  for (let i = 0; i < 32; i++) {
    const date = new Date(); date.setHours(13 - (i % 3), 10 + (i % 40), 0, 0); date.setDate(date.getDate() - Math.floor(i / 3));
    const combos = [['diego', 'giulia', 'marco', 'sara'], ['luca', 'ale', 'diego', 'giulia'], ['marco', 'matteo', 'francesca', 'sara'], ['diego', 'giulia', 'luca', 'ale'], ['francesca', 'matteo', 'marco', 'sara']];
    const c = combos[i % combos.length];
    const redWins = i % 4 !== 1;
    result.push({ id: `demo-${i}`, created_at: date.toISOString(), added_by: 'diego', red_score: redWins ? 10 : 6, blue_score: redWins ? 4 + i % 5 : 10, mvp_id: i % 3 === 0 ? c[redWins ? 0 : 2] : null, participants: c.map((id, j) => ({ player_id: id, side: j < 2 ? 'red' : 'blue', role: j % 2 === 0 ? 'attack' : 'defense' })) });
  }
  return result.sort((a,b) => b.created_at.localeCompare(a.created_at));
}
