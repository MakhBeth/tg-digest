# tg-digest

Digest automatico dei gruppi Telegram che segui, generato da un LLM (Ollama in locale oppure Anthropic) ogni volta che apri l'app. Tutto gira nel browser: nessun backend, nessun server proprio.

## Cos'è

tg-digest si collega al tuo account Telegram (via GramJS, direttamente dal browser), scarica i messaggi nuovi dei gruppi che scegli di seguire e ne genera un riassunto con un modello linguistico, secondo un profilo che definisci tu. Puoi anche fare domande libere sui messaggi raccolti.

## Prerequisiti

- Node.js (versione LTS recente).
- Un account Telegram.
- Credenziali API Telegram: `api_id` e `api_hash`, da creare su [my.telegram.org/apps](https://my.telegram.org/apps).
- Un provider LLM, a scelta:
  - Ollama installato in locale, con un modello scaricato (es. `gemma3`), oppure
  - una API key Anthropic.

## Avvio

```
npm i
npm run dev
```

Al primo avvio l'app guida l'onboarding: inserisci `api_id`/`api_hash`, il numero di telefono, il codice ricevuto via Telegram (ed eventuale password 2FA), poi scegli i gruppi da seguire.

## Nota CORS per Ollama

Il browser chiama Ollama direttamente, quindi Ollama deve accettare richieste cross-origin. Avvialo con:

```
OLLAMA_ORIGINS=* ollama serve
```

Senza questa variabile le richieste falliscono con un errore di rete e l'app mostra un banner dedicato con l'istruzione sopra.

## Privacy

Tutto ciò che riguarda Telegram (sessione, messaggi, gruppi) resta nel browser, salvato in IndexedDB tramite Dexie. L'unico traffico che esce dal browser verso terzi è quello verso il provider LLM scelto nelle impostazioni (Ollama locale, oppure l'API di Anthropic se selezionata e configurata con la relativa chiave).

## Limiti noti

- Il digest viene generato solo quando l'app è aperta: non c'è nessun processo in background o notifica push.
- Vengono considerati solo i messaggi di testo; allegati, foto, media non sono analizzati.
