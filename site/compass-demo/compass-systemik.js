/* compass-systemik.js — das Wirkungsbild, das neben Coach und Fachberatung mitläuft (10.09.2026)

   die Nutzerin: „Neben Fachberatung und Coach müssen immer interaktive systemische Infografiken mitlaufen, damit
   schnell Kontext und Schlussfolgerung gesehen werden kann. Call to actions für Zustimmung und
   Ablehnung, angelehnt an unsere Gamification." Und zum leeren Feld rechts neben der breiten Karte:
   „hier kommt ein Infobox-Bereich hin, mit schlauen Graphiken, die thematischen Background geben."

   Bauart wie compass-live.js und compass-madeleine.js: hängt sich von außen an, fasst dashboard.html
   nicht an. Die Karte von Coach (#stapelBody) und die von Fachberatung (#madBody) bekommen einen zweiten
   Bereich daneben; ist die Karte schmal, rutscht er darunter. Beide Karten werden von ihren eigenen
   Funktionen neu gemalt — deshalb wacht ein MutationObserver darüber, dass der Rahmen wieder steht.

   Woher die Daten kommen: NICHT aus dem Text geraten. `POST /api/systembild` legt Coach (bzw. dem
   eingestellten Backend) den Beratungstext vor, der ohnehin schon da ist, und bekommt geprüftes JSON
   zurück — Knoten, Wirkungen mit Vorzeichen, Schlussfolgerung, und die zwei Sätze für Zustimmung und
   Ablehnung. Fällt die Prüfung durch, steht hier kein Bild, sondern warum es keines gibt. Der Server
   rechnet je Text nur einmal (SHA-256 als Schlüssel), Folgeaufrufe kommen aus dem Cache.               */
(function(){
  if(typeof JOHN_API==='undefined') return;
  const API=()=>JOHN_API;
  const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sag=(m,a)=>{ try{ if(typeof toast==='function') toast(m,a); }catch(e){} };
  const kontext=()=>{ try{ return typeof johnKontext==='function' ? johnKontext() : ''; }catch(e){ return ''; } };

  /* Zwei Felder, gleicher Aufbau. `feld` = das Element, neben das die Box gehört; `karte` = die Karte,
     deren Breite über ein- oder zweispaltig entscheidet. */
  const FELDER={
    mad:  { feld:'madBody',    karte:'madKachel',  quelle:'beraterrunde', wer:'Fachberatung & Coach' },
    john: { feld:'stapelBody', karte:'johnKachel', quelle:'stapel',       wer:'Coach' }
  };
  const S={};
  Object.keys(FELDER).forEach(k=>{ S[k]={ bild:null, text:'', thema:'', laeuft:false, fehler:'', leer:'',
    stand:'', model:'', cache:false, fokus:'', spiel:-1, spielT:0, eigen:false, ctaBusy:false, ctaFehler:'' }; });

  /* ---------- CSS ---------- */
  function css(){
    const c=[
      '.sysgrid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}',
      '.card.sysbreit .sysgrid{grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr)}',
      '.syslinks{min-width:0}',
      '.sysbox{min-width:0;border:1px solid var(--line);border-radius:14px;background:var(--panel2);padding:12px 13px}',
      '.sysbox .syskopf{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:8px}',
      '.sysbox .systitel{font-size:12.5px;font-weight:800;letter-spacing:.01em}',
      '.sysbox .sysmeta{font-size:10.5px;color:var(--sub);margin-left:auto}',
      '.sysbox .sysmuted{font-size:12px;color:var(--sub);line-height:1.5}',
      '.sysbox svg{display:block;width:100%;max-width:620px;margin:0 auto;height:auto;overflow:visible}',
      /* Knoten */
      '.sysn{cursor:pointer}',
      '.sysn .nb{fill:var(--panel);stroke:var(--line);stroke-width:1.2}',
      '.sysn .nt{font:700 11px/1.1 var(--sans,system-ui);fill:var(--ink)}',
      '.sysbox.eng .sysn .nt{font-size:15px}.sysbox.eng .sysn .nw{font-size:13px}.sysbox.eng .sysz text{font-size:14px}.sysbox.eng .sysn .pf{font-size:14px}',
      '.sysn .nw{font:600 9.5px/1 var(--sans,system-ui);fill:var(--sub)}',
      '.sysn.hebel .nb{stroke:var(--va);stroke-width:2}',
      '.sysn.risiko .nb{stroke:var(--bad)}',
      '.sysn.ziel .nb{stroke:var(--ok)}',
      '.sysn.fluss .nb{stroke-dasharray:3 3}',
      '.sysn.hot .nb{stroke:var(--va);stroke-width:2.4}',
      '.sysn.dim{opacity:.28}',
      '.sysn.an .nb{fill:var(--panel2);stroke-width:2.2}',
      '.sysn.an.auf .nb{stroke:var(--ok)}.sysn.an.ab .nb{stroke:var(--bad)}',
      '.sysn .pf{font:800 10px/1 var(--sans,system-ui)}',
      '.sysn.auf .pf{fill:var(--ok)}.sysn.ab .pf{fill:var(--bad)}.sysn.mix .pf{fill:var(--sub)}',
      /* Kanten */
      '.sysk{fill:none;stroke-width:1.6}',
      '.sysk.plus{stroke:var(--ok)}.sysk.minus{stroke:var(--bad)}',
      '.sysk.spur{stroke-dasharray:5 4}',
      '.sysk.dim{opacity:.16}',
      '.sysk.hot{stroke-width:3}',
      '.syskp{stroke:none}.syskp.plus{fill:var(--ok)}.syskp.minus{fill:var(--bad)}',
      '.syskp.dim{opacity:.16}',
      '.sysz circle{fill:var(--panel);stroke-width:1.2}',
      '.sysz.plus circle{stroke:var(--ok)}.sysz.minus circle{stroke:var(--bad)}',
      '.sysz text{font:800 10px/1 var(--sans,system-ui);text-anchor:middle}',
      '.sysz.plus text{fill:var(--ok)}.sysz.minus text{fill:var(--bad)}',
      '.sysz.dim{opacity:.16}',
      /* Beiwerk */
      '.sysleg{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--sub);margin-top:6px}',
      '.sysleg b{font-weight:800}',
      '.syswarum{margin-top:7px;font-size:11.5px;line-height:1.45;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:7px 9px;min-height:34px}',
      '.syswarum .w{color:var(--sub)}',
      '.syszahlen{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
      '.syszahl{border:1px solid var(--line);border-radius:9px;background:var(--panel);padding:4px 8px;font-size:11px;line-height:1.25}',
      '.syszahl b{display:block;font-size:12.5px;font-weight:800}',
      '.syszahl span{color:var(--sub);font-size:10px}',
      '.sysschluss{margin-top:9px;font-size:12.5px;line-height:1.5;font-weight:700;border-left:3px solid var(--va);padding-left:9px}',
      '.sysoffen{margin-top:5px;font-size:11px;color:var(--sub)}',
      '.systasten{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center}',
      '.systasten .sysklein{font:inherit;font-size:11px;padding:4px 9px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer}',
      '.systasten .sysklein:hover{border-color:var(--va)}',
      /* Call to Action — in der Sprache der Blüten: grün heißt angenommen, gold ist der Nordstern */
      '.syscta{margin-top:10px;border-top:1px dashed var(--line);padding-top:9px}',
      '.syscta .sysfrage{font-size:12.5px;font-weight:800;line-height:1.4;margin-bottom:7px}',
      '.syscta .reihe{display:flex;gap:7px;flex-wrap:wrap;align-items:center}',
      '.sysbtn{position:relative;font:inherit;font-size:12px;font-weight:700;padding:8px 12px;border-radius:11px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:7px}',
      '.sysbtn small{font-weight:800;font-size:10px;opacity:.75}',
      '.sysbtn.ja{border-color:var(--ok);box-shadow:inset 0 0 0 1px rgba(0,0,0,0)}',
      '.sysbtn.ja:hover{background:var(--ok);color:#fff}',
      '.sysbtn.nein{border-color:var(--bene,var(--sub))}',
      '.sysbtn.nein:hover{border-color:var(--bad);color:var(--bad)}',
      '.sysbtn:disabled{opacity:.5;cursor:default}',
      '.sysbtn.gewonnen{animation:sysglueh 1.2s ease-out}',
      '@keyframes sysglueh{0%{box-shadow:0 0 0 0 rgba(120,190,60,.55)}100%{box-shadow:0 0 0 16px rgba(120,190,60,0)}}',
      '.syseigen{flex:1 1 160px;min-width:120px;font:inherit;font-size:12px;padding:6px 9px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink)}',
      '.sysfehl{font-size:11px;color:var(--bad);margin-top:5px}',
      '.sysfuss{font-size:10.5px;color:var(--sub);margin-top:7px}',
      '@media(max-width:720px){.card.sysbreit .sysgrid{grid-template-columns:minmax(0,1fr)}}'
    ];
    const st=document.createElement('style'); st.id='sysCss'; st.textContent=c.join('\n'); document.head.appendChild(st);
  }

  /* ---------- Rahmen: die Box neben das Feld hängen ---------- */
  let RO=null;
  /* Zweispaltig ab 880 px Kartenbreite. Der ResizeObserver allein reicht nicht: die Karte wird von
     ihrer eigenen Render-Funktion ersetzt, dann beobachtet er ein Element, das gar nicht mehr im
     Dokument haengt. Deshalb wird die Breite zusaetzlich bei jedem Malen und bei jedem Fensterwechsel
     nachgerechnet — das kostet nichts und ist die Fassung, die immer stimmt. */
  function breitePruefen(){
    Object.keys(FELDER).forEach(a=>{
      const k=document.getElementById(FELDER[a].karte);
      if(k) k.classList.toggle('sysbreit', k.getBoundingClientRect().width>=880);
    });
  }
  function beobachten(karte){
    if(!karte) return;
    if(!RO && typeof ResizeObserver==='function'){
      RO=new ResizeObserver(es=>{ for(const e of es){ e.target.classList.toggle('sysbreit', e.contentRect.width>=880); } });
    }
    if(RO && !karte.dataset.sysRo){ karte.dataset.sysRo='1'; RO.observe(karte); }
    karte.classList.toggle('sysbreit', karte.getBoundingClientRect().width>=880);
  }
  function rahmen(art){
    const f=FELDER[art];
    const feld=document.getElementById(f.feld); if(!feld) return false;
    const karte=document.getElementById(f.karte);
    beobachten(karte);
    if(feld.parentElement && feld.parentElement.classList.contains('syslinks')) return true;
    const gitter=document.createElement('div'); gitter.className='sysgrid';
    const links=document.createElement('div'); links.className='syslinks';
    const box=document.createElement('aside'); box.className='sysbox'; box.id='sysbox-'+art;
    feld.parentNode.insertBefore(gitter, feld);
    links.appendChild(feld); gitter.appendChild(links); gitter.appendChild(box);
    box.addEventListener('click', ev=>klick(art, ev));
    box.addEventListener('keydown', ev=>{ if(ev.key==='Enter' && ev.target.classList.contains('syseigen')){ ev.preventDefault(); ctaEigen(art); } });
    malen(art);
    return true;
  }
  function rahmenAlle(){ Object.keys(FELDER).forEach(a=>rahmen(a)); }

  /* ---------- Quelltexte ---------- */
  /* Wichtig: eine tote Quelle darf nie aussehen wie eine leere. Antwortet der Server nicht, sagt die
     Box das — sonst stuende dort "Noch keine Beraterrunde", waehrend die Runde von gestern in der
     Datei liegt. */
  async function quelleMad(){
    let j=null;
    try{
      const r=await fetch(API()+'/api/beraterrunde?n=1',{cache:'no-store',signal:AbortSignal.timeout(20000)});
      j=await r.json();
    }catch(e){ return { fehler:'Die letzte Beraterrunde ließ sich nicht laden — läuft john-server.cmd?' }; }
    const runde=((j&&j.runden)||[])[0]; if(!runde) return null;
    const text=(runde.beitraege||[]).map(b=>b.wer+': '+String(b.text||'').trim()).join('\n\n');
    if(text.trim().length<80) return null;
    return { thema:runde.thema||'Beraterrunde', text:text, stand:runde.datum||'' };
  }
  function quelleJohn(){
    let offen=[]; try{ offen=(typeof stapelOffen==='function')?stapelOffen():[]; }catch(e){}
    if(!offen.length) return null;
    const zeilen=offen.map((p,i)=>`${i+1}. ${p.titel} — ${p.satz||''}${p.aktion?` [Coach- Vorschlag: ${p.aktion.label||p.aktion.art}]`:''}`);
    const text='Coach- Stapel für heute, in dieser Reihenfolge:\n'+zeilen.join('\n');
    if(text.trim().length<80) return null;
    return { thema:offen[0].titel, text:text, punkt:offen[0] };
  }

  /* ---------- Holen: eine Schlange, der Server arbeitet seriell ---------- */
  let SCHLANGE=Promise.resolve();
  function anstellen(fn){ SCHLANGE=SCHLANGE.then(fn).catch(e=>{ console.error('systemik:',e); }); return SCHLANGE; }
  async function holen(art, frisch){
    const s=S[art], f=FELDER[art];
    const q = art==='mad' ? await quelleMad() : quelleJohn();
    if(q && q.fehler){
      /* Einmal nachfassen: nach dem Aufwachen aus dem Ruhezustand ist der erste Abruf oft der
         einzige, der scheitert. */
      s.bild=null; s.leer=''; s.fehler=q.fehler; malen(art);
      if(!s.zweiterVersuch){ s.zweiterVersuch=true; setTimeout(()=>anstellen(()=>holen(art,false)), 45000); }
      return;
    }
    s.zweiterVersuch=false;
    if(!q){
      s.bild=null; s.fehler=''; s.leer = art==='mad'
        ? 'Noch keine Beraterrunde. Sobald Coach und Fachberatung beraten haben, steht hier das Wirkungsbild dazu.'
        : 'Der Stapel ist leer — es gibt gerade nichts zu verknüpfen.';
      malen(art); return;
    }
    s.leer='';
    if(!frisch && s.bild && s.text===q.text) { malen(art); return; }
    s.text=q.text; s.thema=q.thema; s.punkt=q.punkt||null;
    s.laeuft=true; s.fehler=''; s.fokus=''; s.spiel=-1; malen(art);
    try{
      const r=await fetch(API()+'/api/systembild',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({quelle:f.quelle, thema:q.thema, text:q.text, kontext:kontext(), fresh:!!frisch}),
        signal:AbortSignal.timeout(300000)});
      const j=await r.json();
      if(!r.ok||!j.ok){ s.bild=null; s.fehler=j.hint||j.error||('Fehler '+r.status); }
      else { s.bild=j.bild||null; s.stand=j.erzeugt||''; s.model=j.model||''; s.cache=!!j.cache;
             if(!s.bild) s.fehler='Aus diesem Text ließ sich kein belastbares Wirkungsbild ziehen.'; }
    }catch(e){
      s.bild=null;
      s.fehler = /abort|timeout/i.test(e.name||e.message||'') ? 'Das Zeichnen hat zu lange gedauert.' : 'Server nicht erreichbar — läuft john-server.cmd?';
    }
    s.laeuft=false; malen(art);
  }

  /* ---------- Rechnen: Wirkungsketten ab dem Hebel ---------- */
  /* Ein Knoten bekommt nur dann eine Richtung, wenn alle Wege dorthin dasselbe sagen. Zwei Wege mit
     verschiedenem Vorzeichen heißen „gemischt" (±) — das ist die ehrlichere Aussage als ein Pfeil,
     der vom Zufall der Reihenfolge abhängt. */
  function ketten(b){
    const stufe={}, richtung={};
    stufe[b.hebel]=0; richtung[b.hebel]=1;
    let rand=[b.hebel], t=0;
    while(rand.length && t<8){
      const naechste=[];
      rand.forEach(id=>{
        b.wirkungen.filter(w=>w.von===id).forEach(w=>{
          const r=(richtung[id]||1)*(w.art==='minus'?-1:1);
          if(stufe[w.nach]==null){ stufe[w.nach]=stufe[id]+1; richtung[w.nach]=r; naechste.push(w.nach); }
          else if(richtung[w.nach]!==r) richtung[w.nach]=0;
        });
      });
      rand=naechste; t++;
    }
    let max=0; Object.keys(stufe).forEach(k=>{ if(stufe[k]>max) max=stufe[k]; });
    return { stufe, richtung, max };
  }

  /* ---------- Zeichnen ---------- */
  function umbrechen(t,max){
    const worte=String(t||'').split(/\s+/); const out=[]; let z='';
    worte.forEach(w=>{ if((z+' '+w).trim().length>max){ if(z) out.push(z); z=w; } else z=(z+' '+w).trim(); });
    if(z) out.push(z);
    if(out.length>2){ out[1]=(out[1]+' …').slice(0,max+2); out.length=2; }
    return out;
  }
  function svgBauen(art, b){
    const s=S[art];
    const N=b.knoten, n=N.length;
    const W=560, HOCH = n>=6 ? 400 : (n>=5 ? 370 : 330);
    const cx=W/2, cy=HOCH/2;
    const rx=W/2-104, ry=HOCH/2-56;
    const P={}, B={};
    N.forEach((k,i)=>{
      const w=-Math.PI/2 + i*2*Math.PI/n;
      P[k.id]={ x: cx+rx*Math.cos(w), y: cy+ry*Math.sin(w) };
      const z=umbrechen(k.name,15);
      const laenge=Math.max.apply(null,z.map(x=>x.length).concat([k.wert?Math.min(String(k.wert).length,18):0]));
      B[k.id]={ w: Math.min(168, Math.max(86, laenge*6.6+22)), h: 20+z.length*13+(k.wert?12:0), z:z };
    });
    const kette=ketten(b);
    const spiel=s.spiel;
    const fokus=s.fokus;
    const nachbar=id=>{ const set=new Set([id]); b.wirkungen.forEach(w=>{ if(w.von===id) set.add(w.nach); if(w.nach===id) set.add(w.von); }); return set; };
    const sichtbar = fokus ? nachbar(fokus) : null;

    const teile=[`<svg viewBox="0 0 ${W} ${HOCH}" role="img" aria-label="Wirkungsbild: ${H(b.titel||b.schluss)}">`];
    /* Erst die Kanten, damit die Knoten darüber liegen */
    b.wirkungen.forEach((w,i)=>{
      const a=P[w.von], e=P[w.nach]; if(!a||!e) return;
      const mx=(a.x+e.x)/2, my=(a.y+e.y)/2;
      const dx=e.x-a.x, dy=e.y-a.y, len=Math.sqrt(dx*dx+dy*dy)||1;
      const bug=Math.min(46, len*0.17);
      const kx=mx - dy/len*bug, ky=my + dx/len*bug;
      const rand=(p,box,zx,zy)=>{
        const vx=zx-p.x, vy=zy-p.y;
        const hw=box.w/2+5, hh=box.h/2+5;
        const sx = vx ? hw/Math.abs(vx) : 1e9, sy = vy ? hh/Math.abs(vy) : 1e9;
        const f=Math.min(sx,sy,1);
        return { x:p.x+vx*f, y:p.y+vy*f };
      };
      const s1=rand(a,B[w.von],kx,ky), s2=rand(e,B[w.nach],kx,ky);
      /* Pfeilspitze in Richtung Kontrollpunkt → Ende */
      const wx=s2.x-kx, wy=s2.y-ky, wl=Math.sqrt(wx*wx+wy*wy)||1;
      const ux=wx/wl, uy=wy/wl, px=-uy, py=ux;
      const sp=`M ${s2.x.toFixed(1)},${s2.y.toFixed(1)} L ${(s2.x-ux*9+px*4.2).toFixed(1)},${(s2.y-uy*9+py*4.2).toFixed(1)} L ${(s2.x-ux*9-px*4.2).toFixed(1)},${(s2.y-uy*9-py*4.2).toFixed(1)} Z`;
      const zx=0.25*s1.x+0.5*kx+0.25*s2.x, zy=0.25*s1.y+0.5*ky+0.25*s2.y;
      const st=kette.stufe[w.von];
      let kl='';
      if(sichtbar && !(w.von===fokus||w.nach===fokus)) kl=' dim';
      else if(spiel>=0){ kl = (st!=null && st<=spiel) ? ' hot' : ' dim'; }
      teile.push(`<path class="sysk ${w.art}${w.verzoegert?' spur':''}${kl}" d="M ${s1.x.toFixed(1)},${s1.y.toFixed(1)} Q ${kx.toFixed(1)},${ky.toFixed(1)} ${s2.x.toFixed(1)},${s2.y.toFixed(1)}" data-w="${i}"></path>`);
      teile.push(`<path class="syskp ${w.art}${kl}" d="${sp}"></path>`);
      teile.push(`<g class="sysz ${w.art}${kl}" data-w="${i}"><circle cx="${zx.toFixed(1)}" cy="${zy.toFixed(1)}" r="7.5"></circle><text x="${zx.toFixed(1)}" y="${(zy+3.4).toFixed(1)}">${w.art==='minus'?'−':'+'}</text></g>`);
    });
    N.forEach(k=>{
      const p=P[k.id], box=B[k.id];
      const st=kette.stufe[k.id], ri=kette.richtung[k.id];
      let kl=k.art;
      if(k.id===b.hebel) kl+=' hebel';
      if(fokus){ if(k.id===fokus) kl+=' hot'; else if(!sichtbar.has(k.id)) kl+=' dim'; }
      if(spiel>=0 && st!=null && st<=spiel){ kl+=' an '+(ri>0?'auf':ri<0?'ab':'mix'); }
      const x=p.x-box.w/2, y=p.y-box.h/2;
      const zeilen=box.z.map((z,i)=>`<text class="nt" x="${p.x.toFixed(1)}" y="${(y+16+i*13).toFixed(1)}" text-anchor="middle">${H(z)}</text>`).join('');
      const wert=k.wert?`<text class="nw" x="${p.x.toFixed(1)}" y="${(y+box.h-6).toFixed(1)}" text-anchor="middle">${H(k.wert)}</text>`:'';
      const pfeil=(spiel>=0&&st!=null&&st<=spiel)?`<text class="pf" x="${(x+box.w-7).toFixed(1)}" y="${(y+12).toFixed(1)}" text-anchor="end">${ri>0?'▲':ri<0?'▼':'±'}</text>`:'';
      teile.push(`<g class="sysn ${kl}" data-id="${H(k.id)}" tabindex="0" role="button" aria-label="${H(k.name)}">`+
        `<rect class="nb" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${box.w}" height="${box.h}" rx="9"></rect>${zeilen}${wert}${pfeil}</g>`);
    });
    teile.push('</svg>');
    return teile.join('');
  }
  function warumZeile(art,b){
    const s=S[art];
    if(s.fokus){
      const k=b.knoten.find(x=>x.id===s.fokus);
      if(k){
        const rein=b.wirkungen.filter(w=>w.nach===k.id).map(w=>`${(b.knoten.find(x=>x.id===w.von)||{}).name} ${w.art==='minus'?'↓':'↑'}`);
        const raus=b.wirkungen.filter(w=>w.von===k.id).map(w=>`${w.art==='minus'?'↓':'↑'} ${(b.knoten.find(x=>x.id===w.nach)||{}).name}`);
        return `<b>${H(k.name)}${k.wert?' · '+H(k.wert):''}</b> — ${H(k.warum||'')}`+
          (rein.length?`<div class="w">wirkt herein: ${H(rein.join(' · '))}</div>`:'')+
          (raus.length?`<div class="w">wirkt hinaus: ${H(raus.join(' · '))}</div>`:'');
      }
    }
    if(s.spiel>=0){
      const kette=ketten(b);
      const dran=b.knoten.filter(k=>kette.stufe[k.id]===s.spiel);
      const hebel=b.knoten.find(k=>k.id===b.hebel)||{name:'dem Hebel'};
      if(s.spiel===0) return `<b>Start: ${H(hebel.name)}</b> — <span class="w">angenommen, du drehst hier nach oben. Wo landet das?</span>`;
      if(dran.length) return dran.map(k=>{ const r=kette.richtung[k.id];
        return `<b>${H(k.name)} ${r>0?'steigt':r<0?'sinkt':'wird gemischt getroffen'}</b>`; }).join(' · ')+
        `<div class="w">Schritt ${s.spiel} nach ${H(hebel.name)}</div>`;
      return `<span class="w">Weiter wirkt es von hier aus nicht.</span>`;
    }
    const hebel=b.knoten.find(k=>k.id===b.hebel);
    return `<span class="w">Klick auf eine Größe zeigt, was auf sie wirkt${hebel?` — Hebel ist ${H(hebel.name)}`:''}.</span>`;
  }
  function inhalt(art){
    const s=S[art], f=FELDER[art];
    const kopf=(rechts)=>`<div class="syskopf"><span class="systitel">🕸️ Wirkungsbild</span>`+
      `<span class="sysmeta">${rechts}</span></div>`;
    if(s.laeuft) return kopf(H(f.wer))+`<div class="sysmuted">zeichnet das Wirkungsbild aus dem, was gerade beraten wurde … das dauert einen Moment; der Server ist so lange belegt.</div>`;
    /* Vor dem ersten Holen: nicht "kein Bild" behaupten, sondern sagen, dass es gleich kommt —
       der erste Lauf wartet bewusst, bis die Karten selbst geladen haben. */
    if(!s.text && !s.fehler && !s.leer) return kopf(H(f.wer))+`<div class="sysmuted">gleich — erst laden die Karten, dann zeichne ich, was daraus folgt.</div>`;
    if(s.leer)   return kopf(H(f.wer))+`<div class="sysmuted">${H(s.leer)}</div>`;
    if(!s.bild)  return kopf(H(f.wer))+`<div class="sysmuted">${H(s.fehler||'Noch kein Wirkungsbild.')}</div>`+
      `<div class="systasten"><button class="sysklein" data-tun="neu">↻ Noch einmal versuchen</button></div>`;
    const b=s.bild;
    const kette=ketten(b);
    const stand=s.stand?new Date(s.stand).toLocaleString(typeof LOC==='function'?LOC():'de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    return kopf(H(f.wer)+(stand?' · '+H(stand):''))+
      (b.titel?`<div class="sysmuted" style="margin:-4px 0 7px">${H(b.titel)}</div>`:'')+
      svgBauen(art,b)+
      `<div class="sysleg"><span><b>+</b> mehr → mehr</span><span><b>−</b> mehr → weniger</span>`+
        `<span style="border-bottom:1px dashed currentColor">gestrichelt</span><span>wirkt verzögert</span>`+
        (b.schleifen&&b.schleifen.length?`<span>⟳ ${H(b.schleifen.map(x=>x.name||(x.art==='daempfend'?'dämpfender Kreis':'verstärkender Kreis')).join(' · '))}</span>`:'')+
      `</div>`+
      `<div class="syswarum">${warumZeile(art,b)}</div>`+
      `<div class="systasten">`+
        `<button class="sysklein" data-tun="spiel">${s.spiel>=0&&s.spiel<kette.max?'▶ weiter':'▶ Wirkung durchspielen'}</button>`+
        (s.fokus||s.spiel>=0?`<button class="sysklein" data-tun="reset">⤾ ganzes Bild</button>`:'')+
        `<button class="sysklein" data-tun="neu" title="Neu zeichnen lassen (rechnet wirklich neu)">↻ neu</button>`+
      `</div>`+
      (b.kennzahlen&&b.kennzahlen.length?`<div class="syszahlen">${b.kennzahlen.map(z=>
        `<div class="syszahl"><b>${H(z.wert)}</b>${H(z.label)}${z.stand?`<span> · ${H(z.stand)}</span>`:''}</div>`).join('')}</div>`:'')+
      `<div class="sysschluss">${H(b.schluss)}</div>`+
      (b.offen?`<div class="sysoffen">Nicht im Bild: ${H(b.offen)}</div>`:'')+
      ctaHtml(art,b);
  }
  /* ---------- Call to Action ---------- */
  /* Zwei Tasten in der Sprache der Sache, nicht „Ja"/„Nein" — und sie tun wirklich etwas:
     bei Fachberatung geht die Entscheidung in die Beraterrunde (Coach antwortet darauf), bei Coach
     löst die Zustimmung genau die Aktion aus, die er vorgeschlagen hat. XP wie bei jeder anderen
     Entscheidung im Compass. */
  function ctaMoeglich(art){
    if(art==='mad') return typeof madEntscheiden==='function';
    return !!(S.john.punkt && typeof stapelAktion==='function');
  }
  function ctaHtml(art,b){
    const s=S[art];
    if(!ctaMoeglich(art)) return '';
    if(s.ctaBusy) return `<div class="syscta"><div class="sysmuted">wird festgehalten …</div></div>`;
    const frage=b.frage||'';
    return `<div class="syscta">`+
      (frage?`<div class="sysfrage">❓ ${H(frage)}</div>`:'')+
      `<div class="reihe">`+
        `<button class="sysbtn ja" data-tun="ja">👍 ${H(b.zustimmung)} <small>+8 XP</small></button>`+
        `<button class="sysbtn nein" data-tun="nein">👎 ${H(b.ablehnung)}</button>`+
      `</div>`+
      `<div class="reihe" style="margin-top:6px">`+
        `<input class="syseigen" type="text" placeholder="… oder in eigenen Worten (Enter)" value="${H(s.eigenText||'')}">`+
        `<button class="sysklein" data-tun="eigen">Festhalten</button>`+
      `</div>`+
      (s.ctaFehler?`<div class="sysfehl">${H(s.ctaFehler)}</div>`:'')+
      `<div class="sysfuss">${art==='mad'?'Geht in john/coaching/beraterrunde.md — Coach und Fachberatung lesen es beide.':'Zustimmen löst Coach- Vorschlag aus; ablehnen legt den Punkt zurück und öffnet das Gespräch.'}</div>`+
    `</div>`;
  }
  async function ctaWaehlen(art, wahl, text){
    const s=S[art], b=s.bild; if(!b||s.ctaBusy) return;
    const satz = text || (wahl==='ja' ? b.zustimmung : b.ablehnung);
    s.ctaFehler='';
    if(art==='mad'){
      s.ctaBusy=true; malen(art);
      try{
        await madEntscheiden(satz);
        s.ctaBusy=false; s.eigenText='';
        belohnen(art, wahl==='ja'?8:5, wahl);
      }catch(e){ s.ctaBusy=false; s.ctaFehler='Nicht festgehalten: '+(e.message||e); malen(art); }
      return;
    }
    const p=s.punkt; if(!p) return;
    try{
      if(wahl==='ja'){ stapelAktion(p.key); belohnen(art,8,'ja'); }
      else{
        if(typeof stapelStand==='function') stapelStand(p.key,'wieder',{stunden:24,aktion:'anders entschieden: '+satz.slice(0,60)});
        if(typeof johnOpen==='function'){ johnOpen('Ich sehe das anders: '+satz+' — zu „'+p.titel+'". Was heißt das für den nächsten Schritt?'); }
        belohnen(art,5,'nein');
      }
    }catch(e){ s.ctaFehler='Ging nicht: '+(e.message||e); malen(art); }
  }
  function ctaEigen(art){
    const box=document.getElementById('sysbox-'+art); if(!box) return;
    const f=box.querySelector('.syseigen'); const t=f?f.value.trim():'';
    if(!t){ if(f) f.focus(); return; }
    S[art].eigenText=t;
    ctaWaehlen(art,'eigen',t);
  }
  function belohnen(art, xp, wahl){
    try{ if(typeof xpGeben==='function') xpGeben(xp); }catch(e){}
    sag((wahl==='ja'?'👍 ':'👎 ')+'Entschieden · +'+xp+' XP','ok');
    const box=document.getElementById('sysbox-'+art);
    const btn=box&&box.querySelector('.sysbtn.'+(wahl==='ja'?'ja':'nein'));
    if(btn){ btn.classList.add('gewonnen'); setTimeout(()=>btn.classList.remove('gewonnen'),1300); }
    /* Nach einer Entscheidung ist der Text von gestern: neu holen, aber erst, wenn der Server
       mit der Antwort fertig ist — bei Fachberatung schreibt Coach noch seinen Schluss. */
    setTimeout(()=>anstellen(()=>holen(art,false)), art==='mad'?1500:600);
  }

  /* ---------- Klicks ---------- */
  function klick(art, ev){
    const s=S[art];
    const knoten=ev.target.closest && ev.target.closest('.sysn');
    if(knoten){ const id=knoten.dataset.id; s.fokus = (s.fokus===id)?'':id; s.spiel=-1; spielStop(art); malen(art); return; }
    const t=ev.target.closest && ev.target.closest('[data-tun]');
    if(!t) return;
    const tun=t.dataset.tun;
    if(tun==='neu'){ spielStop(art); anstellen(()=>holen(art,true)); return; }
    if(tun==='reset'){ spielStop(art); s.fokus=''; s.spiel=-1; malen(art); return; }
    if(tun==='spiel'){ spielen(art); return; }
    if(tun==='ja'||tun==='nein'){ ctaWaehlen(art,tun); return; }
    if(tun==='eigen'){ ctaEigen(art); return; }
  }
  function spielStop(art){ const s=S[art]; if(s.spielT){ clearInterval(s.spielT); s.spielT=0; } }
  function spielen(art){
    const s=S[art]; if(!s.bild) return;
    const max=ketten(s.bild).max;
    s.fokus=''; spielStop(art);
    s.spiel = (s.spiel>=max) ? 0 : s.spiel+1;
    malen(art);
    if(s.spiel<max){
      s.spielT=setInterval(()=>{
        if(s.spiel>=max){ spielStop(art); return; }
        s.spiel++; malen(art);
        if(s.spiel>=max) spielStop(art);
      }, 1100);
    }
  }
  function malen(art){
    const box=document.getElementById('sysbox-'+art); if(!box) return;
    breitePruefen();
    /* Unter 470 px rechnet der Browser das 560er Bild herunter — dann muss die Schrift im SVG groesser
       gesetzt werden, sonst steht die Beschriftung bei effektiv 6 px da. */
    box.classList.toggle('eng', box.getBoundingClientRect().width<470);
    const feld=box.querySelector('.syseigen'); const stand=feld?[feld.value,feld.selectionStart]:null;
    /* Ein Fehler beim Zeichnen darf die Box nicht stumm auf „zeichnet …" stehen lassen — dann sieht
       es aus, als haenge der Server, obwohl das Bild laengst da ist. */
    try{ box.innerHTML=inhalt(art); }
    catch(e){ console.error('systemik: Zeichnen fehlgeschlagen',e);
      box.innerHTML='<div class="syskopf"><span class="systitel">🕸️ Wirkungsbild</span></div>'+
        '<div class="sysmuted">Das Bild liegt vor, ließ sich hier aber nicht zeichnen: '+H(e.message||e)+'</div>'+
        '<div class="systasten"><button class="sysklein" data-tun="neu">↻ Noch einmal</button></div>'; }
    if(stand){ const neu=box.querySelector('.syseigen'); if(neu){ neu.value=stand[0]; try{ neu.setSelectionRange(stand[1],stand[1]); }catch(e){} } }
  }

  /* ---------- Anhängen und wachbleiben ---------- */
  css();
  let TAKT=0;
  function nachziehen(){
    clearTimeout(TAKT);
    TAKT=setTimeout(()=>{ rahmenAlle(); }, 120);
  }
  const beob=new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type!=='childList'||!m.addedNodes.length) continue;
      for(const k of m.addedNodes){
        if(k.nodeType!==1) continue;
        if(k.id==='madBody'||k.id==='stapelBody'||k.querySelector&&(k.querySelector('#madBody')||k.querySelector('#stapelBody'))){ nachziehen(); return; }
      }
    }
  });
  function start(){
    rahmenAlle();
    beob.observe(document.body,{childList:true,subtree:true});
    let rt=0; addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(breitePruefen,150); });
    /* Erst der Cockpit-Aufbau, dann wir: Coach- Stapel und die Beraterrunde sollen zuerst laden —
       der Server arbeitet seriell, und ein Wirkungsbild ist der Kommentar dazu, nicht der Inhalt. */
    setTimeout(()=>{
      anstellen(()=>holen('mad',false));
      anstellen(()=>holen('john',false));
    }, 6000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();

  /* Von außen: nach einer neuen Beraterrunde oder einem neu sortierten Stapel nachziehen. */
  window.systemikNachziehen=function(art,frisch){ anstellen(()=>holen(art||'mad',!!frisch)); };
  window.systemikStand=function(){ return { mad:{bild:!!S.mad.bild,fehler:S.mad.fehler}, john:{bild:!!S.john.bild,fehler:S.john.fehler} }; };
})();
