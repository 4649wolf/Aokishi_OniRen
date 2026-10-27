// Standard MIDI File reader: variable-length deltas, running status and tempo map.
export function transposeSong(song,semitones){
 if(!Number.isInteger(semitones)||Math.abs(semitones)>12)throw Error('ノートの高さは-12〜+12半音です');
 return {...song,notes:song.notes.map(note=>({...note,midi:note.midi+semitones}))};
}

export function parseMidi(input) {
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const text=(p,n)=>String.fromCharCode(...bytes.subarray(p,p+n));
 if(text(0,4)!=='MThd'||view.getUint32(4)<6)throw Error('MIDIヘッダーが不正です');
 const format=view.getUint16(8), count=view.getUint16(10), division=view.getUint16(12);
 if(format>1||(division&0x8000)||!division)throw Error('未対応のMIDI形式です');
 let pos=8+view.getUint32(4);const events=[];
 for(let track=0;track<count;track++){
  if(text(pos,4)!=='MTrk')throw Error('MIDIトラックが不正です');
  const end=pos+8+view.getUint32(pos+4);let i=pos+8,tick=0,running=0;
  if(end>bytes.length)throw Error('MIDIが途中で切れています');
  const vlq=()=>{let value=0;for(let n=0;n<4;n++){if(i>=end)throw Error('不正なMIDI長です');const b=bytes[i++];value=value*128+(b&127);if(b<128)return value;}throw Error('不正なMIDI値です');};
  while(i<end){
   tick+=vlq();let status=bytes[i];if(status>=128)i++;else status=running;
   if(!status)throw Error('不正なMIDIステータスです');
   if(status===255){const type=bytes[i++],len=vlq();if(type===81&&len===3)events.push({tick,kind:'tempo',value:bytes[i]*65536+bytes[i+1]*256+bytes[i+2]});i+=len;}
   else if(status===240||status===247){const len=vlq();i+=len;running=0;}
   else{
    running=status;const kind=status>>4,channel=status&15,a=bytes[i++],b=(kind===12||kind===13)?0:bytes[i++];
    if((kind===8||kind===9)&&channel!==9)events.push({tick,kind:kind===9&&b>0?'on':'off',note:a,channel,track});
   }
   if(i>end)throw Error('不正なMIDIイベントです');
  }
  pos=end;
 }
 events.sort((a,b)=>a.tick-b.tick||(a.kind==='tempo'?-1:b.kind==='tempo'?1:0));
 let tempo=500000,last=0,time=0;const active=new Map(),notes=[];
 for(const event of events){
  time+=(event.tick-last)*tempo/division/1e6;last=event.tick;
  const key=`${event.track}:${event.channel}:${event.note}`;
  if(event.kind==='tempo')tempo=event.value;
  else if(event.kind==='on')active.set(key,time);
  else if(active.has(key)){const start=active.get(key);active.delete(key);if(time>start)notes.push({start,end:time,midi:event.note});}
 }
 notes.sort((a,b)=>a.start-b.start);
 if(!notes.length)throw Error('MIDIに音程がありません');
 return {notes,duration:Math.max(...notes.map(n=>n.end))};
}
