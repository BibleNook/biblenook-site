// The hero iPhone as a real 3D object: an iPhone 17 Pro-sized aluminium body with rounded edges,
// its buttons, black glass and the app recording on the display. It follows the same scroll-driven
// turn as the CSS phone (whose --rx/--ry/--rz/--ty/--s it reads), which stays as the fallback.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const phone = document.getElementById('heroPhone');
const stage = phone?.parentElement;
const video = phone?.querySelector('video');

// iPhone 17 Pro, in millimetres (measured against Apple's bezel artwork).
const W = 71.9, H = 150.0, D = 8.75, R = 12.9;           // body and its corner radius
const EDGE = 1.15, EDGE_T = 1.5;                         // the rounded edge: how far in, how deep
const SW = 66.7, SH = 144.9, SR = 10.2;                  // display opening
const BUTTONS = [                                        // side, from-top, to-top (mm)
  [-1, 30.8, 37.7], [-1, 42.8, 54.0], [-1, 57.0, 68.2], // Action, volume up, volume down
  [1, 46.7, 64.4],                                       // side button
];

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

function planarUV(geo, w, h) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / w + .5; uv[i * 2 + 1] = p.getY(i) / h + .5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function build() {
  const g = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xd9d8d4, metalness: 1, roughness: .34, envMapIntensity: 1.15 });

  // Body: a rounded slab whose bevel gives the soft edge all the way round.
  const body = new THREE.ExtrudeGeometry(roundedRect(W - 2 * EDGE, H - 2 * EDGE, R - EDGE), {
    depth: D - 2 * EDGE_T, bevelEnabled: true, bevelThickness: EDGE_T, bevelSize: EDGE, bevelSegments: 10, curveSegments: 48,
  });
  body.translate(0, 0, -(D - 2 * EDGE_T) / 2);
  g.add(new THREE.Mesh(body, metal));

  // Front glass, black where it isn't display.
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W - 2 * EDGE, H - 2 * EDGE, R - EDGE), 48),
    new THREE.MeshPhysicalMaterial({ color: 0x030303, roughness: .06, clearcoat: 1, clearcoatRoughness: .03 }));
  glass.position.z = D / 2 + .04;
  g.add(glass);

  // The display: the app recording.
  // The poster shows until the video has a frame, so the display is never blank.
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  const poster = new THREE.TextureLoader().load(video.poster, () => { g.userData.redraw?.(); });
  poster.colorSpace = THREE.SRGBColorSpace;
  // Safari draws a never-played video as black on a WebGL surface, so the still stays until it truly plays.
  const screenMat = new THREE.MeshBasicMaterial({ map: poster, toneMapped: false });
  video.addEventListener('playing', () => { screenMat.map = tex; screenMat.needsUpdate = true; });
  const screen = new THREE.Mesh(planarUV(new THREE.ShapeGeometry(roundedRect(SW, SH, SR), 48), SW, SH), screenMat);
  screen.position.z = D / 2 + .2;
  g.add(screen);

  // White over the display for the page's fade between replays (the page sets --fade on the video's screen).
  const veil = new THREE.Mesh(screen.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  veil.position.z = D / 2 + .28;
  g.add(veil);
  g.userData.veil = veil;

  // A faint reflection on the cover glass, added over the display.
  const sheen = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W - 2 * EDGE, H - 2 * EDGE, R - EDGE), 48),
    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: .08, metalness: 0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: .45 }));
  sheen.position.z = D / 2 + .36;
  g.add(sheen);

  // Buttons: aluminium pills standing half a millimetre proud of the sides.
  for (const [side, a, b] of BUTTONS) {
    const len = b - a, r = 1.05;
    const btn = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 8, 24), metal);
    btn.scale.set(.55, 1, 1);
    btn.position.set(side * (W / 2 - .05), H / 2 - (a + b) / 2, 0);
    g.add(btn);
  }
  return g;
}

function start() {
  if (!phone || !video) return;
  // The flat phone is kept where 3D would cost more than it gives: Reduce Motion, Data Saver, low-power devices.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) return;
  if ((navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4)) return;
  let renderer;
  // Dense screens don't need MSAA, which costs a lot on phones.
  try { renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' }); }
  catch { return; }                                                       // no WebGL: the CSS phone stays
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'phone-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-300, 600, 900); scene.add(key);
  const model = build(); scene.add(model);
  const camera = new THREE.PerspectiveCamera(30, 1, 600, 4000);

  const PERSPECTIVE = 1700;                                               // as .intro-sticky's CSS perspective
  let w = 0, h = 0;
  function size() {
    const nw = stage.clientWidth, nh = stage.clientHeight;
    if (nw === w && nh === h) return;                   // reallocating the drawing buffer is costly; only when it truly changed
    w = nw; h = nh;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = 2 * Math.atan(h / 2 / PERSPECTIVE) * 180 / Math.PI;      // one world unit = one CSS pixel at z = 0
    camera.position.set(0, 0, PERSPECTIVE);
    camera.updateProjectionMatrix();
  }
  size();
  addEventListener('resize', size);

  // The CSS phone's untransformed centre and its body's width in pixels change only on resize.
  let cx = 0, cy = 0, k = 1, last = '';
  // Measured on screen against the canvas itself (the flat phone has no transform while 3D is on), so the
  // model sits exactly where the page centres the phone, whatever the browser's offset rules.
  function layout() {
    const p = phone.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    cx = p.left - c.left + p.width / 2; cy = p.top - c.top + p.height / 2;
    k = p.width * .96345 / W;
  }
  phone.classList.add('as-3d');                       // drop the flat phone's transform before measuring
  const relayout = () => { size(); layout(); last = ''; };
  relayout();
  new ResizeObserver(relayout).observe(stage);
  new ResizeObserver(relayout).observe(phone);
  addEventListener('resize', relayout);
  addEventListener('load', relayout);
  document.fonts?.ready.then(relayout);
  model.userData.redraw = () => { last = ''; };

  // Draw only when something changed: the scroll pose (inline vars set by the page) or a new video frame.
  const num = (v) => parseFloat(v) || 0;
  let videoFrames = 0;
  if ('requestVideoFrameCallback' in video) {
    const tick = () => { videoFrames++; video.requestVideoFrameCallback(tick); };
    video.requestVideoFrameCallback(tick);
  }
  function frame() {
    const st = phone.style;
    const pose = st.getPropertyValue('--rx') + st.getPropertyValue('--ry') + st.getPropertyValue('--rz') + st.getPropertyValue('--ty') + st.getPropertyValue('--s');
    const vid = 'requestVideoFrameCallback' in video ? videoFrames : (video.paused ? -1 : performance.now());
    const fade = video.parentElement.style.getPropertyValue('--fade') || '0';
    const key = pose + '|' + vid + '|' + fade;
    if (key === last) return;
    last = key;
    const rx = num(st.getPropertyValue('--rx')), ry = num(st.getPropertyValue('--ry')), rz = num(st.getPropertyValue('--rz'));
    const tyRaw = st.getPropertyValue('--ty').trim(), s = num(st.getPropertyValue('--s')) || 1;
    const ty = tyRaw.endsWith('vh') ? num(tyRaw) * h / 100 : num(tyRaw);   // svh: the pinned stage is 100svh tall
    model.position.set(cx - w / 2, h / 2 - cy - ty, 0);
    model.rotation.set(-rx * Math.PI / 180, ry * Math.PI / 180, -rz * Math.PI / 180, 'XYZ');   // CSS is y-down
    model.scale.setScalar(k * s);
    model.userData.veil.material.opacity = num(fade);
    model.userData.veil.visible = num(fade) > 0;
    renderer.render(scene, camera);
  }

  let on = false;
  const loop = () => { if (!on) return; frame(); requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => { const was = on; on = e.isIntersecting; if (on && !was) { last = ''; loop(); } }).observe(stage);
  phone.classList.add('as-3d');
}

// If anything in the 3D set-up fails, the flat phone stays visible rather than leaving an empty stage.
try { start(); }
catch (err) {
  console.warn('3D iPhone unavailable, showing the flat phone', err);
  phone?.classList.remove('as-3d');
  stage?.querySelector('.phone-canvas')?.remove();
}
