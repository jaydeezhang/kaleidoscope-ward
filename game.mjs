import { createScene, trace, coverPoint, Grip, Charge, controlAngle, wrap } from './optics.mjs';
import { render } from './art.mjs';

const get = id => document.getElementById(id);
const experience = get('experience');
const video = get('camera');
const room = get('room');
const canvas = get('stage');
const ctx = canvas.getContext('2d');
const cameraButton = get('camera-toggle');
const angle = get('angle');
const number = get('angle-number');
const result = get('result');
const controls = [get('control-first'),get('control-second')];
const buttons = [get('first-mirror'),get('second-mirror')];
const labels = ['source','first','second','goal'].map(name => get(name+'-label'));
const grip = new Grip();
const charge = new Charge();
let scene, scale, previousSize;
let selected = 0;
let selectionVisible = false;
let hand = null;
let hovered = -1;
let gripStart = 0;
let completion = null;
let stream = null;
let detector = null;
let detectorLoad;
let cameraRequest = 0;
let lastVideoTime = -1;
let lastDetection = -Infinity;

function status(id, text) {
  const element = get(id);
  if (element.textContent !== text) element.textContent = text;
}

function place(element, point, offset=0) {
  element.style.left = point.x+'px';
  element.style.top = point.y+offset+'px';
}

function resize() {
  const {clientWidth:width, clientHeight:height} = experience;
  if (!width || !height || (previousSize?.width === width && previousSize?.height === height)) return;
  previousSize = {width,height};
  const next = createScene(width,height);
  if (scene) {
    next.mirrors.forEach((mirror,i)=>{
      mirror.angle += wrap(scene.mirrors[i].angle - scene.mirrors[i].solution) - wrap(mirror.angle - mirror.solution);
    });
    if (completion) {
      completion.point = {x:completion.point.x*width/scene.width,y:completion.point.y*height/scene.height};
    }
    grip.cancel();
  }
  scene = next;
  scale = Math.min(2,window.devicePixelRatio || 1);
  canvas.width = Math.round(width*scale);
  canvas.height = Math.round(height*scale);
  place(labels[0],scene.source,27);
  place(labels[3],scene.goal,scene.goal.radius+17);
  scene.mirrors.forEach((mirror,i)=>{
    place(labels[i+1],mirror,mirror.radius+23);
    place(buttons[i],mirror);
    buttons[i].style.width = buttons[i].style.height = 2*(mirror.radius+8)+'px';
  });
  syncControls();
}

function syncControls() {
  const degrees = controlAngle(scene.mirrors[selected]);
  if (angle.value !== String(degrees)) angle.value = degrees;
  if (number.value !== degrees+'°') number.value = degrees+'°';
  controls.forEach((control,i)=>{
    const active = String(i===selected);
    if (control.getAttribute('aria-pressed') !== active) {
      control.setAttribute('aria-pressed',active);
      buttons[i].setAttribute('aria-pressed',active);
    }
  });
}

function select(index) {
  selected = index;
  selectionVisible = true;
  syncControls();
}

function reset() {
  scene = createScene(scene.width,scene.height);
  charge.update(false,0);
  grip.cancel();
  completion = null;
  result.hidden = true;
  angle.disabled = false;
  selected = 0;
  selectionVisible = false;
  syncControls();
}

function readRightHand(prediction) {
  const index = prediction.handedness.findIndex(labels=>labels[0]?.categoryName === 'Right');
  const landmarks = prediction.landmarks[index];
  if (!landmarks) return null;
  const convert = point => coverPoint(point,video.videoWidth,video.videoHeight,scene.width,scene.height);
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const [wrist,thumb,finger,indexBase,middle,pinky] = [0,4,8,5,9,17].map(i=>convert(landmarks[i]));
  const width = distance(indexBase,pinky);
  if (width < 10 || distance(wrist,middle)<9) return null;
  return {
    x:(thumb.x+finger.x)/2, y:(thumb.y+finger.y)/2,
    ratio:distance(thumb,finger)/width,
    angle:Math.atan2(middle.y-wrist.y,middle.x-wrist.x),
  };
}

function track(now) {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now-lastDetection >= 30) {
    lastVideoTime = video.currentTime;
    lastDetection = now;
    hand = readRightHand(detector.detectForVideo(video,now));
    hovered = hand ? scene.mirrors.findIndex(m=>Math.hypot(m.x-hand.x,m.y-hand.y)<=m.radius+9) : -1;
    const previous = grip.index;
    grip.update(hand,now,hovered);
    if (grip.index !== previous && grip.index !== -1) {
      select(grip.index);
      gripStart = scene.mirrors[grip.index].angle;
    }
    if (hand && grip.index !== -1 && !completion) {
      scene.mirrors[grip.index].angle = wrap(gripStart + grip.rotation);
      syncControls();
    }
  } else if (now-lastDetection >= 300) {
    hand = null;
    hovered = -1;
    grip.update(null,now,-1);
  }
}

async function loadDetector() {
  const {FilesetResolver,HandLandmarker} = await import('./assets/vision/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks('./assets/vision/wasm');
  return HandLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:'./assets/hand_landmarker.task'},
    runningMode:'VIDEO',
    numHands:2,
    minHandDetectionConfidence:.53,
    minHandPresenceConfidence:.52,
    minTrackingConfidence:.54,
  });
}

function stopCamera(message='摄像头关闭 · 可用下方角度控件游玩') {
  cameraRequest++;
  stream?.getTracks().forEach(track=>track.stop());
  stream = null;
  video.srcObject = null;
  experience.dataset.camera = 'off';
  hand = null;
  hovered = -1;
  grip.cancel();
  lastVideoTime = -1;
  lastDetection = -Infinity;
  cameraButton.disabled = false;
  cameraButton.querySelector('span').textContent = '开启摄像头';
  status('camera-state',message);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    status('camera-state','摄像头不可用 · 请在 HTTPS 页面打开');
    return;
  }
  const request = ++cameraRequest;
  cameraButton.disabled = true;
  status('camera-state','等待摄像头权限…');
  let captured;
  try {
    captured = await navigator.mediaDevices.getUserMedia({
      audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},
    });
    if (request !== cameraRequest) {
      captured.getTracks().forEach(track=>track.stop());
      return;
    }
    stream = captured;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended',()=>{
        if (stream === captured) stopCamera('摄像头已断开 · 可继续用角度控件游玩');
      },{once:true});
    }
    video.srcObject = stream;
    await video.play();
    if (request !== cameraRequest) return;
    experience.dataset.camera = 'on';
    cameraButton.disabled = false;
    cameraButton.querySelector('span').textContent = '关闭摄像头';
    status('camera-state','正在加载右手识别…');
  } catch (error) {
    if (request !== cameraRequest) return;
    stopCamera(error.name==='NotAllowedError'
      ? '摄像头权限未开启 · 可用角度控件游玩'
      : '无法启动摄像头 · 可用角度控件游玩');
    return;
  }
  try {
    detectorLoad ??= loadDetector().catch(error=>{detectorLoad=null; throw error;});
    const loaded = await detectorLoad;
    if (request !== cameraRequest) return;
    detector = loaded;
    grip.requireOpen = false;
    status('camera-state','伸出右手，捏住镜片边缘，再转动手腕');
  } catch {
    if (request === cameraRequest) status('camera-state','手势识别加载失败 · 可用角度控件游玩');
  }
}

function tick(now) {
  if (stream && detector) {
    try {
      track(now);
      status('camera-state',grip.index !== -1 ? '已抓住镜片 · 转腕调整，松手固定'
        : hand ? '右手已识别 · 捏合拇指和食指以抓取镜片'
        : '伸出右手，捏住镜片边缘，再转动手腕');
    } catch {
      detector.close();
      detector = null;
      detectorLoad = null;
      hand = null;
      hovered = -1;
      grip.cancel();
      status('camera-state','手势追踪中断 · 可重开摄像头或使用角度控件');
    }
  }
  const ray = trace(scene);
  if (!completion && charge.update(ray.target,now)) {
    completion = {time:now,point:ray.points.at(-1)};
    result.hidden = false;
    angle.disabled = true;
    grip.cancel();
  }
  status('step-text',completion ? '两次反射 · 符文已点亮'
    : ray.target ? '保持光路，正在点亮符文'
    : ray.hits.includes(1) ? '调整第二枚镜片，将金光引入符文'
    : '调整第一枚镜片，将金光引向第二枚');
  const media = stream && video.readyState >= 2 ? video : room.complete && room.naturalWidth ? room : null;
  render(ctx,scene,{
    ray,media,selected:selectionVisible ? selected : -1,hovered,grabbed:grip.index,
    hand,charge:charge.progress,completion,time:now,scale,
  });
  requestAnimationFrame(tick);
}

angle.addEventListener('input',()=>{
  grip.cancel();
  selectionVisible = true;
  scene.mirrors[selected].angle = Number(angle.value)*Math.PI/180;
  syncControls();
});
controls.forEach((control,i)=>control.addEventListener('click',()=>{ grip.cancel(); select(i); }));
buttons.forEach((button,i)=>button.addEventListener('click',()=>{ grip.cancel(); select(i); angle.focus(); }));
cameraButton.addEventListener('click',()=>stream ? stopCamera() : startCamera());
get('reset').addEventListener('click',reset);
get('replay').addEventListener('click',()=>{
  reset();
  controls[0].focus();
});
window.addEventListener('pagehide',()=>stopCamera());
new ResizeObserver(resize).observe(experience);
resize();
syncControls();
requestAnimationFrame(tick);
