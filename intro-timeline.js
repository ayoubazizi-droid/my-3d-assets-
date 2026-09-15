/* Authored Blender channels; no page-layout-derived animation endpoints. */
((scope) => {
  'use strict';
  function cubic(a, b, c, d, t) {
    const s = 1 - t;
    return s*s*s*a + 3*s*s*t*b + 3*s*t*t*c + t*t*t*d;
  }
  function channel(curve, frame) {
    const points = curve.points;
    if (frame <= points[0].frame) return points[0].value;
    if (frame >= points.at(-1).frame) return points.at(-1).value;
    const i = points.findIndex(p => p.frame > frame), a = points[i-1], b = points[i];
    if (a.interpolation === 'CONSTANT') return a.value;
    if (a.interpolation === 'LINEAR') return a.value + (b.value-a.value)*(frame-a.frame)/(b.frame-a.frame);
    if (a.interpolation !== 'BEZIER') throw new Error(`Unsupported interpolation: ${a.interpolation}`);
    let lo = 0, hi = 1;
    for (let n = 0; n < 40; n++) {
      const t = (lo+hi)/2;
      if (cubic(a.frame,a.right[0],b.left[0],b.frame,t) < frame) lo = t; else hi = t;
    }
    return cubic(a.value,a.right[1],b.left[1],b.value,(lo+hi)/2);
  }
  function evaluate(plane, frame) {
    const state = JSON.parse(JSON.stringify(plane.base));
    for (const curve of plane.curves) {
      const value = channel(curve, frame);
      if (Array.isArray(state[curve.path])) state[curve.path][curve.index] = value;
      else state[curve.path] = curve.path.startsWith('hide_') ? value >= .5 : value;
    }
    return state;
  }
  function project(data, plane, frame) {
    const state = evaluate(plane, frame), m = data.camera.viewProjection;
    const [rx,ry,rz] = state.rotation_euler;
    const vertices = plane.vertices.map(v => {
      let [x,y,z] = v.map((n,i) => n*state.scale[i]);
      [y,z] = [y*Math.cos(rx)-z*Math.sin(rx), y*Math.sin(rx)+z*Math.cos(rx)];
      [x,z] = [x*Math.cos(ry)+z*Math.sin(ry), -x*Math.sin(ry)+z*Math.cos(ry)];
      [x,y] = [x*Math.cos(rz)-y*Math.sin(rz), x*Math.sin(rz)+y*Math.cos(rz)];
      const world = [x+state.location[0],y+state.location[1],z+state.location[2]];
      const h = [...world,1], clip = m.map(row => row.reduce((sum,n,i) => sum+n*h[i],0));
      return {world, screen:[(clip[0]/clip[3]+1)/2, (1-clip[1]/clip[3])/2], depth:clip[3]};
    });
    const xs = vertices.map(v => v.screen[0]), ys = vertices.map(v => v.screen[1]);
    return {state, vertices, x:Math.min(...xs), y:Math.min(...ys),
      width:Math.max(...xs)-Math.min(...xs), height:Math.max(...ys)-Math.min(...ys)};
  }
  // Fit the complete camera frame, keeping the same composition on every aspect ratio.
  function viewport(data, width, height) {
    const [w,h] = data.camera.resolution, scale = Math.min(width/w,height/h);
    return {x:(width-w*scale)/2,y:(height-h*scale)/2,width:w*scale,height:h*scale};
  }
  function rect(data, plane, frame, width, height) {
    const p = project(data,plane,frame), view = viewport(data,width,height);
    return {...p,x:view.x+p.x*view.width,y:view.y+p.y*view.height,
      width:p.width*view.width,height:p.height*view.height};
  }
  function crop(plane, image) {
    const us = plane.uv.map(v => v[0]), vs = plane.uv.map(v => v[1]);
    const u = Math.min(...us), top = 1-Math.max(...vs);
    const w = Math.max(...us)-u, h = Math.max(...vs)-Math.min(...vs);
    Object.assign(image.style,{left:`${-u/w*100}%`,top:`${-top/h*100}%`,
      width:`${100/w}%`,height:`${100/h}%`,translate:'none'});
  }
  scope.PixIntro = {channel,evaluate,project,viewport,rect,crop};
  if (typeof module !== 'undefined') module.exports = scope.PixIntro;
})(typeof window === 'undefined' ? globalThis : window);
