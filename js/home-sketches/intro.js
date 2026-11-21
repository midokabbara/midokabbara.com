(function(){
  'use strict';
  const home=document.querySelector('[data-intro-sketches]');
  if(!home||typeof window.drawMidoIntro!=='function')return;
  const stage=home.querySelector('#intro-sketch-stage');
  const canvas=home.querySelector('#intro-sketch');
  const ctx=canvas.getContext('2d');
  const buttons=Array.from(home.querySelectorAll('.intro-word'));
  const status=home.querySelector('#sketch-status');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const hover=matchMedia('(hover: hover) and (pointer: fine)');
  const touch=matchMedia('(hover: none) and (pointer: coarse)');
  const introText=home.querySelector('.tree-home__about');
  const openingSeenKey='mido-sketches.product-intro.v1';
  const valuationVariant=['drivers','model'].includes(home.dataset.valuationSketch)&&typeof window.drawMidoValuationOption==='function'?home.dataset.valuationSketch:'balance';
  const strategyVariant=['choices','board'].includes(home.dataset.strategySketch)&&typeof window.drawMidoStrategyOption==='function'?home.dataset.strategySketch:'map';
  const consultingVariant=home.dataset.consultingSketch==='synthesis'&&typeof window.drawMidoConsultingOption==='function'?'synthesis':'table';
  const productVariant='cart';
  const productRenderer=window.drawMidoProductCart;
  const variants={product:productVariant,valuations:valuationVariant,strategy:strategyVariant,consulting:consultingVariant};
  const durations={product:4100,valuations:valuationVariant==='drivers'?2300:1800,strategy:1850,consulting:1700};
  const descriptions={
    product:'A little cart struggles on square wheels. The wheels become round, and the cart rolls smoothly.',
    valuations:valuationVariant==='drivers'?'A value driver tree: margin and capital efficiency feed ROIC. Growth and ROIC feed cash flow; cash flow and cost of capital feed value.':'A business valuation sketch.',
    strategy:'A strategy sketch.',
    consulting:'A consulting sketch.'
  };
  stage.setAttribute('role','img');
  let active=null,origin=null,progress=0,width=220,height=112;
  let generation=0,raf=0,endTimer=0,hoverTimer=0,leaveTimer=0;
  let openingTimer=0,openingGeneration=0,openingStarted=hasSeenOpening(),openingRunning=false;
  let textInView=false,stageInView=false;

  function hasSeenOpening(){
    try{return localStorage.getItem(openingSeenKey)==='1';}
    catch{return false;}
  }
  function rememberOpening(){
    // One small first-visit cue per browser and origin; storage is optional.
    try{localStorage.setItem(openingSeenKey,'1');}catch{}
  }
  function openingEligible(){
    return touch.matches&&!reduced.matches&&textInView&&stageInView&&document.visibilityState==='visible';
  }
  function stopOpening(consume=true){
    openingGeneration++;
    clearTimeout(openingTimer);openingTimer=0;
    openingRunning=false;
    if(consume)openingStarted=true;
    delete home.dataset.introOpening;
  }
  function queueOpening(){
    if(openingStarted||active||openingTimer)return;
    if(!openingEligible())return;
    const id=openingGeneration;
    home.dataset.introOpening='waiting';
    openingTimer=setTimeout(()=>{
      openingTimer=0;
      if(id!==openingGeneration||openingStarted||active||!openingEligible())return;
      const product=buttons.find(button=>button.dataset.introKind==='product'&&!button.disabled);
      if(!product){stopOpening();return;}
      openingStarted=true;openingRunning=true;
      rememberOpening();
      home.dataset.introOpening='playing';
      play(product,'auto');
    },1200);
  }
  function refreshOpening(){
    if(!openingEligible()){
      if(openingRunning)dismiss();
      else stopOpening(false);
    }else queueOpening();
  }

  function cancel(){
    generation++;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);clearTimeout(hoverTimer);clearTimeout(leaveTimer);
    raf=endTimer=hoverTimer=leaveTimer=0;
  }
  function paint(){
    ctx.clearRect(0,0,width,height);
    if(!active)return;
    const kind=active.dataset.introKind;
    const ink=getComputedStyle(home).color;
    if(kind==='product'&&typeof productRenderer==='function')productRenderer(ctx,progress,width,height,ink);
    else if(kind==='valuations'&&valuationVariant!=='balance')window.drawMidoValuationOption(ctx,valuationVariant,progress,width,height,ink);
    else if(kind==='strategy'&&strategyVariant!=='map')window.drawMidoStrategyOption(ctx,strategyVariant,progress,width,height,ink);
    else if(kind==='consulting'&&consultingVariant==='synthesis')window.drawMidoConsultingOption(ctx,consultingVariant,progress,width,height,ink);
    else window.drawMidoIntro(ctx,kind,progress,width,height,ink);
  }
  function size(){
    const box=canvas.getBoundingClientRect();
    if(box.width<1||box.height<1)return;
    width=box.width;height=box.height;
    const ratio=Math.min(window.devicePixelRatio||1,3);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    paint();
  }
  function clearSketch(){
    cancel();
    active=null;origin=null;
    buttons.forEach(button=>{
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed','false');
    });
    stage.classList.remove('is-visible');
    stage.setAttribute('aria-hidden','true');
    home.dataset.introAnimation='idle';
    delete home.dataset.introKind;
    delete home.dataset.introVariant;
    delete home.dataset.introHints;
  }
  function dismiss(){
    stopOpening();
    clearSketch();
  }
  function play(button,trigger){
    if(trigger!=='auto')stopOpening();
    if(touch.matches&&button.dataset.introKind==='product')rememberOpening();
    if(active===button&&trigger!=='press'&&origin!=='auto'){
      clearTimeout(hoverTimer);clearTimeout(leaveTimer);
      if(trigger==='focus'&&origin==='hover')origin='focus';
      return;
    }
    home.dispatchEvent(new CustomEvent('mido:sketch-start',{detail:{area:'intro'}}));
    cancel();
    const id=generation;
    active=button;origin=trigger;progress=0;
    if(trigger==='press'&&touch.matches)home.dataset.introHints='playing';
    else delete home.dataset.introHints;
    buttons.forEach(item=>{
      item.classList.toggle('is-active',item===button);
      item.setAttribute('aria-pressed',item===button?'true':'false');
    });
    home.dataset.introKind=button.dataset.introKind;
    home.dataset.introVariant=variants[button.dataset.introKind];
    // Preserve the last stage size through its fade; choose the next size only
    // when starting another sketch, so the wider tree never collapses on exit.
    stage.dataset.variant=variants[button.dataset.introKind];
    stage.setAttribute('aria-label',descriptions[button.dataset.introKind]);
    if(trigger!=='auto')status.textContent=button.textContent+' sketch.';
    size();
    stage.classList.add('is-visible');
    stage.setAttribute('aria-hidden','false');
    if(trigger!=='press'&&reduced.matches){
      progress=1;paint();home.dataset.introAnimation='still';return;
    }
    home.dataset.introAnimation='drawing';
    let started=null;
    function frame(now){
      if(id!==generation)return;
      if(started===null)started=now;
      progress=Math.min(1,(now-started)/durations[button.dataset.introKind]);
      paint();
      if(progress<1)raf=requestAnimationFrame(frame);
      else{
        raf=0;home.dataset.introAnimation='complete';
        if(origin==='press')endTimer=setTimeout(()=>{if(id===generation)dismiss();},1500);
        else if(origin==='auto')endTimer=setTimeout(()=>{if(id===generation)dismiss();},1500);
      }
    }
    raf=requestAnimationFrame(frame);
  }
  home.addEventListener('mido:sketch-start',event=>{
    if(event.detail?.area==='menu')dismiss();
  });
  buttons.forEach(button=>{
    if(button.dataset.introKind==='product'&&typeof productRenderer!=='function')return;
    button.addEventListener('click',()=>play(button,'press'));
    button.addEventListener('pointerenter',event=>{
      if(event.pointerType!=='mouse'||!hover.matches)return;
      clearTimeout(hoverTimer);clearTimeout(leaveTimer);
      hoverTimer=setTimeout(()=>play(button,'hover'),120);
    });
    button.addEventListener('pointerleave',event=>{
      if(event.pointerType!=='mouse')return;
      clearTimeout(hoverTimer);
      if(active&&origin==='hover')leaveTimer=setTimeout(dismiss,100);
    });
    button.addEventListener('focus',()=>{
      if(button.matches(':focus-visible'))play(button,'focus');
    });
    button.addEventListener('blur',()=>{
      if(active===button&&origin==='focus')dismiss();
    });
    button.disabled=false;
  });
  document.addEventListener('pointerdown',event=>{
    // User interaction wins even during the opening delay.
    stopOpening();
    if(origin==='auto'||(active&&!buttons.some(button=>button.contains(event.target))))clearSketch();
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')dismiss();
    else{
      // Keyboard input also consumes this page's cue before visibility has
      // become eligible or its delay has been queued.
      stopOpening();
      if(origin==='auto')clearSketch();
    }
  });
  const observer=new ResizeObserver(size);
  observer.observe(stage);
  if(document.fonts)document.fonts.ready.then(size);
  home.dataset.introAnimation='idle';
  size();
  if(introText){
    const openingObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const inView=entry.isIntersecting&&entry.intersectionRatio>=.9;
        if(entry.target===introText)textInView=inView;
        else if(entry.target===stage)stageInView=inView;
      });
      refreshOpening();
    },{threshold:[0,.9]});
    openingObserver.observe(introText);
    openingObserver.observe(stage);
    document.addEventListener('visibilitychange',refreshOpening);
    touch.addEventListener('change',refreshOpening);
    reduced.addEventListener('change',refreshOpening);
  }
})();
