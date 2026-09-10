/* ============================================================================
   compass-tasten.js — die Tastatur-Ebene des Flow Compass (11.09.2026)

   Anlass: Im Abendcheck kam man mit Return nicht weiter — der globale Tastenhandler
   ignorierte jedes Eingabefeld, und kein Ritual-Schritt kannte Enter. Daraus ist ein
   Konzept für alle Seiten geworden: wer ohne Maus arbeitet, soll überrascht werden,
   wer mit Maus arbeitet, soll nichts davon merken.

   EINE GRAMMATIK, AUF JEDER SEITE GLEICH
     ⏎            tut, was der farbige Knopf tut (Weiter, Anlegen, Schließen)
     ⇧⏎           Zeilenumbruch — nur dort, wo ein Feld wirklich mehrzeilig ist
     Strg ⏎       schickt ab, auch aus mehrzeiligen Feldern
     Esc          eine Ebene zurück
     1 – 9        die n-te Wahl: im Dialog die Antwort, auf einer Karte die Aktion
     ← →          zwischen Antworten wandern · ↑ ↓ zur nächsten Frage
     Alt ← →      im Ritual einen Schritt zurück / weiter
     Buchstaben   springen (M, A, R, N, K, J, B …) — nie in Feldern, nie in Dialogen
     ?            Tastenhilfe

   DREI REGELN, DAMIT NIEMAND GESTÖRT WIRD
   1. Unsichtbar für die Maus: Ziffern-Plaketten und Fokusrahmen gibt es erst, wenn
      jemand Tab oder eine Taste drückt (html[data-tastatur]); der nächste Klick nimmt
      sie wieder weg. Fokusrahmen laufen über :focus-visible.
   2. Enter löst nie etwas aus, wo der Fokus nur „gelandet“ ist: öffnet sich ein
      Schritt, setzt die Ebene den Fokus auf die erste Antwort (damit 1–9 sofort
      greifen). Wer dort nur Enter drückt, geht weiter — ohne diese Antwort gewählt
      zu haben. Erst wer sich selbst dorthin bewegt, wählt mit Enter.
   3. Tippen landet im Feld: steht der Fokus auf einer Antwort und man tippt einen
      Buchstaben, springt er ins Notizfeld und der Buchstabe steht dort. Wer im
      Abendcheck „2“ drückt und „porsche“ tippt, hat beides erledigt — ⏎, fertig.

   ANSCHLUSS
   Die Seiten melden sich über Attribute an, nicht über Code:
     data-tasten          am Dialog: Enter/Alt+Pfeile/Ziffern gelten hier
     data-primaer         der Knopf, den Enter drückt (sonst der erste .btn.a)
     data-zurueck         der Knopf für Alt+←
     data-tasten-weiter   an einer Antwortgruppe: Enter wählt UND geht weiter
     data-mehrzeilig      an einem Textfeld: Enter macht eine neue Zeile
   Seiten-eigene Tasten (Compass, Kennzahlen, Kundenlage, Focus View) erkennt die
   Ebene selbst und trägt sie in die Tastenhilfe ein — die Seiten bleiben unberührt.
   Öffentlich: window.compassTasten = {melden, karten, hilfe, fokusRein, nummerieren}.
   ============================================================================ */
(function(){
'use strict';
if(window.compassTasten) return;
var D=document, H=D.documentElement;

/* ---- Hilfen -------------------------------------------------------------- */
function alle(w,sel){ return Array.prototype.slice.call((w||D).querySelectorAll(sel)); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function feld(el){
  if(!el||!el.tagName) return false;
  var t=el.tagName;
  if(t==='TEXTAREA'||t==='SELECT'||el.isContentEditable) return true;
  if(t!=='INPUT') return false;
  return ['button','submit','reset','checkbox','radio','range','color','file','image'].indexOf(String(el.type||'text').toLowerCase())<0;
}
function sichtbar(el){ return !!(el&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length)); }
function frei(el){
  if(!el||el.disabled||!sichtbar(el)||el.getAttribute('aria-hidden')==='true') return false;
  /* Zuerst der gesetzte Stil: ‹ Zurück wechselt per style.visibility, und während des 0,15-s-Übergangs
     meldet getComputedStyle noch den alten Wert — Alt+← direkt nach dem Schrittwechsel ginge sonst ins Leere. */
  if(el.style&&el.style.visibility) return el.style.visibility!=='hidden';
  try{ return getComputedStyle(el).visibility!=='hidden'; }catch(x){ return true; }
}
function fokus(el){ if(!el) return; try{ el.focus({preventScroll:false}); }catch(x){ try{ el.focus(); }catch(y){} } }

/* ---- 1. Tastatur-Modus: sichtbar erst, wenn jemand tippt ------------------ */
var MODUS=false;
function modus(an){
  if(MODUS===an) return; MODUS=an;
  if(an) H.setAttribute('data-tastatur','an'); else H.removeAttribute('data-tastatur');
}
D.addEventListener('pointerdown',function(){ modus(false); },true);

/* ---- 2. Stil ------------------------------------------------------------- */
var AKZENT='var(--bene,var(--accent,#7c5cff))';
function stil(){
  if(D.getElementById('tastenStil')) return;
  var s=D.createElement('style'); s.id='tastenStil';
  s.textContent=[
    /* Fokusrahmen nur bei Tastaturbedienung — Textfelder zeigen ihren Fokus schon selbst */
    'a:focus-visible,button:focus-visible,summary:focus-visible,select:focus-visible,[role=button]:focus-visible,[tabindex]:not([tabindex="-1"]):focus-visible{outline:2px solid '+AKZENT+';outline-offset:2px}',
    '[tabindex="-1"]:focus{outline:none}',
    /* Ziffern-Plakette an den Antworten: nur im Tastatur-Modus */
    /* … und nur, solange sie wirken: im Textfeld tippen Ziffern, dort bleiben die Plaketten weg */
    '[data-tastatur]:not([data-imfeld]) [data-taste]{position:relative}',
    '[data-tastatur]:not([data-imfeld]) [data-taste]::after{content:attr(data-taste);position:absolute;top:-7px;right:-7px;min-width:15px;height:15px;padding:0 3px;box-sizing:border-box;border-radius:8px;background:'+AKZENT+';color:#14161c;font:800 9.5px/15px ui-monospace,Consolas,monospace;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.45);pointer-events:none;z-index:3}',
    /* Sprungmarke: erscheint beim allerersten Tab und verrät die Tastenhilfe */
    '.tasten-sprung{position:fixed;left:14px;top:10px;z-index:1000;padding:8px 14px;border-radius:10px;background:var(--panel,#171a22);color:var(--ink,#eef1f6);border:1px solid '+AKZENT+';font:700 13px system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none;box-shadow:0 6px 24px rgba(0,0,0,.4);transform:translateY(-220%);transition:transform .15s}',
    '.tasten-sprung:focus{transform:none;outline:none}',
    '.tasten-sprung kbd,#tastenHilfe kbd{display:inline-block;min-width:20px;text-align:center;padding:1px 6px;border-radius:6px;border:1px solid var(--line,#2a2f3a);border-bottom-width:2px;background:var(--panel2,#1e222c);font:700 11.5px ui-monospace,Consolas,monospace;color:var(--ink,#eef1f6);white-space:nowrap}',
    /* Tastenhilfe */
    '#tastenHilfe{position:fixed;inset:0;z-index:990;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,7,12,.74);backdrop-filter:blur(3px)}',
    '#tastenHilfe.on{display:flex}',
    '#tastenHilfe .th{background:var(--panel,#171a22);color:var(--ink,#eef1f6);border:1px solid var(--line,#2a2f3a);border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,.45);width:100%;max-width:760px;max-height:90vh;overflow:auto;padding:22px 24px 18px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}',
    '#tastenHilfe h2{margin:0 0 4px;font-size:20px}',
    '#tastenHilfe .sub{color:var(--sub,#9aa2b1);font-size:12.5px;margin-bottom:16px}',
    '#tastenHilfe .grp{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:16px 26px}',
    '#tastenHilfe h3{margin:0 0 6px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--sub,#9aa2b1)}',
    '#tastenHilfe .jetzt h3{color:'+AKZENT+'}',
    '#tastenHilfe .z{display:flex;gap:10px;align-items:baseline;padding:2px 0;font-size:13px}',
    '#tastenHilfe .k{flex:0 0 112px;text-align:right;color:var(--sub,#9aa2b1);white-space:nowrap}',
    '#tastenHilfe .fuss{margin-top:16px;display:flex;align-items:center;gap:10px;color:var(--sub,#9aa2b1);font-size:12px}',
    '#tastenHilfe .fuss button{margin-left:auto;background:var(--panel2,#1e222c);color:var(--ink,#eef1f6);border:1px solid var(--line,#2a2f3a);border-radius:10px;padding:7px 14px;font:700 12px system-ui,sans-serif;cursor:pointer}'
  ].join('\n');
  (D.head||H).appendChild(s);
}

/* ---- 3. Tastenhilfe: aus dem, was die Seiten melden ----------------------- */
var GRUPPEN=[];   /* {titel, tasten:[[taste,text],…], dialog:bool} */
function melden(titel,tasten,opt){
  var g=null; GRUPPEN.forEach(function(x){ if(x.titel===titel) g=x; });
  if(g) g.tasten=tasten; else GRUPPEN.push(g={titel:titel,tasten:tasten});
  g.dialog=!!(opt&&opt.dialog);
  if(HILFE&&HILFE.classList.contains('on')) hilfeMalen();
}
/* „Alt ←“ → <kbd>Alt</kbd> <kbd>←</kbd>; Bindestrich und „/“ bleiben Text */
function tastenHtml(t){
  return String(t).split(' ').map(function(x){ return (x==='–'||x==='/'||x==='oder')?'<span>'+esc(x)+'</span>':'<kbd>'+esc(x)+'</kbd>'; }).join(' ');
}
var HILFE=null;
function hilfeEl(){
  if(HILFE) return HILFE;
  HILFE=D.createElement('div'); HILFE.id='tastenHilfe';
  HILFE.setAttribute('role','dialog'); HILFE.setAttribute('aria-modal','true'); HILFE.setAttribute('aria-label','Tastenhilfe');
  HILFE.setAttribute('data-tasten','');
  HILFE.addEventListener('click',function(e){ if(e.target===HILFE) hilfe(false); });
  D.body.appendChild(HILFE);
  return HILFE;
}
function hilfeMalen(){
  var h=hilfeEl(), imDialog=!!dialog(true);
  /* Was gerade zählt, steht vorn: im Dialog die Dialog-Tasten, sonst die Sprünge */
  var liste=GRUPPEN.slice().sort(function(a,b){ return (imDialog?(b.dialog?1:0)-(a.dialog?1:0):0); });
  h.innerHTML='<div class="th"><h2>⌨️ Tastenhilfe</h2>'
    +'<div class="sub">Alles im Compass geht auch ohne Maus. Die Nummern an den Knöpfen erscheinen, sobald du tippst — ein Mausklick blendet sie wieder aus.</div>'
    +'<div class="grp">'+liste.map(function(g){
        return '<div class="'+(imDialog&&g.dialog?'jetzt':'')+'"><h3>'+esc(g.titel)+'</h3>'
          +g.tasten.map(function(z){ return '<div class="z"><span class="k">'+tastenHtml(z[0])+'</span><span>'+esc(z[1])+'</span></div>'; }).join('')+'</div>';
      }).join('')+'</div>'
    +'<div class="fuss"><span>Esc oder ? schließt</span><button type="button" data-primaer>Schließen</button></div></div>';
  h.querySelector('[data-primaer]').addEventListener('click',function(){ hilfe(false); });
}
function hilfe(an){
  var h=hilfeEl();
  if(an===undefined) an=!h.classList.contains('on');
  if(an){ hilfeMalen(); h.classList.add('on'); modus(true); fokus(h.querySelector('[data-primaer]')); }
  else h.classList.remove('on');
}

/* ---- 4. Dialoge: finden, Fokus hinein, Fokus halten ----------------------- */
var DIALOG='.ov.on,.modal.on,[data-tasten].on';
function dialog(ohneHilfe){
  if(!ohneHilfe&&HILFE&&HILFE.classList.contains('on')) return HILFE;
  var l=alle(D,DIALOG).filter(function(x){ return x!==HILFE&&sichtbar(x); });
  return l.length?l[l.length-1]:null;
}
var FOKUSSIERBAR='a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])';
function fokusListe(w){ return alle(w,FOKUSSIERBAR).filter(function(el){ return frei(el)&&el.tabIndex>=0; }); }
/* Antwortgruppen: die Knopfreihen der Rituale, Rückfragen, Trichter, Melde-Wege, Ziele */
var GRUPPE='.opts,.routes,.zielrow,[data-tasten-optionen]';
function knoepfe(g){ return alle(g,'button').filter(function(b){ return frei(b)&&b.closest(GRUPPE)===g; }); }
function gruppen(w){ return alle(w,GRUPPE).filter(function(g){ return sichtbar(g)&&!g.closest('.beantwortet')&&knoepfe(g).length; }); }
function aktiveGruppe(w){
  var a=D.activeElement, g=a&&a.closest?a.closest(GRUPPE):null, l=gruppen(w);
  return (g&&l.indexOf(g)>=0)?g:(l[0]||null);
}
function primaer(w){
  var p=w.querySelector('[data-primaer]');
  if(p&&frei(p)) return p;
  return alle(w,'.sfoot .btn.a,.sfoot .btn.g,.btn.a,.btn.p').filter(frei)[0]||null;
}
function nummerieren(w){
  w=w||dialog(); if(!w) return;
  alle(w,'[data-taste]').forEach(function(b){ b.removeAttribute('data-taste'); });
  var g=aktiveGruppe(w); if(!g) return;
  knoepfe(g).slice(0,9).forEach(function(b,i){ b.setAttribute('data-taste',String(i+1)); });
}
/* Wohin der Fokus beim Öffnen fällt: eine offene Wahl zuerst (damit 1–9 sofort greifen),
   sonst das Feld, sonst der farbige Knopf. Der „gelandete“ Knopf wird gemerkt (Regel 2). */
var GELANDET=null;
function fokusRein(w){
  w=w||dialog(); if(!w) return;
  var g=gruppen(w)[0], ziel=null;
  if(g&&!g.querySelector('button.on')) ziel=knoepfe(g)[0]||null;
  if(!ziel) ziel=alle(w,'input,textarea,select').filter(function(el){ return frei(el)&&feld(el); })[0]||null;
  if(!ziel) ziel=primaer(w)||fokusListe(w)[0]||null;
  if(ziel){ fokus(ziel); GELANDET=(ziel.tagName==='BUTTON'&&ziel.closest(GRUPPE))?ziel:null; }
  nummerieren(w);
}
D.addEventListener('focusin',function(e){
  if(e.target!==GELANDET) GELANDET=null;
  if(feld(e.target)) H.setAttribute('data-imfeld',''); else H.removeAttribute('data-imfeld');
  var w=dialog(); if(w&&w.contains(e.target)) nummerieren(w);
  kartenFokus(e.target);
},true);
/* Fokus fällt ins Leere (beantwortete Rückfrage blendet aus, Schritt malt neu) → zurück in den Dialog */
D.addEventListener('focusout',function(){
  setTimeout(function(){
    var a=D.activeElement; if(!feld(a)) H.removeAttribute('data-imfeld');
    if(a&&a!==D.body) return;
    setTimeout(function(){ var w=dialog(), b=D.activeElement; if(w&&(!b||b===D.body)) fokusRein(w); },480);
  },40);
},true);

/* Öffnen und Schließen beobachten: beim Schließen kehrt der Fokus dorthin zurück, woher er kam */
var OFFEN=null, HERKUNFT=null;
function dialogLage(){
  var w=dialog();
  if(w&&w!==OFFEN){
    if(!OFFEN){ var a=D.activeElement; HERKUNFT=(a&&a!==D.body&&!w.contains(a))?a:null; }
    OFFEN=w;
    setTimeout(function(){ if(dialog()!==w) return; if(!w.contains(D.activeElement)) fokusRein(w); else nummerieren(w); },120);
  } else if(!w&&OFFEN){
    OFFEN=null; var o=HERKUNFT; HERKUNFT=null;
    var b=D.activeElement;
    if(o&&D.contains(o)&&frei(o)&&(!b||b===D.body||!sichtbar(b))) fokus(o);
  }
}

/* ---- 5. Karten (Mein Board): mit Pfeilen wandern, Ziffern für die Aktionen -- */
var KARTEN=[];   /* {karte, optionen, oeffnen} */
function karten(def){ KARTEN.push(def); kartenPflegen(); }
function kartenPflegen(){
  KARTEN.forEach(function(k){ alle(D,k.karte).forEach(function(c){ if(!c.hasAttribute('tabindex')) c.setAttribute('tabindex','0'); }); });
  /* Die drei Kacheln der Focus View tragen ihre Ziffer (sichtbar nur im Tastatur-Modus) */
  alle(D,'#focusview .fv-kachel').forEach(function(b,i){ if(i<9&&b.getAttribute('data-taste')!==String(i+1)) b.setAttribute('data-taste',String(i+1)); });
}
function karteVon(el){
  if(!el||!el.closest) return null;
  for(var i=0;i<KARTEN.length;i++){ var c=el.closest(KARTEN[i].karte); if(c) return {el:c,def:KARTEN[i]}; }
  return null;
}
function kartenKnoepfe(k){ return alle(k.el,k.def.optionen).filter(frei).slice(0,9); }
var KARTE_NUM=null;
function kartenFokus(t){
  var k=karteVon(t);
  if(KARTE_NUM&&(!k||k.el!==KARTE_NUM)){ alle(KARTE_NUM,'[data-taste]').forEach(function(b){ b.removeAttribute('data-taste'); }); KARTE_NUM=null; }
  if(k&&k.el!==KARTE_NUM){ kartenKnoepfe(k).forEach(function(b,i){ b.setAttribute('data-taste',String(i+1)); }); KARTE_NUM=k.el; }
}
/* Räumlich statt nach DOM-Reihenfolge: ↑↓ bleibt in der Spalte, ←→ springt in die Nachbarspalte */
function naechsteKarte(von,richtung,sel){
  var r=von.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, best=null, bd=1e9;
  var senk=(richtung==='ArrowDown'||richtung==='ArrowUp');
  alle(D,sel).forEach(function(c){
    if(c===von||!sichtbar(c)) return;
    var q=c.getBoundingClientRect(), dx=q.left+q.width/2-cx, dy=q.top+q.height/2-cy;
    var ok=richtung==='ArrowDown'?dy>4:richtung==='ArrowUp'?dy<-4:richtung==='ArrowRight'?dx>4:dx<-4;
    if(!ok) return;
    var d=senk?Math.abs(dy)+Math.abs(dx)*3:Math.abs(dx)+Math.abs(dy)*0.6;
    if(d<bd){ bd=d; best=c; }
  });
  return best;
}

/* ---- 6. Die Tasten --------------------------------------------------------- */
function schlucken(e){ e.preventDefault(); e.stopPropagation(); }
function insFeld(w){
  var f=alle(w,'input,textarea').filter(function(el){ return frei(el)&&feld(el); })[0];
  if(!f) return false;
  fokus(f); try{ var n=f.value.length; f.setSelectionRange(n,n); }catch(x){}
  return true;
}

/* Erfassungsphase: läuft vor den Handlern der Seiten, damit Dialog-Tasten nie
   zusätzlich einen Seitensprung (M, A, 1–4 …) auslösen. */
D.addEventListener('keydown',function(e){
  var k=String(e.key||''), t=e.target, imFeld=feld(t), mod=e.ctrlKey||e.metaKey||e.altKey;
  if(k==='Tab'||k.indexOf('Arrow')===0||k==='?'||(!imFeld&&!mod&&k.length===1)) modus(true);
  /* Strg/Alt+Buchstabe gehört dem Browser (Strg+F sucht, Strg+K …) — nicht zusätzlich einem
     Seitensprung. Vorher öffnete Strg+F neben der Suche den Fokus-Modus, Strg+K die Kennzahlen. */
  if(mod&&!imFeld&&/^[a-z]$/i.test(k)){ e.stopPropagation(); return; }

  /* Tastenhilfe */
  if(k==='?'&&!imFeld&&!e.ctrlKey&&!e.metaKey){ schlucken(e); hilfe(); return; }
  if(HILFE&&HILFE.classList.contains('on')){
    if(k==='Escape'){ schlucken(e); hilfe(false); return; }
    if(k.length===1&&!mod){ schlucken(e); return; }   /* keine Sprünge unter der Hilfe */
  }

  var w=dialog();
  if(w){
    /* Fokusfalle: Tab bleibt im Dialog */
    if(k==='Tab'){
      var l=fokusListe(w); if(!l.length){ e.preventDefault(); return; }
      var i=l.indexOf(D.activeElement);
      if(i<0){ e.preventDefault(); fokus(l[e.shiftKey?l.length-1:0]); return; }
      if(e.shiftKey&&i===0){ e.preventDefault(); fokus(l[l.length-1]); return; }
      if(!e.shiftKey&&i===l.length-1){ e.preventDefault(); fokus(l[0]); return; }
      return;
    }
    /* Unter jedem offenen Dialog springt kein Buchstabe die Seite um (A startete sonst den Abendcheck neu) */
    if(!w.hasAttribute('data-tasten')){ if(!mod&&!imFeld&&k.length===1) e.stopPropagation(); return; }

    /* Esc aus einem Feld heraus: die Seiten ignorieren Tasten in Feldern, also schloss Esc im
       Abendcheck nichts, solange der Cursor im Notizfeld stand. Hier drückt Esc das ✕. */
    if(k==='Escape'&&imFeld){
      var zu=w.querySelector('.sx,[data-schliessen]');
      if(zu&&frei(zu)){ schlucken(e); zu.click(); }
      return;
    }

    /* Alt+← / Alt+→: Schritt zurück / weiter (hält auch den Browser vom Zurückblättern ab) */
    if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(k==='ArrowLeft'||k==='ArrowRight')){
      e.preventDefault(); e.stopPropagation();
      var zb=k==='ArrowLeft'?w.querySelector('[data-zurueck]'):primaer(w);
      if(zb&&frei(zb)) zb.click();
      return;
    }

    if(k==='Enter'&&!e.isComposing){
      if(e.ctrlKey||e.metaKey){ var p0=primaer(w); schlucken(e); if(p0) p0.click(); return; }
      if(e.altKey) return;
      if(t.tagName==='TEXTAREA'&&(e.shiftKey||t.hasAttribute('data-mehrzeilig'))) return;
      if(t.tagName==='A'||t.tagName==='SUMMARY') return;
      if(t.tagName==='BUTTON'||t.getAttribute('role')==='button'){
        var g=t.closest(GRUPPE);
        if(!g) return;                                   /* Zurück, Überspringen, ✕: tun, was draufsteht */
        if(t===GELANDET&&!t.classList.contains('on')){ /* nur gelandet, nicht gewählt → einfach weiter */ }
        else if(g.hasAttribute('data-tasten-weiter')){ if(!t.classList.contains('on')) t.click(); }
        else return;                                     /* Antwort im Stapel: der Knopf selbst entscheidet */
      }
      var p=primaer(w); schlucken(e);
      if(p&&!p.disabled) p.click();
      return;
    }
    if(mod||imFeld) return;

    /* 1–9: die n-te Antwort der aktiven Gruppe */
    if(/^[1-9]$/.test(k)){
      var ag=aktiveGruppe(w), kn=ag?knoepfe(ag):[], b=kn[+k-1];
      schlucken(e);
      if(b){ fokus(b); b.click(); GELANDET=null; nummerieren(w); }
      return;
    }
    /* ← →: in der Gruppe wandern · ↑ ↓: zur vorigen/nächsten Gruppe (Rückfragen, Trichter-Zeilen) */
    var tg=t.closest?t.closest(GRUPPE):null;
    if(tg&&(k==='ArrowLeft'||k==='ArrowRight')){
      var kk=knoepfe(tg), ix=kk.indexOf(t); if(ix<0) return;
      var rtl=(H.getAttribute('dir')==='rtl'), vor=(k==='ArrowRight')!==rtl;
      schlucken(e); fokus(kk[(ix+(vor?1:-1)+kk.length)%kk.length]); return;
    }
    if(tg&&(k==='ArrowUp'||k==='ArrowDown')){
      var gl=gruppen(w), gi=gl.indexOf(tg), ng=gl[gi+(k==='ArrowDown'?1:-1)];
      if(ng){ schlucken(e); fokus(knoepfe(ng)[0]); }
      return;
    }
    /* Buchstabe auf einer Antwort → ins Notizfeld, der Buchstabe landet dort (Regel 3) */
    if(t.tagName==='BUTTON'&&k.length===1&&k!==' '&&!/[0-9]/.test(k)){
      e.stopPropagation();          /* kein Seitensprung — der Buchstabe gehört dem Feld */
      insFeld(w);
      return;
    }
    if(k.length===1) e.stopPropagation();   /* im Dialog springt kein Buchstabe die Seite um */
    return;
  }

  /* Außerhalb von Dialogen: Karten im Board */
  if(mod||imFeld) return;
  /* Focus View: 1–3 öffnen die drei Kacheln (die Kontext-Tabs sind dort ohnehin ausgeblendet) */
  var fv=D.getElementById('focusview');
  if(fv&&!fv.hidden&&sichtbar(fv)&&/^[1-9]$/.test(k)){
    var kt=alle(fv,'.fv-kachel').filter(frei)[+k-1];
    if(kt){ schlucken(e); kt.click(); return; }
  }
  var kv=karteVon(t);
  if(kv&&t===kv.el){
    if(k==='Enter'){ var o=kv.def.oeffnen&&kv.el.querySelector(kv.def.oeffnen); if(o){ schlucken(e); o.click(); } return; }
    if(/^[1-9]$/.test(k)){ var kb=kartenKnoepfe(kv)[+k-1]; schlucken(e); if(kb) kb.click(); return; }
    if(k.indexOf('Arrow')===0){
      var n=naechsteKarte(kv.el,k,kv.def.karte);
      schlucken(e);
      if(n){ fokus(n); try{ n.scrollIntoView({block:'nearest',inline:'nearest'}); }catch(x){} }
      return;
    }
  }
},true);

/* Blasphase: Seiten-Sprünge, die neu dazukommen, und role="button" ohne eigenen Tastenweg */
D.addEventListener('keydown',function(e){
  if(e.defaultPrevented) return;
  var k=String(e.key||''), t=e.target;
  if((k==='Enter'||k===' ')&&t&&t.getAttribute&&t.getAttribute('role')==='button'&&t.tagName!=='BUTTON'&&t.tagName!=='A'){
    e.preventDefault(); t.click(); return;
  }
  if(feld(t)||e.ctrlKey||e.metaKey||e.altKey||dialog()) return;
  var f=SPRUENGE[k.toLowerCase()];
  if(f&&k.length===1){ e.preventDefault(); f(); }
});
var SPRUENGE={};

/* ---- 7. Sprungmarke: der erste Tab verrät, dass hier mehr geht ------------ */
function sprung(){
  if(D.querySelector('.tasten-sprung')) return;
  var ziel=D.querySelector('[data-inhalt]')||D.getElementById('grid')||D.querySelector('main,.wrap'); if(!ziel) return;
  if(!ziel.id) ziel.id='inhalt';
  if(!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex','-1');
  var a=D.createElement('a'); a.className='tasten-sprung'; a.href='#'+ziel.id;
  a.innerHTML='Zum Inhalt springen · <kbd>?</kbd> zeigt alle Tasten';
  a.addEventListener('click',function(e){ e.preventDefault(); var erst=fokusListe(ziel)[0]; fokus(erst||ziel); });
  D.body.insertBefore(a,D.body.firstChild);
}

/* ---- 8. Was die Seiten können (für die Hilfe und die neuen Sprünge) -------- */
function seiten(){
  melden('Überall gleich',[
    ['⏎','weiter · bestätigen · schließen'],
    ['Strg ⏎','abschicken, auch aus mehrzeiligen Feldern'],
    ['⇧ ⏎','neue Zeile im Textfeld'],
    ['Esc','schließen · eine Ebene zurück'],
    ['Tab','zum nächsten Element (im Dialog im Kreis)'],
    ['?','diese Tastenhilfe']]);
  melden('In Ritualen und Dialogen',[
    ['1 – 9','Antwort wählen — die Nummer steht am Knopf'],
    ['← →','zwischen den Antworten wandern'],
    ['↑ ↓','zur vorigen · nächsten Frage'],
    ['a – z','auf einer Antwort: gleich ins Notizfeld tippen'],
    ['Alt ←','einen Schritt zurück'],
    ['Alt →','einen Schritt weiter']],{dialog:true});

  var fn=function(n){ return typeof window[n]==='function'?window[n]:null; };
  /* Der Compass selbst */
  if(D.getElementById('btnMorgen')){
    if(fn('starte')) SPRUENGE.r=function(){ window.starte('fragen'); };
    if(fn('pkNeu'))  SPRUENGE.n=function(){ window.pkNeu('bereit'); };
    var sp=[['M','Morgencheck'],['A','Abendcheck'],['R','Rückfragen beantworten'],['N','neue Karte in Mein Board'],
            ['K','Kennzahlen'],['J','Coach fragen'],['B','Board wechseln'],['F','Fokus-Modus']];
    if(window.compassFocus) sp.push(['S','Ansicht: Einfach · Alles']);
    sp.push(['E','Editier-Modus'],['L','Lotus abspielen'],['D','Design · Sprache']);
    melden('Springen',sp);
    melden('Kontexte',[['0','alle Kontexte'],['1 – 4','ein Kontext'],['Strg Klick','Kontexte kombinieren']]);
    melden('Mein Board',[
      ['← → ↑ ↓','auf einer Karte: zur Nachbarkarte'],
      ['⏎','Karte in der Quelle öffnen'],
      ['1 – 9','Aktion der Karte (Ziehen, Wartet, Fertig …)'],
      ['N','neue Karte anlegen']]);
    karten({karte:'.pk .kc',optionen:'.kact button:not([onclick*="\'del\'"])',oeffnen:'.kt'});
    if(window.compassFocus) melden('Einfache Ansicht',[['1 – 3','eine der drei Kacheln öffnen']]);
    if(window.MutationObserver){
      /* Drosseln, nicht entprellen: im Raster tickt ständig etwas (Uhr, Band, Blüten) — ein
         Entprellen käme nie zum Zug, und neu gemalte Karten blieben ohne tabindex. */
      var tm=0, pflege=function(){ if(tm) return; tm=setTimeout(function(){ tm=0; kartenPflegen(); },80); };
      ['grid','focusview'].forEach(function(id){ var el=D.getElementById(id); if(el) new MutationObserver(pflege).observe(el,{childList:true,subtree:true}); });
    }
    kartenPflegen();
  }
  /* Kennzahlen */
  if(D.getElementById('zFwd')){
    melden('Kennzahlen',[['← →','Zeitraum zurück · vor'],['C','zurück zum Compass']]);
  } else if(D.querySelector('a.back')){
    melden('Diese Seite',[['C','zurück zum Compass']]);
  }
  if(D.querySelector('a.back')) SPRUENGE.c=function(){ D.querySelector('a.back').click(); };
}

/* ---- 9. Wörter fürs Sprach-Overlay (compass-i18n.js) ---------------------- */
function woerter(){
  var W=null; try{ W=window.compassSprache&&window.compassSprache.woerter; }catch(x){} if(!W) return;
  var N={
    'Tastenhilfe':['Keyboard help','مساعدة لوحة المفاتيح'],
    '⌨️ Tastenhilfe':['⌨️ Keyboard help','⌨️ مساعدة لوحة المفاتيح'],
    'Alles im Compass geht auch ohne Maus. Die Nummern an den Knöpfen erscheinen, sobald du tippst — ein Mausklick blendet sie wieder aus.':
      ['Everything in the Compass works without a mouse. The numbers on the buttons appear as soon as you type — a mouse click hides them again.','كل شيء في البوصلة يعمل دون فأرة. تظهر الأرقام على الأزرار بمجرد أن تكتب — ونقرة بالفأرة تخفيها.'],
    'Esc oder ? schließt':['Esc or ? closes','Esc أو ? يغلق'],
    'Schließen':['Close','إغلاق'],
    'Zum Inhalt springen ·':['Skip to content ·','انتقل إلى المحتوى ·'],
    'zeigt alle Tasten':['shows all keys','يعرض كل المفاتيح'],
    'Überall gleich':['Same everywhere','متماثل في كل مكان'],
    'In Ritualen und Dialogen':['In rituals and dialogs','في الطقوس والحوارات'],
    'Springen':['Jump','انتقال'],
    'Kontexte':['Contexts','السياقات'],
    'Mein Board':['My Board','لوحتي'],
    'Kennzahlen':['Key figures','المؤشرات'],
    'Diese Seite':['This page','هذه الصفحة'],
    'weiter · bestätigen · schließen':['next · confirm · close','التالي · تأكيد · إغلاق'],
    'abschicken, auch aus mehrzeiligen Feldern':['send, also from multi-line fields','إرسال، حتى من الحقول متعددة الأسطر'],
    'neue Zeile im Textfeld':['new line in a text field','سطر جديد في حقل النص'],
    'schließen · eine Ebene zurück':['close · one level back','إغلاق · مستوى واحد للخلف'],
    'zum nächsten Element (im Dialog im Kreis)':['to the next element (cycles inside a dialog)','إلى العنصر التالي (يدور داخل الحوار)'],
    'diese Tastenhilfe':['this keyboard help','مساعدة المفاتيح هذه'],
    'Antwort wählen — die Nummer steht am Knopf':['choose an answer — the number is on the button','اختر إجابة — الرقم على الزر'],
    'zwischen den Antworten wandern':['move between answers','التنقل بين الإجابات'],
    'zur vorigen · nächsten Frage':['to the previous · next question','إلى السؤال السابق · التالي'],
    'auf einer Antwort: gleich ins Notizfeld tippen':['on an answer: type straight into the note field','على إجابة: اكتب مباشرة في حقل الملاحظة'],
    'einen Schritt zurück':['one step back','خطوة للخلف'],
    'einen Schritt weiter':['one step forward','خطوة للأمام'],
    'Morgencheck':['Morning check','فحص الصباح'],
    'Abendcheck':['Evening check','فحص المساء'],
    'Rückfragen beantworten':['Answer open questions','الرد على الأسئلة'],
    'neue Karte in Mein Board':['new card in My Board','بطاقة جديدة في لوحتي'],
    'Coach fragen':['Ask Coach','اسأل Coach'],
    'Board wechseln':['Switch board','تبديل اللوحة'],
    'Fokus-Modus':['Focus mode','وضع التركيز'],
    'Ansicht: Einfach · Alles':['View: simple · everything','العرض: مبسّط · الكل'],
    'Editier-Modus':['Edit mode','وضع التحرير'],
    'Lotus abspielen':['Play the lotus','تشغيل اللوتس'],
    'Design · Sprache':['Design · language','التصميم · اللغة'],
    'alle Kontexte':['all contexts','كل السياقات'],
    'ein Kontext':['one context','سياق واحد'],
    'Kontexte kombinieren':['combine contexts','دمج السياقات'],
    'auf einer Karte: zur Nachbarkarte':['on a card: to the neighbouring card','على بطاقة: إلى البطاقة المجاورة'],
    'Karte in der Quelle öffnen':['open the card in its source','فتح البطاقة في مصدرها'],
    'Aktion der Karte (Ziehen, Wartet, Fertig …)':['card action (pull, waiting, done …)','إجراء البطاقة (سحب، انتظار، منجز …)'],
    'neue Karte anlegen':['create a new card','إنشاء بطاقة جديدة'],
    'Einfache Ansicht':['Simple view','العرض المبسّط'],
    'eine der drei Kacheln öffnen':['open one of the three tiles','فتح إحدى البلاطات الثلاث'],
    'Zeitraum zurück · vor':['period back · forward','الفترة للخلف · للأمام'],
    'zurück zum Compass':['back to the Compass','العودة إلى البوصلة']
  };
  Object.keys(N).forEach(function(k){ if(!W[k]) W[k]=N[k]; });
}

/* ---- Start ----------------------------------------------------------------- */
function start(){
  stil(); woerter(); sprung(); seiten();
  if(window.MutationObserver){
    new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++){ var t=ms[i].target; if(t.nodeType===1&&t.matches&&t.matches('.ov,.modal,[data-tasten]')){ dialogLage(); return; } }
    }).observe(D.body,{attributes:true,attributeFilter:['class'],subtree:true});
  }
  dialogLage();
}
window.compassTasten={ melden:melden, karten:karten, hilfe:hilfe, fokusRein:fokusRein, nummerieren:nummerieren,
  modus:function(){ return MODUS; }, sprung:function(taste,f){ SPRUENGE[String(taste).toLowerCase()]=f; } };
if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',start); else start();
})();
