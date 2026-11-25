import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScene, trace, coverPoint, Grip, Charge } from '../optics.mjs';

test('both layouts start at the first mirror and can win only after two bounces', () => {
  for (const [width, height] of [[1440,900], [390,844], [320,568], [844,390]]) {
    const scene = createScene(width, height);
    assert.deepEqual(trace(scene).hits.slice(0,1), [0]);
    assert.equal(trace(scene).target, false);
    scene.mirrors[0].angle = scene.mirrors[0].solution;
    assert.deepEqual(trace(scene).hits, [0,1]);
    assert.equal(trace(scene).target, false);
    scene.mirrors[1].angle = scene.mirrors[1].solution;
    assert.equal(trace(scene).target, true);
  }
});

test('camera coordinates match centered cover crop and mirror', () => {
  assert.deepEqual(coverPoint({x:.5,y:.5}, 640,480,300,600), {x:150,y:300});
  assert.deepEqual(coverPoint({x:.25,y:.75},640,480,300,600), {x:350,y:450});
});

test('grip holds during brief loss and requires a fresh pinch after timeout', () => {
  const grip = new Grip();
  grip.update({ratio:.1,angle:3.1}, 0, 0);
  assert.equal(grip.index, 0);
  grip.update({ratio:.31,angle:-3.1}, 10, -1);
  assert.ok(Math.abs(grip.rotation) < .09);
  grip.update(null, 250, -1);
  assert.equal(grip.index, 0);
  grip.update({ratio:.1,angle:0}, 320, 1);
  assert.equal(grip.index, -1);
  grip.update({ratio:.6,angle:0}, 330, 1);
  grip.update({ratio:.1,angle:0}, 340, 1);
  assert.equal(grip.index, 1);
});

test('light must hit continuously for 600 ms', () => {
  const charge = new Charge();
  charge.update(true, 0);
  charge.update(false, 599);
  charge.update(true, 600);
  assert.equal(charge.update(true, 1199), false);
  assert.equal(charge.update(true, 1200), true);
});
