import type { SupabaseClient } from '@supabase/supabase-js';
export interface CredentialChanges { email?: string; password?: string; currentPassword: string; }
export interface CredentialResult { email: string; pendingEmail?: string; passwordChanged: boolean; }
// A retained new_email value is not pending once it matches the active address.
export function pendingEmailAddress(email?: string, pending?: string): string | undefined {
  const candidate = pending?.trim();
  return candidate && candidate.toLowerCase() !== email?.trim().toLowerCase() ? candidate : undefined;
}
export function accountError(error: { code?: string; message?: string }): string {
  const code = error.code || '', message = error.message || '';
  if (['invalid_credentials', 'invalid_login_credentials'].includes(code) || /invalid login|current password.*incorrect|invalid current password/i.test(message)) return 'La password attuale non è corretta.';
  if (['email_exists', 'user_already_exists', 'email_address_already_exists'].includes(code) || /already registered|already.*email|email.*already/i.test(message)) return 'Questa email è già utilizzata da un altro account.';
  if (code === 'same_password') return 'La nuova password deve essere diversa da quella attuale.';
  if (code === 'weak_password') return 'La nuova password non soddisfa i requisiti. Usa almeno 8 caratteri e scegli una password più sicura.';
  if (code === 'email_address_invalid') return 'Inserisci un indirizzo email valido.';
  if (code === 'email_address_not_authorized' || /error sending|smtp/i.test(message)) return 'Non è stato possibile inviare l’email di conferma. Contatta l’amministratore del club.';
  if (code === 'over_email_send_rate_limit' || /rate limit|too many/i.test(message)) return 'Troppe richieste. Attendi qualche minuto e riprova.';
  if (['session_not_found', 'refresh_token_not_found', 'bad_jwt'].includes(code)) return 'Sessione scaduta. Accedi di nuovo prima di modificare le credenziali.';
  return 'Non è stato possibile aggiornare le credenziali. Riprova.';
}
export async function updateCredentials(
  auth: Pick<SupabaseClient['auth'], 'getUser' | 'signInWithPassword' | 'updateUser'>,
  userId: string, changes: CredentialChanges, origin: string,
): Promise<CredentialResult> {
  if (!changes.currentPassword || (!changes.email && !changes.password)) throw new Error('Indica le modifiche e inserisci la password attuale.');
  const { data: current, error: currentError } = await auth.getUser();
  if (currentError || !current.user?.email || current.user.id !== userId) throw new Error('Sessione scaduta. Accedi di nuovo.');
  // A fresh sign-in checks the current password for both email and password changes,
  // and satisfies Supabase's recent-session requirement without a reauthentication email.
  const { data: login, error: loginError } = await auth.signInWithPassword({ email: current.user.email, password: changes.currentPassword });
  if (loginError) throw new Error(accountError(loginError));
  if (login.user?.id !== userId) throw new Error('Impossibile verificare l’account. Accedi di nuovo.');
  const { data, error } = await auth.updateUser({
    ...(changes.email ? { email: changes.email.trim().toLowerCase() } : {}),
    ...(changes.password ? { password: changes.password, current_password: changes.currentPassword } : {}),
  }, { emailRedirectTo: origin });
  if (error) throw new Error(accountError(error));
  if (!data.user) throw new Error('Risposta del servizio non valida. Riprova.');
  const email = data.user.email || current.user.email;
  return { email, passwordChanged: Boolean(changes.password), pendingEmail: changes.email && email.toLowerCase() !== changes.email.trim().toLowerCase() ? changes.email.trim().toLowerCase() : undefined };
}
