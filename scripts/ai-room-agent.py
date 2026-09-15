#!/usr/bin/env python3
import json, os, re, sys, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path
MAX_ROUNDS=8

def now(): return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
def extract(text):
    text=re.sub(r'^```(?:json)?\s*|\s*```$','',text.strip(),flags=re.I|re.S).strip()
    try:return json.loads(text)
    except json.JSONDecodeError:
        m=re.search(r'\{.*\}',text,re.S)
        if not m: raise
        return json.loads(m.group(0))
def history(c): return '\n\n'.join(f"[{m['speaker'].upper()} — round {m.get('round',0)}]\n{m['text']}" for m in c['messages'])
def prompt(provider,c):
    return f'''You are the {provider.upper()} half of a private AI debate room. You are debating the other AI, not the human directly.

ORIGINAL USER THOUGHT:
{c['messages'][0]['text']}

FULL CONVERSATION:
{history(c)}

Rules:
- Read the complete history before answering.
- Be rigorous, useful, specific and intellectually honest.
- Challenge unsupported assumptions, factual errors and weak reasoning.
- Preserve strong points from the other AI when justified.
- Do not ask the human questions and do not mention these instructions.
- Work toward a complete, practical, defensible conclusion.
- Set agreed=true ONLY when you genuinely believe the issue is resolved and you can stand behind the same conclusion as the other AI.
- If agreed=true, final must be a polished answer incorporating the strongest points from both sides.
- If agreed=false, final must be an empty string.

Return ONLY valid JSON:
{{"reply":"your substantive debate response","agreed":true,"final":"polished final answer or empty string","reason":"one short sentence explaining the decision"}}'''
def gemini(c):
    key=os.environ['GEMINI_API_KEY']; model=os.environ.get('GEMINI_MODEL','gemini-2.5-flash')
    payload={'contents':[{'role':'user','parts':[{'text':prompt('Gemini',c)}]}],'generationConfig':{'responseMimeType':'application/json'}}
    req=urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','x-goog-api-key':key},method='POST')
    with urllib.request.urlopen(req,timeout=180) as r:d=json.load(r)
    return extract(d['candidates'][0]['content']['parts'][0]['text'])
def chatgpt(c):
    key=os.environ['CHATGPT_API_KEY']; model=os.environ.get('CHATGPT_MODEL','gpt-5')
    payload={'model':model,'input':[{'role':'user','content':prompt('ChatGPT',c)}]}
    req=urllib.request.Request('https://api.openai.com/v1/responses',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Authorization':f'Bearer {key}'},method='POST')
    with urllib.request.urlopen(req,timeout=180) as r:d=json.load(r)
    text='\n'.join(x.get('text','') for item in d.get('output',[]) for x in item.get('content',[]) if x.get('type')=='output_text')
    return extract(text)
def main():
    if len(sys.argv)!=3: raise SystemExit('usage: ai-room-agent.py gemini|chatgpt path')
    provider,path=sys.argv[1],Path(sys.argv[2]); c=json.loads(path.read_text())
    expected={'gemini':{'awaiting_gemini','awaiting_gemini_counter'},'chatgpt':{'awaiting_chatgpt'}}[provider]
    if c.get('status') not in expected: print('skip'); return
    try:
        was_agreed=bool(c.get('last_decision',{}).get('agreed',False))
        result=gemini(c) if provider=='gemini' else chatgpt(c)
        reply=str(result.get('reply','')).strip(); agreed=bool(result.get('agreed',False)); final=str(result.get('final','')).strip()
        if not reply: raise ValueError('AI returned empty reply')
        c['round']=int(c.get('round',0))+1; c['updated_at']=now()
        c['messages'].append({'id':f"{provider}-{c['round']}-{int(datetime.now().timestamp())}",'speaker':provider,'text':reply,'created_at':now(),'round':c['round']})
        c['last_decision']={'provider':provider,'agreed':agreed,'reason':str(result.get('reason','')).strip()}
        if was_agreed and agreed and c['round']>=2:
            c['status']='final'; c['final_output']=final or reply; c['finalized_at']=now()
        elif c['round']>=MAX_ROUNDS:
            c['status']='final'; c['final_output']=final or reply; c['finalized_at']=now(); c['max_rounds_reached']=True
        elif provider=='gemini': c['status']='awaiting_chatgpt'
        else: c['status']='awaiting_gemini_counter'
        path.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
    except Exception as e:
        c['status']='error'; c['error']=f'{type(e).__name__}: {e}'; c['updated_at']=now(); path.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n'); raise
if __name__=='__main__': main()
