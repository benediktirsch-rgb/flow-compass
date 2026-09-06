/* compass-live.js — Live-Schicht des Flow Compass (06.09.2026)

   Drei Dinge, die Bene am 06.09. bestellt hat („Hier muss eine Reaktion möglich sein“ —
   „same here“ — „die 3 wichtigsten KPIs als Diagramm“), als eigene Datei neben
   dashboard.html, weil die an dem Tag von vier Sessions gleichzeitig belegt war:

   1. „Wartet auf dich“ und „Wartet in Slack“: je Eintrag eine Reaktion — schon erledigt,
      Claude schreibt einen Entwurf, Claude schickt direkt, eine Claude-Session soll das
      Thema einordnen. Der Zustand liegt am john-server (reaktionen.json), nicht im
      Browser: Bene schaut mal lokal, mal auf der eigenen Subdomain, mal am Handy.
   2. Beide Listen und die Finanzen laden sich selbst nach (alle 3 Min, nur bei sichtbarem
      Tab); ein Klick auf „gemessen vor …“ lädt sofort.
   3. Finanzen: Kontostand, Deckung, Monatsergebnis als Verlauf — drei kleine Diagramme,
      eins je Kennzahl. Drei Skalen gehören nie auf eine Achse.

   Hängt sich von außen an: ersetzt postfZeile / slrZeile / finRefresh über den globalen
   Namen (Funktionsdeklarationen sind überschreibbar; die Aufrufer schlagen den Namen erst
   beim Aufruf nach). dashboard.html bleibt bis auf das <script>-Tag unberührt. Ohne
   Server tut die Datei nichts — leere Listen bleiben so ehrlich wie zuvor.               */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined') return;
  const API=()=> (typeof JOHN_API==='string'?JOHN_API:'');
  const esc=(typeof window.esc==='function')?window.esc:(s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const sag=(m,art)=>{ try{ if(typeof toast==='function') toast(m,art); else console.log(m); }catch(e){} };
  /* POSTF/SLACK/FIN sind const im Seitenskript — global lexikalisch, also per Namen erreichbar,
     aber nicht als window-Eigenschaft. Fehlt eins (andere Seite), gibt es null statt eines Fehlers. */
  const S=(name)=>{ try{ switch(name){ case 'POSTF': return POSTF; case 'SLACK': return SLACK; case 'FIN': return FIN; } }catch(e){} return null; };

  /* ---------- Stil ------------------------------------------------------------------ */
  const css=document.createElement('style');
  css.textContent=`
.rk{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center}
.rk .btn{padding:3px 8px;font-size:11px;margin:0;border-radius:8px;line-height:1.5}
.rk .btn:disabled{opacity:.5;cursor:wait;transform:none}
.rk .st{font-size:11px;color:var(--dim);margin-right:4px}
.rk .st b{color:var(--ink);font-weight:600}
.item.link .rk .btn{position:relative;z-index:1}
#postfStand,#slackStand,#finStand{cursor:pointer}
#postfStand:hover,#slackStand:hover,#finStand:hover{color:var(--va-l);text-decoration:underline dotted}
.fintrend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 4px;--tr:var(--va-l);--trp:#8ff0bd;--trn:#ff8a8a}
[data-theme="light"] .fintrend{--tr:var(--va);--trp:#12703f;--trn:#b42323}
.fintrend .tp{position:relative;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:6px 8px 4px;min-width:0}
.fintrend .tp .l{font-size:10.5px;color:var(--dim);display:flex;justify-content:space-between;gap:6px}
.fintrend .tp .l b{color:var(--ink);font-weight:600;white-space:nowrap}
.fintrend svg{display:block;width:100%;height:auto;margin-top:2px;overflow:visible}
.fintrend .ax{font-size:9px;fill:var(--dim)}
.fintrend .grid{stroke:var(--line);stroke-width:1}
.fintrend .ziel{stroke:var(--dim);stroke-width:1;stroke-dasharray:3 3}
.fintrend .li{fill:none;stroke:var(--tr);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.fintrend .fl{fill:var(--tr);opacity:.10}
.fintrend .pt{fill:var(--tr);stroke:var(--panel2);stroke-width:2}
.fintrend .bp{fill:var(--trp)}.fintrend .bn{fill:var(--trn)}
.fintrend .hit{fill:transparent;cursor:crosshair}
.fintrend .hit:hover+.mk,.fintrend .mk.on{opacity:1}
.fintrend .mk{opacity:0;pointer-events:none}
.fintrend .mk line{stroke:var(--line2);stroke-width:1}
.fintrend .tt{position:absolute;left:8px;top:6px;font-size:10.5px;color:var(--ink);background:var(--panel);border:1px solid var(--line2);border-radius:6px;padding:2px 6px;pointer-events:none;display:none;white-space:nowrap;z-index:2}
@media(max-width:640px){.fintrend{grid-template-columns:1fr 1fr}.fintrend .tp:last-child{grid-column:1/-1}}
`;
  document.head.appendChild(css);

  /* ---------- 1 · Reaktionen ---------------------------------------------------------- */
  const RK={ items:{}, lokal:{}, laeuft:{} };
  const RK_TEXT={ entwurf:'✍️ <b>Entwurf angefordert</b> — Claude schreibt', senden:'📤 <b>Versand angefordert</b> — Claude schickt', session:'🧭 <b>Session angefordert</b> — Thema wird eingeordnet', erledigt:'✓ erledigt' };
  const uhr=iso=>{ try{ const d=new Date(iso); if(isNaN(d)) return ''; const heute=new Date(); const t=d.toDateString()===heute.toDateString(); return (t?'':d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+' ')+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } };

  function rkBar(q,w){
    if(!w||!w.id) return '';
    const key=q+':'+w.id;
    RK.items[key]=Object.assign({quelle:q},w);
    const r=w.reaktion||RK.lokal[key];
    const d=`data-rk="${esc(key)}"`;
    if(r&&r.art&&r.art!=='erledigt'){
      return `<div class="rk" ${d}><span class="st">${RK_TEXT[r.art]||esc(r.art)}${r.zeit?' · '+esc(uhr(r.zeit)):''}</span>
        <button class="btn" data-art="erledigt" title="Ist erledigt — aus der Liste nehmen">✓ erledigt</button>
        <button class="btn" data-art="zurueck" title="Reaktion zurücknehmen">↶</button></div>`;
    }
    const antwort=w.art==='antwort';
    return `<div class="rk" ${d}>
      <button class="btn" data-art="erledigt" title="Nichts mehr zu tun — aus der Liste nehmen">✓ ${antwort?'Schon erledigt':'Gelesen'}</button>
      ${antwort?`<button class="btn" data-art="entwurf" title="Claude bereitet die Antwort als Entwurf vor — du sendest">✍️ Entwurf von Claude</button>
      <button class="btn" data-art="senden" title="Claude schreibt und sendet die Antwort direkt">📤 Claude schickt direkt</button>`:''}
      <button class="btn" data-art="session" title="Auftrag an eine Claude-Session: Thema einordnen">🧭 Session öffnen</button></div>`;
  }
  /* Die Leiste kommt ans Ende von .body: die Zeile der Seite endet mit </div></div>
     (body, item) — davor eingesetzt, bleibt alles andere, wie es ist. */
  function mitLeiste(html,q,w){
    const bar=rkBar(q,w); if(!bar) return html;
    const i=html.lastIndexOf('</div></div>');
    return i<0?html+bar:html.slice(0,i)+bar+html.slice(i);
  }
  if(typeof window.postfZeile==='function'){ const o=window.postfZeile; window.postfZeile=function(w){ return mitLeiste(o(w),'postfach',w); }; }
  if(typeof window.slrZeile==='function'){ const o=window.slrZeile; window.slrZeile=function(w){ return mitLeiste(o(w),'slack',w); }; }

  /* Klick in der Capture-Phase: die Zeile selbst hat ein onclick (window.open) — das darf
     bei einem Knopf nicht mitlaufen. */
  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('.rk .btn'); if(!b) return;
    e.stopPropagation(); e.preventDefault();
    const bar=b.closest('.rk'); const key=bar&&bar.dataset.rk; const art=b.dataset.art;
    if(!key||!art||RK.laeuft[key]) return;
    await reagieren(key,art,bar);
  },true);

  async function reagieren(key,art,bar){
    const w=RK.items[key]; if(!w) return;
    const [quelle]=key.split(':'); const id=key.slice(quelle.length+1);
    RK.laeuft[key]=true; bar.querySelectorAll('.btn').forEach(x=>x.disabled=true);
    let res=null;
    try{
      const r=await fetch(API()+'/api/reaktion',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({quelle,id,art,von:w.von||'',adresse:w.adresse||'',betreff:w.betreff||'',kanal:w.kanal||'',worum:w.worum||'',url:w.url||''})});
      res=await r.json();
    }catch(err){ res={ok:false,error:'offline'}; }
    delete RK.laeuft[key];
    if(!res||!res.ok){
      bar.querySelectorAll('.btn').forEach(x=>x.disabled=false);
      sag(`Reaktion nicht gespeichert: ${esc((res&&(res.hint||res.error))||'John-Server nicht erreichbar')}`,'bad'); return;
    }
    /* Sofort sichtbar, bevor der Server die Liste neu liefert. */
    if(art==='erledigt'){ const it=bar.closest('.item'); if(it) it.style.display='none'; delete RK.lokal[key]; sag('✓ Erledigt — aus der Liste genommen.'); }
    else if(art==='zurueck'){ delete RK.lokal[key]; sag('Reaktion zurückgenommen.'); }
    else{
      RK.lokal[key]={art,zeit:res.zeit};
      bar.outerHTML=rkBar(quelle,Object.assign({},w,{reaktion:{art,zeit:res.zeit}}));
      if(art==='session') sessionOeffnen(res.prompt||res.auftrag||'',w);
      else sag(`${art==='entwurf'?'✍️ Entwurf':'📤 Versand'} angefordert — Auftrag liegt in <code>checkins/${esc(res.datei||'…-auftraege.md')}</code>; die nächste Claude-Session nimmt ihn.`);
    }
    nachladen(quelle);
  }

  /* „Session öffnen“: Es gibt keinen verlässlichen Deep Link in die Code-Ansicht der
     Claude-App (claude-cli:// ist nur mit installierter CLI registriert, hier nicht).
     Darum: Auftrag liegt in checkins/, der Prompt wandert in die Zwischenablage, und die
     App wird über claude:// nach vorn geholt — neue Session, einfügen, fertig. */
  async function sessionOeffnen(prompt,w){
    const text=prompt||`Thema einordnen: ${w.von||''} — ${w.betreff||w.kanal||''}. ${w.worum||''}`;
    let kopiert=false;
    try{ await navigator.clipboard.writeText(text); kopiert=true; }catch(e){}
    try{
      const cli='claude-cli://open?cwd='+encodeURIComponent('C:\\dev\\persoenliches-dashboard')+'&q='+encodeURIComponent(text.slice(0,4800));
      const f=document.createElement('iframe'); f.style.display='none'; f.src=cli; document.body.appendChild(f);
      setTimeout(()=>{ try{ f.src='claude://'; }catch(e){} },400);
      setTimeout(()=>{ try{ f.remove(); }catch(e){} },4000);
    }catch(e){}
    sag(`🧭 Auftrag liegt in <code>checkins/</code>${kopiert?' und der Prompt in der Zwischenablage':''} — in Claude eine neue Session öffnen${kopiert?' und einfügen':''}.`);
  }

  /* ---------- 2 · Nachladen ----------------------------------------------------------- */
  const QUELLEN={ postfach:{st:'POSTF',fn:'postfRefresh'}, slack:{st:'SLACK',fn:'slrRefresh'}, finanzen:{st:'FIN',fn:'finRefresh'} };
  const LAEUFT={};
  async function nachladen(q){
    const Q=QUELLEN[q]; const st=S(Q.st); if(!Q||!st||LAEUFT[q]) return;
    LAEUFT[q]=true;
    try{
      const r=await fetch(API()+'/api/'+q,{cache:'no-store'}); const j=await r.json();
      st.data=(j&&j.ok)?j:null; st.fehler=(j&&j.ok===false)?j:null; st.geladen=true;
      if(q==='finanzen'&&typeof finUebernehmen==='function'){ try{ finUebernehmen(); }catch(e){} }
      const fn=window[Q.fn]; if(typeof fn==='function') fn();
    }catch(e){ /* offline: die Karte zeigt weiter den letzten Stand */ }
    delete LAEUFT[q];
  }
  window.compassNachladen=nachladen;
  setInterval(()=>{ if(document.hidden) return; nachladen('postfach'); nachladen('slack'); nachladen('finanzen'); },3*60*1000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ nachladen('postfach'); nachladen('slack'); } });
  document.addEventListener('click',e=>{
    const t=e.target; if(!t||!t.id) return;
    const q={postfStand:'postfach',slackStand:'slack',finStand:'finanzen'}[t.id]; if(!q) return;
    t.textContent='lädt …'; nachladen(q);
  });

  /* ---------- 3 · Finanz-Verlauf ------------------------------------------------------ */
  const MON=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const monKurz=m=>{ const t=String(m||'').split('-'); return t.length>1?`${MON[(+t[1])-1]||t[1]} ${t[0].slice(2)}`:m; };
  const eur=v=>(typeof fmtEur==='function'?fmtEur(Math.abs(v)):Math.round(Math.abs(v)).toLocaleString('de-DE'))+' €';
  const fmt={ eur:v=>(v<0?'−':'')+eur(v), erg:v=>(v<0?'−':'+')+eur(v), mon:v=>v==null?'–':v.toFixed(1).replace('.',',')+' Mon' };

  function panel(titel,reihe,art,ziel){
    const W=220,H=64,L=6,R=6,T=8,B=14;
    const n=reihe.length, vals=reihe.map(r=>r.v).filter(v=>v!=null);
    if(!vals.length) return '';
    let lo=Math.min(...vals), hi=Math.max(...vals);
    if(art==='erg'){ lo=Math.min(lo,0); hi=Math.max(hi,0); }
    if(ziel!=null){ lo=Math.min(lo,ziel); hi=Math.max(hi,ziel); }
    if(hi===lo){ hi+=1; lo-=1; }
    const pad=(hi-lo)*0.08; lo-=pad; hi+=pad;
    const x=i=>n>1?L+i*((W-L-R)/(n-1)):W/2, y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
    const step=(W-L-R)/Math.max(1,n-1);
    let g=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(art==='erg'?0:lo+pad).toFixed(1)}" y2="${y(art==='erg'?0:lo+pad).toFixed(1)}"/>`;
    if(ziel!=null) g+=`<line class="ziel" x1="${L}" x2="${W-R}" y1="${y(ziel).toFixed(1)}" y2="${y(ziel).toFixed(1)}"/><text class="ax" x="${W-R}" y="${(y(ziel)-2).toFixed(1)}" text-anchor="end">Ziel ${ziel}</text>`;
    let marks='';
    if(art==='erg'){
      const bw=Math.max(4,Math.min(14,step*0.55));
      reihe.forEach((r,i)=>{ if(r.v==null) return; const y0=y(0), y1=y(r.v);
        marks+=`<rect class="${r.v<0?'bn':'bp'}" x="${(x(i)-bw/2).toFixed(1)}" y="${Math.min(y0,y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,Math.abs(y1-y0)).toFixed(1)}" rx="2"/>`; });
    }else{
      const pts=reihe.map((r,i)=>r.v==null?null:[x(i),y(r.v)]).filter(Boolean);
      const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
      const base=(H-B).toFixed(1);
      marks+=`<path class="fl" d="${d} L${pts[pts.length-1][0].toFixed(1)} ${base} L${pts[0][0].toFixed(1)} ${base} Z"/><path class="li" d="${d}"/>`;
      const last=pts[pts.length-1]; marks+=`<circle class="pt" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5"/>`;
    }
    /* Trefferflächen je Monat — die Spalte ist breiter als die Marke, damit man sie trifft. */
    let hits='';
    reihe.forEach((r,i)=>{ if(r.v==null) return; const cx=x(i), yv=y(r.v);
      hits+=`<rect class="hit" x="${(cx-step/2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}" data-i="${i}"/><g class="mk"><line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${T}" y2="${H-B}"/>${art==='erg'?'':`<circle class="pt" cx="${cx.toFixed(1)}" cy="${yv.toFixed(1)}" r="3"/>`}</g>`; });
    const ax=`<text class="ax" x="${L}" y="${H-2}">${esc(monKurz(reihe[0].m))}</text><text class="ax" x="${W-R}" y="${H-2}" text-anchor="end">${esc(monKurz(reihe[n-1].m))}</text>`;
    const letzte=reihe[n-1], vor=n>1?reihe[n-2]:null;
    const delta=(letzte.v!=null&&vor&&vor.v!=null)?letzte.v-vor.v:null;
    const dtxt=delta==null?'':(art==='mon'?` <span title="gegenüber Vormonat">${delta>=0?'▲':'▼'} ${Math.abs(delta).toFixed(1).replace('.',',')}</span>`:` <span title="gegenüber Vormonat">${delta>=0?'▲':'▼'} ${eur(delta)}</span>`);
    return `<div class="tp" data-art="${art}"><div class="l"><span>${esc(titel)}</span><b>${fmt[art](letzte.v)}${dtxt}</b></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titel)}, ${n} Monate">${g}${marks}${hits}${ax}</svg><div class="tt"></div>
      <span hidden class="daten">${esc(JSON.stringify(reihe.map(r=>[r.m,r.v])))}</span></div>`;
  }
  function finTrend(){
    const fin=S('FIN'); const body=document.getElementById('finBody');
    if(!fin||!fin.data||!fin.data.zahlen||!body) return;
    const v=(fin.data.verlauf||[]).slice(-12); if(v.length<2) return;
    const kp=body.querySelector('.kpis'); if(!kp||body.querySelector('.fintrend')) return;
    const el=document.createElement('div'); el.className='fintrend';
    el.innerHTML = panel('Kontostand',v.map(m=>({m:m.monat,v:m.kontostand})),'eur')
                 + panel('Deckung in Monaten',v.map(m=>({m:m.monat,v:m.deckung})),'mon',3)
                 + panel('Monatsergebnis',v.map(m=>({m:m.monat,v:m.ergebnis})),'erg');
    kp.insertAdjacentElement('afterend',el);
    /* Tooltip: nächster Monat unter dem Zeiger, per Tastatur nicht nötig — die Werte stehen
       in der Tabelle der Finanzverwaltung, hier geht es um die Form der Kurve. */
    el.querySelectorAll('.tp').forEach(tp=>{
      const tt=tp.querySelector('.tt'); let daten=[]; try{ daten=JSON.parse(tp.querySelector('.daten').textContent); }catch(e){}
      const art=tp.dataset.art;
      tp.querySelectorAll('.hit').forEach(h=>{
        h.addEventListener('mouseenter',()=>{ const i=+h.dataset.i; const d=daten[i]; if(!d) return;
          tt.textContent=`${monKurz(d[0])}: ${fmt[art](d[1])}`; tt.style.display='block'; });
        h.addEventListener('mouseleave',()=>{ tt.style.display='none'; });
      });
    });
  }
  if(typeof window.finRefresh==='function'){ const o=window.finRefresh; window.finRefresh=function(){ const r=o.apply(this,arguments); try{ finTrend(); }catch(e){ console.warn('compass-live: finTrend',e); } return r; }; }

  /* Beim Start ist die Seite meist schon gerendert, bevor diese Datei greift (sie steht am
     Ende) — die Karten einmal nachziehen, sobald ihre Daten da sind. */
  let versuche=0;
  const t=setInterval(()=>{
    versuche++;
    const p=S('POSTF'), s=S('SLACK'), f=S('FIN');
    if(p&&p.geladen&&typeof postfRefresh==='function') postfRefresh();
    if(s&&s.geladen&&typeof slrRefresh==='function') slrRefresh();
    if(f&&f.geladen&&typeof finRefresh==='function') finRefresh();
    if((p&&p.geladen&&s&&s.geladen&&f&&f.geladen)||versuche>40) clearInterval(t);
  },500);
})();
