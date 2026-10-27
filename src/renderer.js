import {JUDGEMENT} from './pitch.js';
import {keyThresholds,applyChroma} from './chroma.js';

export function createCompositor(canvas,video,options={}){
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
 if(!gl) return createCanvasFallback(canvas,video,options);
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('映像処理を初期化できません');return s;};
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){gl_Position=vec4(p,0.,1.);uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float; varying vec2 uv; uniform sampler2D tex;
 uniform float keyMode;uniform float keyLow;uniform float keyHigh;uniform float brightness;
 void main(){vec4 c=texture2D(tex,uv);float a=1.;if(keyMode>.5){float dominance=keyMode<1.5?c.g-max(c.r,c.b):c.b-max(c.r,c.g);a=1.-smoothstep(keyLow,keyHigh,dominance);if(keyMode<1.5)c.g=min(c.g,max(c.r,c.b)+.10);else c.b=min(c.b,max(c.r,c.g)+.10);}gl_FragColor=vec4(c.rgb*brightness,c.a*a);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('映像処理に失敗しました');gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const location=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 const uniforms=Object.fromEntries(['keyMode','keyLow','keyHigh','brightness'].map(name=>[name,gl.getUniformLocation(program,name)]));
 let lost=false;canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;});
 return {kind:'webgl',draw(){
  if(lost)throw Error('映像処理が中断されました。ページを再読み込みしてください。');if(video.readyState<2)return;
  const key=options.key??'green',[low,high]=keyThresholds(options.strength??50);
  gl.uniform1f(uniforms.keyMode,key==='green'?1:key==='blue'?2:0);gl.uniform1f(uniforms.keyLow,low);gl.uniform1f(uniforms.keyHigh,high);gl.uniform1f(uniforms.brightness,options.brightness??.82);
  gl.viewport(0,0,canvas.width,canvas.height);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }};
}
function createCanvasFallback(canvas,video,options){
 canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('映像を描画できません');
 return {kind:'canvas2d',draw(){if(video.readyState<2)return;ctx.drawImage(video,0,0,canvas.width,canvas.height);const frame=ctx.getImageData(0,0,canvas.width,canvas.height);applyChroma(frame.data,options);ctx.putImageData(frame,0,0);}};
}

// Coordinates measured against the provided 1920x1080 video, inside its black band.
export function drawNotes(canvas,song,time,judge,pitch){
 const ctx=canvas.getContext('2d'),x=310,y=867,w=1575,h=174,pageLength=60/176*8;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 const page=Math.max(0,Math.min(3,Math.floor(Math.max(0,time)/pageLength))),start=page*pageLength,end=Math.min(start+pageLength,song.duration),span=end-start;
 const px=t=>x+Math.max(0,Math.min(1,(t-start)/span))*w;
 const visible=song.notes.filter(n=>n.end>start&&n.start<end);
 const traces=(judge?.misses??[]).filter(m=>m.end>start&&m.start<end&&Number.isFinite(m.midi));
 const pitches=[...visible.map(n=>n.midi),...traces.map(m=>m.midi)],low=Math.min(...pitches),high=Math.max(...pitches);
 const range=Math.max(12,high-low+4),center=(low+high)/2;
 const py=midi=>y+h/2-(midi-center)/range*(h-28);
 ctx.fillStyle='#030406';ctx.fillRect(x-6,y-4,w+14,h+16);
 ctx.strokeStyle='#202632';ctx.lineWidth=1;
 for(let midi=Math.ceil((center-range/2)/3)*3;midi<=center+range/2;midi+=3){ctx.beginPath();ctx.moveTo(x,py(midi));ctx.lineTo(x+w,py(midi));ctx.stroke();}
 ctx.lineCap='round';ctx.lineWidth=18;
 const line=(a,b,note,color,gap=12)=>{if(b<=start||a>=end)return;const left=px(a)+gap,right=px(b)-gap;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(left,py(note.midi));ctx.lineTo(Math.max(left+.5,right),py(note.midi));ctx.stroke();};
 song.notes.forEach(n=>line(n.start,n.end,n,'#fff'));
 for(const hit of judge?.hits??[]){
  const note=song.notes[hit.index];
  const a=hit.start-note.start<.1?note.start:hit.start;
  const b=time>=note.end&&note.end-hit.end<.05?note.end:hit.end;
  line(a,b,note,'#ffe600');
 }
 for(const miss of traces)line(miss.start,miss.end,{midi:miss.midi},'#ff4f59',0);
 if(time>=0){const cursor=px(time);ctx.shadowColor='#66a4ff';ctx.shadowBlur=14;ctx.strokeStyle='#89b9ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cursor,y-2);ctx.lineTo(cursor,y+h);ctx.stroke();ctx.shadowBlur=0;
  if(Number.isFinite(pitch)){const n=song.notes[judge?.index];ctx.fillStyle=n&&Math.abs(pitch-n.midi)>JUDGEMENT.toleranceCents/100?'#ff565e':'#ffe600';ctx.beginPath();ctx.arc(cursor,Math.max(y+7,Math.min(y+h-7,py(pitch))),7,0,Math.PI*2);ctx.fill();}
 }
 ctx.font='15px sans-serif';ctx.fillStyle='#8291ab';ctx.textAlign='right';ctx.fillText(`${page+1} / 4`,x+w,y+h+9);
 if(time<0)drawCountdown(ctx);
}

function drawCountdown(ctx){
 ctx.save();ctx.beginPath();
 const points=[[1626,282],[1832,282],[1886,335],[1846,416],[1762,416],[1744,440],[1782,460],[1704,442],[1724,416],[1626,416],[1596,348]];
 points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
 ctx.shadowColor='#14051de6';ctx.shadowBlur=16;ctx.shadowOffsetY=5;ctx.fillStyle='#591778';ctx.fill();
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.lineJoin='round';ctx.lineWidth=7;ctx.strokeStyle='#fff4dc';ctx.stroke();
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 49px "Yu Gothic",Meiryo,sans-serif';ctx.fillText('歌い出し',1743,339);ctx.font='bold 52px "Yu Gothic",Meiryo,sans-serif';ctx.fillText('まで',1743,398);ctx.restore();
}
