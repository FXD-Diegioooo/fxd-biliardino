const recoveryKey = 'fuoricampo-recovery-user';
export function savedRecoveryUser(): string | null { try { return sessionStorage.getItem(recoveryKey); } catch { return null; } }
export function rememberRecoveryUser(id: string) { try { sessionStorage.setItem(recoveryKey, id); } catch { /* The active recovery still works without storage. */ } }
export function clearRecoveryUser() { try { sessionStorage.removeItem(recoveryKey); } catch { /* No persistent marker to clear. */ } }
export function recoveryRequested() {
  return new URLSearchParams(window.location.search).get('recovery') === '1' || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery' || Boolean(savedRecoveryUser());
}
