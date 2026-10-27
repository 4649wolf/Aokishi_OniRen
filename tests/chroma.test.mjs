import {test} from 'node:test';
import assert from 'node:assert/strict';
import {keyAlpha,keyThresholds,applyChroma} from '../src/chroma.js';

test('green and blue key remove only the selected background color',()=>{
 assert.equal(keyAlpha(0,255,0,'green',50),0);
 assert.equal(keyAlpha(0,0,255,'blue',50),0);
 assert.equal(keyAlpha(0,255,0,'blue',50),1);
 assert.equal(keyAlpha(0,0,255,'green',50),1);
 for(const key of ['off','green','blue'])assert.equal(keyAlpha(190,130,100,key,50),1);
 assert.equal(keyAlpha(0,255,0,'off',50),1);
});
test('strength increases removal while preserving unrelated color and soft edges',()=>{
 assert.ok(keyAlpha(50,100,50,'green',90)<keyAlpha(50,100,50,'green',10));
 const alpha=keyAlpha(50,110,50,'green',50);assert.ok(alpha>0&&alpha<1);
 const [low,high]=keyThresholds(500);assert.ok(low>=0&&high>low&&high<=1);
});
test('CPU fallback preserves transparency and subjects, and off preserves green clothes',()=>{
 for(const [key,pixel] of [['green',[0,255,0,255]],['blue',[0,0,255,255]]]){
  const d=new Uint8ClampedArray([...pixel,200,120,90,255,0,0,0,0]);
  applyChroma(d,{key,strength:50,brightness:1});
  assert.equal(d[3],0);assert.equal(d[7],255);assert.equal(d[11],0);assert.equal(d[4],200);
 }
 const d=new Uint8ClampedArray([0,255,0,255]);applyChroma(d,{key:'off',brightness:1});assert.deepEqual([...d],[0,255,0,255]);
});
