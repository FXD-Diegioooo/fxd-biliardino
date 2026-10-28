import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { pendingEmailAddress } from '../lib/account';
import type { CredentialChanges, CredentialResult } from '../lib/account';
import { Modal } from './Shared';
export function AccountSettings({ email, pendingEmail, demo, onClose, onUpdate }: {
  email: string; pendingEmail?: string; demo: boolean; onClose: () => void;
  onUpdate: (changes: CredentialChanges) => Promise<CredentialResult>;
}) {
  const [newEmail, setNewEmail] = useState(email), [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [current, setCurrent] = useState('');
  const [visible, setVisible] = useState(false), [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [repairing, setRepairing] = useState(false);
  const [change, setChange] = useState<'email' | 'password'>('email');
  function chooseChange(next: 'email' | 'password') {
    setChange(next); setRepairing(false); setNewEmail(email); setPassword(''); setRepeat(''); setCurrent(''); setVisible(false); setError('');
  }
  const [result, setResult] = useState<CredentialResult | null>(null);
  useEffect(() => { setNewEmail(email); setCurrent(''); setConfirming(false); }, [email]);
  const resultPendingEmail = pendingEmailAddress(email || result?.email, result?.pendingEmail);
  const emailChanged = change === 'email' && newEmail.trim().toLowerCase() !== email.toLowerCase();
  function review(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (change === 'email' && !emailChanged) { setError('Inserisci un’email diversa da quella attuale.'); return; }
    if (change === 'password' && !password) { setError('Inserisci la nuova password.'); return; }
    if (password && password.length < 8) { setError('La nuova password deve contenere almeno 8 caratteri.'); return; }
    if (password !== repeat) { setError('Le nuove password non coincidono.'); return; }
    if (password && password === current) { setError('La nuova password deve essere diversa da quella attuale.'); return; }
    if (!current) { setError('Inserisci la password attuale per confermare la tua identità.'); return; }
    setConfirming(true);
  }
  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const saved = await onUpdate({ email: emailChanged ? newEmail.trim().toLowerCase() : undefined, password: change === 'password' ? password : undefined, currentPassword: current });
      setPassword(''); setRepeat(''); setCurrent(''); setResult(saved);
    } catch (e) { setError(e instanceof Error ? e.message : 'Aggiornamento non riuscito. Riprova.'); }
    finally { setBusy(false); }
  }
  return <Modal title={repairing ? "Correggi la tua email." : "Email e password."} onClose={() => !busy && onClose()}>
    {result ? <div className="account-success"><ShieldCheck size={38} /><h3>{demo ? 'Modifiche simulate.' : 'Modifiche registrate.'}</h3>
      {result.passwordChanged && <p>La password è stata aggiornata{demo ? ' nella demo' : ''}.</p>}
      {resultPendingEmail ? <p>Il cambio email a <strong>{resultPendingEmail}</strong> è in attesa di conferma. Segui le istruzioni inviate via email; fino al completamento, il tuo indirizzo resta <strong>{result.email}</strong>.</p> : (emailChanged || result.pendingEmail) && <p>La tua email è ora <strong>{result.pendingEmail ? email : result.email}</strong>.</p>}
      {demo && <p className="subtle">Nessun account reale è stato modificato.</p>}
      <button className="button primary full" onClick={onClose}>Chiudi <Check size={18} /></button>
    </div> : confirming ? <div className="account-confirmation">
      <ShieldCheck size={34} /><h3>Vuoi davvero aggiornare le credenziali?</h3><p className="subtle">Controlla le modifiche prima di continuare.</p>
      <dl>{emailChanged && <><dt><Mail size={16} /> Nuova email</dt><dd>{newEmail.trim().toLowerCase()}</dd></>}{password && <><dt><KeyRound size={16} /> Password</dt><dd>Verrà impostata la nuova password.</dd></>}</dl>
      {emailChanged && !demo && <p className="subtle">Il nuovo indirizzo sarà attivo dopo la conferma via email.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="confirmation-actions"><button className="button secondary" disabled={busy} onClick={() => { setConfirming(false); setError(''); }}><ArrowLeft size={16} /> Torna indietro</button><button className="button primary" disabled={busy} onClick={save}>{busy ? 'Aggiornamento…' : 'Sì, aggiorna credenziali'}</button></div>
    </div> : <form onSubmit={review} className="account-form">
      <fieldset className="account-change-picker"><legend>Cosa vuoi modificare?</legend><div>{(['email', 'password'] as const).map(option => <label key={option}><input type="radio" name="credential-change" value={option} checked={change === option} onChange={() => chooseChange(option)} />{option === 'email' ? <Mail size={17} /> : <KeyRound size={17} />}<span>{option === 'email' ? 'Email' : 'Password'}</span></label>)}</div></fieldset>
      {repairing ? <p className="subtle">Hai usato un indirizzo inventato o non più accessibile? Inserisci una casella che puoi aprire. Mantieni lo stesso profilo, le partite e tutti i punti. Serve la password attuale.</p> : <><p className="subtle">Scegli cosa vuoi modificare. Per confermare serve la password attuale.</p><button type="button" className="text-button repair-email-link" onClick={() => { setChange('email'); setRepairing(true); setNewEmail(''); setPassword(''); setRepeat(''); setError(''); }}>Hai usato un’email fittizia? Correggila</button></>}
      {repairing && <p className="account-demo-note">Email attuale: <strong>{email}</strong>. Non creare un secondo account: correggi questo.</p>}
      {demo && <p className="account-demo-note">Modalità demo: usa dati di prova.</p>}
      {pendingEmailAddress(email, pendingEmail) && <p className="success">Hai un cambio email in attesa di conferma verso {pendingEmail}.</p>}
      {change === 'email' && <label>Nuova email<input type="email" required autoComplete="email" maxLength={254} value={newEmail} onChange={e => setNewEmail(e.target.value)} /></label>}
      {change === 'password' && <><label>Nuova password<div className="password-input"><input type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Almeno 8 caratteri" /><button type="button" aria-label={visible ? 'Nascondi nuova password' : 'Mostra nuova password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
      <label>Conferma nuova password<input type={visible ? 'text' : 'password'} autoComplete="new-password" required={Boolean(password)} value={repeat} onChange={e => setRepeat(e.target.value)} /></label></>}
      <label>Password attuale<input type="password" required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary full" type="submit">Conferma modifiche <ShieldCheck size={18} /></button>
    </form>}
  </Modal>;
}
