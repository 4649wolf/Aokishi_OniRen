import {parseMidi} from './midi.js';
import {detectPitch,Judge} from './pitch.js';
import {createCompositor,drawNotes} from './renderer.js';

const $=id=>document.getElementById(id);
const video=$('performance'),camera=$('camera'),practice=$('practice');
let song,compositor,micStream,cameraStream,audioContext,analyser,micSource;
const offset=5,latency=.120;
let frameBuffer=new Float32Array(4096),judge,playing=false,busy=false,run=0;
let latestPitch=null,lastFrame=0,lastVideo=-1,frame=0,listenCount=0,stopping=false,starting=false,lastMediaTime=0,lastProgress=0;
const active=()=>micStream?.getAudioTracks().some(t=>t.readyState==='live');
const message=(text,error=false)=>{$('device-message').textContent=text;$('device-message').classList.toggle('error',error);};
const phase=text=>{$('phase').textContent=text;};
const mediaError=(error,kind)=>{
 if(error.name==='NotAllowedError'||error.name==='SecurityError')return `${kind}が許可されていません。ブラウザーのサイト設定で許可してから、もう一度接続してください。`;
 if(error.name==='NotFoundError')return `${kind}が見つかりません。端末への接続を確認してください。`;
 if(error.name==='NotReadableError')return `${kind}を使用できません。他のアプリで使っていないか確認してください。`;
 return `${kind}を開始できませんでした。接続とブラウザーの設定を確認してください。`;
};
function refreshControls(){
 $('start').disabled=!song||!compositor||!active()||playing||busy||starting;
 $('retry').disabled=!active()||busy||starting;
 $('mic-button').disabled=playing||busy||starting||active();$('camera-button').disabled=playing||busy||starting;
 $('mic-button').classList.toggle('connected',!!active());$('mic-button').textContent=active()?'マイク接続済み':'マイクを接続';
 $('camera-button').classList.toggle('connected',!!cameraStream);$('camera-button').textContent=cameraStream?'カメラをオフ':'カメラを接続（任意）';
 $('release').hidden=!(micStream||cameraStream);$('release').disabled=playing||busy||starting;$('stop').hidden=!playing;
 practice.controls=!playing;$('loop').disabled=playing;
}
async function connectMic(){
 if(busy||playing)return;const token=run;busy=true;refreshControls();message('マイクの許可を待っています…');
 let stream,context;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('unsupported');
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
  if(token!==run){stream.getTracks().forEach(t=>t.stop());return;}
  context=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});await context.resume();
  if(token!==run){stream.getTracks().forEach(t=>t.stop());await context.close();return;}
  const source=context.createMediaStreamSource(stream),node=context.createAnalyser();node.fftSize=4096;node.smoothingTimeConstant=0;source.connect(node);
  micStream=stream;audioContext=context;micSource=source;analyser=node;
  stream.getAudioTracks()[0].addEventListener('ended',()=>{if(stopping)return;if(playing)finish('interrupted','マイクの接続が切れました。つなぎ直して挑戦してください。');releaseMic();refreshControls();});
  context.addEventListener('statechange',()=>{if(playing&&context.state!=='running')finish('interrupted','音声処理が停止しました。マイクを接続し直してください。');});
  message('接続できました。挑戦をはじめられます。');phase('準備OK — いつでも挑戦できます');
 }catch(error){stream?.getTracks().forEach(t=>t.stop());if(context&&context.state!=='closed')await context.close();message(mediaError(error,'マイク'),true);}
 finally{busy=false;refreshControls();}
}
async function connectCamera(){
 if(busy||playing)return;
 if(cameraStream){releaseCamera();refreshControls();return;}
 const token=run;busy=true;refreshControls();message('カメラの許可を待っています…');let stream;
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
  if(token!==run){stream.getTracks().forEach(t=>t.stop());return;}
  camera.srcObject=stream;await camera.play();
  if(token!==run){stream.getTracks().forEach(t=>t.stop());camera.srcObject=null;return;}
  cameraStream=stream;$('camera-placeholder').hidden=true;
  stream.getVideoTracks()[0].addEventListener('ended',()=>{releaseCamera();refreshControls();message('カメラが切断されました。カメラなしでも挑戦できます。');});
  message('カメラを接続しました。映像はこの端末だけに表示します。');
 }catch(error){stream?.getTracks().forEach(t=>t.stop());camera.srcObject=null;message(mediaError(error,'カメラ'),true);}
 finally{busy=false;refreshControls();}
}
function releaseMic(){
 const old=micStream;micStream=null;old?.getTracks().forEach(t=>t.stop());micSource?.disconnect();micSource=null;analyser=null;
 const oldContext=audioContext;audioContext=null;if(oldContext&&oldContext.state!=='closed')oldContext.close().catch(()=>{});
 latestPitch=null;$('live-status').textContent='マイク接続前';$('live-dot').className='dot';
}
function releaseCamera(){const old=cameraStream;cameraStream=null;old?.getTracks().forEach(t=>t.stop());camera.srcObject=null;$('camera-placeholder').hidden=false;}
function releaseAll(){run++;starting=false;stopping=true;if(playing)finish('interrupted','接続を解除しました。');releaseMic();releaseCamera();stopping=false;refreshControls();message('接続を解除しました。');}
async function start(){
 if(playing||busy||starting||!song||!active())return;
 const token=++run;starting=true;refreshControls();
 try{
  if(audioContext.state!=='running')await audioContext.resume();
  if(token!==run||!active())return;
  if(audioContext?.state!=='running')throw Error('音声処理を開始できません。マイクを接続し直してください。');
  practice.pause();practice.currentTime=0;video.pause();video.currentTime=0;video.playbackRate=1;
  judge=new Judge(song.notes);latestPitch=null;$('result').hidden=true;
  playing=true;lastFrame=performance.now();lastProgress=lastFrame;lastMediaTime=0;lastVideo=-1;phase('カウントダウン — 太鼓の「1」が消えたら歌い出し');refreshControls();
  await video.play();
 }catch(error){if(token!==run)return;playing=false;video.pause();message(error.message||'動画を再生できませんでした。',true);}
 finally{if(token===run){starting=false;refreshControls();}}
}
function finish(kind,detail=''){
 if(!playing)return;run++;starting=false;playing=false;video.pause();
 const index=Math.max(0,judge?.index??0),note=song.notes[index];
 if(kind==='fail')detail=detail||`${Math.max(0,video.currentTime-offset).toFixed(2)}秒付近で音程が外れました。お手本を聴いて、もう一度。`;
 if(kind==='clear')detail='40音、最後まで歌い切りました！';
 if(kind==='interrupted')detail=detail||'再生や判定が途切れました。準備を確認して、最初から挑戦してください。';
 $('result').dataset.kind=kind;$('result-title').textContent={fail:'失敗',clear:'クリア',interrupted:'中断'}[kind];
 $('result-kicker').textContent={fail:'CHALLENGE FAILED',clear:'CHALLENGE CLEAR',interrupted:'CHALLENGE PAUSED'}[kind];
 $('result-detail').textContent=detail;$('result').hidden=false;phase({fail:'音程が外れました — 再挑戦できます',clear:'チャレンジ成功！',interrupted:'チャレンジを中断しました'}[kind]);
 drawNotes($('notes'),song,video.currentTime-offset,judge,latestPitch?.midi);refreshControls();$('retry').focus({preventScroll:true});
}
function reset(){
 if(playing)return;$('result').hidden=true;video.currentTime=0;judge=null;latestPitch=null;lastVideo=-1;
 phase(active()?'準備OK — いつでも挑戦できます':'マイクを接続して挑戦しよう');drawNotes($('notes'),song,-1,null,null);refreshControls();
}
function tick(now){
 frame=requestAnimationFrame(tick);
 if(!song||!compositor)return;
 try{
  if(video.readyState>=2&&lastVideo!==video.currentTime){compositor.draw();lastVideo=video.currentTime;}
  if(analyser&&audioContext?.state==='running'){
   analyser.getFloatTimeDomainData(frameBuffer);latestPitch=detectPitch(frameBuffer,audioContext.sampleRate);
   $('live-dot').className=latestPitch?'dot ready':'dot';
   $('live-status').textContent=latestPitch?'声を検出中':'声を待っています';
  }
  if(playing){
   if(now-lastFrame>220){finish('interrupted','処理が途切れたため中断しました。他のアプリを閉じて再挑戦してください。');return;}
   if(video.currentTime>lastMediaTime+.001){lastMediaTime=video.currentTime;lastProgress=now;}
   if(now-lastProgress>2000){finish('interrupted','動画の読み込みが止まったため中断しました。接続を確認して再挑戦してください。');return;}
   const songTime=video.currentTime-offset,judgeTime=songTime-latency;
   // Video time is the only clock: a stalled or paused video cannot advance grading.
   if(video.readyState>=2){judge.update(judgeTime,latestPitch?.midi??null);}
   if(songTime>=0)phase('挑戦中 — 白いバーに音程を合わせて');
   drawNotes($('notes'),song,songTime,judge,latestPitch?.midi);
   $('time').textContent=`${clock(video.currentTime)} / ${clock(video.duration)}`;
   if(judge.result)finish(judge.result);
  }
 }catch(error){if(playing)finish('interrupted',error.message);else message(error.message,true);}
 finally{lastFrame=now;}
}
const clock=seconds=>`00:${Math.min(99,Math.floor(seconds||0)).toString().padStart(2,'0')}`;

$('mic-button').addEventListener('click',connectMic);$('camera-button').addEventListener('click',connectCamera);$('release').addEventListener('click',releaseAll);
$('start').addEventListener('click',start);$('retry').addEventListener('click',start);$('back').addEventListener('click',reset);$('stop').addEventListener('click',()=>finish('interrupted','チャレンジを中断しました。いつでも最初から挑戦できます。'));
$('loop').addEventListener('change',()=>{practice.loop=$('loop').checked;});
practice.addEventListener('play',()=>{if(playing){practice.pause();return;}listenCount++;$('listen-count').textContent=`試聴 ${listenCount}回目`;});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('stage').requestFullscreen)await $('stage').requestFullscreen();else message('このブラウザーでは全画面表示を利用できません。端末を横向きにしてお使いください。');}catch{message('全画面表示を開始できませんでした。');}});
video.addEventListener('error',()=>{if(playing)finish('interrupted','動画を読み込めませんでした。接続を確認してください。');message('動画を読み込めません。ページを再読み込みしてください。',true);});
video.addEventListener('ended',()=>{if(!playing)return;judge.update(video.currentTime-offset-latency,latestPitch?.midi??null);finish(judge.result||'interrupted');});
video.addEventListener('pause',()=>{if(playing&&!video.ended)finish('interrupted','動画が停止したため中断しました。');});
video.addEventListener('seeking',()=>{if(playing&&video.currentTime>.2)finish('interrupted','再生位置が変更されたため中断しました。');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(playing)finish('interrupted','画面を切り替えたため中断しました。');practice.pause();}});
window.addEventListener('pagehide',()=>{stopping=true;cancelAnimationFrame(frame);video.pause();practice.pause();releaseAll();});
window.addEventListener('pageshow',event=>{if(event.persisted){frame=requestAnimationFrame(tick);refreshControls();}});

async function init(){
 try{
  const response=await fetch(new URL('../assets/song.mid',import.meta.url));if(!response.ok)throw Error('MIDIを読み込めませんでした。');song=parseMidi(await response.arrayBuffer());
  if(song.notes.length!==40)throw Error('課題曲のMIDIが一致しません。');
  compositor=createCompositor($('composite'),video);
  const show=()=>{try{compositor.draw();drawNotes($('notes'),song,-1,null,null);}catch(error){message(error.message,true);}};
  video.addEventListener('loadeddata',show);video.addEventListener('seeked',show);show();
  phase('マイクを接続して挑戦しよう');refreshControls();frame=requestAnimationFrame(tick);
 }catch(error){phase('素材の読み込みに失敗しました');message(`${error.message} ページを再読み込みしてください。`,true);}
}
init();
