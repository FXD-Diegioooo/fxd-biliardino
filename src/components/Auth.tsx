import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Brand } from './Shared';
import { ClubArt } from './ClubArt';
import { ThemeToggle } from './ThemeToggle';
import { duplicateNameMessage, normalizeDisplayName } from '../lib/profile';
export function Auth({ onDemo, recovery, recoveryValid, onRecovered, onExitRecovery }: {
  onDemo: () => void; recovery: boolean; recoveryValid: boolean; onRecovered: () => void; onExitRecovery: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [name, setName] = useState('');
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const settingPassword = recovery && recoveryValid, invalidRecovery = recovery && !recoveryValid;
  const requestingReset = !settingPassword && (mode === 'reset' || invalidRecovery);
  function changeMode(next: typeof mode) { setMode(next); setMessage(''); setError(''); setPassword(''); setRepeat(''); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setError(''); setMessage('');
    if (!supabase) { setError('Il club non è ancora collegato a Supabase. Nel frattempo puoi esplorare la demo.'); return; }
    if (mode === 'signup' && !recovery && normalizeDisplayName(name).length < 2) { setError('Inserisci un nome di almeno due caratteri.'); return; }
    if (settingPassword && password !== repeat) { setError('Le nuove password non coincidono.'); return; }
    setBusy(true);
    try {
      if (settingPassword) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword(''); setRepeat(''); onRecovered();
      } else if (requestingReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/?recovery=1` });
        if (error) throw error;
        setMessage('Se l’indirizzo è registrato, riceverai un link per scegliere una nuova password. Controlla anche la cartella spam.');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); if (error) throw error;
      } else {
        const available = await supabase.rpc('is_player_name_available', { p_name: normalizeDisplayName(name) });
        if (available.error) throw new Error('Impossibile verificare il nome. Riprova.');
        if (!available.data) throw new Error(duplicateNameMessage);
        const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: normalizeDisplayName(name) }, emailRedirectTo: window.location.origin } });
        if (error) {
          if (error.message.includes('Database error')) {
            const check = await supabase.rpc('is_player_name_available', { p_name: normalizeDisplayName(name) });
            if (check.data === false) throw new Error(duplicateNameMessage);
          }
          throw error;
        }
        if (!data.session) setMessage('Controlla la tua casella email e conferma la registrazione prima di accedere.');
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : '', code = (e as { code?: string })?.code;
      setError(code === 'email_address_not_authorized' || /error sending|smtp/i.test(text) ? 'Non è stato possibile inviare l’email. Contatta l’amministratore del club.'
        : text.includes('already registered') || text.includes('user_already_exists') ? 'Questa email è già registrata. Accedi con il tuo account.'
        : text.includes('Invalid login') ? 'Email o password non corrette.'
        : text.includes('Email not confirmed') ? 'Conferma il tuo indirizzo email prima di accedere.'
        : text.includes('rate limit') ? 'Troppe richieste. Attendi qualche minuto e riprova.'
        : code === 'same_password' ? 'Scegli una password diversa dalla precedente.'
        : code === 'weak_password' ? 'Scegli una password più sicura, di almeno 8 caratteri.'
        : settingPassword && ['bad_jwt', 'session_not_found', 'refresh_token_not_found'].includes(code || '') ? 'Il link non è più valido. Esci dal recupero e richiedi un nuovo link.'
        : text || 'Qualcosa non ha funzionato. Riprova.');
    } finally { setBusy(false); }
  }
  const title = settingPassword ? 'Nuova password.' : invalidRecovery ? 'Richiedi un nuovo link.' : mode === 'signup' ? 'Entra in squadra.' : requestingReset ? 'Si ricomincia.' : 'Pronto a giocare?';
  return <div className="auth-page">
    <div className="auth-brand"><Brand /></div><div className="auth-theme-toggle"><ThemeToggle /></div>
    <section className="auth-story"><span className="eyebrow"><span className="status-dot" /> IL TUO CLUB, SEMPRE IN GIOCO</span><h1>Le grandi sfide<br />iniziano in <span>pausa.</span></h1><p>Un tavolo, due squadre, mille rivincite.<br />Il resto lo teniamo noi.</p><ClubArt /><div className="auth-caption"><Trophy size={20} /><span>Piccole partite. <strong>Grandi rivalità.</strong></span></div><div className="art-sticker">Ci vediamo<br /><b>al prossimo gol!</b><span>↗</span></div></section>
    <section className="auth-form-section"><div className="auth-form-wrap">
      <span className="pill blue">BENVENUTO NEL CLUB</span><h2>{title}</h2>
      <p className="subtle">{settingPassword ? 'Scegli una password sicura per il tuo account.' : invalidRecovery ? 'Il link è scaduto o non è valido. Inserisci la tua email per riceverne un altro.' : mode === 'signup' ? 'Crea il tuo account. La prossima partita ti aspetta.' : requestingReset ? 'Ti invieremo un link per scegliere una nuova password.' : 'Accedi e scopri chi comanda al biliardino.'}</p>
      {!recovery && !requestingReset && <div className="segmented auth-tabs"><button className={mode === 'login' ? 'selected' : ''} onClick={() => changeMode('login')}>Accedi</button><button className={mode === 'signup' ? 'selected' : ''} onClick={() => changeMode('signup')}>Registrati</button></div>}
      <form onSubmit={submit}>
        {mode === 'signup' && !recovery && <label>Nome e cognome<input autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Come ti chiami?" /></label>}
        {!settingPassword && <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@azienda.it" /></label>}
        {!requestingReset && <label>{settingPassword ? 'Nuova password' : 'Password'}<div className="password-input"><input type={visible ? 'text' : 'password'} required minLength={mode === 'signup' || settingPassword ? 8 : 1} autoComplete={mode === 'signup' || settingPassword ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' || settingPassword ? 'Almeno 8 caratteri' : 'La tua password'} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Nascondi password' : 'Mostra password'}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>}
        {settingPassword && <label>Conferma nuova password<input type={visible ? 'text' : 'password'} required autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} /></label>}
        {mode === 'login' && !recovery && !requestingReset && <button type="button" className="text-button forgot" onClick={() => changeMode('reset')}>Password dimenticata?</button>}
        {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
        <button className="button primary full" disabled={busy}>{busy ? 'Un momento…' : settingPassword ? 'Salva password' : requestingReset ? 'Invia link di recupero' : mode === 'signup' ? 'Crea il tuo account' : 'Entra nel club'}<ArrowRight size={19} /></button>
      </form>
      {recovery ? <button className="text-button back-login" disabled={busy} onClick={onExitRecovery}>Esci dal recupero</button> : requestingReset && <button className="text-button back-login" onClick={() => changeMode('login')}>Torna al login</button>}
      {!recovery && <><div className="divider"><span>oppure dai un’occhiata</span></div><button className="button secondary full" onClick={onDemo}>Esplora la demo <ArrowRight size={17} /></button><p className="auth-note"><ShieldCheck size={15} /> La demo usa solo dati di esempio.</p></>}
    </div></section><footer className="auth-footer">Fatto per chi dice «l’ultima e poi torno a lavorare».</footer>
  </div>;
}
