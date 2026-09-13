import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// The outer page waits for the model's first successful render, not iframe.onload.
let garageState = 'loading', garageProgress = 0;
let sceneVisible = false;
const parentOrigin = document.referrer ? new URL(document.referrer).origin : '*';
function notifyParent(type, details = {}) {
  if (window.parent !== window) window.parent.postMessage({ type, ...details }, parentOrigin);
}
window.addEventListener('message', event => {
  if (event.source !== window.parent || (parentOrigin !== '*' && event.origin !== parentOrigin)) return;
  if (event.data?.type === 'pix3lware:status-request') {
    notifyParent(`pix3lware:garage-${garageState === 'loading' ? 'progress' : garageState}`, {progress: garageProgress});
  }
  if (event.data?.type === 'pix3lware:motion') {
    controls.autoRotate = !!event.data.enabled;
    updateRotationLabel();
  }
});

// Replace an empty URL with './models/your-model.glb'. Keep all model files
// in this GitHub Pages repository. Use a self-contained, uncompressed GLB.
const objects = [
  { title: 'Ford Bronco Raptor', category: '01 / CUSTOM BRONCO', symbol: '◈', shape: 'knot', url: './models/Ud.glb' },
];
const wrap = document.querySelector('#canvas-wrap');
const status = document.querySelector('#status');
const rotateButton = document.querySelector('#rotate');
const zoomButton = document.querySelector('#zoom-mode');
const lockAngleButton = document.querySelector('#lock-angle');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
wrap.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', '3D preview; choose an object with the buttons below');
renderer.domElement.setAttribute('role', 'img');
// Render the model to a small texture, then upscale with nearest-neighbor sampling.
// Pixel sizes are CSS pixels so high-density screens get the same visual style.
const pixelStyle = document.querySelector('#pixel-style');
const composer = new EffectComposer(renderer);
const pixelPass = new RenderPixelatedPass(4 * renderer.getPixelRatio(), scene, camera, {
  normalEdgeStrength: 0.2,
  depthEdgeStrength: 0.3,
});
composer.addPass(pixelPass);
composer.addPass(new OutputPass());
let pixelSize = 4;
pixelStyle.addEventListener('change', () => {
  pixelSize = Number(pixelStyle.value);
  if (pixelSize > 0) pixelPass.setPixelSize(pixelSize * renderer.getPixelRatio());
});
// Studio reflections make the baked metallic paint and chrome visible.
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment();
scene.environment = pmrem.fromScene(environment, 0.04).texture;
environment.dispose();
pmrem.dispose();
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = false;
controls.minPolarAngle = 0.18;
// Let the orbit travel beneath the chassis for the requested underside shot.
// The limit stops short of flipping the camera upside down.
let savedMaxPolar = Number.parseFloat(localStorage.getItem('pix3lware-max-polar'));
controls.maxPolarAngle = Number.isFinite(savedMaxPolar) ? savedMaxPolar : Math.PI * 0.82;
controls.minDistance = 1.8;
controls.maxDistance = 12;
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 1.2;
scene.add(new THREE.HemisphereLight(0xffffff, 0x77778a, 3));
const key = new THREE.DirectionalLight(0xffffff, 4);
key.position.set(3, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 2);
rim.position.set(-4, 1, -2);
scene.add(rim);
const loader = new GLTFLoader();
let current, requestId = 0;
function resetView() {
  // Closer framing on wide screens; preserve space around the car on phones.
  const distance = wrap.clientWidth < 600 ? 4.6 : 3.55;
  camera.position.set(2.8, 1.5, 3.4).normalize().multiplyScalar(distance);
  controls.target.set(0, -0.28, 0);
  controls.update();
}
function dispose(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material) for (const material of [].concat(node.material)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const item of [...geometries, ...materials, ...textures]) item.dispose();
}
function demo(shape) {
  const geometry = shape === 'knot' ? new THREE.TorusKnotGeometry(0.72, 0.25, 160, 24)
    : shape === 'crystal' ? new THREE.IcosahedronGeometry(1.1, 0)
    : new THREE.TorusGeometry(0.8, 0.3, 40, 100);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x899b67, metalness: 0.3, roughness: 0.3 }));
  mesh.rotation.set(0.35, 0.3, -0.3);
  return mesh;
}
async function select(index) {
  const id = ++requestId, entry = objects[index];
  document.querySelector('#object-title').textContent = entry.title;
  document.querySelector('#category').textContent = entry.category;
  document.querySelector('#counter').textContent = `0${index + 1} / 0${objects.length}`;
  document.querySelectorAll('.card').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  if (current) { scene.remove(current); dispose(current); current = null; }
  resetView();
  status.textContent = entry.url ? 'Loading model…' : 'Ready to explore';
  let root;
  try {
    root = entry.url ? (await loader.loadAsync(entry.url, event => {
      garageProgress = event.total ? event.loaded / event.total * .9 : 0;
      notifyParent('pix3lware:garage-progress', {progress: garageProgress});
    })).scene : demo(entry.shape);
    if (id !== requestId) { dispose(root); return; }
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(extent) || extent <= 0) throw new Error('Model has no visible geometry');
    const holder = new THREE.Group();
    holder.add(root);
    root.position.sub(bounds.getCenter(new THREE.Vector3()));
    holder.scale.setScalar(2.5 / extent);
    current = holder;
    scene.add(current);
    await renderer.compileAsync(scene, camera);
    composer.render();
    status.textContent = 'Ready to explore';
    garageState = 'ready'; garageProgress = 1;
    notifyParent('pix3lware:garage-ready');
  } catch (error) {
    if (root) dispose(root);
    if (id !== requestId) return;
    status.textContent = 'Model unavailable. Check its URL and file format. Showing a sample.';
    current = demo(entry.shape);
    scene.add(current);
    console.error(error);
    garageState = 'error';
    notifyParent('pix3lware:garage-error');
  }
}
objects.forEach((entry, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card';
  const symbol = document.createElement('span');
  symbol.className = 'symbol'; symbol.textContent = entry.symbol; symbol.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  const number = document.createElement('small'); number.textContent = `OBJECT 0${index + 1}`;
  const title = document.createElement('strong'); title.textContent = entry.title;
  label.append(number, title); button.append(symbol, label);
  button.addEventListener('click', () => select(index));
  document.querySelector('#collection').appendChild(button);
});
function updateRotationLabel() {
  rotateButton.textContent = controls.autoRotate ? 'Pause rotation' : 'Resume rotation';
  rotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
}
rotateButton.addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; updateRotationLabel(); });
document.querySelector('#reset').addEventListener('click', resetView);
let zoomMode = false;
function setZoomMode(enabled) {
  zoomMode = enabled;
  controls.enableZoom = enabled;
  if (zoomButton) {
    zoomButton.textContent = enabled ? 'Exit zoom mode' : 'Zoom mode';
    zoomButton.setAttribute('aria-pressed', String(enabled));
  }
}
zoomButton?.addEventListener('click', () => setZoomMode(!zoomMode));
lockAngleButton?.addEventListener('click', () => {
  const angle = controls.getPolarAngle();
  controls.maxPolarAngle = angle;
  localStorage.setItem('pix3lware-max-polar', String(angle));
  lockAngleButton.textContent = 'Angle locked';
});
// Middle mouse (button 1) is an explicit desktop zoom gesture.
renderer.domElement.addEventListener('pointerdown', event => {
  if (event.button === 1) setZoomMode(true);
}, {capture:true});
renderer.domElement.addEventListener('pointerup', event => {
  if (event.button === 1 && !zoomButton?.matches(':focus')) setZoomMode(false);
});
// Two fingers temporarily unlock pinch zoom; one finger remains available for page scroll.
renderer.domElement.addEventListener('touchstart', event => {
  if (event.touches.length >= 2) { setZoomMode(true); event.preventDefault(); }
}, {passive:false});
renderer.domElement.addEventListener('touchend', event => {
  if (event.touches.length < 2 && !zoomButton?.matches(':focus')) setZoomMode(false);
}, {passive:true});
new ResizeObserver(() => {
  const width = wrap.clientWidth, height = wrap.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
}).observe(wrap);
new IntersectionObserver(entries => { sceneVisible = entries[0].isIntersecting; }).observe(wrap);
updateRotationLabel();
select(0);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  if (document.hidden || !sceneVisible || garageState !== 'ready') return;
  controls.update(delta);
  if (pixelSize > 0) composer.render(delta);
  else renderer.render(scene, camera);
});
