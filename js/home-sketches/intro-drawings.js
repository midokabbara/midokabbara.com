(function () {
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n));
  const phase=(p,a,b)=>clamp((p-a)/(b-a));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const settle=t=>1-Math.pow(1-clamp(t),3);
  const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
  const curve=(a,b,c,d,n=36)=>Array.from({length:n+1},(_,i)=>{const t=i/n,u=1-t;return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]];});
  const segment=(a,b)=>Array.from({length:13},(_,i)=>[lerp(a[0],b[0],i/12),lerp(a[1],b[1],i/12)]);
  const chain=(...parts)=>parts.flatMap((a,i)=>i?a.slice(1):a);
  const polygon=pts=>chain(...pts.slice(1).map((q,i)=>segment(pts[i],q)));

  // Ink is a pressure-shaped ribbon along deliberately authored contours.
  // The geometry is never perturbed, and there is no universal double outline.
  function pen(ctx,pts,amount=1,width=1,alpha=.85,pressure=.7) {
    if(amount<=0||pts.length<2)return;
    amount=clamp(amount);
    const dist=[0];
    for(let i=1;i<pts.length;i++)dist[i]=dist[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
    const total=dist.at(-1),target=total*amount,visible=[pts[0]],fractions=[0];
    if(!total)return;
    for(let i=1;i<pts.length;i++){
      if(dist[i]<=target){visible.push(pts[i]);fractions.push(dist[i]/total);}
      else {const t=(target-dist[i-1])/(dist[i]-dist[i-1]);visible.push([lerp(pts[i-1][0],pts[i][0],t),lerp(pts[i-1][1],pts[i][1],t)]);fractions.push(target/total);break;}
    }
    const left=[],right=[];
    for(let i=0;i<visible.length;i++){
      const prev=visible[Math.max(0,i-1)],next=visible[Math.min(visible.length-1,i+1)];
      const dx=next[0]-prev[0],dy=next[1]-prev[1],length=Math.hypot(dx,dy)||1,t=fractions[i];
      const enter=Math.min(1,.3+t*8),exit=amount===1?Math.min(1,.22+(1-t)*9):1;
      const force=(1-pressure*.15)+pressure*.15*Math.sin(Math.PI*t);
      const half=width*.5*enter*exit*force;
      left.push([visible[i][0]-dy/length*half,visible[i][1]+dx/length*half]);
      right.push([visible[i][0]+dy/length*half,visible[i][1]-dx/length*half]);
    }
    ctx.save();ctx.globalAlpha*=alpha;ctx.beginPath();
    left.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));
    right.reverse().forEach(q=>ctx.lineTo(q[0],q[1]));ctx.closePath();ctx.fill();ctx.restore();
  }
  const stroke=(ctx,pts,p=1,w=1,a=.85)=>pen(ctx,polygon(pts),p,w,a,.25);
  function wash(ctx,pts,alpha){ctx.save();ctx.globalAlpha*=alpha;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();ctx.fill();ctx.restore();}
  function draft(ctx,pts,alpha=.17){pen(ctx,pts,1,.5,alpha,.7);}
  const pigments={blue:'#8da5bd',sage:'#91ad95',ochre:'#c5ad96'};
  // Fixed, world-anchored pencil grain: no per-frame randomness or flat color fill.
  function pencilColor(ctx,shape,pigment,opacity=.35,angle=-.58,spacing=1.6,reveal=1){
    if(reveal<=0||shape.length<3)return;
    const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
    const us=shape.map(q=>q[0]*dx+q[1]*dy),vs=shape.map(q=>q[0]*nx+q[1]*ny);
    const u0=Math.min(...us)-3,u1=Math.max(...us)+3,v0=Math.floor(Math.min(...vs)/spacing),v1=Math.ceil(Math.max(...vs)/spacing);
    const xs=shape.map(q=>q[0]),ys=shape.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle=pigment;
    ctx.beginPath();shape.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();ctx.clip();
    if(reveal<1){ctx.beginPath();ctx.rect(x0-1,y0-1,(x1-x0+2)*reveal,y1-y0+2);ctx.clip();}
    for(let k=v0;k<=v1;k++){
      const n=Math.sin(k*12.9898+37.17)*43758.5453,f=n-Math.floor(n),v=k*spacing+(f-.5)*.26;
      const a=[dx*u0+nx*v,dy*u0+ny*v],b=[dx*u1+nx*v,dy*u1+ny*v];
      pen(ctx,segment(a,b),1,.8+f*.65,opacity*(.72+f*.28),.85);
    }
    ctx.restore();
  }
  function ellipse(cx,cy,rx,ry,start=0,end=Math.PI*2,n=64){
    return Array.from({length:n+1},(_,i)=>{const a=lerp(start,end,i/n);return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];});
  }
  function erase(ctx,shape,alpha=1){ctx.save();ctx.globalCompositeOperation='destination-out';wash(ctx,shape,alpha);ctx.restore();}
  function pivotPoint(x,y,cx,cy,angle){const dx=x-cx,dy=y-cy;return [cx+dx*Math.cos(angle)-dy*Math.sin(angle),cy+dx*Math.sin(angle)+dy*Math.cos(angle)];}
  function pan(ctx,x,y,p,object,weightProgress){
    const bowlY=y+44;
    const side=phase(p,0,.7);
    stroke(ctx,[[x,y+2],[x-20,bowlY]],side,.73,.68);
    stroke(ctx,[[x,y+2],[x+20,bowlY]],phase(p,.08,.76),.73,.68);
    const shape=chain(ellipse(x,bowlY,20,3,Math.PI,Math.PI*2,22),curve([x+20,bowlY],[x+15,bowlY+12],[x-13,bowlY+12],[x-20,bowlY],24));
    pen(ctx,shape,phase(p,.18,.9),.95,.78);
    pen(ctx,ellipse(x,bowlY,20,3,0,Math.PI,22),phase(p,.33,1),.54,.42);
    pencilColor(ctx,shape,pigments.ochre,.26,-.5,1.5,phase(p,.45,1));
    const q=smooth(weightProgress),rise=7*(1-q);
    if(weightProgress>0){
      ctx.save();ctx.translate(0,-rise);ctx.globalAlpha*=smooth(phase(weightProgress,0,.22));
      if(object==='block'){
        const A=[x-5,bowlY-9],B=[x+5,bowlY-9],C=[x+5,bowlY-1],D=[x-5,bowlY-1],E=[x-2,bowlY-12],F=[x+8,bowlY-12],G=[x+8,bowlY-4];
        erase(ctx,[A,E,F,G,C,D]);stroke(ctx,[A,E,F,B,C,D,A],1,.72,.76);stroke(ctx,[A,B,F,G,C],1,.55,.61);
        pencilColor(ctx,[A,E,F,B],pigments.blue,.42,-.65,1.05);
      } else {
        const stone=chain(curve([x-7,bowlY-2],[x-8,bowlY-11],[x-2,bowlY-14],[x+3,bowlY-11]),curve([x+3,bowlY-11],[x+8,bowlY-10],[x+10,bowlY-2],[x+5,bowlY-1]),curve([x+5,bowlY-1],[x+1,bowlY],[x-3,bowlY],[x-7,bowlY-2]));
        erase(ctx,stone);pen(ctx,stone,1,.82,.75);pencilColor(ctx,stone,pigments.sage,.42,-.6,1.25);
        pen(ctx,curve([x-3,bowlY-9],[x-1,bowlY-10],[x+1,bowlY-8],[x+3,bowlY-7]),1,.34,.29);
      }
      ctx.restore();
    }
  }
  function valuations(ctx,p){
    const base=chain(curve([111,137],[116,131],[142,131],[150,137]),curve([150,137],[145,143],[115,143],[111,137]));
    pen(ctx,base,Math.max(.24,phase(p,0,.29)),.91,.76);
    pen(ctx,curve([113,139],[122,143],[142,144],[148,139]),phase(p,.08,.35),.42,.34);
    const stem=phase(p,.03,.35);
    stroke(ctx,[[125,133],[128,46]],stem,1.15,.79);
    stroke(ctx,[[133,133],[132,46]],stem,.74,.61);
    pencilColor(ctx,[[125,133],[128,46],[132,46],[133,133]],pigments.blue,.21,1.1,1.7,phase(p,.2,.55));
    const angle=-.075*(1-smooth(phase(p,.54,.96)));
    const L=pivotPoint(65,47,130,47,angle),R=pivotPoint(195,47,130,47,angle);
    const beam=phase(p,.17,.45);
    const upper=[pivotPoint(62,44,130,47,angle),pivotPoint(130,41,130,47,angle),pivotPoint(198,44,130,47,angle)];
    const lower=[pivotPoint(198,48,130,47,angle),pivotPoint(130,46,130,47,angle),pivotPoint(62,48,130,47,angle)];
    stroke(ctx,upper.concat(lower,[upper[0]]),beam,.87,.8);
    pen(ctx,ellipse(130,45,2.7,2.7),phase(p,.25,.5),.75,.72);
    pan(ctx,L[0],L[1],phase(p,.29,.66),'block',phase(p,.4,.64));
    pan(ctx,R[0],R[1],phase(p,.34,.7),'stone',phase(p,.55,.82));
    // One precise final witness mark says the measured balance has settled.
    stroke(ctx,[[130,35],[130,40]],phase(p,.86,1),.55,.43);
    pen(ctx,curve([129,119],[130,108],[129,99],[130,89]),phase(p,.75,1),.36,.24);
  }
  function strategy(ctx,p){
    const left=smooth(phase(p,.03,.4)),right=smooth(phase(p,.13,.52));
    const A=[96,48],B=[151,61],Ab=[102,116],Bb=[157,129];
    const TL=[lerp(A[0],43,left),lerp(A[1],65,left)],BL=[lerp(Ab[0],48,left),lerp(Ab[1],133,left)];
    const TR=[lerp(B[0],214,right),lerp(B[1],43,right)],BR=[lerp(Bb[0],220,right),lerp(Bb[1],109,right)];
    const tops=[TL,A,B,TR],bottoms=[BL,Ab,Bb,BR];
    function map(q){const u=Math.max(0,Math.min(2.9999,q[0])),i=Math.floor(u),t=u-i,v=q[1];return [lerp(lerp(tops[i][0],tops[i+1][0],t),lerp(bottoms[i][0],bottoms[i+1][0],t),v),lerp(lerp(tops[i][1],tops[i+1][1],t),lerp(bottoms[i][1],bottoms[i+1][1],t),v)];}
    const project=pts=>pts.map(map);
    const outline=[TL,A,B,TR,BR,Bb,Ab,BL,TL];
    stroke(ctx,outline,Math.max(.1,phase(p,0,.42)),1.02,.78);
    stroke(ctx,[A,Ab],phase(p,.05,.43),.6,.46);
    stroke(ctx,[B,Bb],phase(p,.15,.53),.65,.5);
    stroke(ctx,[BL,[Ab[0],Ab[1]+2.2],[Bb[0],Bb[1]+2.2],[BR[0],BR[1]+1.7]],phase(p,.35,.67),.4,.29);
    const terrain=project(chain(curve([.14,.22],[.32,.12],[.61,.15],[.71,.38]),curve([.71,.38],[.82,.59],[.58,.57],[.51,.8])));
    pen(ctx,terrain,phase(p,.42,.74),.41,.3);
    const land=project([[.23,.21],[.54,.15],[.75,.36],[.59,.52],[.29,.41]]);
    pencilColor(ctx,land,pigments.sage,.23,-.65,1.55,phase(p,.44,.75));
    const water=project(chain(curve([2.44,.52],[2.53,.34],[2.77,.43],[2.84,.59]),curve([2.84,.59],[2.77,.75],[2.5,.72],[2.44,.52])));
    pencilColor(ctx,water,pigments.blue,.27,-.61,1.45,phase(p,.53,.81));
    pen(ctx,water,phase(p,.54,.82),.34,.25);
    const route=project(chain(curve([.27,.78],[.46,.74],[.62,.43],[.91,.49]),curve([.91,.49],[1.13,.54],[1.34,.72],[1.61,.56]),curve([1.61,.56],[1.8,.42],[2.04,.47],[2.17,.34]),curve([2.17,.34],[2.33,.18],[2.49,.31],[2.65,.23])));
    const routeP=phase(p,.49,.95);
    const alternative=project(curve([1.61,.56],[1.57,.72],[1.74,.86],[1.94,.87]));
    pen(ctx,alternative,phase(p,.63,.82),.45,.29);
    ctx.save();ctx.fillStyle=pigments.ochre;pen(ctx,route,routeP,2.2,.18,.8);ctx.restore();
    pen(ctx,route,routeP,.86,.77);
    const destination=map([2.65,.23]);
    pen(ctx,ellipse(destination[0],destination[1],2.1,1.7),phase(p,.93,1),.65,.7);
    // A few pale marks follow a fold rather than decorating the empty paper.
    [0,1,2].forEach(i=>pen(ctx,project(segment([1.04+i*.025,.67],[1.055+i*.025,.86])),phase(p,.75+i*.04,.93+i*.025),.32,.19));
  }
  function chair(ctx,cx,cy,mirror,p,pigment){
    if(p<=0)return;
    const move=(1-settle(p))*6;
    ctx.save();ctx.translate(cx-mirror*move,cy);ctx.scale(mirror,1);
    ctx.globalAlpha*=smooth(phase(p,0,.12));
    const seat=[[-16,-1],[1,-8],[18,3],[1,10],[-16,-1]];
    stroke(ctx,[[-16,-1],[-18,26]],phase(p,.1,.83),.85,.76);
    stroke(ctx,[[1,10],[2,34]],phase(p,.18,.91),.94,.79);
    stroke(ctx,[[18,3],[21,27]],phase(p,.23,.96),.67,.58);
    const upper=curve([-19,-33],[-15,-39],[-7,-43],[-2,-40]);
    const back=chain(upper,segment([-2,-40],[-1,-25]),curve([-1,-25],[-8,-26],[-14,-21],[-18,-18]),segment([-18,-18],[-19,-33]));
    pen(ctx,back,phase(p,0,.62),.91,.76);
    stroke(ctx,[[-18,-18],[-16,-1]],phase(p,.13,.7),.72,.65);
    stroke(ctx,[[-1,-25],[1,-8]],phase(p,.18,.75),.69,.59);
    stroke(ctx,seat,phase(p,.15,.77),.91,.8);
    stroke(ctx,[[-16,1],[1,12],[18,5]],phase(p,.35,.9),.43,.32);
    pencilColor(ctx,back,pigment,.36,-.68,1.5,phase(p,.4,.93));
    pencilColor(ctx,seat.slice(0,-1),pigment,.2,-.6,1.7,phase(p,.5,1));
    pen(ctx,segment([-13,-31],[-11,-22]),phase(p,.68,1),.32,.2);
    ctx.restore();
  }
  function consulting(ctx,p){
    // The far chair precedes the table so the still-life perspective stays coherent.
    chair(ctx,201,87,-1,phase(p,.18,.63),pigments.blue);
    const top=ellipse(132,84,47,19),table=phase(p,.02,.47);
    const foot=ellipse(132,132,20,5);
    pen(ctx,foot,Math.max(.15,phase(p,.06,.39)),.77,.65);
    stroke(ctx,[[129,102],[128,128]],phase(p,.06,.45),1.05,.75);
    stroke(ctx,[[135,102],[136,128]],phase(p,.12,.49),.69,.53);
    // A transparent knockout gives the tabletop clean occlusion with no white fill.
    erase(ctx,top,smooth(table));
    pen(ctx,top,table,1.12,.8);
    pen(ctx,ellipse(132,88,47,19,0,Math.PI),phase(p,.18,.6),.75,.59);
    stroke(ctx,[[85,84],[85,88]],phase(p,.3,.58),.63,.5);
    stroke(ctx,[[179,84],[179,88]],phase(p,.3,.58),.63,.5);
    chair(ctx,59,103,1,phase(p,.26,.7),pigments.sage);
    const book=phase(p,.56,.94),open=smooth(book);
    if(book>0){
      const foldTop=[131,77],foldBottom=[134,91];
      const L1=[lerp(130,117,open),lerp(76,76,open)],L2=[lerp(133,120,open),lerp(90,88,open)];
      const R1=[lerp(132,148,open),lerp(76,72,open)],R2=[lerp(135,150,open),lerp(90,86,open)];
      const left=[foldTop,L1,L2,foldBottom],right=[foldTop,R1,R2,foldBottom];
      erase(ctx,left);erase(ctx,right);
      stroke(ctx,left.concat([foldTop]),1,.66,.7);stroke(ctx,right.concat([foldTop]),1,.66,.7);
      stroke(ctx,[foldTop,foldBottom],1,.75,.67);
      pencilColor(ctx,left,pigments.ochre,.25,-.56,1.25);
      pen(ctx,segment([121,81],[128,82.3]),phase(book,.5,.9),.35,.29);
      pen(ctx,segment([123,85],[129,86]),phase(book,.65,1),.35,.29);
      pen(ctx,segment([137,79],[144,77]),phase(book,.6,1),.35,.24);
    }
    const pencil=phase(p,.85,1);
    const shift=3*(1-smooth(pencil));
    if(pencil>0){
      ctx.save();ctx.translate(shift,0);ctx.globalAlpha*=smooth(phase(pencil,0,.35));
      stroke(ctx,[[151,92],[163,87],[164,88],[152,93],[151,92]],1,.48,.58);
      ctx.fillStyle=pigments.blue;pen(ctx,segment([153,92],[162,88.3]),1,.7,.43);ctx.restore();
    }
  }
  window.drawMidoIntro=function(ctx,kind,progress,width,height,ink){
    ctx.clearRect(0,0,width,height);ctx.save();
    // Compose each still life in the same transparent stage, with enough room
    // for the moving chair and beam but without wasting the small mobile box.
    const view=({valuations:[36,28,188,122],strategy:[34,34,196,108],consulting:[28,38,204,106]}[kind]||[36,28,188,122]);
    const scale=Math.min(width/view[2],height/view[3]);
    ctx.translate((width-view[2]*scale)/2-view[0]*scale,(height-view[3]*scale)/2-view[1]*scale);ctx.scale(scale,scale);
    ctx.fillStyle=ink;ctx.strokeStyle=ink;
    ({valuations,strategy,consulting}[kind]||valuations)(ctx,clamp(progress));
    ctx.restore();
  };
})();
