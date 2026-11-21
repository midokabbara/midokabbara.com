(function(){
  'use strict';
  const home=document.querySelector('[data-intro-sketches]');
  if(!home)return;
  const colored=home.dataset.sketchStyle==='pencil';
  const coordinated=home.hasAttribute('data-intro-sketches');
  const menu=document.querySelector('.menu-area');
  const stage=document.getElementById('sketch-stage');
  const canvas=document.getElementById('sketch');
  const ctx=canvas.getContext('2d');
  const rows=Array.from(document.querySelectorAll('.row'));
  const status=document.getElementById('sketch-status');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const hover=matchMedia('(hover: hover) and (pointer: fine)');
  const source=document.createElement('canvas');
  source.width=780;source.height=540;
  const sourceCtx=source.getContext('2d');
  sourceCtx.setTransform(3,0,0,3,0,0);
  const crops={build:[48,49,168,109],think:[48,23,164,135],path:[42,25,179,133]};
  const durations={build:1450,think:1700,path:1550};
  let active=null,origin=null,progress=0,width=200,height=104;
  let generation=0,raf=0,endTimer=0,leaveTimer=0;
  let lastTouch=0;
  const textMotion={outStep:28,outDuration:160,inStep:32,inDuration:280,rowStep:36,sketchFade:180};
  prepareDescriptions();

  function prepareDescriptions(){
    menu.style.setProperty('--letter-out-duration',textMotion.outDuration+'ms');
    menu.style.setProperty('--letter-in-duration',textMotion.inDuration+'ms');
    menu.style.setProperty('--sketch-fade-duration',textMotion.sketchFade+'ms');
    rows.forEach((row,rowIndex)=>{
      const description=row.querySelector('.description');
      const text=description.textContent;
      const accessible=document.createElement('span');
      accessible.className='sr-only';
      accessible.textContent=text;
      const visual=document.createElement('span');
      visual.setAttribute('aria-hidden','true');
      const characters=Array.from(text);
      characters.forEach((character,index)=>{
        const letter=document.createElement('span');
        const outDelay=(characters.length-1-index)*textMotion.outStep+rowIndex*textMotion.rowStep;
        const inDelay=index*textMotion.inStep+rowIndex*textMotion.rowStep;
        letter.className='description-letter';
        letter.textContent=character;
        letter.style.setProperty('--letter-out-delay',outDelay+'ms');
        letter.style.setProperty('--letter-in-delay',inDelay+'ms');
        visual.append(letter);
      });
      // Keep an intact reading copy; only the decorative letters animate.
      description.replaceChildren(accessible,visual);
    });
  }
  function hideDescriptions(){
    menu.classList.add('has-sketch');
    if(reduced.matches)return Promise.resolve();
    // Wait for the rendered letters, including any interrupted return transition.
    // A switch or replay reuses the transitions already in flight.
    const exits=menu.getAnimations({subtree:true}).filter(animation=>
      animation.effect?.target?.classList.contains('description-letter'));
    return Promise.allSettled(exits.map(animation=>animation.finished));
  }

  function cancel(){
    generation++;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);clearTimeout(leaveTimer);
    raf=endTimer=leaveTimer=0;
  }
  function paint(){
    ctx.clearRect(0,0,width,height);
    if(!active)return;
    const kind=active.dataset.kind;
    const ink=getComputedStyle(home).color;
    window.drawMidoRefined(sourceCtx,kind,progress,260,180,ink,false,colored);
    const [x,y,w,h]=crops[kind];
    const scale=Math.min(width/w,height/h);
    const dw=w*scale,dh=h*scale;
    ctx.drawImage(source,x*3,y*3,w*3,h*3,(width-dw)/2,(height-dh)/2,dw,dh);
  }
  function size(){
    const left=Math.max(...rows.map(row=>row.querySelector('.trigger').getBoundingClientRect().width));
    menu.style.setProperty('--trigger-width',left+'px');
    const box=canvas.getBoundingClientRect();
    if(box.width<1||box.height<1)return;
    width=box.width;height=box.height;
    const ratio=Math.min(window.devicePixelRatio||1,3);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    paint();
  }
  function clearSelection(){
    rows.forEach(row=>{
      row.classList.remove('is-active');
      row.querySelector('.branch').setAttribute('aria-pressed','false');
    });
  }
  function dismiss(){
    cancel();
    active=null;origin=null;
    clearSelection();
    stage.classList.remove('is-visible');
    stage.setAttribute('aria-hidden','true');
    menu.classList.remove('has-sketch');
    home.dataset.animation='idle';
  }
  function play(row,trigger){
    if(active===row&&trigger!=='press'){
      clearTimeout(leaveTimer);
      if(trigger==='focus'&&origin==='hover')origin='focus';
      return;
    }
    if(coordinated)home.dispatchEvent(new CustomEvent('mido:sketch-start',{detail:{area:'menu',trigger}}));
    cancel();
    const id=generation;
    active=row;origin=trigger;
    clearSelection();
    row.classList.add('is-active');
    row.querySelector('.branch').setAttribute('aria-pressed','true');
    const textExit=hideDescriptions();
    stage.classList.remove('is-visible');
    stage.setAttribute('aria-hidden','false');
    progress=0;
    size();
    home.dataset.animation='starting';
    const kind=row.dataset.kind;
    stage.setAttribute('role','img');
    stage.setAttribute('aria-label',({build:'An architectural assembly with a fixed base, supports, and a seated upper panel.',think:'A branching tree grows and leaves emerge.',path:'A winding trail through a sparse landscape.'})[kind]);
    status.textContent=kind+' sketch.';
    const animate=trigger==='press'||!reduced.matches;
    // A branch button is an explicit Play action; passive hover respects reduced motion.
    textExit.then(()=>{
      if(id!==generation)return;
      stage.classList.add('is-visible');
      if(!animate){progress=1;paint();home.dataset.animation='still';return;}
      home.dataset.animation='drawing';
      let started=null;
      function frame(now){
        if(id!==generation)return;
        if(started===null)started=now;
        progress=Math.min(1,(now-started)/durations[kind]);
        paint();
        if(progress<1)raf=requestAnimationFrame(frame);
        else{
          raf=0;home.dataset.animation='complete';
          if(origin==='press')endTimer=setTimeout(()=>{if(id===generation)dismiss();},colored?1500:750);
        }
      }
      raf=requestAnimationFrame(frame);
    });
  }
  if(coordinated){
    home.addEventListener('mido:sketch-start',event=>{
      if(event.detail?.area==='intro')dismiss();
    });
  }
  rows.forEach(row=>{
    const trigger=row.querySelector('.trigger');
    const button=row.querySelector('.branch');
    const link=row.querySelector('.section-link');
    button.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')lastTouch=Date.now();},{passive:true});
    button.addEventListener('click',()=>play(row,'press'));
    trigger.addEventListener('mouseenter',()=>{
      if(hover.matches&&Date.now()-lastTouch>800)play(row,'hover');
    });
    trigger.addEventListener('mouseleave',()=>{
      if(active===row&&origin==='hover')leaveTimer=setTimeout(dismiss,100);
    });
    trigger.addEventListener('focusin',event=>{
      if(event.target.matches(':focus-visible'))play(row,'focus');
    });
    trigger.addEventListener('focusout',event=>{
      if(!trigger.contains(event.relatedTarget)&&active===row&&origin==='focus')dismiss();
    });
    link.addEventListener('click',dismiss);
    button.disabled=false;
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')dismiss();});
  document.addEventListener('pointerdown',event=>{
    if(!menu.contains(event.target)&&active)dismiss();
  },{passive:true});
  const observer=new ResizeObserver(size);
  observer.observe(menu);
  observer.observe(stage);
  if(document.fonts)document.fonts.ready.then(size);
  home.dataset.animation='idle';
  home.classList.add('ready');
  size();
})();
