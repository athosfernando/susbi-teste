import {createSUSBIFallback} from './fallback.js';
const $=id=>document.getElementById(id);
const help=$('help'),speech=$('transcript'),status=$('statusLabel'),avatarState=$('avatarState');
const bars=[...$('meter').children];
let avatar=null,referenceAvatar=null,threeAvatar=null,renderMode='reference',state='repouso';
let emotion='neutra',recognition=null,listenToken=0,utterance=null;
let originalAudio=null,audioCtx=null,audioAnalyser=null,audioData=null;
let isOriginalAudio=false,voiceTTS=false,startedSpeaking=0,manualMouth=0;

const labels={repouso:'Em repouso',preparando:'Preparando microfone',ouvindo:'Ouvindo',falando:'Falando',processando:'Processando'};
const setSpeech=text=>{speech.textContent=text};
function stateChange(next){
  state=next;
  status.textContent=labels[next]||next;
  avatarState.textContent=(labels[next]||next).toUpperCase();
  avatar?.setState(next);
  if(next!=='falando')avatar?.setMouth(0);
}
function stopAll(){
  if(typeof limparTimerEscuta==='function')limparTimerEscuta();
  listenToken++;voiceTTS=false;isOriginalAudio=false;
  if(recognition){try{recognition.abort()}catch{}recognition=null;}
  if(originalAudio){originalAudio.pause();originalAudio.currentTime=0;}
  if(window.speechSynthesis)window.speechSynthesis.cancel();
  utterance=null;avatar?.setMouth(0);stateChange('repouso');
}
function view(target){
  if(target==='3d'&&!threeAvatar){help.textContent='O motor 3D ainda não está disponível. O rosto original continua acessível.';return;}
  renderMode=target;
  const three=target==='3d';
  $('canvas3d').style.display=three?'block':'none';
  $('canvasFallback').style.display=three?'none':'block';
  avatar=three?threeAvatar:referenceAvatar;
  avatar?.setEmotion(emotion);
  avatar?.setHead(Number($('headTurn').value));
  avatar?.setState(state);
  $('show3d').classList.toggle('primary',three);
  $('showReference').classList.toggle('primary',!three);
  $('renderMode').textContent=three?'Modelo 3D experimental · Three.js':'Imagem oficial · simulação 2D';
  $('renderNote').textContent=three
    ?'Modelo 3D provisório. As malhas dos olhos, da cabeça e da boca são animáveis, mas a fisionomia ainda não reproduz exatamente a referência oficial.'
    :'Retrato original da SUSBI com alguns efeitos demonstrativos. O modo 2D preserva sua imagem, mas não é um modelo 3D nem possui movimentos faciais completos.';
}
async function init(){
  referenceAvatar=createSUSBIFallback($('canvasFallback'),'assets/referencia-oficial.jpg');
  view('reference');stateChange('repouso');
  // Importação pública não envia áudio, imagens ou dados do usuário ao provedor;
  // a biblioteca é apenas código de renderização 3D. No modo offline há 2D local.
  const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('Sem conexão com a biblioteca 3D')),8500));
  try{
    const THREE=await Promise.race([import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js'),timeout]);
    const {createSUSBI3D}=await import('./avatar3d.js');
    threeAvatar=createSUSBI3D(THREE,$('canvas3d'));
    view('3d');
    help.textContent='Motor 3D carregado. Clique em “Rosto oficial” para comparar a fisionomia com sua referência.';
  }catch(err){
    $('show3d').disabled=true;
    help.textContent='Renderização 3D indisponível neste ambiente; a foto oficial segue disponível. Para usar o modo 3D, abra em HTTPS com acesso ao Three.js.';
    console.warn('Three.js:',err);
  }
}
function preferVoice(){
  const voices=window.speechSynthesis?.getVoices()||[];
  const ptBR=voices.filter(v=>v.lang?.toLowerCase()==='pt-br');
  return ptBR.find(v=>/female|maria|francisca|luciana|gabriela/i.test(v.name))||ptBR[0]||voices.find(v=>v.lang?.startsWith('pt'))||null;
}
function speakText(text){
  stopAll();setSpeech(text);
  if(!('speechSynthesis' in window)){help.textContent='Síntese de voz não disponível neste navegador.';return}
  const s=new SpeechSynthesisUtterance(text);utterance=s;s.lang='pt-BR';s.rate=.95;s.pitch=1.04;
  const selected=preferVoice();if(selected)s.voice=selected;
  s.onstart=()=>{if(utterance!==s)return;voiceTTS=true;startedSpeaking=performance.now();stateChange('falando')};
  s.onend=()=>{if(utterance!==s)return;voiceTTS=false;avatar?.setMouth(0);stateChange('repouso')};
  s.onerror=e=>{if(utterance!==s)return;voiceTTS=false;avatar?.setMouth(0);stateChange('repouso');help.textContent='Voz indisponível: '+e.error};
  window.speechSynthesis.speak(s);
  help.textContent='Respostas novas usam a voz do navegador e movimento labial aproximado. A voz feminina escolhida está em “Voz original”.';
}
async function playOriginal(){
  stopAll();
  if(!originalAudio){originalAudio=new Audio('assets/voz-apresentacao.mp3');originalAudio.preload='auto';}
  try{
    if(!audioCtx){
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      const src=audioCtx.createMediaElementSource(originalAudio);
      audioAnalyser=audioCtx.createAnalyser();audioAnalyser.fftSize=1024;
      src.connect(audioAnalyser);audioAnalyser.connect(audioCtx.destination);
      audioData=new Uint8Array(audioAnalyser.fftSize);
    }
    await audioCtx.resume();
    originalAudio.onended=()=>{isOriginalAudio=false;avatar?.setMouth(0);stateChange('repouso')};
    originalAudio.onerror=()=>{isOriginalAudio=false;stateChange('repouso');help.textContent='Não foi possível abrir o MP3 na pasta assets.'};
    await originalAudio.play();
    isOriginalAudio=true;stateChange('falando');
    setSpeech('Apresentação narrada pela voz feminina escolhida para a SUSBI. A boca segue a intensidade real da gravação, ainda sem sincronização fonética.');
    help.textContent='Esta fala usa seu MP3 original. A animação é impulsionada pela intensidade do áudio, não por fonemas.';
  }catch(e){isOriginalAudio=false;stateChange('repouso');help.textContent='Falha na reprodução: '+e.message}
}
// Monitor de escuta: nunca indicar captação antes do evento audiostart.
// Três proteções: permissão, tempo máximo de silêncio e recuperação de erros.
let escutaTimer=null;
function limparTimerEscuta(){
  if(escutaTimer!==null){clearTimeout(escutaTimer);escutaTimer=null;}
}
function respostaDoTeste(frase){
  // Demonstração LOCAL (sem Claude): reconhecer uma pergunta sobre escuta
  // dá um retorno natural, sem fingir que há uma IA conectada.
  const normalizado=frase.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/(esta|ta|consegue|pode|podia).{0,28}(me |nos )?(ouvindo|ouvir|escutar)/.test(normalizado)
      || /voce me ouve/.test(normalizado)){
    return 'Sim, estou ouvindo você. O reconhecimento de voz está funcionando.';
  }
  return 'Eu ouvi você dizer: '+frase+'. Este ainda é um teste de reconhecimento de voz da SUSBI, sem conexão com a inteligência artificial.';
}
function listen(){
  stopAll();
  limparTimerEscuta();
  if(!window.isSecureContext){
    help.textContent='O microfone exige HTTPS ou localhost. Abra a SUSBI pelo endereço publicado no GitHub Pages.';
    setSpeech('Permissão de microfone indisponível: acesso sem HTTPS.');
    return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    help.textContent='Este navegador não oferece reconhecimento de voz. Utilize o Chrome atualizado e verifique as permissões de microfone.';
    setSpeech('Reconhecimento de voz não disponível.');
    return;
  }
  const token=++listenToken;
  const r=new SR();recognition=r;
  r.lang='pt-BR';r.interimResults=false;r.continuous=false;r.maxAlternatives=1;
  let captando=false,resultado=false,erro=false;
  const ativo=()=>token===listenToken;
  const encerrarSemFala=(texto)=>{
    if(!ativo()||resultado||erro)return;
    erro=true;limparTimerEscuta();recognition=null;
    try{r.abort()}catch{}
    avatar?.setMouth(0);stateChange('repouso');
    setSpeech(texto);
    help.textContent='Toque novamente em “Ouvir”, aguarde a confirmação e fale perto do microfone.';
  };
  const aguardarFala=()=>{
    limparTimerEscuta();
    escutaTimer=setTimeout(()=>encerrarSemFala('Não identifiquei nenhuma frase em 15 segundos. Tente novamente.'),15000);
  };
  r.onstart=()=>{
    if(!ativo())return;
    stateChange('preparando');
    setSpeech('Reconhecimento iniciado. Aguardando acesso ao áudio do microfone...');
    help.textContent='O estado “Ouvindo” aparecerá quando o navegador confirmar a captação do microfone.';
    aguardarFala();
  };
  r.onaudiostart=()=>{
    if(!ativo())return;
    captando=true;stateChange('ouvindo');
    setSpeech('Estou ouvindo. Pode falar agora.');
    help.textContent='Microfone ativo: fale uma frase. A boca da SUSBI permanece fechada enquanto ela escuta.';
    aguardarFala();
  };
  r.onspeechstart=()=>{
    if(!ativo())return;
    captando=true;stateChange('ouvindo');
    setSpeech('Estou ouvindo sua voz. Pode continuar...');
    help.textContent='Voz detectada. Aguardando o reconhecimento da frase completa.';
    aguardarFala();
  };
  r.onresult=e=>{
    if(!ativo()||resultado||erro)return;
    const frase=e.results?.[0]?.[0]?.transcript?.trim()||'';
    if(!frase){encerrarSemFala('O microfone funcionou, mas não consegui entender a frase.');return;}
    resultado=true;limparTimerEscuta();recognition=null;
    stateChange('processando');
    setSpeech('Você disse: “'+frase+'”');
    help.textContent='Reconhecimento concluído. Preparando a resposta de teste da SUSBI...';
    setTimeout(()=>{
      if(!ativo())return;
      speakText(respostaDoTeste(frase));
    },280);
  };
  r.onnomatch=()=>encerrarSemFala('Eu ouvi um som, mas não consegui reconhecer as palavras.');
  r.onerror=e=>{
    if(!ativo()||resultado||erro)return;
    erro=true;limparTimerEscuta();recognition=null;
    stateChange('repouso');avatar?.setMouth(0);
    const mensagens={
      'not-allowed':'Microfone bloqueado. No Chrome, toque no ícone à esquerda do endereço, abra Permissões e autorize Microfone.',
      'service-not-allowed':'O serviço de reconhecimento de voz está bloqueado pelo navegador ou dispositivo.',
      'audio-capture':'Não encontrei áudio do microfone. Confira se outro aplicativo está usando o microfone.',
      'no-speech':'O microfone abriu, mas não detectou uma frase. Tente falar um pouco mais perto.',
      'network':'Falha de conexão com o serviço de reconhecimento de voz do navegador. Confira sua internet.',
      'language-not-supported':'O reconhecimento de voz em português não está disponível neste navegador.',
      'aborted':'A escuta foi interrompida.'
    };
    const explicacao=mensagens[e.error]||('Ocorreu um erro no reconhecimento: '+e.error+'.');
    setSpeech(explicacao);
    help.textContent='Estado da escuta: '+(captando?'o microfone chegou a captar áudio.':'o navegador não confirmou a captação do microfone.')+' Tente novamente após verificar a mensagem.';
  };
  r.onend=()=>{
    if(!ativo())return;
    limparTimerEscuta();
    if(recognition===r)recognition=null;
    if(resultado||erro)return;
    stateChange('repouso');avatar?.setMouth(0);
    setSpeech(captando?'A escuta terminou sem identificar uma frase completa.':'O navegador encerrou a escuta antes de confirmar acesso ao microfone.');
    help.textContent='Toque em “Ouvir” para tentar novamente. Se persistir, confira a permissão do microfone no navegador.';
  };
  try{
    stateChange('preparando');
    setSpeech('Solicitando acesso ao microfone...');
    help.textContent='Se aparecer o pedido de permissão do navegador, escolha “Permitir”.';
    aguardarFala();
    r.start();
  }catch(e){
    limparTimerEscuta();recognition=null;stateChange('repouso');
    setSpeech('Não consegui iniciar o reconhecimento de voz.');
    help.textContent='Falha ao iniciar microfone: '+e.message;
  }
}
$('show3d').addEventListener('click',()=>view('3d'));
$('showReference').addEventListener('click',()=>view('reference'));
$('listen').addEventListener('click',listen);
$('speak').addEventListener('click',()=>speakText('Olá! Eu sou a Susbi. Estou aqui para ajudar você. Este é meu laboratório de avatar interativo, sem vídeo repetindo.'));
$('present').addEventListener('click',playOriginal);
$('stop').addEventListener('click',()=>{stopAll();setSpeech('SUSBI aguardando.')});
$('emotion').addEventListener('change',e=>{emotion=e.target.value;avatar?.setEmotion(emotion)});
$('headTurn').addEventListener('input',e=>{$('headValue').textContent=e.target.value+'°';avatar?.setHead(Number(e.target.value))});
$('manualMode').addEventListener('change',e=>{
  $('mouthTest').disabled=!e.target.checked;
  if(!e.target.checked){manualMouth=0;$('mouthTest').value=0;$('mouthValue').textContent='0%';if(state!=='falando')avatar?.setMouth(0)}
});
$('mouthTest').disabled=true;
$('mouthTest').addEventListener('input',e=>{
  manualMouth=Number(e.target.value)/100;$('mouthValue').textContent=e.target.value+'%';
  if($('manualMode').checked&&state==='repouso')avatar?.setMouth(manualMouth);
});
$('blink').addEventListener('click',()=>avatar?.blink());
$('reset').addEventListener('click',()=>{
  stopAll();emotion='neutra';$('emotion').value=emotion;avatar?.setEmotion(emotion);
  $('headTurn').value=0;$('headValue').textContent='0°';avatar?.setHead(0);
  $('manualMode').checked=false;$('mouthTest').disabled=true;
  $('mouthTest').value=0;$('mouthValue').textContent='0%';manualMouth=0;
  avatar?.setMouth(0);setSpeech('Controles restaurados.')
});
$('stage').addEventListener('pointermove',e=>{
  if(renderMode!=='3d')return;
  const b=$('stage').getBoundingClientRect();
  avatar?.setLook(((e.clientX-b.left)/b.width-.5)*1.8,(.5-(e.clientY-b.top)/b.height)*1.3);
});
$('stage').addEventListener('pointerleave',()=>avatar?.setLook(0,0));
// A boca anima somente durante áudio. Na voz do navegador o movimento
// é aproximado; no arquivo original o nível vem de Web Audio em tempo real.
let lastFrame=0;
function pulse(){
  requestAnimationFrame(pulse);const now=performance.now();if(now-lastFrame<35)return;lastFrame=now;
  let volume=0;
  if(isOriginalAudio&&originalAudio&&!originalAudio.paused&&audioAnalyser){
    audioAnalyser.getByteTimeDomainData(audioData);
    let sum=0;for(let i=0;i<audioData.length;i++){let x=(audioData[i]-128)/128;sum+=x*x;}
    const rms=Math.sqrt(sum/audioData.length);
    volume=rms<.015?0:Math.min(1,(rms-.015)*8);
    avatar?.setMouth(volume);
  }else if(voiceTTS){
    const sec=(now-startedSpeaking)/1000;
    volume=Math.min(1,.1+.61*Math.abs(Math.sin(sec*11))+.13*Math.abs(Math.sin(sec*17)));
    avatar?.setMouth(volume);
  }else if(state==='repouso'){
    avatar?.setMouth($('manualMode').checked?manualMouth:0);
  }else avatar?.setMouth(0);
  for(let i=0;i<bars.length;i++){
    const h=4+Math.max(0,volume)*10*(.65+.35*Math.abs(Math.sin(now*.013+i)));
    bars[i].style.height=Math.round(h)+'px';
  }
}
init().catch(e=>{help.textContent='Erro de inicialização: '+e.message});
pulse();
