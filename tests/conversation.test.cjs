const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function setup(fetchImpl, initial='[]') {
  let saved=initial;
  const source=fs.readFileSync(path.join(__dirname,'../compass-conversation.js'),'utf8').replace('  mount();\n  new MutationObserver',
    '  globalThis.testChat={submit(text,to="auto"){draft=text;target=to;return send();},stop(){controller?.abort();},state(){return {messages,error,busy}}};\n  mount();\n  new MutationObserver');
  const sandbox={JOHN_API:'http://localhost:8787',location:{protocol:'http:'},johnKontext:()=> 'Instance-specific context',
    localStorage:{getItem:()=>saved,setItem:(_,v)=>{saved=v;}},document:{querySelectorAll:()=>[],getElementById:()=>null,body:{}},
    MutationObserver:class{observe(){}},AbortController,setTimeout,clearTimeout,fetch:fetchImpl};
  vm.runInNewContext(source,sandbox);
  return {chat:sandbox.testChat,saved:()=>saved};
}
test('one speaker per turn; direct address switches and follow-up stays with that speaker',async()=>{
  const calls=[];const {chat}=setup(async(url,opts)=>{calls.push({url,data:JSON.parse(opts.body)});return {ok:true,json:async()=>({text:'Was ist dir dabei wichtig?'})};});
  await chat.submit('Ich möchte etwas klären.');
  assert.deepEqual(calls.map(c=>c.url),['http://localhost:8787/api/john']);
  await chat.submit('Madeleine, welche Zahlen brauchst du?');
  await chat.submit('Ich kann dir die Zahlen morgen geben.');
  assert.deepEqual(calls.map(c=>c.url),['http://localhost:8787/api/john','http://localhost:8787/api/madeleine','http://localhost:8787/api/madeleine']);
  assert(calls[2].data.messages.some(m=>m.content.startsWith('John:')));
  assert(calls[2].data.context.includes('Instance-specific context'));
  assert(calls[2].data.context.includes('warte danach auf seine Antwort'));
  await chat.submit('Was meinst du, John?');
  assert(calls.at(-1).url.endsWith('/john'));
});
test('explicit recipient wins; double sends do not cause duplicate model calls',async()=>{
  let release,count=0;const {chat}=setup(()=>{count++;return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({text:'Eine Antwort'})});});});
  const first=chat.submit('Meine Frage','madeleine');
  await Promise.resolve();
  await chat.submit('Noch ein Klick','john');
  assert.equal(count,1);release();await first;
  assert.equal(chat.state().messages.filter(m=>m.who==='user').length,1);
});
test('failed requests retain the submitted message, show an error, and never invent an answer',async()=>{
  const {chat,saved}=setup(async()=>({ok:false,status:503,json:async()=>({error:'AVATAR_NOT_CONNECTED'})}));
  await chat.submit('Meine Frage');
  assert.equal(chat.state().messages.length,1);
  assert(chat.state().error.includes('AVATAR_NOT_CONNECTED'));
  assert.equal(JSON.parse(saved())[0].text,'Meine Frage');
  assert.equal(chat.state().busy,'');
});
test('ending the wait cancels the request and releases the composer',async()=>{
  const {chat}=setup((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error(),{name:'AbortError'})))));
  const pending=chat.submit('Lange Frage');await Promise.resolve();chat.stop();await pending;
  assert.equal(chat.state().busy,'');assert(chat.state().error.includes('Warten beendet'));
});
