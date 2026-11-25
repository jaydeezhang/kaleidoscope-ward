const TAU = 2 * Math.PI;
const sub = (a, b) => ({ x:a.x-b.x, y:a.y-b.y });
const step = (a, d, t) => ({ x:a.x+d.x*t, y:a.y+d.y*t });
const dot = (a, b) => a.x*b.x + a.y*b.y;
const cross = (a, b) => a.x*b.y - a.y*b.x;
const direction = a => ({ x:Math.cos(a), y:Math.sin(a) });
const angle = (from, to) => Math.atan2(to.y-from.y, to.x-from.x);
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function createScene(width, height) {
  const portrait = width < height * .83;
  const point = (x,y) => ({x:x*width,y:y*height});
  const source = portrait ? point(.09,.42) : point(.11,.45);
  const first = portrait ? point(.29,.60) : point(.29,.59);
  const second = portrait ? point(.72,.43) : point(.71,.39);
  const goal = portrait ? point(.88,.65) : point(.89,.55);
  const scale = Math.min(width, height);
  const radius = Math.min(74, Math.max(34, scale * .083));
  const turns = [
    (angle(source,first)+angle(first,second))/2,
    (angle(first,second)+angle(second,goal))/2,
  ];
  const mirrors = [first,second].map((center,i) => ({
    ...center, radius, solution:turns[i],
    angle:wrap(turns[i]+(i===0 ? -.39 : .36)),
  }));
  return {width,height,source,mirrors,goal:{...goal,radius: Math.max(13,radius*.32)}};
}

export function trace({width,height,source,mirrors,goal}) {
  const points = [source];
  const hits = [];
  let origin = source;
  let ray = direction(angle(source,mirrors[0]));
  const edges = ray => [
    ray.x > 0 ? (width-origin.x)/ray.x : -origin.x/ray.x,
    ray.y > 0 ? (height-origin.y)/ray.y : -origin.y/ray.y,
  ].filter(t => Number.isFinite(t) && t > .01);

  for (let bounce=0; bounce<=2; bounce++) {
    let nearest = Math.min(...edges(ray), width+height);
    let next = -1;
    for (const [i, mirror] of mirrors.entries()) {
      const axis = direction(mirror.angle);
      const denominator = cross(ray,axis);
      if (Math.abs(denominator) < 1e-6) continue;
      const offset = sub(mirror,origin);
      const t = cross(offset,axis)/denominator;
      const u = cross(offset,ray)/denominator;
      if (t > .01 && t < nearest && Math.abs(u) <= mirror.radius) {
        nearest = t;
        next = i;
      }
    }
    const toGoal = sub(goal,origin);
    const along = dot(ray,toGoal);
    const perpendicular = cross(ray,toGoal);
    const squared = goal.radius**2-perpendicular**2;
    const entry = along - Math.sqrt(Math.max(0,squared));
    if (squared >= 0 && entry > .01 && entry < nearest) {
      points.push(step(origin,ray,entry));
      return {points,hits,target:bounce === 2 && hits[0] === 0 && hits[1] === 1};
    }
    origin = step(origin,ray,nearest);
    points.push(origin);
    if (next === -1 || bounce === 2) break;
    hits.push(next);
    const axis = direction(mirrors[next].angle);
    ray = step({x:-ray.x,y:-ray.y},axis,2*dot(ray,axis));
  }
  return {points,hits,target:false};
}

export function coverPoint({x,y}, videoWidth, videoHeight, width, height) {
  const scale = Math.max(width/videoWidth,height/videoHeight);
  return {
    x:width/2+(.5-x)*videoWidth*scale,
    y:height/2+(y-.5)*videoHeight*scale,
  };
}

export class Grip {
  index = -1;
  rotation = 0;
  lastSeen = -Infinity;
  angle = 0;
  rawRotation = 0;
  requireOpen = false;

  cancel() {
    this.index = -1;
    this.requireOpen = true;
  }

  update(hand, now, hovered) {
    if (now-this.lastSeen >= 300 && this.index !== -1) this.cancel();
    if (!hand) return;
    this.lastSeen = now;

    if (hand.ratio >= .44) {
      this.index = -1;
      this.requireOpen = false;
      return;
    }
    if (this.index !== -1) {
      this.rawRotation += wrap(hand.angle-this.angle);
      this.angle = hand.angle;
      this.rotation += (this.rawRotation-this.rotation)*.42;
      return;
    }
    if (hand.ratio <= .30 && !this.requireOpen) {
      this.requireOpen = true;
      if (hovered === -1) return;
      this.index = hovered;
      this.angle = hand.angle;
      this.rotation = 0;
      this.rawRotation = 0;
    }
  }
}

export class Charge {
  start = null;
  progress = 0;

  update(hit, now) {
    this.start = hit ? this.start ?? now : null;
    this.progress = hit ? Math.min(1,(now-this.start)/600) : 0;
    return this.progress === 1;
  }
}

export function controlAngle(mirror) {
  return ((Math.round(mirror.angle*180/Math.PI)%180)+180)%180;
}
