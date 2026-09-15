// Run after export-intro.py. Expected coordinates come from Blender, independently.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const M = require('../intro-timeline.js');
const data = require('../assets/branding/intro-keyframes.json');
const oracle = JSON.parse(fs.readFileSync(process.argv[2] || '/home/liveuser/Documents/pix3lware-theme/transition-reference/blender-evaluated-frames.json'));
let error = 0;
for (const sample of oracle) for (const expected of sample.planes) {
  const plane = data.planes.find(p => p.name === expected.name);
  const actual = M.project(data,plane,sample.frame);
  assert.equal(actual.state.hide_render,expected.hidden,`${plane.name}, frame ${sample.frame}`);
  actual.vertices.forEach((v,i) => {
    error = Math.max(error,Math.abs(v.screen[0]-expected.screen[i][0])*data.camera.resolution[0],
      Math.abs(v.screen[1]-(1-expected.screen[i][1]))*data.camera.resolution[1]);
  });
}
assert.ok(error < .01,`Camera projection error: ${error}px`);
// Both screenshot planes in the source have the same evaluated state and geometry.
const website = data.planes.find(p=>p.role==='website'), guide = data.planes.find(p=>p.role==='screenframe');
for (const {frame} of oracle) assert.deepEqual(M.project(data,website,frame),M.project(data,guide,frame));
console.log(`${oracle.length} Blender samples passed; maximum error ${error.toFixed(6)} pixels.`);
