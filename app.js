import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Replace an empty URL with './models/your-model.glb'. Keep all model files
// in this GitHub Pages repository. Use a self-contained, uncompressed GLB.
const objects = [
  { title: 'Ford Bronco Raptor', category: '01 / CUSTOM BRONCO', symbol: '◈', shape: 'knot', url: './models/Ud.glb' },
  { title: 'Soft geometry', category: '02 / SIMPLE COMPLEXITY', symbol: '◈', shape: 'crystal', url: '' },
  { title: 'Full circle', category: '03 / BALANCED BY DESIGN', symbol: '◎', shape: 'ring', url: '' },
];
const wrap = document.querySelector('#canvas-wrap');
const status = document.querySelector('#status');
const rotateButton = document.querySelector('#rotate');
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
// Studio reflections make the baked metallic paint and chrome visible.
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment();
scene.environment = pmrem.fromScene(environment, 0.04).texture;
environment.dispose();
pmrem.dispose();
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.5;
controls.maxDistance = 12;
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 1.2;
scene.add(new THREE.HemisphereLight(0xffffff, 0x65744f, 3));
const key = new THREE.DirectionalLight(0xffffff, 4);
key.position.set(3, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xe0f9b9, 2);
rim.position.set(-4, 1, -2);
scene.add(rim);
const loader = new GLTFLoader();
let current, requestId = 0;
function resetView() {
  camera.position.set(3.8, 2.0, wrap.clientWidth < 500 ? 6.1 : 4.7);
  controls.target.set(0, 0, 0);
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
    root = entry.url ? (await loader.loadAsync(entry.url)).scene : demo(entry.shape);
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
    status.textContent = 'Ready to explore';
  } catch (error) {
    if (root) dispose(root);
    if (id !== requestId) return;
    status.textContent = 'Model unavailable. Check its URL and file format. Showing a sample.';
    current = demo(entry.shape);
    scene.add(current);
    console.error(error);
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
new ResizeObserver(() => {
  const width = wrap.clientWidth, height = wrap.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}).observe(wrap);
updateRotationLabel();
select(0);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  if (document.hidden) return;
  controls.update(delta);
  renderer.render(scene, camera);
});
