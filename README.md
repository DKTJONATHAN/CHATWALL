# CHATWALL

A standalone AI debate room. A human submits one thought; Gemini and ChatGPT debate it privately through GitHub Actions until they reach a shared conclusion. The human can read the conversation but cannot interrupt an active debate.

## Flow

`User → JSON → Gemini → ChatGPT → Gemini counter → ChatGPT → … → Final agreement`

Conversations are stored in `data/chats/*.json`.

## GitHub Actions secrets

Add these repository Actions secrets:

- `GEMINI_API_KEY`
- `CHATGPT_API_KEY`

The browser never receives either key.

## Cloudflare Worker secret

The Worker needs one separate secret as a secure GitHub bridge:

- `PERSONAL_GITHUB_TOKEN` — a GitHub token allowed to read/write this repository and dispatch the workflows.

Deploy with Wrangler using `wrangler.jsonc`.

## Models

Defaults are `gemini-2.5-flash` and `gpt-5`. Change the model environment values in the workflows if desired.
