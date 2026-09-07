# tg-digest

Digest automatico dei gruppi Telegram che segui, generato da un LLM (Ollama in locale oppure Anthropic) ogni volta che apri l'app. Tutto gira nel browser: nessun backend, nessun server proprio.

## Cos'è

tg-digest si collega al tuo account Telegram (via GramJS, direttamente dal browser), scarica i messaggi nuovi dei gruppi che scegli di seguire e ne genera un riassunto con un modello linguistico, secondo un profilo che definisci tu. Puoi anche fare domande libere sui messaggi raccolti.

## Prerequisiti

- Node.js (versione LTS recente).
- Un account Telegram.
- Credenziali API Telegram: `api_id` e `api_hash`, da creare su [my.telegram.org/apps](https://my.telegram.org/apps).
- Un provider LLM, a scelta:
  - Ollama installato in locale, con un modello scaricato (es. `qwen3.6:35b-mlx`), oppure
  - una API key Anthropic.

## Avvio

```
npm i
npm run dev
```

`npm run dev` avvia anche il bridge Claude Code insieme a vite (se la porta 11435 è già occupata lo riusa senza fallire); il bridge da solo resta `node bridge/claude-bridge.mjs`.

Al primo avvio l'app guida l'onboarding: inserisci `api_id`/`api_hash`, il numero di telefono, il codice ricevuto via Telegram (ed eventuale password 2FA), poi scegli i gruppi da seguire.

## Nota CORS per Ollama

Il browser chiama Ollama direttamente, quindi Ollama deve accettare richieste cross-origin. Avvialo con:

```
OLLAMA_ORIGINS=* ollama serve
```

Senza questa variabile le richieste falliscono con un errore di rete e l'app mostra un banner dedicato con l'istruzione sopra.

## Provider Claude Code (abbonamento)

Oltre a Ollama e alla API key Anthropic, puoi usare l'abbonamento Claude Code tramite la CLI `claude` installata sulla tua macchina, senza configurare una chiave API separata. Serve un piccolo bridge locale che espone la CLI con un'interfaccia compatibile OpenAI, richiamata dal browser.

Avvia il bridge con:

```
node bridge/claude-bridge.mjs
```

Il bridge resta in ascolto su `http://localhost:11435` (porta configurabile con la variabile `PORT`) e usa `claude -p --output-format text` per generare le risposte. Nelle Impostazioni dell'app seleziona il provider "Claude Code (abbonamento)" e verifica l'URL del bridge.

## Privacy

Tutto ciò che riguarda Telegram (sessione, messaggi, gruppi) resta nel browser, salvato in IndexedDB tramite Dexie. L'unico traffico che esce dal browser verso terzi è quello verso il provider LLM scelto nelle impostazioni (Ollama locale, oppure l'API di Anthropic se selezionata e configurata con la relativa chiave).

## Limiti noti

- Il digest viene generato solo quando l'app è aperta: non c'è nessun processo in background o notifica push.
- Vengono considerati solo i messaggi di testo; allegati, foto, media non sono analizzati.
