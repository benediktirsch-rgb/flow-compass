// Original procedural room beds and restrained harmonic score. No recording,
// network request, sampled song, or AudioContext exists before explicit activation.
const palettes={
 enterprise:{root:82.41,notes:[0,7,12,19],beat:1.3,noise:180,air:.025},
 bar:{root:146.83,notes:[0,3,7,10,14],beat:.83,noise:460,air:.045},
 huette:{root:130.81,notes:[0,7,12,16,19],beat:1.07,noise:280,air:.04},
 goa:{root:110,notes:[0,7,10,14,17],beat:.64,noise:760,air:.06},
 anden:{root:146.83,notes:[0,7,12,14,19],beat:1.2,noise:560,air:.052},
 rom:{root:164.81,notes:[0,4,7,11,14],beat:.92,noise:630,air:.035}
};
export function createStudioAudio(onState=()=>{}) {
 let ctx,master,room,music,noiseSource,filter,airLfo,airDepth,timer,enabled=false,starting=false,disposed=false;
 let place='bar',mood='ruhe',volume=.45,musicLevel=.4,ducked=false,tick=0,generation=0;
 const playing=new Set();
 function ramp(param,value,seconds=.3){if(!ctx)return;param.cancelScheduledValues(ctx.currentTime);param.setTargetAtTime(value,ctx.currentTime,seconds);}
 function levels(){if(!ctx)return;ramp(master.gain,enabled?volume:0,.08);ramp(room.gain,palettes[place].air*(ducked?.3:1),.2);ramp(music.gain,musicLevel*(ducked?.16:1),ducked?.07:.55);}
 function tone(freq,at,length,gain=.075,kind='sine'){
  const osc=ctx.createOscillator(),env=ctx.createGain();osc.type=kind;osc.frequency.value=freq;
  env.gain.setValueAtTime(0,at);env.gain.linearRampToValueAtTime(gain,at+.02);env.gain.exponentialRampToValueAtTime(.0001,at+length);
  osc.connect(env);env.connect(music);osc.start(at);osc.stop(at+length+.05);playing.add(osc);
  osc.onended=()=>{playing.delete(osc);osc.disconnect();env.disconnect();};
 }
 function step(){
  if(!enabled||disposed||ctx.state!=='running')return;
  const p=palettes[place],t=ctx.currentTime+.035;
  const density=mood==='feier'?1:mood==='business'?2:4;
  if(tick%density===0&&musicLevel>0){
   const progression=[0,0,-5,-5,-3,-3,0,0],bar=Math.floor(tick/16),degree=p.notes[Math.floor(tick/density)%p.notes.length];
   tone(p.root*Math.pow(2,(degree+progression[bar%8])/12),t,mood==='konflikt'?1.2:3.5,.075,place==='rom'?'triangle':'sine');
   if(tick%8===0)tone(p.root/2*Math.pow(2,progression[bar%8]/12),t,2.8,.085);
   if(place==='goa'&&mood==='feier')tone(55,t,.25,.12);
  }
  tick++;timer=setTimeout(step,p.beat*1000);
 }
 async function start(){
  if(disposed||enabled||starting)return enabled;starting=true;const version=++generation;
  try {
   const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Web Audio unavailable');
   if(!ctx){
    ctx=new Context();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    room=ctx.createGain();room.gain.value=0;room.connect(master);music=ctx.createGain();music.gain.value=0;music.connect(master);
    const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),data=buffer.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.015;data[i]=brown*2;}
    noiseSource=ctx.createBufferSource();noiseSource.buffer=buffer;noiseSource.loop=true;
    filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=palettes[place].noise;noiseSource.connect(filter);filter.connect(room);noiseSource.start();
    airLfo=ctx.createOscillator();airLfo.frequency.value=.11;airDepth=ctx.createGain();airDepth.gain.value=110;airLfo.connect(airDepth);airDepth.connect(filter.frequency);airLfo.start();
   }
   await ctx.resume();if(disposed||version!==generation){if(ctx.state!=='closed')await ctx.suspend();return false;}
   enabled=true;levels();clearTimeout(timer);step();onState(true);return true;
  }catch{enabled=false;onState(false,'Raumklang konnte nicht starten.');return false;}finally{starting=false;}
 }
 function stop(){generation++;enabled=false;clearTimeout(timer);if(ctx&&ctx.state!=='closed'){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setValueAtTime(0,ctx.currentTime);for(const osc of playing){try{osc.stop();}catch{}}playing.clear();void ctx.suspend().catch(()=>{});}onState(false);}
 return {start,stop,setScene(next,nextMood='ruhe'){if(!palettes[next])return;place=next;mood=nextMood;tick=0;if(ctx){ramp(filter.frequency,palettes[place].noise,1.2);levels();}},setVoice(active){ducked=Boolean(active);levels();},setVolume(value){volume=Math.max(0,Math.min(.8,Number(value)||0));levels();},setMusic(value){musicLevel=Math.max(0,Math.min(.7,Number(value)||0));levels();},getState(){return {enabled,ducked,place,mood,contextState:ctx?.state||'uncreated'};},dispose(){disposed=true;stop();if(ctx&&ctx.state!=='closed')void ctx.close();}};
}
