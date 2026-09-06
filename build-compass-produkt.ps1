# build-compass-produkt.ps1 — macht aus Benes persoenlichem Cockpit die verkaufbare Produktversion.
#
#   Quelle:  dashboard.html in diesem Repo (flow-compass) (+ kennzahlen.html)
#   Produkt: produkt\compass\  (instanz.example.js, compass-produkt.js/.css, demo\*)
#   Ziel:    site\compass-demo\        oeffentliche Demo  (Standard)
#            instanzen\<Kunde>\        Kundeninstanz     (-Instanz <Name>)
#
# Was der Build entfernt bzw. austauscht
#   1) Alles Persoenliche (Name, Trello-Boards, Jira-URLs, Kontexte, Projekte,
#      Porsche, Vaikuntha, Vishnu-Bezeichner) kommt aus instanz.js statt aus
#      der HTML-Datei. Bleibt ein Anker aus, bricht der Build ab (nie stillschweigend
#      eine halb anonymisierte Datei ausliefern).
#   2) Die Bene-eigenen Karten (KI-Pfad, Ticket-Aufraeumen, Porsche, Facebook)
#      fallen weg; an ihre Stelle tritt die Karte „Verbundene Werkzeuge“.
#   3) Der Einrichtungs-Assistent wird eingehaengt (erster Start + ⚙️ im Kopf).
#   4) Zum Schluss laeuft eine Wortpruefung: findet sie noch Bene/Vishnu/Porsche/
#      Vaikuntha im Ergebnis, bricht der Build ab.
#
# Aufruf
#   powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-produkt.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-produkt.ps1 -Instanz "Muster GmbH"
param(
  [string]$Quelle  = (Split-Path -Parent $MyInvocation.MyCommand.Path),   # seit 02.09.2026: Quelle und Build im selben Repo (flow-compass)
  [string]$Instanz = '',
  [string]$Ziel    = ''
)
$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$prod = Join-Path $base 'produkt\compass'
$enc  = New-Object Text.UTF8Encoding($false)

if (-not (Test-Path (Join-Path $Quelle 'dashboard.html'))) { throw "Quelle fehlt: $Quelle\dashboard.html" }
if (-not (Test-Path (Join-Path $prod 'compass-produkt.js'))) { throw "Produktschicht fehlt: $prod\compass-produkt.js" }

$slug = if ($Instanz) { ($Instanz.ToLower() -replace '[^a-z0-9]+','-').Trim('-') } else { '' }
# Seit 04.09.2026 ist die Wurzel einer Instanz-Subdomain das persoenliche Portal
# (build-portal.ps1); der Compass liegt darunter in compass\. Die Demo bleibt an ihrer
# Wurzel — demo.vishnuartists.com zeigt das Produkt, kein Portal.
$instanzWurzel = ''
if (-not $Ziel) {
  if ($Instanz) { $instanzWurzel = Join-Path $base "instanzen\$slug"; $Ziel = Join-Path $instanzWurzel 'compass' }
  else          { $Ziel = Join-Path $base 'site\compass-demo' }
}
# Lag der Compass bisher flach an der Wurzel, muss er dort WEG, bevor hier gebaut wird:
# sonst legt der Build unten eine frische instanz.js in compass\ an, waehrend die
# ausgefuellte an der Wurzel liegen bleibt — die Instanz haette ueber Nacht wieder die
# Werte der Vorlage. Migriert wird deshalb zuerst, und nur einmal (danach erkennt
# build-portal.ps1 den Portal-Marker und laesst die Wurzel in Ruhe).
if ($instanzWurzel -and (Test-Path (Join-Path $instanzWurzel 'index.html'))) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $base 'build-portal.ps1') -Ziel $instanzWurzel -NurMigrieren | ForEach-Object { Write-Host $_ }
}
if (-not (Test-Path $Ziel)) { New-Item -ItemType Directory -Force $Ziel | Out-Null }

function Read-Utf8([string]$p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }
function Write-Lf([string]$p, [string]$t) { [IO.File]::WriteAllText($p, $t.Replace("`r`n","`n"), $enc) }

$script:s = (Read-Utf8 (Join-Path $Quelle 'dashboard.html')).Replace("`r`n","`n")

# Anker aus den (moeglicherweise CRLF-)Here-Strings dieses Skripts CR-frei machen,
# sonst matchen mehrzeilige Anker nie.
function Rep([string]$old, [string]$new, [string]$name) {
  $old = $old -replace "`r",''; $new = $new -replace "`r",''
  if (-not $script:s.Contains($old)) { throw "ANKER FEHLT (R): $name" }
  $script:s = $script:s.Replace($old, $new)
}
function RepX([string]$pattern, [string]$new, [string]$name) {
  $pattern = $pattern -replace "`r",''; $new = $new -replace "`r",''
  $rx = New-Object System.Text.RegularExpressions.Regex($pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $t = $rx.Match($script:s)
  if (-not $t.Success) { throw "ANKER FEHLT (RX): $name" }
  # Ein Muster, das die leere Zeichenkette trifft, ist ein Tippfehler und kein Treffer:
  # es wuerde den Ersatztext an Position 0 einschieben, vor <!doctype html>, ohne Fehler.
  if ($t.Length -eq 0) { throw "ANKER LEER (RX) - das Muster trifft die leere Zeichenkette: $name" }
  $ev = { param($m) $new }.GetNewClosure()
  $script:s = $rx.Replace($script:s, $ev, 1)
}
# RepN - woertlicher Anker mit Platzhalter, ohne Regex-Syntax im Aufruf.
# '#NR#' steht fuer eine Zahl, die wandert (die Nummern der Sektionskommentare in
# render() verschieben sich, sobald jemand eine Sektion einfuegt oder entfernt).
# Alles Uebrige wird escaped. Das ist der Punkt: schreibt man den Block von Hand als
# Regex, wird aus `D.projekte||{}` eine Alternation mit leerem Zweig - die trifft an
# Position 0 die leere Zeichenkette (24.08.2026, dabei rutschte der Ersatz vor <!doctype>).
function RepN([string]$text, [string]$new, [string]$name) {
  $text = $text -replace "`r",''; $new = $new -replace "`r",''
  $zahl = [char]92 + 'd+'
  $pat  = [regex]::Escape($text).Replace([regex]::Escape('#NR#'), $zahl)
  $rx = New-Object System.Text.RegularExpressions.Regex($pat, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $tr = $rx.Matches($script:s)
  if ($tr.Count -eq 0) { throw "ANKER FEHLT (N): $name" }
  if ($tr.Count -gt 1) { throw "ANKER MEHRDEUTIG (N, $($tr.Count)x): $name" }
  $ev = { param($m) $new }.GetNewClosure()
  $script:s = $rx.Replace($script:s, $ev, 1)
}

Write-Host "Quelle : $Quelle\dashboard.html"
Write-Host "Ziel   : $Ziel"
Write-Host ''

# ── 1. Kopf: Titel, Stylesheet, Datenschicht, Produktschicht ─────────────────
Rep '<title>Vishnu Flow Compass · Bene</title>' '<title>Flow Compass — Know what matters next</title>' 'Titel'

Rep '<link rel="stylesheet" href="fonts.css"><!-- selbst gehostet (VA-13512): keine Besucher-IP mehr an Google -->' @'
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="compass-produkt.css">
<meta name="description" content="Flow Compass — dein persoenliches Kanban-Cockpit: eine Frage jeden Morgen, alle Quellen an einem Ort, WIP-Limit inklusive.">
<!-- Als App installierbar (04.09.2026). Installiert wird immer vom eigenen Ursprung aus:
     die Verkaufsseite kann nur hierher verlinken (?install=1), nicht selbst installieren. -->
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#1c2314">
<link rel="icon" type="image/png" sizes="192x192" href="app-icons/icon-192.png">
<link rel="apple-touch-icon" href="app-icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Compass">
'@ 'Kopf-Stylesheet'

Rep @'
<script src="dashboard-data.js"></script>
<script src="rhythmus-data.js"></script>
<script src="kennzahlen-data.js"></script>
<script src="ki-trainer-data.js"></script>
<script src="aufraeumen-data.js"></script>
'@ @'
<script src="instanz.js"></script>
<script src="dashboard-data.js"></script>
<script src="rhythmus-data.js"></script>
<script src="kennzahlen-data.js"></script>
<script src="compass-produkt.js"></script>
<script src="compass-app.js" defer></script>
'@ 'Datenschicht'

# ── 2. Zugangsschutz-Dialog neutral ──────────────────────────────────────────
Rep @'
  <h2>Vishnu Flow Compass</h2>
  <p>Ein Login für Compass und Vishnu Cockpit: dein Name (wie in Jira) und das Team-Passwort. Gilt 30 Tage auf diesem Gerät.</p>
  <input id="gateName" type="text" autocomplete="username" placeholder="Dein Name — Vorname reicht" aria-label="Name">
  <input id="gatePw" type="password" autocomplete="current-password" placeholder="Team-Passwort" aria-label="Team-Passwort">
'@ @'
  <h2>Flow Compass</h2>
  <p>Dein persönlicher Bereich. Name und Zugangswort hast du bei der Einrichtung bekommen — die Anmeldung gilt 30 Tage auf diesem Gerät.</p>
  <input id="gateName" type="text" autocomplete="username" placeholder="Dein Name — Vorname reicht" aria-label="Name">
  <input id="gatePw" type="password" autocomplete="current-password" placeholder="Zugangswort" aria-label="Zugangswort">
'@ 'Gate-Text'

# ── 3. Kopfzeile: Begruessung + Einrichtungs-Knopf ───────────────────────────
Rep '<h1 id="hello"><small>Vishnu Flow Compass · Know what matters next</small>Guten Tag, <em class="acc">Bene</em></h1>' `
    '<h1 id="hello"><small>Flow Compass · Know what matters next</small></h1>' 'Begruessung'

Rep '<button class="iconbtn" id="btnTheme" title="Farbschema: Automatisch (folgt dem Tag) → Hell → Dunkel">🌙</button>' @'
<button class="iconbtn" id="btnTheme" title="Farbschema: Automatisch (folgt dem Tag) → Hell → Dunkel">🌙</button>
  <button class="iconbtn" id="btnSetup" title="Einrichtung öffnen" onclick="compassSetup.oeffnen(1)">⚙️</button>
'@ 'Setup-Knopf'

# ── 4. Fokusleiste: Board-Umschalter + Coach ─────────────────────────────────
# Kundenlage raus: kundenlage-data.js fuehrt Klarnamen, Rollen und E-Mail-Adressen der
# Kundschaft. Die Seite wird hier bewusst NICHT ausgeliefert — weder in die oeffentliche
# Demo noch in eine Kundeninstanz. Ohne diesen Schnitt bleibt der Knopf stehen und zeigt
# auf eine Seite, die es im Ziel nicht gibt (404, gefunden 31.08.2026 unter /compass-demo/).
Rep @'
  <a class="btn g" href="kundenlage.html" target="_top">🧭 Kundenlage</a>

'@ '' 'Kundenlage-Knopf'

Rep @'
    <button class="v" data-k="vishnu">🏢 Vishnu Kanban <span class="kbd">B</span></button>
'@ @'
    <button class="v" data-k="vishnu">✈️ Team-Board <span class="kbd">B</span></button>
'@ 'Board-Umschalter'

# ── 5. Kontext-Reiter kommen aus der Instanz ─────────────────────────────────
Rep @'
    <div class="tab va" data-c="va" title="Nur Vishnu Artists — Strg+Klick: dazunehmen"><span class="dot"></span>🏢 Vishnu Artists <span class="kbd">1</span></div>
    <div class="tab vk" data-c="vk" title="Nur Vaikuntha — Strg+Klick: dazunehmen"><span class="dot"></span>🌿 Vaikuntha <span class="kbd">2</span></div>
    <div class="tab pr" data-c="pr" title="Nur Privat — Strg+Klick: dazunehmen"><span class="dot"></span>🏠 Privat <span class="kbd">3</span></div>
    <div class="tab fi" data-c="fi" title="Nur Finanzen — Strg+Klick: dazunehmen"><span class="dot"></span>💰 Finanzen <span class="kbd">4</span></div>
'@ '' 'Kontext-Reiter (leer, JS baut sie)'

Rep "document.querySelectorAll('#tabs .tab').forEach(t=>t.addEventListener('click',e=>setCtx(t.dataset.c, e.ctrlKey||e.metaKey||e.shiftKey)));" @'
/* Kontext-Reiter aus der Instanz bauen (Produktversion: Namen, Emojis und Farben kommen aus instanz.js) */
function tabsBauen(){
  const sc=document.querySelector('#tabs .tabscroll'); if(!sc) return;
  sc.innerHTML=`<div class="tab all" data-c="alle" title="Alle Kontexte zusammen (Taste 0)"><span class="dot"></span>🌐 Alle <span class="kbd">0</span></div>`
    + INST.ctx.map((c,i)=>`<div class="tab ${c.key}" data-c="${c.key}" title="Nur ${esc(c.name)} — Strg+Klick: dazunehmen"><span class="dot"></span>${c.icon} ${esc(c.name)} <span class="kbd">${i+1}</span></div>`).join('');
}
tabsBauen();
document.querySelectorAll('#tabs .tab').forEach(t=>t.addEventListener('click',e=>setCtx(t.dataset.c, e.ctrlKey||e.metaKey||e.shiftKey)));
'@ 'Reiter-Verdrahtung'

# ── 6. Quellen-Konstanten: Trello, Porsche, Coach-Server ─────────────────────
Rep @'
const TRELLO={
  privat:{ key:'privat', label:'Bene privat',      url:'https://trello.com/b/jO3Q7d8Z/bene-privat',        konto:'benedikt.irsch@gmail.com' },
  arbeit:{ key:'arbeit', label:'Arbeit · Porsche', url:'https://trello.com/b/Zw3jgjsR/mein-trello-board', konto:'porsche@vishnuartists.com' }
};
const TRELLO_ARBEIT=TRELLO.arbeit.url, TRELLO_PRIVAT=TRELLO.privat.url;
const PORSCHE_STE='https://porsche-customer.github.io/cs-carsales-flow-cockpit/';
'@ @'
const TRELLO={
  privat:{ key:'privat', label:((INST.trello.privat||{}).label)||'Mein privates Board', url:((INST.trello.privat||{}).url)||'' },
  arbeit:{ key:'arbeit', label:((INST.trello.arbeit||{}).label)||'Team-Board',          url:((INST.trello.arbeit||{}).url)||'' }
};
const TRELLO_ARBEIT=TRELLO.arbeit.url, TRELLO_PRIVAT=TRELLO.privat.url;
'@ 'Trello/Porsche-Konstanten'

Rep "const JOHN_API = LOKAL ? '' : (localStorage.getItem('compassJohnApi') || 'http://localhost:8787');" @'
/* Compass-Server: Adresse aus der Instanz (instanz.js › api) oder aus dem
   Einrichtungs-Assistenten. Wert 'same-origin' = der Server liefert diese Seite
   selbst aus. Ohne Adresse läuft der Compass im Solo-Modus, rein im Browser. */
const SERVER_ROH = localStorage.getItem('compassJohnApi') || INST.api || '';
const SERVER_AN  = !!SERVER_ROH;
const JOHN_API   = SERVER_ROH === 'same-origin' ? '' : SERVER_ROH;
/* Im Solo-Modus rufen wir gar nicht erst ins Leere: alle /api/-Aufrufe scheitern
   sofort, die Karten zeigen ihre Offline-Texte statt 404er in der Konsole. */
if(!SERVER_AN){
  const _fetch = window.fetch;
  window.fetch = function(u){
    try{ const p = String((u && u.url) || u || ''); if(/(^|\/)api\//.test(p)) return Promise.reject(new Error('kein Compass-Server eingerichtet')); }catch(e){}
    return _fetch.apply(window, arguments);
  };
}
'@ 'Server-Adresse'

# ── 7. Produkt-Konfiguration statt Bene-Konfiguration ────────────────────────
RepX '(?s)const COMPASS=\{\n  product:.*?\n\};\n' @'
const COMPASS={
  demo: !!INST.demo,
  product: INST.produkt||'Flow Compass', claim: INST.claim||'Know what matters next', name: INST.name||'',
  personal:{ label:'Aufgaben-Listen', url:TRELLO_PRIVAT, tool:'Trello', boards:['privat','arbeit'], standard:'privat' },
  gate: INST.gate||{ salt:'', hash:'', tage:30 },
  board: INST.board||{ wip:3, alter:[3,7], listen:{} },
  cockpit:{
    label:(INST.team.label)||'Team-Kanban', url:(INST.team.url)||'', jira:(INST.jira.board)||'',
    daten:(INST.team.daten)||'va-data.json', jiraBase:(INST.team.jiraBase)||(INST.jira.browse)||'',
    entries:(INST.team.entries)||[]
  }
};
'@ 'COMPASS-Konfiguration'

# ── 8. Erinnerungs-Mail + Ticket-/Web-Adressen ───────────────────────────────
Rep "const MAILTO=n=>'mailto:benedikt.irsch@gmail.com?subject='+encodeURIComponent(n);" `
    "const MAILTO=n=>'mailto:'+(INST.mail||'')+'?subject='+encodeURIComponent(n);" 'Mail-Ziel'

Rep "const JIRA_VA_URL='https://vishnuartists.atlassian.net/browse/', JIRA_PORSCHE_URL='https://porschedigital.atlassian.net/browse/';" `
    "const JIRA_VA_URL=(INST.jira.browse)||'', JIRA_PORSCHE_URL='';" 'Ticket-Basisadresse'

Rep "const WP_BASE={ standard:'https://vishnuartists.com/', vk:'https://vaikuntha.eu/' };" `
    "const WP_BASE={ standard:(INST.web&&INST.web.standard)||'' };" 'Web-Basisadresse'

# ── 9. Kontext-Erkennung aus der Instanz ─────────────────────────────────────
RepX '(?s)const KTX_WORT=\{\n.*?\n\};\nconst KTX_KEYS=\[[^\]]*\];[^\n]*\nconst KTX_QUELLE=\{[^\}]*\};\nconst KTX_JIRA=[^\n]*\n' @'
const KTX_WORT=INST.ktxWort;
const KTX_KEYS=INST.ctxKeys;                                        /* Reihenfolge = Vorrang bei Gleichstand */
const KTX_QUELLE=INST.ktxQuelle;
const KTX_JIRA=INST.ktxJira;
'@ 'Kontext-Stichwoerter'

# ── 10. Die vier Kontexte selbst ─────────────────────────────────────────────
RepX '(?s)const CTX=\{\n va:\{.*?\n\};\n\nconst PROJEKTE=\[.*?\n\];\n' @'
/* Kontexte: Namen, Farben und Stichwörter kommen aus instanz.js, Inhalte aus
   dashboard-data.js › kontexte[slot]. Die Kennzahlen sind gerechnet, nicht
   getippt — ein Cockpit mit erfundenen Kacheln fühlt sich nach zwei Tagen
   tot an. Was keine Quelle hat, steht auf „–“. */
const CTX={};
INST.ctx.forEach(function(c){
  const key=c.key, inh=((D.kontexte||{})[key])||{};
  CTX[key]={
    color:c.farbe, name:c.name, icon:c.icon, tone:key,
    next:inh.next||[], termine:inh.termine||[], vorbereiten:inh.vorbereiten||[],
    jira:c.jira||null, trello:c.trello||null,
    kpis:function(){
      const l=[[CTX[key].next.length,'offene Schritte',key],
               [ktxKarten(key),'Karten auf Mein Board',key],
               [CTX[key].vorbereiten.length,'vorzubereiten',key]];
      if(c.jira) l.push([((K.durchsatz||{}).offen)||D.jiraOpenCount||'–','offene Vorgänge',key]);
      l.push([S.streak,'Tage Streak','bene']);
      return l;
    }
  };
});

/* „Projekte · nächste Schritte“ — eine Zeile je Vorhaben, gepflegt in
   dashboard-data.js › projekteListe. */
const PROJEKTE=D.projekteListe||[];
'@ 'Kontexte + Projektliste'

# ── 11. Ticket-Karte, Meldungs-Karte, Werkzeug-Karte ─────────────────────────
# Seit 25.08.2026 traegt die Karte eine kompakte Variante (Aufruf jiraCard(mode,true) in
# "Heute im Blick"), deshalb steht im Klassenattribut ein Ausdruck statt nur der Klasse.
Rep '<h3>🎫 Jira (Vishnu) <span class="cnt">' `
    '<h3>🎫 Meine Vorgänge <span class="cnt">' 'Ticket-Karte Titel'

# Seit 06.09.2026 hat die Karte zwei Fussnoten: live (Instanz mit Server) und Handliste (ohne).
# Die Live-Fassung nennt nur die Site aus der Serverantwort und bleibt; die Handlisten-Fassung
# soll in der Demo nicht von dashboard-data.js und einem John-Server reden.
Rep ':`Handliste aus dashboard-data.js · Stand: ${esc(D.stand||''?'')} — ${esc(PK.jiraHint||(PK.geladen?''John-Server offline, Live-Liste fehlt'':''Live-Liste lädt …''))}`;' `
    ':`Quelle: dein Vorgangssystem · Stand: ${esc(D.stand||''?'')}`;' 'Ticket-Karte Fussnote'

Rep ":'<div class=""empty"">Nichts offen — die Feedback-Kette läuft. Zuletzt erledigt: VA-13397 + VA-13396 (Dark-Mode-Kontraste, 18.08.).</div>'}" `
    ":'<div class=""empty"">Nichts offen — alles abgearbeitet.</div>'}" 'Meldungs-Karte leer'

# ── 12. Bene-eigene Karten raus, Werkzeug-Karte rein ─────────────────────────
# Die Nummern in den Sektionskommentaren wandern, sobald jemand in render() eine Sektion
# einfuegt oder entfernt (zuletzt am 24.08.2026). Deshalb als Muster mit Platzhalter statt woertlich.
# Seit 25.08.2026 stehen KI-Pfad und Jira kompakt in "Heute im Blick" (unter dem Board).
# Der KI-Champion-Pfad ist Benes eigene Karte und faellt im Produkt weg.
Rep "    + (selHat('va')?kiCard(true):'') + (d.jira?jiraCard(d.jira,true):'')" `
    "    + (d.jira?jiraCard(d.jira,true):'')" 'Heute: KI-Pfad raus'

RepN @'
    /* #NR# · Arbeit & Tickets — KI-Pfad und Jira stehen seit 25.08. oben bei „Heute im Blick“ */
    let a='';
    if(selHat('va')) a+=aufraeumCard();
    a+=bugCard();
    h+=secHtml('arbeit',a);
    /* #NR# · Projekte */
    const pj=D.projekte||{};
    let p=projektCard(pj.finance,'tone-fi','finance')+projektCard(pj.vaikuntha,'tone-vk','vaikuntha')+projektCard(pj.neukunden,'tone-bene','neukunden');
'@ @'
    /* 4 · Arbeit & Werkzeuge */
    let a='';
    a+=bugCard();
    a+=konnektorCard();
    h+=secHtml('arbeit',a);
    /* 5 · Projekte — jede Karte kommt aus dashboard-data.js › projekte */
    const pj=D.projekte||{};
    let p=Object.keys(pj).map(function(k,i){ return projektCard(pj[k],'tone-'+(INST.ctxKeys[i%INST.ctxKeys.length]||'none'),k); }).join('');
'@ 'Sektion Arbeit + Projekte'

# depCard() (Deploy-Waechter, 03.09.) faellt in Demo und Kundeninstanzen ersatzlos weg — nicht per
# Modulschalter, sondern gar nicht. Die Karte vergleicht Live-Adressen gegen HEAD lokaler Git-Repos;
# ohne Benes Arbeitskopien haette sie in jeder fremden Instanz dauerhaft "nicht pruefbar" stehen,
# und eine Karte, die bei niemandem etwas messen kann, ist Deko. Der Banner (depGruppe) bleibt im
# Code, bleibt dort aber still: ohne /api/deploy ist DEP.data null und die Gruppe rendert ''.
Rep "    h+=secHtml('kanaele', mailCard()+slackCard()+socialCard()+wachtCard()+depCard()+routCard()+sichCard());" `
    "    h+=secHtml('kanaele', mailCard()+slackCard()+(INST.module.social?socialCard():'')+(INST.module.wacht?wachtCard():'')+(INST.module.routinen?routCard():'')+(INST.module.sicherung?sichCard():''));" 'Sektion Kanaele'

# porscheLive() gibt es seit dem 25.08.2026 nicht mehr — die Karte "Car Sales Value Stream"
# ist in der Quelle geloescht. Hier bleibt nichts zu entfernen.

# ── 12b. Kontext-Vorauswahl: nur Slots, die diese Instanz wirklich hat ───────
# In der Quelle stehen hier die vier festen Slots. Wer nur zwei Kontexte bucht,
# bekaeme sonst beim ersten Laden einen Kontext, den es nicht gibt — und das
# Cockpit bliebe mit „Cannot read properties of undefined“ leer.
Rep @'
  const h=new Date().getHours(), day=new Date().getDay();
  if(day===0||day===6) return 'pr';
  if(h>=9&&h<18) return 'va';
  if(h>=18&&h<21) return 'vk';
  return 'pr';
'@ @'
  /* Nur Kontexte, die es in dieser Instanz gibt (1 bis 4): am Wochenende der
     letzte (meist der private), tagsüber der erste, abends der zweite. */
  const ks=INST.ctxKeys, h=new Date().getHours(), day=new Date().getDay();
  if(!ks.length) return null;
  if(day===0||day===6) return ks[ks.length-1];
  if(h>=9&&h<18) return ks[0];
  if(h>=18&&h<21) return ks[Math.min(1,ks.length-1)];
  return ks[ks.length-1];
'@ 'Kontext-Vorauswahl'

Rep "localStorage.setItem('beneCtx',SEL[0]||'va');" `
    "localStorage.setItem('beneCtx',SEL[0]||INST.ctxKeys[0]||'');" 'Kontext merken'

Rep "(function(){ if(!SEL.length) SEL=[autoCtx()];" `
    "(function(){ if(!SEL.length){ const a=autoCtx(); SEL = a ? [a] : CTX_KEYS.slice(); }" 'Kontext-Start'

# ── 13. Sektionsbeschriftungen neutral ───────────────────────────────────────
Rep @'
  ['heute',   '🪷','Heute im Blick',        'Fokus-KPIs, Mein Board, KI-Pfad, Jira, Kompass, John'],
'@ @'
  ['heute',   '🪷','Heute im Blick',        'Kennzahlen, dein Board, Vorgänge, Kompass, Coach'],
'@ 'Sektionsname Heute'

Rep @'
  ['arbeit',  '🎫','Arbeit & Tickets',      'Aufräumen, Web-Meldungen'],
  ['projekte','🗂️','Projekte',              'Finance, Vaikuntha, Neukunden, nächste Schritte'],
  ['kanaele', '📡','Kanäle',                'E-Mail, Slack, Facebook'],
  ['rhythmus','🎮','Rhythmus & Claude',     'Level, Badges, Arbeit mit Claude, offene Rückfragen']
'@ @'
  ['arbeit',  '🎫','Arbeit & Werkzeuge',    'Meldungen, verbundene Werkzeuge'],
  ['projekte','🗂️','Projekte',              'Deine Vorhaben und ihre nächsten Schritte'],
  ['kanaele', '📡','Kanäle',                'E-Mail und Team-Chat'],
  ['rhythmus','🎮','Rhythmus & Coach',      'Level, Badges, Arbeit mit dem Coach, offene Entscheidungen']
'@ 'Sektionsnamen'

# Die Sektion 'board' gibt es seit dem 24.08.2026 nicht mehr - "Mein Board" steht als Karte
# in "Heute im Blick". Der Begriff "Vishnu Kanban" wird weiter unten von der allgemeinen
# Begriffsliste ersetzt, ein eigener Anker dafuer ist nicht mehr noetig.

# ── 14. Fusszeile ────────────────────────────────────────────────────────────
RepX "document\.getElementById\('foot'\)\.innerHTML=esc\(COMPASS\.product[^\n]*\n" @'
document.getElementById('foot').innerHTML=esc(COMPASS.product+' · '+COMPASS.claim+(INST.kunde?' · Instanz '+INST.kunde:'')+' · Datenstand '+(K.stand||'?'))
'@ 'Fusszeile'

Rep '<div class="foot" id="foot">Vishnu Flow Compass · lokal, nicht veröffentlicht · gebaut mit Claude</div>' `
    '<div class="foot" id="foot">Flow Compass</div>' 'Fusszeile HTML'

# ── 15. Einrichtungs-Assistent beim ersten Start ─────────────────────────────
Rep "document.getElementById('btnFokus').classList.toggle('p',fokusModus);" @'
document.getElementById('btnFokus').classList.toggle('p',fokusModus);
/* Erster Start: durch die Einrichtung führen. In der Demo stattdessen das Demo-Band. */
if(compassSetup.noetig()) setTimeout(()=>compassSetup.oeffnen(0),400);
else if(INST.demo) demoBand();
function demoBand(){
  const t=document.querySelector('.tabs'); if(!t||document.getElementById('demoBand')) return;
  const d=document.createElement('div'); d.className='demobar'; d.id='demoBand';
  d.innerHTML=`<div class="dbt">🪷 Demo</div>
    <div class="dbm">Du siehst den Compass mit erfundenen Daten einer selbstständigen Beraterin — <b>alles ist bedienbar</b>:
      Karten ziehen, Morgencheck starten, Kontexte wechseln. Dein Fortschritt bleibt in diesem Browser und stört niemanden.
      In deiner eigenen Instanz stehen hier deine Quellen.</div>
    <div class="dbb">
      <a class="btn a" href="${(INST.kaufUrl||'https://vishnuartists.com/flow-compass.html')}#kaufen">🚀 Einrichten lassen</a>
      <button class="btn w" onclick="secToggle('arbeit');document.querySelector('.sec[data-s=&quot;arbeit&quot;]').scrollIntoView({behavior:'smooth'})">🔌 Was lässt sich anbinden?</button>
      <button class="btn" onclick="if(confirm('Demo zurücksetzen? Alle Eingaben in dieser Demo werden gelöscht.')){localStorage.clear();location.reload();}">↺ Demo zurücksetzen</button>
    </div>`;
  t.parentNode.insertBefore(d,t.nextSibling);
  /* VA-13511: auf schmalen Schirmen zusaetzlich ein sticky Kaufaufruf — das Band
     selbst liegt rund 1000 px unter dem Falz. Sichtbarkeit regelt das CSS. */
  if(!document.getElementById('demoCta')){
    const c=document.createElement('div'); c.id='demoCta';
    c.innerHTML=`<div class="dcx">Gefällt dir der Compass?</div>
      <a class="btn a" href="${(INST.kaufUrl||'https://vishnuartists.com/flow-compass.html')}#kaufen">🚀 Einrichten lassen</a>`;
    document.body.appendChild(c);
  }
}
'@ 'Erststart / Demo-Band'

# ── 16. Der Coach heisst im Produkt „Coach“ ──────────────────────────────────
# „Claude“ bleibt bewusst stehen, wo es die Maschine dahinter meint — das ist
# Teil des Produkts (KI-Coach auf Basis von Claude), kein Persoenliches.
Rep '<div class="jav">J</div><div class="jt"><b>John</b><span id="johnSub">Karriere-Coach · Claude Fable 5</span></div>' `
    '<div class="jav">C</div><div class="jt"><b>Coach</b><span id="johnSub">Dein Flow-Coach · Claude</span></div>' 'Coach-Kopf'
Rep '`<div class="jm j sys">Hallo, ich bin John — dein Coach und Sparringspartner. Ich kenne dein Profil, deine Pipeline, deine Aufgaben und dein Claude-Memory. Frag mich etwas oder tipp auf einen Vorschlag.</div>`' `
    '`<div class="jm j sys">Hallo, ich bin dein Coach. Ich sehe dein Board, deine Kennzahlen und deine offenen Entscheidungen — frag mich etwas oder tipp auf einen Vorschlag.</div>`' 'Coach-Begruessung'

$ersetzungen = @(
  # -- Befunde aus Florians Review vom 24.08.2026 (VA-13505 ff.) --------------
  # FC-2 Login-Geheimnis, FC-4 Fehlerzustaende im Schaufenster, FC-5 Grammatik +
  # john-server.* im Auslieferstand, FC-10 ein Coach-Name, FC-12 Hash nicht global.
  # Stehen bewusst VOR den allgemeinen Regeln unten - die greifen sonst zuerst.
  @(@'
/* Ein Login für beide Werkzeuge (19.08.): Der Compass akzeptiert das Team-Passwort des Vishnu Cockpits
   (gleiches Salt, gleicher Hash wie va-app.js) und meldet das Cockpit gleich mit an — live liegen Compass
   (/compass/) und Cockpit (/va/) auf derselben Domain, teilen sich also den localStorage. Die alte
   Compass-Passphrase gilt weiter (dann ohne Cockpit-Anmeldung). */
'@, @'
/* Zweites Login (optional): trägt die Instanz ein Team-Passwort ein, meldet der Compass
   das Team-Cockpit gleich mit an. Im Auslieferstand ist es leer — kein Geheimnis im Build. */
'@),
  @(@'
const VA_LOGIN={ salt:'va::flowcockpit::', hash:'da277872e63dfcd629c1378efa86c72f534ef24190c1afa550fbe5d594982250', key:'vaAuth_va2', tage:30, api:'https://vishnuartists.com/flow-login.php' };
'@, @'
const TEAM_LOGIN={ salt:(INST.teamLogin&&INST.teamLogin.salt)||'', hash:(INST.teamLogin&&INST.teamLogin.hash)||'', key:'teamAuth', tage:30, api:(INST.teamLogin&&INST.teamLogin.api)||'' };
'@),
  # Anmelde-Link/Passwort-vergessen am Gate (27.08.): der Block erscheint nur mit konfiguriertem
  # teamLogin (hash + api) — die Texte werden trotzdem neutralisiert, kein Name im Produkt.
  @(@'
Link schicken & Benedikt Bescheid geben →
'@, @'
Link schicken & Bescheid geben →
'@),
  @(@'
Das Team-Passwort kann nur Benedikt neu setzen — er bekommt eine Meldung. Mit dem Link kommst du sofort wieder rein.
'@, @'
Das Team-Passwort setzt euer Team-Admin neu — er bekommt eine Meldung. Mit dem Link kommst du sofort wieder rein.
'@),
  @(@'
VA_LOGIN
'@, @'
TEAM_LOGIN
'@),
  @(@'
window.compass={ hash:gateHash, exportieren:
'@, @'
window.compass={ exportieren:
'@),
  @(@'
<button id="johnFab" title="John — Coach & Sparringspartner"><span class="in">J<span class="st" id="johnSt"></span></span><span class="tip" id="johnTip">John · Coach</span></button>
'@, @'
<button id="johnFab" title="Coach — dein Sparringspartner"><span class="in">C<span class="st" id="johnSt"></span></span><span class="tip" id="johnTip">Coach</span></button>
'@),
  @(@'
    tk.innerHTML=`<div class="empty">John-Server nicht erreichbar${JOHN_API?` (${esc(JOHN_API)})`:''} — <code>john-server.cmd</code> starten, dann ↻ Neu laden. Solange: <a href="${t.url}" target="_blank" rel="noopener">Board in Trello öffnen ↗</a></div>`;
'@, @'
    tk.innerHTML=`<div class="empty">${COMPASS.demo?`In deiner Instanz stehen hier die Karten aus <b>${esc(t.label)}</b>. Die Demo läuft bewusst ohne Server.`:`Der Compass-Server ist nicht erreichbar${JOHN_API?` (${esc(JOHN_API)})`:''} — starte ihn, dann ↻ Neu laden.`}${t.url?` <a href="${t.url}" target="_blank" rel="noopener">Board in Trello öffnen ↗</a>`:''}</div>`;
'@),
  @(@'
      : `<div class="empty">John-Server nicht erreichbar${JOHN_API?` (${esc(JOHN_API)})`:''} — <code>john-server.cmd</code> starten, dann ↻ Neu laden.</div>`;
'@, @'
      : `<div class="empty">${COMPASS.demo?'In deiner Instanz steht hier dein Tag: Termine, freie Fenster und der nächste Übergang. Die Demo läuft bewusst ohne Server.':`Der Compass-Server ist nicht erreichbar${JOHN_API?` (${esc(JOHN_API)})`:''} — starte ihn, dann ↻ Neu laden.`}</div>`;
'@),
  @(@'
      : `<div class="empty">John-Server nicht erreichbar${JOHN_API?` (${esc(JOHN_API)})`:''} — <code>john-server.cmd</code> starten, dann ↻ Neu laden.
         Ohne Server prüft niemand deine Seiten; grün heißt hier also nichts.</div>`;
'@, @'
      : `<div class="empty">${COMPASS.demo?'In deiner Instanz wacht hier der Seiten-Wächter über deine Adressen — Erreichbarkeit, Tempo, Zertifikate. Die Demo läuft bewusst ohne Server.':`Der Compass-Server ist nicht erreichbar${JOHN_API?` (${esc(JOHN_API)})`:''} — starte ihn, dann ↻ Neu laden.
         Ohne Server prüft niemand deine Seiten; grün heißt hier also nichts.`}</div>`;
'@),
  @(@'
John ist nicht erreichbar. Läuft john-server.cmd? (
'@, @'
Der Coach ist nicht erreichbar. Läuft dein Compass-Server? (
'@),
  @(@'
Server nicht erreichbar — läuft john-server.ps1?
'@, @'
Der Compass-Server ist nicht erreichbar — läuft er?
'@),
  @(@'
(LOKAL?'Läuft <code>john-server.cmd</code>?':'Der Compass spricht dafür deinen lokalen Server an (<code>john-server.cmd</code> starten, dann Checkin wiederholen).')
'@, @'
(LOKAL?'Läuft dein Compass-Server?':'Der Compass spricht dafür deinen Compass-Server an — starte ihn und wiederhole den Checkin.')
'@),
  @(@'
'Der John-Server reicht sie durch — läuft er? <code>john-server.cmd</code> starten, dann ↻ Neu laden.'
'@, @'
'Der Compass-Server reicht sie durch — läuft er? Starte ihn, dann ↻ Neu laden.'
'@),
  @(@'
John ist offline — starte john-server.cmd, dann kommt die Summary hier hin.
'@, @'
Der Coach ist offline — starte deinen Compass-Server, dann kommt die Summary hier hin.
'@),
  @(@'
John ist offline — starte john-server.cmd im Cockpit-Ordner (öffnet http://localhost:8787/dashboard.html).
'@, @'
Der Coach ist offline — starte deinen Compass-Server, dann meldet er sich hier.
'@),
  @(@'
(Anleitung im Kopf von john-server.ps1).
'@, @'
(Anleitung in der Einrichtung deines Compass-Servers).
'@),
  @(@'
Anleitung: Kopf von john-server.ps1
'@, @'
Anleitung: Einrichtung deines Compass-Servers
'@),
  @(@'
Anleitung steht im Kopf von john-server.ps1.
'@, @'
Die Anleitung steht in der Einrichtung deines Compass-Servers.
'@),
  @(@'
ANTHROPIC_API_KEY setzen oder john-api-key.txt neben john-server.ps1 anlegen, dann neu starten.
'@, @'
Hinterlege den API-Schlüssel im Compass-Server und starte ihn neu.
'@),
  @(@'
   John — Chat-Bubble. Spricht mit john-server.ps1 (POST /api/john), das
'@, @'
   Coach — Chat-Bubble. Spricht mit dem Compass-Server (POST /api/john), das
'@),
  @(@'
<!-- John — Karriere-Coach, verbunden mit Claude Fable 5 über john-server.ps1 -->
'@, @'
<!-- Coach — verbunden mit Claude über den Compass-Server -->
'@),
  @('Vishnu Flow Compass',             'Flow Compass'),
  @('🏢 Vishnu Kanban',                '✈️ Team-Board'),
  @('Vishnu Kanban',                   'Team-Board'),
  @('🏢 Jira Board VA ↗',              '🎫 Board öffnen ↗'),
  @('JIRA_EMAIL + JIRA_TOKEN',         'Zugangsdaten im Compass-Server'),
  @('JIRA_EMAIL/JIRA_TOKEN',           'Zugangsdaten im Compass-Server'),
  @('Jira nicht live — JIRA_TOKEN setzen', 'Vorgangssystem nicht angebunden'),
  @('JIRA_TOKEN setzen',               'Zugang im Compass-Server hinterlegen'),
  @('JIRA_TOKEN)',                     'Zugang im Compass-Server)'),
  @('TRELLO_<BOARD>_TOKEN',            'den Trello-Zugang im Compass-Server'),
  @('Morgen-Update',                   'Tages-Update'),
  @(' · Porsche-Cockpit ${LOT.data.porsche?''live'':''–''}', ''),
  @('Porsche-Cockpit, ergänzend zum Vishnu Cockpit (Team).', 'Team-Cockpit (Flight Levels).'),
  @('Mit John besprechen',             'Mit dem Coach besprechen'),
  @('John fragen',                     'Coach fragen'),
  @('direkt mit John',                 'direkt mit dem Coach'),
  @('Im Chat mit John weiterdenken',   'Im Chat mit dem Coach weiterdenken'),
  @('John antwortet nicht',            'Der Coach antwortet nicht'),
  @('John denkt nach',                 'Der Coach denkt nach'),
  @('John formuliert',                 'Der Coach formuliert'),
  @('John ist nicht erreichbar',       'Der Coach ist nicht erreichbar'),
  @('John ist offline',                'Der Coach ist offline'),
  @('John trägt die Summary vor',      'Der Coach trägt die Summary vor'),
  @('John „trägt vor“',                'Der Coach „trägt vor“'),
  @('Claude Fable 5 mit Johns Persona + Profil + Pipeline + deinem Claude-Memory', 'Claude mit der Coach-Persona und deinem Board-Kontext'),
  @('Fortschritt + John-Chatverlauf',  'Fortschritt + Chatverlauf'),
  @('john-server.cmd',                 'deinen Compass-Server'),
  @('Johns Kontext',                   'Coach-Kontext'),
  @('Johns Summary',                   'Coach-Summary'),
  @('Johns Management-Summary',        'Coach-Summary'),
  @('John-Verlauf',                    'Coach-Verlauf'),
  @('John-Server',                     'Compass-Server'),
  @('Für Claude kopieren',             'Für den Coach kopieren'),
  @('Mit Claude als nächstes',         'Mit dem Coach als Nächstes'),
  @('Claude übernimmt',                'Dein Coach übernimmt'),
  @('mit Claude priorisieren',         'mit dem Coach priorisieren'),
  @('Rückfragen von Claude',           'Offene Entscheidungen'),
  @('Offene Rückfragen von Claude',    'Offene Entscheidungen'),
  @('Claude-Code-Transkripte',         'Aktivitätsprotokoll deines Rechners'),
  @('Praktische Arbeit mit Claude Code','Konzentrierte Arbeit'),
  @('Arbeit mit Claude Code',          'Konzentrierte Arbeit'),
  @('Arbeit mit Claude',               'Arbeit mit dem Coach'),
  @('in den Claude-Chat einfügen',     'in den Coach-Chat einfügen'),
  @('Claude, hol meine wichtigsten Slack-Nachrichten','Coach, fass mir die wichtigsten Nachrichten zusammen'),
  @('Claude, aktualisiere mein Dashboard','Bitte aktualisiere mein Cockpit'),
  @('Claude: Dashboard aktualisieren', 'Coach: Cockpit aktualisieren')
)
foreach ($p in $ersetzungen) { $script:s = $script:s.Replace(($p[0] -replace "`r",''), ($p[1] -replace "`r",'')) }
$script:s = [Text.RegularExpressions.Regex]::Replace($script:s, '\bJohns\b', 'Coach-')
$script:s = [Text.RegularExpressions.Regex]::Replace($script:s, '(?<![a-zA-Z])John(?![a-zA-Z])', 'Coach')

# ── 16b. Eigennamen in Kommentaren und Resttexten ────────────────────────────
# Die Quelldatei ist reich kommentiert — das ist gut und soll erhalten bleiben.
# Nur die Eigennamen darin werden neutral, damit eine ausgelieferte Datei nichts
# ueber unser eigenes Setup verraet. Reihenfolge: laengste Begriffe zuerst.
$eigennamen = @(
  @('Team-Werkzeug „Vishnu Cockpit“ (flow-cockpit/site/va)', 'Team-Werkzeug „Team-Cockpit“'),
  @('„Vishnu Cockpit“ (vishnu-artists.de/va)', '„Team-Cockpit“'),
  @('Vishnu Cockpit',        'Team-Cockpit'),
  @('Vishnu-Cockpit',        'Team-Cockpit'),
  @('Vishnu-Kanban',         'Team-Board'),
  @('Vishnu Artists',        'Kontext 1'),
  @('Vishnu-Partner-Plugin', 'Beispielkarte'),
  @('Vaikuntha-Plugin',      'Beispielprojekt'),
  @('Vishnu-Blau',           'Slot-1-Blau'),
  @('Vaikuntha-Grün',        'Slot-2-Grün'),
  @('Vishnu-Seite',          'Produktseite'),
  @('Pilot: Bene. ',         ''),
  @('(Pilot: Bene)',         ''),
  @('„Bene“ trifft „Benedikt Irsch“', '„Alex“ trifft „Alexandra Winter“'),
  @('vishnu-artists.de/va',  'deine Team-Cockpit-Adresse'),
  @('bene.vishnuartists.com', 'deine Compass-Adresse'),
  @('va.vishnuartists.com',  'deine Team-Cockpit-Adresse'),
  @('vishnuartists.com',     'example.com'),
  @('vishnuartists.atlassian.net', 'deine-firma.example'),
  @('porsche-customer.github.io', 'example.com'),
  @('Jira-Keys (VA/STA/COM/VAEV/KPI → vishnuartists,', 'Jira-Keys (deine Projektkürzel aus instanz.js,')
)
foreach ($p in $eigennamen) { $script:s = $script:s.Replace(($p[0] -replace "`r",''), ($p[1] -replace "`r",'')) }
# Die Domain klein geschrieben: `\bVaikuntha\b` weiter unten ist gross-/kleinschreibungsempfindlich
# und liess `vaikuntha.eu` durch — auch die Wortpruefung zaehlt Kleinschreibung nicht. Damit stand in
# der Verkaufs-Demo die Bluete „Aufrufe vaikuntha.eu“ mit Benes echter Adresse (gefunden 31.08., beim
# Anbinden des Vereins-Puls; die Stelle gab es schon vorher). Vor der Wortregel ersetzen, sonst
# machte `\bVaikuntha\b` daraus nichts und die Adresse bliebe stehen.
$script:s = $script:s.Replace('vaikuntha.eu', 'projekt.example')
# Was jetzt noch uebrig ist, steht in Fliesstext-Kommentaren: Wort fuer Wort neutral.
$script:s = [Text.RegularExpressions.Regex]::Replace($script:s, '\bVishnu\b',    'Team')
$script:s = [Text.RegularExpressions.Regex]::Replace($script:s, '\bVaikuntha\b', 'Projekt')
$script:s = [Text.RegularExpressions.Regex]::Replace($script:s, '\bPorsche\b',   'Kunde')
$script:s = [Text.RegularExpressions.Regex]::Replace($script:s, '\bBene\b',      'die Nutzerin')
$script:s = [Text.RegularExpressions.Regex]::Replace($script:s, '\bBenes\b',     'ihren')

# ── 17. Wortpruefung: nichts Persoenliches darf uebrig bleiben ───────────────
# Gross-/Kleinschreibung zaehlt: interne Bezeichner wie `tone-bene`, `beneRhythm`
# oder `porscheLive` sind unkritisch (sieht niemand), sichtbarer Text nicht.
# Wortgrenzen, damit „Benson“ (Jim Benson, gehoert ins Produkt) nicht anschlaegt.
# Gesucht wird Konkretes, nicht Gattungsbegriffe: `firma.atlassian.net` als
# Platzhalter im Formular ist richtig, unsere echte Instanz waere ein Leck.
# Ebenso trello.com/b/… (Platzhalter) gegen trello.com/b/<echte ID>.
$verboten = @('\bBene\b','Vishnu','Vaikuntha','Porsche','vishnuartists',
              '(?<![a-z-])(?!firma\.|deine-firma\.)[a-z0-9-]+\.atlassian\.net',
              'trello\.com/b/[A-Za-z0-9]{6}','benedikt','\bJohn\b')
# Ausnahmen: unsere eigene Adresse darf in der Instanz-Konfiguration stehen —
# dort ist sie die Adresse des Team-Cockpits bzw. der Kaufweg, kein Leck.
# 22.08.2026: personal-compass auf der Testdomain ist raus, der Kaufweg zeigt auf
# die Live-Domain. Bewusst eng gefasst — nur diese eine Seite, nicht vishnuartists.com
# als Ganzes, sonst rutscht irgendwann doch etwas Persoenliches durch.
$ausnahmen = @('vishnu-artists\.de/va/','contract@vishnuartists\.com','vishnuartists\.com/flow-compass','vishnu-artists\.de/compass-demo')
function Pruefe([string]$text, [string]$datei) {
  $funde = @()
  foreach ($w in $script:verboten) {
    foreach ($m in ([Text.RegularExpressions.Regex]::Matches($text, $w))) {
      $von = [Math]::Max(0, $m.Index - 70); $bis = [Math]::Min($text.Length, $m.Index + 70)
      $umfeld = $text.Substring($von, $bis - $von) -replace "`n",' '
      $ok = $false; foreach ($a in $script:ausnahmen) { if ([Text.RegularExpressions.Regex]::IsMatch($umfeld, $a)) { $ok = $true } }
      if ($ok) { continue }
      $zeile = ($text.Substring(0, $m.Index) -split "`n").Count
      $funde += ('  {0,-18} Zeile {1,-5} {2,-14} …{3}…' -f $datei, $zeile, $m.Value, $umfeld)
    }
  }
  return $funde
}
$funde = Pruefe $script:s 'index.html'
if ($funde.Count) {
  Write-Host 'WORTPRUEFUNG FEHLGESCHLAGEN — Persoenliches im Produkt-Build:' -ForegroundColor Red
  $funde | Select-Object -First 25 | ForEach-Object { Write-Host $_ }
  if ($funde.Count -gt 25) { Write-Host "  … und $($funde.Count - 25) weitere" }
  throw "Wortpruefung: $($funde.Count) Treffer — Build abgebrochen."
}

# ── 17c. Toter Kunden-Block raus (22.08.2026) ────────────────────────────────
# porscheCard()/porscheLive() trugen die einzigen sichtbaren Kundennamen im Auslieferstand
# ("Car Sales Value Stream", STE-Portal). Seit dem 25.08.2026 sind sie in der Quelle selbst
# geloescht (Benes Wunsch) — der Build muss dafuer nichts mehr tun. Bleibt der eine Aufruf,
# der wirklich laeuft: lotusLaden() holt die Kundenzahlen als vierten Promise; im Produkt gibt
# es weder das Portal noch die Adresse, der Zweig liefert also fest null.
# Die uebrigen porsche-Vorkommen sind reine Bezeichner (JIRA_PORSCHE_URL, D.porsche)
# ohne sichtbaren Text — die bleiben, Umbenennen waere ein eigener Umbau.
foreach ($tot in 'function porscheCard(', 'function porscheLive(') {
  if ($script:s.Contains($tot)) { throw "Kunden-Block: '$tot' ist zurueck in der Quelle — hier wieder entfernen." }
}
Rep "    (async()=>{ try{ const r=await fetch(PORSCHE_STE+'data/aggregated.json?t='+Date.now()); const d=await r.json(); return d&&d.vs?d:null; }catch(e){ return null; } })()," '    Promise.resolve(null), /* Kundenzahlen: im Produkt gibt es kein Kundenportal */' 'Kunden-Fetch in lotusLaden'
foreach ($wort in 'porscheCard','porscheLive','PORSCHE_STE','Car Sales','STE-Portal') {
  if ($script:s.Contains($wort)) { throw "Kunden-Block: '$wort' steht noch im Ergebnis." }
}

# ── 18. Schreiben ────────────────────────────────────────────────────────────
Write-Lf (Join-Path $Ziel 'index.html') $script:s

# Kennzahlenseite: die Quelle (kennzahlen.html im persoenlichen Ordner) ist ein
# Zwei-Marken-Traffic-Dashboard fuer unsere eigenen Websites — Wort fuer Wort
# neutralisiert kaeme dabei Unsinn heraus. Das Produkt bekommt deshalb eine
# eigene, schlanke Kennzahlenseite: was die Instanz wirklich zaehlt, plus die
# Transparenzliste der Quellen. Sie wird nicht gebaut, sondern mitgeliefert.
Write-Lf (Join-Path $Ziel 'kennzahlen.html') (Read-Utf8 (Join-Path $prod 'kennzahlen.html'))

# Produktschicht
foreach ($f in 'compass-produkt.js','compass-produkt.css','compass-app.js') {
  Write-Lf (Join-Path $Ziel $f) (Read-Utf8 (Join-Path $prod $f))
}

# Als App installierbar (04.09.2026): Manifest, Service Worker und Symbole.
# sw.js MUSS im Wurzelverzeichnis DIESES Builds liegen — ein Service Worker darf nur den
# Ordner bedienen, in dem er selbst liegt (Scope). Bei einer Instanz ist das seit dem
# 04.09.2026 nicht mehr die Subdomain, sondern compass\: der Compass bedient /compass/,
# das Portal an der Wurzel hat einen eigenen (produkt\portal\portal-sw.js).
foreach ($f in 'manifest.webmanifest','sw.js') {
  $t = Read-Utf8 (Join-Path $prod $f)
  # Die App-Kennung ist der Schluessel, unter dem ein Geraet eine installierte App
  # wiedererkennt. Sie muss zum Ort passen: an der Wurzel "/" (Demo), im Unterordner
  # "/compass/" — sonst haetten Portal und Compass dieselbe Kennung und das Geraet
  # hielte beide fuer dieselbe App.
  if ($instanzWurzel -and $f -eq 'manifest.webmanifest') { $t = $t.Replace('"id": "/"', '"id": "/compass/"') }
  Write-Lf (Join-Path $Ziel $f) $t
}
# Der Ordner heisst app-icons und NICHT icons: /icons/ ist in der Standard-Apache-
# Konfiguration ein Alias auf die Server-eigenen Verzeichnis-Symbole. Am 04.09.2026 lagen
# die Dateien nachweislich per FTP auf dem Server und lieferten trotzdem 404 — Apache
# schaute gar nicht erst im Dokumentenverzeichnis nach.
$iq = Join-Path $prod 'app-icons'; $iz = Join-Path $Ziel 'app-icons'
if (Test-Path $iq) {
  if (-not (Test-Path $iz)) { New-Item -ItemType Directory -Force $iz | Out-Null }
  Get-ChildItem $iq -File -Filter *.png | ForEach-Object { Copy-Item $_.FullName (Join-Path $iz $_.Name) -Force }
} else { throw "App-Symbole fehlen: $iq" }

# Selbst gehostete Schriften (VA-13512, 24.08.2026): fonts.css + die woff2-Dateien aus der Quelle.
# Ohne sie faellt die Seite auf Systemschriften zurueck — nie wieder auf fonts.googleapis.com.
Write-Lf (Join-Path $Ziel 'fonts.css') (Read-Utf8 (Join-Path $Quelle 'fonts.css'))
$fq = Join-Path $Quelle 'fonts'; $fz = Join-Path $Ziel 'fonts'
if (-not (Test-Path $fz)) { New-Item -ItemType Directory -Force $fz | Out-Null }
Get-ChildItem $fq -File -Filter *.woff2 | ForEach-Object { Copy-Item $_.FullName (Join-Path $fz $_.Name) -Force }

# Editier-Modus (24.08.2026): compass-edit.js haengt sich von aussen an die Seite und
# gehoert ins Produkt — Karten verschieben, Breite aendern, oben andocken ist genau das
# "alles ist bedienbar" der Demo. Die Datei traegt Eigennamen in Kommentaren und in den
# Standard-Dock-Schluesseln (STD_OBEN: '🤵 John'); dieselben Wortregeln wie oben machen
# daraus '🤵 Coach' — exakt der Kartentitel, den der Build in index.html erzeugt. Die
# Wortpruefung (18b) laeuft danach auch ueber diese Datei.
$edit = (Read-Utf8 (Join-Path $Quelle 'compass-edit.js')).Replace("`r`n","`n")
$edit = [Text.RegularExpressions.Regex]::Replace($edit, '\bJohns\b', 'Coach-')
$edit = [Text.RegularExpressions.Regex]::Replace($edit, '(?<![a-zA-Z])John(?![a-zA-Z])', 'Coach')
$edit = [Text.RegularExpressions.Regex]::Replace($edit, '\bVishnu\b', 'Team')
$edit = [Text.RegularExpressions.Regex]::Replace($edit, '\bBenes\b', 'ihren')
$edit = [Text.RegularExpressions.Regex]::Replace($edit, '\bBene\b',  'die Nutzerin')
Write-Lf (Join-Path $Ziel 'compass-edit.js') $edit

# Focus View (06.09.2026): compass-focus.js ist das zweite, schlanke Frontend — drei lernende
# Einstiegskacheln statt des vollen Rasters, fuer Leute, die keine Analytics-Menschen sind.
# Haengt sich wie compass-edit.js von aussen an; dieselben Wortregeln (John->Coach, Vishnu->Team),
# damit Kacheltitel und Woerterbuch-Schluessel zum Ergebnis der Seite passen. Wortpruefung unten.
$focus = (Read-Utf8 (Join-Path $Quelle 'compass-focus.js')).Replace("`r`n","`n")
$focus = [Text.RegularExpressions.Regex]::Replace($focus, '\bJohns\b', 'Coach-')
$focus = [Text.RegularExpressions.Regex]::Replace($focus, '(?<![a-zA-Z])John(?![a-zA-Z])', 'Coach')
$focus = [Text.RegularExpressions.Regex]::Replace($focus, '\bVishnu\b', 'Team')
$focus = [Text.RegularExpressions.Regex]::Replace($focus, '\bBenes\b', 'ihren')
$focus = [Text.RegularExpressions.Regex]::Replace($focus, '\bBene\b',  'die Nutzerin')
Write-Lf (Join-Path $Ziel 'compass-focus.js') $focus

# Live-Schicht (06.09.2026): compass-live.js — Reaktionsknoepfe an Postfach/Slack, Nachladen,
# Finanz-Verlauf. Haengt sich wie compass-edit.js von aussen an; ohne john-server tut sie nichts.
# Dieselben Wortregeln, damit die Wortpruefung unten sauber bleibt.
$live = (Read-Utf8 (Join-Path $Quelle 'compass-live.js')).Replace("`r`n","`n")
$live = [Text.RegularExpressions.Regex]::Replace($live, '\bJohns\b', 'Coach-')
$live = [Text.RegularExpressions.Regex]::Replace($live, '(?<![a-zA-Z])John(?![a-zA-Z])', 'Coach')
$live = [Text.RegularExpressions.Regex]::Replace($live, '\bVishnu\b', 'Team')
$live = [Text.RegularExpressions.Regex]::Replace($live, '\bBenes\b', 'ihren')
$live = [Text.RegularExpressions.Regex]::Replace($live, '\bBene\b',  'die Nutzerin')
Write-Lf (Join-Path $Ziel 'compass-live.js') $live

# Sprachen (28.08.2026): compass-i18n.js uebersetzt die fertig gerenderte Oberflaeche
# (Deutsch/English/Arabisch inkl. RTL). dashboard.html laedt sie im Kopf — fehlt sie,
# gibt es einen 404 und die Seite bleibt einsprachig. Die Woerterbuch-SCHLUESSEL sind
# der deutsche Quelltext: laufen ueber die Seite die Wortregeln (John->Coach, Vishnu->Team),
# muessen sie hier genauso laufen, sonst trifft kein Schluessel mehr. Die arabischen
# Markennamen werden mitgezogen, damit im Produkt auch dort nichts Persoenliches steht.
$i18n = (Read-Utf8 (Join-Path $Quelle 'compass-i18n.js')).Replace("`r`n","`n")
# Dieselben Eigennamen-Regeln wie fuer die Seite: die Woerterbuch-SCHLUESSEL sind der
# deutsche Quelltext der Seite — wird dort "Vishnu Artists" zu "Kontext 1", muss der
# Schluessel mitwandern, sonst greift kein Eintrag mehr. Achtung: Texte, die der Build
# eigens fuer die Demo umformuliert (Rep-Anker, z. B. "Offene Entscheidungen"), brauchen
# einen eigenen Wortlaut im Woerterbuch — compassSprache.luecken() in der Demo zeigt sie.
foreach ($p in $eigennamen) { $i18n = $i18n.Replace(($p[0] -replace "`r",''), ($p[1] -replace "`r",'')) }
# Dieselbe Ersetzung wie in der Seite — sonst hiesse der Schluessel im Woerterbuch weiter
# „… vaikuntha.eu …“, der Text auf dem Bildschirm aber „… projekt.example …“, und der Eintrag
# griffe nie. Schluessel und Seite muessen Wort fuer Wort dieselbe Wandlung durchlaufen.
$i18n = $i18n.Replace('vaikuntha.eu', 'projekt.example')
$i18n = [Text.RegularExpressions.Regex]::Replace($i18n, '\bJohns\b', 'Coach-')
$i18n = [Text.RegularExpressions.Regex]::Replace($i18n, '(?<![a-zA-Z])John(?![a-zA-Z])', 'Coach')
$i18n = [Text.RegularExpressions.Regex]::Replace($i18n, '\bVishnu\b', 'Team')
$i18n = [Text.RegularExpressions.Regex]::Replace($i18n, '\bVaikuntha\b', 'Projekt')
$i18n = [Text.RegularExpressions.Regex]::Replace($i18n, '\bPorsche\b',   'Kunde')
$i18n = [Text.RegularExpressions.Regex]::Replace($i18n, '\bBenes\b', 'ihren')
$i18n = [Text.RegularExpressions.Regex]::Replace($i18n, '\bBene\b',  'die Nutzerin')
$i18n = $i18n.Replace([char]0x0641 + [char]0x064A + [char]0x0634 + [char]0x0646 + [char]0x0648, [char]0x0627 + [char]0x0644 + [char]0x0641 + [char]0x0631 + [char]0x064A + [char]0x0642)   # Vishnu -> das Team
$i18n = $i18n.Replace([char]0x062C + [char]0x0648 + [char]0x0646, [char]0x0645 + [char]0x062F + [char]0x0631 + [char]0x0651 + [char]0x0628)                                        # John   -> Coach
$i18n = $i18n.Replace([char]0x0641+[char]0x0627+[char]0x064A+[char]0x0643+[char]0x0648+[char]0x0646+[char]0x062B+[char]0x0627, [char]0x0627+[char]0x0644+[char]0x0645+[char]0x0634+[char]0x0631+[char]0x0648+[char]0x0639)   # Vaikuntha -> das Projekt
$i18n = $i18n.Replace([char]0x0628+[char]0x0648+[char]0x0631+[char]0x0634+[char]0x0647, [char]0x0627+[char]0x0644+[char]0x0639+[char]0x0645+[char]0x064A+[char]0x0644)   # Porsche -> der Kunde
$i18n = $i18n.Replace([char]0x0628 + [char]0x064A + [char]0x0646 + [char]0x0647, [char]0x0627 + [char]0x0644 + [char]0x0645 + [char]0x0633 + [char]0x062A + [char]0x062E + [char]0x062F + [char]0x0650 + [char]0x0645)  # Bene -> die Nutzerin
Write-Lf (Join-Path $Ziel 'compass-i18n.js') $i18n

# Instanz + Datenschicht: Demo aus produkt\compass\demo, Kundeninstanz aus der Vorlage
if ($Instanz) {
  $inst = (Read-Utf8 (Join-Path $prod 'instanz.example.js')).Replace("Demo GmbH", $Instanz)
  $ziIn = Join-Path $Ziel 'instanz.js'
  if (Test-Path $ziIn) { Write-Host "instanz.js besteht bereits — bleibt unveraendert (nichts ueberschrieben)." }
  else { Write-Lf $ziIn $inst }
  foreach ($f in 'dashboard-data.js','rhythmus-data.js','kennzahlen-data.js') {
    $zi = Join-Path $Ziel $f
    if (Test-Path $zi) { Write-Host "$f besteht bereits — bleibt unveraendert." }
    else { Write-Lf $zi (Read-Utf8 (Join-Path $prod "demo\$f")) }
  }
} else {
  foreach ($f in 'instanz.js','dashboard-data.js','rhythmus-data.js','kennzahlen-data.js') {
    Write-Lf (Join-Path $Ziel $f) (Read-Utf8 (Join-Path $prod "demo\$f"))
  }
}

# ── 18b. Wortpruefung ueber ALLE ausgelieferten Dateien ──────────────────────
# Nicht nur die gebaute index.html: auch Kennzahlenseite, Produktschicht und die
# mitgelieferte Datenschicht duerfen nichts Persoenliches enthalten.
# Ausnahme instanz.js (31.08.2026, VA-13532): das ist die EINZIGE Datei, die wir je
# Kundin von Hand fuellen — dort stehen ihre Quellen. Ihre Jira-Adresse, ihre
# Trello-Boards und ihre Mailadresse sind dort kein Leck, sondern der Inhalt;
# bei Kundschaft, die unser Jira mitbenutzt (Vishnu-intern, VA-13529/VA-13532),
# faellt auch 'vishnuartists' zwangslaeufig an. Ohne diese Ausnahme scheitert
# jeder Rebau einer ausgefuellten Instanz an der eigenen Pruefung — und damit
# das Einspielen von Updates. Was auch dort nichts zu suchen hat, bleibt scharf:
# Bene, Vaikuntha, Porsche, John, benedikt.
$verbotenInstanz = @('\bBene\b','Vaikuntha','Porsche','benedikt','\bJohn\b')
$alleFunde = @()
Get-ChildItem $Ziel -File -Include *.html,*.js -Recurse | ForEach-Object {
  $alt = $script:verboten
  if ($_.Name -eq 'instanz.js') { $script:verboten = $verbotenInstanz }
  $alleFunde += Pruefe (Read-Utf8 $_.FullName) $_.Name
  $script:verboten = $alt
}
if ($alleFunde.Count) {
  Write-Host 'WORTPRUEFUNG FEHLGESCHLAGEN — Persoenliches in den Ausgabedateien:' -ForegroundColor Red
  $alleFunde | Select-Object -First 25 | ForEach-Object { Write-Host $_ }
  if ($alleFunde.Count -gt 25) { Write-Host "  … und $($alleFunde.Count - 25) weitere" }
  throw "Wortpruefung: $($alleFunde.Count) Treffer — Build abgebrochen."
}

# ── 19. Bericht ──────────────────────────────────────────────────────────────
Get-ChildItem $Ziel -File | Sort-Object Name | ForEach-Object {
  $b = [IO.File]::ReadAllBytes($_.FullName)
  $bom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB)
  $crlf = ([Text.Encoding]::UTF8.GetString($b)).Contains("`r`n")
  '{0,-24} {1,9:n0} B  BOM={2,-5} CRLF={3}' -f $_.Name, $_.Length, $bom, $crlf
}
Write-Host ''
Write-Host "Wortpruefung bestanden — kein Bene/Vishnu/Vaikuntha/Porsche im Ergebnis." -ForegroundColor Green
if ($Instanz) {
  Write-Host "Instanz '$Instanz' gebaut -> $Ziel"
  Write-Host 'Weiter: instanz.js ausfuellen (Name, Kontexte, Quellen, gate.hash), dann ausliefern. Routine: docs\compass-onboarding.md'
} else {
  Write-Host "Demo gebaut -> $Ziel"
  Write-Host 'Weiter: git status --short -> git add site/compass-demo -> git commit -> git push origin main'
  Write-Host 'Live danach: https://demo.vishnuartists.com/'
}
