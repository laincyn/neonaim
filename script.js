'use strict';
const $ = id => document.getElementById(id), R = (a, b) => a + Math.random() * (b - a), V = THREE.Vector3, D2R = Math.PI / 180;
const _v1 = new V(), _v2 = new V(), _v3 = new V(), _q1 = new THREE.Quaternion();
const store = {
  get(k, d) { try { const v = localStorage.getItem('naim_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('naim_' + k, JSON.stringify(v)); } catch (e) {} }
};
if (store.get('ver', 1) < 2) {
  const o = store.get('fov', 90);
  store.set('fov', o === 90 ? 103 : Math.round(Math.min(110, Math.max(60, 2 * Math.atan(Math.tan(o * D2R / 2) * 16 / 9) / D2R))));
  store.set('ver', 2);
}

/* ---------- CONFIG ---------- */
const MODES = [
  { id: 'grid',    name: 'Gridshot',  desc: '3 static spheres. Rapid cadence.' },
  { id: 'sixshot', name: 'Sixshot',   desc: '6 tiny targets. Extreme precision.' },
  { id: 'flick',   name: 'Flick',     desc: 'Targets vanish fast. Snap wide.' },
  { id: 'track',   name: 'Tracking',  desc: 'Hold fire. Stay locked on.' },
  { id: 'strafe',  name: 'Strafe',    desc: 'Predict dodging & jumping bots.' },
  { id: 'switch',  name: 'Switching', desc: 'Hold fire to burst moving orbs.' }
];
const DIFFS = { Easy: { r: 1.3, s: .72, l: 2.8 }, Normal: { r: 1, s: 1, l: 1.9 }, Hard: { r: .72, s: 1.38, l: 1.25 } };
const DURS = [30, 60, 90], COLS = ['#22f0ff', '#39ff6a', '#ffe14a', '#ff2bd6', '#ffffff'], HUES = [190, 145, 50, 315, 265];
const TMODES = ['Multi', 'Solid', 'White', 'Black'];
const THEMES = ['Neon', 'Range', 'Black', 'Solid', 'Grid'];
const GUNS = ['Vandal', 'Phantom', 'Sheriff', 'Operator'];
const HANDS = ['Right', 'Left', 'Off'];
const RECOILS = ['Off', 'Visual', 'Pattern'];
const SFXS = ['Synth', 'Crisp', 'Bell'];

const cfg = {
  mode: store.get('mode', 'grid'), diff: store.get('diff', 'Normal'), dur: store.get('dur', 60),
  sens: store.get('sens', .4), fov: store.get('fov', 103), col: store.get('col', COLS[0]), dpi: store.get('dpi', 800),
  xlen: store.get('xlen', 9), xgap: store.get('xgap', 5), xth: store.get('xth', 2), xop: store.get('xop', 1),
  xol: store.get('xol', true), xdot: store.get('xdot', true), vol: store.get('vol', 1),
  tmode: store.get('tmode', 'Multi'), tcol: store.get('tcol', '#ff2bd6'),
  tedge: store.get('tedge', true), tecol: store.get('tecol', '#ffffff'), tglow: store.get('tglow', true),
  theme: store.get('theme', 'Neon'), bgcol: store.get('bgcol', '#141824'),
  gun: store.get('gun', 'Vandal'), hand: store.get('hand', 'Right'), recoil: store.get('recoil', 'Visual'),
  sfx: store.get('sfx', 'Synth'), trc: store.get('trc', true), punch: store.get('punch', true),
  redm: store.get('redm', false), fpsOn: store.get('fpsOn', false)
};
if (!THEMES.includes(cfg.theme)) cfg.theme = 'Neon';
const save = (k, v) => { cfg[k] = v; store.set(k, v); };
const bestKey = (m = cfg.mode) => `best_${m}_${cfg.diff}_${cfg.dur}`;
const histKey = (m = cfg.mode) => `hist_${m}_${cfg.diff}_${cfg.dur}`;
const cm360 = () => 360 / (.07 * cfg.sens) / cfg.dpi * 2.54;
const sensTxt = () => `${cfg.sens} · ≈${cm360().toFixed(0)} cm/360`;
const isHoldMode = (m = cfg.mode) => m === 'track' || m === 'switch';

/* ---------- AUDIO & DOPAMINE SYNTH ---------- */
let ac, muted = false;
function tone(f, dur = .14, type = 'sine', vol = .1, slide = 1, delay = 0) {
  if (muted || cfg.vol <= 0) return;
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(20, f), t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(Math.max(.0001, vol * cfg.vol), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}
const PENT = [0, 2, 4, 7, 9];
const hz = i => { i = Math.min(i, 15); return 261.63 * 2 ** ((PENT[i % 5] + 12 * Math.floor(i / 5)) / 12); };

function playGunSound() {
  if (cfg.gun === 'Phantom') {
    tone(220, .055, 'triangle', .11, .35); tone(1400, .03, 'sine', .06, .5);
  } else if (cfg.gun === 'Sheriff') {
    tone(140, .14, 'sawtooth', .15, .28); tone(420, .06, 'square', .08, .4);
  } else if (cfg.gun === 'Operator') {
    tone(95, .22, 'sawtooth', .18, .22); tone(680, .09, 'triangle', .09, .3);
  } else { // Vandal
    tone(165, .09, 'sawtooth', .13, .32); tone(880, .035, 'triangle', .06, .5);
  }
}

function playHitSound(streak, bull, chain) {
  const p = bull ? 1.22 : 1;
  // Sub-bass dopamine thump on every kill
  tone(115 * p, .11, 'sine', .16, .38);
  if (cfg.sfx === 'Crisp') {
    tone(960 * p, .045, 'triangle', .16, .45); tone(1950 * p, .028, 'sine', .1, .7);
  } else if (cfg.sfx === 'Bell') {
    const f = (520 + Math.min(streak, 12) * 28) * p;
    tone(f, .19, 'sine', .14, 1); tone(f * 2, .09, 'sine', .06, 1.01);
  } else {
    const f = hz(streak) * p;
    tone(f, .14, 'triangle', .13, 1.04); tone(f * 2, .08, 'sine', .05);
  }
  // Valorant-style escalating multi-kill chord stinger
  if (chain >= 2) {
    const root = 330 * (1 + Math.min(chain - 2, 5) * .12);
    tone(root, .18, 'triangle', .11, 1.02, .02);
    tone(root * 1.25, .22, 'sine', .09, 1.02, .05);
    if (chain >= 5) tone(root * 1.5, .32, 'triangle', .12, 1.05, .09);
  }
}

/* ---------- 3D SCENE, SCENERIES & TACTICAL RANGE ---------- */
const cv = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060f); scene.fog = new THREE.Fog(0x07060f, 35, 92);
const cam = new THREE.PerspectiveCamera(70, 1, .08, 200);
cam.position.set(0, 1.7, 0); cam.rotation.order = 'YXZ';
scene.add(cam); // Required so the 3D POV gun viewmodel attached to cam renders in world!

let fovKick = 0;
function applyFov() {
  const hFov = Math.max(50, Math.min(120, cfg.fov - fovKick));
  cam.fov = 2 * Math.atan(Math.tan(hFov * D2R / 2) / cam.aspect) / D2R;
  cam.updateProjectionMatrix();
}
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; applyFov(); }
addEventListener('resize', resize); resize();

const ambL = new THREE.AmbientLight(0x9988ff, .85); scene.add(ambL);
const dirL = new THREE.DirectionalLight(0xffffff, .6); dirL.position.set(5, 14, 10); scene.add(dirL);
const ptL1 = new THREE.PointLight(0x22f0ff, 1.35, 65); ptL1.position.set(-9, 8, -8); scene.add(ptL1);
const ptL2 = new THREE.PointLight(0xff2bd6, 1.35, 65); ptL2.position.set(9, 6, -15); scene.add(ptL2);

// Enclosed room
const RW = 60, RH = 26, RD = 70;
const gridTex = (line, base) => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128); g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
};
const face = (tex, w, h) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / 4, h / 4); return new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide }); };
const TEX_SETS = {
  Neon:  [gridTex('#1fd9ee', '#0b0924'), gridTex('#ff2bd6', '#08061a'), gridTex('#4b2fd0', '#06051a')],
  Grid:  [gridTex('#273248', '#101520'), gridTex('#32425e', '#0c1018'), gridTex('#1d2536', '#0a0d14')],
  Range: [gridTex('#4a525d', '#353b45'), gridTex('#3d444f', '#282d35'), gridTex('#2c323b', '#1e2229')]
};
const roomMats = [
  face(TEX_SETS.Neon[0], RD, RH), face(TEX_SETS.Neon[0], RD, RH),
  face(TEX_SETS.Neon[2], RW, RD), face(TEX_SETS.Neon[1], RW, RD),
  face(TEX_SETS.Neon[0], RW, RH), face(TEX_SETS.Neon[0], RW, RH)
];
const room = new THREE.Mesh(new THREE.BoxGeometry(RW, RH, RD), roomMats);
room.position.y = RH / 2; scene.add(room);
const edgeMat = new THREE.LineBasicMaterial({ color: 0xff2bd6 });
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(room.geometry), edgeMat);
edges.position.copy(room.position); scene.add(edges);

// Synthwave sun (raised to y = 16.2 so it sits above the target zone and never blocks the crosshair!)
const sunC = document.createElement('canvas'); sunC.width = sunC.height = 256;
{ const g = sunC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#ffe14a'); gr.addColorStop(.55, '#ff5e7e'); gr.addColorStop(1, '#ff2bd6');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
  g.globalCompositeOperation = 'destination-out'; for (let y = 142; y < 256; y += 13) g.fillRect(0, y, 256, (y - 126) / 9); }
const sun = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sunC), transparent: true, opacity: .82, fog: false }));
sun.position.set(0, 16.2, -34.7); scene.add(sun);

const starGeo = new THREE.BufferGeometry(), starPos = new Float32Array(180 * 3);
for (let i = 0; i < 180; i++) { starPos[i * 3] = R(-28, 28); starPos[i * 3 + 1] = R(8, 24); starPos[i * 3 + 2] = R(-34, -8); }
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: .16, transparent: true, opacity: .65, fog: false }));
scene.add(stars);

// Procedural Valorant-inspired Tactical Shooting Range scenery (100% procedural geometry)
const rangeGrp = new THREE.Group(); scene.add(rangeGrp);
{
  const concrete = new THREE.MeshStandardMaterial({ color: 0x3b424d, roughness: .85 });
  const warmWall = new THREE.MeshStandardMaterial({ color: 0x6e6259, roughness: .75 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1e232a, roughness: .4, metalness: .5 });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0xff4655 }); // Tactical crimson range accent stripe
  const tealMat = new THREE.MeshBasicMaterial({ color: 0x22f0ff });

  // Recessed target bay framing & side pillars
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(34, 14, .6), warmWall);
  backPanel.position.set(0, 7, -29.5); rangeGrp.add(backPanel);
  const innerBay = new THREE.Mesh(new THREE.BoxGeometry(28, 10.5, .4), concrete);
  innerBay.position.set(0, 5.6, -29.1); rangeGrp.add(innerBay);
  const topStripe = new THREE.Mesh(new THREE.BoxGeometry(28.4, .22, .5), trimMat);
  topStripe.position.set(0, 10.9, -29.0); rangeGrp.add(topStripe);
  const botStripe = new THREE.Mesh(new THREE.BoxGeometry(28.4, .18, .5), tealMat);
  botStripe.position.set(0, .4, -29.0); rangeGrp.add(botStripe);

  // Side architectural columns & overhead rafters
  [-15.5, 15.5].forEach(x => {
    for (let z = -6; z >= -28; z -= 10) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, RH, 1.4), darkSteel);
      col.position.set(x, RH / 2, z); rangeGrp.add(col);
    }
  });
  for (let z = -8; z >= -28; z -= 8) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(34, .7, .9), darkSteel);
    beam.position.set(0, 13.5, z); rangeGrp.add(beam);
  }
  // Floor distance marker strips (10m, 20m, 30m)
  [-10, -20, -28].forEach((z, idx) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(26, .16), idx === 1 ? trimMat : tealMat);
    line.rotation.x = -Math.PI / 2; line.position.set(0, .03, z); rangeGrp.add(line);
  });
}

function applyTheme() {
  const t = cfg.theme;
  rangeGrp.visible = (t === 'Range');
  sun.visible = stars.visible = (t === 'Neon');
  if (t === 'Black') {
    room.visible = false; edges.visible = false;
    scene.background.setHex(0x000000); scene.fog.color.setHex(0x000000);
  } else if (t === 'Solid') {
    room.visible = true; edges.visible = false;
    const c = new THREE.Color(cfg.bgcol);
    scene.background.copy(c); scene.fog.color.copy(c);
    roomMats.forEach(m => { m.map = null; m.color.copy(c); m.needsUpdate = true; });
  } else {
    room.visible = true; edges.visible = true;
    const set = TEX_SETS[t] || TEX_SETS.Neon;
    [0, 1, 4, 5].forEach(i => { roomMats[i].color.setHex(0xffffff); roomMats[i].map = set[0]; roomMats[i].map.repeat.set((i < 2 ? RD : RW) / 4, RH / 4); roomMats[i].needsUpdate = true; });
    roomMats[2].color.setHex(0xffffff); roomMats[2].map = set[2]; roomMats[2].map.repeat.set(RW / 4, RD / 4); roomMats[2].needsUpdate = true;
    roomMats[3].color.setHex(0xffffff); roomMats[3].map = set[1]; roomMats[3].map.repeat.set(RW / 4, RD / 4); roomMats[3].needsUpdate = true;
    const bgHex = t === 'Range' ? 0x1d2229 : (t === 'Grid' ? 0x0c1018 : 0x07060f);
    const edHex = t === 'Range' ? 0xff4655 : (t === 'Grid' ? 0x32425e : 0xff2bd6);
    scene.background.setHex(bgHex); scene.fog.color.setHex(bgHex); edgeMat.color.setHex(edHex);
  }
}

/* ---------- 3D FIRST-PERSON POV WEAPON VIEWMODEL ---------- */
const vmRoot = new THREE.Group();
cam.add(vmRoot);
const vmLight = new THREE.PointLight(0xffffff, .9, 3.5);
vmLight.position.set(0, .2, -.3); cam.add(vmLight);

const gunModels = {}, gunMuzzleZ = { Vandal: -.78, Phantom: -.88, Sheriff: -.64, Operator: -.98 };
const gDark = new THREE.MeshStandardMaterial({ color: 0x181b22, roughness: .35, metalness: .65 });
const gMid  = new THREE.MeshStandardMaterial({ color: 0x2c3240, roughness: .4, metalness: .5 });
const gNeon = new THREE.MeshBasicMaterial({ color: 0x22f0ff });
const gGold = new THREE.MeshBasicMaterial({ color: 0xffe14a });

function mkBox(w, h, d, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.x = rx; return m;
}
function mkCyl(rt, rb, h, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), mat);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m;
}

// 1. Vandal (Heavy angular rifle)
{
  const g = new THREE.Group();
  g.add(mkBox(.068, .085, .44, gDark, 0, 0, -.26));
  g.add(mkBox(.056, .062, .28, gMid, 0, .005, -.58));
  g.add(mkCyl(.016, .016, .24, gDark, 0, .01, -.74));
  g.add(mkBox(.072, .008, .38, gNeon, 0, .045, -.38)); // Neon accent rail
  g.add(mkBox(.046, .16, .075, gMid, 0, -.11, -.32, .22)); // Curved mag
  g.add(mkBox(.032, .035, .06, gDark, 0, .06, -.22)); // Holo sight frame
  g.add(mkBox(.012, .016, .01, gGold, 0, .06, -.22)); // Sight reticle dot
  gunModels.Vandal = g; vmRoot.add(g);
}
// 2. Phantom (Sleek suppressed rifle)
{
  const g = new THREE.Group();
  g.add(mkBox(.064, .08, .42, gMid, 0, 0, -.25));
  g.add(mkCyl(.028, .028, .42, gDark, 0, .008, -.66)); // Integrated suppressor
  g.add(mkCyl(.03, .03, .025, gNeon, 0, .008, -.55));  // Cyan suppressor ring
  g.add(mkCyl(.03, .03, .025, gNeon, 0, .008, -.78));
  g.add(mkBox(.042, .14, .065, gDark, 0, -.1, -.3, -.08));
  g.add(mkBox(.038, .04, .08, gDark, 0, .058, -.24));
  gunModels.Phantom = g; vmRoot.add(g);
}
// 3. Sheriff (Heavy six-shot revolver)
{
  const g = new THREE.Group();
  g.add(mkBox(.052, .07, .22, gDark, 0, -.01, -.22));
  g.add(mkCyl(.038, .038, .09, gMid, 0, .005, -.26)); // Revolver cylinder
  g.add(mkBox(.044, .062, .34, gMid, 0, .018, -.46)); // Heavy octagonal barrel
  g.add(mkBox(.048, .008, .32, gGold, 0, .051, -.46)); // Gold top rib
  g.add(mkBox(.044, .13, .065, gDark, 0, -.09, -.14, -.32));
  gunModels.Sheriff = g; vmRoot.add(g);
}
// 4. Operator (Sniper rifle with scope)
{
  const g = new THREE.Group();
  g.add(mkBox(.074, .09, .52, gDark, 0, -.005, -.28));
  g.add(mkCyl(.018, .022, .56, gMid, 0, .012, -.74)); // Long fluted barrel
  g.add(mkBox(.044, .044, .07, gDark, 0, .012, -.98)); // Muzzle brake
  g.add(mkCyl(.032, .026, .28, gDark, 0, .078, -.28)); // Scope tube
  g.add(mkCyl(.028, .028, .01, gNeon, 0, .078, -.421)); // Glowing scope lens
  g.add(mkBox(.078, .01, .48, gGold, 0, .042, -.3));
  gunModels.Operator = g; vmRoot.add(g);
}

// Muzzle flash sprite on viewmodel
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.38, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const muzFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe14a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false }));
muzFlash.scale.setScalar(.28); vmRoot.add(muzFlash);

let vmKickZ = 0, vmKickP = 0, vmEquip = 0, muzT = 0;
function applyGun() {
  GUNS.forEach(k => { if (gunModels[k]) gunModels[k].visible = (cfg.gun === k); });
  vmRoot.visible = (cfg.hand !== 'Off');
  const side = cfg.hand === 'Left' ? -1 : 1;
  vmRoot.scale.set(side, 1, 1);
  muzFlash.position.set(0, .015, gunMuzzleZ[cfg.gun] || -.78);
  vmEquip = .18; // Subtle equip pop animation
}

/* ---------- TARGETS & CUSTOM EDGE OUTLINES ---------- */
const sphereG = new THREE.SphereGeometry(1, 28, 20);
const edgeSphereG = new THREE.SphereGeometry(1.068, 24, 18); // Inverted hull for crisp 3D edge outline
const HCOL = HUES.map(h => new THREE.Color().setHSL(h / 360, 1, .56));
const _tCol = new THREE.Color(), _eCol = new THREE.Color();

const mkMat = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .85, roughness: .22, metalness: .1 });
function mkTargetMesh(col) {
  const m = new THREE.Mesh(sphereG, mkMat(col));
  // Child 0: Additive halo sprite
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: .68, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.setScalar(3.1); m.add(sp);
  // Child 1: 3D Edge Outline (BackSide hull renders a crisp border ring around the sphere!)
  const ed = new THREE.Mesh(edgeSphereG, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }));
  m.add(ed);
  return m;
}

function styleTargetMesh(m, hi) {
  if (cfg.tmode === 'White') {
    _tCol.setHex(0xffffff); m.material.color.copy(_tCol); m.material.emissive.copy(_tCol); m.material.emissiveIntensity = .95;
  } else if (cfg.tmode === 'Black') {
    _tCol.setHex(0x08080e); m.material.color.copy(_tCol); m.material.emissive.setHex(0x000000); m.material.emissiveIntensity = 0;
  } else if (cfg.tmode === 'Solid') {
    _tCol.set(cfg.tcol); m.material.color.copy(_tCol); m.material.emissive.copy(_tCol); m.material.emissiveIntensity = .85;
  } else {
    _tCol.copy(HCOL[hi % 5]); m.material.color.copy(_tCol); m.material.emissive.copy(_tCol); m.material.emissiveIntensity = .85;
  }
  _eCol.set(cfg.tecol);
  const sp = m.children[0], ed = m.children[1];
  if (sp) { sp.visible = !!cfg.tglow; sp.material.color.copy(cfg.tmode === 'Black' ? _eCol : _tCol); sp.scale.setScalar(3.1); }
  if (ed) { ed.visible = !!cfg.tedge; ed.material.color.copy(_eCol); }
}

const deco = new THREE.Group(); scene.add(deco);
for (let i = 0; i < 10; i++) {
  const m = mkTargetMesh(HCOL[i % 5]); m.position.set(R(-12, 12), R(2, 9.5), R(-26, -11));
  m.scale.setScalar(R(.42, .95)); m.userData = { p: R(0, 6), y: m.position.y, hi: i % 5 };
  styleTargetMesh(m, i % 5); deco.add(m);
}
function recolorAllTargets() {
  deco.children.forEach(m => styleTargetMesh(m, m.userData.hi));
  targets.forEach(t => styleTargetMesh(t.m, t.hi));
}

/* ---------- POOLS & GAME STATE ---------- */
let state = 'menu', fromCard = 'menu', T = 0, E = 0, S, yaw = 0, pitch = 0, firing = false, spawnAt = 0, lastFlick = new V(), hasFlick = false, lastHit = 0, cdTimer = 0, lockT = 0, kT = 0, vigT = 0, rawTry = false;
// Valorant-style recoil state
let recP = 0, recY = 0, recIdx = 0, lastShotT = 0;
const targets = [], tMeshes = [], shards = [], decals = [], rings = [], tracers = [];
const pool = [], spool = [], dpool = [], rpool = [], trpool = [];
const ray = new THREE.Raycaster(), C0 = new THREE.Vector2(0, 0);
const shardG = new THREE.SphereGeometry(.09, 6, 6), shardMats = HCOL.map(c => new THREE.MeshBasicMaterial({ color: c.clone().offsetHSL(0, 0, .12) }));
const decalG = new THREE.CircleGeometry(.11, 10), decalM = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const ringG = new THREE.RingGeometry(.72, .95, 24);

const ppPool = []; let ppIdx = 0;
for (let i = 0; i < 16; i++) { const d = document.createElement('div'); d.className = 'pp'; $('ppLayer').append(d); ppPool.push(d); }

const newStats = () => ({
  on: false, score: 0, hits: 0, shots: 0, bulls: 0, onT: 0, tt: 0,
  streak: 0, best: 0, bestLock: 0, lock: 0, chain: 0, chainUntil: 0,
  rts: [], shots2d: [], log: [], nextLog: 1, tick: 0, sec: -1
});
S = newStats();
const mult = () => isHoldMode() ? 1 + Math.min(Math.floor(S.lock * 1.2), 10) * .1 : 1 + Math.min(Math.floor(S.streak / 5), 10) * .1;
const accOf = (empty = 100) => isHoldMode() ? (S.tt ? S.onT / S.tt * 100 : empty) : (S.shots ? S.hits / S.shots * 100 : empty);

function addTarget(p, r, extra = {}) {
  const hi = Math.random() * 5 | 0, m = pool.pop() || mkTargetMesh(HCOL[0]);
  styleTargetMesh(m, hi);
  m.position.copy(p); m.scale.setScalar(.001);
  const t = Object.assign({ m, r, hi, born: T, life: Infinity, hp: 1, maxHp: 1 }, extra); m.userData.t = t;
  scene.add(m); targets.push(t); tMeshes.push(m); return t;
}
function removeTarget(t) {
  scene.remove(t.m); t.m.userData.t = null; pool.push(t.m);
  const idx = targets.indexOf(t); if (idx !== -1) { targets.splice(idx, 1); tMeshes.splice(idx, 1); }
}
function wallPos(minDist = 3.2, spreadX = 9, minY = 1.4, maxY = 7.5) {
  for (let i = 0; i < 30; i++) {
    _v1.set(R(-spreadX, spreadX), R(minY, maxY), -20);
    if (targets.every(t => t.m.position.distanceTo(_v1) > minDist)) break;
  }
  return _v1;
}
function spawnGrid() { addTarget(wallPos(3.4, 8.8, 1.5, 7.4), .7 * DIFFS[cfg.diff].r); }
function spawnSixshot() { addTarget(wallPos(2.2, 9.2, 1.3, 7.8), .33 * DIFFS[cfg.diff].r); }
function spawnFlick() {
  const d = DIFFS[cfg.diff];
  for (let i = 0; i < 20; i++) { _v1.set(R(-13, 13), R(.9, 9), R(-24, -16)); if (!hasFlick || _v1.distanceTo(lastFlick) >= 9) break; }
  lastFlick.copy(_v1); hasFlick = true; addTarget(_v1, .55 * d.r, { life: d.l });
}
function spawnStrafe() {
  const d = DIFFS[cfg.diff], y0 = R(1.0, 2.8);
  _v1.set(R(-10, 10), y0, R(-25, -13));
  addTarget(_v1, .64 * d.r, {
    vx: (Math.random() < .5 ? -1 : 1) * R(3.2, 6.2) * d.s, turn: T + R(.35, 1.35),
    vz: (Math.random() < .5 ? -1 : 1) * R(1.2, 2.8) * d.s, y0, vy: 0, air: false, jump: T + R(.9, 2.8), stop: 0
  });
}
function spawnSwitch() {
  const d = DIFFS[cfg.diff], y0 = R(1.5, 6.8);
  _v1.set(R(-10, 10), y0, R(-23, -15));
  addTarget(_v1, .76 * d.r, {
    sw: true, hp: .34, maxHp: .34, vx: (Math.random() < .5 ? -1 : 1) * R(2.2, 4.4) * d.s,
    vy: (Math.random() < .5 ? -1 : 1) * R(.8, 1.8) * d.s, turn: T + R(.8, 2.0)
  });
}
const respawn = () => ({ grid: spawnGrid, sixshot: spawnSixshot, strafe: spawnStrafe, switch: spawnSwitch }[cfg.mode] || (() => {}))();
function setupMode() {
  const d = DIFFS[cfg.diff];
  if (cfg.mode === 'grid') for (let i = 0; i < 3; i++) spawnGrid();
  if (cfg.mode === 'sixshot') for (let i = 0; i < 6; i++) spawnSixshot();
  if (cfg.mode === 'flick') spawnFlick();
  if (cfg.mode === 'track') { _v1.set(0, 4, -20); addTarget(_v1, 1.25 * d.r, { tr: true, ph: [R(0, 6), R(0, 6)] }); }
  if (cfg.mode === 'strafe') { spawnStrafe(); spawnStrafe(); }
  if (cfg.mode === 'switch') for (let i = 0; i < 3; i++) spawnSwitch();
}

/* ---------- POOLED EFFECTS & DOPAMINE FEEDBACK ---------- */
function boom(t, bull) {
  const count = cfg.redm ? 5 : 15;
  for (let i = 0; i < count; i++) {
    const m = spool.pop() || new THREE.Mesh(shardG, shardMats[0]), u = m.userData;
    m.material = shardMats[t.hi % 5]; m.position.copy(t.m.position); m.scale.setScalar(1);
    (u.v = u.v || new V()).set(R(-1, 1), R(-.3, 1.3), R(-1, 1)).multiplyScalar(R(3.5, 8.2)); u.born = E;
    scene.add(m); shards.push(m);
  }
  const rm = rpool.pop() || new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .88, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  rm.material.color.setHex(bull ? 0xffe14a : HCOL[t.hi % 5].getHex()); rm.material.opacity = .92;
  rm.position.copy(t.m.position); rm.lookAt(cam.position); rm.scale.setScalar(t.r * .8);
  rm.userData.born = E; rm.userData.r0 = t.r * .8;
  scene.add(rm); rings.push(rm);
}
function addTracer(toPt, colHex) {
  if (!cfg.trc || cfg.redm) return;
  let ln = trpool.pop();
  if (!ln) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: colHex, transparent: true, opacity: .65, blending: THREE.AdditiveBlending }));
  }
  // Originate tracer directly from the 3D gun's muzzle tip when viewmodel is visible!
  const side = cfg.hand === 'Left' ? -1 : (cfg.hand === 'Right' ? 1 : 0);
  _v2.set(.24 * side, -.17, gunMuzzleZ[cfg.gun] || -.75).applyQuaternion(cam.quaternion).add(cam.position);
  const arr = ln.geometry.attributes.position.array;
  arr[0] = _v2.x; arr[1] = _v2.y; arr[2] = _v2.z;
  arr[3] = toPt.x; arr[4] = toPt.y; arr[5] = toPt.z;
  ln.geometry.attributes.position.needsUpdate = true;
  ln.material.color.setHex(colHex); ln.material.opacity = .65; ln.userData.born = E;
  scene.add(ln); tracers.push(ln);
}
function clearFx() {
  while (shards.length) { const m = shards.pop(); scene.remove(m); spool.push(m); }
  while (decals.length) { const m = decals.pop(); scene.remove(m); dpool.push(m); }
  while (rings.length)  { const m = rings.pop();  scene.remove(m); rpool.push(m); }
  while (tracers.length){ const m = tracers.pop();scene.remove(m); trpool.push(m); }
  for (let i = 0; i < ppPool.length; i++) ppPool[i].className = 'pp';
}
function popup(pos, txt, cls = '') {
  _v1.copy(pos).project(cam); if (_v1.z > 1) return;
  const e = ppPool[ppIdx = (ppIdx + 1) % ppPool.length];
  e.className = 'pp'; void e.offsetWidth;
  e.textContent = txt; e.className = 'pp on ' + cls;
  e.style.left = (_v1.x * .5 + .5) * innerWidth + 'px';
  e.style.top = (-_v1.y * .5 + .5) * innerHeight + 'px';
}
const retrig = (el, c) => { el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };
const hitmark = bull => { const h = $('hm'); h.classList.toggle('bull', !!bull); retrig(h, 'on'); };
function banner(txt) { const b = $('banner'); b.textContent = txt; retrig(b, 'show'); }
function flashVig(col) {
  if (cfg.redm) return;
  const v = $('vig'); v.style.setProperty('--vig-col', col); v.classList.add('on');
  clearTimeout(vigT); vigT = setTimeout(() => v.classList.remove('on'), 150);
}
function showKillChain(chain) {
  if (chain < 2) return;
  const labels = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUADRA KILL', '★ ACE! ★', '⚡ OVERKILL ⚡', '🔥 RADIANT! 🔥'];
  const kb = $('killBadge');
  kb.textContent = `${chain}K · ${labels[Math.min(chain, 7)]}`;
  retrig(kb, 'show');
}

function triggerGunRecoil(miss) {
  const c = $('cross'); c.classList.add('shot'); c.classList.toggle('miss', !!miss);
  clearTimeout(kT); kT = setTimeout(() => c.classList.remove('shot', 'miss'), 85);
  if (!miss && cfg.punch && !cfg.redm) { fovKick = 1.65; applyFov(); }

  // 3D Viewmodel gun kickback + muzzle flash
  const gMul = cfg.gun === 'Operator' ? 1.8 : (cfg.gun === 'Sheriff' ? 1.45 : (cfg.gun === 'Phantom' ? .75 : 1));
  vmKickZ = Math.min(.14, vmKickZ + .055 * gMul);
  vmKickP = Math.min(.22, vmKickP + .065 * gMul);
  muzFlash.material.opacity = .92; muzFlash.material.rotation = R(0, 6.28); muzT = .045;

  // Valorant-style recoil pattern (when enabled)
  if (cfg.recoil === 'Off') return;
  if (E - lastShotT > .38) recIdx = 0;
  lastShotT = E; recIdx++;
  if (cfg.recoil === 'Visual') {
    recP = Math.min(.022, recP + .006 * gMul);
  } else if (cfg.recoil === 'Pattern') {
    // Vertical climb on shots 1..7, then horizontal T-sway left/right like Valorant rifles
    const vStep = recIdx <= 7 ? .011 * gMul : .0025 * gMul;
    const hStep = recIdx > 5 ? Math.sin(recIdx * 1.15) * .009 * gMul : (Math.random() - .5) * .002;
    recP = Math.min(.11, recP + vStep);
    recY = Math.max(-.065, Math.min(.065, recY + hStep));
  }
}

/* ---------- HUD ---------- */
const txt = {};
const setT = (id, v) => { if (txt[id] !== v) { txt[id] = v; $(id).textContent = v; } };
function hud() {
  const acc = accOf(), w = acc.toFixed(0) + '%';
  setT('score', Math.round(S.score).toLocaleString()); setT('accTxt', w);
  if (txt.w !== w) { txt.w = w; const b = $('accBar'); b.style.width = w; b.style.background = `hsl(${acc * 1.2},90%,55%)`; }
  setT('mult', 'x' + mult().toFixed(1));
  setT('stk', isHoldMode() ? S.lock.toFixed(1) + 's LOCK' : S.streak + ' STREAK');
}
function showHud(on) { $('hud').classList.toggle('hide', !on); $('streak').classList.toggle('hide', !on); }

/* ---------- SHOOTING ---------- */
function shoot() {
  if (state !== 'play') return;
  playGunSound();
  triggerGunRecoil(false);
  cam.updateMatrixWorld(); ray.setFromCamera(C0, cam); S.shots++;
  const hit = ray.intersectObjects(tMeshes, false)[0];
  if (hit) onHit(hit.object.userData.t, hit.point);
  else {
    S.streak = 0; S.chain = 0;
    $('cross').classList.add('miss');
    tone(135, .06, 'square', .045);
    flashVig('rgba(255,77,109,.38)');
    const w = ray.intersectObject(room, false)[0];
    if (w) {
      addTracer(w.point, 0xff4d6d);
      const d = dpool.pop() || new THREE.Mesh(decalG, decalM), n = w.face.normal;
      d.position.copy(w.point).addScaledVector(n, -.04); d.lookAt(d.position.x - n.x, d.position.y - n.y, d.position.z - n.z);
      d.scale.setScalar(1); d.userData.born = E; scene.add(d); decals.push(d);
      if (decals.length > 30) { const old = decals.shift(); scene.remove(old); dpool.push(old); }
    }
  }
  retrig($('score'), 'pop'); hud();
}
function onHit(t, hitPt) {
  const flick = cfg.mode === 'flick', rt = Math.max(0, flick ? (T - t.born - .15) * 1000 : (T - lastHit) * 1000); lastHit = T;
  _q1.copy(cam.quaternion).invert();
  _v2.subVectors(hitPt, t.m.position).applyQuaternion(_q1);
  const curR = Math.max(.05, t.m.scale.x), nx = Math.max(-1, Math.min(1, _v2.x / curR)), ny = Math.max(-1, Math.min(1, _v2.y / curR));
  const rad = Math.hypot(nx, ny), bull = rad <= .38;

  S.hits++; if (bull) S.bulls++;
  S.rts.push(rt); if (S.shots2d.length < 180) S.shots2d.push([nx, ny, bull ? 1 : 0]);
  S.streak++; S.best = Math.max(S.best, S.streak);
  S.chain = (T <= S.chainUntil) ? S.chain + 1 : 1;
  S.chainUntil = T + 1.35;

  const chainBonus = S.chain >= 2 ? Math.min(S.chain - 1, 5) * 15 : 0;
  const pts = Math.round((100 + Math.max(0, 800 - rt) / 8 + (bull ? 25 : 0) + chainBonus) * mult());
  S.score += pts;

  playHitSound(S.streak, bull, S.chain);
  showKillChain(S.chain);
  flashVig(bull ? 'rgba(255,225,74,.48)' : 'rgba(34,240,255,.38)');
  addTracer(hitPt, bull ? 0xffe14a : 0x22f0ff);
  boom(t, bull);
  popup(t.m.position, (bull ? '◎ +' : '+') + pts, bull ? 'bull' : (rt < 320 ? 'fast' : ''));
  hitmark(bull);
  removeTarget(t);
  if (flick) spawnAt = T + .18; else respawn();
  retrig($('mult'), 'pop');
}

/* ---------- UPDATE ---------- */
function update(dt) {
  const d = DIFFS[cfg.diff];
  cam.updateMatrixWorld(); ray.setFromCamera(C0, cam);
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i], age = T - t.born, k = Math.min(1, age / .14) - 1, s = Math.max(.001, 1 + 2.70158 * k ** 3 + 1.70158 * k ** 2), p = t.m.position;
    if (t.tr) { const q = t.ph; p.set(8 * Math.sin(T * .6 * d.s + q[0]) + 3 * Math.sin(T * 1.7 * d.s + q[1]), 4 + 2.6 * Math.sin(T * .8 * d.s + q[1]), -20); }
    if (t.sw) {
      p.x += t.vx * dt; p.y += t.vy * dt;
      if (Math.abs(p.x) > 11.5) { p.x = Math.sign(p.x) * 11.5; t.vx *= -1; }
      if (p.y < 1.3 || p.y > 7.8) { p.y = Math.max(1.3, Math.min(7.8, p.y)); t.vy *= -1; }
      if (T > t.turn) { t.vx = -t.vx * R(.85, 1.15); t.turn = T + R(.8, 2.0); }
    } else if (t.vx) {
      if (T >= t.stop) p.x += t.vx * dt;
      p.z += t.vz * dt; if (p.z < -27 || p.z > -11) { p.z = Math.max(-27, Math.min(-11, p.z)); t.vz *= -1; }
      if (Math.abs(p.x) > 13) { p.x = Math.sign(p.x) * 13; t.vx *= -1; }
      if (T > t.turn) {
        t.vx = -Math.sign(t.vx) * Math.min(7.2 * d.s, Math.max(2.6 * d.s, Math.abs(t.vx) * R(.72, 1.3))); t.turn = T + R(.35, 1.45);
        if (Math.random() < .32) t.stop = T + R(.14, .32);
      }
      if (t.air) { t.vy -= 16 * dt; p.y += t.vy * dt; if (p.y <= t.y0) { p.y = t.y0; t.air = false; t.jump = T + R(1.1, 2.8); } }
      else if (T > t.jump) { t.air = true; t.vy = R(5.2, 7.2); }
    }
    let sc = t.r * s;
    if (t.life < Infinity) {
      const f = age / t.life; sc *= 1 - .4 * f;
      if (f >= 1) { removeTarget(t); S.streak = 0; S.chain = 0; tone(110, .22, 'sawtooth', .06, .6); spawnAt = T + .22; hud(); continue; }
    }
    t.m.scale.setScalar(sc);
  }
  if (spawnAt && T >= spawnAt) { spawnAt = 0; spawnFlick(); }

  if (isHoldMode() && tMeshes.length) {
    const hit = firing ? ray.intersectObjects(tMeshes, false)[0] : null;
    if (cfg.mode === 'track' || firing) S.tt += dt;
    for (let i = 0; i < targets.length; i++) if (cfg.tmode !== 'Black') targets[i].m.material.emissiveIntensity = .85;
    if (hit) {
      const t = hit.object.userData.t;
      if (cfg.tmode !== 'Black') t.m.material.emissiveIntensity = 2.3;
      S.onT += dt; S.lock += dt; S.bestLock = Math.max(S.bestLock, S.lock);
      S.score += dt * (cfg.mode === 'switch' ? 120 : 150) * mult();
      if ((S.tick -= dt) <= 0) {
        S.tick = .085; tone(280 + Math.min(S.lock, 8) * 55, .045, 'sine', .045); hitmark(false);
        triggerGunRecoil(false); addTracer(hit.point, 0x22f0ff);
      }
      if (t.sw) {
        t.hp -= dt;
        if (t.m.children[0]) t.m.children[0].scale.setScalar(3.1 + (1 - t.hp / t.maxHp) * 2.2);
        if (t.hp <= 0) {
          const rt = Math.max(80, (T - lastHit) * 1000); lastHit = T;
          S.hits++; S.shots++; S.bulls++; S.rts.push(rt);
          S.chain = (T <= S.chainUntil) ? S.chain + 1 : 1; S.chainUntil = T + 1.5;
          const pts = Math.round(220 * mult()); S.score += pts;
          playHitSound(S.hits, true, S.chain); showKillChain(S.chain); flashVig('rgba(255,225,74,.48)');
          addTracer(hit.point, 0xffe14a); boom(t, true);
          popup(t.m.position, '+' + pts, 'bull'); hitmark(true);
          removeTarget(t); spawnSwitch(); retrig($('score'), 'pop');
        }
      }
    } else if (firing || cfg.mode === 'track') S.lock = 0;
    hud();
  }

  if (T >= S.nextLog) {
    S.log.push({ t: S.nextLog, acc: accOf(100), sc: Math.round(S.score) });
    S.nextLog += 1;
  }

  const left = Math.max(0, cfg.dur - T), sec = Math.ceil(left);
  setT('time', String(sec));
  if (sec !== S.sec) { S.sec = sec; if (sec <= 5 && sec > 0) { $('time').classList.add('warn'); tone(660, .08, 'square', .04); } }
  if (left <= 0) end();
}

/* ---------- FLOW ---------- */
const CARDS = ['menu', 'pause', 'results', 'settings'];
const showCard = id => CARDS.forEach(c => $(c).classList.toggle('hide', c !== id));
const stopCount = () => { clearTimeout(cdTimer); cdTimer = 0; };

function reqLock() {
  clearTimeout(lockT); lockT = setTimeout(lockFail, 1500); rawTry = true;
  try { const p = cv.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => {}); }
  catch (e) { rawTry = false; try { cv.requestPointerLock(); } catch (e2) { lockFail(); } }
}
function lockFail() {
  clearTimeout(lockT); rawTry = false;
  if (state === 'starting') { state = fromCard; showCard(fromCard); }
  if (state !== 'play' && state !== 'count') banner('CLICK AGAIN');
}
function lock() { if (state !== 'menu' && state !== 'results') return; fromCard = state; state = 'starting'; reqLock(); }

function countdown(n = 3) {
  stopCount(); if (state !== 'count') return;
  if (n === 0) { begin(); return; }
  banner(n); tone(440 + (3 - n) * 110, .12, 'triangle', .08);
  cdTimer = setTimeout(() => countdown(n - 1), 700);
}
function abortRun() {
  stopCount(); S.on = false; firing = false; spawnAt = 0; fovKick = 0; recP = 0; recY = 0; recIdx = 0; applyFov();
  $('cross').style.setProperty('--rx', '0px'); $('cross').style.setProperty('--ry', '0px');
  targets.slice().forEach(removeTarget); clearFx(); deco.visible = true; showHud(false); $('time').classList.remove('warn');
}
function begin() {
  abortRun(); S = newStats(); T = 0; S.on = true; state = 'play'; hasFlick = false; lastHit = 0; deco.visible = false;
  setT('modeName', MODES.find(m => m.id === cfg.mode).name.toUpperCase());
  showHud(true); hud(); setupMode(); banner('GO!'); tone(880, .25, 'triangle', .1, 1.5);
}
function restart() { if (state !== 'play' && state !== 'count') return; abortRun(); S = newStats(); state = 'count'; countdown(); }
function end() {
  state = 'results';
  S.log.push({ t: cfg.dur, acc: accOf(0), sc: Math.round(S.score) });
  abortRun(); document.exitPointerLock();
  tone(523, .2, 'triangle', .1); setTimeout(() => tone(659, .2, 'triangle', .1), 120); setTimeout(() => tone(784, .35, 'triangle', .1), 240);
  showResults();
}

/* ---------- RESULTS SCREEN, ANALYTICS CANVAS & PNG EXPORT ---------- */
function showResults() {
  const hold = cfg.mode === 'track', acc = accOf(0), th = hold ? [75, 60, 45, 30] : [92, 82, 68, 52];
  const g = acc >= th[0] ? 'S' : acc >= th[1] ? 'A' : acc >= th[2] ? 'B' : acc >= th[3] ? 'C' : 'D';
  const sc = Math.round(S.score), prevBest = store.get(bestKey(), 0), nb = sc > prevBest;
  if (nb) store.set(bestKey(), sc);
  const bestNow = Math.max(sc, prevBest);

  const hist = store.get(histKey(), []), lastRun = hist.length ? hist[hist.length - 1] : null;
  const avg = S.rts.length ? Math.round(S.rts.reduce((a, b) => a + b, 0) / S.rts.length) : 0;
  const fastest = S.rts.length ? Math.round(Math.min(...S.rts)) : 0;
  hist.push({ sc, acc: +acc.toFixed(1), avg, ts: Date.now() });
  if (hist.length > 10) hist.shift();
  store.set(histKey(), hist);

  const dSc = lastRun ? sc - lastRun.sc : 0, dAcc = lastRun ? acc - lastRun.acc : 0;
  const bullPct = S.hits ? Math.round(S.bulls / S.hits * 100) : 0;
  const modeTitle = MODES.find(m => m.id === cfg.mode).name.toUpperCase();
  const maxH = Math.max(1, ...hist.map(h => h.sc));
  const barsHtml = hist.map((h, i) => {
    const cur = i === hist.length - 1, isB = h.sc === bestNow && h.sc > 0;
    const pct = Math.max(14, Math.round(h.sc / maxH * 100));
    return `<i class="${cur ? 'cur' : (isB ? 'best' : '')}" style="height:${pct}%" title="Run #${i + 1}: ${h.sc.toLocaleString()} (${h.acc}%)"></i>`;
  }).join('');

  $('results').innerHTML = `
    <div class="rhead">
      <div class="rtitle">
        <h2>${modeTitle} <span>${cfg.diff} · ${cfg.dur}s · ${cfg.gun}</span></h2>
        <div class="rbadges">
          ${nb ? '<span class="badge pb">★ NEW PERSONAL BEST</span>' : `<span class="badge">BEST ${bestNow.toLocaleString()}</span>`}
          ${lastRun ? `<span class="badge ${dSc >= 0 ? 'up' : 'dn'}">${dSc >= 0 ? '+' : ''}${dSc.toLocaleString()} vs prev</span>` : '<span class="badge">FIRST RUN</span>'}
          ${lastRun ? `<span class="badge ${dAcc >= 0 ? 'up' : 'dn'}">${dAcc >= 0 ? '+' : ''}${dAcc.toFixed(1)}% acc</span>` : ''}
        </div>
      </div>
      <div class="grade g${g}">${g}</div>
    </div>
    <div class="accrow"><span>${hold ? 'ON-TARGET LOCK' : 'TOTAL ACCURACY'}</span><b>${acc.toFixed(1)}%</b></div>
    <div class="acc big"><i id="rBar" style="background:hsl(${acc * 1.2},90%,55%)"></i></div>
    <div class="stats">
      <div><b>${sc.toLocaleString()}</b>score<i>${Math.round(sc / cfg.dur * 60).toLocaleString()}/min pace</i></div>
      <div><b>${hold ? S.onT.toFixed(1) + 's' : S.hits + '/' + S.shots}</b>${hold ? 'time on target' : 'hits / shots'}<i>${hold ? (S.tt ? (S.onT / S.tt * 100).toFixed(0) + '% uptime' : '—') : bullPct + '% bullseye (' + S.bulls + ')'}</i></div>
      <div><b>${isHoldMode() ? S.bestLock.toFixed(1) + 's' : S.best}</b>${isHoldMode() ? 'best lock' : 'best streak'}<i>x${mult().toFixed(1)} end mult</i></div>
      <div><b>${hold ? '—' : avg + 'ms'}</b>${cfg.mode === 'flick' ? 'avg reaction' : 'avg cadence'}<i>${hold ? 'continuous' : (fastest ? 'best ' + fastest + 'ms' : '—')}</i></div>
    </div>
    <div class="chartWrap"><canvas id="rChart" width="600" height="148"></canvas></div>
    <div class="histRow"><span>LAST ${hist.length} RUNS</span><div class="hbars">${barsHtml}</div></div>
    <div class="rbtns">
      <button class="cta" id="retry">RETRY (R)</button>
      <button class="ghost" id="shareBtn">SHARE PNG</button>
      <button class="ghost" id="toMenu">MENU</button>
    </div>`;
  $('retry').onclick = lock; $('toMenu').onclick = toMenu;
  $('shareBtn').onclick = () => exportResultPng(modeTitle, g, sc, acc, avg, bullPct, bestNow);
  showCard('results');
  setTimeout(() => { const b = $('rBar'); if (b) b.style.width = acc + '%'; }, 60);
  drawResultsChart(hold);
}

function drawResultsChart(hold) {
  const c = $('rChart'); if (!c) return;
  const g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const gw = 395, padL = 34, padR = 12, padT = 22, padB = 22, pw = gw - padL - padR, ph = H - padT - padB;

  g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = '700 9px Orbitron, sans-serif';
  g.fillText('ACCURACY & PACE OVER TIME', padL, 14);
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
  [0, .5, 1].forEach(f => {
    const y = padT + ph * (1 - f);
    g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + pw, y); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.38)'; g.font = '600 9px Inter, sans-serif';
    g.fillText(Math.round(f * 100) + '%', 4, y + 3);
  });

  const log = S.log.length ? S.log : [{ t: 1, acc: accOf(0), sc: 0 }];
  let maxDelta = 100;
  const deltas = log.map((p, i) => { const d = i === 0 ? p.sc : Math.max(0, p.sc - log[i - 1].sc); if (d > maxDelta) maxDelta = d; return d; });
  const bw = Math.max(2, pw / Math.max(log.length, 1) - 2);
  deltas.forEach((d, i) => {
    const x = padL + (i / Math.max(1, log.length - 1)) * (pw - bw), bh = (d / maxDelta) * (ph * .82);
    g.fillStyle = 'rgba(255,43,214,0.25)'; g.fillRect(x, padT + ph - bh, bw, bh);
  });

  g.beginPath();
  log.forEach((p, i) => {
    const x = padL + (i / Math.max(1, log.length - 1)) * pw, y = padT + ph * (1 - Math.max(0, Math.min(100, p.acc)) / 100);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  });
  g.strokeStyle = '#22f0ff'; g.lineWidth = 2.2; g.stroke();
  const gr = g.createLinearGradient(0, padT, 0, padT + ph);
  gr.addColorStop(0, 'rgba(34,240,255,0.28)'); gr.addColorStop(1, 'rgba(34,240,255,0.0)');
  g.lineTo(padL + pw, padT + ph); g.lineTo(padL, padT + ph); g.closePath(); g.fillStyle = gr; g.fill();

  g.fillStyle = 'rgba(255,255,255,0.38)'; g.fillText('0s', padL, H - 5); g.fillText(cfg.dur + 's', padL + pw - 20, H - 5);
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(gw + 6, 10); g.lineTo(gw + 6, H - 10); g.stroke();

  const cx = gw + (W - gw) / 2 + 2, cy = H / 2 + 6, cr = 46;
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = '700 9px Orbitron, sans-serif';
  g.textAlign = 'center';
  g.fillText(hold ? 'LOCK CONSISTENCY' : 'SHOT PLACEMENT', cx, 14);
  [1, .68, .38].forEach((r, i) => {
    g.beginPath(); g.arc(cx, cy, cr * r, 0, Math.PI * 2);
    g.strokeStyle = i === 2 ? 'rgba(255,225,74,0.55)' : 'rgba(34,240,255,0.22)';
    g.lineWidth = i === 2 ? 1.4 : 1; g.stroke();
  });
  g.beginPath(); g.moveTo(cx - cr, cy); g.lineTo(cx + cr, cy); g.moveTo(cx, cy - cr); g.lineTo(cx, cy + cr);
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.stroke();

  if (hold) {
    const pct = Math.min(1, accOf(0) / 100);
    g.beginPath(); g.arc(cx, cy, cr * .82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    g.strokeStyle = '#39ff6a'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#fff'; g.font = '800 13px Orbitron, sans-serif'; g.fillText(accOf(0).toFixed(0) + '%', cx, cy + 5);
  } else {
    for (let i = 0; i < S.shots2d.length; i++) {
      const [nx, ny, bull] = S.shots2d[i];
      g.beginPath(); g.arc(cx + nx * cr, cy - ny * cr, 2.6, 0, Math.PI * 2);
      g.fillStyle = bull ? '#ffe14a' : '#22f0ff'; g.fill();
    }
  }
  g.textAlign = 'left';
}

function exportResultPng(modeTitle, grade, sc, acc, avg, bullPct, bestNow) {
  const c = document.createElement('canvas'); c.width = 720; c.height = 400;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 720, 400);
  bg.addColorStop(0, '#0a081c'); bg.addColorStop(1, '#190d3a');
  g.fillStyle = bg; g.fillRect(0, 0, 720, 400);
  g.strokeStyle = 'rgba(34,240,255,0.35)'; g.lineWidth = 3; g.strokeRect(14, 14, 692, 372);
  g.fillStyle = '#22f0ff'; g.font = '900 28px Orbitron, sans-serif'; g.fillText('NEON AIM 3D', 38, 58);
  g.fillStyle = '#ffffff'; g.font = '800 20px Orbitron, sans-serif'; g.fillText(`${modeTitle} · ${cfg.diff.toUpperCase()} · ${cfg.dur}S · ${cfg.gun.toUpperCase()}`, 38, 92);
  g.fillStyle = '#ffe14a'; g.font = '900 74px Orbitron, sans-serif'; g.fillText(grade, 605, 96);
  const items = [
    ['SCORE', sc.toLocaleString()], ['ACCURACY', acc.toFixed(1) + '%'],
    ['PERSONAL BEST', bestNow.toLocaleString()], ['BULLSEYE / AVG', `${bullPct}% · ${avg}ms`]
  ];
  items.forEach(([k, v], i) => {
    const x = 38 + (i % 2) * 325, y = 148 + Math.floor(i / 2) * 78;
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = '700 12px Orbitron, sans-serif'; g.fillText(k, x, y);
    g.fillStyle = '#ffffff'; g.font = '900 28px Orbitron, sans-serif'; g.fillText(v, x, y + 32);
  });
  const rc = $('rChart'); if (rc) g.drawImage(rc, 38, 272, 644, 102);
  const a = document.createElement('a'); a.download = `neon-aim-${cfg.mode}-${sc}.png`; a.href = c.toDataURL('image/png'); a.click();
  banner('PNG SAVED');
}

function toMenu() { state = 'menu'; showCard('menu'); renderModes(); }
function pause() { state = 'pause'; firing = false; stopCount(); showCard('pause'); }

document.addEventListener('pointerlockchange', () => {
  clearTimeout(lockT); rawTry = false;
  if (document.pointerLockElement === cv) {
    if (state === 'starting') { yaw = pitch = 0; recP = 0; recY = 0; cam.rotation.set(0, 0, 0); showCard(null); S = newStats(); state = 'count'; countdown(); }
    else if (state === 'pause') { showCard(null); if (S.on) state = 'play'; else { state = 'count'; countdown(); } }
    else if (state === 'menu' || state === 'results') document.exitPointerLock();
  } else if (state === 'play' || state === 'count') pause();
});
document.addEventListener('pointerlockerror', () => {
  if (rawTry) { rawTry = false; try { cv.requestPointerLock(); } catch (e) { lockFail(); } }
  else lockFail();
});

/* ---------- INPUT & IN-GAME HOTKEYS ---------- */
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== cv) return;
  const k = cfg.sens * .07 * D2R; // 0.07 deg/count * sens; zero smoothing
  yaw -= e.movementX * k; pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * k));
  cam.rotation.set(Math.max(-1.5, Math.min(1.5, pitch + recP)), yaw + recY, 0);
});
document.addEventListener('mousedown', e => {
  if (document.pointerLockElement !== cv || e.button !== 0 || state !== 'play') return;
  if (isHoldMode()) { firing = true; playGunSound(); triggerGunRecoil(false); } else shoot();
});
document.addEventListener('mouseup', () => { firing = false; });
document.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { if (state === 'play' || state === 'count') pause(); });
addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.type === 'number' || e.target.type === 'color') return;
  if (e.code === 'KeyM' && !e.repeat) { muted = !muted; banner(muted ? 'MUTED' : 'SOUND ON'); }
  if (e.repeat) return;
  if ((e.code === 'Space' || e.code === 'Enter') && state === 'menu' && $('settings').classList.contains('hide')) { e.preventDefault(); lock(); }
  if (e.code === 'KeyR') { if (state === 'play' || state === 'count') restart(); else if (state === 'results') lock(); }
  // Live weapon swap (1-4), Handedness flip (H), Scenery cycle (B)
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
    const g = GUNS[+e.code.slice(-1) - 1];
    if (g) { save('gun', g); applyGun(); syncSeg('gun', GUNS, g); banner(g.toUpperCase()); playGunSound(); }
  }
  if (e.code === 'KeyH') {
    const next = HANDS[(HANDS.indexOf(cfg.hand) + 1) % HANDS.length];
    save('hand', next); applyGun(); syncSeg('hand', HANDS, next); banner(next === 'Off' ? 'VIEWMODEL OFF' : next.toUpperCase() + ' HAND');
  }
  if (e.code === 'KeyB') {
    const next = THEMES[(THEMES.indexOf(cfg.theme) + 1) % THEMES.length];
    save('theme', next); applyTheme(); syncSeg('theme', THEMES, next); banner(next.toUpperCase() + ' SCENERY');
  }
});

/* ---------- MENU & SETTINGS UI ---------- */
function seg(el, items, get, set, fmt = x => x) {
  el.innerHTML = '';
  return items.map(v => {
    const b = document.createElement('button'); b.textContent = fmt(v); b.className = get() === v ? 'on' : '';
    b.onclick = () => { set(v); [...el.children].forEach(c => c.classList.toggle('on', c === b)); };
    el.append(b); return b;
  });
}
function syncSeg(id, items, val) {
  const el = $(id); if (!el) return;
  [...el.children].forEach((b, i) => b.classList.toggle('on', items[i] === val));
}
function renderModes() {
  $('modes').innerHTML = MODES.map(m => `<button class="mode ${m.id === cfg.mode ? 'on' : ''}" data-id="${m.id}">
    <div><b>${m.name.toUpperCase()}</b><span>${m.desc}</span></div><em>BEST ${store.get(bestKey(m.id), 0).toLocaleString()}</em></button>`).join('');
  document.querySelectorAll('.mode').forEach(b => b.onclick = () => { save('mode', b.dataset.id); renderModes(); });
}
function applyCross() {
  const s = document.documentElement.style;
  s.setProperty('--ch', cfg.col); s.setProperty('--len', cfg.xlen + 'px'); s.setProperty('--gap', cfg.xgap + 'px'); s.setProperty('--th', cfg.xth + 'px');
  s.setProperty('--op', cfg.xop); s.setProperty('--olw', cfg.xol ? '1px' : '0px'); s.setProperty('--dot', cfg.xdot ? 'block' : 'none');
}
function applyPrefs() {
  document.body.classList.toggle('redm', !!cfg.redm);
  $('fps').classList.toggle('hide', !cfg.fpsOn);
}

seg($('diff'), Object.keys(DIFFS), () => cfg.diff, v => { save('diff', v); renderModes(); });
seg($('dur'), DURS, () => cfg.dur, v => { save('dur', v); renderModes(); }, v => v + 's');
seg($('col'), COLS, () => cfg.col, v => { save('col', v); applyCross(); $('xcol').value = v; }, () => '').forEach((b, i) => b.style.background = COLS[i]);
seg($('tmode'), TMODES, () => cfg.tmode, v => { save('tmode', v); recolorAllTargets(); });
seg($('theme'), THEMES, () => cfg.theme, v => { save('theme', v); applyTheme(); });
seg($('gun'), GUNS, () => cfg.gun, v => { save('gun', v); applyGun(); playGunSound(); });
seg($('hand'), HANDS, () => cfg.hand, v => { save('hand', v); applyGun(); });
seg($('recoil'), RECOILS, () => cfg.recoil, v => { save('recoil', v); });
seg($('sfx'), SFXS, () => cfg.sfx, v => { save('sfx', v); playHitSound(4, false, 1); });

$('sens').value = cfg.sens; $('sensV').textContent = sensTxt(); $('sensV').title = `at ${cfg.dpi} DPI, 0.07°/count`;
$('sens').oninput = e => { save('sens', +e.target.value); $('sensV').textContent = sensTxt(); };
$('fov').value = cfg.fov; $('fovV').textContent = cfg.fov + '° H';
$('fov').oninput = e => { save('fov', +e.target.value); $('fovV').textContent = cfg.fov + '° H'; applyFov(); };
$('play').onclick = lock;
$('resume').onclick = () => { if (state === 'pause') reqLock(); };
$('quit').onclick = () => { abortRun(); toMenu(); };

let setFrom = 'menu';
const GAMES = { Valorant: .07, CS2: .022, 'Apex Legends': .022, 'Overwatch 2': .0066, 'Fortnite (%)': .005555 };
const bind = (id, fmt = v => v) => {
  const el = $(id), out = $(id + 'V'); el.value = cfg[id]; if (out) out.textContent = fmt(cfg[id]);
  el.oninput = () => { save(id, +el.value); if (out) out.textContent = fmt(cfg[id]); applyCross(); };
};
bind('xlen'); bind('xgap'); bind('xth'); bind('xop', v => Math.round(v * 100) + '%'); bind('vol', v => Math.round(v * 100) + '%');

['xol', 'xdot', 'tedge', 'tglow', 'trc', 'punch', 'redm', 'fpsOn'].forEach(id => {
  const b = $(id); b.classList.toggle('on', !!cfg[id]);
  b.onclick = () => { save(id, !cfg[id]); b.classList.toggle('on', !!cfg[id]); applyCross(); applyPrefs(); recolorAllTargets(); };
});

$('xcol').value = cfg.col;
$('xcol').oninput = e => { save('col', e.target.value); applyCross(); [...$('col').children].forEach((b, i) => b.classList.toggle('on', COLS[i] === cfg.col)); };
$('tcol').value = cfg.tcol;
$('tcol').oninput = e => { save('tcol', e.target.value); save('tmode', 'Solid'); syncSeg('tmode', TMODES, 'Solid'); recolorAllTargets(); };
$('tecol').value = cfg.tecol;
$('tecol').oninput = e => { save('tecol', e.target.value); save('tedge', true); $('tedge').classList.add('on'); recolorAllTargets(); };
$('bgcol').value = cfg.bgcol;
$('bgcol').oninput = e => { save('bgcol', e.target.value); save('theme', 'Solid'); syncSeg('theme', THEMES, 'Solid'); applyTheme(); };

const refreshSens = () => { $('sens').value = cfg.sens; $('sensV').textContent = sensTxt(); $('sensV').title = `at ${cfg.dpi} DPI, 0.07°/count`; };
$('dpi').value = cfg.dpi;
$('dpi').onchange = e => { save('dpi', Math.max(100, Math.min(32000, Math.round(+e.target.value) || 800))); $('dpi').value = cfg.dpi; refreshSens(); };
$('cgame').innerHTML = Object.keys(GAMES).map(g => `<option>${g}</option>`).join('');
$('capply').onclick = () => {
  const v = +$('cval').value; if (!(v > 0)) { $('cres').textContent = 'Enter your in-game sensitivity first.'; return; }
  const ours = GAMES[$('cgame').value] * v / .07, c = Math.max(.1, Math.min(2, ours));
  save('sens', +c.toFixed(3)); refreshSens();
  $('cres').textContent = `→ ${cfg.sens} (≈${cm360().toFixed(0)} cm/360)` + (c !== ours ? ' · clamped to slider range' : '');
};
const openSet = () => { setFrom = state === 'pause' ? 'pause' : 'menu'; showCard('settings'); };
$('setBtn').onclick = openSet; $('pset').onclick = openSet; $('sback').onclick = () => showCard(setFrom);
applyTheme(); applyGun(); applyCross(); applyPrefs(); renderModes();

/* ---------- MAIN LOOP ---------- */
let last = performance.now(), fpsS = 144, fpsTick = 0;
(function frame(now) {
  const rawDt = Math.max(.0001, (now - last) / 1000), dt = Math.min(.05, rawDt); last = now; E += dt;
  fpsS = fpsS * .92 + (1 / rawDt) * .08;
  if (cfg.fpsOn && (fpsTick -= dt) <= 0) { fpsTick = .2; setT('fps', Math.round(fpsS) + ' FPS'); }
  if (fovKick > 0) { fovKick = Math.max(0, fovKick - dt * 14); applyFov(); }

  // Smooth recovery for recoil & 3D viewmodel animation
  if (!firing && (recP > 0 || Math.abs(recY) > 0)) {
    const dec = Math.exp(-dt * 8.5);
    recP *= dec; recY *= dec;
    if (recP < .0003) recP = 0;
    if (Math.abs(recY) < .0003) recY = 0;
    if (state === 'play') cam.rotation.set(Math.max(-1.5, Math.min(1.5, pitch + recP)), yaw + recY, 0);
  }
  if (cfg.recoil === 'Pattern' && state === 'play') {
    $('cross').style.setProperty('--rx', (-recY * 320).toFixed(1) + 'px');
    $('cross').style.setProperty('--ry', (-recP * 320).toFixed(1) + 'px');
  }

  vmKickZ *= Math.exp(-dt * 18); vmKickP *= Math.exp(-dt * 16); vmEquip *= Math.exp(-dt * 14);
  if (muzT > 0) { muzT -= dt; if (muzT <= 0) muzFlash.material.opacity = 0; }
  if (vmRoot.visible) {
    const side = cfg.hand === 'Left' ? -1 : 1;
    const swayX = cfg.redm ? 0 : Math.sin(now / 650) * .004;
    const swayY = cfg.redm ? 0 : Math.cos(now / 450) * .004;
    vmRoot.position.set(.25 * side + swayX, -.21 + swayY - vmEquip * .25, vmKickZ);
    vmRoot.rotation.set(vmKickP - vmEquip * .6, 0, 0);
  }

  if (state === 'play') { T += dt; update(dt); }
  if ((state === 'menu' || state === 'results' || state === 'starting') && !cfg.redm) cam.rotation.set(.04, Math.sin(now / 4000) * .35, 0);
  if (deco.visible && !cfg.redm) for (let i = 0; i < deco.children.length; i++) { const m = deco.children[i]; m.position.y = m.userData.y + Math.sin(now / 900 + m.userData.p) * .5; }

  for (let i = shards.length - 1; i >= 0; i--) {
    const m = shards[i], u = m.userData, a = E - u.born;
    u.v.y -= 14 * dt; m.position.addScaledVector(u.v, dt); m.scale.setScalar(Math.max(0, 1 - a / .55));
    if (a > .55) { scene.remove(m); shards.splice(i, 1); spool.push(m); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const m = rings[i], a = E - m.userData.born, k = a / .28;
    m.scale.setScalar(m.userData.r0 * (1 + k * 1.6)); m.material.opacity = Math.max(0, .92 * (1 - k));
    if (k >= 1) { scene.remove(m); rings.splice(i, 1); rpool.push(m); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const m = tracers[i], a = E - m.userData.born, k = a / .12;
    m.material.opacity = Math.max(0, .65 * (1 - k));
    if (k >= 1) { scene.remove(m); tracers.splice(i, 1); trpool.push(m); }
  }
  for (let i = decals.length - 1; i >= 0; i--) {
    const m = decals[i], a = E - m.userData.born;
    m.scale.setScalar(Math.max(.001, 1 - a / 2.5));
    if (a > 2.5) { scene.remove(m); decals.splice(i, 1); dpool.push(m); }
  }
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
})(last);