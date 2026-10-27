import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Judge} from '../src/pitch.js';
import {parseMidi} from '../src/midi.js';

const appSource=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
 .replace(/^import .*$/gm,'')
 .replaceAll('import.meta.url',JSON.stringify(new URL('../src/app.js',import.meta.url).href));
const song=parseMidi(readFileSync(new URL('../assets/song.mid',import.meta.url)));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

function harness({firstPlay,resume}={}){
 const elements=new Map();let now=5000,playCalls=0,resumeCalls=0;
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   value:id==='offset'?'5':id==='latency'?'120':'',
   currentTime:0,duration:15.650227,readyState:4,paused:true,ended:false,
   dataset:{},classList:{toggle(){}},addEventListener(){},focus(){},
   pause(){this.paused=true;},
   play(){this.paused=false;if(id==='performance'&&++playCalls===1&&firstPlay)return firstPlay.promise;return Promise.resolve();}
  });
  return elements.get(id);
 };
 const context={state:resume?'suspended':'running',resume(){resumeCalls++;return resume.promise.then(()=>{this.state='running';});}};
 const sandbox=vm.createContext({
  document:{getElementById:element,addEventListener(){}},window:{addEventListener(){}},
  performance:{now:()=>now},requestAnimationFrame:()=>1,cancelAnimationFrame(){},
  fetch:()=>new Promise(()=>{}),Judge,drawNotes(){},detectPitch:()=>null,midiName:()=>'',
  testSong:song,testContext:context
 });
 vm.runInContext(appSource,sandbox);
 vm.runInContext("song=testSong;compositor={draw(){}};micStream={getAudioTracks:()=>[{readyState:'live'}]};audioContext=testContext;",sandbox);
 return {
  call:code=>vm.runInContext(code,sandbox),
  video:element('performance'),result:element('result'),
  tick(delta){now+=delta;vm.runInContext(`tick(${now})`,sandbox);},
  get playCalls(){return playCalls;},get resumeCalls(){return resumeCalls;}
 };
}

test('an old rejected play promise cannot stop a newer attempt',async()=>{
 const pending=deferred(),h=harness({firstPlay:pending});
 const oldStart=h.call('start()');
 h.call("finish('interrupted')");
 await h.call('start()');
 assert.equal(h.call('playing'),true);
 pending.reject(new Error('Previous play was aborted'));
 await oldStart;
 assert.equal(h.call('playing'),true,'the previous attempt must not cancel the retry');
 assert.equal(h.video.paused,false);
});

test('repeated start while audio resume is pending starts only one attempt',async()=>{
 const pending=deferred(),h=harness({resume:pending});
 const first=h.call('start()'),second=h.call('start()');
 pending.resolve();
 await Promise.all([first,second]);
 assert.equal(h.resumeCalls,1,'audio resume must be requested once per attempt');
 assert.equal(h.playCalls,1,'repeated clicks must not restart video playback');
});

test('a video that stops advancing is interrupted even while animation frames continue',async()=>{
 const h=harness();await h.call('start()');
 h.video.currentTime=5.12;
 for(let i=0;i<55;i++)h.tick(50);
 assert.equal(h.call('playing'),false,'a stalled video must leave the active challenge');
 assert.equal(h.result.dataset.kind,'interrupted');
});
