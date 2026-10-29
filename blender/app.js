// SUSBI · teste do modelo feito no Blender (revisão 20) no navegador.
// Carrega susbi.glb (corpo com esqueleto, cabeça com formas da boca/piscar, olhos e rede), toca a entrada,
// fecha a câmera no close e responde aos controles (fala, piscar, cabeça, olhos, boca, expressões).
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
const setStatus = (t) => { $('status').textContent = t; };
const say = (t) => { $('say').textContent = t; };

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02060d);
scene.fog = new THREE.FogExp2(0x02060d, 0.09);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.12;

const camera = new THREE.PerspectiveCamera(73.7, 9 / 16, 0.05, 60);
scene.add(new THREE.HemisphereLight(0x335577, 0x000000, 0.18));
const key = new THREE.DirectionalLight(0x9fd8ff, 0.7); key.position.set(-1.5, 2.5, 2.5); scene.add(key);
for (const x of [-1.6, 1.6]) { const r = new THREE.PointLight(0x4aa8ff, 4, 0, 2); r.position.set(x, 1.55, -1.4); scene.add(r); }
const top = new THREE.PointLight(0x8fd0ff, 3, 0, 2); top.position.set(0, 3, -0.3); scene.add(top);

// chão escuro com dois anéis de luz
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0x03080f, roughness: 0.55, metalness: 0.25 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
for (const r of [0.9, 1.35]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 160), new THREE.MeshBasicMaterial({ color: 0x6fd2ff }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; scene.add(ring);
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

// ---------- câmera: plano aberto -> close do ombro para cima (mesmo caminho da cena do Blender) ----------
const CAM = [
  { t: 0.0, pos: [0, 0.95, 2.85], tgt: [0, 0.90, 0.0], fov: 73.7 },
  { t: 4.0, pos: [0, 0.95, 2.85], tgt: [0, 0.90, 0.0], fov: 73.7 },
  { t: 6.0, pos: [0, 1.44, 0.95], tgt: [0, 1.40, 0.06], fov: 39.6 },
  { t: 6.5, pos: [0, 1.44, 0.92], tgt: [0, 1.40, 0.06], fov: 39.6 },
];
const sm = (x) => x * x * (3 - 2 * x);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();
function cameraAt(t) {
  let i = 0; while (i < CAM.length - 2 && t > CAM[i + 1].t) i++;
  const A = CAM[i], B = CAM[i + 1], k = sm(Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t))));
  camera.position.copy(_a.fromArray(A.pos).lerp(_b.fromArray(B.pos), k));
  _t.fromArray(A.tgt).lerp(_b.fromArray(B.tgt), k); camera.lookAt(_t);
  camera.fov = A.fov + (B.fov - A.fov) * k; camera.updateProjectionMatrix();
}
cameraAt(0);

// ---------- modelo ----------
let mixer = null, entradaAction = null, head = null, morph = {}, bones = {}, clipLen = 6.5, entradaT = 0, playing = false;
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
loader.load('susbi.glb', (gltf) => {
  const root = gltf.scene; scene.add(root);
  root.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      const m = o.material;
      if (m && m.name === 'SUSBI pele') { m.emissiveIntensity = 3.6; m.roughness = 0.6; m.envMapIntensity = 0.4; }
      if (m && m.name === 'SUSBI corpo') { m.emissiveIntensity = 2.2; m.envMapIntensity = 0.6; }
      if (m && m.name === 'SUSBI rede') m.emissiveIntensity = 1.6;
      if (m && m.name === 'SUSBI iris') m.emissiveIntensity = 0.9;
      if (m && m.name === 'SUSBI olho') m.envMapIntensity = 0.3;
      if (o.morphTargetDictionary && o.morphTargetDictionary['Piscar'] !== undefined) { head = o; morph = o.morphTargetDictionary; }
    }
    if (o.isBone) bones[o.name.replace('mixamorig', '')] = o;
  });
  mixer = new THREE.AnimationMixer(root);
  const clip = gltf.animations.find((c) => /entrada/i.test(c.name)) || gltf.animations[0];
  clipLen = clip.duration;
  entradaAction = mixer.clipAction(clip); entradaAction.setLoop(THREE.LoopOnce, 1); entradaAction.clampWhenFinished = true;
  $('loading').style.display = 'none';
  setStatus('Pronta');
  playEntrada();
}, (e) => {
  if (e.total) $('bar').firstElementChild.style.width = Math.round((e.loaded / e.total) * 100) + '%';
}, (err) => {
  $('loadMsg').textContent = 'Não foi possível carregar o modelo: ' + (err && err.message ? err.message : err);
  setStatus('Erro');
});

function playEntrada() {
  if (!entradaAction) return;
  entradaAction.reset().play(); entradaT = 0; playing = true; setStatus('Entrando');
}

// ---------- rosto e movimentos por cima da animação ----------
const W = { O: 0, U: 0, E: 0, I: 0, M: 0, F: 0, jaw: 0 };   // valores atuais
const T = { O: 0, U: 0, E: 0, I: 0, M: 0, F: 0, jaw: 0 };   // alvos (fala)
const EXPR = {
  neutra: {}, alegria: { E: 0.35, I: 0.35, nod: -3 }, surpresa: { jaw: 6, O: 0.55, nod: -2 },
  tristeza: { U: 0.25, M: 0.25, nod: 7 }, atencao: { roll: 6, I: 0.15 },
};
let expr = EXPR.neutra, blinkT = -1, nextBlink = 2.5, saccade = 0, nextSacc = 1.5, manualJaw = 0;
const AX = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) };
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _ax = new THREE.Vector3();
function rotWorld(bone, axis, deg) {
  if (!bone || !deg) return;
  bone.parent.getWorldQuaternion(_pq); _ax.copy(axis).applyQuaternion(_pq.invert());
  bone.quaternion.premultiply(_q.setFromAxisAngle(_ax, THREE.MathUtils.degToRad(deg)));
}
function setMorph(name, v) { if (head && morph[name] !== undefined) head.morphTargetInfluences[morph[name]] = v; }

function faceUpdate(dt, t) {
  // piscar automático
  nextBlink -= dt; if (nextBlink <= 0 && blinkT < 0) { blinkT = 0; nextBlink = 2.5 + Math.random() * 3.5; }
  let blink = 0; if (blinkT >= 0) { blinkT += dt; const k = blinkT / 0.17; blink = k < 0.5 ? k * 2 : 2 - k * 2; if (k >= 1) { blinkT = -1; blink = 0; } }
  setMorph('Piscar', Math.max(0, Math.min(1, blink)));
  setMorph('Respirar', 0.3 + 0.3 * Math.sin(t * 2 * Math.PI / 4.5));
  // boca: fala + expressão + teste manual
  const rate = 1 - Math.exp(-dt * 18);
  for (const k of Object.keys(W)) W[k] += ((T[k] || 0) - W[k]) * rate;
  setMorph('Fala O', Math.min(1, W.O + (expr.O || 0)));
  setMorph('Fala U', Math.min(1, W.U + (expr.U || 0)));
  setMorph('Fala E', Math.min(1, W.E + (expr.E || 0)));
  setMorph('Fala I', Math.min(1, W.I + (expr.I || 0)));
  setMorph('Fala M B P', Math.min(1, W.M + (expr.M || 0)));
  setMorph('Fala F V', Math.min(1, W.F));
  rotWorld(bones.Jaw, AX.X, W.jaw + (expr.jaw || 0) + manualJaw);
  // cabeça e olhos (só depois da entrada, para não brigar com a caminhada)
  if (!playing) {
    nextSacc -= dt; if (nextSacc <= 0) { saccade = (Math.random() - 0.5) * 10; nextSacc = 1.2 + Math.random() * 2.5; }
    const yaw = +$('cabeca').value + 1.5 * Math.sin(t * 0.7), look = +$('olhar').value + saccade;
    rotWorld(bones.Neck, AX.Y, yaw * 0.35); rotWorld(bones.Head, AX.Y, yaw * 0.65);
    rotWorld(bones.Head, AX.X, (expr.nod || 0) + 0.8 * Math.sin(t * 0.5));
    rotWorld(bones.Head, AX.Z, expr.roll || 0);
    rotWorld(bones.LeftEye, AX.Y, look); rotWorld(bones.RightEye, AX.Y, look);
  }
}

// ---------- fala (voz do navegador) com formas da boca pelo texto ----------
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
let speech = null, audioDrive = null, recog = null;
function clearMouth() { for (const k of Object.keys(T)) T[k] = 0; }
function stopAll() {
  speech = null; if (window.speechSynthesis) speechSynthesis.cancel();
  if (audioDrive) { audioDrive.audio.pause(); audioDrive = null; }
  if (recog) { try { recog.abort(); } catch (e) {} recog = null; }
  clearMouth(); setStatus('Em repouso');
}
function speak(text) {
  stopAll(); say(text);
  if (!window.speechSynthesis) { say(text + ' (voz indisponível neste navegador)'); return; }
  const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; u.rate = 0.95;
  const s = { text, idx: 0, t0: performance.now(), tb: performance.now(), active: true }; speech = s;
  u.onboundary = (e) => { if (speech === s) { s.idx = e.charIndex; s.tb = performance.now(); } };
  u.onstart = () => { s.t0 = s.tb = performance.now(); setStatus('Falando'); };
  u.onend = u.onerror = () => { if (speech === s) { speech = null; clearMouth(); setStatus('Em repouso'); } };
  speechSynthesis.speak(u);
}
function speechUpdate() {
  if (speech) {
    const i = Math.min(speech.text.length - 1, speech.idx + Math.floor((performance.now() - speech.tb) / 1000 * 13));
    clearMouth(); Object.assign(T, VIS(speech.text[i] || ' '));
  } else if (audioDrive) {
    const a = audioDrive; a.an.getFloatTimeDomainData(a.buf);
    let r = 0; for (const v of a.buf) r += v * v; r = Math.sqrt(r / a.buf.length);
    const amp = Math.min(1, r * 9);
    if (performance.now() > a.next) { a.vis = 'aeiou'[Math.floor(Math.random() * 5)]; a.next = performance.now() + 110 + Math.random() * 90; }
    clearMouth(); if (amp > 0.06) { Object.assign(T, VIS(a.vis)); T.jaw = (T.jaw || 0) * (0.4 + amp); for (const k of ['O', 'U', 'E', 'I']) T[k] = (T[k] || 0) * Math.min(1, amp * 1.5); }
  }
}
function vozOriginal() {
  stopAll();
  const audio = new Audio('../3d/assets/voz-apresentacao.mp3');
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaElementSource(audio), an = ctx.createAnalyser(); an.fftSize = 1024;
  src.connect(an); an.connect(ctx.destination);
  audioDrive = { audio, an, buf: new Float32Array(an.fftSize), vis: 'a', next: 0 };
  audio.onended = () => { audioDrive = null; clearMouth(); setStatus('Em repouso'); };
  audio.play().then(() => { setStatus('Falando'); say('Voz original de apresentação.'); }).catch((e) => say('Não foi possível tocar o áudio: ' + e.message));
}
function ouvir() {
  stopAll();
  if (!window.isSecureContext) { say('O microfone precisa de HTTPS.'); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { say('Este navegador não reconhece voz. Tente o Chrome atualizado.'); return; }
  const r = new SR(); recog = r; r.lang = 'pt-BR';
  r.onresult = (e) => { recog = null; speak('Eu ouvi: ' + e.results[0][0].transcript); };
  r.onerror = (e) => { recog = null; setStatus('Em repouso'); say('Microfone: ' + e.error); };
  r.onend = () => { if (recog === r) { recog = null; setStatus('Em repouso'); } };
  r.start(); setStatus('Ouvindo'); say('Fale agora.');
}

// ---------- controles ----------
$('entrada').onclick = () => { stopAll(); playEntrada(); };
$('falar').onclick = () => speak('Olá! Eu sou a SUSBI, sua assistente do Lembraí. Estou pronta para conversar com você.');
$('voz').onclick = vozOriginal;
$('ouvir').onclick = ouvir;
$('parar').onclick = () => { stopAll(); say('Aguardando.'); };
$('piscar').onclick = () => { blinkT = 0; };
$('expr').onchange = (e) => { expr = EXPR[e.target.value] || EXPR.neutra; };
$('cabeca').oninput = (e) => { $('vCabeca').textContent = e.target.value + '°'; };
$('olhar').oninput = (e) => { $('vOlhar').textContent = e.target.value + '°'; };
$('boca').oninput = (e) => { manualJaw = e.target.value * 0.10; $('vBoca').textContent = e.target.value + '%'; };

// ---------- laço ----------
const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (mixer) {
    mixer.update(dt);
    if (playing) { entradaT += dt; if (entradaT >= clipLen) { playing = false; setStatus('Em repouso'); } }
    cameraAt(playing ? entradaT : clipLen);
    speechUpdate(); faceUpdate(dt, t);
  }
  composer.render();
  requestAnimationFrame(loop);
}
loop();
window.__susbi = { get ready() { return !!mixer; }, seek(s) { if (entradaAction) { entradaAction.time = s; entradaT = s; mixer.update(0); } } };
