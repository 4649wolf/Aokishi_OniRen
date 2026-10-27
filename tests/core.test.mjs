import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMidi,transposeSong} from '../src/midi.js';
import {detectPitch,frequencyToMidi,Judge} from '../src/pitch.js';
const song=()=>parseMidi(readFileSync(new URL('../assets/song.mid',import.meta.url)));

test('provided MIDI: forty notes, tempo and exact duration',()=>{
 const s=song();assert.equal(s.notes.length,40);assert.equal(s.notes[0].midi,60);assert.equal(s.notes.at(-1).midi,77);assert.ok(Math.abs(s.duration-10.397725)<.00001);assert.ok(Math.abs(s.notes[1].start-.340909)<.00001);
});
test('transpose -24 to +12 without changing time or source',()=>{
 const original=song();for(const shift of [-24,-13,-12,-1,0,1,12]){const s=transposeSong(original,shift);assert.equal(s.duration,original.duration);s.notes.forEach((n,i)=>{assert.equal(n.midi,original.notes[i].midi+shift);assert.equal(n.start,original.notes[i].start);assert.equal(n.end,original.notes[i].end);});}
 assert.equal(original.notes[0].midi,60);assert.throws(()=>transposeSong(original,-25));assert.throws(()=>transposeSong(original,13));assert.throws(()=>transposeSong(original,.5));
});
test('YIN covers shifted bass and high notes, harmonics, silence and noise',()=>{
 for(const rate of [44100,48000])for(const freq of [36.708,65.406,73.416,110,196,261.6256,440,880,1760]){const a=Float32Array.from({length:4096},(_,i)=>.2*Math.sin(2*Math.PI*freq*i/rate)+.1*Math.sin(4*Math.PI*freq*i/rate));const p=detectPitch(a,rate);assert.ok(p,`detect ${freq} at ${rate}`);assert.ok(Math.abs(1200*Math.log2(p.frequency/freq))<15,`accuracy ${freq} at ${rate}`);}
 assert.equal(detectPitch(new Float32Array(4096),48000),null);assert.equal(detectPitch(Float32Array.from({length:4096},(_,i)=>.1*Math.sin(i*i*123.456)),48000),null);assert.equal(frequencyToMidi(440),69);
});
test('complete correct melody clears at original and transposed keys',()=>{
 for(const shift of [-24,-12,0,12]){const s=transposeSong(song(),shift),j=new Judge(s.notes);for(let t=0;t<s.duration+.03;t+=.01){const n=s.notes.find(n=>t>=n.start&&t<n.end);j.update(t,n?.midi??null);}assert.equal(j.result,'clear');}
});
test('the first confirmed red segment and failure occur in the same update',()=>{
 const j=new Judge([{start:0,end:1,midi:60}]);j.update(0,65);j.update(.07,65);j.update(.09,65);assert.equal(j.result,null);assert.equal(j.misses.length,0);j.update(.11,65);assert.equal(j.result,'fail');assert.equal(j.misses.length,1);assert.equal(j.misses[0].midi,65);
});
test('one unstable pitch sample is not painted red and recovers',()=>{
 const j=new Judge([{start:0,end:1,midi:60}]);for(let t=0;t<.1;t+=.01)j.update(t,60);j.update(.11,72);j.update(.125,60);assert.equal(j.result,null);assert.equal(j.misses.length,0);
});
test('continuously wrong changing pitches cannot reset confirmation forever',()=>{
 const j=new Judge([{start:0,end:1,midi:60}]);for(let i=0;i<100;i++)j.update(i/100,i<10?60:i%2?65:66);assert.equal(j.result,'fail');assert.equal(j.misses.length,1);
});
test('short unpitched gaps cannot hide a sustained wrong phrase',()=>{
 const j=new Judge([{start:0,end:1,midi:60}]);for(let i=0;i<100;i++)j.update(i/100,i<10?60:i%2?65:null);assert.equal(j.result,'fail');
});
test('red is drawn at the sung pitch, for errors above and below the target',()=>{
 for(const midi of [55,65]){const j=new Judge([{start:0,end:1,midi:60}]);for(let t=0;t<.2;t+=.01)j.update(t,midi);assert.equal(j.result,'fail');assert.equal(j.misses[0].midi,midi);assert.notEqual(j.misses[0].midi,60);}
});
test('250ms without a detectable pitch fails without inventing a red pitch',()=>{
 const j=new Judge([{start:0,end:1,midi:60}]);for(let t=0;t<.24;t+=.01)j.update(t,null);assert.equal(j.result,null);j.update(.26,null);assert.equal(j.result,'fail');assert.equal(j.misses.length,0);
});
test('note boundary grace cannot hide a long silence across short notes',()=>{
 const notes=Array.from({length:8},(_,i)=>({start:i*.12,end:(i+1)*.12,midi:60})),j=new Judge(notes);for(let t=0;t<.35;t+=.01)j.update(t,null);assert.equal(j.result,'fail');
});
test('noise with no detected pitch follows the same short silence rule',()=>{
 for(const invalid of [null,NaN,Infinity]){const j=new Judge([{start:0,end:1,midi:60}]);for(let t=0;t<.35;t+=.01)j.update(t,invalid);assert.equal(j.result,'fail');}
});
test('200 cents inclusive, errors outside the range fail promptly',()=>{
 for(const [offset,result] of [[2,null],[2.01,'fail']]){const j=new Judge([{start:0,end:1,midi:60}]);for(let t=0;t<.3;t+=.01)j.update(t,60+offset);assert.equal(j.result,result);}
});
test('correct singing colors only passed notes and a retry clears history',()=>{
 const j=new Judge([{start:0,end:1,midi:60},{start:1,end:2,midi:62}]);for(let t=0;t<.4;t+=.01)j.update(t,61.3);assert.ok(j.hits.length);assert.ok(j.hits.every(h=>h.index===0&&h.end<=.4));assert.equal(new Judge(j.notes).hits.length,0);
});
test('rests and count-in are exempt from silence failure',()=>{
 const j=new Judge([{start:.5,end:1,midi:60}]);for(let t=-1;t<1.05;t+=.01)j.update(t,t<.5?null:60);assert.equal(j.result,'clear');
});
test('skipping time and missing graded notes cannot clear',()=>{
 const j=new Judge(song().notes);j.update(0,60);j.update(10.5,77);assert.equal(j.result,'interrupted');const k=new Judge(song().notes);k.update(11,null);assert.equal(k.result,'interrupted');
});
