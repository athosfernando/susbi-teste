// Motor de geometria 3D experimental da SUSBI. Não é o rosto 3D definitivo.
// Sem vídeos, sem serviços externos e sem chamadas à IA.
export function createSUSBI3D(THREE, canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040e19');
  scene.fog = new THREE.FogExp2(0x031020,0.038);
  const camera = new THREE.PerspectiveCamera(36,1,0.1,100);
  camera.position.set(0,-.15,7.25);
  camera.lookAt(0,-.25,0);
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  scene.add(new THREE.HemisphereLight(0xbceeff,0x080c22,1.5));
  const key=new THREE.PointLight(0x70dfff,32,9,2); key.position.set(-2,2,4);scene.add(key);
  const rim=new THREE.PointLight(0x5c88ff,18,7,2);rim.position.set(2,1,-1);scene.add(rim);
  const fill=new THREE.PointLight(0x79dfff,9,6,2);fill.position.set(.5,-1.1,3);scene.add(fill);

  const shellMat=new THREE.MeshPhysicalMaterial({color:0x06182d,metalness:.55,roughness:.31,clearcoat:1,clearcoatRoughness:.12,emissive:0x08283d,emissiveIntensity:.42});
  const lineMat=new THREE.MeshBasicMaterial({color:0x7bdfff,transparent:true,opacity:.8,depthWrite:false});
  const glowMat=new THREE.MeshBasicMaterial({color:0x6defff,transparent:true,opacity:.95,depthWrite:false});
  const darkMat=new THREE.MeshBasicMaterial({color:0x010714});
  const irisMat=new THREE.MeshBasicMaterial({color:0x42dfff});
  const lidMat=new THREE.MeshPhysicalMaterial({color:0x082034,metalness:.6,roughness:.2,emissive:0x1b5272,emissiveIntensity:.3});
  const avatar=new THREE.Group(); scene.add(avatar);
  const upper=new THREE.Group(); avatar.add(upper);

  function sphere(name,material,x,y,z,sx,sy,sz,parent=upper){
    const o=new THREE.Mesh(new THREE.SphereGeometry(1,36,24),material);
    o.name=name; o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;
  }
  function tube(points,r=.006,mat=lineMat,parent=upper){
    const path=new THREE.CatmullRomCurve3(points.map(([x,y,z])=>new THREE.Vector3(x,y,z)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(10,points.length*6),r,4,false),mat);
    parent.add(mesh);return mesh;
  }
  function ring(rx,ry,z,material=glowMat,parent=upper){
    const curve=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;curve.push([Math.cos(a)*rx,Math.sin(a)*ry,z]);}
    return tube(curve,.009,material,parent);
  }
  function surfaceZ(x,y,z0=.02){
    const v=1-(x/1.01)**2-((y-.16)/1.42)**2;
    return .76*Math.sqrt(Math.max(.025,v))+z0;
  }

  // Anatomia temporária 3D: a fisionomia real será construída em Blender.
  const g=new THREE.SphereGeometry(1,92,68);
  const pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i);const x=pos.getX(i);const z=pos.getZ(i);
    const jaw= y<-.12?Math.max(.70,1+(.25*(y+.12))):1;
    const cheek=1+.075*Math.exp(-Math.pow((y+.12)/.31,2));
    pos.setXYZ(i,x*1.025*jaw*cheek,(y*1.36)+.2,z*.75);
  }
  pos.needsUpdate=true;g.computeVertexNormals();
  const head=new THREE.Mesh(g,shellMat);upper.add(head);
  sphere('orelha-esq',lidMat,-1.02,-.16,.08,.16,.29,.11);
  sphere('orelha-dir',lidMat,1.02,-.16,.08,.16,.29,.11);
  tube([[-1.03,.03,.1],[-1.12,-.1,.18],[-1.1,-.28,.16]],.012,glowMat);
  tube([[1.03,.03,.1],[1.12,-.1,.18],[1.1,-.28,.16]],.012,glowMat);
  // Pescoço e ombros estilizados.
  sphere('pescoco',shellMat,0,-1.43,-.06,.39,.76,.39,avatar);
  sphere('ombros',shellMat,0,-2.18,-.09,1.52,.48,.54,avatar);
  for(let i=-5;i<=5;i++){
    const x=i*.07;
    tube([[x,-1.0,.36],[x*.9,-1.43,.36],[x*1.65,-2.02,.37]],.008,i%3===0?glowMat:lineMat,avatar);
  }
  for(let side of [-1,1]){
    tube([[side*.36,-1.7,.35],[side*.64,-2.01,.35],[side*1.24,-2.18,.13]],.014,glowMat,avatar);
  }

  // Olhos: geometria independente, íris que seguem o olhar e pálpebras que piscam.
  const eyes=[];const brows=[];
  for(const side of [-1,1]){
    const x=side*.414,y=.33,z=surfaceZ(x,y,.10);
    const socket=sphere('orbita',darkMat,x,y,z,.315,.168,.076);
    socket.rotation.z=side*-.09;
    const eye=new THREE.Group();eye.position.set(x,y,z+.055);upper.add(eye);
    sphere('globo',lidMat,0,0,0,.283,.130,.048,eye);
    const iris=new THREE.Group();eye.add(iris);
    sphere('iris',irisMat,0,0,.056,.115,.112,.026,iris);
    sphere('pupila',darkMat,0,0,.081,.046,.069,.009,iris);
    sphere('reflexo',glowMat,-.027,.041,.090,.025,.026,.006,iris);
    const borderPoints=[];
    for(let i=0;i<=18;i++){
      const angle=i/18*Math.PI;
      borderPoints.push([x+.294*Math.cos(angle),y+.137*Math.sin(angle),z+.058]);
    }
    tube(borderPoints,.010,lineMat);
    const brow=tube([[x-.29,y+.29,z-.06],[x-.09,y+.35,z+.06],[x+.14,y+.32,z+.05],[x+.3,y+.275,z-.055]],.017,glowMat);
    eyes.push({mesh:eye,iris,side});brows.push({mesh:brow,side,x,y,z});
  }
  // Nariz estilizado e bochechas.
  const bridge=sphere('ponte-nasal',shellMat,0,-.025,.765,.14,.39,.16);
  sphere('ponta-nariz',lidMat,0,-.25,.858,.175,.105,.115);
  for(let side of [-1,1]){
    sphere('asa-nariz',shellMat,side*.135,-.292,.79,.086,.065,.1);
    const pts=[[side*.18,-.36,.70],[side*.43,-.29,surfaceZ(side*.43,-.29,.044)],[side*.74,-.14,surfaceZ(side*.74,-.14,.045)]];
    tube(pts,.009,lineMat);
    tube([[side*.25,.06,.73],[side*.43,-.015,.71],[side*.62,-.08,.59]],.008,lineMat);
  }

  // Boca realmente animável: cavidade, lábios e dentes são malhas independentes.
  const mouth=new THREE.Group();mouth.position.set(0,-.63,.712);upper.add(mouth);
  const cavity=sphere('interior-boca',darkMat,0,-.005,-.004,.275,.018,.020,mouth);
  const upperLip=sphere('labio-superior',lidMat,0,.032,.014,.293,.040,.050,mouth);
  const lowerLip=sphere('labio-inferior',lidMat,0,-.033,.018,.274,.043,.05,mouth);
  const upperGlow=sphere('traco-labio-superior',glowMat,0,.014,.058,.268,.008,.005,mouth);
  const lowerGlow=sphere('traco-labio-inferior',glowMat,0,-.014,.055,.268,.007,.005,mouth);
  const teeth=sphere('dentes',new THREE.MeshBasicMaterial({color:0xbef7ff}),0,-.017,.026,.226,.015,.013,mouth);
  // Malha de pontos de circuito distribuídos no rosto, sem trocar de textura/imagem.
  const seed={n:19};function rand(){seed.n=(seed.n*1664525+1013904223)>>>0;return seed.n/4294967296;}
  const smallGlow=new THREE.MeshBasicMaterial({color:0xb3f9ff,transparent:true,opacity:.73,depthWrite:false});
  const nodeGeo=new THREE.SphereGeometry(1,6,5);
  const nodes=new THREE.InstancedMesh(nodeGeo,smallGlow,370);
  const o3=new THREE.Object3D();
  for(let i=0;i<370;i++){
    const x=(rand()*2-1)*.87,y=(rand()*2-1)*1.28+.18;
    const zz=surfaceZ(x,y,.023);
    // Não cobrir completamente os olhos e a boca.
    if((Math.abs(y-.33)<.20&&Math.abs(x)<.80)||(y<-.49&&y>-.78&&Math.abs(x)<.37)){
      o3.position.set(x,y,-.9);
    }else{o3.position.set(x,y,zz)}
    const r=.004+rand()*.011;o3.scale.setScalar(r);o3.updateMatrix();nodes.setMatrixAt(i,o3.matrix);
  }
  upper.add(nodes);
  // Fibras luminosas no couro cabeludo.
  for(let i=0;i<37;i++){
    const x=(i/36-.5)*1.74,peak=.2+1.36*Math.sqrt(Math.max(0,1-(x/1.00)**2));
    const z=surfaceZ(x,peak-.03,.05);
    tube([[x*.97,peak-.26,z-.02],[x,peak-.12,z+.035],[x*.99,peak+.02,z+.025]],.0045,i%5===0?glowMat:lineMat);
  }
  // Halo e fibras orbitais: permanecem atrás da cabeça.
  const halo=new THREE.Group();avatar.add(halo);
  for(let j=0;j<3;j++){
    const pts=[];for(let i=0;i<=100;i++){
      const a=i/100*Math.PI*2,rx=1.34+j*.13,ry=1.57+j*.08;
      pts.push([Math.cos(a)*rx,Math.sin(a)*ry+.05, -.68-j*.17+Math.sin(a*3+j)*.09]);
    }
    tube(pts,.006,new THREE.MeshBasicMaterial({color:0x3c9fc8,transparent:true,opacity:.22+j*.07}),halo);
  }
  const starPositions=new Float32Array(310*3);
  for(let i=0;i<310;i++){starPositions[3*i]=(rand()-.5)*13;starPositions[3*i+1]=(rand()-.5)*12;starPositions[3*i+2]=-3-rand()*5}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
  const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0x388eae,size:.022,transparent:true,opacity:.5}));scene.add(stars);

  let state='repouso',emotion='neutra',mouthTarget=0,mouthValue=0,blinkUntil=0,manualAngle=0,lookX=0,lookY=0,frame=0,disposed=false;
  const clock=new THREE.Clock();
  function setState(s){state=s;if(s!=='falando')setMouth(0)}
  function setEmotion(e){emotion=e}
  function setMouth(v){mouthTarget=THREE.MathUtils.clamp(Number(v)||0,0,1)}
  function setHead(deg){manualAngle=THREE.MathUtils.clamp(Number(deg)||0,-20,20)*Math.PI/180}
  function setLook(x=0,y=0){lookX=THREE.MathUtils.clamp(x,-1,1);lookY=THREE.MathUtils.clamp(y,-1,1)}
  function blink(){blinkUntil=clock.elapsedTime+.15}
  let nextBlink=2.8;
  function updateMouth(value){
    cavity.scale.y=.018+value*.145;
    upperLip.position.y=.04+value*.066;
    lowerLip.position.y=-.043-value*.12;
    upperGlow.position.y=.016+value*.05;
    lowerGlow.position.y=-.016-value*.11;
    teeth.visible=value>.19;
    teeth.scale.y=.013+value*.017;
  }
  function frameUpdate(){
    if(disposed)return;
    requestAnimationFrame(frameUpdate);
    const dt=Math.min(clock.getDelta(),.07),t=clock.elapsedTime;frame++;
    if(t>nextBlink){blink();nextBlink=t+2.6+rand()*3.8}
    const blinkState=t<blinkUntil?Math.max(.07,Math.abs(Math.cos((blinkUntil-t)/.15*Math.PI))):1;
    mouthValue=THREE.MathUtils.damp(mouthValue,mouthTarget,16,dt);
    const isSmile=emotion==='alegria';
    const sad=emotion==='tristeza';
    updateMouth(mouthValue);
    mouth.scale.x=1+(isSmile?.15:0)+(sad?-.05:0);
    mouth.position.y=-.63+(isSmile?.055:0)+(sad?-.03:0);
    const impulse=emotion==='surpresa'?.09:emotion==='atencao'?-.09:0;
    for(let i=0;i<2;i++){
      const eye=eyes[i],brow=brows[i];
      eye.mesh.scale.y=blinkState*(emotion==='surpresa'?1.24:emotion==='tristeza'?.84:1);
      eye.iris.position.x=lookX*.04+Math.sin(t*.57)*.013;
      eye.iris.position.y=lookY*.025+Math.sin(t*.77+i)*.006;
      brow.mesh.position.y=impulse+(isSmile?.05:0)+(sad?-.055:0);
      brow.mesh.rotation.z=sad?brow.side*.13:isSmile?brow.side*-.07:0;
    }
    upper.rotation.y=THREE.MathUtils.damp(upper.rotation.y,manualAngle+Math.sin(t*.42)*.045,2,dt);
    upper.rotation.x=THREE.MathUtils.damp(upper.rotation.x,Math.sin(t*.6)*.021+(state==='ouvindo'?-.032:0),2,dt);
    upper.rotation.z=THREE.MathUtils.damp(upper.rotation.z,Math.sin(t*.3)*.025,2,dt);
    upper.position.y=Math.sin(t*1.0)*.024;
    halo.rotation.z=t*.011;
    key.intensity=31+Math.sin(t*1.2)*2;
    if(canvas.getClientRects().length)renderer.render(scene,camera);
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    camera.aspect=rect.width/rect.height;
    camera.position.z=rect.width/rect.height<.8?8.8:7.2;
    camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  resize();frameUpdate();
  return {setState,setEmotion,setMouth,setHead,setLook,blink,
    dispose(){disposed=true;observer.disconnect();renderer.dispose();}
  };
}
