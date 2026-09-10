/* compass-ausgabe.js — die Erfolgs-Ausgabe im Kompass-Kino (11.09.2026)
   Bestellung: „als ein Chefredakteur der Bildzeitung agieren und hier aktuelle gute Nachrichten und
   Erfolge feuern. Abwechslungsreich mit Morgen- und Abendausgabe."

   Hängt sich wie compass-live.js von außen an: ersetzt anerkennungHtml() (die Folie „Anerkennung" im
   Kompass-Kino) durch eine Boulevard-Seite. Die Inhalte kommen von /api/ausgabe (john-ausgabe.ps1) —
   gesammelt aus Commits, erledigten Jira-Vorgängen, Entscheidungen aus den Checkins und dem
   Seiten-Wächter. Jede Meldung trägt ihre Belege (Mauszeiger auf ⓘ). Nichts ist erfunden.

   Ablauf: GET liefert sofort, was gilt — die redigierte Ausgabe oder den Entwurf ohne Modell. Ist es
   der Entwurf (oder ist seither viel passiert), bittet die Seite nach 20 s einmal per POST um die
   Redaktion; das dauert 10–40 s und belegt den Server so lange, deshalb höchstens einmal je Ausgabe
   und halbe Stunde. Ohne Server gilt die zuletzt gesehene Ausgabe (localStorage, höchstens 3 Tage alt)
   und sonst die alte Hand-Liste aus dashboard-data.js.
   Kommt eine neue Ausgabe (Morgen → Abend), springt das Kino einmal auf die Seite: Extrablatt. */
(function(){
  if(typeof JOHN_API==='undefined' || typeof anerkennungHtml!=='function' || typeof kinoSlideHtml!=='function') return;
  const API=()=>JOHN_API;
  const alt=window.anerkennungHtml;
  const LS='compassAusgabe', LS_GESEHEN='compassAusgabeGesehen';
  const A={daten:null, lauf:false, gebeten:{}, offen:false, fehler:''};

  function lsGet(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  const e=s=>(typeof esc==='function'?esc(s):String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'));
  const ea=s=>e(s).replace(/"/g,'&quot;');

  /* Stil einmal einhängen — die Farben kommen aus den Tokens des Compass, nur das Rot ist eigenes */
  const css=document.createElement('style');
  css.textContent=`
.kslide[data-k="lob"]>div:has(>.bz)>div:first-child{display:none}
.bz{--bz-rot:#d7141a;font-size:13px;line-height:1.45;color:var(--ink)}
.bz-kopf{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.bz-logo{background:var(--bz-rot);color:#fff;font:900 15px/1 Impact,Haettenschweiler,"Arial Narrow Bold","Franklin Gothic Bold",system-ui,sans-serif;
  letter-spacing:1px;padding:5px 7px 4px;border-radius:2px;text-transform:uppercase}
.bz-ausg{font-size:11px;color:var(--dim);letter-spacing:.3px}
.bz-stoer{margin-left:auto;background:#ffd400;color:#111;font:800 10.5px/1 system-ui,sans-serif;letter-spacing:.6px;padding:4px 7px;
  border-radius:2px;transform:rotate(-3deg);box-shadow:0 1px 0 rgba(0,0,0,.25)}
.bz-dach{font-size:12px;font-weight:700;color:var(--bz-rot)}
.bz-titel{font:400 25px/1.05 Impact,Haettenschweiler,"Arial Narrow Bold","Franklin Gothic Bold",system-ui,sans-serif;
  text-transform:uppercase;letter-spacing:.3px;margin:2px 0 4px;cursor:pointer}
.bz-titel:hover{color:var(--bz-rot)}
.bz-reihe{display:flex;gap:10px;align-items:flex-start}
.bz-reihe>div:first-child{flex:1;min-width:0}
.bz-zahl{flex:0 0 auto;text-align:center;border:2px solid var(--bz-rot);border-radius:3px;padding:3px 7px 4px;min-width:62px}
.bz-zahl b{display:block;font:400 26px/1 Impact,Haettenschweiler,"Arial Narrow Bold",system-ui,sans-serif;color:var(--bz-rot)}
.bz-zahl span{display:block;font-size:10px;line-height:1.2;color:var(--sub);max-width:86px}
.bz-unter{font-size:12.5px;color:var(--sub)}
.bz ul{margin:7px 0 0;padding-left:0;list-style:none}
.bz li{margin:0 0 5px;padding-left:12px;position:relative;font-size:12.5px;color:var(--sub)}
.bz li:before{content:"";position:absolute;left:0;top:.5em;width:6px;height:6px;background:var(--bz-rot)}
.bz li b{color:var(--ink)}
.bz-q{color:var(--dim);cursor:help;font-size:11px;margin-left:3px}
.bz-kurz li:before{background:var(--dim)}
.bz-komm{margin-top:6px;padding:6px 8px;border-left:3px solid var(--bz-rot);background:color-mix(in srgb,var(--bz-rot) 7%,transparent);font-size:12.5px}
.bz-komm b{color:var(--bz-rot)}
.bz-fuss{margin-top:6px;font-size:11px;color:var(--dim);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}
.bz-fuss a{color:var(--dim);cursor:pointer;text-decoration:underline dotted}
.bz-fuss a:hover{color:var(--ink)}
.bz-mehr[hidden]{display:none!important}
[dir="rtl"] .bz li{padding-left:0;padding-right:12px}
[dir="rtl"] .bz li:before{left:auto;right:0}
[dir="rtl"] .bz-komm{border-left:0;border-right:3px solid var(--bz-rot)}
[dir="rtl"] .bz-stoer{margin-left:0;margin-right:auto}
`;
  document.head.appendChild(css);

  function uhr(iso){ try{ return new Date(iso).toLocaleTimeString(typeof LOC==='function'?LOC():'de-DE',{hour:'2-digit',minute:'2-digit'}); }catch(x){ return ''; } }
  function belegTitel(q){ return (q&&q.length)?('Belege:\n• '+q.join('\n• ')):''; }

  /* Die eigenen Zahlen des Compass (Mein Board, Rhythmus) bleiben wie bisher unten dran */
  function eigeneZahlen(){
    let m=null; try{ m=(typeof tugendMetrik==='function')?tugendMetrik():null; }catch(x){}
    const st=(typeof S!=='undefined'&&S&&S.streak)?S.streak:0;
    const t=[];
    if(m&&m.done7) t.push('<b>'+m.done7+'</b> '+(m.done7===1?'Karte':'Karten')+' fertig in 7 Tagen');   /* 0 ist kein Erfolg — dann lieber nichts */
    if(st) t.push('<b>'+st+(st===1?' Tag':' Tage')+'</b> Rhythmus');
    return t.join(' · ');
  }

  function seite(d){
    const a=d.ausgabe||{}, l=d.lage||{};
    const mel=(a.meldungen||[]);
    const zeige=A.offen?mel:mel.slice(0,3);
    const li=zeige.map(function(m){
      const q=belegTitel(m.quellen);
      return '<li><b>'+e(m.titel)+'</b> '+e(m.text)+(q?'<span class="bz-q" title="'+ea(q)+'">ⓘ</span>':'')+'</li>';
    }).join('');
    const kurz=(A.offen&&(a.kurz||[]).length)?('<ul class="bz-kurz">'+a.kurz.map(function(k){
      const q=belegTitel(k.quellen); return '<li>'+e(k.text)+(q?'<span class="bz-q" title="'+ea(q)+'">ⓘ</span>':'')+'</li>'; }).join('')+'</ul>'):'';
    const mehr=(mel.length>3||(a.kurz||[]).length)?('<a data-bz="mehr">'+(A.offen?'weniger':'ganze Ausgabe ('+(mel.length+(a.kurz||[]).length)+')')+'</a>'):'';
    const komm=String(a.kommentar||'').replace(/^\s*Kompass meint:?\s*/i,'');
    const eig=eigeneZahlen();
    const stand=d.redaktion?('Redaktion '+uhr(d.erzeugt)):(A.lauf?'Redaktion schreibt …':'Entwurf ohne Redaktion');
    return '<div class="bz">'
      +'<div class="bz-kopf"><span class="bz-logo">Erfolg</span><span class="bz-ausg">'+e(l.name||'Ausgabe')+' · '+e(l.datum||'')+'</span>'
        +(a.stoerer?'<span class="bz-stoer">'+e(a.stoerer)+'</span>':'')+'</div>'
      +'<div class="bz-reihe"><div>'
        +(a.dachzeile?'<div class="bz-dach">'+e(a.dachzeile)+'</div>':'')
        +'<div class="bz-titel" data-bz="mehr" title="Ganze Ausgabe">'+e(a.schlagzeile||'')+'</div>'
        +(a.unterzeile?'<div class="bz-unter">'+e(a.unterzeile)+'</div>':'')
      +'</div>'+((a.zahl&&a.zahl.wert)?'<div class="bz-zahl"><b>'+e(a.zahl.wert)+'</b><span>'+e(a.zahl.text||'')+'</span></div>':'')+'</div>'
      +(li?'<ul>'+li+'</ul>':'')+kurz
      +(komm?'<div class="bz-komm"><b>Kompass meint:</b> '+e(komm)+'</div>':'')
      +'<div class="bz-fuss">'+(eig?'<span>'+eig+'</span>':'')
        +'<span>'+e(stand)+(d.aus?' · zuletzt gesehen':'')+'</span>'+mehr
        +(d.aus?'':'<a data-bz="neu" title="Redaktion noch einmal schreiben lassen (10–40 s)">↻ neu</a>')
        +(A.fehler?'<span>· '+e(A.fehler)+'</span>':'')+'</div>'
      +'</div>';
  }

  /* Die Folie. Ohne eine Ausgabe (Server nie erreicht, nichts im Speicher) bleibt die alte Liste. */
  window.anerkennungHtml=function(){
    const d=A.daten||gespeichert();
    if(!d||!d.ausgabe||!d.ausgabe.schlagzeile) return alt();
    return seite(d);
  };
  function gespeichert(){
    const g=lsGet(LS);
    if(!g||!g.ausgabe||!g.gesehen) return null;
    if(Date.now()-g.gesehen>3*864e5) return null;
    g.aus=true; return g;
  }

  function neuMalen(){
    document.querySelectorAll('.kslide[data-k="lob"]').forEach(function(el){ el.innerHTML=kinoSlideHtml('lob'); });
    if(typeof kinoHoehe==='function') kinoHoehe();
  }
  /* Extrablatt: eine neue Ausgabe zeigt sich einmal von selbst — nicht, solange jemand auf der Karte ist */
  function extrablatt(key){
    if(!key||lsGet(LS_GESEHEN)===key) return;
    const k=document.querySelector('.card.kino'); if(!k||k.classList.contains('min')||k.matches(':hover')||document.hidden) return;
    const i=(typeof KINO_SLIDES!=='undefined')?KINO_SLIDES.indexOf('lob'):-1;
    if(i<0||typeof kinoSet!=='function') return;
    lsSet(LS_GESEHEN,key);
    kinoSet(i,1);
  }

  async function holen(){
    try{
      const r=await fetch(API()+'/api/ausgabe',{cache:'no-store',signal:AbortSignal.timeout(20000)});
      const d=await r.json();
      if(!d||!d.ok) throw new Error((d&&(d.hint||d.error))||('HTTP '+r.status));
      annehmen(d);
      if(!d.redaktion||d.veraltet) setTimeout(bitten,20000);
    }catch(x){ /* Server aus: die gespeicherte Ausgabe bleibt stehen, nichts zu melden */ }
  }
  function annehmen(d){
    A.daten=d; A.fehler=d.redaktionFehler?('Redaktion: '+d.redaktionFehler):'';
    if(d.redaktion) lsSet(LS,Object.assign({},d,{gesehen:Date.now()}));
    neuMalen();
    if(d.redaktion) extrablatt(d.lage&&d.lage.key);
  }
  async function bitten(frisch){
    const key=A.daten&&A.daten.lage&&A.daten.lage.key;
    if(A.lauf) return;
    if(!frisch&&key&&A.gebeten[key]&&Date.now()-A.gebeten[key]<30*6e4) return;
    if(!frisch&&document.hidden) return;   /* im Hintergrundtab keinen Modellaufruf anstoßen */
    A.lauf=true; if(key) A.gebeten[key]=Date.now(); neuMalen();
    try{
      const r=await fetch(API()+'/api/ausgabe',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({fresh:!!frisch}),signal:AbortSignal.timeout(300000)});
      const d=await r.json();
      if(!d||!d.ok) throw new Error((d&&(d.hint||d.error))||('HTTP '+r.status));
      A.lauf=false; annehmen(d);
    }catch(x){ A.lauf=false; A.fehler='Redaktion nicht erreichbar'; neuMalen(); }
  }

  /* Klicks: ganze Ausgabe auf/zu, neu schreiben lassen. Delegiert, weil die Folie neu gemalt wird. */
  document.addEventListener('click',function(ev){
    const t=ev.target.closest&&ev.target.closest('.bz [data-bz]'); if(!t) return;
    ev.preventDefault();
    if(t.dataset.bz==='mehr'){ A.offen=!A.offen; neuMalen(); if(typeof kinoTakt==='function') kinoTakt(); }
    else if(t.dataset.bz==='neu'){ bitten(true); }
  });

  /* Morgen- und Abendausgabe wechseln um 4 und 16 Uhr: alle 10 Minuten nachsehen, sichtbar sofort */
  setTimeout(holen,3000);
  setInterval(function(){ if(!document.hidden) holen(); },10*6e4);
  document.addEventListener('visibilitychange',function(){
    if(document.hidden||!A.daten||!A.daten.lage) return;
    const h=new Date().getHours(), art=(h>=4&&h<16)?'morgen':'abend';
    if(A.daten.lage.art!==art) holen();
  });
  neuMalen();
})();
