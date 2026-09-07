/* compass-madeleine.js — Madeleine, die zweite Beraterin im Flow Compass (07.09.2026)

   Bene: „2 Berater (John und Madeleine), die unterschiedliche Stärken haben und im Idealfall auch
   transparent miteinander kommunizieren." John ist der Coach (Claude), Madeleine die Fachseite für
   Finanzen, Steuern und Organisation der GmbH und des Vereins (GPT über Codex, ChatGPT-Abo).

   Hängt sich wie compass-live.js von außen an: wickelt johnKachel() und hängt seine Karte dahinter,
   baut sein Chat-Fenster selbst (CSS des John-Dialogs geklont, links unten statt rechts), spricht
   mit dem john-server über /api/madeleine und /api/beraterrunde. Ohne Server zeigt die Karte das.
   Nur in der eigenen Instanz — der Produkt-Build (Demo, Kundeninstanzen) lässt diese Datei weg. */
(function(){
  if(typeof window.johnKachel!=='function' || typeof JOHN_API==='undefined') return;
  const API=()=>JOHN_API;
  const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MAD={ status:null, statusZeit:0, runden:null, anzahl:0, busy:false, chatBusy:false };
  let VERLAUF=(()=>{ try{ return JSON.parse(localStorage.getItem('beneMadeleine')||'[]'); }catch(e){ return []; } })();
  const save=()=>{ try{ localStorage.setItem('beneMadeleine', JSON.stringify(VERLAUF.slice(-60))); }catch(e){} };
  const kontext=()=>{ try{ return typeof johnKontext==='function' ? johnKontext() : ''; }catch(e){ return ''; } };
  const sag=(m,art)=>{ try{ if(typeof toast==='function') toast(m,art); }catch(e){} };

  /* ---------- CSS: den John-Dialog für #madeleine klonen, Karte und Runde eigen ---------- */
  function css(){
    const out=[];
    try{
      for(const sh of document.styleSheets){
        let rules; try{ rules=sh.cssRules; }catch(e){ continue; }
        for(const r of rules){
          const sel=r.selectorText; if(!sel) continue;
          if(/^#john($|[\s.:,])/.test(sel)) out.push(r.cssText.replace(/#john(?![A-Za-z])/g,'#madeleine'));
        }
      }
    }catch(e){}
    out.push('#madeleine{left:22px;right:auto;bottom:22px}');
    out.push('#madeleine .jav{background:linear-gradient(135deg,#b06ab3,#4568dc)}');
    out.push('#madeleine .jsend{background:linear-gradient(135deg,#b06ab3,#4568dc)}');
    out.push('.jm.u.m{background:#7b4fa0}');
    out.push('.mk .jav{background:linear-gradient(135deg,#b06ab3,#4568dc);color:#fff}');
    out.push('.mk .mrunde{display:flex;flex-direction:column;gap:6px;margin-top:6px}');
    out.push('.mk .mth{font-size:12px;font-weight:700;color:var(--sub)}');
    out.push('.mk .mb{font-size:12.5px;line-height:1.45;padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);white-space:pre-wrap}');
    out.push('.mk .mb b{display:block;font-size:11px;color:var(--sub);margin-bottom:2px}');
    out.push('.mk .mb.m{border-left:3px solid #b06ab3}.mk .mb.j{border-left:3px solid var(--va)}');
    out.push('.mk .mmehr{font-size:11px;color:var(--sub);margin-top:4px}');
    const st=document.createElement('style'); st.id='madCss'; st.textContent=out.join('\n'); document.head.appendChild(st);
  }

  /* ---------- Chat-Fenster ---------- */
  function dialog(){
    const d=document.createElement('div'); d.id='madeleine'; d.setAttribute('role','dialog'); d.setAttribute('aria-label','Madeleine');
    d.innerHTML=`<div class="jh"><div class="jav">M</div><div class="jt"><b>Madeleine</b><span id="madSub">Finanzen · Steuer · Organisation · GPT über Codex</span></div><button class="jx" id="madClose" title="Schließen">✕</button></div>
      <div class="jstat" id="madDlgStat">Verbinde …</div>
      <div class="jmsgs" id="madMsgs"></div>
      <div class="jquick" id="madQuick">
        <button data-q="Gesamtbild: GmbH, privat und Verein zusammen — wo stehen wir bei Liquidität, Steuerlast, Vorsorge und Klumpenrisiko, und welche eine Optimierung über die Grenzen hinweg bringt jetzt am meisten?">Gesamtbild</button>
        <button data-q="Wie steht die Liquidität der GmbH — Kontostand, Deckung, was kommt in den nächsten 30 Tagen rein und raus?">Liquidität</button>
        <button data-q="Welche Fristen stehen an — Steuer, Abo-Kündigungen, Luxemburg, Verein? Was ist überfällig?">Fristen</button>
        <button data-q="Welche Entscheidung aus dem Strategiepapier ist noch offen, und was würdest du mit den heutigen Zahlen empfehlen?">Strategie</button>
        <button data-q="Was ist im Verein organisatorisch als Nächstes dran — Kasse, Vorstand, Mitglieder?">Verein</button>
        <button data-q="Formuliere die eine Frage, die ich W+ST diese Woche stellen sollte.">W+ST</button>
      </div>
      <div class="jin"><textarea id="madIn" placeholder="Schreib Madeleine … (Enter sendet, Shift+Enter = Zeile)"></textarea><button class="jsend" id="madSend" title="Senden">➤</button></div>`;
    document.body.appendChild(d);
    document.getElementById('madClose').addEventListener('click',()=>madToggle(false));
    document.getElementById('madSend').addEventListener('click',madSend);
    document.getElementById('madIn').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); madSend(); } });
    d.querySelectorAll('#madQuick button').forEach(b=>b.addEventListener('click',()=>{ document.getElementById('madIn').value=b.dataset.q; madSend(); }));
    document.getElementById('madMsgs').addEventListener('dblclick',()=>{ if(confirm('Madeleine-Verlauf lokal löschen?')){ VERLAUF=[]; save(); madRender(); } });
  }
  function madRender(){
    const m=document.getElementById('madMsgs'); if(!m) return;
    m.innerHTML = VERLAUF.length ? VERLAUF.map(x=>`<div class="jm ${x.role==='user'?'u m':'j'}${x.role==='system'?' sys':''}">${H(x.content)}${x.meta?`<span class="jmeta">${H(x.meta)}</span>`:''}</div>`).join('')
      : `<div class="jm j sys">Hallo, ich bin Madeleine — deine Beraterin für Finanzen, Steuern und Organisation der GmbH und des Vereins. Ich lese die Live-Zahlen aus dem Finanzlauf, meine Wissensdateien und Johns Notizen. Frag mich nach Zahlen, Fristen oder Struktur.</div>`;
    m.scrollTop=m.scrollHeight;
  }
  function madToggle(force){
    const el=document.getElementById('madeleine'); if(!el) return;
    const on = force==null ? !el.classList.contains('on') : force;
    el.classList.toggle('on',on);
    if(on){ madRender(); madStatus(); setTimeout(()=>{ const i=document.getElementById('madIn'); if(i) i.focus(); },50); }
  }
  function madOpen(text){ madToggle(true); if(text){ const i=document.getElementById('madIn'); i.value=text; i.focus(); } }
  async function madSend(){
    const inp=document.getElementById('madIn'), btn=document.getElementById('madSend'), box=document.getElementById('madMsgs');
    const t=inp.value.trim(); if(!t||MAD.chatBusy) return;
    inp.value=''; MAD.chatBusy=true; btn.disabled=true;
    VERLAUF.push({role:'user',content:t}); save(); madRender();
    const think=document.createElement('div'); think.className='jm j think'; think.textContent='Madeleine rechnet nach …'; box.appendChild(think); box.scrollTop=box.scrollHeight;
    try{
      const msgs=VERLAUF.filter(m=>m.role==='user'||m.role==='assistant').map(m=>({role:m.role,content:m.content}));
      const ctrl=new AbortController(); const tm=setTimeout(()=>ctrl.abort(),300000);
      const r=await fetch(API()+'/api/madeleine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:msgs,context:kontext()}),signal:ctrl.signal});
      clearTimeout(tm); const j=await r.json();
      if(!r.ok||j.error){ VERLAUF.push({role:'system',content:/^(CODEX_[A-Z_]+|NO_[A-Z]+|LIMIT)$/.test(j.error)?(j.hint||j.error):('Fehler: '+(j.error||r.status))}); }
      else { const meta=[j.model||'', (j.tools&&j.tools.length)?'✎ Notiz festgehalten':''].filter(Boolean).join(' · '); VERLAUF.push({role:'assistant',content:j.text||'(keine Antwort)',meta}); }
    }catch(e){ VERLAUF.push({role:'system',content:'Madeleine ist nicht erreichbar. Läuft john-server.cmd? ('+e.message+')'}); }
    MAD.chatBusy=false; btn.disabled=false; save(); madRender(); inp.focus();
  }

  /* ---------- Status und Runden ---------- */
  function statusText(){
    const s=MAD.status;
    if(s===null) return 'verbinde …';
    if(s===false) return 'Server aus — john-server.cmd starten';
    if(s.ok && s.key) return `verbunden · ${s.model||'GPT'} · ${(s.geladen||[]).length} Quellen (Wissen, Finanzlauf, Johns Notizen …)`;
    return 'Server läuft, aber '+(s.hint||'Codex nicht angemeldet');
  }
  async function madStatus(frisch){
    if(!frisch && MAD.status && Date.now()-MAD.statusZeit<120000){ statusMalen(); return; }
    try{ const r=await fetch(API()+'/api/madeleine/status'+(frisch?'?fresh=1':''),{cache:'no-store'}); MAD.status=await r.json(); }
    catch(e){ MAD.status=false; }
    MAD.statusZeit=Date.now(); statusMalen();
  }
  function statusMalen(){
    const a=document.getElementById('madStat'); if(a) a.textContent=statusText();
    const b=document.getElementById('madDlgStat'); if(b){ b.textContent=statusText(); b.classList.toggle('bad', !(MAD.status&&MAD.status.ok&&MAD.status.key)); }
  }
  async function madRundenLaden(frisch){
    if(!frisch && MAD.runden) return;
    try{ const r=await fetch(API()+'/api/beraterrunde',{cache:'no-store'}); const j=await r.json(); MAD.runden=j.runden||[]; MAD.anzahl=j.anzahl||0; }
    catch(e){ MAD.runden=[]; }
    madMalen();
  }
  const kurz=(t,n)=>{ t=String(t||''); return t.length>n ? t.slice(0,n).replace(/\s+\S*$/,'')+' …' : t; };
  function rundeHtml(r,voll){
    if(!r) return '';
    const n=voll?1600:320;
    return `<div class="mrunde"><div class="mth">🤝 ${H(r.datum||'')} · ${H(r.thema||'')}</div>`+
      (r.beitraege||[]).map(b=>`<div class="mb ${b.wer==='Madeleine'?'m':'j'}"><b>${H(b.wer)}</b>${H(kurz(b.text,n))}</div>`).join('')+`</div>`;
  }
  function bodyHtml(){
    if(MAD.busy) return '<div class="muted">🤝 John spricht … dann Madeleine … dann John. Das dauert bis zu vier Minuten; der Server ist so lange belegt.</div>';
    if(MAD.runden===null) return '<div class="muted">lade die letzte Beraterrunde …</div>';
    if(!MAD.runden.length) return '<div class="muted">Noch keine Beraterrunde. Starte eine — John und Madeleine beraten sich zu deinem Thema, du liest mit. Alles landet in john/coaching/beraterrunde.md, beide kennen es danach.</div>';
    const r=MAD.runden[0];
    return rundeHtml(r, MAD.voll)+`<div class="mmehr">${MAD.anzahl} Runde${MAD.anzahl===1?'':'n'} bisher · <a href="#" onclick="madVoll(event)">${MAD.voll?'kürzer':'ganz lesen'}</a></div>`;
  }
  function madMalen(){ const b=document.getElementById('madBody'); if(b) b.innerHTML=bodyHtml(); statusMalen(); }
  function madVoll(ev){ if(ev) ev.preventDefault(); MAD.voll=!MAD.voll; madMalen(); }
  async function madRunde(thema){
    if(MAD.busy) return;
    if(!thema){
      let vorschlag=''; try{ vorschlag=(typeof dasEine==='function'&&dasEine())||''; }catch(e){}
      thema=prompt('Thema der Beraterrunde — John und Madeleine beraten sich, du liest mit:', vorschlag);
    }
    if(!thema||!thema.trim()) return;
    MAD.busy=true; madMalen();
    try{
      const ctrl=new AbortController(); const tm=setTimeout(()=>ctrl.abort(),420000);
      const r=await fetch(API()+'/api/beraterrunde',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({thema:thema.trim(),context:kontext()}),signal:ctrl.signal});
      clearTimeout(tm); const j=await r.json();
      MAD.busy=false;
      if(!r.ok||j.error){ const b=document.getElementById('madBody'); if(b) b.innerHTML=`<div class="muted">Beraterrunde nicht möglich: ${H(j.hint||j.error||r.status)}</div>`; sag('Beraterrunde nicht möglich','bad'); return; }
      MAD.runden=[{datum:j.datum,thema:j.thema,beitraege:j.beitraege}].concat(MAD.runden||[]); MAD.anzahl=(MAD.anzahl||0)+1; MAD.voll=true; madMalen();
      sag('🤝 Beraterrunde festgehalten — John und Madeleine kennen sie jetzt beide.');
    }catch(e){ MAD.busy=false; const b=document.getElementById('madBody'); if(b) b.innerHTML=`<div class="muted">Beraterrunde abgebrochen: ${H(e.message)}</div>`; }
  }

  /* ---------- Karte: hinter Johns Karte, gleiche Bauart (.jk) ---------- */
  function madKachel(){
    return `<div class="card s6 tone-none jk mk" id="madKachel"><h3>👩‍💼 Madeleine <span class="cnt" id="madCnt">Finanzen · Steuer · Organisation</span></h3>
    <div class="jkopf"><div class="jav">📊</div><div><div class="jwer">Das Gesamtbild — GmbH, privat, Verein</div>
      <div class="jwas" id="madStat">${H(statusText())}</div></div></div>
    <div id="madBody">${bodyHtml()}</div>
    <div class="jmodi">
      <button class="jm2" onclick="madOpen('Gesamtbild: GmbH, privat und Verein zusammen — wo stehen wir bei Liquidität, Steuerlast, Vorsorge und Klumpenrisiko, und welche eine Optimierung über die Grenzen hinweg bringt jetzt am meisten?')" title="Alle drei Töpfe, vier Gesamt-Kennzahlen, ein Hebel">🧭 Gesamtbild</button>
      <button class="jm2" onclick="madOpen('Wie steht die Liquidität der GmbH — Kontostand, Deckung, was kommt in den nächsten 30 Tagen rein und raus?')" title="Kontostand, Deckung, Ein- und Ausgänge">💧 Liquidität</button>
      <button class="jm2" onclick="madOpen('Welche Fristen stehen an — Steuer, Abo-Kündigungen, Luxemburg, Verein? Was ist überfällig?')" title="Steuer, Kündigungen, Verein">📅 Fristen</button>
      <button class="jm2" onclick="madOpen('Was sollte ich organisatorisch als Nächstes ordnen — GmbH oder Verein? Ein Vorschlag mit Begründung.')" title="Struktur, Zuständigkeiten, Routinen">🗂️ Organisation</button>
      <button class="jm2" onclick="madRunde()" title="John und Madeleine beraten sich zu einem Thema — du liest mit">🤝 Beraterrunde</button>
      <button class="jm2" onclick="madToggle(true)" title="Chat mit Madeleine">💬 Sprechen</button>
    </div></div>`;
  }
  const oKachel=window.johnKachel;
  window.johnKachel=function(){ const h=oKachel.apply(this,arguments); setTimeout(madMalen,0); return h+madKachel(); };
  /* Die Seite hat beim Laden schon gerendert, bevor diese Datei kam — der Wrapper greift erst beim nächsten
     render(). Deshalb hier einmal von Hand in die erste Sektion („Heute im Blick") hängen; John selbst steht
     meist im Dock oben (compass-edit.js), die Karte bleibt im Raster. Klapp-Listener nur für die eigene h3 —
     cardsVerdrahten() noch einmal zu rufen, hängt an jede andere Karte einen zweiten Listener. */
  function einhaengen(){
    if(document.getElementById('madKachel')) return;
    const j=document.getElementById('johnKachel');
    const ziel=(j && j.parentElement && j.parentElement.id!=='obenDock') ? j.parentElement : document.querySelector('#grid section.sec .grid');
    if(!ziel) return;
    ziel.insertAdjacentHTML('beforeend', madKachel());
    const h3=document.querySelector('#madKachel>h3');
    if(h3){ const cv=document.createElement('span'); cv.className='cv'; cv.textContent='▾'; cv.title='Karte zuklappen'; h3.appendChild(cv);
      h3.addEventListener('click',e=>{ if(e.target.closest('a,button,input,.seg,label')) return; h3.parentElement.classList.toggle('min'); }); }
    madMalen();
  }

  window.madOpen=madOpen; window.madToggle=madToggle; window.madRunde=madRunde; window.madVoll=madVoll; window.madRundenLaden=madRundenLaden; window.madStatus=madStatus;
  /* Live-Zeile für den Einstieg in der Focus View (compass-focus.js › KATALOG › madeleine) */
  window.madZeile=function(){ return { t: statusText(), live: !!(MAD.status&&MAD.status.ok&&MAD.status.key), warn: MAD.status===false }; };
  css(); dialog(); einhaengen(); madStatus(); madRundenLaden();
  /* Danach hängt die Karte am Layout-Speicher von compass-edit.js über ihren h3-Schlüssel „👩‍💼 Madeleine"
     wie jede andere: verschieben, oben andocken, ausblenden. */
})();
