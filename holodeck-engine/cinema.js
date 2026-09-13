// Cinematic photographic scene direction. Video may be supplied explicitly later;
// image pans are not presented as recorded performance or character locomotion.
import {anchorsFor,directionFor,safeMediaURL} from './studio-direction.js';
import {createStudioAudio} from './studio-audio.js';
import {scenes} from './scenes.js';
import {voiceDirection,musicDirection,mixDirection,moodMusic} from './production.js';
import {loadLandkarte,sternThemen} from './sternenszenen.js';
export function mountHolodeck(host,options={}) {
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  const defaultShots={bar:'scene-02',huette:'scene-07',goa:'scene-13',anden:'scene-19',rom:'scene-25'};
  const base=new URL('../holodeck-assets/',import.meta.url).href;
  const root=make('section','cinema');root.setAttribute('aria-label','Vaikuntha Filmszenen');host.replaceChildren(root);
  const screen=make('div','cinema-screen'),focusRig=make('div','cinema-focus-rig'),camera=make('div','cinema-camera'),frame=make('img','cinema-frame');
  frame.alt='Picard empfängt Dich am Eingang zum Holodeck';frame.decoding='async';frame.src=base+'cinema-welcome.webp';
  camera.append(frame);focusRig.append(camera);screen.append(focusRig);root.append(screen);
  const focusShade=make('div','cinema-focus-shade');screen.append(focusShade);
  const people=make('div','cinema-people');camera.append(people);
  const subtitles=make('div','cinema-subtitles');subtitles.setAttribute('aria-live','off');subtitles.hidden=true;screen.append(subtitles);
  const shade=make('div','cinema-shade');screen.append(shade);
  const brand=make('div','cinema-brand');brand.append(make('span','','VAIKUNTHA'),make('small','','Ein guter Ort für das Wesentliche.'));screen.append(brand);
  const chapter=make('span','cinema-chapter','01 / ANKOMMEN');screen.append(chapter);
  const welcome=make('div','cinema-welcome');welcome.append(make('span','cinema-eyebrow','JEAN-LUC PICARD · KI-GASTGEBER'),make('h3','','Schön, dass Du da bist, Bene.'),make('p','','John und Madeleine sind schon da. Komm herein. Wir beginnen mit dem, was heute zählt.'));
  const hostLabel=make('label','cinema-host-voice'),hostVoice=make('input','');hostVoice.type='checkbox';hostLabel.append(hostVoice,document.createTextNode(' Begrüßung mit Stimme'));
  const enter=make('button','cinema-primary','Eintreten & Gespräch beginnen'),explore=make('button','cinema-secondary','Erst einmal ankommen');enter.type=explore.type='button';welcome.append(hostLabel,enter,explore);screen.append(welcome);
  const caption=make('p','cinema-caption');caption.setAttribute('role','status');screen.append(caption);
  const controls=make('div','cinema-controls');controls.hidden=true;
  const still=make('button','','Kamerabewegung pausieren'),overview=make('button','','Zurück zum Empfang');still.type=overview.type='button';controls.append(still,overview);screen.append(controls);
  const meta=make('div','cinema-meta'),resolution=make('span','','Der Empfang'),speaking=make('span','','John & Madeleine');meta.append(resolution,speaking);root.append(meta);
  const audioToggle=make('button','','Raumklang einschalten');audioToggle.type='button';audioToggle.setAttribute('aria-pressed','false');
  const audioPanel=make('details','cinema-audio');audioPanel.append(make('summary','','Klang & Mischung'));
  const audioControls=make('div','cinema-audio-controls');audioControls.append(audioToggle);
  const audio=createStudioAudio((enabled,message)=>{audioToggle.textContent=enabled?'Raumklang ausschalten':'Raumklang einschalten';audioToggle.setAttribute('aria-pressed',String(enabled));if(message)caption.textContent=message;});
  for(const [labelText,initial,max,setter] of [['Raumlautstärke',45,80,v=>audio.setVolume(v/100)],['Musik',40,70,v=>audio.setMusic(v/100)]]){
    const label=make('label','',labelText),slider=make('input','');slider.type='range';slider.min='0';slider.max=String(max);slider.value=String(initial);slider.setAttribute('aria-label',labelText);slider.addEventListener('input',()=>setter(Number(slider.value)));label.append(slider);audioControls.append(label);
  }
  audioToggle.addEventListener('click',()=>audio.getState().enabled?audio.stop():audio.start());
  audioPanel.append(audioControls,make('small','','Dezenter Raumklang und eigene instrumentale Klangfolge. Unter Sprache wird die Mischung leiser.'));root.append(audioPanel);
  const mediaInfo=make('details','cinema-media-info');mediaInfo.append(make('summary','','Über diese Szene'));const mediaFacts=make('p','');mediaInfo.append(mediaFacts);root.append(mediaInfo);
  const story=make('div','cinema-story');story.hidden=true;root.append(story);
  const topics=[
    {title:'Das gemeinsame Haus für Deine KIs',source:'john-agent 9542790 · Madeleine c63893c',prompt:'Beginnt direkt mit unserem gemeinsamen Haus für John und Madeleine. Git-Stand 11.09.2026: Der lokale Gesprächsraum und Stoppen funktionieren; offen sind laut john-agent/docs/stand.md das Zusammenführen von john-ki.ps1 und Cockpit-Code sowie Takt-Funde im Stapel. Madeleine c63893c bestätigt bereits den Einbau des Gesprächsraums; ihre ältere Stand-Datei ist hier überholt. Welche Entscheidung bringt uns jetzt am meisten weiter? Stellt mir eine konkrete Frage.'},
    {title:'Vaikuntha: Menschen zusammenbringen',source:'Vereinsrepo 3614506 · 4a215bf',prompt:'Beginnt bei Vaikuntha als Verein, getrennt von Vishnu Artists. Git-Stand 11.09.2026: Eigener Vereins-Compass; Commit 3614506 betrifft verlegte Termine und Goa-Trip 1.3.0 mit Untergruppen und Frist 01.11. Prüft vor konkreten Terminbehauptungen die aktuelle Quelle. Welche organisatorische Entscheidung sollten wir zuerst treffen? Keine Mitgliederzahlen erfinden. Stellt mir eine konkrete Frage.'},
    {title:'Ein Holodeck, das sich nach Leben anfühlt',source:'Benes aktueller Auftrag · 11.09.2026',prompt:'Mein Ziel ist ein filmisches Holodeck mit hochglänzenden fotografischen Szenen, erkennbaren Charakteren, passenden mehrsprachigen Stimmen und einem roten Faden bis zu echten Entscheidungen. Einfache 3D-Figuren sind ausdrücklich verworfen. Die Bildwelt ist vorbereitet; echte Video- und Premium-Dialogstimmen-Engines fehlen noch. Was sollten wir als Nächstes konkret anschließen? Stellt mir eine Frage.'}
  ];
  story.append(make('span','cinema-eyebrow','02 / VERSTEHEN'),make('h4','','Was nehmen wir uns heute vor?'),make('small','','Vorschläge aus Git und Deinem Auftrag · Stand 11.09.2026'));
  const topicList=make('div','cinema-topics');
  for(const topic of topics){const button=make('button','',topic.title);button.type='button';button.title=topic.source;button.addEventListener('click',()=>startTopic(topic));topicList.append(button);}story.append(topicList);
  const stars=make('div','cinema-stars');stars.hidden=true;story.append(stars);
  const sky=make('div','cinema-sky');sky.hidden=true;screen.append(sky);
  let activeStar=null;
  async function startStar(thema){
    if(disposed||document.hidden||!entered||suspended)return;
    if(thema.ort!==place||currentAsset!==defaultShots[thema.ort]){place=thema.ort;activeScene=null;options.onPlace?.(place);if(!await shot(defaultShots[place],(options.places?.[place]||place)+' · '+thema.title))return;}
    activeStar=thema;sky.replaceChildren(make('span','cinema-sky-north','★ '+(thema.himmel.nordstern||'Nordstern')),make('span','cinema-sky-star',thema.title));sky.hidden=false;
    options.onRecipient?.(thema.an);startTopic({title:thema.title,prompt:thema.prompt,an:thema.an});
  }
  loadLandkarte().then(karte=>{
    if(disposed)return;const themen=sternThemen(karte,options.places||{});if(!themen.length)return;
    stars.append(make('span','cinema-eyebrow','STERNENKARTE'),make('h4','','Durch welchen Stern führen Euch John und Madeleine?'),make('small','',(themen[0].himmel.nordstern?'Nordstern „'+themen[0].himmel.nordstern+'“ · ':'')+'Am Ende steht eine Entscheidung. Das Holodeck liest die Karte nur; gepflegt wird sie auf der Brücke.'));
    const list=make('div','cinema-topics');
    for(const thema of themen){const button=make('button','',thema.title);button.type='button';button.title=thema.frage;button.addEventListener('click',()=>startStar(thema));list.append(button);}
    stars.append(list);stars.hidden=false;
  });
  const next=make('div','cinema-next');
  for(const [label,prompt,phase] of [['Entscheidung finden','Verdichtet unser Gespräch auf eine anstehende Entscheidung. Zeigt zwei konkrete Möglichkeiten mit Folgen und fragt mich, welche ich wähle.','03 / ENTSCHEIDEN'],['Nächsten Schritt festhalten','Was haben wir tatsächlich entschieden? Wenn noch nichts entschieden ist, sagt das. Haltet einen konkreten nächsten Schritt und Zuständigkeit fest; einen Termin nur, wenn vereinbart. Keine Handlung als bereits erledigt behaupten.','04 / WEITERGEHEN']]){const button=make('button','',label);button.type='button';button.addEventListener('click',()=>{chapter.textContent=phase;caption.textContent=options.onBriefing?.({title:label,prompt:activeStar&&phase.startsWith('03')?prompt+' Die Frage aus der Sternenkarte lautet: „'+activeStar.frage+'“':prompt,an:activeStar?.an})||'';});next.append(button);}story.append(next);
  const roles={bene:{name:'Vishnu',verse:'2.47',text:'Handle, ohne Dich an die Früchte Deines Handelns zu klammern; verfalle dabei nicht in Untätigkeit.'},madeleine:{name:'Brahma',verse:'4.38',text:'Nichts in dieser Welt reinigt so sehr wie Erkenntnis.'},john:{name:'Shiva',verse:'6.26',text:'Wohin der unruhige Geist auch wandert: Führe ihn wieder zum Selbst zurück.'}};
  const ritual=make('details','cinema-ritual');ritual.append(make('summary','','Ein besonderer Moment'));
  const roleSelect=make('select','');roleSelect.setAttribute('aria-label','Göttliche Rolle');
  for(const [key,role] of Object.entries(roles)){const option=make('option','',(key==='bene'?'Bene':key==='john'?'John':'Madeleine')+' als '+role.name);option.value=key;roleSelect.append(option);}
  const inspiration=make('button','','Inspiration'),celebrate=make('button','','Problem gelöst · feiern');inspiration.type=celebrate.type='button';ritual.append(roleSelect,inspiration,celebrate);story.append(ritual);
  const library=make('details','cinema-library');library.append(make('summary','','30 Szenen · Stimmung & Geschichte'));
  const sceneSelect=make('select','');sceneSelect.setAttribute('aria-label','Vorbereitete Filmszene');
  for(const scene of scenes){const option=make('option','',scene.id+' · '+scene.placeLabel+' · '+scene.title);option.value=scene.id;sceneSelect.append(option);}
  const sceneOpen=make('button','','Szene ansehen'),sceneTalk=make('button','','Mit dieser Stimmung ins Gespräch');sceneOpen.type=sceneTalk.type='button';
  const sceneInfo=make('div','cinema-scene-info');
  function selected(){return scenes.find(s=>s.id===sceneSelect.value)||scenes[0];}
  function describeScene(){const s=selected();sceneInfo.replaceChildren(make('h4','',s.title),make('p','',s.moodLabel+' · '+s.virtue),make('p','',s.motion),make('small','','Vorbereiteter Drehbuchauftakt · '+s.duration+' Sekunden geplante Filmlänge'));
    for(const [who,line] of s.lines)sceneInfo.append(make('p','',(who==='john'?'John':'Madeleine')+': '+line));
    const sound=make('details','cinema-sound-direction');sound.append(make('summary','','Musik & Stimmen · Regie'));
    sound.append(make('p','',musicDirection[s.place].palette+' · etwa '+musicDirection[s.place].tempo+' BPM. '+moodMusic[s.mood]),make('p','',voiceDirection.madeleine.character),make('p','',voiceDirection.john.character),make('small','',mixDirection));sceneInfo.append(sound);
    sceneInfo.append(make('small','','Fotografische Szene mit Kameraregie. Echte Bewegungsclips und lippensynchrone Vertonung sind noch nicht produziert.'));
  }
  sceneSelect.addEventListener('change',describeScene);describeScene();
  sceneOpen.addEventListener('click',async()=>{const s=selected();if(await shot(s.asset,s.placeLabel+' · '+s.title,{cut:s.place===place?'hard':'dissolve'})){activeScene=s;place=s.place;options.onPlace?.(place);caption.textContent=s.title+' · '+s.moodLabel;verseCard.hidden=true;clearTimeout(ritualTimer);}});
  sceneTalk.addEventListener('click',()=>{const s=selected();startTopic({title:s.title,prompt:'Holodeck-Szene: '+s.title+' in '+s.placeLabel+'. Stimmung: '+s.moodLabel+'. Gemeinsamer Charakterkern: Nächstenliebe, Ehrlichkeit, Verlässlichkeit, Disziplin, Verantwortung und Respekt. Schwerpunkt hier: '+s.virtue+'. Spielt John und Madeleine als eigenständige, warme Persönlichkeiten, die auch Fehler eingestehen. Fiktive Stimmung, keine Behauptung über reale Personen. Nutzt den folgenden Drehbuchauftakt nur als Inspiration und reagiert dann auf mein tatsächliches Anliegen: '+s.lines.map(([who,line])=>who+': '+line).join(' ')+' Fragt mich eine konkrete Frage, ohne ein Ergebnis oder Ereignis zu erfinden.'});});
  library.append(sceneSelect,sceneOpen,sceneTalk,sceneInfo);story.append(library);
  const verseCard=make('aside','cinema-verse');verseCard.hidden=true;screen.append(verseCard);
  let place=options.place||'bar',activeScene=null,entered=false,disposed=false,suspended=false,sequence=0,entryVersion=0,transitionTimer,ritualTimer,guideSpeech=null,guideCancel=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let currentAsset='cinema-welcome',video=null,utteranceText='',utteranceWho=null,listening=false,manifest={};
  const pendingImages=new Map(),loadController=new AbortController();
  const manifestTimeout=setTimeout(()=>loadController.abort(),2500);
  const manifestReady=fetch(base+'manifest.json',{credentials:'same-origin',signal:loadController.signal}).then(r=>r.ok?r.json():{}).then(data=>{manifest=data?.assets&&typeof data.assets==='object'?data.assets:{};}).catch(()=>{}).finally(()=>clearTimeout(manifestTimeout));
  const sceneByAsset=name=>scenes.find(scene=>scene.asset===name);
  root.dataset.scene=currentAsset;root.dataset.media='still';
  function updateSize(){const moving=video&&root.dataset.media==='video',width=moving?video.videoWidth:frame.naturalWidth,height=moving?video.videoHeight:frame.naturalHeight;if(width)mediaFacts.textContent=(moving?'Videoclip':'Fotografischer Filmstill')+' · '+width+' × '+height+' px. '+(moving?'Bewegung aus einem bereitgestellten Clip.':'Die Kamera bewegt sich; die Menschen im Foto sind nicht animiert.');}
  frame.addEventListener('load',updateSize);
  frame.addEventListener('error',()=>{if(frame.src.endsWith('.webp'))frame.src=frame.src.replace(/\.webp$/,'.png');else caption.textContent='Die Szene konnte nicht geladen werden. Das Gespräch bleibt verfügbar.';});
  function imagePath(name){return safeMediaURL(base,manifest[name]?.poster)||base+name+'.webp';}
  function prepareImage(name){
    if(pendingImages.has(name)){const cached=pendingImages.get(name);pendingImages.delete(name);pendingImages.set(name,cached);return cached;}
    const result=new Promise(resolve=>{const img=new Image();img.decoding='async';let settled=false;const done=value=>{if(settled)return;settled=true;clearTimeout(timeout);resolve(value);};const timeout=setTimeout(()=>done(null),12000);
      img.onload=()=>done(img);img.onerror=()=>{if(img.src.endsWith('.webp'))img.src=base+name+'.png';else done(null);};img.src=imagePath(name);
    });pendingImages.set(name,result);while(pendingImages.size>6)pendingImages.delete(pendingImages.keys().next().value);result.then(img=>{if(!img&&pendingImages.get(name)===result)pendingImages.delete(name);});return result;
  }
  function preload(name){if(disposed||navigator.connection?.saveData)return;void prepareImage(name);}
  function updatePeople(){
    people.replaceChildren();const anchors=anchorsFor(currentAsset);
    for(const who of ['madeleine','john']){const point=anchors[who];if(!point)continue;const button=make('button','cinema-person',who==='john'?'John':'Madeleine');button.type='button';button.setAttribute('aria-label',(who==='john'?'John':'Madeleine')+' ansprechen');button.style.left=(point[0]*100)+'%';button.style.top=(point[1]*100)+'%';button.addEventListener('click',()=>{if(!entered||suspended)return;options.onRecipient?.(who);caption.textContent='Du wendest Dich an '+(who==='john'?'John':'Madeleine')+'.';setFocus(who);});people.append(button);}
  }
  function setFocus(who){
    const point=anchorsFor(currentAsset)[who];root.classList.toggle('cinema-speaking',Boolean(point));
    const x=(point?.[0]||.5)*100,y=(point?.[1]||.35)*100;root.style.setProperty('--speaker-x',x+'%');root.style.setProperty('--speaker-y',y+'%');
    for(const button of people.children)button.classList.toggle('is-speaking',button.textContent===(who==='john'?'John':who==='madeleine'?'Madeleine':''));
  }
  function motionState(){root.classList.toggle('cinema-paused',paused||suspended);if(video){const current=video;if(paused||suspended)current.pause();else void current.play().catch(error=>{if(video===current&&error.name!=='AbortError')dropVideo();});}}
  function dropVideo(){if(!video)return;const old=video;video=null;old.pause();old.removeAttribute('src');old.load();old.remove();frame.hidden=false;root.dataset.media='still';updateSize();}
  function attachVideo(name,version){
    const info=manifest[name],url=safeMediaURL(base,info?.video);if(!url||disposed||version!==sequence)return;
    const clip=make('video','cinema-video');video=clip;clip.muted=true;clip.playsInline=true;clip.preload='metadata';clip.loop=!Array.isArray(info.loop);clip.poster=frame.src;clip.src=url;camera.insertBefore(clip,frame);let timeout;
    const fallback=()=>{clearTimeout(timeout);if(video===clip)dropVideo();};
    clip.addEventListener('error',fallback,{once:true});timeout=setTimeout(fallback,6000);
    clip.addEventListener('loadeddata',()=>{clearTimeout(timeout);if(video!==clip||disposed||version!==sequence){fallback();return;}frame.hidden=true;root.dataset.media='video';updateSize();motionState();},{once:true});
    const range=info.loop;
    if(Array.isArray(range)&&range.length===2&&range.every(Number.isFinite)&&range[0]>=0&&range[1]>range[0]){
      clip.addEventListener('loadedmetadata',()=>{if(range[1]<=clip.duration)clip.currentTime=range[0];else clip.loop=true;},{once:true});
      clip.addEventListener('timeupdate',()=>{if(video===clip&&range[1]<=clip.duration&&clip.currentTime>=range[1])clip.currentTime=range[0];});
      clip.addEventListener('ended',()=>{if(video===clip){clip.currentTime=range[0];motionState();}});
    } else clip.loop=true;
    clip.load();
  }
  async function shot(name,alt,{cut='dissolve'}={}){
    const version=++sequence;await manifestReady;const img=await prepareImage(name);
    if(disposed||suspended||version!==sequence)return false;
    if(!img){caption.textContent='Diese Szene konnte nicht geladen werden. Die aktuelle bleibt sichtbar.';return false;}
    let old;if(cut!=='hard'&&!paused){old=frame.cloneNode();old.hidden=false;old.className='cinema-outgoing';screen.insertBefore(old,focusRig);old.style.zIndex='1';setTimeout(()=>old.remove(),950);}
    dropVideo();currentAsset=name;root.dataset.scene=name;root.dataset.cut=cut;
    frame.src=img.src;frame.alt=alt;const scene=sceneByAsset(name),direction=directionFor(scene);
    root.style.setProperty('--pan-from',direction.from);root.style.setProperty('--pan-to',direction.to);root.style.setProperty('--pan-origin',direction.origin);root.style.setProperty('--pan-duration',direction.duration+'s');
    camera.style.animation='none';void camera.offsetWidth;camera.style.animation='';
    resolution.textContent=scene?scene.placeLabel+' · '+scene.title:name==='cinema-welcome'?'Der Empfang':'Ein besonderer Moment';
    updatePeople();setFocus(utteranceWho);updateSize();audio.setScene(scene?.place||place,scene?.mood||'ruhe');attachVideo(name,version);motionState();
    const index=scenes.findIndex(s=>s.asset===name);if(index>=0){if(scenes[index+1])preload(scenes[index+1].asset);if(scenes[index-1])preload(scenes[index-1].asset);}return true;
  }
  manifestReady.then(()=>{if(!disposed){preload(defaultShots[place]);if(currentAsset==='cinema-welcome'&&!video&&!suspended){frame.src=imagePath(currentAsset);attachVideo(currentAsset,sequence);motionState();}}});
  function startTopic(topic){if(disposed||document.hidden||!entered)return;chapter.textContent='02 / VERSTEHEN';caption.textContent=options.onBriefing?.(topic)||'John und Madeleine nehmen den Faden auf.';}
  async function speakWelcome(){
    if(!hostVoice.checked||!window.speechSynthesis)return;
    const version=entryVersion,lang=options.getLanguage?.()||'de-DE';
    const lines={'de-DE':'Willkommen an Bord, Bene. Komm mit. John und Madeleine warten auf Dich.','en-US':'Welcome aboard, Bene. Come with me. John and Madeleine are waiting for you.','hi-IN':'स्वागत है, बेने। मेरे साथ आइए। जॉन और मेडेलीन आपका इंतज़ार कर रहे हैं।','it-IT':'Benvenuto a bordo, Bene. Vieni con me. John e Madeleine ti aspettano.','fr-FR':'Bienvenue à bord, Bene. Venez avec moi. John et Madeleine vous attendent.'};
    const available=()=>window.speechSynthesis.getVoices().filter(v=>v.lang.split('-')[0]===lang.split('-')[0]);
    if(!available().length)await new Promise(resolve=>{const finish=()=>{clearTimeout(timeout);window.speechSynthesis.removeEventListener('voiceschanged',changed);resolve();};const changed=()=>{if(available().length)finish();};const timeout=setTimeout(finish,1200);window.speechSynthesis.addEventListener('voiceschanged',changed);});
    if(disposed||suspended||!entered||version!==entryVersion)return;
    const voices=available();if(!voices.length){caption.textContent='Für diese Sprache ist keine Browserstimme verfügbar.';return;}
    await new Promise(resolve=>{
      const text=lines[lang]||lines['de-DE'],utterance=new SpeechSynthesisUtterance(text);guideSpeech=utterance;utterance.lang=lang;utterance.voice=options.getHostVoice?.()||voices[0];utterance.rate=.93;utterance.pitch=.9;
      let complete=false;const finish=()=>{if(complete)return;complete=true;clearTimeout(timeout);guideCancel=null;guideSpeech=null;setSubtitle(null);audio.setVoice(listening);resolve();};
      const timeout=setTimeout(()=>{window.speechSynthesis.cancel();finish();},22000);guideCancel=finish;
      utterance.onstart=()=>{setSubtitle('picard',text);audio.setVoice(true);};utterance.onboundary=e=>setSubtitle('picard',text,e.charIndex,e.charLength);utterance.onend=finish;utterance.onerror=finish;window.speechSynthesis.speak(utterance);
    });
  }
  async function arrive(start){
    if(entered||suspended)return;entered=true;const version=++entryVersion;welcome.hidden=true;controls.hidden=false;chapter.textContent='01 / ANKOMMEN';
    const delay=new Promise(resolve=>{transitionTimer=setTimeout(resolve,paused?0:1200);});await Promise.all([speakWelcome(),delay]);
    if(disposed||suspended||!entered||version!==entryVersion)return;
    if(!await shot(defaultShots[place],options.places?.[place]+' · Bene, Madeleine und John im Gespräch'))return;
    if(disposed||suspended||!entered||version!==entryVersion)return;chapter.textContent='02 / VERSTEHEN';story.hidden=false;
    if(start)startTopic(topics[options.context==='verein'?1:0]);else{caption.textContent='Nimm Dir einen Moment. Der Abend gehört Euch.';rareInspiration();}
  }
  enter.addEventListener('click',()=>arrive(true));explore.addEventListener('click',()=>arrive(false));
  still.addEventListener('click',()=>{paused=!paused;motionState();still.textContent=paused?'Kamerabewegung starten':'Kamerabewegung pausieren';});
  overview.addEventListener('click',()=>{entryVersion++;stopGuide();setSubtitle(null);clearTimeout(transitionTimer);clearTimeout(ritualTimer);entered=false;activeScene=null;story.hidden=true;controls.hidden=true;verseCard.hidden=true;sky.hidden=true;activeStar=null;welcome.hidden=false;chapter.textContent='01 / ANKOMMEN';caption.textContent='';shot('cinema-welcome','Picard empfängt Dich am Holodeck');});
  async function divineMoment(who,reason='Inspiration'){
    const role=roles[who];if(!role)return;clearTimeout(ritualTimer);
    if(!await shot('cinema-'+role.name.toLowerCase()+'-v2',(who==='bene'?'Bene':who==='john'?'John':'Madeleine')+' als '+role.name,{cut:'dissolve'}))return;
    verseCard.replaceChildren(make('span','cinema-eyebrow',reason),make('h4','',role.name),make('p','',role.text));
    const link=make('a','','Bhagavad Gita '+role.verse+' · sinngemäße Wiedergabe');link.href='https://www.holy-bhagavad-gita.org/chapter/'+role.verse.replace('.','/verse/')+'/';link.target='_blank';link.rel='noopener noreferrer';
    const back=make('button','','Zurück in den Alltag');back.type='button';back.addEventListener('click',endRitual);verseCard.append(link,back);verseCard.hidden=false;
    try{localStorage.setItem('holoDivineLast',String(Date.now()));}catch(_){}ritualTimer=setTimeout(endRitual,18000);
  }
  function endRitual(){clearTimeout(ritualTimer);verseCard.hidden=true;shot(activeScene?.asset||defaultShots[place],options.places?.[place]+' · Gespräch');}
  function rareInspiration(){try{const now=Date.now(),last=Number(localStorage.getItem('holoDivineAttempt')||0);if(now-last<86400000)return;localStorage.setItem('holoDivineAttempt',String(now));if(now-Number(localStorage.getItem('holoDivineLast')||0)<86400000||Math.random()>.12)return;}catch(_){return;}divineMoment(['bene','bene','john','madeleine'][Math.floor(Math.random()*4)]);}
  inspiration.addEventListener('click',()=>divineMoment(roleSelect.value));celebrate.addEventListener('click',()=>divineMoment(roleSelect.value,'Ein von Dir bestätigter Erfolg'));
  function setSubtitle(who,text='',charIndex=0,charLength=0){
    utteranceWho=who;utteranceText=text;subtitles.hidden=!who||!text;subtitles.replaceChildren();setFocus(who);
    if(!who||!text)return;
    const words=[...text.matchAll(/\S+/gu)];let current=words.findIndex((word,i)=>charIndex>=word.index&&charIndex<(words[i+1]?.index??text.length+1));if(current<0)current=0;
    const start=Math.floor(current/12)*12,visible=words.slice(start,start+12);subtitles.append(make('span','cinema-subtitle-name',({john:'John',madeleine:'Madeleine',picard:'Jean-Luc'}[who]||who)));
    const line=make('span','cinema-subtitle-line');visible.forEach((word,i)=>{const part=make('span',start+i===current?'current-word':'',word[0]+' ');line.append(part);});subtitles.append(line);
  }
  function stopGuide(){const finish=guideCancel;if(guideSpeech)window.speechSynthesis?.cancel();finish?.();guideSpeech=null;}
  function pause(){suspended=true;listening=false;root.classList.remove('cinema-listening');entryVersion++;clearTimeout(transitionTimer);clearTimeout(ritualTimer);sequence++;if(entered&&story.hidden){entered=false;welcome.hidden=false;controls.hidden=true;}stopGuide();setSubtitle(null);audio.stop();motionState();}
  function visibility(){if(document.hidden)pause();else if(host.closest('dialog')?.open!==false){suspended=false;motionState();}}
  document.addEventListener('visibilitychange',visibility);
  return {
    setPlace(value){if(!defaultShots[value]||value===place)return;place=value;activeScene=null;audio.setScene(place);if(entered&&!suspended)void shot(defaultShots[place],options.places?.[place]+' · Gespräch');else preload(defaultShots[place]);},
    setSpeaker(who){speaking.textContent=who?({john:'John',madeleine:'Madeleine'}[who]||who)+' spricht':listening?'Du bist dran':'John & Madeleine';audio.setVoice(Boolean(who)||listening);if(!who)setSubtitle(null);setFocus(who||(listening?'bene':null));},
    setListening(active){listening=Boolean(active);root.classList.toggle('cinema-listening',listening);audio.setVoice(listening||Boolean(utteranceWho));if(listening){speaking.textContent='Du bist dran';setFocus('bene');}else if(!utteranceWho){speaking.textContent='John & Madeleine';setFocus(null);}},
    setSubtitle,setOutfit(){},setAction(){},stopGuide,pause,
    resume(){suspended=false;if(video&&video.readyState<2)dropVideo();if(!video)attachVideo(currentAsset,sequence);motionState();},
    getPlaybackState(){return {scene:currentAsset,media:root.dataset.media,paused,suspended,listening,audio:audio.getState()};},
    dispose(){disposed=true;pause();dropVideo();loadController.abort();clearTimeout(manifestTimeout);audio.dispose();document.removeEventListener('visibilitychange',visibility);root.remove();}
  };
}
