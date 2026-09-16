/* compass-tower.js — die Tower-Karte im Compass (16.09.2026)

   Bene: „FAB und Tower sind auch angeschlossen?“ → „ja, auch bei mir nachziehen“. Der Tower (Matching und
   Ausschreibungen) hat seine Zahlen bisher nur auf der eigenen Seite gezeigt. Diese Datei holt dieselben
   Summen über GET /api/tower — beim persönlichen Server aus der lokalen stand.json, beim Compass-Server auf dem
   Wolkenserver über die Tür der Tower-Seite — und setzt eine Karte direkt hinter die Finanzkarte.

   Bauart wie compass-live.js: hängt sich von außen an, fasst dashboard.html nicht an. render() malt das Raster
   neu — ein MutationObserver setzt die Karte danach wieder ein.

   Drei Zustände, die nie gleich aussehen dürfen:
     · nicht eingerichtet (NO_FIRMA, NICHT_IM_PAKET, kein Server beim allerersten Abruf) → keine Karte
     · eingerichtet, aber ohne Zahlen (NO_KEY, AUTH_INVALID, NO_DATA …)              → Karte mit Klartext
     · Zahlen da                                                                       → Karte, Alter des Stands sichtbar
   Nur Summen — keine Namen, keine Anbieter, keine Titel. pool.antwort_h kommt gar nicht erst an.            */
(function(){
  if(typeof JOHN_API==='undefined') return;
  const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const T={ data:null, fehler:null, eingerichtet:false, zeit:0 };
  const AUS=['NO_FIRMA','NICHT_IM_PAKET'];

  async function laden(fresh){
    let j=null;
    try{ const r=await fetch(JOHN_API+'/api/tower'+(fresh?'?fresh=1':''),{cache:'no-store'}); j=await r.json(); }catch(e){ j=null; }
    if(j==null){ if(T.eingerichtet){ T.veraltet=true; } malen(); return; }
    if(j.ok){ T.data=j; T.fehler=null; T.eingerichtet=true; T.veraltet=false; }
    else if(AUS.indexOf(j.error)>=0){ T.eingerichtet=false; T.data=null; T.fehler=null; }
    else { T.eingerichtet=true; T.fehler=j; T.data=null; T.veraltet=false; }
    T.zeit=Date.now();
    malen();
  }

  const zahl=v=>v==null?'–':String(v);
  function kpi(v,l){ return `<div class="kpi"><div class="v">${v}</div><div class="l">${H(l)}</div></div>`; }
  function datumKurz(s){ s=String(s||''); return s.length>=10 ? s.slice(8,10)+'.'+s.slice(5,7)+'.' : s; }

  function inhalt(){
    if(T.fehler){
      const f=T.fehler;
      return { stand:(f.error==='NO_KEY'?'kein Schlüssel':'Fehler'),
        body:`<div class="empty">Tower meldet: ${H(f.error||'unbekannter Fehler')}${f.hint?' — '+H(f.hint):''}</div>`
          + (f.url?`<div class="chipbar" style="margin-top:8px"><a class="btn" href="${H(f.url)}" target="_blank" rel="noopener">🗼 Tower öffnen</a></div>`:'') };
    }
    const d=T.data, l=d.ledger||{}, p=d.pool||{}, st=l.nach_status||{};
    const a=d.alterStd;
    const ton=a==null?'gry':(a<=26?'grn':a<=72?'amb':'red');
    const alt=a==null?'Alter unbekannt':(a<1?'gerade eben':a<48?`vor ${Math.round(a)} h`:`vor ${Math.round(a/24)} Tagen`);
    const quote=l.angebote?Math.round(100*(l.antworten||0)/l.angebote):null;
    const reihe1=`<div class="kpis">
        ${kpi(zahl(l.ausschreibungen),'Ausschreibungen'+(l.seit?' seit '+datumKurz(l.seit):''))}
        ${kpi(zahl(l.angebote),'Angebote an '+zahl(l.personen)+' Personen')}
        ${kpi(zahl(l.antworten)+(quote!=null?`<span class="l"> · ${quote} %</span>`:''),'Antworten')}
        ${kpi(zahl(l.weiter_verfolgt),'weiter verfolgt')}
      </div>`;
    const warten=st.wartet||0;
    const zeile2=`<div class="m" style="margin-top:8px"><b>Prüfkette:</b>
        ${warten?`<span class="tag amb">${warten} warten auf Antwort</span>`:'<span class="tag grn">nichts wartet</span>'}
        ${l.ohne_antwort?` <span class="tag gry">${l.ohne_antwort} Angebote ohne Antwort</span>`:''}
        ${l.antwort_h_median!=null?` <span class="tag gry">Antwort im Median nach ${String(l.antwort_h_median).replace('.',',')} h</span>`:''}</div>`;
    const zeile3=d.pool?`<div class="m" style="margin-top:6px"><b>Pool:</b>
        ${zahl(p.pool)} im Kollektiv · ${zahl(p.verfuegbar)} verfügbar · ${zahl(p.im_einsatz)} im Einsatz · ${zahl(p.offen)} offene Vorgänge${p.platziert_90!=null?` · ${p.platziert_90} platziert (90 T)`:''}</div>`:'';
    const fehlt=(d.fehlt||[]).length?`<div class="m" style="margin-top:6px"><span class="tag red">teilweise blind</span> ${H(d.fehlt.join(' · '))}</div>`:'';
    return { stand:`<span class="tag ${ton}">Stand ${H(alt)}</span>`,
      body: reihe1+zeile2+zeile3+fehlt
        + `<div class="chipbar" style="margin-top:8px"><a class="btn" href="${H(d.url)}" target="_blank" rel="noopener">🗼 Tower öffnen</a></div>`
        + `<div class="mini">Quelle: Tower (Ledger der Prüfkette + Pool-Kennzahlen, nur Summen)${T.veraltet?' · Server gerade nicht erreichbar, letzter Stand':''}</div>` };
  }

  function karte(){
    const i=inhalt();
    return `<div class="card s6 tone-va" id="towerCard"><h3>🗼 Tower <span class="cnt" id="towerStand">${i.stand}</span></h3><div id="towerBody">${i.body}</div></div>`;
  }

  let MALT=false;
  function malen(){
    const alt=document.getElementById('towerCard');
    if(!T.eingerichtet || (!T.data && !T.fehler)){ if(alt) alt.remove(); return; }
    const html=karte();
    MALT=true;
    try{
      if(alt){ alt.outerHTML=html; }
      else {
        const fin=document.getElementById('finCard');
        if(!fin) return;
        fin.insertAdjacentHTML('afterend', html);
      }
    } finally { MALT=false; }
  }

  // render() ersetzt das Raster — danach fehlt die Karte, bis sie hier wieder eingesetzt wird.
  const mo=new MutationObserver(()=>{ if(MALT) return; if(T.eingerichtet && !document.getElementById('towerCard') && document.getElementById('finCard')) malen(); });
  mo.observe(document.body,{childList:true,subtree:true});

  laden(false);
  setInterval(()=>{ if(!document.hidden) laden(false); }, 15*60*1000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && Date.now()-T.zeit>15*60*1000) laden(false); });
  window.compassTower={ laden, zustand:()=>T };
})();
