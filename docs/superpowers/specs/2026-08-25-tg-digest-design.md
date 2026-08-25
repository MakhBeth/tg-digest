# tg-digest: design

Data: 2026-08-25
Stato: approvato in brainstorming, in attesa di review sulla spec scritta

## Cos'è

App web personale, interamente in-browser, che legge i gruppi Telegram di cui l'utente è membro (senza essere admin e senza bot), salva i messaggi in locale e usa un LLM per:

1. **Digest all'apertura**: riassunto per gruppo di tutto quello che è successo dall'ultima visita.
2. **Q&A on-demand**: domande libere sui messaggi di un periodo (es. "ci sono discussioni interessanti per uno che vuole fare UX engineering prodottizzato?").

Nessun backend: SPA statica, dati in IndexedDB, chiamate dirette a Telegram (MTProto via WebSocket) e all'LLM (Ollama locale o Anthropic).

## Vincoli e decisioni chiave

- **Accesso Telegram**: GramJS come user account (MTProto), non Bot API. L'utente crea `api_id`/`api_hash` su my.telegram.org; login con numero + codice + eventuale 2FA. Session string in localStorage.
- **Volumi**: pochi gruppi (2-5), storico utile di giorni/settimane. Quindi: niente embeddings, niente ricerca semantica. I messaggi del periodo entrano interi nel contesto del modello.
- **LLM configurabile, default locale**: un solo client OpenAI-compatible. `provider=ollama` punta a `http://localhost:11434` (richiede `OLLAMA_ORIGINS` per il CORS); `provider=anthropic` chiama l'API diretta da browser con header `anthropic-dangerous-direct-browser-access` e key dell'utente.
- **Niente scheduling server-side**: il digest si genera all'apertura dell'app, coprendo il periodo dall'ultimo digest. Nessun cron, nessun processo in background.
- **Solo testo**: media ignorati, al massimo placeholder tipo `[foto]`.

## Stack

Stesso stack di forfettAIro:

- Vite + React 18 + TypeScript, `vite-plugin-pwa`
- CSS Modules + `src/styles/theme.css` con i design token (niente Tailwind)
- Font via @fontsource, icone @hugeicons/react
- Stato: React Context (AppContext, ThemeContext) + `dexie-react-hooks` (`useLiveQuery`) per i dati
- DB: Dexie (IndexedDB)
- Markdown delle risposte LLM: `react-markdown`
- Test: Vitest

## Struttura

```
src/
  components/        # componenti con .module.css a fianco
  context/           # AppContext, ThemeContext
  hooks/
  lib/
    telegram/        # client GramJS, login, sync, lista dialoghi
    db/              # schema Dexie, query, pruning
    llm/             # client unico ollama/anthropic, costruzione prompt
  styles/            # theme.css
  types/
```

## Moduli

### lib/telegram

- `login(apiId, apiHash)`: flusso interattivo numero, codice, 2FA. Salva session string in localStorage.
- `listDialogs()`: dialoghi dell'account, per scegliere i gruppi da seguire.
- `syncGroup(groupId)`: scarica i messaggi con id maggiore di `groups.lastSyncedMsgId` e li scrive in `messages`; aggiorna `lastSyncedMsgId`. GramJS gestisce da solo i retry su `FLOOD_WAIT`.
- Session scaduta o revocata: si intercetta l'errore di auth e si torna allo stato onboarding.

### lib/db (Dexie)

- `groups`: `id` (chat id Telegram), `title`, `followed`, `lastSyncedMsgId`, `lastDigestAt`
- `messages`: chiave `[groupId+msgId]` unica, `date`, `senderName`, `text`, `replyToMsgId`
- `summaries`: `id`, `groupId` (null se multi-gruppo), `type` (`digest` | `question`), `question?`, `periodFrom`, `periodTo`, `text`, `model`, `createdAt`
- `settings`: key-value (provider, modello, anthropicKey, ollamaUrl, profilo personale, retentionDays)
- Pruning: alla partenza cancella i messaggi più vecchi di `retentionDays` (default 30).

### lib/llm

- Un client con interfaccia unica; il provider decide endpoint, header e nome modello.
- `summarize(messages, periodo, profilo)`: prompt "riassumi i thread principali, decisioni, link condivisi; segnala le cose rilevanti per: {profilo}".
- `ask(messages, domanda, profilo)`: messaggi formattati `[data] Nome: testo` nel contesto, poi domanda + profilo.
- Se i messaggi sforano il contesto: troncamento dal più vecchio, con nota esplicita nella risposta.

## Flussi

**Apertura app**: connetti a Telegram → sync di tutti i gruppi `followed` → per ogni gruppo con messaggi più recenti di `lastDigestAt`, genera digest, salva in `summaries`, aggiorna `lastDigestAt`. Gruppi senza novità: saltati. La UI mostra i digest man mano che arrivano (via `useLiveQuery`).

**Q&A**: l'utente sceglie gruppo/i e periodo (default 7 giorni), scrive la domanda → i messaggi del periodo vanno in contesto → risposta salvata in `summaries` come `question`.

## UI (una pagina, 3 stati)

1. **Onboarding**: form `api_id`/`api_hash` con istruzioni e link a my.telegram.org; poi login numero → codice → 2FA; poi lista dialoghi con toggle "segui".
2. **Home**: digest dell'apertura in cima (spinner durante la generazione), textbox "Chiedi qualcosa" con selettore gruppo/periodo, storico di digest e risposte in ordine cronologico inverso.
3. **Settings**: provider/modello, API key Anthropic, URL Ollama, profilo personale (textarea), retention giorni.

Niente router: lo stato della vista è locale.

## Error handling

- Session Telegram scaduta → ritorno all'onboarding con messaggio chiaro.
- Ollama non raggiungibile → banner con istruzione (`OLLAMA_ORIGINS=* ollama serve`).
- `FLOOD_WAIT` → gestito da GramJS; la UI mostra "sync in corso".
- Errore LLM durante un digest → il digest di quel gruppo fallisce con messaggio, gli altri proseguono; `lastDigestAt` NON si aggiorna per il gruppo fallito.

## Testing

- Vitest sulle parti pure: costruzione prompt, selezione messaggi per periodo, troncamento contesto, dedup e pruning, formattazione messaggi.
- GramJS e client LLM dietro interfacce sottili, mockate nei test.
- Login Telegram: verifica manuale, niente e2e.

## Fuori scope (YAGNI)

Embeddings/ricerca semantica, bot Telegram, notifiche push, multi-utente, media, backend di qualsiasi tipo, scheduling con tab pinnata.
