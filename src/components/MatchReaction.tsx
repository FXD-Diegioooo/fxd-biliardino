import type { CSSProperties } from 'react';
import { CloudRain, Frown, Trophy } from 'lucide-react';

const colors = ['#2b79f5', '#ffd35b', '#ef7b72', '#8fd7bc', '#b7a2ef'];

export function MatchReaction({ outcome }: { outcome: 'win' | 'loss' }) {
  const won = outcome === 'win';
  return <div className={`match-reaction ${outcome}`} data-outcome={outcome}>
    <div className="reaction-decoration" aria-hidden="true">
      {won && Array.from({ length: 72 }, (_, i) => <i className="confetti-piece" key={i} style={{
        left: `${(i * 37) % 100}%`, backgroundColor: colors[i % colors.length],
        '--delay': `${(i % 9) * 0.075}s`, '--duration': `${2 + (i % 5) * 0.15}s`,
        '--drift': `${(i % 2 ? 1 : -1) * (25 + i % 70)}px`, '--spin': `${(i % 2 ? 1 : -1) * (360 + i * 13)}deg`,
        borderRadius: i % 3 === 0 ? '50%' : '2px',
      } as CSSProperties} />)}
    </div>
    <div className="reaction-message" role="status">
      {won ? <Trophy className="reaction-trophy" size={34} aria-hidden="true" /> : <div className="sad-face" aria-hidden="true"><CloudRain size={30} /><Frown size={44} /><i className="sad-tear" /></div>}
      <strong>{won ? 'Questa è tua!' : 'Ci rifacciamo alla prossima.'}</strong>
      <span>{won ? 'Vittoria al tavolo. Si festeggia!' : 'Una sconfitta, una rivincita da giocare.'}</span>
    </div>
  </div>;
}
