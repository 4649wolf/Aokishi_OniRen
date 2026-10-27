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
 const bad=new Judge(s.notes); for(let t=0;t<.4;t+=.01) bad.update(t,72);
 assert.equal(bad.result,'fail');
});
test('silence and repeated short wrong notes fail, boundaries do not reset mistakes',()=>{
 for(const value of [null,48]){const j=new Judge(song().notes);for(let t=0;t<1;t+=.01)j.update(t,value);assert.equal(j.result,'fail');}
});
test('brief pitch deviation recovers; failed bar is recorded red',()=>{
 const j=new Judge(song().notes); for(let t=0;t<.3;t+=.01)j.update(t,t<.16?60:65);
 assert.equal(j.result,null); assert.ok(j.misses.length>0); assert.equal(j.misses[0].index,0);
});
test('skipping time cannot produce clear; missing notes cannot produce clear',()=>{
 const j=new Judge(song().notes); j.update(0,60); j.update(10.5,77);assert.equal(j.result,'interrupted');
 const k=new Judge(song().notes);k.update(11,null);assert.equal(k.result,'interrupted');
});
test('100 cents inclusive, more than 100 rejected',()=>{
 for(const [offset,expected] of [[1,null],[1.01,'fail']]){const j=new Judge([{start:0,end:1,midi:60}]);for(let t=0;t<.6;t+=.01)j.update(t,60+offset);assert.equal(j.result,expected);}
});
test('rests do not count as silence; new attempt has no stale result',()=>{
 const j=new Judge([{start:.5,end:1,midi:60}]);for(let t=0;t<1.05;t+=.01)j.update(t,t<.5?null:60);assert.equal(j.result,'clear');
 assert.equal(new Judge(song().notes).misses.length,0);
});
