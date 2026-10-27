export function createCompositor(canvas,video){
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
 if(!gl) return createCanvasFallback(canvas,video);
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('映像処理を初期化できません');return s;};
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){gl_Position=vec4(p,0.,1.);uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float; varying vec2 uv; uniform sampler2D tex;
 void main(){vec4 c=texture2D(tex,uv);float green=c.g-max(c.r,c.b);float a=1.-smoothstep(.10,.38,green);c.g=min(c.g,max(c.r,c.b)+.10);gl_FragColor=vec4(c.rgb*.82,a);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('映像処理に失敗しました');gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const location=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 let lost=false;canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;});
 return {kind:'webgl',draw(){if(lost)throw Error('映像処理が中断されました。ページを再読み込みしてください。');if(video.readyState<2)return;gl.viewport(0,0,canvas.width,canvas.height);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}};
}
function createCanvasFallback(canvas,video){
 canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('映像を描画できません');
 return {kind:'canvas2d',draw(){if(video.readyState<2)return;ctx.drawImage(video,0,0,960,540);const frame=ctx.getImageData(0,0,960,540),d=frame.data;for(let i=0;i<d.length;i+=4){const m=Math.max(d[i],d[i+2]),g=d[i+1]-m;d[i+3]=255*(1-Math.min(1,Math.max(0,(g-26)/71)));d[i]*=.82;d[i+1]=Math.min(d[i+1],m+26)*.82;d[i+2]*=.82;}ctx.putImageData(frame,0,0);}};
}

// Coordinates measured against the provided 1920x1080 video, inside its black band.
export function drawNotes(canvas,song,time,judge,pitch){
 const ctx=canvas.getContext('2d'),x=310,y=867,w=1575,h=174,pageLength=60/176*8;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 const page=Math.max(0,Math.min(3,Math.floor(Math.max(0,time)/pageLength))),start=page*pageLength,end=Math.min(start+pageLength,song.duration),span=end-start;
 const px=t=>x+Math.max(0,Math.min(1,(t-start)/span))*w;
 const visible=song.notes.filter(n=>n.end>start&&n.start<end),low=Math.min(...visible.map(n=>n.midi)),high=Math.max(...visible.map(n=>n.midi));
 const range=Math.max(12,high-low+4),center=(low+high)/2;
 const py=midi=>y+h/2-(midi-center)/range*(h-28);
 ctx.fillStyle='#030406';ctx.fillRect(x-6,y-4,w+14,h+16);
 ctx.strokeStyle='#202632';ctx.lineWidth=1;
 for(let midi=Math.ceil((center-range/2)/3)*3;midi<=center+range/2;midi+=3){ctx.beginPath();ctx.moveTo(x,py(midi));ctx.lineTo(x+w,py(midi));ctx.stroke();}
 ctx.lineCap='round';ctx.lineWidth=11;
 const line=(a,b,note,color)=>{if(b<=start||a>=end)return;const left=px(a)+8,right=px(b)-8;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(left,py(note.midi));ctx.lineTo(Math.max(left+.5,right),py(note.midi));ctx.stroke();};
 song.notes.forEach(n=>line(n.start,n.end,n,'#fff'));
 for(const miss of judge?.misses??[])line(miss.start,miss.end,song.notes[miss.index],'#ff4f59');
 if(time>=0){const cursor=px(time);ctx.shadowColor='#66a4ff';ctx.shadowBlur=14;ctx.strokeStyle='#89b9ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cursor,y-2);ctx.lineTo(cursor,y+h);ctx.stroke();ctx.shadowBlur=0;
  if(Number.isFinite(pitch)){const n=song.notes[judge?.index];ctx.fillStyle=n&&Math.abs(pitch-n.midi)>1?'#ff565e':'#88baff';ctx.beginPath();ctx.arc(cursor,Math.max(y+7,Math.min(y+h-7,py(pitch))),7,0,Math.PI*2);ctx.fill();}
 }
 ctx.font='15px sans-serif';ctx.fillStyle='#8291ab';ctx.textAlign='right';ctx.fillText(`${page+1} / 4`,x+w,y+h+9);
}
