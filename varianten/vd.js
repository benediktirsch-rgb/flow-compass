/* vd.js — gemeinsame Datenschicht der beiden Layout-Varianten (09.09.2026)

   Bene: „Bau mir 2 Varianten mit 2 unterschiedlichen Ansätzen." Damit der Vergleich etwas taugt,
   sehen beide dieselben echten Zahlen — geladen vom john-server (same-origin) und aus der
   Datenschicht des Compass. Keine erfundene Kachel, keine Platzhalterzahl: was eine Quelle nicht
   hergibt, sagt die Variante im Klartext (Regel 5 in CLAUDE.md).

   Die Prototypen SCHREIBEN NICHTS. Jede Taste zeigt nur, wie die Bedienung aussähe — sonst würde
   ein Layout-Versuch echte Entscheidungen, Freigaben oder Commits auslösen. */
(function(){
  const VD = window.VD = { roh:{}, fehler:[], stand:null };

  async function j(pfad, ms){
    try{
      const c=new AbortController(); const t=setTimeout(()=>c.abort(), ms||20000);
      const r=await fetch(pfad,{signal:c.signal,cache:'no-store'}); clearTimeout(t);
      if(!r.ok) return {__fehler:'HTTP '+r.status};
      return await r.json();
    }catch(e){ return {__fehler: e.name==='AbortError' ? 'zu langsam' : 'nicht erreichbar'}; }
  }
  const ok = o => o && !o.__fehler && o.ok !== false;
  const tage = iso => { if(!iso) return null; const d=(Date.now()-new Date(iso).getTime())/86400000; return isFinite(d)?Math.floor(d):null; };

  VD.laden = async function(){
    const [kal,postf,slack,fin,tri,wacht,sich,rout,git,ber,checkin,antw,jira] = await Promise.all([
      j('/api/kalender'), j('/api/postfach'), j('/api/slack'), j('/api/finanzen'), j('/api/trichter'),
      j('/api/wacht'), j('/api/sicherung'), j('/api/routinen'), j('/api/git',30000),
      j('/api/beraterrunde'), j('/api/checkin?limit=3'), j('/api/antworten'), j('/api/jira/meine',40000)
    ]);
    VD.roh = {kal,postf,slack,fin,tri,wacht,sich,rout,git,ber,checkin,antw,jira};
    VD.stand = new Date();
    VD.fehler = [];
    const merk=(name,o)=>{ if(!ok(o)) VD.fehler.push(name+' — '+((o&&(o.__fehler||o.hint||o.error))||'ohne Antwort')); };
    merk('Kalender',kal); merk('Postfach',postf); merk('Slack',slack); merk('Finanzen',fin);
    merk('Trichter',tri); merk('Seiten-Wächter',wacht); merk('Sicherungen',sich); merk('Routinen',rout);
    merk('Freigaben (git)',git); merk('Beraterrunde',ber);

    VD.tag        = tagBauen(kal, checkin);
    VD.entscheid  = entscheidungen(fin, ber, tri, git, antw);
    VD.wartende   = wartende(postf, slack, tri);
    VD.geld       = geld(fin);
    VD.systeme    = systeme(wacht, sich, rout);
    VD.beratung   = beratung(ber);
    VD.arbeit     = arbeit(jira);
    return VD;
  };

  /* ---------- Der Tag: was heute zählt, was der Kalender dazu sagt ---------- */
  function tagBauen(kal, checkin){
    const c = ok(checkin) ? (checkin.checkins||[]).find(x=>x.art==='morgen'||x.art==='abend') : null;
    const t = {
      eine: (c && (c.fokus || c.auftrag)) || null,
      eineArt: c ? (c.art==='morgen'?'aus dem Morgencheck':'aus dem Abendcheck') : null,
      eineWann: c ? c.datum : null,
      termine: [], frei: null, naechster: null, fehler: ok(kal)?null:'Kalender '+((kal&&kal.__fehler)||'ohne Antwort')
    };
    if(ok(kal)){
      const heute = (kal.kalender||[]).find(d=>d.heute) || (kal.kalender||[])[0] || null;
      t.termine   = heute ? (heute.termine||[]) : [];
      t.frei      = heute && heute.freiStunden!=null ? heute.freiStunden : null;
      t.belegt    = heute && heute.belegtStunden!=null ? heute.belegtStunden : null;
      t.naechster = kal.naechster || null;
    }
    return t;
  }

  /* ---------- Alles, was ein Ja/Nein von Bene braucht — aus vier Quellen in einen Stapel ----------
     Genau das war der Anlass: Johns Schlussfrage aus der Beraterrunde stand da und ließ sich nicht
     beantworten. Sie ist kein Sonderfall, sondern eine von vielen offenen Entscheidungen. */
  function entscheidungen(fin, ber, tri, git, antw){
    const out=[];
    const beantwortet = (ok(antw) && antw.antworten) ? antw.antworten : {};

    /* 1 · Rückfragen aus rhythmus-data.js (die Datei liegt als <script> in der Seite) */
    const R = window.RHYTHM || null;
    if(R && R.rueckfragen){
      for(const q of R.rueckfragen){
        if(beantwortet[q.id]) continue;
        out.push({ id:q.id, quelle:'Rückfrage', ic:'💬', titel:q.frage, wer:q.projekt,
                   warum:q.warum, optionen:q.optionen||['Ja','Nein'], alter:tage(q.wann) });
      }
    }
    /* 2 · Johns Schlussfrage aus der letzten Beraterrunde */
    const r = ok(ber) ? (ber.runden||[])[0] : null;
    if(r){
      const beitr=r.beitraege||[];
      const schonBeantwortet = beitr.some(b=>b.wer!=='John'&&b.wer!=='Madeleine');
      const letzterJohn = beitr.filter(b=>b.wer==='John').pop();
      const frage = letzterJohn ? (String(letzterJohn.text||'').split('\n').map(z=>z.replace(/\*\*/g,'').trim())
                    .filter(z=>z&&z.includes('?')).pop()||'') : '';
      if(frage && !schonBeantwortet){
        out.push({ id:'beraterrunde', quelle:'Beraterrunde', ic:'🤝', titel:frage, wer:r.thema,
                   warum:(beitr.map(b=>b.wer+': '+b.text).join('\n\n')), optionen:['Ja','Nein'], alter:null });
      }
    }
    /* 3 · Entscheidungen aus dem Strategiepapier, für die noch keine eigene Stimme vorliegt.
       „Meine Stimme“ steht unter dem Klarnamen aus `fin.ich` — wer dort steht, hat entschieden. */
    if(ok(fin) && fin.entscheidungen){
      for(const e of fin.entscheidungen){
        if(e.stimmen && fin.ich && e.stimmen[fin.ich] && e.stimmen[fin.ich].wahl!=null) continue;
        out.push({ id:'fin-'+(e.id||e.nr), quelle:'Finanzen', ic:'💶', titel:e.frage||e.titel||('Entscheidung '+e.id),
                   wer:'Strategiepapier · '+(e.id||''), warum:e.warum||'', optionen:e.optionen||['Ja','Nein'], alter:null });
      }
    }
    /* 4 · Menschen, die auf eine Freigabe warten (Trichter) und Pakete, die auf Freigabe warten (git) */
    if(ok(tri)){
      for(const w of (tri.wartende||[]).filter(x=>x.bahn==='ankommen')){
        out.push({ id:'zugang-'+(w.id||w.mail), quelle:'Zugang', ic:'🔐', titel:(w.name||w.mail)+' wartet auf die Freigabe',
                   wer:'vaikuntha.eu · seit '+(w.tage!=null?w.tage+' Tagen':'unbekannt'), warum:'', optionen:['Freigeben','Ablehnen'], alter:w.tage });
      }
    }
    if(ok(git)){
      for(const p of (git.pakete||[])){
        out.push({ id:'git-'+p.repo+'-'+p.paket, quelle:'Freigabe', ic:'📦', titel:(p.titel||p.paket)+' — '+p.repo,
                   wer:(p.dateien!=null?p.dateien+' Dateien':'')+(p.ziel?' · '+p.ziel:''), warum:p.ziel||'', optionen:['Freigeben','Später'], alter:null });
      }
    }
    out.sort((a,b)=>(b.alter||0)-(a.alter||0));
    return out;
  }

  /* ---------- Menschen, die auf eine Antwort warten — drei Kanäle, eine Liste ---------- */
  function wartende(postf, slack, tri){
    const out=[];
    if(ok(postf)) for(const m of (postf.wartend||[]))
      out.push({kanal:'Mail', ic:'📬', wer:m.von, worum:m.worum, tage:m.tage, url:m.url});
    if(ok(slack)) for(const s of (slack.wartend||[]))
      out.push({kanal:'Slack', ic:'💬', wer:s.von+' · '+s.kanal, worum:s.worum, tage:s.tage, url:s.url});
    if(ok(tri)) for(const w of (tri.wartende||[]).filter(x=>x.bahn!=='ankommen'))
      out.push({kanal:'Pool', ic:'🧑‍🤝‍🧑', wer:w.name||w.mail, worum:(w.stufe||'')+(w.rolle?' · '+w.rolle:''), tage:w.tage, url:null});
    out.sort((a,b)=>(b.tage||0)-(a.tage||0));
    return out;
  }

  /* Die Zahlen liegen flach in der Antwort (nicht unter `kpi`), die Belege als {offen,gesamt}. */
  function geld(fin){
    if(!ok(fin)) return {fehler:(fin&&(fin.hint||fin.__fehler))||'keine Antwort'};
    return { kontostand:fin.kontostand, deckung:fin.deckung, ergebnis:fin.ergebnis,
             belege:(fin.belege&&fin.belege.offen!=null)?fin.belege.offen:null,
             belegeGesamt:(fin.belege&&fin.belege.gesamt!=null)?fin.belege.gesamt:null,
             stand:fin.stichtag||fin.stand, monat:fin.monat, fristen:fin.fristen||[],
             verlauf:fin.verlauf||[], fehler:null };
  }

  function systeme(wacht, sich, rout){
    const s=[];
    if(ok(wacht)){
      const seiten=wacht.seiten||[]; const kaputt=seiten.filter(x=>!x.ok&&!x.geschuetzt);
      const zert=seiten.map(x=>x.zertTage).filter(x=>x!=null).sort((a,b)=>a-b)[0];
      s.push({ name:'Seiten', ic:'🌐', wert:kaputt.length?kaputt.length+' mit Störung':seiten.length+' erreichbar',
               stufe:kaputt.length?'rot':'gruen', detail:seiten.map(x=>x.name+' · '+(x.ok?x.status+' · '+x.ms+' ms':'Störung: '+(x.fehler||x.status))),
               nebensatz: zert!=null ? 'nächstes Zertifikat läuft in '+zert+' Tagen ab' : '' });
    } else s.push({name:'Seiten', ic:'🌐', wert:'nicht geprüft', stufe:'grau', detail:[(wacht&&wacht.__fehler)||'keine Antwort']});
    if(ok(sich)){
      const alt=sich.aeltesteStunden!=null?sich.aeltesteStunden:sich.aelteste;
      s.push({ name:'Sicherungen', ic:'🗄️', wert:alt!=null?('älteste Kopie '+Math.round(alt)+' h alt'):'geprüft',
               stufe:(alt!=null&&alt>24)?'gelb':'gruen', detail:[(sich.ohneSpiegelNamen||[]).length?('ohne Spiegel: '+sich.ohneSpiegelNamen.join(', ')):'jeder Ordner hat eine zweite Kopie'] });
    } else s.push({name:'Sicherungen', ic:'🗄️', wert:'nicht geprüft', stufe:'grau', detail:[(sich&&(sich.error||sich.__fehler))||'keine Antwort']});
    if(ok(rout)){
      const z=rout.zusammenfassung||{};
      s.push({ name:'Routinen', ic:'🔁', wert:(z.ok||0)+' von '+(z.gesamt||0)+' liefen',
               stufe:(z.stumm||z.nie)?'gelb':'gruen',
               detail:[(z.stumm?z.stumm+' stumm':'')+(z.nie?(z.stumm?', ':'')+z.nie+' nie gelaufen':'')||'alle melden sich',
                       (z.namen||[]).length?('zuletzt auffällig: '+z.namen.join(', ')):''].filter(Boolean) });
    } else s.push({name:'Routinen', ic:'🔁', wert:'nicht geprüft', stufe:'grau', detail:[(rout&&rout.__fehler)||'keine Antwort']});
    return s;
  }

  /* Arbeit: was wirklich läuft (WIP), was seit über 90 Tagen liegt, was fällig ist.
     Die Gesamtzahl offener Vorgänge ist bewusst nicht die Hauptzahl — sie sagt nichts über heute. */
  function arbeit(jira){
    if(!ok(jira)) return {fehler:(jira&&(jira.hint||jira.__fehler))||'keine Antwort', inArbeit:[], liegt:[], faellig:[]};
    const alle=(jira.issues||[]);
    const inArbeit = alle.filter(x=>x.kategorie==='indeterminate');
    const heute=Date.now();
    const liegt = alle.filter(x=>x.aktiv && (heute-new Date(x.aktiv).getTime())/86400000 > 90);
    const faellig = alle.filter(x=>x.due && (new Date(x.due).getTime()-heute)/86400000 <= 3);
    return {fehler:null, gesamt:alle.length, inArbeit, liegt, faellig, alle};
  }

  function beratung(ber){
    const r = ok(ber) ? (ber.runden||[])[0] : null;
    return { anzahl: ok(ber)?(ber.anzahl||0):0, runde:r,
             fehler: ok(ber)?null:((ber&&ber.__fehler)||'keine Antwort') };
  }

  VD.hilfe = { ok, tage };
})();
