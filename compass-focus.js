/* ==========================================================================
   Flow Compass — Focus View (06.09.2026, Benes Auftrag)

   „Wir sind zu überladen“ — das sagt die Kritik, und sie meint nicht Bene,
   der die volle Ansicht mag und nutzt, sondern neue Leute, die keine
   Analytics- oder IT-Menschen sind. Die wollen Einfachheit, die sie klug zu
   den gewünschten Informationen oder Portaleinstiegen bringt.

   Darum ein ZWEITES FRONTEND im selben Compass, kein Umbau:
     · Kopfleiste (.top) und Checkin-Leiste (#rhythm: Morgencheck, Abendcheck,
       Rückfragen …) bleiben, wie sie sind.
     · Darunter statt Knopfleiste, Kontext-Reitern und Karten-Raster nur
       DREI KACHELN — die wichtigsten Einstiegspunkte — mit einer ehrlichen
       Live-Zeile (Zahlen nur aus echten Quellen, sonst steht da, warum nicht).
     · Eine Kachel führt entweder auf eine „Bühne“ (genau EINE Karte des
       Compass, z. B. Mein Board oder der Kalender), in ein Ritual, zu John
       oder auf eine andere Seite / ins Team-Cockpit.
     · Eine Leiste „Weitere Einstiege“ hält alles andere erreichbar — so
       entsteht das Signal, aus dem der Compass lernt.

   LERNEND: jeder Einstieg (Kacheln, Kopfknöpfe, Karten, Tasten) wird lokal
   gezählt; jeder Klick klingt mit 14 Tagen Halbwertszeit ab. Die drei
   Kacheln sind die drei höchsten Werte — mit Hysterese, damit sie nicht
   flackern: eine neue Kachel verdrängt eine sitzende nur, wenn sie deutlich
   vorne liegt. Am Anfang gilt der Standard (Mein Board · Heute im Blick ·
   John). Anheften (📌) übersteuert das Lernen für eine Kachel.

   Gespeichert wird in localStorage unter „compassFocus“:
     { v:1, ansicht:'focus'|'voll'|null, nutzung:{id:[ts,…]}, pins:[id],
       letzte:[id], buehne:id|null }
   Nichts davon verlässt den Rechner; der Schlüssel zieht mit dem Fortschritt
   um (EXPORT_KEYS).

   Bewusst eine eigene Datei, wie compass-edit.js: dashboard.html wird oft
   parallel bearbeitet. Der Eingriff dort ist eine Zeile <script src>. Diese
   Datei hängt sich an render() und an die Karten-Funktionen an, die seit
   Wochen stabil sind (kanbanCard, lotusCard, kalenderCard, postfCard,
   slrCard, triCard, wocheCard) — fehlt eine, fehlt nur die Kachel.

   Umschalten: Kopfknopf „◎ Einfach“ / „▦ Alles“, Taste S (E gehört dem Editier-Modus), ?ansicht=focus|voll.
   Absprünge: ?go=board|heute|kalender|postfach|slack|trichter|woche|fragen|john
   öffnen in der Focus View direkt die passende Kachel.
   ========================================================================== */
(function(){
'use strict';

var KEY='compassFocus';
var HALBWERT=14*864e5;          /* Halbwertszeit eines Klicks: 14 Tage */
var KACHELN=3;
var STAGE_ID='focusStage';

/* ---- sicherer Zugriff auf die Globalen des Compass ----------------------
   const/let auf oberster Ebene liegen im globalen Lexikal-Scope: von hier aus
   per Namen erreichbar, aber ein fehlender Name wirft. Also immer durch hol(). */
function hol(fn,fb){ try{ var v=fn(); return v===undefined?fb:v; }catch(e){ return fb; } }
function fnDa(fn){ return hol(fn,null)!==null; }
var esc=function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); };

/* ---- Zustand ------------------------------------------------------------- */
function leer(){ return {v:1,ansicht:null,nutzung:{},pins:[],letzte:[],buehne:null}; }
var F=(function(){ try{ var o=JSON.parse(localStorage.getItem(KEY)||'{}'); return Object.assign(leer(),o&&typeof o==='object'?o:{}); }catch(e){ return leer(); } })();
if(!F.nutzung||typeof F.nutzung!=='object') F.nutzung={};
if(!Array.isArray(F.pins)) F.pins=[]; if(!Array.isArray(F.letzte)) F.letzte=[];
function sichern(){ try{ localStorage.setItem(KEY,JSON.stringify(F)); }catch(e){} }
try{ if(Array.isArray(EXPORT_KEYS)&&EXPORT_KEYS.indexOf(KEY)<0) EXPORT_KEYS.push(KEY); }catch(e){}

/* ---- Katalog der Einstiegspunkte -----------------------------------------
   id      Kennung (auch für ?go=… und data-ep)
   ic/t/s  Symbol, Titel, Untertitel (statisch — die Live-Zeile kommt aus zeile())
   prior   Startgewicht: so entsteht der Standard, bevor jemand geklickt hat
   art     'buehne' (eine Karte des Compass), 'ritual', 'john', 'link', 'aktion'
   karte   liefert das Karten-HTML (nur art 'buehne'); nach() füllt sie danach
   zeile   Live-Zeile — ehrlich: Zahl nur, wenn die Quelle da ist
   sel     Klicks im vollen Compass, die als Nutzung dieses Einstiegs zählen
   nur     Verfügbarkeit (Funktion/Knopf vorhanden?) */
var KATALOG=[
  { id:'board', ic:'🧭', t:'Mein Board', s:'Deine Arbeit auf einen Blick', prior:1.0, art:'buehne',
    nur:function(){ return fnDa(function(){ return kanbanCard; }); },
    karte:function(){ if(hol(function(){ return KAN.mode; },'personal')!=='personal'){ try{ KAN.mode='personal'; localStorage.setItem('compassKanban','personal'); }catch(e){} } return kanbanCard(); },
    nach:function(){ try{ if(hol(function(){ return KAN.view; },'board')==='board'){ pkDnD(); if(!PK.geladen) pkLaden(false); } else trelloLive(); }catch(e){} },
    zeile:function(){
      if(!hol(function(){ return PK.geladen; },false)) return {t:'wird geladen …',live:false};
      var m=pkMetrik(pkQuellen());
      return {t:m.wip+'/'+m.limit+' in Arbeit · '+m.bereit+' bereit · '+m.wartet+' wartet'+(m.over?' · '+m.over+' überfällig':''), live:true, warn:m.wip>m.limit||m.over>0};
    },
    sel:'#kanbanCard, #kanbanSeg [data-k="personal"]' },
  { id:'heute', ic:'🪷', t:'Heute im Blick', s:'Deine drei Kennzahlen und Johns Summary', prior:0.8, art:'buehne',
    nur:function(){ return fnDa(function(){ return lotusCard; }); },
    karte:function(){ return lotusCard(); },
    nach:function(){ try{ lotusVerdrahten(); }catch(e){} },
    zeile:function(){
      var n=hol(function(){ return lotusPool().length; },0);
      var sum=hol(function(){ return S.summary&&S.summary.datum===heute()?S.summary.text:''; },'');
      if(sum){ var m=String(sum).match(/^.*?[.!?](?=\s|$)/); var t0=m?m[0]:String(sum); return {t:t0.length>110?t0.slice(0,108)+'…':t0, live:true}; }
      if(n) return {t:n+' Kennzahlen live', live:true};
      return {t:hol(function(){ return LOT.geladen; },false)?'noch keine Kennzahl angebunden':'Zahlen werden geladen …', live:false};
    },
    sel:'#lotusCard' },
  { id:'john', ic:'🤵', t:'John', s:'Coach und Sparringspartner — frag ihn, was heute zählt', prior:0.6, art:'john',
    nur:function(){ return fnDa(function(){ return johnOpen; }); },
    run:function(){ johnOpen(); },
    zeile:function(){
      var on=hol(function(){ return johnOnline; },null);
      if(on===true){ var s=hol(function(){ var mo=JOHN_MODI.find(function(x){ return x.id===JK_MODUS; })||JOHN_MODI[0]; return mo.was; },''); return {t:s?'ruft dich: '+s:'verbunden — bereit für deine Frage', live:true}; }
      if(on===false) return {t:'offline — der Server läuft nicht', live:false};
      return {t:'verbindet …', live:false};
    },
    sel:'#btnJohnTop, #johnFab, .card.jk' },
  { id:'kalender', ic:'📅', t:'Kalender', s:'Termine heute, freie Blöcke, nächster Termin', prior:0.3, art:'buehne',
    nur:function(){ return fnDa(function(){ return kalenderCard; }); },
    karte:function(){ return kalenderCard(); }, nach:function(){ try{ kalenderRefresh(); }catch(e){} },
    zeile:function(){
      if(!hol(function(){ return KAL.geladen; },false)) return {t:'wird geladen …',live:false};
      var k=hol(function(){ return KAL.data; },null);
      if(!k){ var f=hol(function(){ return KAL.fehler; },null); return {t:f?(f.error==='NO_ICS'?'nicht angebunden':'Fehler: '+(f.error||'?')):'offline — der Server läuft nicht', live:false}; }
      var h=k.heute||{}, n=k.naechster, alle=(h.ganztags||[]).concat(h.termine||[]).length;
      if(n&&n.laeuft) return {t:'läuft gerade: '+n.titel, live:true};
      if(n) return {t:alle+' heute · nächster in '+fmtMinFv(n.inMin)+': '+n.titel, live:true};
      return {t:alle?alle+' Termine heute':'heute frei — der Tag gehört dem Einen', live:true};
    },
    sel:'#kalBody' },
  { id:'fragen', ic:'💬', t:'Rückfragen', s:'Entscheidungen, die auf dich warten', prior:0.4, art:'ritual',
    nur:function(){ return fnDa(function(){ return starte; })&&fnDa(function(){ return offeneFragen; }); },
    run:function(){ starte('fragen'); },
    zeile:function(){ var n=hol(function(){ return offeneFragen().length; },0); return {t:n?n+' offen — in Sekunden entschieden':'alles beantwortet', live:true, warn:n>0}; },
    sel:'.rit[data-r="fragen"]' },
  { id:'postfach', ic:'📬', t:'Postfach', s:'Wer wartet auf eine Antwort von dir', prior:0.3, art:'buehne',
    nur:function(){ return fnDa(function(){ return postfCard; }); },
    karte:function(){ return postfCard(); }, nach:function(){ try{ postfRefresh(); }catch(e){} },
    zeile:function(){ return messZeile(hol(function(){ return POSTF; },null)); },
    sel:'#postfBody' },
  { id:'slack', ic:'💬', t:'Slack', s:'Kanäle, die auf dich warten', prior:0.2, art:'buehne',
    nur:function(){ return fnDa(function(){ return slrCard; }); },
    karte:function(){ return slrCard(); }, nach:function(){ try{ slrRefresh(); }catch(e){} },
    zeile:function(){ return messZeile(hol(function(){ return SLACK; },null)); },
    sel:'#slackBody' },
  { id:'trichter', ic:'🫂', t:'Trichter', s:'Menschen, die auf eine Entscheidung warten', prior:0.3, art:'buehne',
    nur:function(){ return fnDa(function(){ return triCard; }); },
    karte:function(){ return triCard(); }, nach:function(){ try{ triRefresh(); }catch(e){} },
    zeile:function(){
      if(!hol(function(){ return TRI.geladen; },false)) return {t:'wird geladen …',live:false};
      if(!hol(function(){ return TRI.data; },null)) return {t:'offline — der Server läuft nicht',live:false};
      var n=hol(function(){ return triAktiv().length; },0); return {t:n?n+(n===1?' Mensch wartet':' Menschen warten')+' auf dich':'niemand wartet', live:true, warn:n>0};
    },
    sel:'#triBody, .rit[data-r="trichter"]' },
  { id:'woche', ic:'🗓️', t:'Diese Woche', s:'Die Schritte, die du dir vorgenommen hast', prior:0.3, art:'buehne',
    nur:function(){ return fnDa(function(){ return wocheCard; }); },
    karte:function(){ return wocheCard().replace('class="card s6 tone-bene"','class="card s12 tone-bene"'); },
    zeile:function(){ return {t:'Wochenstart-Schritte und Rückfragen', live:false}; } },
  { id:'kennzahlen', ic:'📊', t:'Kennzahlen', s:'Die Kennzahlenseite mit allen Blüten', prior:0.5, art:'link', href:'kennzahlen.html',
    nur:function(){ return !!document.querySelector('a[href^="kennzahlen.html"]'); },
    zeile:function(){ var n=hol(function(){ return lotusPool().length; },0); return {t:n?n+' Kennzahlen live':'Traffic, Jira, Blüten', live:n>0}; },
    sel:'a[href^="kennzahlen.html"]' },
  { id:'kundenlage', ic:'🧭', t:'Kundenlage', s:'Wo jede Kundin gerade steht', prior:0.2, art:'link', href:'kundenlage.html',
    nur:function(){ return !!document.querySelector('a[href^="kundenlage.html"]'); },
    zeile:function(){ return {t:'Kundschaft, Stand, nächster Schritt', live:false}; },
    sel:'a[href^="kundenlage.html"]' },
  { id:'cockpit', ic:'🏢', t:'Team-Cockpit', s:'Das Kanban des ganzen Teams', prior:0.3, art:'link', neu:true,
    href:function(){ return hol(function(){ return cockpitUrl('start'); },''); },
    nur:function(){ return !!hol(function(){ return COMPASS.cockpit.url; },''); },
    zeile:function(){ return {t:hol(function(){ return COMPASS.cockpit.label; },'')||'öffnet in einem neuen Tab', live:false}; },
    sel:'#kanbanSeg [data-k="vishnu"]' },
  { id:'neu', ic:'➕', t:'Neue Karte', s:'Eine Zeile, ein Ergebnis — landet auf dem Board', prior:0.2, art:'aktion',
    nur:function(){ return fnDa(function(){ return pkNeu; }); },
    run:function(){ pkNeu('bereit'); },
    zeile:function(){ return {t:'auf Mein Board, in Trello oder in Jira', live:false}; },
    sel:'#novGo' }
];
function KAT(id){ for(var i=0;i<KATALOG.length;i++) if(KATALOG[i].id===id) return KATALOG[i]; return null; }
function verfuegbar(e){ try{ return !e.nur||!!e.nur(); }catch(x){ return false; } }
function fmtMinFv(m){ m=Math.max(0,Math.round(m||0)); return m<60?m+' Min':(Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' Min':'')); }
function messZeile(Q){
  if(!Q) return {t:'nicht angebunden',live:false};
  if(!Q.geladen) return {t:'wird geladen …',live:false};
  if(!Q.data){ var f=Q.fehler; return {t:f?(f.error==='NO_DATA'?'noch nicht gemessen':'Fehler: '+(f.error||'?')):'offline — der Server läuft nicht', live:false}; }
  var z=Q.data.zusammenfassung||{}, n=z.wartet; var alter=Q.data.alterMin;
  var wann=alter==null?'':(alter<90?' · vor '+alter+' Min':' · vor '+Math.round(alter/60)+' h');
  return {t:(n==null?'gemessen':(n?n+' warten auf dich':'nichts wartet'))+wann, live:true, warn:n>0};
}

/* ---- Lernen: zählen, gewichten, auswählen -------------------------------- */
var zuletzt={};
function zaehlen(id){
  if(!KAT(id)) return;
  var now=Date.now();
  if(zuletzt[id]&&now-zuletzt[id]<2000) return;      /* Doppelzählung (Klick + gewickelte Funktion) */
  zuletzt[id]=now;
  var l=F.nutzung[id]||(F.nutzung[id]=[]); l.push(now); if(l.length>80) l.splice(0,l.length-80);
  sichern();
}
function gewicht(id){
  var e=KAT(id); if(!e) return 0;
  var now=Date.now(), s=e.prior||0, l=F.nutzung[id]||[];
  for(var i=0;i<l.length;i++) s+=Math.pow(0.5,(now-l[i])/HALBWERT);
  return s;
}
function auswahl(){
  var verf=KATALOG.filter(verfuegbar);
  var ok=function(id){ return verf.some(function(e){ return e.id===id; }); };
  var pins=F.pins.filter(ok).slice(0,KACHELN);
  var frei=KACHELN-pins.length;
  var wahl=F.letzte.filter(function(id){ return ok(id)&&pins.indexOf(id)<0; }).slice(0,frei);
  var kand=verf.filter(function(e){ return pins.indexOf(e.id)<0; }).map(function(e){ return {id:e.id,g:gewicht(e.id)}; }).sort(function(a,b){ return b.g-a.g; });
  kand.forEach(function(k){
    if(wahl.indexOf(k.id)>=0) return;
    if(wahl.length<frei){ wahl.push(k.id); return; }
    var wi=-1, wg=Infinity; wahl.forEach(function(id,i){ var g=gewicht(id); if(g<wg){ wg=g; wi=i; } });
    if(k.g>wg*1.25+0.3) wahl[wi]=k.id;               /* Hysterese: nur deutlich Besseres verdrängt */
  });
  wahl.sort(function(a,b){ return gewicht(b)-gewicht(a); });
  F.letzte=wahl.slice(); sichern();
  return pins.concat(wahl).slice(0,KACHELN);
}
function pinToggle(id){
  var i=F.pins.indexOf(id);
  if(i>=0) F.pins.splice(i,1);
  else { if(F.pins.length>=KACHELN) F.pins.shift(); F.pins.push(id); }
  sichern(); kachelnMalen();
}

/* ---- Ansicht: focus | voll ----------------------------------------------- */
function neuHier(){
  return hol(function(){ return !S.xp && !S.lastMorgen && !Object.keys(S.hist||{}).length; },true);
}
function ansicht(){
  if(F.ansicht==='focus'||F.ansicht==='voll') return F.ansicht;
  return neuHier()?'focus':'voll';
}
function istFocus(){ return ansicht()==='focus'; }
function ansichtSetzen(a,still){
  F.ansicht=a==='focus'?'focus':'voll'; if(F.ansicht==='voll') F.buehne=null; sichern();
  anwenden();
  try{ render(hol(function(){ return aktuell; },'va')); }catch(e){ nachRender(); }
  if(!still){ try{ toast(F.ansicht==='focus'?'◎ Einfache Ansicht — drei Einstiege, der Rest wartet hinter „Alles“':'▦ Alles — die volle Ansicht (S schaltet zurück)'); }catch(e){} }
}
function anwenden(){
  var f=istFocus();
  document.body.classList.toggle('ansicht-focus',f);
  var b=document.getElementById('btnAnsicht');
  if(b){ b.innerHTML=f?'▦ Alles <span class="kbd">S</span>':'◎ Einfach <span class="kbd">S</span>'; b.title=f?'Alles zeigen — die volle Ansicht (Taste S)':'Einfache Ansicht: drei Einstiege, sonst nichts (Taste S)'; b.classList.toggle('p',f); }
  var v=document.getElementById('focusview'); if(v) v.hidden=!f;
  if(f) kachelnMalen(); else buehneMalen();
}

/* ---- Oberfläche ---------------------------------------------------------- */
function stil(){
  if(document.getElementById('fvStyle')) return;
  var s=document.createElement('style'); s.id='fvStyle';
  s.textContent=[
    'body.ansicht-focus .focus,body.ansicht-focus #obenDock,body.ansicht-focus .tabs,body.ansicht-focus #grid{display:none !important}',
    '#focusview{padding:16px 32px 0}',
    '#focusview .fv-eine{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 14px;padding:0 4px}',
    '#focusview .fv-eine .fl{font-size:10.5px;text-transform:uppercase;letter-spacing:.9px;color:var(--bene);font-weight:800}',
    '#focusview .fv-eine .ft{font-family:var(--serif);font-size:24px;line-height:1.2}',
    '#focusview .fv-eine .ft.leer{color:var(--dim);font-size:15px;font-style:italic;font-family:var(--sans)}',
    '#focusview .fv-kacheln{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}',
    '#focusview .fv-kachel{position:relative;display:flex;flex-direction:column;gap:6px;text-align:left;min-height:150px;padding:20px 22px 18px;',
    '  background:linear-gradient(135deg,var(--va-soft),var(--panel) 60%,var(--vk-soft));border:1px solid var(--line);border-radius:var(--radius);',
    '  box-shadow:var(--shadow);color:var(--ink);cursor:pointer;font:inherit;transition:transform .18s,border-color .18s}',
    '#focusview .fv-kachel:hover,#focusview .fv-kachel:focus-visible{transform:translateY(-2px);border-color:var(--bene);outline:none}',
    '#focusview .fv-kachel.warn{border-color:var(--bene)}',
    '#focusview .fv-kachel .ic{font-size:30px;line-height:1}',
    '#focusview .fv-kachel .t{font-family:var(--serif);font-size:24px;line-height:1.15;margin-top:4px}',
    '#focusview .fv-kachel .s{font-size:12.5px;color:var(--sub);line-height:1.35}',
    '#focusview .fv-kachel .z{margin-top:auto;padding-top:10px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px}',
    '#focusview .fv-kachel .z .dot{width:8px;height:8px;border-radius:50%;background:var(--dim);flex:none}',
    '#focusview .fv-kachel .z.live .dot{background:var(--ok)}',
    '#focusview .fv-kachel .z.warn .dot{background:var(--bene)}',
    '#focusview .fv-kachel .pfeil{position:absolute;right:18px;bottom:16px;font-size:18px;color:var(--dim)}',
    '#focusview .fv-kachel .pin{position:absolute;right:12px;top:10px;border:none;background:transparent;font-size:14px;opacity:.35;cursor:pointer;padding:4px;border-radius:8px}',
    '#focusview .fv-kachel .pin:hover,#focusview .fv-kachel .pin.on{opacity:1;background:var(--bene-soft)}',
    '#focusview .fv-mehr{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0 0;padding:0 2px}',
    '#focusview .fv-mehr .lab{font-size:10.5px;text-transform:uppercase;letter-spacing:.8px;color:var(--dim);font-weight:800;margin-right:4px}',
    '#focusview .fv-chip{display:inline-flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:6px 6px 6px 11px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}',
    '#focusview .fv-chip:hover{border-color:var(--bene)}',
    '#focusview .fv-chip .anh{border:none;background:transparent;color:var(--dim);font-size:13px;cursor:pointer;padding:0 4px;border-radius:50%;line-height:1}',
    '#focusview .fv-chip .anh:hover{color:var(--bene)}',
    '#focusview .fv-hint{color:var(--dim);font-size:11.5px;margin:12px 2px 0}',
    '#focusview .fv-hint a{color:var(--sub)}',
    '#'+STAGE_ID+'{margin:18px 0 0}',
    '#'+STAGE_ID+' .fv-stagebar{display:flex;align-items:center;gap:12px;margin:0 0 12px;flex-wrap:wrap}',
    '#'+STAGE_ID+' .fv-stagetitle{font-family:var(--serif);font-size:20px}',
    '#'+STAGE_ID+' .fv-grid .card{grid-column:1 / -1 !important}',
    '@media(max-width:900px){#focusview .fv-kacheln{grid-template-columns:1fr}#focusview .fv-kachel{min-height:0}}',
    '@media(max-width:720px){#focusview{padding:12px 16px 0}}'
  ].join('\n');
  document.head.appendChild(s);
}
function viewEl(){
  var v=document.getElementById('focusview');
  if(v) return v;
  var r=document.getElementById('rhythm'); if(!r) return null;
  v=document.createElement('section'); v.id='focusview'; v.setAttribute('aria-label','Einfache Ansicht: drei Einstiege'); v.hidden=true;
  r.parentNode.insertBefore(v,r.nextSibling);
  v.addEventListener('click',function(e){
    var pin=e.target.closest('.pin,.anh'); if(pin){ e.preventDefault(); e.stopPropagation(); pinToggle(pin.getAttribute('data-pin')); return; }
    var k=e.target.closest('[data-ep]'); if(k){ e.preventDefault(); oeffnen(k.getAttribute('data-ep')); return; }
    var a=e.target.closest('[data-fv="alles"]'); if(a){ e.preventDefault(); ansichtSetzen('voll'); }
  });
  return v;
}
function stageEl(){
  var st=document.getElementById(STAGE_ID);
  if(st) return st;
  var g=document.getElementById('grid'); if(!g) return null;
  st=document.createElement('div'); st.id=STAGE_ID; st.hidden=true;
  g.parentNode.insertBefore(st,g);
  st.addEventListener('click',function(e){
    var z=e.target.closest('[data-fv="zurueck"]'); if(z){ e.preventDefault(); F.buehne=null; sichern(); buehneMalen(); kachelnMalen(); window.scrollTo({top:0,behavior:'smooth'}); return; }
    var a=e.target.closest('[data-fv="alles"]'); if(a){ e.preventDefault(); ansichtSetzen('voll'); }
  });
  return st;
}
function kachelHtml(id){
  var e=KAT(id); if(!e) return '';
  var pinned=F.pins.indexOf(id)>=0;
  return '<button class="fv-kachel" data-ep="'+esc(id)+'" title="'+esc(e.s)+'">'
    +'<span class="ic">'+e.ic+'</span><span class="t">'+esc(e.t)+'</span><span class="s">'+esc(e.s)+'</span>'
    +'<span class="z"><span class="dot"></span><span class="zt">…</span></span>'
    +'<span class="pfeil">'+(e.neu?'↗':'→')+'</span>'
    +'<span class="pin '+(pinned?'on':'')+'" data-pin="'+esc(id)+'" role="button" tabindex="0" title="'+(pinned?'Angeheftet — Klick löst':'Anheften: bleibt als Kachel, egal was du sonst öffnest')+'">📌</span>'
    +'</button>';
}
function kachelnMalen(){
  var v=viewEl(); if(!v||!istFocus()) return;
  var drei=auswahl();
  var eine=hol(function(){ return dasEine(); },'');
  var rest=KATALOG.filter(function(e){ return verfuegbar(e)&&drei.indexOf(e.id)<0; });
  v.innerHTML=
    '<div class="fv-eine"><span class="fl">Das Eine · heute</span>'
      +(eine?'<span class="ft">'+esc(eine)+'</span>':'<span class="ft leer">Noch nicht gesetzt — starte oben den Morgencheck</span>')+'</div>'
    +'<div class="fv-kacheln">'+drei.map(kachelHtml).join('')+'</div>'
    +'<div class="fv-mehr"><span class="lab">Weitere Einstiege</span>'
      +rest.map(function(e){ return '<span class="fv-chip" data-ep="'+esc(e.id)+'" role="button" tabindex="0" title="'+esc(e.s)+'">'+e.ic+' '+esc(e.t)
        +'<button class="anh" data-pin="'+esc(e.id)+'" title="Als Kachel anheften">⊕</button></span>'; }).join('')+'</div>'
    +'<div class="fv-hint">Die drei Kacheln folgen dem, was du am häufigsten öffnest — ab Werk: Mein Board, Heute im Blick, John. 📌 hält eine Kachel fest. '
      +'<a href="#" data-fv="alles">Alles zeigen (S)</a></div>';
  zeilenMalen();
  buehneMalen();
}
function zeilenMalen(){
  var v=document.getElementById('focusview'); if(!v||v.hidden) return;
  v.querySelectorAll('.fv-kachel[data-ep]').forEach(function(k){
    var e=KAT(k.getAttribute('data-ep')); if(!e) return;
    var z; try{ z=e.zeile?e.zeile():null; }catch(x){ z=null; }
    if(!z) z={t:'',live:false};
    var zel=k.querySelector('.z'), tel=k.querySelector('.zt');
    if(tel) tel.textContent=z.t||'';
    if(zel){ zel.classList.toggle('live',!!z.live&&!z.warn); zel.classList.toggle('warn',!!z.warn); }
    k.classList.toggle('warn',!!z.warn);
  });
}
function buehneMalen(){
  var st=stageEl(); if(!st) return;
  var e=istFocus()&&F.buehne?KAT(F.buehne):null;
  if(!e||e.art!=='buehne'||!verfuegbar(e)){ st.innerHTML=''; st.hidden=true; return; }
  var html='';
  try{ html=e.karte(); }catch(x){ html='<div class="card s12"><h3>'+e.ic+' '+esc(e.t)+'</h3><div class="empty">Diese Karte lässt sich gerade nicht zeigen.</div></div>'; }
  st.innerHTML='<div class="fv-stagebar"><button class="btn" data-fv="zurueck">‹ Zurück zu den Einstiegen</button>'
    +'<span class="fv-stagetitle">'+e.ic+' '+esc(e.t)+'</span><span style="flex:1"></span>'
    +'<a href="#" class="btn" data-fv="alles">▦ Alles zeigen</a></div>'
    +'<div class="grid fv-grid">'+html+'</div>';
  st.hidden=false;
  try{ if(e.nach) e.nach(); }catch(x){}
}
function oeffnen(id){
  var e=KAT(id); if(!e||!verfuegbar(e)) return false;
  zaehlen(id);
  if(e.art==='buehne'){ F.buehne=id; sichern(); buehneMalen(); var st=document.getElementById(STAGE_ID); if(st) setTimeout(function(){ st.scrollIntoView({behavior:'smooth',block:'start'}); },60); return true; }
  if(e.art==='link'){ var h=typeof e.href==='function'?e.href():e.href; if(!h) return false; if(e.neu) window.open(h,'vishnuCockpit'); else location.href=h; return true; }
  try{ e.run(); }catch(x){ return false; }
  return true;
}

/* ---- Anschluss an den Compass -------------------------------------------- */
/* render() baut #grid komplett neu. In der Focus View bleibt das Raster leer —
   die Bühne (eine Karte) lebt in #focusStage, damit jede Karten-ID genau einmal
   auf der Seite steht und die Refresh-Funktionen (kalenderRefresh, postfRefresh …)
   die Bühne füllen statt ein verstecktes Raster. */
function nachRender(){
  if(!istFocus()) return;
  var g=document.getElementById('grid'); if(g&&g.children.length) g.innerHTML='';
  kachelnMalen();
}
function wickeln(name,vor,nach){
  var orig=window[name]; if(typeof orig!=='function') return;
  window[name]=function(){ try{ if(vor) vor.apply(this,arguments); }catch(e){} var r=orig.apply(this,arguments); try{ if(nach) nach.apply(this,arguments); }catch(e){} return r; };
}
function anschliessen(){
  wickeln('render',null,nachRender);
  wickeln('starte',function(art){ if(art==='fragen') zaehlen('fragen'); });
  wickeln('johnOpen',function(){ zaehlen('john'); });
  wickeln('kanbanSet',function(m){ zaehlen(m==='vishnu'?'cockpit':'board'); });
  /* ?go=… führt in der Focus View direkt auf die Kachel; alles andere macht der Compass wie bisher */
  var origGo=window.compassGo;
  if(typeof origGo==='function') window.compassGo=function(id){ id=String(id||'').toLowerCase().trim(); if(istFocus()&&KAT(id)){ return oeffnen(id); } return origGo.apply(this,arguments); };
  /* Nutzung im vollen Compass zählen — Klicks auf alles, was einen Einstieg bedeutet */
  document.addEventListener('click',function(e){
    if(!e.target||!e.target.closest) return;
    if(e.target.closest('#focusview,#'+STAGE_ID)) return;     /* die Kacheln zählen selbst */
    for(var i=0;i<KATALOG.length;i++){ var k=KATALOG[i]; if(k.sel){ try{ if(e.target.closest(k.sel)) zaehlen(k.id); }catch(x){} } }
  },true);
  document.addEventListener('keydown',function(e){
    if(e.target.matches('input,textarea')||e.ctrlKey||e.metaKey||e.altKey) return;
    var k=e.key.toLowerCase();
    if(k==='s'){ ansichtSetzen(istFocus()?'voll':'focus'); return; }
    if(k==='k') zaehlen('kennzahlen'); if(k==='j') zaehlen('john'); if(k==='b') zaehlen(hol(function(){ return KAN.mode; },'personal')==='vishnu'?'board':'cockpit');
  });
}
function kopfKnopf(){
  if(document.getElementById('btnAnsicht')) return;
  var t=document.getElementById('btnTheme'); if(!t) return;
  var b=document.createElement('button'); b.id='btnAnsicht'; b.className='btn'; b.setAttribute('data-nolang','');
  b.addEventListener('click',function(){ ansichtSetzen(istFocus()?'voll':'focus'); });
  t.parentNode.insertBefore(b,t);
  var keys=document.querySelector('#foot .keys'); if(keys&&keys.textContent.indexOf('S Einfach')<0) keys.textContent+=' · S Einfach/Alles';
}
/* ---- Sprachen: Einträge fürs Overlay (compass-i18n.js), Schlüssel = deutscher Text */
function woerter(){
  var W=hol(function(){ return compassSprache.woerter; },null); if(!W) return;
  var N={
    'Einfach':['Simple','مبسّط'], 'Alles':['Everything','الكل'],
    'Alles zeigen — die volle Ansicht (Taste S)':['Show everything — the full view (key S)','عرض الكل — العرض الكامل (المفتاح S)'],
    'Einfache Ansicht: drei Einstiege, sonst nichts (Taste S)':['Simple view: three entry points, nothing else (key S)','عرض مبسّط: ثلاث نقاط دخول لا غير (المفتاح S)'],
    'Einfache Ansicht: drei Einstiege':['Simple view: three entry points','عرض مبسّط: ثلاث نقاط دخول'],
    'Noch nicht gesetzt — starte oben den Morgencheck':['Not set yet — start the morning check above','لم يُحدَّد بعد — ابدأ فحص الصباح في الأعلى'],
    'Weitere Einstiege':['More entry points','مداخل أخرى'],
    'Als Kachel anheften':['Pin as a tile','تثبيت كبلاطة'],
    'Angeheftet — Klick löst':['Pinned — click to release','مثبّت — انقر للإلغاء'],
    'Anheften: bleibt als Kachel, egal was du sonst öffnest':['Pin: stays as a tile whatever else you open','تثبيت: تبقى كبلاطة مهما فتحت غيرها'],
    'Alles zeigen (S)':['Show everything (S)','عرض الكل (S)'], 'Alles zeigen':['Show everything','عرض الكل'],
    'Zurück zu den Einstiegen':['Back to the entry points','العودة إلى المداخل'],
    'Die drei Kacheln folgen dem, was du am häufigsten öffnest — ab Werk: Mein Board, Heute im Blick, John. 📌 hält eine Kachel fest.':
      ['The three tiles follow what you open most often — by default: My Board, Today in Focus, John. 📌 keeps a tile in place.','تتبع البلاطات الثلاث ما تفتحه أكثر — افتراضيًا: لوحتي، اليوم في البؤرة، جون. 📌 يثبّت بلاطة.'],
    'Mein Board':['My Board','لوحتي'], 'Deine Arbeit auf einen Blick':['Your work at a glance','عملك بنظرة واحدة'],
    'Heute im Blick':['Today in Focus','اليوم في البؤرة'], 'Deine drei Kennzahlen und Johns Summary':['Your three key figures and John\'s summary','مؤشراتك الثلاثة وملخّص جون'],
    'Coach und Sparringspartner — frag ihn, was heute zählt':['Coach and sparring partner — ask him what matters today','مدرّب وشريك نقاش — اسأله ما يهمّ اليوم'],
    'Kalender':['Calendar','التقويم'], 'Termine heute, freie Blöcke, nächster Termin':['Today\'s events, free blocks, next appointment','مواعيد اليوم، الفترات الحرة، الموعد التالي'],
    'Rückfragen':['Questions','استفسارات'], 'Entscheidungen, die auf dich warten':['Decisions waiting for you','قرارات بانتظارك'],
    'Postfach':['Inbox','صندوق البريد'], 'Wer wartet auf eine Antwort von dir':['Who is waiting for your reply','من ينتظر ردّك'],
    'Kanäle, die auf dich warten':['Channels waiting for you','قنوات بانتظارك'],
    'Trichter':['Funnel','القمع'], 'Menschen, die auf eine Entscheidung warten':['People waiting for a decision','أشخاص ينتظرون قرارًا'],
    'Diese Woche':['This week','هذا الأسبوع'], 'Die Schritte, die du dir vorgenommen hast':['The steps you set yourself','الخطوات التي عزمت عليها'],
    'Kennzahlen':['Key figures','المؤشرات'], 'Die Kennzahlenseite mit allen Blüten':['The key-figures page with all blossoms','صفحة المؤشرات بكل الأزهار'],
    'Kundenlage':['Client status','وضع العملاء'], 'Wo jede Kundin gerade steht':['Where each client stands right now','أين يقف كل عميل الآن'],
    'Team-Cockpit':['Team Cockpit','قُمرة الفريق'], 'Das Kanban des ganzen Teams':['The whole team\'s kanban','كانبان الفريق كله'],
    'Neue Karte':['New card','بطاقة جديدة'], 'Eine Zeile, ein Ergebnis — landet auf dem Board':['One line, one result — lands on the board','سطر واحد، نتيجة واحدة — تصل إلى اللوحة'],
    'wird geladen …':['loading …','جارٍ التحميل …'], 'verbindet …':['connecting …','جارٍ الاتصال …'],
    'offline — der Server läuft nicht':['offline — the server is not running','غير متصل — الخادم لا يعمل'],
    'nicht angebunden':['not connected','غير موصول'], 'noch nicht gemessen':['not measured yet','لم يُقَس بعد'],
    'alles beantwortet':['all answered','أُجيب عن الكل'], '{1} offen — in Sekunden entschieden':['{1} open — decided in seconds','{1} مفتوحة — تُحسم في ثوانٍ'],
    '{1} Kennzahlen live':['{1} key figures live','{1} مؤشرات حيّة'], 'Traffic, Jira, Blüten':['Traffic, Jira, blossoms','الزيارات، Jira، الأزهار'],
    'nichts wartet':['nothing waiting','لا شيء ينتظر'], '{1} warten auf dich':['{1} waiting for you','{1} بانتظارك'],
    'niemand wartet':['nobody is waiting','لا أحد ينتظر'], 'heute frei — der Tag gehört dem Einen':['free today — the day belongs to the One','اليوم حرّ — اليوم للأمر الواحد'],
    'verbunden — bereit für deine Frage':['connected — ready for your question','متصل — جاهز لسؤالك'],
    'auf Mein Board, in Trello oder in Jira':['on My Board, in Trello or in Jira','على لوحتي أو في Trello أو Jira'],
    'Wochenstart-Schritte und Rückfragen':['Week-start steps and questions','خطوات بداية الأسبوع والاستفسارات'],
    'Kundschaft, Stand, nächster Schritt':['Clients, status, next step','العملاء، الحالة، الخطوة التالية'],
    'öffnet in einem neuen Tab':['opens in a new tab','يُفتح في تبويب جديد'],
    'Diese Karte lässt sich gerade nicht zeigen.':['This card cannot be shown right now.','لا يمكن عرض هذه البطاقة الآن.']
  };
  Object.keys(N).forEach(function(k){ if(!W[k]) W[k]=N[k]; });
}

/* ---- Start ---------------------------------------------------------------- */
function start(){
  stil(); woerter(); kopfKnopf(); viewEl(); stageEl(); anschliessen();
  var p=new URLSearchParams(location.search).get('ansicht');
  if(p==='focus'||p==='einfach'){ F.ansicht='focus'; sichern(); }
  if(p==='voll'||p==='alles'){ F.ansicht='voll'; sichern(); }
  anwenden(); nachRender();
  setInterval(zeilenMalen,15000);
  window.compassFocus={ ansicht:ansichtSetzen, oeffnen:oeffnen, gewichte:function(){ var o={}; KATALOG.forEach(function(e){ o[e.id]=Math.round(gewicht(e.id)*100)/100; }); return o; }, zustand:function(){ return F; } };
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
