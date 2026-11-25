const circle = 2*Math.PI;
const radians = Math.PI/180;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const coordinates = (radius, angle) => [radius*Math.cos(angle),radius*Math.sin(angle)];

function arc(ctx,r,start=0,end=circle) {
  ctx.beginPath();
  ctx.arc(0,0,r,start,end);
  ctx.stroke();
}

function polygon(ctx,r,sides,offset=0) {
  ctx.beginPath();
  for (let i=0;i<sides;i++) ctx.lineTo(...coordinates(r,offset+i*circle/sides));
  ctx.closePath();
  ctx.stroke();
}

function path(ctx,points) {
  ctx.beginPath();
  for (const point of points) ctx.lineTo(point.x,point.y);
}

function drawBeam(ctx, points, time) {
  ctx.save();
  ctx.lineJoin='round';
  ctx.lineCap='round';
  path(ctx,points);
  ctx.strokeStyle='#f4993966';
  ctx.lineWidth=8;
  ctx.shadowBlur=18;
  ctx.shadowColor='#e98c32';
  ctx.stroke();
  ctx.strokeStyle='#fabe61';
  ctx.lineWidth=3.5;
  ctx.stroke();
  ctx.shadowBlur=0;
  ctx.strokeStyle='#fff3cd';
  ctx.lineWidth=1;
  ctx.stroke();
  if (!motion.matches) {
    ctx.setLineDash([7,36]);
    ctx.lineDashOffset=-time*.10;
    ctx.lineWidth=2;
    ctx.stroke();
  }
  ctx.restore();
}

const facets = [
  [[-1,0],[-.27,-.46],[.27,-.46],[0,0]],
  [[.27,-.46],[1,0],[0,0]],
  [[1,0],[.27,.46],[-.27,.46],[0,0]],
  [[-.27,.46],[-1,0],[0,0]],
];

function drawMirror(ctx, mirror, media, highlighted, active) {
  const {x,y,radius:r,angle}=mirror;
  ctx.save();
  ctx.translate(x,y);
  ctx.strokeStyle=highlighted?'#ffcc7ad9':'#d9edf477';
  ctx.lineWidth=1;
  ctx.setLineDash([2,5]);
  arc(ctx,r+8);
  ctx.setLineDash([]);
  for(let i=0;i<4;i++) arc(ctx,r+9,i*Math.PI/2+.12,i*Math.PI/2+.42);

  ctx.rotate(angle);
  const width=media?.videoWidth || media?.naturalWidth;
  const height=media?.videoHeight || media?.naturalHeight;
  const sample=Math.min(width || 0,height || 0)*.68;
  facets.forEach((facet,i)=>{
    ctx.save();
    ctx.beginPath();
    for (const [fx,fy] of facet) ctx.lineTo(fx*r,fy*r*1.12);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle='#23404a';
    ctx.fillRect(-r,-r,r*2,r*2);
    if(sample) {
      ctx.save();
      ctx.scale(i%2?-1:1,1);
      ctx.rotate((i-1.5)*.18);
      const sx=width/2-sample/2+Math.sin(angle+i)*sample*.13;
      const sy=height/2-sample/2+Math.cos(angle+i)*sample*.12;
      ctx.drawImage(media,sx,sy,sample,sample,-r*1.32,-r*1.32,r*2.64,r*2.64);
      ctx.restore();
    }
    ctx.fillStyle=i%2?'#89cce332':'#12283235';
    ctx.fillRect(-r,-r,r*2,r*2);
    ctx.restore();
    ctx.strokeStyle='#d7f4fd92';
    ctx.stroke();
  });
  ctx.beginPath();
  for (const [fx,fy] of [[-1,0],[-.27,-.46],[.27,-.46],[1,0],[.27,.46],[-.27,.46]]) {
    ctx.lineTo(fx*r,fy*r*1.12);
  }
  ctx.closePath();
  ctx.shadowColor=highlighted?'#f6b954':'#b5e6ff';
  ctx.shadowBlur=highlighted?17:9;
  ctx.strokeStyle=highlighted?'#ffe1a2':'#e0f5fc';
  ctx.lineWidth=active?2.5:1.5;
  ctx.stroke();
  ctx.restore();
}

function drawNode(ctx, point, radius, power, time, source=false) {
  ctx.save();
  ctx.translate(point.x,point.y);
  ctx.strokeStyle=source?'#ffd393':'#f7d69cc7';
  ctx.shadowColor='#ff9a2e';
  ctx.shadowBlur=source || power>0?17:4;
  ctx.lineWidth=1;
  arc(ctx,radius);
  arc(ctx,radius+5);
  polygon(ctx,radius*.74,4,(source && !motion.matches?time*.00045:0));
  polygon(ctx,radius*.43,4,Math.PI/4);
  if (power>0) {
    ctx.lineWidth=3;
    ctx.strokeStyle='#fff0bc';
    arc(ctx,radius+5,-Math.PI/2,power*circle-Math.PI/2);
  }
  ctx.restore();
}

function sparks(ctx, point, time, quantity, reach) {
  if(motion.matches) return;
  ctx.save();
  ctx.translate(point.x,point.y);
  for(let i=0;i<quantity;i++) {
    const life=(time*.0011+i*.6180339)%1;
    const angle=i*2.39996;
    const [x,y]=coordinates(4+life*(reach+(i%5)*6),angle);
    ctx.globalAlpha=(1-life)*.85;
    ctx.strokeStyle=i%3===0?'#fff6d1':'#ffb450';
    ctx.lineWidth=i%3===0?1.5:.8;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x-Math.cos(angle)*(2+5*life),y-Math.sin(angle)*(2+5*life));
    ctx.stroke();
  }
  ctx.restore();
}

function drawWard(ctx, scene, time, completion) {
  const age=time-completion.time;
  const maxRadius=Math.min(scene.width*.78,scene.height*.52,440);
  const {point}=completion;
  const growth=motion.matches?1:1-Math.pow(1-Math.min(1,age/1450),3);
  ctx.save();
  ctx.translate(point.x,point.y);
  for(let layer=0;layer<3;layer++) {
    const r=maxRadius*(.43+layer*.28)*growth;
    if (r<1) continue;
    ctx.save();
    ctx.rotate(layer*.27+(motion.matches?0:time*.00008*(layer===1?-1:1)));
    ctx.globalAlpha=.85-layer*.15;
    ctx.strokeStyle=layer===0?'#ffedb3':'#ffc66d';
    ctx.shadowColor='#f5a94a';
    ctx.shadowBlur=8;
    ctx.lineWidth=1.1;
    arc(ctx,r);
    arc(ctx,r*.92);
    polygon(ctx,r*.91,layer===1?6:8);
    polygon(ctx,r*.91,layer===1?6:8,layer===1?30*radians:22.5*radians);
    for(let i=0;i<24;i++) {
      ctx.save();
      ctx.rotate(i*circle/24);
      ctx.beginPath();
      ctx.moveTo(r*.94,0);
      ctx.lineTo(r*.986,0);
      ctx.stroke();
      if(i%3===0) {
        ctx.translate(r*1.024,0);
        polygon(ctx,Math.max(1,r*.015),4);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
  sparks(ctx,point,time,age<1250?52:13,age<1250?maxRadius*growth*.55:55);
}

export function render(ctx,scene,{ray,media,selected,hovered,grabbed,hand,charge,completion,time,scale}) {
  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.clearRect(0,0,scene.width,scene.height);
  drawNode(ctx,scene.source,11,0,time,true);
  drawNode(ctx,scene.goal,scene.goal.radius,charge,time);
  scene.mirrors.forEach((mirror,i)=>{
    const active=grabbed===i || hovered===i || selected===i;
    drawMirror(ctx,mirror,media,active || (i===1 && ray.hits.includes(1)),active);
  });
  drawBeam(ctx,ray.points,time);
  ray.hits.forEach((_,i)=>sparks(ctx,ray.points[i+1],time+i*181,20,29));
  if (completion) drawWard(ctx,scene,time,completion);
  if(hand) {
    ctx.save();
    ctx.translate(hand.x,hand.y);
    ctx.lineWidth=1.6;
    ctx.strokeStyle=grabbed===-1?'#d9f6ff':'#ffcd87';
    arc(ctx,grabbed===-1?8:12);
    ctx.restore();
  }
}
