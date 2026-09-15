// Adapts the existing single-coach API. Sessions live in memory only.
// Abort stops reception of an answer, not the server-side Claude process.
export function createCoachDoor(base, fetcher = fetch) {
  const url = new URL(base);
  if (url.protocol !== 'https:') throw new Error('Der Wolken-Coach benötigt HTTPS.');
  base = base.replace(/\/$/, '');
  const rooms = new Map(); let healthAt = 0;
  async function health() {
    if (Date.now() - healthAt < 20000 || [...rooms.values()].some(r => r.job)) return;
    const response = await fetcher(base + '/api/john/status', {credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error('Der Wolken-Coach ist nicht bereit.');
    if (data.backend === 'cli' && data.login?.ok !== true) throw new Error('Der Wolkenserver läuft, aber die Claude-Anmeldung fehlt noch (NO_LOGIN).');
    healthAt = Date.now();
  }
  function append(room, wer, text) {
    room.zuege.push({zug:room.zuege.length+1,wer,text,zeit:new Date().toISOString(),weitergeben:true});
  }
  function run(room, text) {
    const controller = new AbortController(); const job = {controller,seit:new Date().toISOString()}; room.job = job;
    const timeout = setTimeout(() => controller.abort(), 450000);
    const messages = room.zuege.filter(t => ['bene','john'].includes(t.wer) && t.weitergeben)
      .map(t => ({role:t.wer==='bene'?'user':'assistant',content:t.text}));
    while(messages.length && messages[0].role!=='user')messages.shift();
    fetcher(base+'/api/john', {method:'POST',credentials:'omit',signal:controller.signal,
      headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,context:'Holodeck-Coaching mit John. Antworte gesprächsnah und kurz, stelle eine Frage auf einmal. Keine zweite unabhängige KI darstellen.'})})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || typeof data.text !== 'string' || !data.text.trim()) throw Error(data.error === 'NO_LOGIN' ? 'NO_LOGIN' : 'Keine bestätigte Coach-Antwort erhalten.');
        if(room.job===job) append(room,'john',data.text);
      }).catch(error => {
        if(room.job===job) append(room,'system',error.message==='NO_LOGIN' ? 'Die Claude-Anmeldung auf dem Wolkenserver fehlt. Die Nachricht wird nicht automatisch wiederholt.' : 'Keine Antwort bestätigt. Der Server kann noch arbeiten. Die Nachricht wird nicht automatisch wiederholt.');
      }).finally(() => {clearTimeout(timeout);if(room.job===job)room.job=null;});
  }
  return {
    async request(path, body) {
      const parsed = new URL(path,'https://room.invalid');
      if(parsed.pathname==='/raeume') {await health();return {raeume:[...rooms.values()].map(r=>({id:r.id,thema:r.thema,zuletzt:r.zuege.at(-1)?.zeit,laeuft:!!r.job}))};}
      if(parsed.pathname==='/raum' && body) {
        if(body.an!=='john') throw Error('Auf diesem Anschluss ist derzeit nur John verfügbar.');
        let room = body.id ? rooms.get(body.id) : null;
        if(body.id && !room) throw Error('Diese Sitzung ist nicht mehr verfügbar.');
        if(room?.job) throw Error('Bitte den laufenden Gesprächszug abwarten.');
        if(!room){room={id:crypto.randomUUID(),thema:body.thema||'Coaching',zuege:[],job:null};rooms.set(room.id,room);}
        const text=String(body.text||'').trim();if(!text || text.length>8000)throw Error('Bitte eine Nachricht bis 8000 Zeichen eingeben.');
        append(room,'bene',text);run(room,text);return {id:room.id,wartet:false};
      }
      const room = rooms.get(body?.id || parsed.searchParams.get('id'));
      if(!room) throw Error('Diese Sitzung ist nicht mehr verfügbar.');
      if(parsed.pathname==='/raum')return {zuege:room.zuege,laeuft:room.job?{an:'john',seit:room.job.seit}:null,wartet:[]};
      if(parsed.pathname==='/raum/weitergeben') {
        const turn=room.zuege.find(t=>t.zug===body.zug);
        if(!turn)throw Error('Beitrag nicht gefunden.');
        turn.weitergeben=body.weitergeben===true;return {weitergeben:turn.weitergeben};
      }
      if(parsed.pathname==='/stopp') {
        if(room.job){const job=room.job;room.job=null;job.controller.abort();append(room,'system','Empfang der Antwort beendet. Ein serverseitiger Modellstopp ist an diesem Anschluss nicht verfügbar.');}
        return {gestoppt:false,serverStopUnavailable:true};
      }
      throw Error('Diese Funktion ist am Wolken-Coach noch nicht verfügbar.');
    },
    dispose(){for(const room of rooms.values()){const job=room.job;room.job=null;job?.controller.abort();}rooms.clear();}
  };
}
