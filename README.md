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

- **Punti**: vittoria +10, sconfitta 0, MVP +3 anche nella squadra perdente.
- **Forza**: Elo a squadre da 1.000, aggiornato cronologicamente; 5 partite nel periodo per entrare in classifica. MVP +20% sul guadagno o −20% sulla perdita.
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

18 test di logica e 29 scenari di interfaccia eseguiti su desktop e mobile; il caso sui gesti nei popup viene saltato su desktop, dove il gesto è disattivato. Per usare un Chromium già installato, imposta `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

`supabase/tests/club.sql` verifica sul vero PostgreSQL signup, permessi, inserimento atomico, idempotenza, ruoli, MVP, segnalazioni, limite orario e revoca accesso alla rimozione account. Va eseguito come `postgres` nel SQL Editor: usa dati di test con UUID casuali e termina con `ROLLBACK`, senza lasciare account, partite o segnalazioni di prova. È stato eseguito con esito positivo sul progetto remoto.

## Struttura

- `src/App.tsx`: sessione, caricamento dati, navigazione e operazioni Supabase.
- `src/lib/domain.ts`: classifiche, statistiche e validazione dei risultati.
- `src/components/`: accesso, classifica, partite, profilo e componenti condivisi.
- `src/styles.css`: stile responsive ispirato agli screenshot in `Esempio UI/`.

Il caricamento usa pagine da 500 righe per evitare il limite predefinito di Supabase; i calcoli sono nel client. Per un club aziendale è un punto di partenza semplice. Per volumi elevati conviene spostare aggregazioni e ricerca sul database.

## Aggiornamento profili, tema e icone (26 ottobre 2026)

La migrazione `202610260002_profile_customization.sql` è già applicata al progetto remoto. Aggiunge sei colori di banner e l'indice univoco sui nomi degli account attivi. I nomi vengono confrontati ignorando maiuscole, spazi superflui e forme Unicode equivalenti; la protezione vale anche nei cambi di nome e nelle richieste concorrenti. Gli account rimossi non riservano un nome. Le email continuano a essere gestite e rese univoche da Supabase Auth, con messaggi di errore più chiari nell'app.

`supabase/tests/profile_customization.sql` verifica i nuovi vincoli, la disponibilità del nome, il salvataggio dei banner e i permessi. È stato eseguito con successo sul database remoto e termina con `ROLLBACK`.

Il tema segue il dispositivo finché non si usa il pulsante sole/luna; la scelta manuale è ricordata nel browser. La corona del profilo segnala il primo classificato in almeno una classifica corrente fra punti/forza e mese/anno, ed è assente quando non ci sono partite nel periodo.

Le icone includono SVG/ICO per il browser, PNG 180 per iOS e PNG 192/512 con manifest per Android e collegamenti alla home. `scripts/generate_icons.py` rigenera i PNG a partire dalla geometria del marchio (richiede Pillow). La configurazione Vercel esclude i file statici dalla riscrittura SPA, così manifest, icone e script del tema vengono serviti direttamente. Nessun service worker o comportamento offline viene aggiunto. Per un collegamento alla home già esistente può essere necessario rimuoverlo e aggiungerlo nuovamente per aggiornare l'icona memorizzata dal telefono.

## Aggiornamento mobile e credenziali (28 ottobre 2026)

Su telefoni e tablet touch con viewport fino a 1024 px, tirando verso il basso quando la pagina è già all'inizio appare l'indicatore di aggiornamento. Superata la soglia, al rilascio viene eseguito un vero `window.location.reload()`: sessione e dati Supabase vengono riletti. Gesti brevi, orizzontali, multitouch, campi di input, scorrimento interno e popup non attivano il reload. Il gesto è disponibile anche nella pagina di accesso e conserva il tema scelto nel browser.

Accanto a **Modifica profilo** è disponibile **Email e password**, soltanto nel proprio profilo. Si sceglie **Email** oppure **Password**: il modulo mostra solo i campi della modifica selezionata. Cambiando scelta, i dati non confermati vengono azzerati e viene inviata solo la modifica selezionata. Dopo aver inserito la password attuale, **Conferma modifiche** mostra un secondo passaggio con il riepilogo; nessuna richiesta di aggiornamento viene inviata prima di **Sì, aggiorna credenziali**.

L'app verifica la password attuale con un nuovo accesso e usa `supabase.auth.updateUser()`. Password e chiavi SMTP non sono salvate in `profiles`, nei log o nel codice del client. Il servizio Auth si occupa dell'hash della password e del controllo delle email duplicate. Un cambio email rimane in attesa fino alla conferma tramite i link inviati da Supabase; l'app non dichiara che l'indirizzo è già cambiato finché il servizio non lo conferma.

**Password dimenticata?** invia un link verso `/?recovery=1` sul dominio da cui si usa l’app. La schermata richiede la nuova password due volte e accetta il cambio soltanto con una sessione di recupero valida; i link scaduti o non validi permettono di richiederne un altro. Un marcatore della sessione di recupero, senza password o token aggiuntivi, consente di riprendere il modulo dopo un refresh. Le risposte alla richiesta di recupero non rivelano se un indirizzo è registrato.

Queste funzionalità non richiedono nuove tabelle o chiavi server nell'app. Il cambio password dal profilo funziona senza SMTP. Conferma del cambio email e recupero password richiedono invece il completamento della configurazione SMTP descritta in `docs/brevo-supabase.md`. Alla consegna del codice, l'invio reale delle email deve ancora essere verificato dopo il collegamento dell'account Brevo.

Nel pannello account, **Hai usato un’email fittizia? Correggila** apre un percorso dedicato alla sola email, richiedendo la password attuale. Mantiene lo stesso ID utente e quindi statistiche, partite e punti. Per completarlo senza accedere alla vecchia casella serve che **Secure email change** sia disattivato in Supabase: la nuova casella resta da verificare. La configurazione e il limite del recupero in caso di password dimenticata sono descritti nella guida Brevo.

## Preferenza di ruolo flessibile (28 ottobre 2026)

Nel profilo si può scegliere **Attaccante**, **Portiere** o **Entrambi**. La preferenza `both` appartiene al tipo `PreferredRole`; i ruoli assegnati nelle partite rimangono attacco/difesa nei doppi e singolo negli 1 contro 1.

La migrazione `202610280001_flexible_preferred_role.sql` è già applicata al progetto Supabase remoto. Il controllo `supabase/tests/flexible_preferred_role.sql` è stato eseguito con successo e termina con `ROLLBACK`, senza lasciare profili temporanei. Verifica le tre preferenze ammesse, il rifiuto dei valori non validi e il rifiuto di `both` come ruolo in partita.

## Forza retroattiva (28 ottobre 2026)

Il nuovo calcolo rilegge le partite già salvate, ordinate per istante di creazione e, a parità, ID. Non vengono sovrascritti risultati o record del database: basta distribuire il nuovo codice perché i dati esistenti siano ricalcolati. I giocatori rimossi contribuiscono alle valutazioni storiche degli avversari e dei compagni, ma non compaiono nella classifica corrente.

`src/lib/strength.ts` definisce i parametri: base 1.000, K=32, scala Elo=400, soglia 5 partite, correttivo MVP=20%. Prima di ogni incontro si calcola la media dei rating di ciascuna squadra. Per i rossi: `E = 1 / (1 + 10^((mediaBlu-mediaRossi)/400))`, `delta = 32*(risultato-E)` con risultato 1 per vittoria e 0 per sconfitta. I blu ricevono la variazione opposta. Tutti gli aggiornamenti usano i valori precedenti alla partita. Il solo MVP moltiplica la propria variazione per 1,2 se positiva o per 0,8 se negativa; la sua sconfitta non diventa un guadagno. Il correttivo individuale rende questo adattamento intenzionalmente non a somma zero. Non si applicano bonus ai gol, ai ruoli o al formato.

Le prime quattro partite contribuiscono già alla forza interna ma il giocatore appare **In valutazione · X/5 partite**, senza posizione o podio di forza. Dalla quinta entra nella classifica ufficiale. I valori si espongono arrotondati a un decimale; a parità contano gli MVP, le presenze e il nome.

Le classifiche mensile e annuale ripartono ciascuna da 1.000 e richiedono 5 partite nel relativo periodo, mantenendo la selezione di calendario italiano esistente. La forza nel profilo usa invece tutta la carriera e richiede 5 partite totali. La classifica a punti resta vittoria +10 e MVP +3.
