// SUSBI · teste do modelo feito no Blender (revisão 21) no navegador — página v22.
// Abre direto no close do ombro para cima. Ela pisca sozinha em intervalos aleatórios, mexe a cabeça,
// os olhos e o corpo de leve, e às vezes decide andar: a câmera abre para meio corpo ou corpo inteiro,
// ela caminha até outro ponto, vira para a câmera e o close volta. O microfone fica sempre escutando,
// com um botão para deixar mudo.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c'), stage = $('stage');
const say = (t) => { $('say').textContent = t; };
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (dt, r) => 1 - Math.exp(-dt * r);
const DEG = Math.PI / 180;

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02060d);
scene.fog = new THREE.FogExp2(0x02060d, 0.07);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.12;

const camera = new THREE.PerspectiveCamera(39.6, 9 / 16, 0.05, 60);
scene.add(new THREE.HemisphereLight(0x5b86ad, 0x05080c, 0.45));
const key = new THREE.DirectionalLight(0xbfe6ff, 1.25); key.position.set(-1.5, 2.5, 2.5); scene.add(key);
const fill = new THREE.DirectionalLight(0x6fb8ff, 0.45); fill.position.set(1.8, 1.2, 2.0); scene.add(fill);
for (const x of [-1.6, 1.6]) { const r = new THREE.PointLight(0x4aa8ff, 5, 0, 2); r.position.set(x, 1.55, -1.4); scene.add(r); }
const top = new THREE.PointLight(0x8fd0ff, 3, 0, 2); top.position.set(0, 3, -0.3); scene.add(top);

// chão escuro com dois anéis de luz
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0x03080f, roughness: 0.55, metalness: 0.25 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const groundParts = [floor];
for (const r of [0.9, 1.35]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 160), new THREE.MeshBasicMaterial({ color: 0x6fd2ff }));
  ring.rotation.x = -Math.PI / 2; ring.userData.dy = 0.003; scene.add(ring); groundParts.push(ring);
}
// partículas discretas ao fundo
{
  const n = 260, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = 2.5 + Math.random() * 3.5; p[i * 3] = Math.cos(a) * d; p[i * 3 + 1] = Math.random() * 3; p[i * 3 + 2] = -Math.abs(Math.sin(a) * d) - 0.5; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x5ab8ff, size: 0.02, transparent: true, opacity: 0.7 })));
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.4, 0.7);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();

// ---------- modelo ----------
const Y = new THREE.Vector3(0, 1, 0);
let model = null, root = null, mixer = null, walk = null, head = null, morph = {}, bones = {};
const R0 = new THREE.Quaternion();
const hipOff = new THREE.Vector3();
let yaw0 = 0, headY = 1.45, stride = 0.8, floorY = 0;
const footRest = {};
const FEET = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
// estado do corpo: posição no chão, direção (0 = de frente para a câmera), peso da caminhada
const S = { x: 0, z: 0, y: 0, heading: 0, w: 0, wT: 0, mode: 'idle', t: 0, next: rand(15, 35), goal: null, frame: 'close', hold: 0 };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _ax = new THREE.Vector3();
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
function placeRoot() {
  root.position.set(S.x, S.y, S.z);
  root.quaternion.setFromAxisAngle(Y, S.heading - yaw0).multiply(R0);
}

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
loader.load('susbi.glb?v=21', (gltf) => {
  model = gltf.scene; scene.add(model);
  root = model.getObjectByName('SUSBI18_esqueleto') || model.children[0];
  R0.copy(root.quaternion);
  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      const m = o.material;
      if (m && m.name === 'SUSBI pele') { m.emissiveIntensity = 3.6; m.roughness = 0.6; m.envMapIntensity = 0.4; }
      if (m && m.name === 'SUSBI corpo') {
        // traje mais claro e com reflexo, como a SUSBI original (antes estava quase preto: textura escura e 100% metal)
        m.color.setScalar(1.45); m.metalness = 0.6; m.roughness = 1.0; m.envMap = envTex; m.envMapIntensity = 0.5; m.emissiveIntensity = 2.8;
      }
      if (m && m.name === 'SUSBI rede') m.emissiveIntensity = 1.6;
      if (m && m.name === 'SUSBI iris') m.emissiveIntensity = 0.9;
      if (m && m.name === 'SUSBI olho') m.envMapIntensity = 0.3;
      if (o.morphTargetDictionary && o.morphTargetDictionary['Piscar'] !== undefined) { head = o; morph = o.morphTargetDictionary; }
    }
    if (o.isBone) bones[o.name.replace('mixamorig', '')] = o;
  });

  mixer = new THREE.AnimationMixer(model);
  const wc = gltf.animations.find((c) => /caminhar/i.test(c.name));
  walk = mixer.clipAction(wc); walk.play(); walk.setEffectiveWeight(0);

  // para onde o corpo olha no repouso (do calcanhar para a ponta do pé)
  root.position.set(0, 0, 0); root.quaternion.copy(R0); mixer.update(0); model.updateMatrixWorld(true);
  const f = new THREE.Vector3();
  for (const s of ['Left', 'Right']) if (bones[s + 'Foot'] && bones[s + 'ToeBase']) f.add(wp(bones[s + 'ToeBase']).sub(wp(bones[s + 'Foot'])));
  yaw0 = Math.atan2(f.x, f.z);
  placeRoot(); mixer.update(0); model.updateMatrixWorld(true);
  for (const n of FEET) if (bones[n]) footRest[n] = wp(bones[n]).y;
  headY = bones.Head ? wp(bones.Head).y : 1.45;

  // chão na altura da sola do corpo
  let sole = Infinity;
  model.traverse((o) => {
    if (!o.isMesh || !o.material || o.material.name !== 'SUSBI corpo') return;
    let b; if (o.isSkinnedMesh) { o.computeBoundingBox(); b = o.boundingBox.clone(); } else { o.geometry.computeBoundingBox(); b = o.geometry.boundingBox.clone(); }
    sole = Math.min(sole, b.applyMatrix4(o.matrixWorld).min.y);
  });
  if (isFinite(sole)) floorY = sole;
  for (const g of groundParts) g.position.y = floorY + (g.userData.dy || 0);

  stride = measureStride(wc);
  setFrame('close', true);
  $('loading').style.display = 'none';
  updateStatus();
  startMic();
}, (e) => {
  if (e.total) $('bar').firstElementChild.style.width = Math.round((e.loaded / e.total) * 100) + '%';
}, (err) => {
  $('loadMsg').textContent = 'Não foi possível carregar o modelo: ' + (err && err.message ? err.message : err);
  $('status').textContent = 'Erro';
});

// velocidade da caminhada: quanto o pé apoiado escorrega para trás na animação "no lugar".
// Andando nessa mesma velocidade, o pé fica parado no chão (sem patinar nem flutuar).
function measureStride(clip) {
  const N = 96, dt = clip.duration / N, tr = {};
  walk.setEffectiveWeight(1);
  for (let i = 0; i < N; i++) {
    walk.time = i * dt; mixer.update(0); model.updateMatrixWorld(true);
    for (const n of ['LeftToeBase', 'RightToeBase']) { if (!bones[n]) continue; (tr[n] = tr[n] || []).push(wp(bones[n])); }
  }
  const sp = [];
  for (const n in tr) {
    const z = tr[n].map((p) => p.z); let i = z.indexOf(Math.max(...z)), k = 0, j = i;
    while (k < N && z[(j + 1) % N] <= z[j % N] + 1e-4) { j++; k++; }
    if (k > 1) sp.push((z[i] - z[j % N]) / (k * dt));
  }
  walk.setEffectiveWeight(0); walk.time = 0; mixer.update(0);
  const v = sp.length ? sp.reduce((a, b) => a + b, 0) / sp.length : 1.0;
  return clamp(v, 0.3, 1.6);
}

// ---------- câmera: close do ombro para cima; meio corpo ou corpo inteiro quando ela anda ----------
const FR = {
  close: { ty: -0.02, tz: 0.06, py: 0.0, d: 0.75 },
  meio: { ty: -0.33, tz: 0.0, py: -0.22, d: 1.75 },
  inteiro: { ty: -0.62, tz: 0.0, py: -0.45, d: 3.6 },
};
const cam = { pos: new THREE.Vector3(0, 1.44, 0.92), tgt: new THREE.Vector3(0, 1.4, 0.06), wantPos: new THREE.Vector3(), wantTgt: new THREE.Vector3(), rate: 1.4 };
function setFrame(name, instant) {
  S.frame = name;
  if (instant) { frameTargets(); cam.pos.copy(cam.wantPos); cam.tgt.copy(cam.wantTgt); }
}
function frameTargets() {
  const f = FR[S.frame], h = headY - floorY;
  const k = S.frame === 'close' ? 1 : h / 1.45;   // abre o enquadramento proporcional à altura
  let ax = S.x + hipOff.x, az = S.z + hipOff.z;
  if (bones.Hips) { bones.Hips.getWorldPosition(_v2); ax = _v2.x; az = _v2.z; }
  cam.wantTgt.set(ax, headY + f.ty * k, az + f.tz);
  cam.wantPos.set(ax, headY + f.py * k, az + f.tz + f.d * k);
}
function cameraUpdate(dt) {
  frameTargets();
  const r = damp(dt, cam.rate);
  cam.pos.lerp(cam.wantPos, r); cam.tgt.lerp(cam.wantTgt, r);
  camera.position.copy(cam.pos); camera.lookAt(cam.tgt);
}

const WALK_SPEED = 0.85;   // um pouco mais calma que a animação original
// ---------- comportamento: parada com movimentos sutis, e às vezes ela decide andar ----------
function startWalk() {
  if (S.mode !== 'idle' || !walk) return;
  const r = Math.hypot(S.x, S.z);
  let gx, gz, tries = 0;
  do {
    if (r > 0.5 && Math.random() < 0.6) { gx = rand(-0.25, 0.25); gz = rand(-0.25, 0.15); }   // volta para perto do centro
    else { gx = rand(-0.95, 0.95); gz = rand(-0.7, 0.3); }
  } while (Math.hypot(gx - S.x, gz - S.z) < 0.6 && ++tries < 20);
  S.goal = { x: gx, z: gz };
  const dist = Math.hypot(gx - S.x, gz - S.z);
  setFrame(dist > 0.9 || Math.random() < 0.5 ? 'inteiro' : 'meio');
  S.mode = 'prep'; S.t = 0;
  G.tYaw = clamp(wrap(Math.atan2(gx - S.x, gz - S.z) - S.heading) / DEG, -25, 25); G.next = 2; // olha para onde vai
  updateStatus();
}
function behavior(dt) {
  S.t += dt;
  const busy = speaking || (performance.now() - heardAt < 4000);
  if (S.mode === 'idle') {
    S.next -= dt;
    if (S.next <= 0) { S.next = rand(15, 40); if (!busy && Math.random() < 0.45) startWalk(); }
  } else if (S.mode === 'prep') {             // a câmera abre primeiro
    if (S.t > 1.1) { S.mode = 'turn'; S.t = 0; walk.time = 0; S.wT = 0.6; }
  } else if (S.mode === 'turn') {             // vira no lugar para o destino
    const dh = wrap(Math.atan2(S.goal.x - S.x, S.goal.z - S.z) - S.heading);
    S.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
    if (Math.abs(dh) < 0.2 || S.t > 3) { S.mode = 'walk'; S.t = 0; S.wT = 1; }
  } else if (S.mode === 'walk') {
    const dx = S.goal.x - S.x, dz = S.goal.z - S.z, d = Math.hypot(dx, dz);
    const dh = wrap(Math.atan2(dx, dz) - S.heading);
    S.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    const v = stride * WALK_SPEED * S.w * Math.max(0.15, Math.cos(Math.min(Math.abs(dh), 1.4)));
    S.x += Math.sin(S.heading) * v * dt; S.z += Math.cos(S.heading) * v * dt;
    if (d < 0.08 || S.t > 12) { S.mode = 'face'; S.t = 0; S.wT = 0.55; }
  } else if (S.mode === 'face') {              // vira de frente para a câmera
    const dh = wrap(0 - S.heading);
    S.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
    if (Math.abs(dh) < 0.04 || S.t > 4) { S.mode = 'settle'; S.t = 0; S.wT = 0; }
  } else if (S.mode === 'settle') {            // para, fica um instante no plano aberto e o close volta
    if (S.w < 0.02 && S.t > rand(1.5, 2.5)) { S.mode = 'idle'; S.next = rand(15, 45); setFrame('close'); updateStatus(); }
  }
  S.w += (S.wT - S.w) * damp(dt, 4);
  if (S.w < 0.002 && S.wT === 0) S.w = 0;
  walk.setEffectiveWeight(S.w);
  walk.timeScale = S.w > 0.01 ? (S.mode === 'walk' ? WALK_SPEED : 0.75) : 0;
  if (S.w === 0) S.y += (0 - S.y) * damp(dt, 6);
}
// mantém o pé que está apoiado no chão (a animação "no lugar" levanta um pouco o corpo)
function grounding(dt) {
  if (S.w <= 0.01) return;
  let c = Infinity;
  for (const n of FEET) if (bones[n] && footRest[n] !== undefined) c = Math.min(c, bones[n].getWorldPosition(_v).y - footRest[n]);
  if (isFinite(c)) S.y -= c * damp(dt, 12);
}

// ---------- olhar, cabeça e corpo (aleatório e sutil) ----------
const G = { tYaw: 0, tPitch: 0, yaw: 0, pitch: 0, eyeYaw: 0, eyePitch: 0, next: rand(2, 5), sacc: 0, saccP: 0, nextSacc: 0.6 };
const seeds = Array.from({ length: 12 }, () => Math.random() * 100);
const nz = (t, i, f = 1) => { const s = seeds[i]; return 0.55 * Math.sin(t * 0.21 * f + s) + 0.3 * Math.sin(t * 0.53 * f + s * 1.7) + 0.15 * Math.sin(t * 1.13 * f + s * 2.9); };
function rotWorld(bone, axis, deg) {
  if (!bone || !deg) return;
  bone.parent.getWorldQuaternion(_pq); _ax.copy(axis).applyQuaternion(_pq.invert());
  bone.quaternion.premultiply(_q.setFromAxisAngle(_ax, deg * DEG));
}
const AXY = new THREE.Vector3(0, 1, 0), AXX = new THREE.Vector3(), AXZ = new THREE.Vector3();
let expr = {}, manualJaw = 0;
const EXPR = {
  neutra: {}, alegria: { E: 0.35, I: 0.35, nod: -3 }, surpresa: { jaw: 6, O: 0.55, nod: -2 },
  tristeza: { U: 0.25, M: 0.25, nod: 7 }, atencao: { roll: 6, I: 0.15 },
};
function bodyUpdate(dt, t) {
  // eixos do corpo (lado e frente) conforme a direção em que ela está virada
  AXX.set(Math.cos(S.heading), 0, -Math.sin(S.heading)); AXZ.set(Math.sin(S.heading), 0, Math.cos(S.heading));
  const still = 1 - S.w;
  // de vez em quando olha para outro lugar e volta para você
  G.next -= dt;
  if (performance.now() - heardAt < 3000) { G.tYaw = 0; G.tPitch = 0; }
  else if (G.next <= 0 && S.mode === 'idle') {
    if (Math.random() < 0.55) { G.tYaw = 0; G.tPitch = 0; G.next = rand(2.5, 7); }
    else { G.tYaw = rand(-18, 18); G.tPitch = rand(-7, 4); G.next = rand(1.2, 3.5); if (Math.random() < 0.3) blinkNow(); }
  }
  if (S.mode === 'walk' || S.mode === 'face' || S.mode === 'turn') { G.tYaw = 0; G.tPitch = 2; }
  G.yaw += (G.tYaw * 0.75 - G.yaw) * damp(dt, 3); G.pitch += (G.tPitch * 0.6 - G.pitch) * damp(dt, 3);
  // micro-movimentos dos olhos
  G.nextSacc -= dt; if (G.nextSacc <= 0) { G.sacc = rand(-2.5, 2.5); G.saccP = rand(-1.5, 1.5); G.nextSacc = rand(0.4, 2.2); }
  G.eyeYaw += (clamp(G.tYaw - G.yaw, -14, 14) + G.sacc - G.eyeYaw) * damp(dt, 22);
  G.eyePitch += (clamp(G.tPitch - G.pitch, -8, 8) + G.saccP - G.eyePitch) * damp(dt, 22);

  const talk = speaking ? 1 : 0;
  // tronco: respiração, balanço lateral e pequenas viradas (só parada)
  const br = Math.sin(t * 2 * Math.PI / 4.6);
  rotWorld(bones.Spine, AXZ, still * 1.1 * nz(t, 0, 0.8));
  rotWorld(bones.Spine, AXY, still * 1.6 * nz(t, 1, 0.7));
  rotWorld(bones.Spine1, AXX, still * (0.5 * br + 0.6 * nz(t, 2)));
  rotWorld(bones.Spine2, AXZ, still * 0.7 * nz(t, 3));
  rotWorld(bones.Spine2, AXX, still * 0.4 * br);
  for (const s of [['Left', 1], ['Right', -1]]) {
    rotWorld(bones[s[0] + 'Shoulder'], AXZ, still * s[1] * (0.6 * br));
    rotWorld(bones[s[0] + 'Arm'], AXZ, still * s[1] * (1.2 * nz(t, 4 + (s[1] > 0 ? 0 : 1), 0.9)));
    rotWorld(bones[s[0] + 'Arm'], AXX, still * 1.2 * nz(t, 6 + (s[1] > 0 ? 0 : 1), 0.8));
  }
  // cabeça: segue o olhar + balanço lento + pequenos acenos quando fala
  const yaw = G.yaw + 3.0 * nz(t, 8, 0.9);
  const pitch = G.pitch + 1.6 * nz(t, 9) + (expr.nod || 0) + talk * 1.4 * Math.sin(t * 3.3) * Math.sin(t * 0.9);
  const roll = 2.2 * nz(t, 10, 0.8) + (expr.roll || 0) + talk * 1.2 * Math.sin(t * 1.7);
  rotWorld(bones.Neck, AXY, yaw * 0.35); rotWorld(bones.Head, AXY, yaw * 0.65);
  rotWorld(bones.Neck, AXX, pitch * 0.3); rotWorld(bones.Head, AXX, pitch * 0.7);
  rotWorld(bones.Head, AXZ, roll);
  for (const e of ['LeftEye', 'RightEye']) { rotWorld(bones[e], AXY, G.eyeYaw); rotWorld(bones[e], AXX, G.eyePitch); }
}

// ---------- piscar automático ----------
// Pessoas em repouso piscam de ~8 a 21 vezes por minuto (uma vez a cada ~3 a 7,5 s), e mais ao conversar.
// Aqui: intervalo aleatório de 3 a 8 s parada, 2 a 5 s falando; às vezes pisca duas vezes seguidas.
let blinkT = -1, blinkDur = 0.26, nextBlink = rand(1.5, 4), doubleBlink = false;
function blinkNow() { if (blinkT < 0) { blinkT = 0; blinkDur = rand(0.2, 0.32); } }
function blinkUpdate(dt) {
  nextBlink -= dt;
  if (nextBlink <= 0 && blinkT < 0) {
    blinkNow();
    if (doubleBlink) { doubleBlink = false; nextBlink = speaking ? rand(2, 5) : rand(3, 8); }
    else if (Math.random() < 0.12) { doubleBlink = true; nextBlink = blinkDur + rand(0.12, 0.25); }
    else nextBlink = speaking ? rand(2, 5) : rand(3, 8);
  }
  let v = 0;
  if (blinkT >= 0) {
    blinkT += dt; const k = blinkT / blinkDur;   // fecha rápido, abre mais devagar
    v = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65; v = v * v * (3 - 2 * v);
    if (k >= 1) { blinkT = -1; v = 0; }
  }
  setMorph('Piscar', clamp(v, 0, 1));
}

// ---------- boca ----------
function setMorph(name, v) { if (head && morph[name] !== undefined) head.morphTargetInfluences[morph[name]] = v; }
const W = { O: 0, U: 0, E: 0, I: 0, M: 0, F: 0, jaw: 0 };
const T = { O: 0, U: 0, E: 0, I: 0, M: 0, F: 0, jaw: 0 };
function mouthUpdate(dt, t) {
  setMorph('Respirar', 0.3 + 0.3 * Math.sin(t * 2 * Math.PI / 4.6));
  const rate = damp(dt, 18);
  for (const k of Object.keys(W)) W[k] += ((T[k] || 0) - W[k]) * rate;
  setMorph('Fala O', Math.min(1, W.O + (expr.O || 0)));
  setMorph('Fala U', Math.min(1, W.U + (expr.U || 0)));
  setMorph('Fala E', Math.min(1, W.E + (expr.E || 0)));
  setMorph('Fala I', Math.min(1, W.I + (expr.I || 0)));
  setMorph('Fala M B P', Math.min(1, W.M + (expr.M || 0)));
  setMorph('Fala F V', Math.min(1, W.F));
  rotWorld(bones.Jaw, AXX, W.jaw + (expr.jaw || 0) + manualJaw);
}

// ---------- fala (voz provisória do navegador, só para testar a boca) ----------
const VIS = (c) => {
  c = c.toLowerCase();
  if ('aáàãâ'.includes(c)) return { jaw: 11, E: 0.1 };
  if ('eéê'.includes(c)) return { jaw: 5, E: 0.7 };
  if ('iíy'.includes(c)) return { jaw: 3, I: 0.8 };
  if ('oóôõ'.includes(c)) return { jaw: 7, O: 0.9 };
  if ('uú'.includes(c)) return { jaw: 3, U: 0.9 };
  if ('mbp'.includes(c)) return { M: 1 };
  if ('fv'.includes(c)) return { F: 1, jaw: 1 };
  if (/[a-zç]/.test(c)) return { jaw: 2.5, I: 0.25 };
  return {};
};
let speech = null, speaking = false;
function clearMouth() { for (const k of Object.keys(T)) T[k] = 0; }
function stopSpeech() {
  speech = null; if (window.speechSynthesis) speechSynthesis.cancel();
  clearMouth(); if (speaking) { speaking = false; startMic(); } updateStatus();
}
function speak(text) {
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; u.rate = 0.95;
  const s = { text, idx: 0, tb: performance.now() }; speech = s; speaking = true;
  pauseMic(); updateStatus();                                   // não escuta a própria voz
  u.onboundary = (e) => { if (speech === s) { s.idx = e.charIndex; s.tb = performance.now(); } };
  u.onstart = () => { s.tb = performance.now(); };
  u.onend = u.onerror = () => { if (speech === s) { speech = null; speaking = false; clearMouth(); updateStatus(); startMic(); } };
  speechSynthesis.speak(u);
}
function speechUpdate() {
  if (!speech) return;
  const i = Math.min(speech.text.length - 1, speech.idx + Math.floor((performance.now() - speech.tb) / 1000 * 13));
  clearMouth(); Object.assign(T, VIS(speech.text[i] || ' '));
}

// ---------- microfone: sempre escutando, com botão de mudo ----------
let micOn = true, recog = null, micBlocked = false, heardAt = -1e9;
try { micOn = localStorage.getItem('susbiMudo') !== '1'; } catch (e) {}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function startMic() {
  if (!micOn || speaking || recog || !SR || !window.isSecureContext || !model) { updateStatus(); return; }
  const r = new SR(); recog = r;
  r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
  r.onspeechstart = () => { heardAt = performance.now(); };
  r.onresult = (e) => {
    heardAt = performance.now();
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const tx = e.results[i][0].transcript.trim();
      if (!tx) continue;
      if (e.results[i].isFinal) heard(tx); else say('Você: ' + tx + '…');
    }
  };
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { micBlocked = true; say('Permita o microfone para eu escutar você (toque no botão do microfone).'); }
  };
  r.onend = () => { if (recog === r) recog = null; if (micOn && !speaking && !micBlocked) setTimeout(startMic, 300); updateStatus(); };
  try { r.start(); micBlocked = false; } catch (e) { recog = null; }
  updateStatus();
}
function pauseMic() { const r = recog; recog = null; if (r) { r.onend = null; try { r.abort(); } catch (e) {} } }
function heard(text) {
  say('Você: ' + text);
  // provisório, até a IA ser conectada: ela repete o que ouviu para testar a boca
  speak('Eu ouvi: ' + text);
}
function updateStatus() {
  const b = $('mic');
  b.textContent = micOn ? '🎙️ Escutando' : '🔇 Mudo';
  b.classList.toggle('mudo', !micOn);
  b.setAttribute('aria-pressed', String(!micOn));
  let st = 'Pronta';
  if (!model) st = 'Carregando';
  else if (speaking) st = 'Falando';
  else if (S.mode !== 'idle') st = 'Andando';
  else if (!SR) st = 'Sem reconhecimento de voz';
  else if (!micOn) st = 'Mudo';
  else if (micBlocked) st = 'Microfone bloqueado';
  else if (recog) st = 'Escutando';
  $('status').textContent = st;
}
$('mic').onclick = () => {
  micOn = !micOn; micBlocked = false;
  try { localStorage.setItem('susbiMudo', micOn ? '0' : '1'); } catch (e) {}
  if (micOn) { say('Estou escutando.'); startMic(); } else { pauseMic(); say('Microfone mudo. Não estou escutando.'); }
  updateStatus();
};
// alguns navegadores só liberam o microfone depois de um toque na página
window.addEventListener('pointerdown', () => { if (micOn && micBlocked) { micBlocked = false; startMic(); } }, { passive: true });
if (!SR) say('Este navegador não reconhece voz. Use o Chrome para ela escutar.');

// ---------- controles de teste ----------
$('andar').onclick = () => { stopSpeech(); S.next = 0; startWalk(); };
$('parar').onclick = () => stopSpeech();
$('expr').onchange = (e) => { expr = EXPR[e.target.value] || {}; };
$('boca').oninput = (e) => { manualJaw = e.target.value * 0.10; $('vBoca').textContent = e.target.value + '%'; };

// ---------- laço ----------
const clock = new THREE.Clock();
const TOUCHED = ['Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'Neck', 'Head', 'Jaw', 'LeftEye', 'RightEye'];
const baseQ = {};
function tick(dt, t) {
    behavior(dt);
    placeRoot();
    // o mixer só reescreve um osso quando o valor muda; por isso desfaz os ajustes do quadro anterior antes
    for (const n of TOUCHED) { const b = bones[n]; if (b && baseQ[n]) b.quaternion.copy(baseQ[n]); }
    mixer.update(dt);                 // pose base (repouso misturado com a caminhada)
    for (const n of TOUCHED) { const b = bones[n]; if (b) (baseQ[n] = baseQ[n] || new THREE.Quaternion()).copy(b.quaternion); }
    bodyUpdate(dt, t);                // movimentos sutis por cima
    speechUpdate(); mouthUpdate(dt, t); blinkUpdate(dt);
    model.updateMatrixWorld(true);
    grounding(dt);
    cameraUpdate(dt);
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (mixer) tick(dt, t);
  composer.render();
  requestAnimationFrame(loop);
}
loop();
window.__susbi = { get ready() { return !!mixer; }, S, get stride() { return stride; }, get yaw0() { return yaw0; }, get headY() { return headY; }, get floorY() { return floorY; }, cam, startWalk, bones, get mixer() { return mixer; }, get walk() { return walk; }, get model() { return model; }, step(n, dt) { for (let i = 0; i < n; i++) tick(dt, clock.elapsedTime += dt); } };
