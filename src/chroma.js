export function keyThresholds(strength=50){
 const t=Math.max(0,Math.min(100,Number.isFinite(Number(strength))?Number(strength):50))/100;
 return [Math.max(.025,.22-.24*t),.50-.24*t];
}
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function keyAlpha(r,g,b,key='green',strength=50){
 if(key!=='green'&&key!=='blue')return 1;
 const [low,high]=keyThresholds(strength),dominance=(key==='green'?g-Math.max(r,b):b-Math.max(r,g))/255;
 return 1-smooth((dominance-low)/(high-low));
}
export function applyChroma(data,{key='green',strength=50,brightness=.82}={}){
 const [low,high]=keyThresholds(strength),selected=key==='green'?1:key==='blue'?2:0;
 for(let i=0;i<data.length;i+=4){
  const r=data[i],g=data[i+1],b=data[i+2];
  if(selected){const other=selected===1?Math.max(r,b):Math.max(r,g),dominance=(data[i+selected]-other)/255;data[i+3]*=1-smooth((dominance-low)/(high-low));data[i+selected]=Math.min(data[i+selected],other+25.5);}
  data[i]*=brightness;data[i+1]*=brightness;data[i+2]*=brightness;
 }
 return data;
}
