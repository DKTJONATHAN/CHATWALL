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

function escapeHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function setState(kind,label){state.className=`state ${kind}`;state.querySelector('span').textContent=label;}
function render(chat){
  if(!chat){empty.classList.remove('hidden');messages.innerHTML='';finalBox.classList.add('hidden');setState('idle','READY');return;}
  empty.classList.add('hidden');
  messages.innerHTML=(chat.messages||[]).map(m=>`<article class="message ${escapeHtml(m.speaker)}"><div class="meta"><span class="speaker">${m.speaker==='user'?'YOU':m.speaker.toUpperCase()}</span><span class="round">${m.round ? `ROUND ${m.round}` : 'ORIGINAL THOUGHT'}</span></div><p>${escapeHtml(m.text)}</p></article>`).join('');
  const active=['awaiting_gemini','awaiting_chatgpt','awaiting_gemini_counter'].includes(chat.status);
  busy=active;
  send.disabled=active;
  thought.disabled=active;
  if(active){setState('live',chat.status==='awaiting_gemini'?'GEMINI THINKING':chat.status==='awaiting_chatgpt'?'CHATGPT THINKING':'GEMINI COUNTERING');}
  else if(chat.status==='final'){setState('done','AGREED');finalBox.classList.remove('hidden');finalText.textContent=chat.final_output||'';}
  else if(chat.status==='error'){setState('idle','ERROR');}
  messages.scrollIntoView({behavior:'smooth',block:'end'});
}
async function getLatest(){
  try{const r=await fetch(`${API}/latest`,{cache:'no-store'});if(!r.ok)throw new Error('Could not load room');const d=await r.json();render(d.chat);return d.chat;}catch(e){console.error(e);}
}
form.addEventListener('submit',async e=>{
  e.preventDefault(); if(busy)return;
  const value=thought.value.trim(); if(value.length<2)return;
  send.disabled=true; thought.disabled=true; setState('live','STARTING GEMINI');
  try{const r=await fetch(`${API}/chats`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({thought:value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not start debate');thought.value='';updateCounter();render(d.chat);poll();}catch(err){alert(err.message);send.disabled=false;thought.disabled=false;setState('idle','READY');}
});
function updateCounter(){counter.textContent=`${thought.value.length.toLocaleString()} / 12,000`;}
thought.addEventListener('input',updateCounter);
function poll(){clearInterval(timer);timer=setInterval(async()=>{const c=await getLatest();if(c&&!['awaiting_gemini','awaiting_chatgpt','awaiting_gemini_counter'].includes(c.status))clearInterval(timer);},4000);}
getLatest().then(c=>{if(c&&['awaiting_gemini','awaiting_chatgpt','awaiting_gemini_counter'].includes(c.status))poll();});
