// Referência interativa 2D de compatibilidade, utilizada quando a biblioteca 3D
// não puder ser carregada. Não é um vídeo nem substitui o rig facial 3D.
export function createSUSBIFallback(canvas,src){
  const ctx=canvas.getContext('2d');
  const img=new Image();img.src=src;
  let state='repouso',mouth=0,manual=0,head=0,emotion='neutra',blinkUntil=0,ready=false,ended=false;
  img.onload=()=>{ready=true;draw(performance.now())};
  let nextBlink=performance.now()+2800;
  function draw(now){
    if(ended)return;
    if(!canvas.getClientRects().length){requestAnimationFrame(draw);return}
    const rect=canvas.getBoundingClientRect();
    const scale=Math.min(2,window.devicePixelRatio||1);
    const w=Math.max(1,Math.round(rect.width*scale)),h=Math.max(1,Math.round(rect.height*scale));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#030e1a';ctx.fillRect(0,0,w,h);
    if(ready){
      // Fotografia original do usuário, sem alternância de quadros.
      const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;
      const left=(w-dw)/2,top=(h-dh)/2;
      ctx.save();ctx.translate(w/2,h/2);ctx.rotate(head*Math.PI/180*.15);ctx.translate(-w/2,-h/2);
      ctx.drawImage(img,left,top,dw,dh);
      const px=(x)=>left+x*s,py=(y)=>top+y*s;
      if(now>nextBlink){blinkUntil=now+150;nextBlink=now+2800+Math.random()*2800}
      if(now<blinkUntil){
        const factor=Math.sin((now-(blinkUntil-150))/150*Math.PI);
        const eyes=[[155,470,62],[390,434,58]];
        for(const [x,y,r] of eyes){
          ctx.fillStyle=`rgba(2,14,30,${.75*factor})`;
          ctx.beginPath();ctx.ellipse(px(x),py(y),r*s,Math.max(1,11*factor*s),0,0,2*Math.PI);ctx.fill();
          ctx.strokeStyle=`rgba(122,232,255,${.48*factor})`;ctx.lineWidth=1.4*s;
          ctx.beginPath();ctx.moveTo(px(x-r),py(y));ctx.quadraticCurveTo(px(x),py(y+7),px(x+r),py(y));ctx.stroke();
        }
      }
      if(mouth>.06){
        const y=673+(emotion==='alegria'?-10:0),x=268;
        // Sobreposição sobre o rosto correto, sem alterar a identidade geral.
        ctx.fillStyle='rgba(0,3,14,.96)';ctx.beginPath();ctx.ellipse(px(x),py(y),62*s,(2+mouth*30)*s,-.03,0,2*Math.PI);ctx.fill();
        ctx.strokeStyle='rgba(99,211,250,.78)';ctx.lineWidth=2*s;
        ctx.stroke();
      }
      ctx.restore();
    }else{ctx.fillStyle='#a2d8eb';ctx.font=`${16*scale}px sans-serif`;ctx.textAlign='center';ctx.fillText('Carregando o rosto oficial...',w/2,h/2)}
    requestAnimationFrame(draw);
  }
  // Mesmo contrato do motor 3D para integração futura.
  return {
    setState(v){state=v;if(v!=='falando')mouth=0},
    setEmotion(v){emotion=v},
    setMouth(v){mouth=Math.max(0,Math.min(1,Number(v)||0))},
    setHead(v){head=Number(v)||0},
    setLook(){},blink(){blinkUntil=performance.now()+170},
    dispose(){ended=true}
  };
}
