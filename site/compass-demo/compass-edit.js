/* ==========================================================================
   Flow Compass — Editier-Modus fuers Layout (24.08.2026, ihren Wunsch:
   „Insgesamt muss die Moeglichkeit bestehen einzelne Boxen zu verschieben
   und das Layout des Cockpits anzupassen. Mach einen Editier-Modus.")

   Bewusst eine eigene Datei: dashboard.html ist 4000 Zeilen und wird oft
   parallel bearbeitet. Hier haengt sich alles von aussen an — der Eingriff
   dort ist eine Zeile <script src>. Diese Datei kennt das Cockpit nur ueber
   drei Annahmen, die seit dem 21.08. stabil sind:
     · Karten sind  #grid .card  und tragen ihren Titel in  > h3
     · die Breite steckt in den Klassen s3 … s12 (12-Spalten-Raster)
     · Sektionen sind  section.sec[data-s] > .grid
   Der Kartenschluessel ist derselbe wie beim Zuklappen (Titeltext der h3
   ohne Zaehler) — wer eine Karte zuklappt und verschiebt, meint dieselbe.

   Gespeichert wird in localStorage unter „compassLayout":
     { v:1, oben:[key], ord:{sektion:[key,…]}, span:{key:'s6'}, aus:[key] }
   Nichts davon verlaesst den Rechner, nichts wird gerendert, was nicht
   ohnehin schon da ist — der Modus ordnet nur um.
   ========================================================================== */
(function(){
'use strict';

var SPEICHER='compassLayout';
var SPANS=['s3','s4','s5','s6','s7','s8','s12'];
/* Was ab Werk oben andockt: Blumen, Kompass und Coach. Kompass + Coach sind ihren
   „diese 2 Integrationen im oberen Sichtbereich elegant einblenden" (24.08.);
   die Lotus-Karte kam am 27.08. dazu („Die Blumen bitte wieder zwischen diese
   beiden") — sie steht im Dock VOR dem Kompass, also zwischen „Das Eine" und
   ihm. Wer etwas wegzieht, bekommt es nicht zurueckgedrueckt; die Entscheidung
   steht dann im Speicher. */
var BLUMEN='🪷 Heute im Blick';
var STD_OBEN=[BLUMEN,'🧭 Kompass','🤵 Coach'];
/* … und zwar je sechs Spalten: zusammen genau die volle Breite. Mit ihren
   vier Spalten aus dem Raster bliebe oben rechts ein Drittel leer. */
var STD_SPAN={'🧭 Kompass':'s6','🤵 Coach':'s6'};

var L=laden();
/* Einmalige Nachruestung 27.08.2026: bestehende Layouts (Dock schon gespeichert,
   erstEinrichtung laengst verbraucht) bekommen die Blumen einmal vor den Kompass
   geschoben. Danach entscheidet wieder nur die Nutzerin: zieht er sie raus oder blendet
   sie aus, verhindert das Flag, dass sie beim naechsten Laden wiederkommen. */
if(!L.blumenOben){
  L.blumenOben=true;
  if(L.oben.indexOf(BLUMEN)<0 && L.aus.indexOf(BLUMEN)<0){
    var bi=L.oben.indexOf('🧭 Kompass');
    L.oben.splice(bi<0?0:bi,0,BLUMEN);
  }
  sichern();
}
var EDIT=false;

/* Sucht den naechsten passenden Vorfahren — auch wenn das Ereignis am Dokument
   haengt (dann gibt es kein closest) oder an einem Textknoten. */
function nahe(e,sel){
  var t=e&&e.target;
  if(t&&t.nodeType===3) t=t.parentNode;
  return (t&&t.closest)?t.closest(sel):null;
}
var beobachter=null;
var zieht=null;

/* ---- Speicher ---------------------------------------------------------- */
function laden(){
  var v=null;
  try{ v=JSON.parse(localStorage.getItem(SPEICHER)||'null'); }catch(e){ v=null; }
  if(!v||typeof v!=='object'||v.v!==1) v={v:1,oben:STD_OBEN.slice(),ord:{},span:{},aus:[],erstEinrichtung:true};
  if(!Array.isArray(v.oben)) v.oben=STD_OBEN.slice();
  if(!Array.isArray(v.aus)) v.aus=[];
  if(!v.ord||typeof v.ord!=='object') v.ord={};
  if(!v.span||typeof v.span!=='object') v.span={};
  return v;
}
function sichern(){
  try{ localStorage.setItem(SPEICHER,JSON.stringify(L)); }
  catch(e){ melde('Layout liess sich nicht speichern — localStorage voll?'); }
}
function zuruecksetzen(){
  L={v:1,oben:STD_OBEN.slice(),ord:{},span:{},aus:[]};
  sichern(); anwenden(); melde('Layout auf den Auslieferungsstand zurueckgesetzt.');
}

/* ---- Karten erkennen --------------------------------------------------- */
/* Gleiche Regel wie cardsVerdrahten() in dashboard.html: der Text vor dem
   ersten <span> ist der Titel. Sonst haetten Zuklappen und Verschieben zwei
   verschiedene Schluessel fuer dieselbe Karte. */
function schluessel(karte){
  var h3=karte.querySelector(':scope > h3'); if(!h3) return '';
  var t=h3.childNodes[0];
  var s=(t&&t.nodeType===3?t.textContent:h3.textContent)||'';
  return s.trim().replace(/\s+/g,' ').slice(0,40);
}
function karten(){
  return Array.prototype.slice.call(document.querySelectorAll('#grid .card, #obenDock .card'));
}
function spanVon(karte){
  for(var i=0;i<SPANS.length;i++) if(karte.classList.contains(SPANS[i])) return SPANS[i];
  return 's4';
}
function spanSetzen(karte,s){
  SPANS.forEach(function(x){ karte.classList.remove(x); });
  karte.classList.add(s);
}
function sektionVon(karte){
  var sec=karte.closest('section.sec');
  return sec?(sec.getAttribute('data-s')||'?'):'?';
}

/* ---- Das Dock oben ----------------------------------------------------- */
/* Sitzt zwischen „Das Eine" und den Kontext-Reitern: das ist der Bereich,
   den man ohne Scrollen sieht. Leer ist es unsichtbar — kein leerer Kasten. */
function dock(){
  var d=document.getElementById('obenDock');
  if(d) return d;
  var anker=document.querySelector('.focus');
  if(!anker) return null;
  d=document.createElement('div');
  d.id='obenDock';
  d.className='obendock';
  d.setAttribute('aria-label','Oben angeheftet');
  anker.parentNode.insertBefore(d,anker.nextSibling);
  return d;
}

/* ---- Layout anwenden --------------------------------------------------- */
/* Laeuft nach jedem render() des Cockpits (MutationObserver weiter unten).
   Reihenfolge: erst Breite und Sichtbarkeit, dann Dock, dann Sortierung —
   sonst sortiert man Karten, die gleich darauf wegwandern. */
var amArbeiten=false;
function anwenden(){
  if(amArbeiten) return;
  amArbeiten=true;
  try{
    var d=dock();
    var alle=karten();

    alle.forEach(function(k){
      var key=schluessel(k); if(!key) return;
      k.setAttribute('data-key',key);
      var sek=sektionVon(k);
      if(sek!=='?') k.setAttribute('data-sek',sek);
      if(L.span[key]) spanSetzen(k,L.span[key]);
      k.classList.toggle('ce-aus', L.aus.indexOf(key)>=0);
    });

    /* Angeheftete Karten ins Dock holen — in der Reihenfolge von L.oben.
       render() baut #grid komplett neu und erzeugt dabei FRISCHE Exemplare der
       laengst gedockten Karten. Bis 27.08. blieb dann das alte Exemplar im Dock
       stehen und das frische dazu im Raster: Kompass & Co. standen doppelt da
       und das Dock veraltete still. Deshalb gewinnt jetzt immer das frische
       Exemplar (aktuelle Daten, h3-Klapp-Listener aus diesem Render); das alte
       fliegt raus und die betroffene Karte wird unten neu verdrahtet. */
    var ersetzt=[];
    if(d){
      L.oben.forEach(function(key){
        var frisch=document.querySelector('#grid .card[data-key="'+cssEsc(key)+'"]');
        var alt=d.querySelector(':scope > .card[data-key="'+cssEsc(key)+'"]');
        var k=frisch||alt;                 /* baut dieser Render die Karte nicht (z. B. Fokus-Modus), bleibt die gedockte */
        if(!k) return;
        if(frisch&&alt&&frisch!==alt){ alt.remove(); ersetzt.push(key); }
        k.classList.add('ce-oben');
        d.appendChild(k);                  /* appendChild sortiert das Dock zugleich in L.oben-Reihenfolge */
      });
      /* Was nicht mehr angeheftet ist, faellt zurueck ins Raster */
      Array.prototype.slice.call(d.children).forEach(function(k){
        var key=k.getAttribute('data-key');
        if(L.oben.indexOf(key)<0){ k.classList.remove('ce-oben'); zurueckInsRaster(k); }
      });
      d.classList.toggle('leer', d.children.length===0);
    }
    /* Ersetzte Dock-Karten neu verdrahten: render() hatte beim Verdrahten noch das
       alte Exemplar erwischt (gleiche id, frueher im DOM als das frische). Beide
       Funktionen sind dafuer gebaut, nach jedem Render zu laufen — doppelt rufen
       schadet nicht (Zuweisungen statt addEventListener, kinoTakt raeumt selbst auf). */
    if(ersetzt.indexOf(BLUMEN)>=0 && typeof window.lotusVerdrahten==='function') window.lotusVerdrahten();
    if(ersetzt.indexOf('🧭 Kompass')>=0 && typeof window.kompassVerdrahten==='function') window.kompassVerdrahten();

    /* Sortierung je Sektion */
    Object.keys(L.ord).forEach(function(sek){
      var g=document.querySelector('section.sec[data-s="'+cssEsc(sek)+'"] .grid');
      if(!g) return;
      var wunsch=L.ord[sek];
      for(var i=wunsch.length-1;i>=0;i--){
        var k=g.querySelector(':scope > .card[data-key="'+cssEsc(wunsch[i])+'"]');
        if(k) g.insertBefore(k,g.firstChild);
      }
    });

    if(EDIT) werkzeugeSetzen();
  } finally { amArbeiten=false; }
}
function cssEsc(s){ return String(s).replace(/"/g,'\\"'); }
function zurueckInsRaster(k){
  var sek=k.getAttribute('data-sek')||'heute';
  var g=document.querySelector('section.sec[data-s="'+cssEsc(sek)+'"] .grid')
     || document.querySelector('section.sec .grid')
     || document.getElementById('grid');
  if(g) g.appendChild(k);   /* niemals entfernen — eine verlorene Karte ist schlimmer
                               als eine, die in der falschen Sektion steht */
}

/* ---- Werkzeuge je Karte (nur im Editier-Modus sichtbar) ---------------- */
function werkzeugeSetzen(){
  karten().forEach(function(k){
    if(k.querySelector(':scope > .ce-wz')) return;
    var key=k.getAttribute('data-key')||schluessel(k);
    var wz=document.createElement('div');
    wz.className='ce-wz';
    wz.innerHTML=
      '<span class="ce-griff" title="Ziehen zum Verschieben">⠿</span>'
      +'<button class="ce-b" data-tun="schmaler" title="Schmaler">–</button>'
      +'<span class="ce-breite" title="Breite im 12er-Raster">'+spanVon(k).slice(1)+'</span>'
      +'<button class="ce-b" data-tun="breiter" title="Breiter">+</button>'
      +'<button class="ce-b ce-pin'+(L.oben.indexOf(key)>=0?' an':'')+'" data-tun="oben" title="Oben andocken">📌</button>'
      +'<button class="ce-b" data-tun="hoch" title="Nach vorn (Alt+←)">←</button>'
      +'<button class="ce-b" data-tun="runter" title="Nach hinten (Alt+→)">→</button>'
      +'<button class="ce-b ce-weg" data-tun="aus" title="Karte ausblenden">✕</button>';
    k.insertBefore(wz,k.firstChild);
    k.setAttribute('draggable','true');
    k.setAttribute('data-sek',sektionVon(k));
  });
}
function werkzeugeWeg(){
  document.querySelectorAll('#grid .ce-wz, .obendock .ce-wz').forEach(function(w){ w.remove(); });
  document.querySelectorAll('.card[draggable]').forEach(function(k){ k.removeAttribute('draggable'); });
}

/* Ein Klick-Listener fuer alle Werkzeuge (die Karten werden staendig neu
   gerendert — einzelne Listener waeren nach dem naechsten Render tot). */
document.addEventListener('click',function(e){
  if(!EDIT) return;
  var b=nahe(e,'.ce-wz [data-tun]'); if(!b) return;
  e.preventDefault(); e.stopPropagation();
  var k=b.closest('.card'); if(!k) return;
  var key=k.getAttribute('data-key')||schluessel(k);
  var tun=b.getAttribute('data-tun');

  if(tun==='breiter'||tun==='schmaler'){
    var i=SPANS.indexOf(spanVon(k));
    i=Math.max(0,Math.min(SPANS.length-1,i+(tun==='breiter'?1:-1)));
    spanSetzen(k,SPANS[i]); L.span[key]=SPANS[i];
    var an=k.querySelector('.ce-breite'); if(an) an.textContent=SPANS[i].slice(1);
    sichern();
  } else if(tun==='oben'){
    var drin=L.oben.indexOf(key);
    if(drin>=0) L.oben.splice(drin,1); else L.oben.push(key);
    sichern(); anwenden(); werkzeugeSetzen();
    melde(drin>=0?'„'+key+'" liegt wieder im Raster.':'„'+key+'" ist oben angedockt.');
  } else if(tun==='hoch'||tun==='runter'){
    schieben(k,tun==='hoch'?-1:1);
  } else if(tun==='aus'){
    L.aus.push(key); sichern(); anwenden();
    melde('„'+key+'" ausgeblendet — im Editier-Modus unten wieder einblendbar.');
    leisteBauen();
  }
},true);

/* Im Editier-Modus klappt ein Klick auf die Ueberschrift die Karte NICHT zu:
   sonst faltet sich beim Anfassen alles zusammen. */
document.addEventListener('click',function(e){
  if(!EDIT) return;
  if(nahe(e,'#grid .card > h3, .obendock .card > h3')){ e.stopPropagation(); }
},true);

function schieben(k,d){
  var eltern=k.parentNode; if(!eltern) return;
  var geschwister=Array.prototype.slice.call(eltern.children).filter(function(x){ return x.classList.contains('card'); });
  var i=geschwister.indexOf(k); var j=i+d;
  if(j<0||j>=geschwister.length) return;
  if(d<0) eltern.insertBefore(k,geschwister[j]);
  else eltern.insertBefore(k,geschwister[j].nextSibling);
  ordMerken(eltern);
}
function ordMerken(eltern){
  if(!eltern) return;
  if(eltern.id==='obenDock'){
    L.oben=Array.prototype.slice.call(eltern.children).map(function(x){ return x.getAttribute('data-key'); }).filter(Boolean);
  } else {
    var sec=eltern.closest('section.sec'); if(!sec) return;
    var sek=sec.getAttribute('data-s');
    L.ord[sek]=Array.prototype.slice.call(eltern.children)
      .filter(function(x){ return x.classList.contains('card'); })
      .map(function(x){ return x.getAttribute('data-key'); }).filter(Boolean);
  }
  sichern();
}

/* ---- Ziehen und Ablegen ------------------------------------------------ */
document.addEventListener('dragstart',function(e){
  if(!EDIT) return;
  var k=nahe(e,'.card'); if(!k) return;
  zieht=k; k.classList.add('ce-zieht');
  try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',k.getAttribute('data-key')||''); }catch(x){}
});
document.addEventListener('dragend',function(){
  if(zieht) zieht.classList.remove('ce-zieht');
  document.querySelectorAll('.ce-ziel').forEach(function(x){ x.classList.remove('ce-ziel'); });
  zieht=null;
});
document.addEventListener('dragover',function(e){
  if(!EDIT||!zieht) return;
  var behaelter=nahe(e,'#obenDock, section.sec .grid');
  if(!behaelter) return;
  e.preventDefault();
  behaelter.classList.add('ce-ziel');
  var nach=nachbarBestimmen(behaelter,e.clientX,e.clientY);
  if(nach===null) behaelter.appendChild(zieht);
  else if(nach!==zieht) behaelter.insertBefore(zieht,nach);
});
document.addEventListener('dragleave',function(e){
  var behaelter=nahe(e,'#obenDock, section.sec .grid');
  if(behaelter && !behaelter.contains(e.relatedTarget)) behaelter.classList.remove('ce-ziel');
});
document.addEventListener('drop',function(e){
  if(!EDIT||!zieht) return;
  e.preventDefault();
  var behaelter=zieht.parentNode;
  document.querySelectorAll('.ce-ziel').forEach(function(x){ x.classList.remove('ce-ziel'); });
  /* Ins Dock gezogen oder herausgezogen? Dann die Anheftung mitfuehren. */
  var key=zieht.getAttribute('data-key');
  if(behaelter && behaelter.id==='obenDock'){
    if(L.oben.indexOf(key)<0) L.oben.push(key);
    zieht.classList.add('ce-oben');
  } else {
    var i=L.oben.indexOf(key); if(i>=0) L.oben.splice(i,1);
    zieht.classList.remove('ce-oben');
    zieht.setAttribute('data-sek',sektionVon(zieht));
  }
  ordMerken(behaelter);
  var dk=document.getElementById('obenDock');
  if(dk){ L.oben=Array.prototype.slice.call(dk.children).map(function(x){ return x.getAttribute('data-key'); }).filter(Boolean);
          dk.classList.toggle('leer',dk.children.length===0); sichern(); }
  werkzeugeSetzen();
  document.querySelectorAll('.ce-pin').forEach(function(p){
    var kk=p.closest('.card'); if(!kk) return;
    p.classList.toggle('an', L.oben.indexOf(kk.getAttribute('data-key'))>=0);
  });
});
/* Vor welche Karte gehoert die gezogene? Die naechstgelegene, deren Mitte
   rechts/unter dem Zeiger liegt — funktioniert in einer Zeile wie in mehreren. */
function nachbarBestimmen(behaelter,x,y){
  var kandidaten=Array.prototype.slice.call(behaelter.children).filter(function(k){
    return k.classList.contains('card') && k!==zieht;
  });
  for(var i=0;i<kandidaten.length;i++){
    var r=kandidaten[i].getBoundingClientRect();
    if(y < r.top+r.height/2) return kandidaten[i];
    if(y < r.bottom && x < r.left+r.width/2) return kandidaten[i];
  }
  return null;
}

/* ---- Tastatur ---------------------------------------------------------- */
document.addEventListener('keydown',function(e){
  if(nahe(e,'input,textarea,select,[contenteditable]')) return;
  /* E schaltet den Modus — wie M den Morgencheck und F den Fokus. */
  if(!e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='e'||e.key==='E')){
    var offen=document.querySelector('.ov.on, #john.on');
    if(!offen){ e.preventDefault(); umschalten(); }
    return;
  }
  if(!EDIT) return;
  if(e.key==='Escape'){ umschalten(false); return; }
  if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
    var k=document.querySelector('.card.ce-fokus')||document.querySelector('#grid .card');
    if(k){ e.preventDefault(); schieben(k,e.key==='ArrowLeft'?-1:1); }
  }
});
document.addEventListener('focusin',function(e){
  var k=nahe(e,'.card'); if(!k) return;
  document.querySelectorAll('.ce-fokus').forEach(function(x){ x.classList.remove('ce-fokus'); });
  k.classList.add('ce-fokus');
});

/* ---- Schalter und Leiste ---------------------------------------------- */
function schalterBauen(){
  if(document.getElementById('btnEdit')) return;
  var reiter=document.getElementById('tabs'); if(!reiter) return;
  var b=document.createElement('button');
  b.className='btn'; b.id='btnEdit';
  b.title='Layout bearbeiten: Karten verschieben, Breite aendern, oben andocken (Taste E)';
  b.innerHTML='✥ Layout <span class="kbd">E</span>';
  b.addEventListener('click',function(){ umschalten(); });
  var fokus=document.getElementById('btnFokus');
  if(fokus&&fokus.parentNode) fokus.parentNode.insertBefore(b,fokus);
  else reiter.appendChild(b);
}
function leisteBauen(){
  var alt=document.getElementById('ceLeiste'); if(alt) alt.remove();
  if(!EDIT) return;
  var l=document.createElement('div');
  l.id='ceLeiste'; l.className='ce-leiste';
  var aus=L.aus.slice();
  l.innerHTML='<b>✥ Editier-Modus</b>'
    +'<span class="ce-hinweis">Karte am ⠿ ziehen · – / + aendert die Breite · 📌 dockt oben an · Alt+←/→ verschiebt</span>'
    +'<span class="ce-fuell"></span>'
    +(aus.length?'<span class="ce-hinweis">ausgeblendet:</span>'+aus.map(function(k){
        return '<button class="ce-zurueck" data-key="'+cssEsc(k)+'" title="Wieder einblenden">'+esc(k)+' ↩</button>'; }).join(''):'')
    +'<button class="btn" id="ceReset" title="Alle Anpassungen verwerfen">↺ Zuruecksetzen</button>'
    +'<button class="btn a" id="ceFertig">✓ Fertig</button>';
  document.body.appendChild(l);
  l.addEventListener('click',function(e){
    var z=nahe(e,'.ce-zurueck');
    if(z){ var key=z.getAttribute('data-key');
           L.aus=L.aus.filter(function(x){ return x!==key; }); sichern();
           anwenden();
           leisteBauen(); melde('„'+key+'" ist wieder da.'); return; }
    if(nahe(e,'#ceReset')){ zuruecksetzen(); leisteBauen(); return; }
    if(nahe(e,'#ceFertig')){ umschalten(false); return; }
  });
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function umschalten(auf){
  EDIT=(auf===undefined)?!EDIT:!!auf;
  document.body.classList.toggle('ce-edit',EDIT);
  var b=document.getElementById('btnEdit');
  if(b){ b.classList.toggle('a',EDIT); }
  if(EDIT){ werkzeugeSetzen(); leisteBauen(); melde('Editier-Modus an — zieh die Karten, wohin du sie brauchst.'); }
  else { werkzeugeWeg(); leisteBauen();
         if(document.querySelectorAll('.ce-fokus').length) document.querySelectorAll('.ce-fokus').forEach(function(x){ x.classList.remove('ce-fokus'); });
         melde('Layout gespeichert.'); }
}
/* Das Cockpit bringt seine eigene toast()-Funktion mit (dashboard.html) —
   die benutzen wir, sonst kaempfen zwei Mechaniken um dasselbe Element. */
function melde(t){
  if(typeof window.toast==='function'){ window.toast(esc(t)); return; }
  var el=document.getElementById('toast'); if(!el) return;
  el.textContent=t; el.className='on';
  clearTimeout(melde._t); melde._t=setTimeout(function(){ el.className=''; },2600);
}

/* ---- Aussehen ---------------------------------------------------------- */
/* Steckt hier statt in dashboard.html, damit diese Erweiterung aus genau
   einer Datei besteht. Nur Tokens des Cockpits — kein eigener Farbraum,
   damit Hell/Dunkel und der Tagesverlauf weiter durchschlagen. */
function stilSetzen(){
  if(document.getElementById('ceStil')) return;
  var s=document.createElement('style');
  s.id='ceStil';
  s.textContent=[
  /* Dock oben: dasselbe 12er-Raster wie das Cockpit, damit s4/s6 auch hier gelten */
  '.obendock{display:grid;grid-template-columns:repeat(12,1fr);gap:16px;margin:14px 32px 0;',
  '  animation:ceRein .5s cubic-bezier(.22,1,.36,1) both}',
  '.obendock.leer{display:none}',
  '@keyframes ceRein{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}',
  '.obendock .card{margin:0}',
  '.obendock .card.ce-oben::after{content:"";position:absolute;right:0;top:0;width:0;height:0;',
  '  border-style:solid;border-width:0 16px 16px 0;border-color:transparent color-mix(in srgb,var(--bene) 45%,transparent) transparent transparent}',
  '@media(max-width:1000px){.obendock .card.s3,.obendock .card.s4,.obendock .card.s5{grid-column:span 6}}',
  '@media(max-width:720px){.obendock{margin-left:16px;margin-right:16px}}',

  /* Ausgeblendete Karten */
  '.card.ce-aus{display:none}',

  /* Werkzeugleiste je Karte */
  '.ce-wz{display:none}',
  '.ce-edit .ce-wz{display:flex;align-items:center;gap:4px;margin:-6px -8px 8px;padding:4px 6px;',
  '  background:var(--panel2);border:1px solid var(--line2);border-radius:10px;font-family:var(--sans)}',
  '.ce-edit .ce-griff{cursor:grab;font-size:15px;color:var(--dim);padding:0 4px;line-height:1;user-select:none}',
  '.ce-edit .ce-griff:active{cursor:grabbing}',
  '.ce-edit .ce-b{background:none;border:1px solid transparent;border-radius:7px;color:var(--sub);',
  '  font:700 12px/1 var(--sans);padding:5px 7px;cursor:pointer;transition:.14s}',
  '.ce-edit .ce-b:hover{border-color:var(--line2);color:var(--ink);background:var(--panel)}',
  '.ce-edit .ce-b.ce-pin.an{color:var(--bene);border-color:color-mix(in srgb,var(--bene) 50%,transparent)}',
  '.ce-edit .ce-b.ce-weg:hover{color:var(--bad,#e06b6b)}',
  '.ce-edit .ce-breite{font:800 11px/1 var(--sans);color:var(--dim);min-width:16px;text-align:center}',
  '.ce-edit .ce-wz [data-tun="hoch"],.ce-edit .ce-wz [data-tun="runter"]{margin-left:auto}',
  '.ce-edit .ce-wz [data-tun="runter"]{margin-left:0}',

  /* Die Karten selbst im Modus: fassbar, aber nicht laut */
  '.ce-edit #grid .card,.ce-edit .obendock .card{cursor:default;transition:box-shadow .18s,transform .18s,opacity .18s}',
  '.ce-edit #grid .card:hover,.ce-edit .obendock .card:hover{box-shadow:0 0 0 1px var(--va-l),var(--shadow)}',
  '.ce-edit .card.ce-zieht{opacity:.42;transform:scale(.985)}',
  '.ce-edit .card.ce-fokus{box-shadow:0 0 0 2px var(--bene),var(--shadow)}',
  '.ce-edit section.sec .grid.ce-ziel,.ce-edit .obendock.ce-ziel{',
  '  outline:2px dashed color-mix(in srgb,var(--va-l) 60%,transparent);outline-offset:7px;border-radius:14px}',
  '.ce-edit .obendock{display:grid!important}',   /* im Modus auch leer sichtbar — sonst kann man nichts hineinziehen */
  '.ce-edit .obendock.leer{min-height:74px;outline:2px dashed var(--line2);outline-offset:4px;border-radius:14px}',
  '.ce-edit .obendock.leer::before{content:"Karten hierher ziehen — dieser Bereich steht ganz oben";',
  '  grid-column:1/-1;display:grid;place-items:center;color:var(--dim);font:700 12px/1 var(--sans);min-height:70px}',

  /* Leiste unten */
  '.ce-leiste{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:74;display:flex;align-items:center;gap:10px;',
  '  max-width:calc(100vw - 32px);flex-wrap:wrap;background:var(--panel);border:1px solid var(--line2);border-radius:16px;',
  '  padding:10px 14px;box-shadow:var(--shadow);font-family:var(--sans);font-size:12.5px;animation:ceRauf .34s cubic-bezier(.22,1,.36,1) both}',
  '@keyframes ceRauf{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}}',
  '.ce-leiste b{font-size:13px;color:var(--ink)}',
  '.ce-leiste .ce-hinweis{color:var(--dim)}',
  '.ce-leiste .ce-fuell{flex:1;min-width:8px}',
  '.ce-leiste .ce-zurueck{background:var(--panel2);border:1px solid var(--line2);border-radius:999px;color:var(--sub);',
  '  font:700 11.5px/1 var(--sans);padding:6px 10px;cursor:pointer;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.ce-leiste .ce-zurueck:hover{color:var(--ink);border-color:var(--va-l)}',
  '@media(max-width:720px){.ce-leiste{bottom:8px;font-size:11.5px}.ce-leiste .ce-hinweis{display:none}}',
  '@media(prefers-reduced-motion:reduce){.obendock,.ce-leiste{animation:none}}'
  ].join('');
  document.head.appendChild(s);
}

/* ---- Anschluss ans Cockpit -------------------------------------------- */
/* render() baut #grid komplett neu und ruft nichts von hier — also schauen
   wir zu, statt eine fremde Funktion zu ueberschreiben. Das ueberlebt jede
   Aenderung an dashboard.html, auch eine aus einer anderen Sitzung. */
function beobachten(){
  var g=document.getElementById('grid'); if(!g||beobachter) return;
  beobachter=new MutationObserver(function(){
    if(amArbeiten) return;
    clearTimeout(beobachten._t);
    beobachten._t=setTimeout(anwenden,30);
  });
  beobachter.observe(g,{childList:true,subtree:true});
}

function start(){
  stilSetzen();
  schalterBauen();
  beobachten();
  anwenden();
  /* Beim allerersten Start liegen Kompass und Coach oben — einmal gespeichert,
     danach entscheidet nur noch, was die Nutzerin selbst geschoben hat. */
  if(L.erstEinrichtung){
    Object.keys(STD_SPAN).forEach(function(k){ if(!L.span[k]) L.span[k]=STD_SPAN[k]; });
    delete L.erstEinrichtung; sichern(); anwenden();
  }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
else start();

/* Fuer die Konsole und spaetere Module */
window.CompassLayout={ an:function(){ umschalten(true); }, aus:function(){ umschalten(false); },
                       zuruecksetzen:zuruecksetzen, stand:function(){ return JSON.parse(JSON.stringify(L)); } };
})();
