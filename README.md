# CHATWALL

A standalone AI debate room. You submit **one** thought. Gemini and ChatGPT debate it privately through GitHub Actions until they reach a shared conclusion. You can read the conversation but cannot interrupt an active debate.

```
User → JSON in repo → Gemini workflow → ChatGPT workflow → Gemini counter → … → Final agreement
```

Conversations live in `data/chats/*.json`. The browser never sees either API key.

---

## 1. Required secrets

### GitHub Actions (repo → Settings → Secrets and variables → Actions)

| Secret | Purpose |
|--------|----------|
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key |
| `CHATGPT_API_KEY` | OpenAI API key |

### Cloudflare Worker

| Secret | Purpose |
|--------|----------|
| `PERSONAL_GITHUB_TOKEN` | Classic PAT or fine-grained token that can **read/write** this repo **and** trigger workflows |

**Token scopes (classic):** `repo` + `workflow`  
**Fine-grained:** Contents Read/Write + Actions Read/Write on `DKTJONATHAN/CHATWALL`

---

## 2. Deploy the Worker

```bash
npm i -g wrangler   # if needed
wrangler login
cd /path/to/CHATWALL

# Put the GitHub token into Cloudflare (not into the repo)
wrangler secret put PERSONAL_GITHUB_TOKEN

# Deploy (serves the static UI + /api/ai-room/*)
wrangler deploy
```

Open the URL Wrangler prints (e.g. `https://chatwall.<you>.workers.dev`).

---

## 3. Models (defaults)

| Role | Env var in workflow | Default |
|------|---------------------|----------|
| Gemini | `GEMINI_MODEL` | `gemini-2.5-flash` |
| ChatGPT | `CHATGPT_MODEL` | `gpt-5.6` |

Change them in `.github/workflows/*.yml` if you prefer another model.

---

## 4. How a debate runs

1. Browser `POST /api/ai-room/chats` → Worker writes `data/chats/<id>.json` with `status: awaiting_gemini`.
2. Push triggers **CHATWALL - Gemini**.
3. Agent appends Gemini’s reply, sets `awaiting_chatgpt`, commits, then `gh workflow run chatgpt.yml`.
4. ChatGPT agent replies, may set `awaiting_gemini_counter` and re-dispatch Gemini.
5. When **both** sides have `agreed: true` on consecutive turns (or 8 rounds), status becomes `final` and the polished answer is stored in `final_output`.
6. Frontend polls `/api/ai-room/latest` every 4s while a debate is live.

Only **one** debate can be active at a time.

---

## 5. Quick health checks

```text
GET  /api/ai-room/health   → { "ok": true, "github": "reachable" }  (or error detail)
GET  /api/ai-room/latest   → { "chat": null | {…} }
```

If health fails with 503, `PERSONAL_GITHUB_TOKEN` is missing on the Worker.  
If Actions fail with 401/403 on the model call, the corresponding API key is wrong or the model id is not enabled for that key.

---

## 6. Local static preview (UI only)

```bash
npm run build   # copies index.html, styles.css, app.js → dist/
# serve dist/ however you like — API still needs the Worker
```

---

## License

Private project for personal use.
