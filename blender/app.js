// SUSBI · teste do modelo feito no Blender (revisão 21) no navegador — página v28.
// Ela fica ocupada com as coisas dela, de corpo inteiro: anda, se alonga, olha ao redor, gesticula.
// Quando você fala com ela (ou toca nela), ela termina o que está fazendo, vira para você e a câmera
// se aproxima do rosto; sem conversa por um tempo, volta para a rotina. A câmera também pode ser girada,
// aproximada e movida com o mouse ou os dedos. O microfone fica sempre escutando, com botão de mudo.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
const clips = {}, body = {};
let model = null, root = null, mixer = null, walk = null, head = null, morph = {}, bones = {};
const R0 = new THREE.Quaternion();
const hipOff = new THREE.Vector3();
let yaw0 = 0, headY = 1.45, stride = 0.8, floorY = 0;
const footRest = {};
const FEET = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
// estado do corpo: posição no chão, direção (0 = de frente para a câmera), peso da caminhada
const S = { x: 0, z: 0, y: 0, heading: 0, w: 0, wT: 0, mode: 'idle', t: 0, next: 2, goal: null, frame: 'inteiro', hold: 0, atende: false, acenou: false, faceTo: 0 };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _ax = new THREE.Vector3();
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
function placeRoot() {
  root.position.set(S.x, S.y, S.z);
  root.quaternion.setFromAxisAngle(Y, S.heading - yaw0).multiply(R0);
}

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
loader.load('susbi.glb?v=31', (gltf) => {
  model = gltf.scene; scene.add(model);
  root = model.getObjectByName('SUSBI_esqueleto') || model.getObjectByName('SmartRigArmature') || model.getObjectByName('SUSBI18_esqueleto') || model.children[0];
  R0.copy(root.quaternion);
  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      const m = o.material;
      if (m && m.name === 'SUSBI pele') { m.emissiveIntensity = 3.6; m.roughness = 0.6; m.envMapIntensity = 0.4; golaPele(m); }
      if (m && (m.name === 'SUSBI corpo2' || m.name === 'SUSBI cabeca2')) {         // SUSBI nova (Meshy): linhas ciano brilham; relevo pelo mapa de normais
        m.emissiveIntensity = 2.6; m.envMap = envTex; m.envMapIntensity = 0.35; m.normalScale.set(1, 1);
        rostoBrilho(m);
      }
      if (m && m.name === 'SUSBI corpo') {
        // traje preto que absorve a luz (sem reflexo) com trilhas de placa em branco fosco; o azul é a energia
        m.color.setScalar(1.0); m.metalness = 0.0; m.metalnessMap = null; m.roughness = 1.0; m.envMap = envTex; m.envMapIntensity = 0.25;
        energiaTraje(m);
      }
      if (m && m.name === 'SUSBI rede') { m.emissiveIntensity = 1.6; golaPele(m); }
      if (m && m.name === 'SUSBI iris') m.emissiveIntensity = 0.9;
      if (m && m.name === 'SUSBI olho') m.envMapIntensity = 0.3;
      if (o.morphTargetDictionary && o.morphTargetDictionary['Piscar'] !== undefined) { head = o; morph = o.morphTargetDictionary; }
    }
    if (o.isBone) bones[o.name.replace('mixamorig', '')] = o;
  });
  // animações do Meshy ficam num arquivo separado e leve (lote 1: 20 animações)
  loader.load('animacoes1.glb?v=31', (ag) => finishSetup(ag.animations), undefined, () => finishSetup(gltf.animations));
}, (e) => {
  if (e.total) $('bar').firstElementChild.style.width = Math.round((e.loaded / e.total) * 100) + '%';
}, (err) => {
  $('loadMsg').textContent = 'Não foi possível carregar o modelo: ' + (err && err.message ? err.message : err);
  $('status').textContent = 'Erro';
});
function finishSetup(anims) {
  for (const n of OMBROS) if (bones[n]) restQ[n] = bones[n].quaternion.clone();   // clavículas na posição natural do modelo
  mixer = new THREE.AnimationMixer(model);
  for (const c of anims) clips[c.name] = c;
  const wc = clips.Walking_Woman || anims.find((c) => /walk|caminhar/i.test(c.name));
  walk = mixer.clipAction(wc); walk.play(); walk.setEffectiveWeight(0);
  // camada do corpo: animações do Meshy (parada, fala, gestos) com transição suave entre elas
  for (const n of Object.keys(clips)) {
    if (clips[n] === wc) continue;
    const a = mixer.clipAction(clips[n]); a.play(); a.setEffectiveWeight(0); a.timeScale = 0;
    body[n] = { a, w: 0, tw: 0, once: false };
  }
  const sel = $('anim');
  if (sel) { for (const n of Object.keys(clips).sort()) { const o = document.createElement('option'); o.value = n; o.textContent = NOMES[n] || n; sel.appendChild(o); } }

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
    if (!o.isSkinnedMesh) return;
    let b; if (o.isSkinnedMesh) { o.computeBoundingBox(); b = o.boundingBox.clone(); } else { o.geometry.computeBoundingBox(); b = o.geometry.boundingBox.clone(); }
    sole = Math.min(sole, b.applyMatrix4(o.matrixWorld).min.y);
  });
  if (isFinite(sole)) floorY = sole;
  for (const g of groundParts) g.position.y = floorY + (g.userData.dy || 0);

  stride = measureStride(wc);
  medirGola();
  playBody(pickIdle(), 0);
  S.next = rand(1.5, 3);                          // já começa ocupada com as coisas dela
  setFrame('inteiro', true);
  $('loading').style.display = 'none';
  updateStatus();
  startMic();
}

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

// ---------- energia nas trilhas da roupa (v28) ----------
// corpo_dados.webp: cada pedaço contínuo de trilha no corpo tem um número (R+B) e, em G, a posição ao longo
// dele (0 numa ponta, 255 na outra). Um pulso escolhe um pedaço e corre de uma ponta à outra, com rastro.
// Por região: cada braço e cada perna recebem 1 a 3 pulsos a cada ~5 s; o tronco, 2 a 4 a cada 5 a 10 s.
const NP = 12;
const ENERGIA = {
  uTime: { value: 0 }, uData: { value: null }, uCor: { value: new THREE.Color(0.15, 0.72, 1.0) }, uForca: { value: 9.0 },
  uP: { value: Array.from({ length: NP }, () => new THREE.Vector4(-1, 0, 1, 1)) },   // pedaço, início, duração, sentido × comprimento (cm)
};
const REGIOES = {
  bracoE: { janela: [4, 6], qtd: [1, 3] }, bracoD: { janela: [4, 6], qtd: [1, 3] },
  pernaE: { janela: [4, 6], qtd: [1, 3] }, pernaD: { janela: [4, 6], qtd: [1, 3] },
  tronco: { janela: [5, 10], qtd: [2, 4] },
};
const RASTRO = 3.5;   // cm de rastro atrás da frente do pulso
let TRILHAS = null; const filaPulsos = []; const proxJanela = {};
fetch('pulsos.json?v=28').then((r) => r.json()).then((j) => { TRILHAS = j; }).catch(() => {});
function pulsos(t) {
  if (!TRILHAS) return;
  for (const [nome, R] of Object.entries(REGIOES)) {
    if (proxJanela[nome] === undefined) proxJanela[nome] = t + rand(0, R.janela[1]);   // cada região começa num momento diferente
    if (t < proxJanela[nome]) continue;
    const L = rand(R.janela[0], R.janela[1]);
    const n = R.qtd[0] + Math.floor(Math.random() * (R.qtd[1] - R.qtd[0] + 1));
    for (let i = 0; i < n; i++) filaPulsos.push({ nome, quando: t + rand(0, L) });
    proxJanela[nome] = t + L;
  }
  const P = ENERGIA.uP.value;
  for (let k = filaPulsos.length - 1; k >= 0; k--) {
    if (filaPulsos[k].quando > t) continue;
    const lista = TRILHAS[filaPulsos.splice(k, 1)[0].nome]; if (!lista || !lista.length) continue;
    const livre = P.findIndex((p) => p.x < 0 || t > p.y + p.z); if (livre < 0) continue;
    let tr = null;
    for (let tent = 0; tent < 6 && !tr; tent++) {             // prefere pedaços compridos, sem repetir um aceso
      const c = lista[Math.floor(Math.random() ** 1.5 * lista.length)];
      if (!P.some((p) => p.x === c[0] && t <= p.y + p.z)) tr = c;
    }
    if (!tr) continue;
    const vel = rand(9, 16);                                  // cm por segundo: dá para ver a energia andando
    P[livre].set(tr[0], t, (tr[1] + RASTRO * 2) / vel, (Math.random() < 0.5 ? 1 : -1) * tr[1]);
  }
}
function energiaTraje(m) {
  const tex = new THREE.TextureLoader().load('corpo_dados.webp?v=28');
  tex.flipY = false; tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  ENERGIA.uData.value = tex;
  m.emissive.setRGB(1, 1, 1); m.emissiveMap = null;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, ENERGIA);
    sh.fragmentShader = `uniform float uTime; uniform sampler2D uData; uniform vec3 uCor; uniform float uForca;
      uniform vec4 uP[${NP}];\n` + sh.fragmentShader
      // preto que absorve a luz (sem brilho nenhum) e trilhas em branco fosco
      .replace('#include <map_fragment>', `#include <map_fragment>
      float mTr = smoothstep(0.03, 0.15, dot(diffuseColor.rgb, vec3(0.3333)));
      diffuseColor.rgb = mix(vec3(0.0015, 0.0018, 0.0025), vec3(0.42), mTr);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.directSpecular = vec3(0.0); reflectedLight.indirectSpecular = vec3(0.0);`)
      .replace('#include <emissivemap_fragment>', `
      vec4 dd = texture2D(uData, vMapUv);
      float id = floor(dd.r * 255.0 + 0.5) * 256.0 + floor(dd.b * 255.0 + 0.5);
      float pulso = 0.0;
      for (int i = 0; i < ${NP}; i++) {
        vec4 p = uP[i];
        if (id < 0.5 || abs(p.x - id) > 0.5) continue;
        float k = (uTime - p.y) / p.z;
        if (k < 0.0 || k > 1.0) continue;
        float L = abs(p.w);
        float x = (p.w > 0.0 ? dd.g : 1.0 - dd.g) * L;          // cm desde a ponta onde o pulso nasce
        float frente = k * (L + ${(RASTRO * 2).toFixed(1)}) - ${RASTRO.toFixed(1)};
        float d = frente - x;                                    // > 0: atrás da frente (rastro)
        float v = d > 0.0 ? exp(-d / ${(RASTRO / 2.5).toFixed(2)}) : exp(d / 0.35);
        pulso = max(pulso, v);
      }
      totalEmissiveRadiance = uCor * (pulso * uForca);
    `);
  };
  m.customProgramCacheKey = () => 'susbi-energia-v28';
  m.needsUpdate = true;
}

// ---------- SUSBI nova: a luz do rosto apaga rapidinho ao piscar e pulsa ao falar ----------
const ROSTO = { uHeadP: { value: new THREE.Vector3(0, -9, 0) }, uPisca: { value: 0 }, uFala: { value: 0 } };
function rostoBrilho(m) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, ROSTO);
    sh.vertexShader = 'varying vec3 vRostoW;\n' + sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
      vRostoW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'varying vec3 vRostoW; uniform vec3 uHeadP; uniform float uPisca; uniform float uFala;\n' + sh.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float naCabeca = 1.0 - smoothstep(0.11, 0.16, distance(vRostoW, uHeadP));
      totalEmissiveRadiance *= mix(1.0, (1.0 - 0.9 * uPisca) * (1.0 + 1.2 * uFala), naCabeca);`);
  };
  m.customProgramCacheKey = () => 'susbi-rosto';
  m.needsUpdate = true;
}
function rostoUpdate() {
  if (!bones.Head) return;
  const top = bones.HeadTop_End;
  bones.Head.getWorldPosition(ROSTO.uHeadP.value);
  if (top) ROSTO.uHeadP.value.lerp(top.getWorldPosition(_v), 0.5); else ROSTO.uHeadP.value.y += 0.09;
  ROSTO.uFala.value = clamp(W.jaw / 9, 0, 1);
}

// ---------- pescoço: a pele da cabeça escurece aos poucos abaixo do queixo até o preto da roupa ----------
// A altura é medida ao longo do pescoço (do osso do pescoço para a cabeça), então acompanha os movimentos.
const GOLA = { uNeckP: { value: new THREE.Vector3() }, uNeckUp: { value: new THREE.Vector3(0, 1, 0) }, uG0: { value: -1 }, uG1: { value: -0.9 } };
function golaPele(m) {
  if (m.userData.gola) return; m.userData.gola = true;      // material usado por mais de uma malha
  const antes = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (antes) antes(sh, r);
    Object.assign(sh.uniforms, GOLA);
    sh.vertexShader = 'varying vec3 vGolaW;\n' + sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
      vGolaW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'varying vec3 vGolaW; uniform vec3 uNeckP; uniform vec3 uNeckUp; uniform float uG0; uniform float uG1;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
      float gola = 1.0 - smoothstep(uG0, uG1, dot(vGolaW - uNeckP, uNeckUp));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0015, 0.0018, 0.0025), gola);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= 1.0 - gola;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.directSpecular *= 1.0 - gola; reflectedLight.indirectSpecular *= 1.0 - gola;`);
  };
  m.customProgramCacheKey = () => 'susbi-gola-' + m.name;
  m.needsUpdate = true;
}
function medirGola() {
  model.updateMatrixWorld(true);
  const nP = wp(bones.Neck), up = wp(bones.Head).sub(nP).normalize();
  let queixo = Infinity, roupa = -Infinity; const v = new THREE.Vector3(), d = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const P = o.geometry.attributes.position, nm = o.material.name;
    if (nm === 'SUSBI pele' && o.morphTargetDictionary && o.morphTargetDictionary['Fala O'] !== undefined) {
      const M = o.geometry.morphAttributes.position[o.morphTargetDictionary['Fala O']];
      for (let i = 0; i < P.count; i++) {
        if (d.fromBufferAttribute(M, i).length() < 0.002) continue;        // só a boca e o queixo (o que mexe ao falar)
        o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); queixo = Math.min(queixo, v.sub(nP).dot(up));
      }
    }
    if (nm === 'SUSBI corpo') for (let i = 0; i < P.count; i += 2) { o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); roupa = Math.max(roupa, v.sub(nP).dot(up)); }
  });
  if (!isFinite(queixo) || !isFinite(roupa)) return;
  GOLA.uG0.value = roupa - 0.002;                                       // preto total na borda da roupa
  GOLA.uG1.value = Math.max(queixo - 0.003, roupa + 0.012);             // pele normal a partir do queixo
  console.log('gola', { queixo: +queixo.toFixed(3), roupa: +roupa.toFixed(3) });
}
function golaUpdate() {
  if (!bones.Neck || !bones.Head) return;
  bones.Neck.getWorldPosition(GOLA.uNeckP.value);
  bones.Head.getWorldPosition(GOLA.uNeckUp.value).sub(GOLA.uNeckP.value).normalize();
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
// câmera com o mouse ou os dedos: arrastar gira, roda/pinça dá zoom, botão direito (ou dois dedos) move.
// Mexeu na câmera, ela fica onde você deixou; volta para a automática no botão ou após 25 s sem mexer.
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true;
controls.minDistance = 0.3; controls.maxDistance = 9; controls.maxPolarAngle = 1.62; controls.zoomSpeed = 0.8;
let camManual = false, interagindo = false, manualAte = 0;
controls.addEventListener('start', () => { interagindo = true; manualAte = Infinity; $('dica').hidden = true; });
controls.addEventListener('change', () => { if (interagindo && !camManual) { camManual = true; $('autoCam').hidden = false; } });
controls.addEventListener('end', () => { interagindo = false; manualAte = performance.now() + 25000; });
function camAutomatica() { camManual = false; cam.pos.copy(camera.position); cam.tgt.copy(controls.target); $('autoCam').hidden = true; }
$('autoCam').onclick = camAutomatica;
setTimeout(() => { $('dica').hidden = true; }, 12000);
function cameraUpdate(dt) {
  if (camManual) { controls.update(); if (performance.now() > manualAte) camAutomatica(); return; }
  frameTargets();
  const r = damp(dt, cam.rate);
  cam.pos.lerp(cam.wantPos, r); cam.tgt.lerp(cam.wantTgt, r);
  camera.position.copy(cam.pos); camera.lookAt(cam.tgt);
  controls.target.copy(cam.tgt);
}
// tocar/clicar nela sem arrastar = chamar a atenção dela
{ let pd = null;
  canvas.addEventListener('pointerdown', (e) => { pd = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => { if (pd && Math.hypot(e.clientX - pd.x, e.clientY - pd.y) < 6 && performance.now() - pd.t < 400) atender(); pd = null; });
}

// ---------- camada do corpo (animações do Meshy) ----------
const NOMES = {
  Idle_02: 'Parada', Idle_03: 'Alongamento', Long_Breathe_and_Look_Around: 'Respira e olha ao redor', Walking_Woman: 'Andar (mulher)',
  Walking: 'Andar', Casual_Walk: 'Caminhada casual', Confident_Strut: 'Caminhada confiante', Running: 'Correr',
  Idle_Turn_Left: 'Virar à esquerda parada', Idle_Turn_Right: 'Virar à direita parada', Walk_Turn_Left: 'Virar à esquerda andando',
  Walk_Turn_Right_Female: 'Virar à direita andando', Stand_and_Chat: 'Conversar', Talk_with_Hands_Open: 'Falar com as mãos abertas',
  Talk_with_Right_Hand_Open: 'Falar com a mão direita', Agree_Gesture: 'Concordar', Listening_Gesture: 'Escutar', Big_Wave_Hello: 'Acenar olá',
  Shrug: 'Encolher os ombros', Confused_Scratch: 'Coçar a cabeça (confusa)',
};
const IDLES = [['Idle_02', 5], ['Long_Breathe_and_Look_Around', 2]];   // Idle_03 é um alongamento: só no menu de teste
const TALKS = ['Talk_with_Hands_Open', 'Talk_with_Right_Hand_Open', 'Stand_and_Chat'];
// rotina: toda animação que não é fala, parada, caminhada ou giro entra sozinha (inclusive as próximas que chegarem)
const FORA_DA_ROTINA = /walk|run|strut|jog|sprint|turn|caminh|corr/i;
function atividades() { return Object.keys(body).filter((n) => !TALKS.includes(n) && !IDLES.some(([i]) => i === n) && !FORA_DA_ROTINA.test(n) && n !== 'Big_Wave_Hello'); }
let bodyCur = null;
function pickW(list) { const ok = list.filter(([n]) => body[n]); let t = ok.reduce((a, [, w]) => a + w, 0) * Math.random(); for (const [n, w] of ok) { if ((t -= w) <= 0) return n; } return ok.length ? ok[0][0] : null; }
function pickIdle() { return pickW(IDLES); }
function playBody(name, fade = 0.5, once = false) {
  const B = body[name]; if (!B) return;
  if (bodyCur === name && !once) return;
  for (const k in body) body[k].tw = 0;
  B.tw = 1; B.once = once; B.fade = Math.max(0.05, fade);
  if (bodyCur !== name || once) { B.a.time = 0; }
  B.a.paused = false; B.a.enabled = true;          // um gesto que já terminou uma vez fica pausado: libera
  B.a.timeScale = 1; B.a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); B.a.clampWhenFinished = once;
  if (fade === 0) B.w = 1;
  bodyCur = name;
}
function bodyLayer(dt) {
  if (!bodyCur) return;
  const B = body[bodyCur];
  // fim de um gesto (ou fim de um ciclo parada): volta para a parada / escolhe outra variação
  if (B.once && B.a.time >= B.a.getClip().duration - 0.05) { playBody(speaking ? TALKS[Math.floor(Math.random() * TALKS.length)] : pickIdle(), 0.6); }
  else if (!speaking && S.mode === 'idle' && IDLES.some(([n]) => n === bodyCur) && B.lastT !== undefined && B.a.time < B.lastT && Math.random() < 0.3) {
    const n = pickIdle(); if (n !== bodyCur) playBody(n, 0.8);   // terminou um ciclo: às vezes troca de variação
  }
  B.lastT = B.a.time;
  const still = 1 - S.w;
  for (const k in body) {
    const b = body[k]; const r = damp(dt, 3 / (b.fade || 0.5));
    b.w += (b.tw - b.w) * r; if (b.tw === 0 && b.w < 0.003) b.w = 0;
    b.a.setEffectiveWeight(b.w * still);
    b.a.timeScale = b.w > 0 ? 1 : 0;
  }
}
function talkStart() { if (S.mode === 'idle' && !(bodyCur && body[bodyCur].once)) playBody(TALKS[Math.floor(Math.random() * TALKS.length)], 0.5); }   // no meio de um gesto: termina antes
function talkEnd() { if (S.mode === 'idle' && TALKS.includes(bodyCur)) playBody(pickIdle(), 0.7); }

const WALK_SPEED = 0.85;   // um pouco mais calma que a animação original
// ---------- comportamento ----------
// Livre: ela faz as coisas dela sozinha, de corpo inteiro (anda, gesticula, se alonga, olha ao redor).
// Atendendo: quando você fala com ela ou toca nela, termina o gesto em curso, vira para você e a câmera
// se aproxima do rosto. Depois de 25 s sem conversa, volta para a rotina.
let ultimaConversa = -1e9;
function atender() {
  ultimaConversa = performance.now();
  if (!S.atende) { S.atende = true; updateStatus(); }
}
const ocupada = () => !!(bodyCur && body[bodyCur] && body[bodyCur].once);   // no meio de um gesto
function rotina() {
  const r = Math.random(), at = atividades();
  if (r < 0.35) { startWalk(); return; }
  if (r < 0.85 && at.length) { const n = at[Math.floor(Math.random() * at.length)]; playBody(n, 0.6, true); S.next = clips[n].duration + rand(2, 6); return; }
  playBody(pickIdle(), 0.8); S.next = rand(3, 7);                           // só fica parada, respirando, olhando ao redor
}
function startWalk() {
  if (S.mode !== 'idle' || !walk) return;
  const r = Math.hypot(S.x, S.z);
  let gx, gz, tries = 0;
  do {
    if (r > 0.5 && Math.random() < 0.6) { gx = rand(-0.25, 0.25); gz = rand(-0.25, 0.15); }   // volta para perto do centro
    else { gx = rand(-0.95, 0.95); gz = rand(-0.7, 0.3); }
  } while (Math.hypot(gx - S.x, gz - S.z) < 0.6 && ++tries < 20);
  S.goal = { x: gx, z: gz };
  S.faceTo = rand(-1.2, 1.2);                     // ao chegar, fica virada para um lado qualquer (ela está ocupada)
  S.mode = 'prep'; S.t = 0;
  G.tYaw = clamp(wrap(Math.atan2(gx - S.x, gz - S.z) - S.heading) / DEG, -25, 25); G.next = 2; // olha para onde vai
  updateStatus();
}
function behavior(dt) {
  S.t += dt;
  if (S.atende && !speaking && performance.now() - ultimaConversa > 25000) { S.atende = false; S.next = rand(2, 5); updateStatus(); }
  const interrompe = () => { S.mode = 'face'; S.t = 0; S.wT = 0.55; };     // você chegou: para de andar e vira
  if (S.mode === 'idle') {
    if (S.atende) {
      if (!ocupada() && Math.abs(wrap(0 - S.heading)) > 0.06) interrompe();
      else if (!ocupada() && !S.acenou) { S.acenou = true; if (!speaking) playBody('Big_Wave_Hello', 0.4, true); }   // primeira vez: acena
    } else {
      S.next -= dt;
      if (S.next <= 0 && !ocupada()) rotina();
    }
  } else if (S.mode === 'prep') {
    if (S.atende) interrompe();
    else if (S.t > 0.4) { S.mode = 'turn'; S.t = 0; walk.time = 0; S.wT = 0.6; }
  } else if (S.mode === 'turn') {             // vira no lugar para o destino
    const dh = wrap(Math.atan2(S.goal.x - S.x, S.goal.z - S.z) - S.heading);
    S.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
    if (S.atende) interrompe();
    else if (Math.abs(dh) < 0.2 || S.t > 3) { S.mode = 'walk'; S.t = 0; S.wT = 1; }
  } else if (S.mode === 'walk') {
    const dx = S.goal.x - S.x, dz = S.goal.z - S.z, d = Math.hypot(dx, dz);
    const dh = wrap(Math.atan2(dx, dz) - S.heading);
    S.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    const v = stride * WALK_SPEED * S.w * Math.max(0.15, Math.cos(Math.min(Math.abs(dh), 1.4)));
    S.x += Math.sin(S.heading) * v * dt; S.z += Math.cos(S.heading) * v * dt;
    if (S.atende || d < 0.08 || S.t > 12) interrompe();
  } else if (S.mode === 'face') {              // vira para você (atendendo) ou para um lado qualquer (livre)
    const dh = wrap((S.atende ? 0 : (S.faceTo || 0)) - S.heading);
    S.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
    if (Math.abs(dh) < 0.04 || S.t > 4) { S.mode = 'settle'; S.t = 0; S.wT = 0; }
  } else if (S.mode === 'settle') {
    if (S.w < 0.02 && S.t > 0.6) { S.mode = 'idle'; S.next = rand(2, 6); updateStatus(); }
  }
  S.w += (S.wT - S.w) * damp(dt, 4);
  if (S.w < 0.002 && S.wT === 0) S.w = 0;
  walk.setEffectiveWeight(S.w);
  walk.timeScale = S.w > 0.01 ? (S.mode === 'walk' ? WALK_SPEED : 0.75) : 0;
  if (S.w === 0) S.y += (0 - S.y) * damp(dt, 6);
  // câmera: corpo inteiro na rotina; perto do rosto quando está atendendo você, de frente
  let quer = 'inteiro';
  if (S.atende && S.mode === 'idle' && Math.abs(wrap(S.heading)) < 0.2 && (!ocupada() || bodyCur === 'Big_Wave_Hello')) quer = bodyCur === 'Big_Wave_Hello' ? 'meio' : 'close';
  if (S.frame !== quer) setFrame(quer);
}
// mantém o pé que está apoiado no chão (a animação "no lugar" levanta um pouco o corpo)
function grounding(dt) {
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
  neutra: {}, alegria: { sorriso: 1, E: 0.15, nod: -3 }, surpresa: { jaw: 6, O: 0.55, nod: -2 },
  tristeza: { U: 0.25, M: 0.25, nod: 7 }, atencao: { roll: 6, I: 0.15 },
  // expressão do busto de 26/10: olhos quase fechados, sorriso suave, cabeça um pouco baixa e inclinada
  serena: { sorriso: 0.75, lids: 0.5, nod: 6, roll: 4 },
};
function bodyUpdate(dt, t) {
  // eixos do corpo (lado e frente) conforme a direção em que ela está virada
  AXX.set(Math.cos(S.heading), 0, -Math.sin(S.heading)); AXZ.set(Math.sin(S.heading), 0, Math.cos(S.heading));
  const still = 0.3 * (1 - S.w);
  // de vez em quando olha para outro lugar e volta para você
  G.next -= dt;
  if (S.atende) {                                   // atendendo: olha para você, mesmo antes de virar o corpo
    const a = wrap(Math.atan2(camera.position.x - S.x, camera.position.z - S.z) - S.heading) / DEG;
    G.tYaw = clamp(a, -55, 55); G.tPitch = 0;
  } else if (G.next <= 0 && S.mode === 'idle') {
    if (Math.random() < 0.55) { G.tYaw = 0; G.tPitch = 0; G.next = rand(2.5, 7); }
    else { G.tYaw = rand(-18, 18); G.tPitch = rand(-7, 4); G.next = rand(1.2, 3.5); if (Math.random() < 0.3) blinkNow(); }
  }
  if (!S.atende && (S.mode === 'walk' || S.mode === 'face' || S.mode === 'turn')) { G.tYaw = 0; G.tPitch = 2; }
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
  lids += ((expr.lids || 0) - lids) * damp(dt, 3);
  setMorph('Piscar', clamp(Math.max(v, lids), 0, 1)); ROSTO.uPisca.value = clamp(v, 0, 1);
}
let lids = 0, smile = 0, microSmile = 0, nextMicro = rand(8, 20);

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
  // sorriso: o da expressão + um sorriso leve de vez em quando, parada (menos enquanto fala)
  nextMicro -= dt; if (nextMicro <= 0) { microSmile = microSmile > 0 ? 0 : rand(0.15, 0.35); nextMicro = microSmile > 0 ? rand(2, 5) : rand(10, 25); }
  smile += ((expr.sorriso || 0) + (S.mode === 'idle' ? microSmile : 0) - smile) * damp(dt, 4);
  setMorph('Sorriso', clamp(smile * (speaking ? 0.5 : 1), 0, 1));
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
  atender(); pauseMic(); updateStatus(); talkStart();                      // não escuta a própria voz; gesticula
  u.onboundary = (e) => { if (speech === s) { s.idx = e.charIndex; s.tb = performance.now(); } };
  u.onstart = () => { s.tb = performance.now(); };
  u.onend = u.onerror = () => { if (speech === s) { speech = null; speaking = false; clearMouth(); updateStatus(); startMic(); talkEnd(); } };
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
      atender();                                   // você começou a falar: ela vem te atender
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
  else if (S.atende && S.mode !== 'idle') st = 'Vindo te atender';
  else if (S.mode !== 'idle') st = 'Andando';
  else if (!S.atende) st = 'Ocupada (fale com ela)';
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
$('andar').onclick = () => { stopSpeech(); S.atende = false; startWalk(); };
$('parar').onclick = () => stopSpeech();
if ($('anim')) $('anim').onchange = (e) => { const n = e.target.value; if (n && S.mode === 'idle') { playBody(n, 0.4, true); S.next = clips[n].duration + rand(3, 6); } e.target.value = ''; };
$('expr').onchange = (e) => { expr = EXPR[e.target.value] || {}; };
$('boca').oninput = (e) => { manualJaw = e.target.value * 0.10; $('vBoca').textContent = e.target.value + '%'; };

// ---------- laço ----------
const clock = new THREE.Clock();
const TOUCHED = ['Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'Neck', 'Head', 'Jaw', 'LeftEye', 'RightEye'];
const baseQ = {};
// As animações do Meshy sobem as clavículas uns 25° acima do natural (ombro encolhido, parecendo ombreira).
// Depois do mixer, puxa as clavículas de volta para perto da posição natural, guardando só 20% do movimento.
const OMBROS = ['LeftShoulder', 'RightShoulder'], restQ = {}, OMBRO_FIXO = 0.8;
function tick(dt, t) {
    ENERGIA.uTime.value = t; pulsos(t);
    behavior(dt);
    placeRoot();
    // o mixer só reescreve um osso quando o valor muda; por isso desfaz os ajustes do quadro anterior antes
    for (const n of TOUCHED) { const b = bones[n]; if (b && baseQ[n]) b.quaternion.copy(baseQ[n]); }
    bodyLayer(dt);
    mixer.update(dt);                 // pose base (animações do corpo misturadas com a caminhada)
    for (const n of TOUCHED) { const b = bones[n]; if (b) (baseQ[n] = baseQ[n] || new THREE.Quaternion()).copy(b.quaternion); }
    for (const n of OMBROS) { const b = bones[n]; if (b && restQ[n]) b.quaternion.slerp(restQ[n], OMBRO_FIXO); }
    bodyUpdate(dt, t);                // movimentos sutis por cima
    speechUpdate(); mouthUpdate(dt, t); blinkUpdate(dt);
    model.updateMatrixWorld(true);
    golaUpdate(); rostoUpdate();
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
window.__susbi = { get ready() { return !!mixer; }, S, get stride() { return stride; }, get yaw0() { return yaw0; }, get headY() { return headY; }, get floorY() { return floorY; }, cam, startWalk, bones, get mixer() { return mixer; }, get body() { return body; }, get walk() { return walk; }, get model() { return model; }, ENERGIA, get trilhas() { return TRILHAS; }, atender, GOLA, controls, get camManual() { return camManual; }, step(n, dt) { for (let i = 0; i < n; i++) tick(dt, clock.elapsedTime += dt); } };
