// Run with node tests/home-sketches-controller.cjs. No dependencies.
// Tests the actual controller with a deterministic clock and minimal DOM adapters.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/home-sketches/intro.js'),'utf8');
function setup({touch=false,reduced=false,seen=false,blocked=false}={}){
 let time=0,id=0,timers=new Map(),ios=[],stored=seen?'1':null,draws=[];
 const later=(fn,delay=0)=>{timers.set(++id,{fn,at:time+delay});return id};
 const tick=ms=>{const end=time+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;timers.delete(next[0]);next[1].fn(time)}time=end};
 class E{constructor(){this.dataset={};this.attrs={};this.events={};this.disabled=false;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,v)=>v?this.classes.add(x):this.classes.delete(x)};}
 addEventListener(t,f){(this.events[t]??=[]).push(f)}dispatchEvent(e){for(const f of this.events[e.type]||[])f(e)}setAttribute(k,v){this.attrs[k]=v}getBoundingClientRect(){return{width:220,height:112}}contains(e){return e===this}matches(){return false}}
 const root=new E(),stage=new E(),canvas=new E(),about=new E(),status=new E(),doc=new E();
 canvas.getContext=()=>({clearRect(){},setTransform(){}});root.dataset={valuationSketch:'drivers',strategySketch:'board',consultingSketch:'synthesis'};
 const buttons=['product','valuations','strategy','consulting'].map(k=>{const e=new E();e.dataset.introKind=k;e.textContent=k;return e});
 root.querySelector=s=>({'#intro-sketch-stage':stage,'#intro-sketch':canvas,'#sketch-status':status,'.tree-home__about':about})[s];root.querySelectorAll=()=>buttons;doc.querySelector=()=>root;doc.visibilityState='visible';
 const context={document:doc,window:{devicePixelRatio:1},matchMedia:q=>({matches:q.includes('prefers-reduced')?reduced:q.includes('hover: none')?touch:!touch,addEventListener(){}}),localStorage:{getItem(){if(blocked)throw Error();return stored},setItem(k,v){if(blocked)throw Error();stored=v}},getComputedStyle:()=>({color:'#111'}),setTimeout:later,clearTimeout:i=>timers.delete(i),requestAnimationFrame:f=>later(f,16),cancelAnimationFrame:i=>timers.delete(i),ResizeObserver:class{observe(){}},IntersectionObserver:class{constructor(f){ios.push(f)}observe(){}},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}}};
 for(const name of ['drawMidoIntro','drawMidoProductCart','drawMidoValuationOption','drawMidoStrategyOption','drawMidoConsultingOption'])context.window[name]=(...a)=>draws.push(name);
 vm.runInNewContext(source,context);
 return{root,buttons,doc,tick,stored:()=>stored,visible:()=>ios[0]([{target:about,isIntersecting:true,intersectionRatio:1},{target:stage,isIntersecting:true,intersectionRatio:1}])};
}
let s=setup();s.visible();s.buttons[2].dispatchEvent({type:'pointerenter',pointerType:'mouse'});s.tick(121);assert.equal(s.root.dataset.introKind,'strategy');s.buttons[2].dispatchEvent({type:'pointerleave',pointerType:'mouse'});s.tick(101);assert.equal(s.root.dataset.introAnimation,'idle');console.log('PASS: actual controller hover enter/leave timers');
s=setup({touch:true});s.visible();s.tick(1200);assert.equal(s.root.dataset.introKind,'product');assert.equal(s.stored(),'1');s.tick(5700);assert.equal(s.root.dataset.introAnimation,'idle');console.log('PASS: mobile opening complete and dismissal');
s=setup({touch:true});s.doc.dispatchEvent({type:'keydown',key:'Tab'});s.visible();s.tick(1300);assert.equal(s.root.dataset.introAnimation,'idle','Keyboard input before visibility must cancel autoplay');console.log('PASS: early keyboard cancels autoplay');

s=setup({touch:true,seen:true});s.visible();s.tick(8000);assert.equal(s.root.dataset.introAnimation,'idle');
s=setup({touch:true,reduced:true});s.visible();s.tick(2000);assert.equal(s.root.dataset.introAnimation,'idle');s.buttons[0].dispatchEvent({type:'click'});assert.equal(s.root.dataset.introAnimation,'drawing');
s=setup({reduced:true});s.buttons[1].dispatchEvent({type:'pointerenter',pointerType:'mouse'});s.tick(121);assert.equal(s.root.dataset.introAnimation,'still');
s=setup({touch:true,blocked:true});s.visible();s.tick(1200);assert.equal(s.root.dataset.introKind,'product');s.doc.dispatchEvent({type:'pointerdown',target:s.doc});s.buttons[2].dispatchEvent({type:'click'});s.tick(200);assert.equal(s.root.dataset.introKind,'strategy');s.tick(8000);assert.equal(s.root.dataset.introAnimation,'idle');
console.log('PASS: seen flag, reduced motion, blocked storage and manual takeover');

// Focus ownership must survive pointer exit and dismiss only on blur/Escape.
for (const kind of ['product','valuations','strategy','consulting']) {
 s=setup();
 const button=s.buttons.find(button=>button.dataset.introKind===kind);
 button.matches=selector=>selector===':focus-visible';
 button.dispatchEvent({type:'focus'});
 assert.equal(s.root.dataset.introKind,kind);
 button.dispatchEvent({type:'pointerleave',pointerType:'mouse'});s.tick(200);
 assert.equal(s.root.dataset.introKind,kind,'Pointer exit must preserve keyboard focus preview');
 button.dispatchEvent({type:'blur'});
 assert.equal(s.root.dataset.introAnimation,'idle');
 button.dispatchEvent({type:'focus'});
 s.doc.dispatchEvent({type:'keydown',key:'Escape'});
 assert.equal(s.root.dataset.introAnimation,'idle');
}
console.log('PASS: keyboard-focus controller previews, ownership, blur and Escape for all four intro controls');
