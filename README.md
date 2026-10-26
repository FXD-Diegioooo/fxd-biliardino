# Fuoricampo — biliardino-fxd

Webapp mobile first per il club di biliardino. React, TypeScript, Vite e Supabase; pronta per Vercel.

## Avvio locale

```sh
npm ci
cp .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 4173
```

Nella copia di lavoro `.env.local` è già configurato con URL e chiave **pubblica** del progetto `cgadzajbqqqhjybblugg`. Il file è escluso dal versionamento. Senza configurazione è disponibile la demo esplicitamente separata dai dati reali; i dati demo vivono solo in memoria.

Variabili necessarie:

```text
VITE_SUPABASE_URL=https://cgadzajbqqqhjybblugg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chiave pubblica Publishable, oppure anon>
```

Le variabili `VITE_*` sono incluse nel browser: non inserire chiavi secret o service_role. L'app non ne richiede.

## Database

Lo schema iniziale è in `supabase/migrations/202610260001_club.sql`. È stato applicato al progetto indicato il 26 ottobre 2026. Non eseguirlo nuovamente sullo stesso schema. Su un nuovo progetto, eseguilo una sola volta nel SQL Editor oppure usa Supabase CLI con le migrazioni.

- `profiles`: nome, ruolo preferito e percorso avatar; creazione automatica al signup.
- `matches`: risultato, autore, data server, MVP e identificativo per evitare salvataggi duplicati.
- `match_participants`: giocatori e ruoli di ogni squadra.
- `match_reports`: segnalazioni, motivo, autore, data e stato.
- `segnalazioni_partite`: vista amministrativa con nomi, squadre, gol, motivo e stato.
- Bucket `avatars`: foto JPG/PNG/WebP fino a 2 MB; ogni utente può caricare e rimuovere solo i propri file. Le foto hanno URL pubblico.

Le tabelle hanno Row Level Security. Gli utenti non possono inserire direttamente partite e segnalazioni, né modificare/eliminare partite. Le funzioni `add_match` e `report_match` verificano l'identità autenticata, validano i dati e salvano atomicamente. Un account eliminato o bloccato non può continuare a leggere le tabelle tramite un vecchio token. I giocatori rimossi sono anonimizzati e le loro partite storiche rimangono consistenti.

### Consultare le segnalazioni

Apri il progetto Supabase → **Table Editor** → vista **segnalazioni_partite** (schema `public`). La vista mostra partita, risultato, partecipanti, autore della segnalazione e motivo. Se il Table Editor non elenca le viste, usa il SQL Editor:

```sql
select * from public.segnalazioni_partite
order by segnalata_il desc;
```

Per aggiornare lo stato, apri la tabella **match_reports** e modifica `status`:

- `pending`: da verificare;
- `reviewed`: verificata;
- `dismissed`: scartata.

La vista è riservata alla dashboard e ai servizi amministrativi, e non è leggibile dagli utenti dell'app. Ogni utente può inviare una segnalazione per partita e un massimo di 5 nuove segnalazioni all'ora. Un ritentativo non crea duplicati. Non ci sono invii email o Edge Functions da configurare.

### Rimuovere un account

Supabase → **Authentication → Users**: cerca l'indirizzo e rimuovi o blocca l'account. Se Supabase impedisce la rimozione perché l'utente possiede file, elimina prima i suoi file dalla cartella `avatars/<UID account>` in Storage. L'UID si trova in Authentication. Il profilo storico diventa “Giocatore rimosso”; le altre partite non sono cancellate. Per impedire nuove registrazioni dello stesso indirizzo, preferire il blocco dell'account alla sola eliminazione.

## Autenticazione e pubblicazione

Login e registrazione usano email e password. Il recupero password è implementato, ma per inviare messaggi a indirizzi esterni al team Supabase occorre configurare **Authentication → Emails → SMTP Settings**. Il servizio email predefinito di Supabase non è sufficiente per le registrazioni pubbliche con conferma. Riferimento: https://supabase.com/docs/guides/auth/auth-smtp

Per le prove la conferma email è stata disattivata su richiesta dell'utente. In questo caso l'indirizzo di registrazione non è verificato. Prima della pubblicazione decidere se attivare SMTP e riattivare **Confirm email**. Il recupero password richiede comunque un servizio email funzionante.

In **Authentication → URL Configuration** imposta il dominio Vercel definitivo come **Site URL** e aggiungi i redirect consentiti esatti, inclusa la pagina `/?recovery=1`. Sono già configurati per lo sviluppo `http://127.0.0.1:4173` e `http://localhost:4173`, e gli stessi indirizzi con `/?recovery=1`. Non usare wildcard generiche su domini di terzi.

Su Vercel:

1. Importa il repository o carica il progetto tramite Vercel CLI.
2. Seleziona il preset **Vite**; comando di build `npm run build`, output `dist`.
3. Aggiungi le due variabili ambiente pubbliche sopra indicate.
4. Pubblica e imposta il dominio finale in Supabase URL Configuration.

`vercel.json` include il fallback SPA e gli header di base. Non è necessario un server Node in produzione. Questa consegna non pubblica su Vercel.

## Classifiche e statistiche

- **Punti**: vittoria +10, sconfitta 0, MVP +5 anche nella squadra perdente.
- **Forza**: limite inferiore di Wilson, z=1,28, moltiplicato per 100 e arrotondato a un decimale. Premia buone medie sostenute da più partite: 1/1 → 37,9; 8/10 → 60,2. Nessuna partita → 0.
- In entrambe le classifiche, a parità del valore visualizzato, prima più MVP, poi più partite, infine il nome.
- Classifiche per mese e anno correnti, nel fuso `Europe/Rome`; statistiche del profilo su tutta la carriera, posizione e punti principali sull'anno corrente.
- Vittorie consecutive attuali e record personale; compagno con più partite nella stessa squadra; gol di squadra, vittorie/sconfitte e percentuale vittorie.
- Squadre rosse e blu, solo 1v1 o 2v2; nei doppi un attaccante e un portiere per squadra. Nei singoli il ruolo è “Singolo”.

Le regole sono consultabili dall'icona informativa della classifica. Ogni dettaglio partita mostra squadre, ruoli, risultato, MVP, data e autore dell'inserimento.

## Verifiche

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

10 test di dominio e 8 test di interfaccia su desktop e mobile. Per usare un Chromium già installato, imposta `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

`supabase/tests/club.sql` verifica sul vero PostgreSQL signup, permessi, inserimento atomico, idempotenza, ruoli, MVP, segnalazioni, limite orario e revoca accesso alla rimozione account. Va eseguito come `postgres` nel SQL Editor: usa dati di test con UUID casuali e termina con `ROLLBACK`, senza lasciare account, partite o segnalazioni di prova. È stato eseguito con esito positivo sul progetto remoto.

## Struttura

- `src/App.tsx`: sessione, caricamento dati, navigazione e operazioni Supabase.
- `src/lib/domain.ts`: classifiche, statistiche e validazione dei risultati.
- `src/components/`: accesso, classifica, partite, profilo e componenti condivisi.
- `src/styles.css`: stile responsive ispirato agli screenshot in `Esempio UI/`.

Il caricamento usa pagine da 500 righe per evitare il limite predefinito di Supabase; i calcoli sono nel client. Per un club aziendale è un punto di partenza semplice. Per volumi elevati conviene spostare aggregazioni e ricerca sul database.
