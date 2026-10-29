import { useMemo, useState } from 'react';
import { ArrowRight, Handshake, Shuffle, Sparkles, Swords } from 'lucide-react';
import type { Match, Player } from '../lib/domain';
import { roleLabel } from '../lib/domain';
import { suggestMatches } from '../lib/suggestions';
import type { MatchSuggestion } from '../lib/suggestions';
import { Avatar, Empty, Modal } from './Shared';

export function SuggestedMatch({ me, players, matches, onUse }: { me: Player; players: Player[]; matches: Match[]; onUse: (suggestion: MatchSuggestion) => void }) {
  const [open, setOpen] = useState(false), [index, setIndex] = useState(0);
  const suggestions = useMemo(() => suggestMatches(me.id, players, matches), [me.id, players, matches]);
  const suggestion = suggestions[index % Math.max(suggestions.length, 1)];
  const teammate = players.find(p => p.id === suggestion?.teammateId);
  return <>
    <section className="suggested-card"><span className="eyebrow"><Sparkles size={14} /> LA PROSSIMA SFIDA</span><h3>Con chi giochi la prossima?</h3><p>Compagni da conoscere e una partita da provare, scelti dal tuo storico.</p><button className="button secondary full" onClick={() => { setIndex(0); setOpen(true); }}>Suggerisci una partita <ArrowRight size={16} /></button></section>
    {open && <Modal title="La prossima sfida." wide onClose={() => setOpen(false)}>
      {!suggestion ? <Empty title="Il club sta prendendo forma." text="Serve almeno un altro giocatore registrato per proporti una partita." /> : <div className="suggested-match">
        <div className="suggestion-intro">{teammate ? <><Handshake size={25} /><div><span className="eyebrow">PROVA A GIOCARE CON</span><h3>{teammate.full_name}</h3></div><Avatar player={teammate} size="lg" /></> : <><Swords size={25} /><div><span className="eyebrow">UN SINGOLO DA PROVARE</span><h3>Un nuovo incontro.</h3></div></>}</div>
        <p className="subtle suggestion-reason">{suggestion.reason}</p>
        <div className="suggestion-facts">{teammate && <span className="pill blue">{suggestion.rolesFit ? 'Ruoli preferiti compatibili' : 'Un’occasione per cambiare ruolo'}</span>}<span className="pill neutral">{suggestion.gap <= 75 ? 'Forze vicine' : suggestion.gap <= 150 ? 'Sfida combattuta' : 'Una sfida da provare'}</span></div>
        <div className="suggested-teams">{(['red', 'blue'] as const).map(side => <section className={`suggested-team ${side}`} key={side}><h4><i /> Squadra {side === 'red' ? 'rossa' : 'blu'}</h4>{suggestion.participants.filter(p => p.side === side).map(participant => {
          const player = players.find(p => p.id === participant.player_id)!;
          return <div className="suggested-person" key={player.id}><Avatar player={player} size="sm" /><div><strong>{player.full_name}{player.id === me.id && <span className="you-tag">TU</span>}</strong><small>{roleLabel(participant.role)}</small></div></div>;
        })}</section>)}</div>
        {teammate && suggestion.sharedGames >= 3 && <p className="subtle suggestion-record">Insieme avete vinto {suggestion.winsTogether} partite su {suggestion.sharedGames}.</p>}
        {suggestion.provisional && <p className="subtle suggestion-note">Alcuni giocatori hanno ancora poche partite: l’equilibrio è una stima iniziale.</p>}
        <p className="subtle suggestion-note">Usa la proposta per precompilare la partita. Potrai cambiare giocatori e ruoli e aggiungere il risultato quando avrete giocato.</p>
        <div className="suggestion-actions">{suggestions.length > 1 && <button className="button secondary" onClick={() => setIndex(i => i + 1)}><Shuffle size={16} /> Altra proposta</button>}<button className="button primary" onClick={() => { setOpen(false); onUse(suggestion); }}>Usa questa proposta <ArrowRight size={16} /></button></div>
      </div>}
    </Modal>}
  </>;
}
