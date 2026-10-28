# Email di conferma e recupero password con Brevo

Il provider scelto è Brevo, con il piano gratuito (alla verifica del 28 ottobre 2026: 300 invii al giorno, incluse le email transazionali). Nessun acquisto o piano a pagamento viene attivato da questo progetto.

## Configurazione da completare

1. Crea o accedi al tuo account gratuito Brevo e completa la verifica richiesta.
2. In **Settings → Senders, Domains, IPs**, configura il dominio di invio e un mittente verificato. Il nome visibile può essere **Fuoricampo**. Usa un indirizzo di cui puoi verificare la proprietà; `vercel.app` è il dominio del sito e non è automaticamente un dominio email sotto il tuo controllo.
3. Se usi un dominio tuo, completa i record DNS di autenticazione indicati da Brevo. Con Gmail verifica il mittente: non puoi modificare i DNS di gmail.com e Brevo può riscrivere automaticamente il mittente con un proprio dominio di invio. Il login tecnico SMTP non è l'indirizzo mittente.
4. In **Settings → SMTP & API → SMTP**, individua il login SMTP e genera personalmente una **SMTP key Standard**. Non usare la password dell'account o una API key. Copia la chiave solo nel campo password di Supabase, senza inserirla in chat, nel repository o nelle variabili `VITE_*`.
5. In Supabase → **Authentication → Emails → SMTP Settings**, abilita il servizio SMTP personalizzato e imposta:

| Campo | Valore |
|---|---|
| Sender email | L'indirizzo mittente verificato su Brevo |
| Sender name | Fuoricampo |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Il login SMTP mostrato da Brevo |
| Password | La SMTP key generata da te |

6. Salva la configurazione. Per la correzione delle email fittizie serve disattivare **Secure email change** in Authentication → Sign In / Providers → Email: verrà verificata solo la nuova casella, senza bloccare il cambio sulla vecchia inesistente. Impostazione disattivata e salvataggio confermato nel pannello il 28 ottobre 2026, su autorizzazione del proprietario; non è applicata dal codice. Non occorre modificare la scelta precedente sulla conferma alla registrazione.
7. In **Authentication → URL Configuration**, mantieni il **Site URL** scelto per il deploy e consenti `/?recovery=1` su ogni dominio effettivamente usato (inclusi gli alias `fxd-biliardino.vercel.app` e `fxd-biliardino-fxd-diego.vercel.app`), mantenendo i redirect già presenti. Per le prove locali deve restare consentito anche `http://127.0.0.1:4173/?recovery=1`.
8. Se Brevo segnala che l'invio transazionale non è attivo, completa l'attivazione indicata dal provider prima delle prove.

## Prova finale

- Dopo il deploy del codice, richiedi **Password dimenticata?** con un tuo account, ricevi l'email e imposta personalmente una nuova password. Verifica poi l'accesso.
- Prova il cambio email con un nuovo indirizzo di cui hai il controllo: prima della conferma resta valido quello precedente. Segui le istruzioni inviate ai relativi indirizzi.
- Se l'email non arriva, verifica le sezioni transazionali/log di Brevo e Auth logs di Supabase, oltre alla cartella spam.

Il codice è verificato con servizi Auth simulati; questo controllo di consegna reale richiede l'account e il mittente configurati. Non pubblicare le credenziali SMTP: restano esclusivamente nella configurazione server Supabase.

Fonti ufficiali: [Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [mittente Brevo](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

## Correzione di un’email fittizia

Dal proprio profilo → Email e password → **Hai usato un’email fittizia? Correggila**. Si inseriscono la nuova email e la password attuale, si conferma il riepilogo e poi si verifica la nuova casella. Non si crea un utente nuovo: l’ID, i punti e le partite rimangono associati allo stesso account. Il sistema non può sapere automaticamente se una casella esiste: la verifica del nuovo indirizzo dimostra che l’utente può ricevere le email.

Se l’utente ha anche dimenticato la password e non può ricevere email, il recupero automatico non può verificarne l’identità: serve assistenza manuale dell’amministratore, senza creare un account duplicato.
