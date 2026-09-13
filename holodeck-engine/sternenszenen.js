// Sternenkarte im Holodeck (13.09.2026). Liest Benes Landkarte zur Laufzeit: /landkarte.js an der
// Wurzel der Brücke setzt window.LANDKARTE (publish-compass.ps1 kopiert sie dorthin, john-server.ps1
// liefert sie lokal aus dem Skill nordstern-landkarte). Fehlt die Datei, bleibt die Liste leer —
// keine Beispielsterne, keine Platzhalter. Regie: ~/.claude/skills/nordstern-landkarte/astra-holodeck.md.
const text=v=>v==null?'':typeof v==='object'?String(v.de||v.en||''):String(v);
const ortJeStern={befaehigen:'bar',vishnu:'anden',frei:'rom',gesund:'huette',zeit:'goa',vaikuntha:'huette'};
const standWort={laeuft:'läuft',offen:'offen',wackelt:'wackelt',steht:'steht',erreicht:'erreicht',idee:'Idee, noch nicht beschlossen'};
const standRang={wackelt:0,steht:1,offen:2,laeuft:3,idee:4,erreicht:5};
export function loadLandkarte(timeout=4000){
  if(window.LANDKARTE?.sterne)return Promise.resolve(window.LANDKARTE);
  return new Promise(resolve=>{
    let settled=false;
    const done=()=>{if(settled)return;settled=true;clearTimeout(timer);script.remove();resolve(window.LANDKARTE?.sterne?window.LANDKARTE:null);};
    const script=document.createElement('script');script.src='/landkarte.js';script.async=true;
    const timer=setTimeout(done,timeout);
    script.onload=done;script.onerror=done;document.head.append(script);
  });
}
function zielListe(stern){
  return (stern.ziele||[]).map(z=>({...z,rang:standRang[z.stand]??3}));
}
function naechsteSchritte(stern){
  const ziele=zielListe(stern).sort((a,b)=>a.rang-b.rang);
  const schritte=[];
  for(const ziel of ziele){
    for(const ini of ziel.initiativen||[]){
      for(const projekt of ini.projekte||[]){
        if(!projekt.naechster)continue;
        schritte.push({ziel:text(ziel.titel),projekt:text(projekt.titel),schritt:text(projekt.naechster),wer:text(ini.verantwortlich)||'nicht benannt',jetzt:typeof projekt.jetzt==='number'?projekt.jetzt:projekt.jetzt?1:99,stand:projekt.stand});
      }
    }
  }
  return schritte.sort((a,b)=>a.jetzt-b.jetzt).slice(0,3);
}
function spannungenZu(karte,stern){
  const woerter=(text(stern.kurz)+' '+text(stern.titel)).toLowerCase().split(/[^a-zäöüß]+/).filter(w=>w.length>4);
  return (karte.spannungen||[]).filter(sp=>Array.isArray(sp.sterne)?sp.sterne.includes(stern.id):woerter.some(w=>(text(sp.satz)+' '+text(sp.regel)).toLowerCase().includes(w)));
}
function sternPrompt(karte,stern,szene,ort,places,an){
  const nord=karte.nordstern||{},teile=[];
  teile.push('Sternenkarte im Holodeck. Wir sind in '+(places[ort]||ort)+'. Über uns steht der Nordstern „'+text(nord.kurz||nord.titel)+'“'+(nord.satz?' — '+text(nord.satz).replace(/[.!?]\s*$/,''):'')+'. Heute leuchtet der Mini-Nordstern „'+(stern.icon?stern.icon+' ':'')+text(stern.titel)+'“.');
  teile.push(an==='beide'?'Ihr sprecht beide: John über Menschen, Initiativen, Rhythmus und Gesundheit, Madeleine über Finanzen, Grenzen zwischen den Töpfen und Organisation. Madeleine darf John widersprechen.':an==='madeleine'?'Madeleine führt dieses Gespräch (Finanzen, Grenzen zwischen den Töpfen, Organisation). John ergänzt nur, wenn es um Menschen oder Rhythmus geht.':'John führt dieses Gespräch (Menschen, Initiativen, Rhythmus, Gesundheit). Madeleine ergänzt nur, wenn es um Geld oder Organisation geht.');
  if(Array.isArray(karte.prinzipien)&&karte.prinzipien.length)teile.push('Leitplanken, die bei Konflikten entscheiden: '+karte.prinzipien.map(text).join(' · ')+'.');
  const kennzeichen=(stern.kennzeichen||[]).map(k=>text(k.was)+': Ziel '+text(k.ziel)+(k.quelle?' (Quelle: '+text(k.quelle)+')':''));
  teile.push('1. Ankommen in zwei Sätzen, dann die Lage: '+text(stern.satz)+(kennzeichen.length?' Kennzeichen: '+kennzeichen.join('; ')+'.':'')+' Nennt nur diese Werte und rechnet nichts dazu.');
  const ziele=zielListe(stern).sort((a,b)=>a.rang-b.rang).map(z=>text(z.titel)+' ('+(standWort[z.stand]||text(z.stand)||'offen')+(z.bis?', bis '+text(z.bis):'')+(z.messung?', Maß: '+text(z.messung):'')+')');
  if(ziele.length)teile.push('2. Was wackelt — die Ziele in dieser Reihenfolge, wackelnde und stehende zuerst: '+ziele.join('; ')+'.');
  const schritte=naechsteSchritte(stern);
  if(schritte.length)teile.push('3. Der nächste Schritt: '+schritte.map(s=>'„'+s.schritt+'“ ('+s.projekt+', Ziel: '+s.ziel+') — verantwortlich: '+s.wer).join('; ')+'.');
  else teile.push('3. In der Karte steht für diesen Stern noch kein nächster Schritt. Sagt das offen und fragt mich, welcher es sein soll.');
  const spannungen=spannungenZu(karte,stern);
  if(spannungen.length)teile.push('4. Spannung ansprechen: '+spannungen.map(sp=>text(sp.satz)+' Regel: '+text(sp.regel)).join(' ')+' Fragt mich, ob die Regel noch gilt.');
  teile.push((spannungen.length?'5':'4')+'. Am Ende stellt ihr mir genau eine Ja/Nein-Frage: „'+text(szene.frage)+'“ Formuliert Zustimmen und Ablehnen als ganze Sätze mit ihren Folgen, wie in der Beraterrunde.');
  teile.push('Punkte mit Stand „Idee“ sind Vorschläge von Claude und nicht beschlossen — behandelt sie nie als Beschluss. Erfindet keine Zahlen, keine Termine und keine Ereignisse.');
  return teile.join(' ');
}
export function sternThemen(karte,places={}){
  const szenen=karte?.holodeck?.szenen;
  if(!Array.isArray(szenen)||!szenen.length)return [];
  const sterne=Array.isArray(karte.sterne)?karte.sterne:[];
  return szenen.map((szene,i)=>{
    const stern=sterne.find(s=>s.id===szene.stern);
    if(!stern||!szene.frage)return null;
    const ort=places[szene.ort]?szene.ort:(ortJeStern[szene.stern]||'bar');
    const wer=(Array.isArray(szene.wer)?szene.wer:[]).map(w=>String(w).toLowerCase());
    const an=wer.includes('john')&&wer.includes('madeleine')?'beide':wer.includes('madeleine')?'madeleine':'john';
    const title=(stern.icon?stern.icon+' ':'')+text(stern.kurz||stern.titel);
    return {id:'stern-'+szene.stern+'-'+i,stern:szene.stern,ort,an,title,frage:text(szene.frage),
      source:'Sternenkarte · '+text(stern.titel)+(karte.stand?' · Stand '+text(karte.stand):''),
      himmel:{nordstern:text(karte.nordstern?.kurz||karte.nordstern?.titel),stern:title},
      prompt:sternPrompt(karte,stern,szene,ort,places,an)};
  }).filter(Boolean);
}
