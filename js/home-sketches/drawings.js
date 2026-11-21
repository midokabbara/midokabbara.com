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
  function ground(ctx,compact){
    draft(ctx,curve([51,151],[87,148],[162,154],[208,149]),.19);
    if(!compact){draft(ctx,curve([77,155],[108,152],[144,156],[175,154]),.12);draft(ctx,segment([183,152],[196,151]),.13);}
  }
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
  function pencilFace(ctx,x,y,w,h,depth,lift,t,face,pigment,amount,opacity=.35){
    if(t<=0||amount<=0)return;
    const q=settle(t),rise=(1-q)*lift,slant=w*.045;
    ctx.save();ctx.translate(x+w/2,y-h/2-rise);ctx.rotate((1-q)*-.018);ctx.translate(-x-w/2,-y+h/2);
    ctx.globalAlpha*=smooth(phase(t,0,.13));
    const A=[x,y-h],B=[x+w,y-h+slant],C=[x+w,y+slant];
    const E=[x+depth,y-h-depth*.53],F=[x+w+depth,y-h+slant-depth*.53],G=[x+w+depth,y+slant-depth*.53];
    pencilColor(ctx,face==='top'?[A,E,F,B]:[B,F,G,C],pigment,opacity,face==='top'?-.6:1.18,face==='top'?1.55:1.8,amount);
    ctx.restore();
  }
  function pencilRibbon(ctx,front,edge,amount,pigment){
    if(amount<=0)return;
    let total=0;const lengths=[0];
    for(let i=1;i<front.length;i++){total+=Math.hypot(front[i][0]-front[i-1][0],front[i][1]-front[i-1][1]);lengths.push(total);}
    const target=total*clamp(amount),left=[front[0]],right=[edge[0]];
    for(let i=1;i<edge.length;i++){
      if(lengths[i]<=target){left.push(front[i]);right.push(edge[i]);}
      else {const t=clamp((target-lengths[i-1])/(lengths[i]-lengths[i-1]));left.push([lerp(front[i-1][0],front[i][0],t),lerp(front[i-1][1],front[i][1],t)]);right.push([lerp(edge[i-1][0],edge[i][0],t),lerp(edge[i-1][1],edge[i][1],t)]);break;}
    }
    if(left.length>1)pencilColor(ctx,left.concat(right.reverse()),pigment,.42,-.62,1.1);
  }
  function cuboid(ctx,x,y,w,h,depth,lift,t,compact,solid=false){
    if(t<=0)return;
    const q=settle(t),rise=(1-q)*lift,slant=w*.045;
    ctx.save();ctx.translate(x+w/2,y-h/2-rise);ctx.rotate((1-q)*-.018);ctx.translate(-x-w/2,-y+h/2);
    ctx.globalAlpha*=smooth(phase(t,0,.13));
    const A=[x,y-h],B=[x+w,y-h+slant],C=[x+w,y+slant],D=[x,y];
    const E=[x+depth,y-h-depth*.53],F=[x+w+depth,y-h+slant-depth*.53],G=[x+w+depth,y+slant-depth*.53];
    // As the new part settles, its surfaces occlude the construction behind it.
    // Erasing into transparency keeps the illustration independent of paper color.
    ctx.save();ctx.globalCompositeOperation='destination-out';
    wash(ctx,[A,E,F,G,C,D],phase(t,.16,.57));ctx.restore();
    wash(ctx,[B,F,G,C],.025*phase(t,.45,1));
    const m=compact?1.16:1;
    stroke(ctx,[A,E,F,B],phase(t,0,.68),.91*m,.7);
    stroke(ctx,[A,B,C,D,A],phase(t,.04,.82),1.13*m,.86);
    stroke(ctx,[B,F,G,C],phase(t,.14,.86),.88*m,.72);
    if(!compact){
      // Sparse hatch marks follow the receding face and vary deliberately in length.
      [0.22,.43,.68,.86].forEach((f,i)=>{const top=[lerp(B[0],F[0],f),lerp(B[1],F[1],f)+2.5+i*.15],bottom=[lerp(C[0],G[0],f),lerp(C[1],G[1],f)-3-i*.5];pen(ctx,segment(top,bottom),phase(t,.58+i*.035,1),.43,.25);});
      if(solid)pen(ctx,curve([x+3,y-h+2.7],[x+w*.25,y-h+2.5],[x+w*.7,y-h+slant+2.4],[x+w-3,y-h+slant+2.6]),phase(t,.62,1),.4,.23);
    }
    ctx.restore();
  }
  function build(ctx,p,compact,colored=false){
    ground(ctx,compact);
    // All contact points use the same projection and bearing planes.
    const slope=.045;
    const baseTop=x=>139.5+slope*(x-56);
    const roofSeat=x=>89+slope*(x-64);
    const ghost=.18*(1-smooth(phase(p,.1,.62)));
    stroke(ctx,[[75,baseTop(75)],[75,roofSeat(75)],[91,roofSeat(91)]],1,.6,ghost);
    draft(ctx,segment([55,143],[189,149]),.19);
    // The base is anchored from the first frame; it never moves.
    cuboid(ctx,56,144,131,4.5,25,0,Math.max(.65,phase(p,0,.19)),compact,true);
    // Different widths retain the model's character; both tops and feet seat exactly.
    cuboid(ctx,75,baseTop(75),16,baseTop(75)-roofSeat(75),20,4,phase(p,.02,.36),compact);
    cuboid(ctx,163,baseTop(163),12,baseTop(163)-roofSeat(163),18,4,phase(p,.15,.43),compact);
    // A complete upper panel remains a single rigid object during its short placement.
    // Its underside stays above the supports until it makes contact; no intersection.
    const roof=phase(p,.46,.88);
    if(roof>0){
      const rise=6*(1-smooth(roof));
      ctx.save();ctx.globalAlpha*=smooth(phase(roof,0,.12));ctx.translate(0,-rise);
      cuboid(ctx,64,89,120,10,23,0,1,compact,true);
      ctx.restore();
    }
    const finish=phase(p,.88,1);
    stroke(ctx,[[75,roofSeat(75)],[91,roofSeat(91)]],finish,.7,.46);
    stroke(ctx,[[163,roofSeat(163)],[175,roofSeat(175)]],finish,.7,.46);
    if(!compact){
      // Only marks attached to real geometry remain; no loose upper joint lines.
      draft(ctx,segment([68,145],[68,150]),.27*finish);
      draft(ctx,segment([188,147],[188,152]),.27*finish);
      pen(ctx,segment([68,148],[188,153]),finish,.42,.19);
      pen(ctx,segment([80,112],[80.2,134]),finish,.35,.18);
    }
    if(colored){
      const support=phase(p,.02,.36);
      pencilFace(ctx,75,baseTop(75),16,baseTop(75)-roofSeat(75),20,4,support,'side',pigments.ochre,phase(support,.42,.95),.3);
      if(roof>0){
        const rise=6*(1-smooth(roof));
        ctx.save();ctx.globalAlpha*=smooth(phase(roof,0,.12));ctx.translate(0,-rise);
        pencilFace(ctx,64,89,120,10,23,0,1,'top',pigments.blue,phase(roof,.12,.82),.46);
        ctx.restore();
      }
    }
  }
  function leaf(ctx,base,tip,bend,size,p,compact,pigment=null){
    if(p<=0)return;
    const q=smooth(p),end=[lerp(base[0],tip[0],q),lerp(base[1],tip[1],q)];
    const dx=end[0]-base[0],dy=end[1]-base[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
    const s=size*q;
    const outer=curve(base,[base[0]+dx*.17+nx*s*bend,base[1]+dy*.17+ny*s*bend],[end[0]-dx*.22+nx*s,end[1]-dy*.22+ny*s],end,24);
    const back=curve(end,[end[0]-dx*.3-nx*s*.7,end[1]-dy*.3-ny*s*.7],[base[0]+dx*.24-nx*s*.52,base[1]+dy*.24-ny*s*.52],base,24);
    if(pigment)pencilColor(ctx,chain(outer,back),pigment,.54*smooth(phase(p,.04,.65)),-.66,1.03);
    pen(ctx,chain(outer,back),1,compact?1.0:.8,.72);
    if(!compact)pen(ctx,curve(base,[base[0]+dx*.4,base[1]+dy*.4],[end[0]-dx*.2,end[1]-dy*.2],end,16),1,.36,.27);
  }
  function think(ctx,p,compact,colored=false){
    ground(ctx,compact);
    const m=compact?1.14:1;
    // The trunk forks with real weight; finer branches have a clear hierarchy.
    const trunk=chain(curve([119,149],[129,132],[125,111],[127,98]),curve([127,98],[128,77],[143,65],[140,43]));
    pen(ctx,trunk,Math.max(.11,phase(p,0,.59)),1.65*m,.83);
    pen(ctx,curve([123,148],[133,126],[130,109],[131,98]),phase(p,.03,.47),.72*m,.57);
    pen(ctx,curve([120,149],[115,147],[109,151],[101,151]),1,.75*m,.45);
    const branches=[
      [curve([128,118],[110,111],[110,88],[91,81]),.15,.53,1.14],
      [curve([128,103],[149,102],[164,82],[177,81]),.29,.67,1.02],
      [curve([131,83],[119,74],[121,56],[109,47]),.35,.73,.89],
      [curve([140,62],[158,60],[160,40],[176,35]),.48,.85,.82],
      [curve([110,103],[92,102],[83,107],[70,99]),.52,.81,.63],
      [curve([159,94],[177,99],[185,96],[194,88]),.58,.9,.64]
    ];
    branches.forEach(([pts,a,b,w])=>pen(ctx,pts,phase(p,a,b),w*m,.74));
    // Seven leaves, each with a different silhouette and direction.
    const leaves=[
      [[91,81],[76,65],.9,4.6,.49,.69],
      [[70,99],[55,95],1.2,3.7,.67,.83],
      [[109,47],[103,29],1.25,4.5,.63,.84],
      [[140,43],[146,26],.9,4,.7,.89],
      [[176,35],[194,31],1.15,4.8,.75,.93],
      [[177,81],[190,65],.85,4.8,.61,.84],
      [[194,88],[208,83],1.1,3.8,.84,1]
    ];
    leaves.forEach(([a,b,bend,size,start,end],i)=>leaf(ctx,a,b,bend,size,phase(p,start,end),compact,colored&&[0,2,4,5,6].includes(i)?pigments.sage:null));
    // One quieter late decision: a small offshoot, then the final leaf.
    pen(ctx,curve([153,97],[154,88],[152,83],[155,77]),phase(p,.76,.93),.55*m,.54);
    pen(ctx,curve([123,148],[132,144],[139,146],[146,147]),phase(p,.43,.7),.66*m,.49);
    if(!compact){
      pen(ctx,curve([127,132],[129,124],[127,118],[129,112]),phase(p,.72,1),.36,.29);
      pen(ctx,curve([135,78],[135,71],[140,66],[140,59]),phase(p,.75,1),.34,.22);
      pen(ctx,curve([91,81],[95,85],[96,89],[99,92]),phase(p,.8,1),.36,.21);
      draft(ctx,segment([109,151],[103,154]),.2*phase(p,.75,1));
    }
  }
  const nearTrail=chain(curve([56,150],[78,139],[104,144],[126,129]),curve([126,129],[143,119],[146,114],[137,106]),curve([137,106],[125,96],[100,105],[103,90]));
  const farTrail=chain(curve([114,78],[128,72],[151,78],[165,66]),curve([165,66],[174,58],[169,50],[182,41]));
  function rock(ctx,x,y,p,compact){
    stroke(ctx,[[x-7,y],[x-5,y-4.4],[x+.6,y-5.8],[x+6,y-2.2],[x+7,y+.5]],p,compact?.8:.65,.49);
    if(!compact){stroke(ctx,[[x-5,y-4.4],[x+.9,y-2.2],[x+6,y-2.2]],p,.4,.26);pen(ctx,segment([x-2,y-1.8],[x-4,y+.5]),p,.4,.22);}
  }
  function path(ctx,p,compact,colored=false){
    const m=compact?1.5:1;
    // The line itself is the journey. A deliberate break lets it pass behind a ridge.
    const reveal=smooth(phase(p,0,.91));
    pen(ctx,nearTrail,Math.max(.07,phase(reveal,0,.66)),1.2*m,.83);
    pen(ctx,farTrail,phase(reveal,.68,1),.78*m,.69);
    const nearEdge=chain(curve([62,154],[83,144],[105,149],[129,132]),curve([129,132],[148,121],[149,113],[140,104]));
    if(colored)pencilRibbon(ctx,nearTrail,nearEdge,Math.max(.07,phase(reveal,0,.66)),pigments.ochre);
    pen(ctx,nearEdge,phase(reveal,.07,.56),.53*m,.44);
    pen(ctx,curve([128,101],[116,99],[108,102],[106,91]),phase(reveal,.5,.68),.45*m,.33);
    pen(ctx,curve([117,80],[133,75],[151,81],[165,69]),phase(reveal,.74,.98),.36*m,.28);
    // Low contour lines overlap the route spatially, with a calm, open horizon.
    const ridge=curve([67,93],[87,85],[104,91],[125,79]);
    pen(ctx,ridge,Math.max(.12,phase(p,.24,.62)),.88*m,.66);
    pen(ctx,curve([125,79],[142,72],[155,76],[169,71]),phase(p,.44,.79),.57*m,.41);
    pen(ctx,curve([152,49],[170,46],[182,34],[201,39]),phase(p,.64,.94),.55*m,.39);
    pen(ctx,curve([182,34],[196,26],[209,32],[218,28]),phase(p,.76,1),.38*m,.24);
    rock(ctx,90,137,phase(p,.22,.47),compact);
    if(!compact)rock(ctx,160,100,phase(p,.54,.75),compact);
    const grass=phase(p,.4,.7);
    pen(ctx,curve([172,127],[169,121],[169,117],[165,114]),grass,.76*m,.53);
    pen(ctx,curve([172,127],[175,122],[174,117],[179,112]),phase(p,.46,.75),.64*m,.48);
    pen(ctx,curve([172,127],[172,124],[166,123],[163,122]),phase(p,.5,.77),.44*m,.4);
    if(colored){
      const g=smooth(grass);
      const patch=[[166,126],[168,118],[172,127],[177,115],[175,128]];
      pencilColor(ctx,patch,pigments.sage,.28*g,-.92,1.35);
    }
    if(!compact){
      // Selective dry hatching defines one slope, leaving most paper untouched.
      [0,1,2,3].forEach(i=>pen(ctx,curve([77+i*4.5,94-i*.5],[77+i*4.5,95],[74+i*4.5,98],[72+i*4.5,99]),phase(p,.6+i*.035,.85+i*.035),.36,.22));
      pen(ctx,curve([45,155],[52,152],[57,154],[65,151]),1,.49,.23);
      pen(ctx,curve([187,54],[194,51],[198,52],[202,50]),phase(p,.83,1),.38,.18);
      pen(ctx,segment([112,145],[118,143]),phase(p,.82,1),.36,.19);
    }
  }
  window.drawMidoRefined=function(ctx,kind,progress,width,height,ink,compact=false,colored=false){
    ctx.clearRect(0,0,width,height);
    ctx.save();
    const frameWidth=compact?200:260,frameHeight=compact?150:180;
    const scale=Math.min(width/frameWidth,height/frameHeight);
    ctx.translate((width-frameWidth*scale)/2-(compact?30*scale:0),(height-frameHeight*scale)/2-(compact?15*scale:0));
    ctx.scale(scale,scale);ctx.fillStyle=ink;ctx.strokeStyle=ink;
    ({build,think,path}[kind]||build)(ctx,clamp(progress),compact,colored);
    ctx.restore();
  };
})();
