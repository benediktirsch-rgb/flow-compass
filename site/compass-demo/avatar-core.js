(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AvatarCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const options=[
    ['freunde','Freunde','Verbindung','Schreibe einer Person, mit der du heute sprechen möchtest.'],
    ['familie','Familie','Fürsorge','Vereinbare zehn Minuten gemeinsame Zeit ohne Handy.'],
    ['gesellschaft','Gesellschaft / Engagement','Beitrag','Wähle eine kleine hilfreiche Handlung für einen anderen Menschen.'],
    ['energie','Energetischer Abend','Lebendigkeit','Wähle Musik, Tanz oder eine aktive Unternehmung passend zu deiner Kraft.'],
    ['ruhe','Runterkommen / Lowdown','Maßhalten','Schaffe dir zehn ruhige Minuten ohne neue Verpflichtung.'],
    ['sport','Sport','Körper','Wähle eine Bewegung, die heute zu deiner Energie passt.'],
    ['natur','Draußen / Spaziergang','Achtsamkeit','Plane einen kurzen Weg nach draußen.'],
    ['yoga','Yoga / Dehnen','Achtsamkeit','Nimm dir eine sanfte, vertraute Übung vor.'],
    ['lesen','Lesen / Musik','Neugier','Lege ein Buch oder ein Musikstück für deinen Abend bereit.'],
    ['kreativ','Kreativität','Ausdruck','Gib einer kleinen eigenen Idee zehn Minuten Raum.'],
    ['spirituell','Stille / spirituelle Praxis','Bewusstheit','Wähle eine freiwillige stille Praxis, die dir vertraut ist.'],
    ['schlaf','Früh schlafen','Selbstfürsorge','Lege eine realistische Zeit fest, ab der du zur Ruhe kommen möchtest.'],
    ['pause','Heute nichts / bewusst Pause','Maßhalten','Lass heute eine zusätzliche Anforderung bewusst weg.']
  ].map(([id,label,definition,next])=>({id,label,definition,next}));
  const empty=()=>({schema:1,revision:0,values:'',definition:'',directness:'klar',spirituality:'offen',influences:{john:'',madeleine:''},custom:[],favorites:[],ratings:{},events:[]});
  function catalog(p){return options.concat(p.custom||[]).map(o=>({...o,next:o.next||'Wähle für „'+o.label+'“ einen kleinen, heute machbaren Schritt.'}));}
  function ranked(p,now=Date.now()){
    const score=o=>(p.favorites||[]).includes(o.id)?1000:0;
    const scores=new Map(catalog(p).map(o=>[o.id,score(o)]));
    for(const e of p.events||[]){const age=Math.max(0,(now-Date.parse(e.at))/86400000);if(!Number.isFinite(age))continue;const weight=e.status==='erledigt'?2:e.status==='ausgelassen'?0:.5;scores.set(e.id,(scores.get(e.id)||0)+(weight+(e.effect==='gut'?1:0))*Math.pow(.5,age/14));}
    return catalog(p).map((o,i)=>({...o,score:scores.get(o.id)||0,index:i})).sort((a,b)=>b.score-a.score||a.index-b.index);
  }
  function feedback(o,p){
    const past=(p.events||[]).filter(e=>e.id===o.id&&e.status==='erledigt').at(-1);
    const memory=past?.effect==='gut'?' Das hat dir beim letzten bestätigten Mal gutgetan.':past?.effect==='anstrengend'?' Das war zuletzt anstrengend; halte den Schritt heute kleiner.':'';
    return {madeleine:(o.id==='pause'?'Eine bewusste Pause darf heute passen.':'„'+o.label+'“ kann heute Raum bekommen.')+memory,john:o.next,next:o.next};
  }
  function resolve(master,p,avatar){return {masterVersion:master.version,role:master[avatar].role,voice:master[avatar].voice,personal:{directness:p.directness,spirituality:p.spirituality,influences:p.influences?.[avatar]||''},origins:{role:'Master',voice:'Master',directness:'Persönliches Profil',spirituality:'Persönliches Profil',influences:'Persönliches Profil'}};}
  return {options,empty,catalog,ranked,feedback,resolve};
});
