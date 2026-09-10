/* ==========================================================================
   Flow Compass — Raster nach Inhalt (11.09.2026)

   Anlass: auf breiten Schirmen bestand der Compass zu grossen Teilen aus
   leerer Flaeche, und das Aufklappen bei Interesse war besprochen, aber nie
   gebaut. Gemessen bei 1920 px, drei Ursachen im 12er-Raster:
     1. CSS-Grid streckt jede Karte auf die Hoehe ihrer Zeile. Die kurze
        Jira-Liste neben der langen Beraterkarte wurde ein 1.500 px hoher
        Kasten mit 250 px Inhalt; im Dock oben dasselbe mit dem Kompass.
     2. Elf von siebzehn Karten waren s12: eine Karte je Zeile, Textzeilen
        ueber 1.840 px, die Seite elf Bildschirmhoehen lang. Halbbreite
        Karten ohne Nachbarin liessen die andere Haelfte leer.
     3. Jede Karte zeigte immer alles — Board 1.944 px, Beraterkarte 1.528 px.

   Die Antwort in drei Regeln:
     · Spalten nach Platz: ab 1560 px drei, ab 960 px zwei, darunter eine.
       Jede Karte ist schmal (1 Spalte), breit (2) oder voll (alle) — nach
       dem, was ihr Inhalt braucht: das Board braucht fuenf Kanban-Spalten,
       das Wirkungsbild seine 880 px, eine Liste mit drei Zeilen nicht.
     · Mauerwerk statt Zeilen: jede Karte steht an der hoechsten freien
       Stelle, keine wird gestreckt. Die Position rechnet dieses Skript selbst
       (4-px-Rasterzeilen, grid-column/grid-row je Karte) — so darf eine
       breite Karte innerhalb ihres Bandes ein paar Plaetze vorrucken, wenn
       sie sonst am Sektionsende ein Loch reisst. Die DOM-Reihenfolge bleibt
       unangetastet; hat jemand im Editier-Modus eine Reihenfolge festgelegt,
       gilt die wortwoertlich.
     · Vorschau, aufklappen bei Interesse: ist eine Karte deutlich hoeher
       als ihre Vorschau, stehen Kennzahlen und die ersten Zeilen da, der
       Rest hinter „▾ N weitere zeigen". Gemerkt wird das Aufklappen nur bis
       zum Neuladen, wie bei kurzListe(): die Seite soll kurz bleiben, nicht
       sich merken, dass man einmal hineingeschaut hat.

   Das Dock oben (#obenDock) bekommt nur das Mauerwerk: seine Breiten kommen
   aus dem Editier-Modus, und was dort angeheftet ist, soll ganz sichtbar
   sein — gefaltet wird dort nichts.

   Haengt sich wie compass-edit.js von aussen an (MutationObserver auf #grid
   und das Dock), ueberschreibt keine Funktion aus dashboard.html und bringt
   sein CSS mit. Breiten aus dem Editier-Modus (compassLayout.span) gelten im
   Raster anteilig: s6 = halbe Breite (bei drei Spalten: zwei), s12 = alle.

   Zum Vergleich abschalten: ?raster=aus (bleibt gespeichert), ?raster=an.
   Konsole: CompassRaster.stand() zeigt Spalten, Breiten und Faltungen.
   ========================================================================== */
(function(){
'use strict';

/* ---- Schalter ------------------------------------------------------------ */
var SPEICHER='compassRaster';
(function(){
  var m=/[?&]raster=(aus|an)\b/.exec(location.search);
  if(!m) return;
  try{ if(m[1]==='aus') localStorage.setItem(SPEICHER,'aus'); else localStorage.removeItem(SPEICHER); }catch(e){}
})();
var AUS=false;
try{ AUS=localStorage.getItem(SPEICHER)==='aus'; }catch(e){}
if(AUS){ window.CompassRaster={aus:true}; return; }

/* ---- Masse ---------------------------------------------------------------- */
var ZEILE=4;          /* px je Rasterzeile — fein genug, dass keine Luecke sichtbar wird */
var LUECKE=16;        /* Abstand unter jeder Karte, gleich dem Spaltenabstand */
/* Vorschauhoehe je Breite. Gefaltet wird erst, wenn mehr als ZUGABE px hinter
   dem Knopf laegen: 100 px zu verstecken spart nichts und kostet einen Klick. */
var VORSCHAU={1:440,2:540,3:640};
var ZUGABE=140;
/* Eine breite Karte rueckt nur vor, wenn das mindestens so viel Leerflaeche
   spart (Spalten × px) — sonst springen Karten fuer ein paar Pixel hin und her. */
var LOHNT=160;
var VORRUECKEN=6;     /* hoechstens so viele Plaetze */
/* Dieselbe Schwelle in Kosteneinheiten (siehe packen): so viel wie 160 px Seitenhoehe */
var SCHWELLE=25*Math.round(LOHNT/ZEILE);

/* Standardbreiten nach Inhalt. Alles, was hier nicht steht, ist schmal. */
var VOLL=['#kanbanCard'];
var BREIT=['#madKachel','#kalCard','#meldeBanner','[data-hand="woche"]'];
/* Board: fuenf Kanban-Spalten. Breit: Beraterkarte mit Wirkungsbild, der Tag
   mit seiner 7-Tage-Zeile, das Meldeband mit Gruppen nebeneinander, die Woche
   mit zwei Listen nebeneinander. Jede Karte mit Wirkungsbild (.sysgrid) auch. */

/* Nie gefaltet: die Rueckfragen (dort wird entschieden, ihre Optionen gehoeren in
   den Blick — und sie blaettern ohnehin drei auf einmal) und das Meldeband (eine
   Stoerung, die hinter „weitere zeigen" liegt, ist keine Meldung mehr). */
var GANZ=['#fragenBanner','#meldeBanner','[data-raster="ganz"]'];

var AUF={};           /* Kartenschluessel → aufgeklappt (nur bis zum Neuladen) */
var root=document.documentElement;
var mo=null, ro=null, laeuft=false, spaltenVorher=0, ruhig=false;

function vw(){ return root.clientWidth||window.innerWidth||0; }
function spalten(){ var w=vw(); return w>=1560?3:(w>=960?2:1); }
/* Derselbe Schluessel wie beim Zuklappen (cardsVerdrahten) und im Editier-Modus */
function schluessel(k){
  var h3=k.querySelector(':scope > h3'); if(!h3) return k.id||'';
  var t=h3.childNodes[0];
  var s=(t&&t.nodeType===3?t.textContent:h3.textContent)||'';
  return s.trim().replace(/\s+/g,' ').slice(0,40)||k.id||'';
}
function passt(k,liste){
  for(var i=0;i<liste.length;i++){ try{ if(k.matches(liste[i])) return true; }catch(e){} }
  return false;
}
function standardBreite(k){
  if(k.querySelector('.tickwrap')) return 3;               /* Kennzahlen-Band laeuft ueber alles */
  if(passt(k,VOLL)) return 3;
  if(passt(k,BREIT)||k.querySelector('.sysgrid')) return 2;
  return 1;
}
function layoutStand(){
  try{ var L=window.CompassLayout&&window.CompassLayout.stand(); return L||{}; }catch(e){ return {}; }
}
function rasterBreite(k,key,sp,us){
  var w=standardBreite(k);
  var s=us[key]?parseInt(String(us[key]).replace(/\D/g,''),10):0;
  if(s>0) w=Math.round(s/12*sp);                            /* Editier-Modus: anteilig */
  return Math.max(1,Math.min(sp,w));
}
/* Im Dock gilt das 12er-Raster mit den Klassen s3…s12 — samt den Stufen fuer
   schmale Schirme aus dashboard.html (1100 px) und compass-edit.js (1000 px). */
function dockBreite(k){
  var s=12, m=/\bs(3|4|5|6|7|8|12)\b/.exec(k.className); if(m) s=+m[1];
  var w=vw();
  if(w<=720) return 12;
  if(w<=1100){ if(s<=5) return 6; if(s<=8) return 12; }
  return s;
}
function sichtbar(k){ return k.getClientRects().length>0; }
function kartenIn(g){ return Array.prototype.slice.call(g.children).filter(function(x){ return x.classList&&x.classList.contains('card'); }); }
function behaelter(){
  var b=Array.prototype.slice.call(document.querySelectorAll('#grid section.sec > .grid')).map(function(g){
    var sec=g.closest('section.sec');
    return { el:g, dock:false, sek:sec?sec.getAttribute('data-s'):'' };
  });
  var d=document.getElementById('obenDock');
  if(d) b.push({ el:d, dock:true, sek:'oben' });
  return b;
}

/* ---- Vorschau-Fuss ---------------------------------------------------------- */
function fussVon(k){ return k.querySelector(':scope > .r-fuss'); }
function fussWeg(k){
  var f=fussVon(k); if(f) f.remove();
  k.classList.remove('r-zu','r-auf');
  if(k.style.maxHeight) k.style.maxHeight='';
}
/* Karte hat ihren Behaelter verlassen (z. B. ins Dock gewandert, in die Focus-Buehne
   geholt) — alles zuruecknehmen, was dieses Skript an ihr gesetzt hat. */
function aufraeumen(k){
  fussWeg(k);
  k.removeAttribute('data-rw'); k.removeAttribute('data-rkey');
  k.style.removeProperty('--rw'); k.style.removeProperty('grid-column'); k.style.removeProperty('grid-row');
}
/* Wie viele Zeilen liegen unter der Vorschaukante? Zaehlt Listenzeilen und
   Board-Karten; was kurzListe() ohnehin verbirgt, hat keine Box und zaehlt nicht. */
function verborgen(k,kante){
  var rk=k.getBoundingClientRect(), oben=rk.top, n=0;
  var s=(k.offsetHeight>0&&rk.height>0)?rk.height/k.offsetHeight:1;   /* Bildschirm- in Layout-px (transform) */
  var z=k.querySelectorAll('.item, .pk .kc');
  for(var i=0;i<z.length;i++){
    var r=z[i].getBoundingClientRect();
    if(r.height>0 && (r.top-oben)/s>kante-24) n++;
  }
  return n;
}
function fussSetzen(k,key,zu,kante){
  var f=fussVon(k);
  if(!f){
    f=document.createElement('div'); f.className='r-fuss';
    f.innerHTML='<button type="button" class="r-mehr"></button>';
    k.appendChild(f);
  }
  var b=f.firstChild;
  b.setAttribute('data-key',key);
  b.setAttribute('aria-expanded',zu?'false':'true');
  var t;
  if(zu){ var n=verborgen(k,kante); t=n>0?'▾ '+n+' weitere zeigen':'▾ weitere zeigen'; }
  else t='▴ weniger zeigen';
  /* Gegen den eigenen Stempel vergleichen, nie gegen textContent: compass-i18n.js ersetzt den
     Text auf Englisch/Arabisch, und ein Vergleich mit dem Sichtbaren schriebe ihn endlos zurueck. */
  if(b.getAttribute('data-t')!==t){ b.setAttribute('data-t',t); b.textContent=t; }
  var ti=zu?'Die ganze Karte zeigen':'Wieder auf die Vorschau kürzen';
  if(b.getAttribute('data-ti')!==ti){ b.setAttribute('data-ti',ti); b.title=ti; }   /* wie oben: das Overlay übersetzt title */
  /* Verlauf in der echten Kartenfarbe, Knopf auf der Innenkante der Karte */
  var cs=getComputedStyle(k);
  if(cs.backgroundColor && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.backgroundColor)) f.style.setProperty('--r-bg',cs.backgroundColor);
  f.style.setProperty('--r-px',cs.paddingLeft);
}
/* Nie gefaltet: zugeklappte Karten, die GANZ-Liste, und Karten mit Wirkungsbild — deren
   Zustimmen/Ablehnen steht unter dem Bild, und eine Karte, die eine Entscheidung will,
   darf ihren Knopf nicht hinter „weitere zeigen" verstecken. */
function faltbar(k){ return !(k.classList.contains('min')||passt(k,GANZ)||k.querySelector('.sysgrid')); }
function falten(k,key,w){
  if(!faltbar(k)){ fussWeg(k); return; }
  var f=fussVon(k), fussH=(f&&k.classList.contains('r-auf'))?f.offsetHeight+10:0;
  var inhalt=k.scrollHeight-fussH, kante=VORSCHAU[w]||VORSCHAU[1];
  if(inhalt<=kante+ZUGABE){ if(f||k.classList.contains('r-zu')) fussWeg(k); return; }
  var zu=!AUF[key];
  k.classList.toggle('r-zu',zu); k.classList.toggle('r-auf',!zu);
  var mh=zu?kante+'px':'';
  if(k.style.maxHeight!==mh) k.style.maxHeight=mh;
  fussSetzen(k,key,zu,kante);
}

/* ---- Mauerwerk ---------------------------------------------------------------- */
/* Jede Karte an die Stelle, an der ihre Oberkante am hoechsten liegt (bei Gleichstand
   links). Erlaubte Startspalten: Vielfache der eigenen Breite oder buendig rechts —
   eine halbe Karte beginnt nie in Spalte 4 von 12.
   Kosten, in Rasterzeilen: jedes Loch in einer Spalte zaehlt im QUADRAT (ein Loch von
   380 px stoert mehr als drei von 130 — das Auge sieht die grosse Leerflaeche, nicht die
   Summe), das offene Ende der Sektion halb, dazu die Hoehe als Scrollweg. Nur Leerflaeche
   zu zaehlen hiesse: alles volle Breite, eine Karte je Zeile — lueckenlos und doppelt so lang. */
var HOEHE_GEWICHT=25;
function packen(items,sp){
  var boden=[], i, j, pos=[], loch=0;
  for(i=0;i<sp;i++) boden.push(0);
  items.forEach(function(it){
    var best=0, bestTop=Infinity;
    for(var c=0;c+it.w<=sp;c++){
      if(c%it.w!==0 && c+it.w!==sp) continue;
      var top=0; for(j=c;j<c+it.w;j++) top=Math.max(top,boden[j]);
      if(top<bestTop){ bestTop=top; best=c; }
    }
    for(j=best;j<best+it.w;j++){ var s=bestTop-boden[j]; loch+=s*s; boden[j]=bestTop+it.n; }
    pos.push({c:best,r:bestTop});
  });
  var max=Math.max.apply(null,boden.concat([0]));
  boden.forEach(function(b){ var s=max-b; loch+=s*s/2; });
  return { pos:pos, kosten:loch+HOEHE_GEWICHT*max };
}
/* Breite Karten innerhalb ihres Bandes (zwischen zwei vollen Karten) vorziehen, wenn
   es sich lohnt. Die vollen Karten bleiben, wo sie sind — sie gliedern die Sektion. */
function besteReihenfolge(items,sp){
  var ord=items.slice(), basis=packen(ord,sp).kosten;
  for(var i=0;i<ord.length;i++){
    var it=ord[i];
    if(it.w<=1||it.w>=sp) continue;
    var start=i; while(start>0 && ord[start-1].w<sp && i-start<VORRUECKEN) start--;
    var bestOrd=null, bestK=basis;
    for(var j=i-1;j>=start;j--){
      var t=ord.slice(); t.splice(i,1); t.splice(j,0,it);
      var k=packen(t,sp).kosten;
      if(k<bestK){ bestK=k; bestOrd=t; }
    }
    if(bestOrd && basis-bestK>=SCHWELLE){ ord=bestOrd; basis=bestK; }
  }
  return ord;
}
function stilSetzen(k,name,wert){
  if(k.style.getPropertyValue(name)!==wert||k.style.getPropertyPriority(name)!=='important') k.style.setProperty(name,wert,'important');
}

/* ---- Breite nach Bedarf -------------------------------------------------------- */
/* Mauerwerk allein laesst ein Loch, wenn eine schmale Karte viel hoeher ist als ihre
   Nachbarn und darunter eine volle Karte (das Board) wartet: nichts kann nachruecken.
   Breiter waere dieselbe Karte viel kuerzer. Deshalb probiert jedes kleine Band (bis
   sechs Karten) breitere Fassungen seiner Karten durch — nie schmaler als ihr Inhalt
   verlangt, nie gegen eine Breite aus dem Editier-Modus — und nimmt die mit der
   wenigsten Leerflaeche, wenn das mindestens LOHNT spart. Hoehen werden echt gemessen
   und je Karte gemerkt, bis sich ihre Grundhoehe aendert. */
var HMERK=new WeakMap();
function zeilenBei(it,w,sp){
  var k=it.k, sig=sp+':'+it.w0+':'+it.n0+':'+(AUF[it.key]?1:0);
  var m=HMERK.get(k);
  if(!m||m.sig!==sig){ m={sig:sig,n:{}}; m.n[it.w0]=it.n0; HMERK.set(k,m); }
  if(m.n[w]==null){
    var gc=k.style.getPropertyValue('grid-column'), mh=k.style.maxHeight;
    k.style.setProperty('grid-column','1 / span '+w,'important'); k.style.maxHeight='';
    var f=fussVon(k), fussH=(f&&k.classList.contains('r-auf'))?f.offsetHeight+10:0;
    var inhalt=k.scrollHeight-fussH, h=k.offsetHeight, kante=VORSCHAU[Math.max(1,Math.min(3,w))];
    if(faltbar(k) && inhalt>kante+ZUGABE && !AUF[it.key]) h=kante;
    k.style.setProperty('grid-column',gc,'important'); k.style.maxHeight=mh;
    m.n[w]=Math.max(1,Math.ceil((h+LUECKE)/ZEILE));
  }
  return m.n[w];
}
function breitenWaehlen(items,sp,us){
  var schwelle=SCHWELLE;
  var baender=[], band=[];
  items.forEach(function(it){ if(it.w>=sp){ if(band.length) baender.push(band); band=[]; } else band.push(it); });
  if(band.length) baender.push(band);
  var geaendert=[];
  baender.forEach(function(bd){
    if(bd.length>6) return;
    var flex=bd.filter(function(it){ return !us[it.key] && it.w<sp; });
    if(!flex.length) return;
    /* Hoechstens eine Stufe breiter, und volle Breite nur fuer Karten, die schon breit sind:
       eine Liste ueber 1.800 px liest niemand gern, auch wenn sie dann lueckenlos steht. */
    var opts=flex.map(function(it){ var o=[], bis=Math.min(sp,Math.max(2,it.w+1)); for(var w=it.w;w<=bis;w++) o.push(w); return o; });
    var probe=function(idx){
      return packen(items.map(function(it){
        var f=flex.indexOf(it); if(f<0) return it;
        var w=opts[f][idx[f]];
        return { w:w, n:w===it.w?it.n:zeilenBei(it,w,sp), gw:it.gw };
      }),sp).kosten;
    };
    var idx=flex.map(function(){ return 0; });
    var basis=probe(idx), best=basis, bestIdx=idx.slice();
    for(;;){
      var p=0; while(p<idx.length){ idx[p]++; if(idx[p]<opts[p].length) break; idx[p]=0; p++; }
      if(p>=idx.length) break;
      var k=probe(idx); if(k<best){ best=k; bestIdx=idx.slice(); }
    }
    /* Ruhe vor Pixeln: die Wahl des letzten Durchgangs bleibt, solange sie fast so gut ist */
    var vorIdx=flex.map(function(it,f){ return Math.max(0,opts[f].indexOf(it.vorher)); });
    var vor=probe(vorIdx);
    var wahl=basis-best<schwelle?null:(vor<=best+schwelle/2?vorIdx:bestIdx);
    if(!wahl && vor<basis-schwelle/2) wahl=vorIdx;
    if(!wahl) return;
    flex.forEach(function(it,f){
      var w=opts[f][wahl[f]]; if(w===it.w) return;
      it.n=zeilenBei(it,w,sp); it.w=w; geaendert.push(it);
    });
  });
  return geaendert;
}

/* ---- Ein Durchgang ---------------------------------------------------------- */
function ordnen(){
  if(laeuft) return;
  laeuft=true;
  var breiteGeaendert=false;
  try{
    var sp=spalten();
    if(sp!==spaltenVorher){ root.style.setProperty('--rs',String(sp)); spaltenVorher=sp; breiteGeaendert=true; }
    root.classList.add('raster');
    var L=layoutStand(), us=L.span||{}, ord=L.ord||{};
    var edit=document.body&&document.body.classList.contains('ce-edit');
    var drin=[];
    behaelter().forEach(function(b){
      if(!sichtbar(b.el)) return;                            /* zugeklappte Sektion, leeres Dock */
      var cols=b.dock?12:sp;
      var ks=kartenIn(b.el).filter(sichtbar);
      /* 1 · Breiten bestimmen */
      var items=ks.map(function(k){
        drin.push(k);
        var key=schluessel(k);
        if(k.getAttribute('data-rkey')!==key) k.setAttribute('data-rkey',key);
        return { k:k, key:key, w:b.dock?dockBreite(k):rasterBreite(k,key,sp,us), vorher:+k.getAttribute('data-rw')||0 };
      });
      /* Ein Band (die Karten zwischen zwei vollen), das ganz in eine Zeile passt, verteilt die
         Restbreite auf seine Karten — eine einzelne schmale Karte vor dem Board liess sonst zwei
         Drittel der Zeile leer. Die Karte vorn bekommt zuerst mehr. */
      if(!b.dock && sp>1){
        var band=[];
        var ausgleichen=function(){
          var summe=band.reduce(function(a,x){ return a+x.w; },0);
          if(!band.length||summe>=sp) return;
          while(summe<sp){ var m=band.reduce(function(a,x){ return x.w<a.w?x:a; },band[0]); m.w++; summe++; }
        };
        items.forEach(function(it){ if(it.w>=sp){ ausgleichen(); band=[]; } else band.push(it); });
        ausgleichen();
      }
      /* … und schreiben (bestimmt, wie Text umbricht — also vor jeder Messung) */
      var schreiben=function(it){
        var k=it.k, w=it.w;
        if(k.getAttribute('data-rw')!==String(w)){ k.setAttribute('data-rw',String(w)); k.style.setProperty('--rw',String(w)); breiteGeaendert=true; }
        var alt=/^(\d+)/.exec(k.style.getPropertyValue('grid-column')||''), c0=alt?Math.min(+alt[1],cols-w+1):1;
        stilSetzen(k,'grid-column',c0+' / span '+w);
        if(ro && !k.__rRo){ k.__rRo=true; ro.observe(k); }
        /* 2 · Vorschau (nicht im Dock: was dort angeheftet ist, soll ganz zu sehen sein) */
        if(b.dock) fussWeg(k); else falten(k,it.key,Math.max(1,Math.min(3,w)));
      };
      /* 3 · Hoehe messen — offsetHeight, nicht getBoundingClientRect(): das zweite liefert unter
         einem transform die skalierte Hoehe; im Editier-Modus hat die gezogene Karte scale(.985),
         und schon das liesse die naechste Karte ein Stueck in sie hineinrutschen. */
      var gw=b.dock?1:4;       /* Gewicht einer Spalte in den Kosten: 12er-Spalten sind schmaler */
      var messen=function(it){ it.n=Math.max(1,Math.ceil((it.k.offsetHeight+LUECKE)/ZEILE)); it.gw=gw; };
      items.forEach(schreiben);
      items.forEach(messen);
      /* 4 · Breite nach Bedarf (nicht im Dock, nicht beim Einrichten im Editier-Modus) */
      if(!b.dock && !edit && sp>1){
        items.forEach(function(it){ it.w0=it.w; it.n0=it.n; });
        var neu=breitenWaehlen(items,sp,us);
        neu.forEach(schreiben);
        neu.forEach(messen);
      }
      var folge=(b.dock||edit||(ord[b.sek]&&ord[b.sek].length))?items:besteReihenfolge(items,cols);
      var p=packen(folge,cols).pos;
      folge.forEach(function(it,i){
        stilSetzen(it.k,'grid-column',(p[i].c+1)+' / span '+it.w);
        stilSetzen(it.k,'grid-row',(p[i].r+1)+' / span '+it.n);
      });
    });
    /* Karten mit altem Stempel, die in keinem Behaelter mehr stehen */
    Array.prototype.slice.call(document.querySelectorAll('.card[data-rw]')).forEach(function(k){
      if(drin.indexOf(k)<0 && !(k.parentElement&&k.parentElement.closest&&k.parentElement.closest('section.sec.closed'))) aufraeumen(k);
    });
  } catch(e){
    /* Ein Fehler hier darf den Compass nie zerlegen: Raster ab, gewohnte Ansicht zurueck. */
    root.classList.remove('raster');
    Array.prototype.slice.call(document.querySelectorAll('.card[data-rw]')).forEach(aufraeumen);
    if(window.console) console.warn('compass-raster: abgeschaltet nach Fehler', e);
  } finally {
    laeuft=false;
    if(mo) mo.takeRecords();                                /* eigene Aenderungen nicht noch einmal verarbeiten */
  }
  /* Wer seine Breite selbst nachrechnet (Wirkungsbild ab 880 px, Kino-Buehne), hoert auf resize */
  if(breiteGeaendert){ ruhig=true; try{ window.dispatchEvent(new Event('resize')); }finally{ ruhig=false; } }
}

/* Mehrere Anlaesse in derselben Aufgabe → ein Durchgang, noch vor dem naechsten Bild */
var geplant=false;
function bald(){
  if(geplant) return; geplant=true;
  Promise.resolve().then(function(){ geplant=false; ordnen(); });
}
var rafGeplant=false;
function naechsterFrame(){
  if(rafGeplant) return; rafGeplant=true;
  var f=window.requestAnimationFrame||function(cb){ return setTimeout(cb,16); };
  f(function(){ if(rafGeplant){ rafGeplant=false; ordnen(); } });
  setTimeout(function(){ if(rafGeplant){ rafGeplant=false; ordnen(); } },120);   /* ohne sichtbares Bild steht rAF */
}

/* ---- Bedienung -------------------------------------------------------------- */
document.addEventListener('click',function(e){
  var t=e.target; if(t&&t.nodeType===3) t=t.parentNode;
  var b=t&&t.closest?t.closest('.r-fuss .r-mehr'):null; if(!b) return;
  e.preventDefault(); e.stopPropagation();
  var k=b.closest('.card'); if(!k) return;
  var key=b.getAttribute('data-key')||k.getAttribute('data-rkey')||'';
  var warZu=k.classList.contains('r-zu');
  if(warZu) AUF[key]=1; else delete AUF[key];
  ordnen();
  if(!warZu){
    /* Beim Kuerzen die Karte im Blick behalten, sonst steht man mitten in der naechsten */
    var r=k.getBoundingClientRect();
    if(r.top<70) window.scrollBy(0,r.top-86);
  }
  var nb=k.querySelector(':scope > .r-fuss .r-mehr'); if(nb) nb.focus({preventScroll:true});
},true);

/* ---- Aussehen --------------------------------------------------------------- */
function stil(){
  if(document.getElementById('rasterStil')) return;
  var s=document.createElement('style'); s.id='rasterStil';
  s.textContent=[
  'html.raster #grid section.sec>.grid{grid-template-columns:repeat(var(--rs,2),minmax(0,1fr));grid-auto-rows:'+ZEILE+'px;',
  '  row-gap:0;column-gap:'+LUECKE+'px;align-items:start}',
  'html.raster #obenDock{grid-auto-rows:'+ZEILE+'px;row-gap:0;align-items:start}',
  /* Rueckfall, bis der erste Durchgang die Positionen setzt (die s3…s12-Spannen weichen) */
  'html.raster #grid section.sec>.grid>.card{grid-column:span var(--rw,1) !important;align-self:start}',
  'html.raster #obenDock>.card{align-self:start}',
  'html.raster .card.r-zu{overflow:hidden}',
  /* Fuss: Verlauf ueber der Kante, Knopf wie die kurzListe-Knoepfe, nur fester */
  '.r-fuss{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:40px var(--r-px,20px) 14px;pointer-events:none;',
  '  background:linear-gradient(to bottom,transparent,var(--r-bg,var(--panel)) 58%)}',
  '.r-fuss .r-mehr{pointer-events:auto;display:block;width:100%;padding:7px 12px;border:1px dashed var(--line2);border-radius:9px;',
  '  background:var(--r-bg,var(--panel));color:var(--sub);font:700 11.5px/1.3 var(--sans);cursor:pointer;text-align:left;transition:.15s}',
  '.r-fuss .r-mehr:hover,.r-fuss .r-mehr:focus-visible{color:var(--ink);border-color:var(--va-l);background:var(--panel2);outline:none}',
  '.card.r-auf>.r-fuss{position:static;padding:0;margin-top:10px;background:none}',
  '.card.min>.r-fuss{display:none}',
  '[dir="rtl"] .r-fuss .r-mehr{text-align:right}',
  '@media print{.card.r-zu{max-height:none!important}.r-fuss{display:none}}'
  ].join('\n');
  document.head.appendChild(s);
}

/* ---- Anschluss ---------------------------------------------------------------- */
var BEOBACHTE={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','open','hidden']};
function beobachten(){
  var g=document.getElementById('grid'); if(!g) return;
  if(!mo){
    mo=new MutationObserver(function(){ if(!laeuft) bald(); });
    /* childList: render() und die Refresh-Funktionen tauschen Karten aus.
       class/open: zugeklappte Sektion, h3-Zuklappen, kurzListe-„mehr", <details>,
       Breite aus dem Editier-Modus. */
    mo.observe(g,BEOBACHTE);
    /* Waechst eine Karte ohne DOM-Aenderung (Bild geladen, Schrift da), meldet es der
       ResizeObserver — in eingebetteten Vorschauen laeuft er nicht, dort tragen die
       Observer und resize allein. */
    if(typeof ResizeObserver==='function') ro=new ResizeObserver(function(){ if(!laeuft) naechsterFrame(); });
    window.addEventListener('resize',function(){ if(!ruhig) naechsterFrame(); });
    window.addEventListener('load',naechsterFrame);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(naechsterFrame);
  }
  /* Das Dock legt compass-edit.js erst beim Start an — einmal nachsehen, dann mitbeobachten */
  var d=document.getElementById('obenDock');
  if(d && !d.__rMo){ d.__rMo=true; mo.observe(d,BEOBACHTE); }
}
function start(){
  stil();
  beobachten();
  ordnen();
  setTimeout(function(){ beobachten(); ordnen(); },400);   /* nach compass-edit.js und den ersten Refreshes */
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
else start();

window.CompassRaster={
  ordnen:ordnen,
  stand:function(){
    return { spalten:spalten(), karten:behaelter().reduce(function(a,b){ return a.concat(kartenIn(b.el).filter(sichtbar).map(function(k){
      var r=k.getBoundingClientRect();
      return { wo:b.sek, key:k.getAttribute('data-rkey'), breite:+k.getAttribute('data-rw'), zu:k.classList.contains('r-zu'),
               auf:k.classList.contains('r-auf'), x:Math.round(r.left), y:Math.round(r.top+window.scrollY), hoehe:Math.round(r.height) }; })); },[]) };
  },
  aufklappen:function(alle){
    behaelter().forEach(function(b){ kartenIn(b.el).forEach(function(k){ var key=k.getAttribute('data-rkey'); if(key){ if(alle===false) delete AUF[key]; else AUF[key]=1; } }); });
    ordnen();
  }
};
})();
