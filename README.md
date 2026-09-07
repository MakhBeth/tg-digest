# tg-digest

I follow a lot of Telegram groups, and most days I don't have the time to read them all. So I built this little thing.

tg-digest logs into Telegram through the official Telegram API (MTProto, via [GramJS](https://github.com/gram-js/gramjs)) using your own `api_id`/`api_hash`, fetches the new messages from the groups you pick, and asks an LLM to summarize them (main threads, decisions, shared links), with an optional section for the stuff that matters to *you*. You can also ask free-form questions over the collected messages.

It is a plain web app (PWA): the Telegram client runs inside the page, there is no backend, no server of mine and no browser automation. Nothing leaves your machine except the API calls to Telegram and to the LLM provider you choose.

> The UI is in Italian for now.

## How it works

- Nothing runs on startup. You open the app, press **Aggiorna** (refresh), and it syncs the followed groups and generates one digest per group.
- The first digest covers the last 7 days. Every next one starts where the previous one ended.
- Digests are kept in a local history; the trash button clears it and the next run restarts from the last 7 days.
- The **Chiedi** box lets you ask a question over the messages instead of getting a summary.
- Only text messages are considered. Photos, media and attachments are ignored.

## Requirements

- Node.js (a recent LTS).
- A Telegram account, plus API credentials (`api_id` and `api_hash`) from [my.telegram.org/apps](https://my.telegram.org/apps).
- An LLM provider, one of:
  - [Ollama](https://ollama.com) running locally with a model pulled (default: `qwen3.6:35b-mlx`, any model works);
  - an Anthropic API key;
  - a Claude Code subscription, used through the `claude` CLI installed on your machine (see the bridge below).

## Run it

```
npm i
npm run dev
```

`npm run dev` starts Vite and the Claude Code bridge together (if port 11435 is already taken, the running bridge is reused). To run the bridge alone:

```
node bridge/claude-bridge.mjs
```

## Setup

### 1. Telegram login (first run)

The app walks you through it: enter `api_id` and `api_hash`, your phone number in international format, the login code Telegram sends you, and the 2FA password if you have one. Then tick the groups you want to follow. The session is stored in the browser (IndexedDB), so you log in once.

### 2. Settings (gear icon)

| Field | What it does |
|---|---|
| **Provider** | `Ollama`, `Anthropic`, or `Claude Code (abbonamento)`. |
| **Modello** | A select with the available models. With Ollama it lists what your server actually has (read live from `/api/tags`), plus the Claude aliases if you point the Ollama URL at the bridge. "Altro…" lets you type any name. |
| **API key Anthropic** | Only for the Anthropic provider. Stored locally. |
| **URL Ollama** | Default `http://localhost:11434`. |
| **URL bridge Claude Code** | Default `http://localhost:11435`. |
| **Modello Claude** | For the Claude Code provider: `Default della CLI` uses whatever your `claude` is configured with, or pick `opus` / `sonnet` / `haiku` / a full model ID. |
| **Profilo** | A sentence about you (role, interests). The digest gets an extra section with the things relevant to that profile. |
| **Retention giorni** | How many days of messages to keep locally before pruning. |
| **Gruppi** | Which groups to include in the digest. |

### 3. Ollama and CORS

The browser calls Ollama directly, so Ollama must accept cross-origin requests:

```
OLLAMA_ORIGINS=* ollama serve
```

Without it, requests fail with a network error and the app shows a banner with this instruction.

### 4. Claude Code bridge

`bridge/claude-bridge.mjs` is a tiny local HTTP server (no dependencies) that exposes the `claude` CLI through an OpenAI-compatible `/v1/chat/completions` endpoint, so the app can use your Claude Code subscription without a separate API key. It runs `claude -p --output-format text` for each request.

- Listens on `http://localhost:11435` (change with `PORT`).
- Finds the `claude` binary via `CLAUDE_BIN`, then `PATH`, then the usual install locations (`~/.local/bin`, `~/.claude/local`, Homebrew).
- Passes `--model` only when a model is selected; otherwise the CLI default is used.

### Serving it behind a reverse proxy

If you serve `dist/` from a custom host (for example with Caddy), proxy Ollama under `/ollama` and the bridge under `/bridge` on the same origin. The app detects a non-localhost origin and defaults the two URLs to `<origin>/ollama` and `<origin>/bridge`, which avoids CORS entirely.

```
tg-digest.home {
	tls internal
	handle_path /bridge/* {
		reverse_proxy 127.0.0.1:11435
	}
	handle_path /ollama/* {
		reverse_proxy 127.0.0.1:11434 {
			header_up Origin http://127.0.0.1
			header_up Host 127.0.0.1:11434
		}
	}
	root * /path/to/tg-digest/dist
	file_server
}
```

## Privacy

Everything Telegram-related (session, messages, groups) stays in the browser, in IndexedDB via Dexie. The only outbound traffic is to the LLM provider you configured: a local Ollama, your local Claude Code bridge, or the Anthropic API if you chose it and entered a key.

## Known limits

- Digests are generated only when you press the button. No background process, no push notifications.
- Text messages only.
- Long conversations are truncated to fit the context budget; the digest says so when it happens.

## Development

```
npm run lint    # tsc --noEmit
npm test        # vitest
npm run build   # tsc + vite build -> dist/
```

## License

MIT
