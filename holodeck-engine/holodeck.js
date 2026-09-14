import * as THREE from './three.module.js';

// A scene graph with articulated 3D bodies, time-based locomotion and a guided camera.
// These are stylised avatars, not photorealistic scans of the reference photographs.
export function mountHolodeck(host, options = {}) {
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  const root=el('section','holo3d');root.setAttribute('aria-label','Dreidimensionales Holodeck mit Picard');host.replaceChildren(root);
  const canvas=el('canvas','holo3d-canvas');canvas.setAttribute('aria-label','3D-Raum. Ziehen zum Umsehen, Ort anklicken zum Hingehen.');root.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101b29');scene.fog=new THREE.FogExp2('#101b29',.017);
  const camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.position.set(0,1.72,11.7);
  const look=new THREE.Vector3(0,1.4,6);
  const hemi=new THREE.HemisphereLight('#b9dcea','#554132',2.8);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#ffe6be',4);sun.position.set(4,10,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.025;scene.add(sun);
  const rim=new THREE.DirectionalLight('#7bdde1',2);rim.position.set(-5,5,-7);scene.add(rim);
  const env=new THREE.Group(),entry=new THREE.Group(),cast=new THREE.Group();scene.add(env,entry,cast);
  const materials=new Set(),geometries=new Set(),textures=new Set();
  function mat(color,metalness=0,roughness=.55,extra={}){const m=new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});materials.add(m);return m;}
  const brass=mat('#d1aa68',.78,.28),ink=mat('#101d29',.55,.3),warm=mat('#754e37',.1,.72),light=mat('#e9d5a5',.25,.35,{emissive:'#e9c779',emissiveIntensity:1.5});
  function mesh(geo,material,parent,x=0,y=0,z=0){geometries.add(geo);const n=new THREE.Mesh(geo,material);n.position.set(x,y,z);n.castShadow=true;n.receiveShadow=true;parent.add(n);return n;}
  const box=(p,w,h,d,m,x=0,y=0,z=0)=>mesh(new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const sphere=(p,r,m,x=0,y=0,z=0)=>mesh(new THREE.SphereGeometry(r,24,16),m,p,x,y,z);
  const cyl=(p,rt,rb,h,m,x=0,y=0,z=0)=>mesh(new THREE.CylinderGeometry(rt,rb,h,48),m,p,x,y,z);
  function ring(p,r,t,m,x=0,y=0,z=0){const n=mesh(new THREE.TorusGeometry(r,t,12,72),m,p,x,y,z);n.rotation.x=-Math.PI/2;return n;}
  function textLabel(text,parent,x,y,z,color='#e6d5b5',size=.9){
    const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='500 42px system-ui';ctx.textAlign='center';ctx.fillText(text,512,77);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);
    const m=new THREE.SpriteMaterial({map:t,depthWrite:false});materials.add(m);const n=new THREE.Sprite(m);n.scale.set(size*4,size*.5,1);n.position.set(x,y,z);parent.add(n);return n;
  }
  const starsGeo=new THREE.BufferGeometry(),starPos=[];
  let seed=41;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<800;i++){const a=random()*Math.PI*2,r=35+random()*15;starPos.push(Math.cos(a)*r,5+random()*28,Math.sin(a)*r);}
  starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));geometries.add(starsGeo);
  const starMaterial=new THREE.PointsMaterial({color:'#e3e7df',size:.08,transparent:true,opacity:.8});materials.add(starMaterial);const stars=new THREE.Points(starsGeo,starMaterial);scene.add(stars);
  // Corridor framing is a physical volume. Doors slide sideways, beyond the passage.
  box(entry,12,.16,7,ink,0,-.1,10);box(entry,12,.15,7,ink,0,4.1,10);
  for(const x of [-3.1,3.1]){box(entry,.22,4.2,7,ink,x,2,10);box(entry,.025,.05,6.8,light,x*.995,.25,10);}
  box(entry,6.4,.3,.5,brass,0,3.75,6.3);
  for(const x of [-2.25,2.25])box(entry,.27,3.6,.55,brass,x,1.85,6.3);
  const doors=[box(entry,2.15,3.5,.16,ink,-1.09,1.75,6.3),box(entry,2.15,3.5,.16,ink,1.09,1.75,6.3)];
  for(const door of doors){box(door,.025,2.8,.03,light,door.position.x<0?1:-1,0,.12);for(let i=0;i<3;i++)box(door,1.3,.008,.015,brass,0,.65-i*.65,.1);}
  textLabel('VAIKUNTHA  /  HOLODECK 01',entry,0,3.35,6.46,'#f4d5a0',.65);
  box(entry,.46,.8,.09,brass,2.75,1.4,6.4);box(entry,.36,.58,.025,mat('#37bac1',.2,.3,{emissive:'#197e91'}),2.75,1.4,6.47);

  const actors={};
  const unitGeometry=new Map();let castBatches=[],envBatches=[];
  function batchMeshes(container) {
    container.updateMatrixWorld(true);const groups=new Map();
    container.traverse(n=>{
      if(!n.isMesh||n.isInstancedMesh)return;
      const p=n.geometry.parameters;let key='',create,scale=new THREE.Vector3(1,1,1);
      if(n.geometry.type==='SphereGeometry'){key='sphere';create=()=>new THREE.SphereGeometry(1,16,12);scale.setScalar(p.radius);}
      else if(n.geometry.type==='BoxGeometry'){key='box';create=()=>new THREE.BoxGeometry(1,1,1);scale.set(p.width,p.height,p.depth);}
      else if(n.geometry.type==='CylinderGeometry'){key='cylinder-'+(p.radiusTop/p.radiusBottom).toFixed(3);create=()=>new THREE.CylinderGeometry(p.radiusTop/p.radiusBottom,1,1,16);scale.set(p.radiusBottom,p.height,p.radiusBottom);}
      else {key=n.geometry.type+JSON.stringify(p);create=()=>n.geometry;}
      if(!unitGeometry.has(key)){const geo=create();unitGeometry.set(key,geo);geometries.add(geo);}
      const groupKey=key+n.material.uuid;
      if(!groups.has(groupKey))groups.set(groupKey,{geo:unitGeometry.get(key),material:n.material,parts:[]});
      groups.get(groupKey).parts.push({source:n,scale:new THREE.Matrix4().makeScale(scale.x,scale.y,scale.z)});n.visible=false;
    });
    const batches=[];
    for(const group of groups.values()){
      const draw=new THREE.InstancedMesh(group.geo,group.material,group.parts.length);draw.castShadow=true;draw.receiveShadow=true;draw.frustumCulled=false;draw.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(draw);batches.push({draw,parts:group.parts});
    }
    updateBatches(batches);return batches;
  }
  const batchMatrix=new THREE.Matrix4();
  function updateBatches(batches){for(const batch of batches){for(let i=0;i<batch.parts.length;i++){const p=batch.parts[i];batchMatrix.multiplyMatrices(p.source.matrixWorld,p.scale);batch.draw.setMatrixAt(i,batchMatrix);}batch.draw.instanceMatrix.needsUpdate=true;}}
  function human(who,{skin,cloth,hair,beard=false,female=false,bald=false,uniform=false},position){
    const group=new THREE.Group();group.position.copy(position);cast.add(group);
    const body=new THREE.Group();body.position.y=.94;group.add(body);
    const skinM=mat(skin,0,.68),clothM=mat(cloth,.08,.72),hairM=mat(hair,0,.88),shoe=mat('#161a22',.25,.45),white=mat('#eee7d7',0,.7);
    const trouser=uniform||who==='bene'?shoe:clothM;
    const torso=mesh(new THREE.CapsuleGeometry(female?.19:.23,.22,8,20),clothM,body,0,.29,0);torso.scale.z=.65;
    const hips=sphere(body,.225,clothM,0,.025,0);hips.scale.set(1,.72,.65);
    cyl(body,.075,.08,.11,skinM,0,.65,0);
    const head=new THREE.Group();head.position.y=.83;body.add(head);
    const face=sphere(head,.205,skinM,0,0,0);face.scale.set(.85,1.16,.9);
    for(const x of [-.173,.173]){const ear=sphere(head,.047,skinM,x,-.008,0);ear.scale.set(.5,1,.8);}
    const nose=sphere(head,.036,skinM,0,-.013,.181);nose.scale.set(.66,1,1.7);
    const eyeWhite=mat('#f2eadc',0,.4),eyeDark=mat('#283939',0,.45);
    for(const x of [-.071,.071]){sphere(head,.026,eyeWhite,x,.04,.16).scale.set(1,.55,.4);sphere(head,.012,eyeDark,x,.04,.171).scale.z=.4;const brow=box(head,.062,.014,.016,hairM,x,.08,.16);brow.rotation.z=x<0?.1:-.1;}
    const mouth=box(head,.066,.008,.018,mat('#754438',0,.6),0,-.092,.17);
    if(!bald){const cap=sphere(head,.204,hairM,0,.105,-.027);cap.scale.set(.89,.8,.86);}
    else for(const x of [-.157,.157])sphere(head,.065,hairM,x,.04,-.055).scale.set(.4,1.55,1.5);
    if(female){const long=sphere(head,.20,hairM,0,-.12,-.1);long.scale.set(1,1.65,.65);for(const x of [-.16,.16])sphere(head,.074,hairM,x,-.19,.035).scale.set(.9,3.7,.85);}
    if(beard){const b=sphere(head,.166,hairM,0,-.12,.035);b.scale.set(.88,.55,.8);}
    if(uniform){box(body,.45,.15,.33,shoe,0,.52,0);const pin=mesh(new THREE.ConeGeometry(.037,.075,3),brass,body,.14,.42,.17);pin.rotation.z=-.2;}
    else{box(body,.065,.37,.016,white,0,.40,.16);}
    // Two links per leg and arm. Pivots match actual joints, rather than moving flat cutouts.
    const arms=[],elbows=[],legs=[],knees=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*(female?.23:.28),.51,0);body.add(arm);arms.push(arm);
      sphere(arm,.077,clothM,0,0,0);cyl(arm,.072,.060,.30,clothM,0,-.13,0);
      const elbow=new THREE.Group();elbow.position.y=-.285;arm.add(elbow);elbows.push(elbow);
      sphere(elbow,.062,clothM);cyl(elbow,.062,.045,.28,clothM,0,-.13,0);sphere(elbow,.059,skinM,0,-.3,0).scale.y=1.3;
      const leg=new THREE.Group();leg.position.set(side*.112,-.015,0);body.add(leg);legs.push(leg);
      cyl(leg,.095,.070,.43,trouser,0,-.21,0);
      const knee=new THREE.Group();knee.position.y=-.43;leg.add(knee);knees.push(knee);
      sphere(knee,.071,trouser);cyl(knee,.069,.050,.40,trouser,0,-.2,0);const foot=sphere(knee,.105,shoe,0,-.405,.055);foot.scale.set(.65,.5,1.35);foot.castShadow=true;
    }
    ring(arms[0],.064,.014,brass,0,-.49,0).rotation.x=0;
    const label=textLabel(who==='picard'?'JEAN-LUC · KI-GASTGEBER':who==='bene'?'BENE':who.toUpperCase(),group,0,2.12,0,'#eedcba',.30);
    const a={who,group,body,head,mouth,arms,elbows,legs,knees,clothM,label,phase:random()*6,walk:0,action:'ruhe',target:position.clone(),home:position.clone(),speaking:false};actors[who]=a;return a;
  }
  human('john',{skin:'#aa7454',cloth:'#d9c8a9',hair:'#262424',beard:true},new THREE.Vector3(-2,0,-.7));
  human('madeleine',{skin:'#e9b998',cloth:'#2b5156',hair:'#60402d',female:true},new THREE.Vector3(2,0,-.6));
  human('bene',{skin:'#d2ad91',cloth:'#36546d',hair:'#514437',beard:true},new THREE.Vector3(.6,0,2.2));
  const captain=human('picard',{skin:'#d1a58c',cloth:'#8b2d3b',hair:'#77746c',bald:true,uniform:true},new THREE.Vector3(1.3,0,8));
  castBatches=batchMeshes(cast);
  let currentPlace='',themeResources=[],pathTick=0;
  const palette={bar:['#101b29','#375467','#c6a96d'],huette:['#536f7c','#7693a3','#b6854e'],goa:['#75a4aa','#b0d5d2','#d7b586'],anden:['#68718e','#9b8aa1','#c49a67'],rom:['#b28573','#d9b899','#b76f4a']};
  function discardEnvironment(){
    for(const batch of envBatches){scene.remove(batch.draw);batch.draw.dispose();}envBatches=[];
    env.traverse(n=>{if(n.isMesh && n.geometry){n.geometry.dispose();geometries.delete(n.geometry);}if(n.isSprite){n.material.map?.dispose();textures.delete(n.material.map);n.material.dispose();materials.delete(n.material);}});env.clear();
    for(const m of themeResources){m.dispose();materials.delete(m);}themeResources=[];
  }
  function themeMat(...args){const m=mat(...args);themeResources.push(m);return m;}
  function palm(x,z){
    const trunk=cyl(env,.10,.17,3.2,warm,x,1.55,z);trunk.rotation.z=.13;
    for(let i=0;i<7;i++){const leaf=mesh(new THREE.SphereGeometry(1,12,8),themeMat('#33544a'),env,x,3.2,z);leaf.scale.set(.22,.07,1.35);leaf.rotation.y=i*Math.PI/3.5;leaf.rotation.z=.24;}
  }
  function mountain(x,z,h,color){const m=mesh(new THREE.ConeGeometry(h*.8,h,5),themeMat(color),env,x,h/2-.2,z);m.rotation.y=random()*3;const cap=mesh(new THREE.ConeGeometry(h*.22,h*.3,5),themeMat('#e7e6df'),env,x,h*.84,z);cap.rotation.y=m.rotation.y;}
  function setPlace(place){
    if(!palette[place] || place===currentPlace)return;currentPlace=place;discardEnvironment();
    const [sky,floorColor,accent]=palette[place];scene.background.set(sky);scene.fog.color.set(sky);stars.visible=place==='bar';
    hemi.color.set(place==='bar'?'#b9dcea':'#e6e7dc');sun.intensity=place==='bar'?4:3;
    const ground=themeMat(place==='bar'?'#182d37':floorColor,.3,.45);cyl(env,11,11,.20,ground,0,-.14,0);
    for(const r of [3.6,7.6,10.7])ring(env,r,.018,brass,0,.005,0);
    // A lotus/chakra meeting table provides the same centre in every simulation.
    cyl(env,1.20,1.1,.14,ink,0,.81,0);cyl(env,.27,.5,.72,brass,0,.35,0);ring(env,.91,.015,brass,0,.89,0);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const petal=sphere(env,.20,brass,Math.cos(a)*.32,.90,Math.sin(a)*.32);petal.scale.set(.5,.04,1.7);petal.rotation.y=-a+Math.PI/2;}
    for(const x of [-4,4]){cyl(env,.55,.4,.7,ink,x,.3,-2);sphere(env,.52,themeMat('#496a52'),x,1.1,-2).scale.y=1.6;}
    if(place==='bar'){
      for(let i=0;i<12;i++){const a=i*Math.PI/6;const x=Math.cos(a)*9,z=Math.sin(a)*9;box(env,.16,4.5,.16,brass,x,2.2,z);if(z<5){const pane=box(env,4.45,3.5,.03,themeMat('#38556a',.1,.1,{transparent:true,opacity:.17}),x,2.2,z);pane.rotation.y=-a+Math.PI/2;}}
      ring(env,9,.14,brass,0,4.5,0);ring(env,8.8,.025,light,0,4.42,0);
      box(env,7,1.12,1.1,warm,0,.56,-5.4);box(env,7.3,.12,1.35,brass,0,1.18,-5.4);
      for(let i=0;i<9;i++){cyl(env,.055,.065,.28,themeMat(i%2?'#28544d':'#97583b',.2,.3),-2.7+i*.65,1.38,-5.45);}
      for(const x of [-2,0,2]){cyl(env,.31,.31,.13,ink,x,.72,-3.9);cyl(env,.035,.12,.66,brass,x,.32,-3.9);}
      const planet=sphere(env,5,themeMat('#7faaa9',.2,.9),-15,8,-24);planet.rotation.z=.5;
      ring(env,7,.15,themeMat('#c6ad85'),-15,8,-24).rotation.z=.55;
    }else if(place==='goa'){
      const ocean=themeMat('#429ba4',.25,.15);box(env,90,.04,60,ocean,0,-.2,-25);
      for(const [x,z] of [[-6,-5],[6,-6],[-8,1],[8,2]])palm(x,z);
      for(const x of [-3,3]){box(env,.15,3,.15,warm,x,1.5,-4);}
      box(env,6.5,.12,3.5,themeMat('#e7d9b7'),0,3,-4.5);
      sphere(env,3,themeMat('#ffe1a0',0,.8,{emissive:'#efb964',emissiveIntensity:.4}),-15,5,-27);
    }else if(place==='huette' || place==='anden'){
      for(let i=0;i<10;i++)mountain(-25+i*5.5,-18-random()*5,8+random()*8,i%2?'#697c8c':'#536679');
      for(const x of [-6,6]){box(env,.25,3.7,.25,warm,x,1.85,-4);box(env,.25,3.7,.25,warm,x,1.85,3);}
      if(place==='huette'){
        for(let i=0;i<13;i++)box(env,12,.025,.45,warm,0,.02,-3.1+i*.5);
        box(env,12.6,.2,8,warm,0,3.8,-.5);
        box(env,2.3,1.4,1.0,themeMat('#686960'),-4,.7,-3);sphere(env,.35,themeMat('#f6a34d',0,.5,{emissive:'#ee761f',emissiveIntensity:2}),-4,.5,-2.4);
      }else{
        for(let i=0;i<10;i++){const flag=box(env,.32,.42,.018,themeMat(['#b85547','#dac387','#457b82'][i%3]),-4+i*.9,3.1-Math.sin(i/9*Math.PI)*.3,-4);flag.rotation.z=.1;}
      }
    }else{
      for(let i=0;i<7;i++){const x=-12+i*4;const facade=themeMat(i%2?'#c1a286':'#c59175');box(env,3.9,6+i%3,2.5,facade,x,3,-7);box(env,4.2,.22,2.8,themeMat('#985b43'),x,6.1,-7);
        for(const y of [1.6,3.6])for(const dx of [-.9,.9]){box(env,.85,1.25,.06,ink,x+dx,y,-5.71);box(env,1,.09,.14,brass,x+dx,y-.6,-5.6);}}
      cyl(env,1,1.4,.3,themeMat('#c9b898'),5,.1,0);cyl(env,.45,.6,.8,brass,5,.5,0);
    }
    textLabel('VISHNU  ·  VAIKUNTHA',env,0,2.9,-4.8,'#ead6a4',.6);
    envBatches=batchMeshes(env);
    themeName.textContent=options.places?.[place] || place;
  }
  const upper=el('div','holo3d-upper'),brand=el('div','holo3d-brand');brand.append(el('span','', 'VAIKUNTHA'),el('small','','Dein Ort. Deine nächste Entscheidung.'));
  const themeName=el('span','holo3d-place','');upper.append(brand,themeName);root.append(upper);
  const chapter=el('div','holo3d-chapter','01 / ANKOMMEN');root.append(chapter);
  const welcome=el('div','holo3d-welcome');welcome.append(el('span','holo3d-eyebrow','JEAN-LUC PICARD · KI-GASTGEBER'),el('h3','','Willkommen an Bord, Bene.'),el('p','','John und Madeleine warten bereits. Wir beginnen bei dem, was Dich weiterbringt – und gehen mit einem klaren nächsten Schritt.'));
  const enter=el('button','holo3d-primary','Eintreten & Lage besprechen');enter.type='button';
  const quiet=el('button','holo3d-secondary','Nur den Raum erkunden');quiet.type='button';
  const voiceLabel=el('label','holo3d-host-voice'),hostVoice=document.createElement('input');hostVoice.type='checkbox';voiceLabel.append(hostVoice,document.createTextNode(' Picards Begrüßung vorlesen · synthetische Systemstimme'));
  welcome.append(voiceLabel,enter,quiet);root.append(welcome);
  const subtitle=el('div','holo3d-subtitle');subtitle.setAttribute('role','status');root.append(subtitle);
  const toolbar=el('div','holo3d-toolbar');toolbar.hidden=true;
  const reset=el('button','','Blick zum Tisch'),walk=el('button','','Gemeinsam gehen'),dance=el('button','','Tanzen'),rest=el('button','','Zur Ruhe kommen');
  for(const b of [reset,walk,dance,rest])b.type='button';toolbar.append(reset,walk,dance,rest);root.append(toolbar);
  const briefing=el('div','holo3d-briefing');briefing.hidden=true;
  const briefingTitle=el('h4','','Unser Gespräch beginnt hier.');briefing.append(briefingTitle,el('small','','Vorschläge aus Git-Projektständen · 11.09.2026 · Du bestimmst die Reihenfolge.'));
  const topics=[
    {title:'Ein gemeinsames Haus für Deine KIs',source:'john-agent/docs/stand.md · 9542790; madelene-agent c63893c',prompt:'Beginnt direkt mit unserem gemeinsamen Haus für John und Madeleine. Git-Stand vom 11.09.2026: Der lokale Gesprächsraum und Stopp funktionieren; offen sind laut john-agent/docs/stand.md das Zusammenführen von john-ki.ps1 und Cockpit-Code sowie Takt-Funde im Stapel. Madeleine c63893c bestätigt bereits den Einbau des Gesprächsraums; ihre ältere Stand-Datei ist hier überholt. Was bringt uns als Nächstes am meisten, und welche Entscheidung braucht ihr von mir?'},
    {title:'Vaikuntha: Menschen zusammenbringen',source:'Vereinsrepo · 3614506 und 4a215bf',prompt:'Beginnt bei Vaikuntha als Verein, getrennt von Vishnu Artists. Git-Stand vom 11.09.2026: Ein eigener Vereins-Compass ist vorhanden; Commit 3614506 betrifft verlegte Termine und Goa-Trip 1.3.0 mit Untergruppen und Frist 01.11. Prüft vor konkreten Terminbehauptungen die aktuelle Quelle. Welche eine organisatorische Entscheidung sollten wir jetzt zuerst treffen? Keine Mitgliederzahlen erfinden.'},
    {title:'Vom Holodeck zum wirklichen Gespräch',source:'flow-compass · 3278690; Benes aktueller Auftrag',prompt:'Beginnt mit dem Ziel eines flüssigen Holodeck-Gesprächs: Picard führt hinein, John und Madeleine sprechen, eingeladene Gäste erweitern die Perspektive. Die erste Bildanimation genügt mir nicht. Gewünscht sind echte 3D-Bewegung und ein roter Faden bis zu einer umsetzbaren Entscheidung. Nennt den wichtigsten noch offenen Schritt und fragt mich genau eine Sache dazu.'}
  ];
  for(const topic of topics){const button=el('button','holo3d-topic',topic.title);button.type='button';button.title=topic.source;button.addEventListener('click',()=>startTopic(topic));briefing.append(button);}
  const steps=el('div','holo3d-steps');
  for(const [title,prompt] of [['Entscheidung finden','Verdichtet unser Gespräch auf die anstehende Entscheidung. Nennt zwei konkrete Möglichkeiten mit Konsequenzen und stellt mir eine Entscheidungsfrage.'],['Nächsten Schritt benennen','Haltet fest, was wir tatsächlich entschieden haben. Falls noch nichts entschieden ist, sagt das klar. Nennt einen nächsten Schritt, Zuständigkeit und einen Termin nur wenn vereinbart. Nichts selbst buchen, versenden oder als erledigt darstellen.']]){
    const b=el('button','',title);b.type='button';b.addEventListener('click',()=>{const result=options.onBriefing?.({title,prompt});subtitle.textContent=result||'Der Auftrag steht im Gespräch.';chapter.textContent=title==='Entscheidung finden'?'03 / ENTSCHEIDEN':'04 / WEITERGEHEN';});steps.append(b);
  }briefing.append(steps);root.append(briefing);
  let entered=false,introTime=-1,introDone=false,autoBrief=false,guideSpeech=null,disposed=false,raf,previous=0,time=0,introStarted=0,frameCount=0,slowFrames=0;
  let orbitYaw=.5,orbitPitch=.36,orbitRadius=8.6,manualCamera=false,drag=null,scenePaused=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function say(text){subtitle.textContent=text;if(!hostVoice.checked || !window.speechSynthesis)return;window.speechSynthesis.cancel();guideSpeech=new SpeechSynthesisUtterance(text);guideSpeech.lang='de-DE';guideSpeech.rate=.96;const voices=window.speechSynthesis.getVoices();guideSpeech.voice=voices.find(v=>v.localService&&v.lang.startsWith('de'))||null;window.speechSynthesis.speak(guideSpeech);}
  function startTopic(topic){chapter.textContent='02 / VERSTEHEN';briefingTitle.textContent=topic.title;const result=options.onBriefing?.(topic);subtitle.textContent=result||'John und Madeleine nehmen den Faden auf.';}
  function enterScene(brief){if(entered)return;entered=true;autoBrief=brief;introTime=0;introStarted=performance.now()-(reduced?8000:0);welcome.hidden=true;captain.target.set(-2.6,0,1.7);captain.action='gehen';say('Willkommen an Bord, Bene. Komm mit. Wir schaffen Raum für das Wesentliche.');}
  enter.addEventListener('click',()=>enterScene(true));quiet.addEventListener('click',()=>enterScene(false));
  reset.addEventListener('click',()=>{orbitYaw=.5;orbitPitch=.36;orbitRadius=8.6;manualCamera=true;});
  walk.addEventListener('click',()=>{for(const a of Object.values(actors)){a.action='gehen';chooseTarget(a);}scenePaused=false;});
  dance.addEventListener('click',()=>{for(const a of Object.values(actors))a.action='tanzen';scenePaused=false;});
  rest.addEventListener('click',()=>{for(const a of Object.values(actors)){a.action='ruhe';a.target.copy(a.group.position);}scenePaused=false;});
  function chooseTarget(a){const angle=random()*Math.PI*2,r=2.4+random()*2.2;a.target.set(Math.cos(angle)*r,0,Math.sin(angle)*r);}
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),intersection=new THREE.Vector3();
  canvas.addEventListener('pointerdown',event=>{if(!introDone)return;drag={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!drag)return;manualCamera=true;orbitYaw-=(event.clientX-drag.lastX)*.006;orbitPitch=THREE.MathUtils.clamp(orbitPitch+(event.clientY-drag.lastY)*.004,.15,.85);drag.lastX=event.clientX;drag.lastY=event.clientY;});
  canvas.addEventListener('pointerup',event=>{if(!drag)return;const distance=Math.hypot(event.clientX-drag.x,event.clientY-drag.y);drag=null;if(distance>6)return;
    const rect=canvas.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);if(raycaster.ray.intersectPlane(floorPlane,intersection)){const r=Math.hypot(intersection.x,intersection.z);if(r>1.6&&r<6){actors.bene.target.copy(intersection);actors.bene.action='ziel';subtitle.textContent='Bene geht zu Deinem gewählten Platz.';}}
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',event=>{if(!introDone)return;event.preventDefault();orbitRadius=THREE.MathUtils.clamp(orbitRadius+event.deltaY*.008,5,13);manualCamera=true;},{passive:false});
  function animateActor(a,dt){
    const current=a.group.position,delta=a.target.clone().sub(current);delta.y=0;
    const distance=delta.length();let moving=(a.action==='gehen'||a.action==='ziel')&&distance>.045;
    if(moving){
      delta.normalize();
      // Steer around the meeting table and other bodies; avoid walking through the centre.
      if(Math.hypot(current.x,current.z)<2.2){const radial=new THREE.Vector3(current.x,0,current.z).normalize();if(delta.dot(radial)<-.15){const sign=Math.sign(current.x*a.target.z-current.z*a.target.x)||1;delta.set(-radial.z*sign,0,radial.x*sign).addScaledVector(radial,.15).normalize();}}
      for(const other of Object.values(actors)){if(other===a)continue;const away=current.clone().sub(other.group.position);away.y=0;const d=away.length();if(d>0&&d<.68)delta.addScaledVector(away.normalize(),(.68-d)*3).normalize();}
      const step=Math.min(distance,dt*.73);current.addScaledVector(delta,step);
      const targetAngle=Math.atan2(delta.x,delta.z);const difference=Math.atan2(Math.sin(targetAngle-a.group.rotation.y),Math.cos(targetAngle-a.group.rotation.y));a.group.rotation.y+=difference*(1-Math.exp(-dt*7));
      a.phase+=step*8.8;
    }else if(a.action==='gehen'&&introDone)chooseTarget(a);
    a.walk=THREE.MathUtils.damp(a.walk,moving&&!reduced?1:0,8,dt);
    const phase=a.phase,weight=a.walk,swing=Math.sin(phase)*.5*weight;
    a.legs[0].rotation.x=swing;a.legs[1].rotation.x=-swing;
    a.knees[0].rotation.x=Math.max(0,-Math.sin(phase))*.62*weight;a.knees[1].rotation.x=Math.max(0,Math.sin(phase))*.62*weight;
    a.arms[0].rotation.x=-swing*.68;a.arms[1].rotation.x=swing*.68;
    a.arms[0].rotation.z=.08;a.arms[1].rotation.z=-.08;a.elbows[0].rotation.x=a.elbows[1].rotation.x=-.12;
    a.body.position.y=.94+(reduced?0:Math.sin(phase*2)*.016*weight+Math.sin(time*1.4+a.phase)*.004);
    a.body.rotation.z=reduced?0:Math.sin(phase)*.016*weight;
    a.head.rotation.y=reduced?0:Math.sin(time*.6+a.phase)*.08*(1-weight);a.head.rotation.x=0;
    a.mouth.scale.y=a.speaking?1+Math.abs(Math.sin(time*13))*3:1;
    if(!reduced&&a.action==='tanzen'){a.body.position.y+=Math.abs(Math.sin(time*3.4))*.07;a.body.rotation.z=Math.sin(time*3.4)*.09;a.arms[0].rotation.z=.8+Math.sin(time*3.4)*.35;a.arms[1].rotation.z=-.9-Math.cos(time*3.4)*.35;a.legs[0].rotation.x=Math.sin(time*3.4)*.18;a.legs[1].rotation.x=-Math.sin(time*3.4)*.18;}
    if(!reduced&&a.action==='strecken'){a.arms[0].rotation.z=2.5;a.arms[1].rotation.z=-2.5;a.body.position.y+=.04;}
    if(!reduced&&(a.action==='winken'||(!entered&&a.who==='picard'))){a.arms[1].rotation.z=-1.0;a.elbows[1].rotation.x=-1.6;a.elbows[1].rotation.z=Math.sin(time*3)*.16;}
    if(!reduced&&a.action==='gaehnen'){a.head.rotation.x=-.12;a.arms[1].rotation.x=-.8;a.elbows[1].rotation.x=-1.7;a.mouth.scale.y=3;}
    if(a.speaking&&!moving&&!reduced){a.arms[0].rotation.x=-.22+Math.sin(time*2)*.12;a.elbows[0].rotation.x=-.5;}
  }
  const resize=new ResizeObserver(()=>{const w=root.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(root);
  function frame(now){
    if(disposed)return;raf=requestAnimationFrame(frame);
    if(document.hidden||!host.closest('dialog')?.open||scenePaused){if(entered&&!introDone&&previous)introStarted+=now-previous;previous=now;return;}
    const elapsed=(now-(previous||now))/1000,dt=Math.min(elapsed,.15);previous=now;time+=dt;
    root.dataset.frames=String(++frameCount);root.dataset.frameMs=String(Math.round(elapsed*1000));
    if(elapsed>.075)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
    if(slowFrames===12){renderer.setPixelRatio(.85);renderer.shadowMap.enabled=false;}
    if(slowFrames===35)renderer.setPixelRatio(.65);
    if(entered&&!introDone){
      introTime=(now-introStarted)/1000;const t=THREE.MathUtils.smoothstep(introTime,0,7.5);doors[0].position.x=-1.09-THREE.MathUtils.smoothstep(introTime,0,2)*2.1;doors[1].position.x=1.09+THREE.MathUtils.smoothstep(introTime,0,2)*2.1;
      camera.position.lerpVectors(new THREE.Vector3(0,1.72,11.7),new THREE.Vector3(4.1,3.5,7.2),t);look.lerpVectors(new THREE.Vector3(0,1.4,6),new THREE.Vector3(0,1.05,0),t);
      if(introTime>7.5){introDone=true;entry.visible=false;toolbar.hidden=false;briefing.hidden=false;captain.action='ruhe';captain.target.copy(captain.group.position);captain.group.rotation.y=0;chapter.textContent='02 / VERSTEHEN';if(guideSpeech){window.speechSynthesis?.cancel();guideSpeech=null;}if(autoBrief)startTopic(topics[location.hostname==='bene.vaikuntha.eu'?1:0]);else subtitle.textContent='Ziehe zum Umsehen. Klicke auf einen freien Platz, damit Bene dorthin geht.';}
    }
    if(introDone&&manualCamera){const desired=new THREE.Vector3(Math.sin(orbitYaw)*orbitRadius,1+Math.sin(orbitPitch)*orbitRadius,Math.cos(orbitYaw)*orbitRadius);camera.position.lerp(desired,1-Math.exp(-dt*6));look.lerp(new THREE.Vector3(0,1.1,0),1-Math.exp(-dt*6));}
    for(const actor of Object.values(actors))animateActor(actor,dt);
    cast.updateMatrixWorld(true);updateBatches(castBatches);
    camera.lookAt(look);renderer.render(scene,camera);root.dataset.drawCalls=String(renderer.info.render.calls);
  }
  function hidden(){if(document.hidden&&guideSpeech){window.speechSynthesis?.cancel();guideSpeech=null;}}
  document.addEventListener('visibilitychange',hidden);
  setPlace(options.place||'bar');raf=requestAnimationFrame(frame);
  return {
    setPlace,
    setAction(who,action){if(!actors[who])return;actors[who].action=action==='auto'?'gehen':action;if(actors[who].action==='gehen')chooseTarget(actors[who]);},
    setSpeaker(who){for(const actor of Object.values(actors))actor.speaking=actor.who===who;},
    setOutfit(who,index){const colors={bene:['#252d3d','#496578','#687258','#762c39','#223948','#ba743b','#485d96','#839088'],john:['#d9c8a9','#20293a','#d6b16c','#942c45','#386977','#e3d5be'],madeleine:['#273744','#926254','#385960','#ca9b59','#82735b','#663b4d']};if(actors[who])actors[who].clothM.color.set(colors[who]?.[index]||'#34505c');},
    pause(){scenePaused=true;if(guideSpeech){window.speechSynthesis?.cancel();guideSpeech=null;}},
    resume(){scenePaused=false;},
    dispose(){disposed=true;cancelAnimationFrame(raf);resize.disconnect();document.removeEventListener('visibilitychange',hidden);if(guideSpeech)window.speechSynthesis?.cancel();for(const b of [...castBatches,...envBatches])b.draw.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();renderer.dispose();root.remove();}
  };
}
