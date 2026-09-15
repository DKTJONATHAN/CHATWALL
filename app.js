const API = '/api/ai-room';
const form = document.querySelector('#composer');
const thought = document.querySelector('#thought');
const send = document.querySelector('#send');
const counter = document.querySelector('#counter');
const messages = document.querySelector('#messages');
const empty = document.querySelector('#empty');
const finalBox = document.querySelector('#final');
const finalText = document.querySelector('#final-text');
const state = document.querySelector('#state');

let timer = null;
let busy = false;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function setState(kind, label) {
  state.className = `state ${kind}`;
  state.querySelector('span').textContent = label;
}

function render(chat) {
  if (!chat) {
    empty.classList.remove('hidden');
    messages.innerHTML = '';
    finalBox.classList.add('hidden');
    setState('idle', 'READY');
    return;
  }
  empty.classList.add('hidden');
  messages.innerHTML = (chat.messages || [])
    .map(
      (m) =>
        `<article class="message ${escapeHtml(m.speaker)}"><div class="meta"><span class="speaker">${
          m.speaker === 'user' ? 'YOU' : m.speaker.toUpperCase()
        }</span><span class="round">${
          m.round ? `ROUND ${m.round}` : 'ORIGINAL THOUGHT'
        }</span></div><p>${escapeHtml(m.text)}</p></article>`
    )
    .join('');

  const active = ['awaiting_gemini', 'awaiting_chatgpt', 'awaiting_gemini_counter'].includes(chat.status);
  busy = active;
  send.disabled = active;
  thought.disabled = active;

  if (active) {
    setState(
      'live',
      chat.status === 'awaiting_gemini'
        ? 'GEMINI THINKING'
        : chat.status === 'awaiting_chatgpt'
          ? 'CHATGPT THINKING'
          : 'GEMINI COUNTERING'
    );
  } else if (chat.status === 'final') {
    setState('done', 'AGREED');
    finalBox.classList.remove('hidden');
    finalText.textContent = chat.final_output || '';
  } else if (chat.status === 'error') {
    setState('idle', 'ERROR');
    finalBox.classList.remove('hidden');
    finalText.textContent = chat.error || 'Unknown error';
  } else {
    setState('idle', String(chat.status || 'READY').toUpperCase());
  }
  messages.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

async function parseResponse(r) {
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      text.trim().startsWith('<')
        ? 'Cloudflare returned a webpage instead of the CHATWALL API. Redeploy the Worker and confirm run_worker_first includes /api/ai-room/*.'
        : `API returned invalid JSON (${r.status}).`
    );
  }
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

async function getLatest() {
  try {
    const r = await fetch(`${API}/latest`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const d = await parseResponse(r);
    render(d.chat);
    return d.chat;
  } catch (e) {
    console.error(e);
    if (!busy) setState('idle', 'API ERROR');
    return null;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  const value = thought.value.trim();
  if (value.length < 2) return;
  send.disabled = true;
  thought.disabled = true;
  setState('live', 'STARTING GEMINI');
  try {
    const r = await fetch(`${API}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ thought: value }),
    });
    const d = await parseResponse(r);
    thought.value = '';
    updateCounter();
    render(d.chat);
    poll();
  } catch (err) {
    alert(err.message);
    send.disabled = false;
    thought.disabled = false;
    setState('idle', 'READY');
  }
});

function updateCounter() {
  counter.textContent = `${thought.value.length.toLocaleString()} / 12,000`;
}
thought.addEventListener('input', updateCounter);

function poll() {
  clearInterval(timer);
  timer = setInterval(async () => {
    const c = await getLatest();
    if (c && !['awaiting_gemini', 'awaiting_chatgpt', 'awaiting_gemini_counter'].includes(c.status)) {
      clearInterval(timer);
      timer = null;
    }
  }, 4000);
}

// Boot
getLatest().then((c) => {
  if (c && ['awaiting_gemini', 'awaiting_chatgpt', 'awaiting_gemini_counter'].includes(c.status)) poll();
});
