import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMidi} from '../src/midi.js';
import {detectPitch, frequencyToMidi, Judge} from '../src/pitch.js';

const song = () => parseMidi(readFileSync(new URL('../assets/song.mid',import.meta.url)));
test('provided MIDI: all forty notes, real tempo and final duration',()=>{
 const s=song(); assert.equal(s.notes.length,40); assert.equal(s.notes[0].midi,60);
 assert.equal(s.notes.at(-1).midi,77); assert.ok(Math.abs(s.duration-10.397725)<0.00001);
 assert.ok(Math.abs(s.notes[1].start-0.340909)<0.00001);
});
test('YIN: low and high singing tones, harmonic-rich voice, silence and noise',()=>{
 for(const freq of [110,196,261.6256,440,880]){
  const a=Float32Array.from({length:4096},(_,i)=>.2*Math.sin(2*Math.PI*freq*i/48000)+.1*Math.sin(4*Math.PI*freq*i/48000));
  const p=detectPitch(a,48000); assert.ok(p); assert.ok(Math.abs(1200*Math.log2(p.frequency/freq))<12);
 }
 assert.equal(detectPitch(new Float32Array(4096),48000),null);
 const noise=Float32Array.from({length:4096},(_,i)=>.1*Math.sin(i*i*123.456));
 assert.equal(detectPitch(noise,48000),null); assert.equal(frequencyToMidi(440),69);
});
test('correct complete melody clears; octave error fails',()=>{
 const s=song(), j=new Judge(s.notes);
 for(let t=0;t<s.duration+.03;t+=.01){ const n=s.notes.find(n=>t>=n.start&&t<n.end); j.update(t,n?.midi??null); }
 assert.equal(j.result,'clear');
 const bad=new Judge(s.notes); for(let t=0;t<3;t+=.01) bad.update(t,72);
 assert.equal(bad.result,'fail');
});
test('silence and repeated short wrong notes fail, boundaries do not reset mistakes',()=>{
 for(const value of [null,48]){const j=new Judge(song().notes);for(let t=0;t<4;t+=.01)j.update(t,value);assert.equal(j.result,'fail');}
});
test('brief pitch deviation recovers; failed bar is recorded red',()=>{
 const j=new Judge(song().notes); for(let t=0;t<.3;t+=.01)j.update(t,t<.16?60:65);
 assert.equal(j.result,null); assert.ok(j.misses.length>0); assert.equal(j.misses[0].index,0);
});
test('skipping time cannot produce clear; missing notes cannot produce clear',()=>{
 const j=new Judge(song().notes); j.update(0,60); j.update(10.5,77);assert.equal(j.result,'interrupted');
 const k=new Judge(song().notes);k.update(11,null);assert.equal(k.result,'interrupted');
});
test('relaxed 200 cents inclusive, more than 200 rejected',()=>{
 for(const [offset,expected] of [[2,null],[2.01,'fail']]){const j=new Judge([{start:0,end:2,midi:60}]);for(let t=0;t<1.4;t+=.01)j.update(t,60+offset);assert.equal(j.result,expected);}
});

test('short misses are forgiven, but a sustained 1 second error still fails',()=>{
 const j=new Judge([{start:0,end:2,midi:60}]);
 for(let t=0;t<.85;t+=.01)j.update(t,66);
 assert.equal(j.result,null);
 for(let t=.85;t<1.4;t+=.01)j.update(t,66);
 assert.equal(j.result,'fail');
});

test('missed segments carry the actual sung pitch, including changes in pitch',()=>{
 const j=new Judge([{start:0,end:2,midi:60}]);
 for(let t=0;t<.35;t+=.01)j.update(t,67);
 for(let t=.35;t<.65;t+=.01)j.update(t,55);
 assert.ok(j.misses.some(m=>m.midi===67));assert.ok(j.misses.some(m=>m.midi===55));
 assert.ok(j.misses.every(m=>m.midi!==60));
});

test('a brief breath is tolerated and silence never creates a fake red pitch bar',()=>{
 const j=new Judge([{start:0,end:3,midi:60}]);
 for(let t=0;t<1.2;t+=.01)j.update(t,null);
 assert.equal(j.result,null);assert.equal(j.misses.length,0);
 for(let t=1.2;t<1.8;t+=.01)j.update(t,null);
 assert.equal(j.result,'fail');
});

test('returning from a tolerated breath does not instantly fail on one wrong pitch',()=>{
 const j=new Judge([{start:0,end:4,midi:60}]);
 for(let t=0;t<1.2;t+=.01)j.update(t,null);
 for(let t=1.2;t<1.4;t+=.01)j.update(t,65);
 assert.equal(j.result,null);
 for(let t=1.4;t<2.4;t+=.01)j.update(t,null);
 assert.equal(j.result,null);
 for(let t=2.4;t<3.6;t+=.01)j.update(t,65);
 assert.equal(j.result,'fail');
});

test('brief unvoiced detection gaps do not erase a sustained wrong melody',()=>{
 const j=new Judge([{start:0,end:3,midi:60}]);
 for(let i=0;i<200;i++)j.update(i/100,i%15===0?null:65);
 assert.equal(j.result,'fail');
});

test('correct singing records yellow segments while future notes stay unrecorded',()=>{
 const j=new Judge([{start:0,end:1,midi:60},{start:1,end:2,midi:62}]);
 for(let t=0;t<.4;t+=.01)j.update(t,61.3);
 assert.ok(j.hits.length>0);assert.ok(j.hits.every(h=>h.index===0&&h.end<=.4));
 assert.equal(j.misses.length,0);
 for(let t=.4;t<.55;t+=.01)j.update(t,66);
 assert.ok(j.misses.length>0);assert.ok(j.hits.at(-1).end<=.4);
 const retry=new Judge(j.notes);assert.equal(retry.hits.length,0);
});
test('rests do not count as silence; new attempt has no stale result',()=>{
 const j=new Judge([{start:.5,end:1,midi:60}]);for(let t=0;t<1.05;t+=.01)j.update(t,t<.5?null:60);assert.equal(j.result,'clear');
 assert.equal(new Judge(song().notes).misses.length,0);
});
