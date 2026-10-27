export const frequencyToMidi = frequency => 69+12*Math.log2(frequency/440);
export const JUDGEMENT=Object.freeze({toleranceCents:200,confirmationSeconds:.03,silenceSeconds:.25});
export const midiName = midi => {if(!Number.isFinite(midi))return '—';const n=Math.round(midi);return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((n%12)+12)%12]+(Math.floor(n/12)-1);};

// YIN cumulative mean normalized difference. Downsample before the quadratic loop.
export function detectPitch(buffer,sampleRate){
 let energy=0;for(const v of buffer)energy+=v*v;
 const rms=Math.sqrt(energy/buffer.length);if(rms<.012)return null;
 const stride=Math.max(1,Math.floor(sampleRate/12000)),rate=sampleRate/stride;
 const data=new Float32Array(Math.floor(buffer.length/stride));
 for(let i=0;i<data.length;i++){let sum=0;for(let j=0;j<stride;j++)sum+=buffer[i*stride+j];data[i]=sum/stride;}
 const max=Math.min(Math.floor(rate/55),Math.floor(data.length/2)-1),min=Math.floor(rate/2000);
 const diff=new Float32Array(max+1);let sum=0;diff[0]=1;
 for(let tau=1;tau<=max;tau++){
  let d=0;for(let i=0;i<data.length-max;i++){const delta=data[i]-data[i+tau];d+=delta*delta;}
  sum+=d;diff[tau]=sum?d*tau/sum:1;
 }
 for(let tau=Math.max(2,min);tau<max;tau++)if(diff[tau]<.15){
  while(tau+1<max&&diff[tau+1]<diff[tau])tau++;
  const a=diff[tau-1],b=diff[tau],c=diff[tau+1],den=2*(2*b-c-a);
  const refined=tau+(den?(c-a)/den:0),frequency=rate/refined;
  if(frequency<55||frequency>2000)return null;
  return {frequency,midi:frequencyToMidi(frequency),confidence:1-b,rms};
 }
 return null;
}

export class Judge {
 constructor(notes){this.notes=notes;this.result=null;this.misses=[];this.hits=[];this.seen=new Set();this.last=null;this.silent=0;this.index=-1;this.pending=null;}
 failPitch(pending,end){this.misses.push({index:pending.index,start:pending.start,end,midi:pending.midi});this.result='fail';}
 update(time,midi){
  if(this.result||time<0)return;
  if(!Number.isFinite(time)){this.result='interrupted';return;}
  const dt=this.last===null?0:time-this.last;
  if((this.last===null&&time>.20)||dt>.20||dt<-.01){this.result='interrupted';return;}
  this.last=time;
  const index=this.notes.findIndex(n=>time>=n.start&&time<n.end),previousIndex=this.index;this.index=index;
  if(previousIndex>=0&&previousIndex!==index&&!this.seen.has(previousIndex)){
   if(this.pending?.index===previousIndex)this.failPitch(this.pending,this.notes[previousIndex].end);
   else this.result='fail';
   return;
  }
  if(previousIndex!==index)this.pending=null;
  if(index<0){
   this.silent=0;this.pending=null;
   if(time>=this.notes.at(-1).end)this.result=this.seen.size===this.notes.length?'clear':'interrupted';
   return;
  }
  const note=this.notes[index];
  if(!Number.isFinite(midi)){
   this.silent+=dt;
   if(this.silent>=JUDGEMENT.silenceSeconds-1e-8)this.result='fail';
   return;
  }
  this.silent=0;
  if(time-note.start<.060||note.end-time<.025)return;
  const correct=Math.abs(midi-note.midi)<=JUDGEMENT.toleranceCents/100+1e-8;
  if(correct){
   this.pending=null;this.seen.add(index);
   const start=Math.max(note.start,time-dt),previous=this.hits.at(-1);
   if(previous&&previous.index===index&&start-previous.end<.04)previous.end=time;
   else this.hits.push({index,start,end:time});
   return;
  }
  if(!this.pending)this.pending={index,start:Math.max(note.start+.06,time-dt),first:time,midi};
  else if(time-this.pending.first>=JUDGEMENT.confirmationSeconds-1e-8)this.failPitch({...this.pending,midi},time);
 }
}
