import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, LoaderCircle, LogOut, Plus, Search, Trophy, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Match, MatchInput, Player, PreferredRole } from './lib/domain';
import { italyDate, validateMatch, winner } from './lib/domain';
import { demoPlayers, makeDemoMatches } from './lib/demo';
import { Auth } from './components/Auth';
import { Avatar, Brand, Empty, MatchCard, MatchDetail } from './components/Shared';
import { NewMatch } from './components/NewMatch';
import { Leaderboard } from './components/Leaderboard';
import { Profile } from './components/Profile';
import { ThemeToggle } from './components/ThemeToggle';
import { duplicateNameMessage, nameKey, normalizeDisplayName } from './lib/profile';
import type { BannerColor } from './lib/profile';
import { guestPlayers } from './lib/guests';
import { MatchReaction } from './components/MatchReaction';
import { PullToRefresh } from './components/PullToRefresh';
import { pendingEmailAddress, updateCredentials } from './lib/account';
import type { CredentialChanges, CredentialResult } from './lib/account';
import { clearRecoveryUser, recoveryRequested, rememberRecoveryUser, savedRecoveryUser } from './lib/recovery';
type View = 'ranking' | 'matches' | 'profile';
async function fetchAll(table: 'profiles' | 'matches', select: string) {
  const all: unknown[] = []; let page = 0;
  while (true) {
    const { data, error } = await supabase!.from(table).select(select).order(table === 'matches' ? 'created_at' : 'id', { ascending: table !== 'matches' }).order('id').range(page * 500, (page + 1) * 500 - 1);
    if (error) throw error; all.push(...data); if (data.length < 500) break; page++;
  }
  return all;
}
function ClubApp() {
  const [user, setUser] = useState<User | null>(null), [authReady, setAuthReady] = useState(!supabase), [demo, setDemo] = useState(false), [recovery, setRecovery] = useState(recoveryRequested);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(savedRecoveryUser), [demoEmail, setDemoEmail] = useState('diego@example.invalid');
  const [players, setPlayers] = useState<Player[]>([]), [matches, setMatches] = useState<Match[]>([]), [loading, setLoading] = useState(false), [loadedFor, setLoadedFor] = useState<string | null>(null), [dataError, setDataError] = useState(''), [reload, setReload] = useState(0);
  const [view, setView] = useState<View>('ranking'), [profileId, setProfileId] = useState<string | null>(null), [newMatch, setNewMatch] = useState(false), [detail, setDetail] = useState<Match | null>(null), [toast, setToast] = useState('');
  const [reaction, setReaction] = useState<{ id: string; outcome: 'win' | 'loss' } | null>(null);
  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), 3400);
    return () => clearTimeout(timer);
  }, [reaction]);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 5000); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => { if (!live) return; if (event === 'PASSWORD_RECOVERY' && session) { setRecovery(true); setRecoveryUserId(session.user.id); rememberRecoveryUser(session.user.id); } if (event === 'SIGNED_OUT') { clearRecoveryUser(); setRecoveryUserId(null); } setUser(session?.user ?? null); setAuthReady(true); });
    supabase.auth.getSession().then(({ data, error }) => { if (!live) return; setUser(data.session?.user ?? null); setAuthReady(true); if (error) notify('Sessione scaduta. Accedi di nuovo.'); });
    return () => { live = false; subscription.unsubscribe(); };
  }, [notify]);
  useEffect(() => {
    if (!user || demo) return; let live = true; setLoading(true); setDataError(''); setPlayers([]); setMatches([]);
    Promise.all([fetchAll('profiles', '*'), fetchAll('matches', '*, participants:match_participants(player_id, side, role, preferred_role_at_match)')]).then(([p, m]) => { if (live) { setPlayers(p as Player[]); setMatches(m as Match[]); setLoadedFor(user.id); } }).catch(e => { if (live) setDataError(e.message || 'Impossibile caricare il club.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user?.id, demo, reload]);
  useEffect(() => {
    if (!supabase || !user || demo) return;
    let live = true;
    // Confirmation can happen in another tab: read the current Auth user,
    // rather than relying only on the locally cached session.
    async function syncAccount() {
      if (document.visibilityState === 'hidden') return;
      const { data, error } = await supabase!.auth.getUser();
      if (live && !error && data.user) {
        const fresh = data.user;
        setUser(current => current?.id === fresh.id ? fresh : current);
      }
    }
    void syncAccount();
    window.addEventListener('focus', syncAccount);
    document.addEventListener('visibilitychange', syncAccount);
    return () => { live = false; window.removeEventListener('focus', syncAccount); document.removeEventListener('visibilitychange', syncAccount); };
  }, [user?.id, demo, view]);
  const me = players.find(p => demo ? p.id === 'diego' : p.auth_user_id === user?.id);
  function startDemo() { setDemoEmail('diego@example.invalid'); setDemo(true); setPlayers([...demoPlayers, ...guestPlayers].map(p => ({ ...p }))); setMatches(makeDemoMatches().map(match => ({ ...match, participants: match.participants.map(p => ({ ...p, preferred_role_at_match: demoPlayers.find(player => player.id === p.player_id)?.preferred_role || 'both' })) }))); setView('ranking'); setProfileId(null); }
  function navigate(next: View) { setView(next); if (next === 'profile') setProfileId(me?.id || null); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function openProfile(id: string) { setProfileId(id); setView('profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function logout() { if (!demo && supabase) { const { error } = await supabase.auth.signOut(); if (error) { notify('Uscita non riuscita. Riprova.'); return; } } setDemo(false); setPlayers([]); setMatches([]); setUser(null); setReaction(null); setDetail(null); setNewMatch(false); setView('ranking'); }
  function reactToMatch(input: MatchInput) {
    const participant = input.participants.find(p => p.player_id === me?.id);
    setReaction(participant ? { id: input.request_id, outcome: participant.side === winner(input) ? 'win' : 'loss' } : null);
  }
  async function saveMatch(input: MatchInput) {
    const validation = validateMatch(input); if (validation) throw new Error(validation);
    if (!me) throw new Error('Profilo non disponibile. Ricarica la pagina.');
    if (demo) { setMatches(ms => [{ ...input, id: crypto.randomUUID(), added_by: me.id, created_at: new Date().toISOString(), participants: input.participants.map(p => ({ ...p, preferred_role_at_match: players.find(player => player.id === p.player_id)?.preferred_role || 'both' })) }, ...ms]); notify('Partita aggiunta alla demo. I punti sono aggiornati!'); reactToMatch(input); return; }
    const { data: id, error } = await supabase!.rpc('add_match', { p_request_id: input.request_id, p_red_score: input.red_score, p_blue_score: input.blue_score, p_mvp_id: input.mvp_id, p_participants: input.participants });
    if (error) throw new Error(error.message);
    const { data, error: fetchError } = await supabase!.from('matches').select('*, participants:match_participants(player_id, side, role, preferred_role_at_match)').eq('id', id).single();
    if (fetchError) throw new Error('La partita è salvata, ma non è stato possibile ricaricarla. Riprova: non verrà duplicata.');
    setMatches(ms => [data as Match, ...ms.filter(m => m.id !== id)].sort((a, b) => b.created_at.localeCompare(a.created_at))); notify('Partita aggiunta. La classifica è aggiornata!'); reactToMatch(input);
  }
  async function updateProfile(name: string, role: PreferredRole, banner: BannerColor, file?: File) {
    if (!me) return;
    name = normalizeDisplayName(name);
    if (players.some(p => p.auth_user_id && p.id !== me.id && nameKey(p.full_name) === nameKey(name))) throw new Error(duplicateNameMessage);
    if (!demo) { const { data, error } = await supabase!.rpc('is_player_name_available', { p_name: name }); if (error) throw new Error('Impossibile verificare il nome. Riprova.'); if (!data) throw new Error(duplicateNameMessage); }
    let avatar = me.avatar_path;
    if (demo) { if (file) avatar = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); }
    else {
      let newPath: string | null = null;
      if (file) { const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.type]; if (!ext || file.size > 2 * 1024 * 1024) throw new Error('Formato foto non supportato o dimensione oltre 2 MB.'); newPath = `${user!.id}/${crypto.randomUUID()}.${ext}`; const { error } = await supabase!.storage.from('avatars').upload(newPath, file, { contentType: file.type }); if (error) throw new Error(error.message); avatar = newPath; }
      const { error } = await supabase!.from('profiles').update({ full_name: name, preferred_role: role, banner_color: banner, avatar_path: avatar }).eq('id', me.id);
      if (error) { if (newPath) await supabase!.storage.from('avatars').remove([newPath]); throw new Error(error.code === '23505' ? duplicateNameMessage : error.message); }
      if (newPath && me.avatar_path) await supabase!.storage.from('avatars').remove([me.avatar_path]);
    }
    setPlayers(ps => ps.map(p => p.id === me.id ? { ...p, full_name: name, preferred_role: role, banner_color: banner, avatar_path: avatar } : p)); notify(demo ? 'Profilo aggiornato nella demo.' : 'Profilo aggiornato. Bel gioco!');
  }
  async function changeCredentials(changes: CredentialChanges): Promise<CredentialResult> {
    if (demo) { const email = changes.email || demoEmail; setDemoEmail(email); return { email, passwordChanged: Boolean(changes.password) }; }
    if (!user || !supabase) throw new Error('Accedi prima di modificare le credenziali.');
    return updateCredentials(supabase.auth, user.id, changes, window.location.origin);
  }
  function exitRecovery() {
    clearRecoveryUser(); setRecoveryUserId(null); setRecovery(false);
    window.history.replaceState(null, '', window.location.pathname);
  }
  async function report(match: Match, reason: string) {
    if (demo) { notify('Segnalazione simulata. Nella demo non vengono salvati dati online.'); return; }
    const { error } = await supabase!.rpc('report_match', { p_match_id: match.id, p_reason: reason.trim() });
    if (error) throw new Error(error.message || 'Invio non riuscito. Riprova: la segnalazione non verrà duplicata.');
  }
  if (!authReady) return <div className="loading-screen"><Brand /><LoaderCircle className="spin" /><p>Apriamo il club…</p></div>;
  if ((!user && !demo) || recovery) return <Auth onDemo={startDemo} recovery={recovery} recoveryValid={Boolean(user && recoveryUserId === user.id)} onExitRecovery={exitRecovery} onRecovered={() => { exitRecovery(); notify('Password aggiornata.'); }} />;
  if (loading || (!demo && user && loadedFor !== user.id && !dataError)) return <div className="loading-screen"><Brand /><LoaderCircle className="spin" /><p>Prepariamo il tavolo…</p></div>;
  if (dataError || !me) return <div className="loading-screen"><Brand /><CircleAlert size={32} /><h2>Il club non è ancora pronto.</h2><p>{dataError || 'Non è stato trovato il tuo profilo. Verifica di aver eseguito la configurazione del database.'}</p><button className="button primary" onClick={() => setReload(reload + 1)}>Riprova</button><button className="text-button" onClick={logout}>Torna all’accesso</button></div>;
  const profile = players.find(p => p.id === profileId) || me;
  return <div className="app-shell">{demo && <div className="demo-banner"><span><span className="status-dot" /> Modalità demo <span className="demo-banner-detail">· Dati di esempio, nessun salvataggio online</span></span><button onClick={logout}>Esci dalla demo <ArrowRight size={13} /></button></div>}<header className="site-header"><button className="brand-button" onClick={() => navigate('ranking')} aria-label="Fuoricampo, vai alla classifica"><Brand /></button><nav aria-label="Menu principale" className="desktop-nav"><button className={view === 'ranking' ? 'active' : ''} onClick={() => navigate('ranking')}><Trophy size={17} /> Classifica</button><button className={view === 'matches' ? 'active' : ''} onClick={() => navigate('matches')}><CalendarDays size={17} /> Partite</button></nav><div className="header-actions"><button className="button primary add-header" onClick={() => setNewMatch(true)}><Plus size={18} /> Aggiungi partita</button><ThemeToggle /><button className="user-button" onClick={() => navigate('profile')} aria-label="Il mio profilo"><Avatar player={me} size="sm" /></button><button className="icon-button logout-button" onClick={logout} aria-label="Esci dal tuo account"><LogOut size={18} /></button></div></header><main className="main-content">{view === 'ranking' && <Leaderboard players={players} matches={matches} me={me} onProfile={openProfile} onMatch={setDetail} onHistory={() => navigate('matches')} onNew={() => setNewMatch(true)} />}{view === 'matches' && <History players={players} matches={matches} onMatch={setDetail} onNew={() => setNewMatch(true)} />}{view === 'profile' && <Profile key={profile.id} player={profile} players={players} matches={matches} own={profile.id === me.id} onMatch={setDetail} onBack={() => navigate('ranking')} onUpdate={updateProfile} accountEmail={demo ? demoEmail : user?.email || ''} pendingEmail={demo ? undefined : pendingEmailAddress(user?.email, user?.new_email)} demo={demo} onCredentials={changeCredentials} />}</main><nav className="mobile-nav" aria-label="Menu mobile"><button className={view === 'ranking' ? 'active' : ''} onClick={() => navigate('ranking')}><Trophy size={21} /><span>Classifica</span></button><button className="mobile-add" onClick={() => setNewMatch(true)}><span><Plus size={23} /></span><span>Aggiungi</span></button><button className={view === 'matches' ? 'active' : ''} onClick={() => navigate('matches')}><CalendarDays size={21} /><span>Partite</span></button></nav>{newMatch && <NewMatch players={players} onClose={() => setNewMatch(false)} onSave={saveMatch} />}{detail && <MatchDetail match={detail} players={players} onClose={() => setDetail(null)} onReport={report} />}{reaction && !newMatch && !detail && <MatchReaction key={reaction.id} outcome={reaction.outcome} />}{toast && <div className="toast" role="status"><CheckCircle2 size={19} />{toast}<button className="icon-button small" aria-label="Chiudi notifica" onClick={() => setToast('')}><X size={16} /></button></div>}</div>;
}
function History({ players, matches, onMatch, onNew }: { players: Player[]; matches: Match[]; onMatch: (match: Match) => void; onNew: () => void }) {
  const [search, setSearch] = useState(''), [format, setFormat] = useState('all'), [period, setPeriod] = useState('all'), [limit, setLimit] = useState(12);
  const filtered = matches.filter(m => (format === 'all' || m.participants.length === Number(format)) && (period === 'all' || italyDate(m.created_at, { month: 'numeric', year: 'numeric' }) === italyDate(new Date(), { month: 'numeric', year: 'numeric' })) && (!search || m.participants.some(p => players.find(x => x.id === p.player_id)?.full_name.toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it')))));
  return <><header className="page-heading"><div><h1>Ogni gol,<br />una <span>storia.</span></h1><p className="subtle">Le vittorie, le rivincite e quelle da dimenticare.</p></div><button className="button primary" onClick={onNew}><Plus size={18} /> Nuova partita</button></header><div className="history-filters"><div className="search-field"><Search size={18} /><input aria-label="Cerca partite per giocatore" placeholder="Cerca un giocatore…" value={search} onChange={e => { setSearch(e.target.value); setLimit(12); }} /></div><select aria-label="Filtra formato" value={format} onChange={e => { setFormat(e.target.value); setLimit(12); }}><option value="all">Tutti i formati</option><option value="4">2 contro 2</option><option value="2">1 contro 1</option></select><select aria-label="Filtra periodo" value={period} onChange={e => { setPeriod(e.target.value); setLimit(12); }}><option value="all">Tutto lo storico</option><option value="month">Questo mese</option></select></div><div className="section-title history-count"><h2>Le partite del club</h2><span className="count-badge">{filtered.length}</span></div>{filtered.length ? <><div className="history-grid">{filtered.slice(0, limit).map(m => <MatchCard key={m.id} match={m} players={players} onClick={() => onMatch(m)} />)}</div>{filtered.length > limit && <button className="button secondary load-more" onClick={() => setLimit(limit + 12)}>Mostra altre partite</button>}</> : <Empty title="Nessuna partita qui, per ora." text={search ? 'Prova a cercare un altro giocatore o cambia i filtri.' : 'Aggiungi una partita e scrivi la prima pagina del club.'} />}</>;
}

export default function App() { return <PullToRefresh><ClubApp /></PullToRefresh>; }
