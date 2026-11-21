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

  // Single-line notebook lettering is part of the drawing, with no font dependency.
  const glyph={
    a:[curve([4.7,3],[1.2,.5],[-.9,6],[2.1,7]),curve([2.1,7],[4.3,7.1],[4.8,4.9],[4.7,2.3]),segment([4.7,2.3],[4.9,7])],
    c:[curve([4.9,2.9],[.2,.3],[-1,8.4],[5.1,6.5])],
    e:[chain(segment([.4,4.6],[4.8,4.1]),curve([4.8,4.1],[5.3,0],[.3,.9],[.4,4.6]),curve([.4,4.6],[.2,7.5],[3.6,8],[5.2,6.4]))],
    f:[curve([4.4,.4],[1.6,-1],[1.8,1.8],[1.6,7.5]),segment([.1,2.6],[4.1,2.4])],
    g:[curve([4.8,2.8],[.3,.4],[-.4,7.7],[3.1,6.9]),curve([3.1,6.9],[5.6,6.1],[4.7,4],[4.8,2.4]),curve([4.8,2.4],[4.9,9.3],[4.7,10.4],[.8,8.9])],
    h:[segment([.7,.1],[.6,7.1]),chain(curve([.7,4.2],[1.6,1],[4.7,1.6],[4.7,4.2]),segment([4.7,4.2],[4.6,7]))],
    i:[segment([1.3,2.5],[1.2,7]),curve([1.2,.2],[.8,-.3],[1.8,-.4],[1.4,.3],6)],
    k:[segment([.8,.1],[.7,7]),segment([4.8,2.3],[.9,4.9]),segment([2.6,3.8],[5.1,7])],
    l:[curve([1.4,.1],[1.1,5.1],[.3,8],[3.1,6.7])],
    m:[segment([.5,2.4],[.6,7]),chain(curve([.6,3.8],[1.1,1.3],[3.2,1.6],[3.2,4.5]),segment([3.2,4.5],[3.2,7])),chain(curve([3.2,3.7],[4.2,1.2],[6,1.8],[6,4.4]),segment([6,4.4],[6,7]))],
    n:[segment([.5,2.4],[.6,7]),chain(curve([.6,3.8],[1.6,1.2],[4.9,1.6],[4.9,4.6]),segment([4.9,4.6],[4.8,7]))],
    o:[ellipse(2.7,4.8,2.25,2.45,.2,Math.PI*2+.2,24)],
    r:[segment([.6,2.5],[.6,7]),curve([.7,3.8],[1.2,1.4],[3.1,1.8],[4.3,2.7])],
    s:[chain(curve([4.8,2.8],[.9,.5],[-.5,3.7],[2.3,4.4]),curve([2.3,4.4],[6.7,5.4],[3.3,8.7],[.3,6.4]))],
    t:[curve([2.2,.2],[1.8,5.2],[.8,8.6],[4.5,6.3]),segment([.2,2.5],[4.6,2.4])],
    u:[curve([.6,2.4],[.1,8.5],[4.6,8.4],[4.8,2.4]),segment([4.8,2.4],[4.8,7])],
    v:[polygon([[.2,2.4],[2.7,7.1],[5.3,2.3]])],
    w:[polygon([[.1,2.4],[1.5,7],[3.1,3.3],[4.7,7],[6,2.3]])],
    R:[segment([.6,.1],[.6,7]),curve([.6,.2],[7,-.7],[7,4.3],[.7,3.6]),segment([3.1,3.6],[6.1,7])],
    O:[ellipse(3.2,3.55,2.7,3.45,.18,Math.PI*2+.18,28)],
    I:[segment([.3,.2],[3.2,.1]),segment([1.7,.2],[1.6,6.9]),segment([.2,7],[3.2,6.9])],
    C:[curve([5.7,.9],[1.3,-2.1],[-1.9,7.9],[5.8,6.3])],
    W:[polygon([[.2,.1],[1.9,7],[4.1,1.8],[6.2,7],[8.1,.1]])],
    A:[polygon([[.2,7],[3.3,.1],[6.3,7]]),segment([1.4,4.6],[5.2,4.5])],
    p:[segment([.6,2.4],[.5,9.6]),curve([.7,3.4],[1.9,.5],[6.6,2.3],[4.7,5.9]),curve([4.7,5.9],[3.8,7.6],[1.7,7.1],[.7,6])],
    x:[curve([.4,2.3],[1.8,4.2],[3.8,5.7],[5.4,7]),curve([5.1,2.3],[3.5,4],[1.4,5.9],[.3,7])],
    '-':[curve([.3,4.1],[1.1,3.9],[2.3,4],[3.2,4])],
    y:[curve([.4,2.4],[1.5,8.1],[3.8,7.5],[5,2.3]),curve([5,2.3],[4.8,7.3],[3.2,11],[.8,9.1])]
  };
  const advance={i:3.1,l:3.7,m:7.4,w:7.3,r:5.4,f:5.2,t:5.6,R:7.2,O:7.2,I:4.2,C:6.9,W:9.2,A:7.3,'-':4.4,' ':3.7};
  function words(ctx,text,x,y,size,p=1,alpha=.8,project=q=>q){
    const s=size/7,all=[];let offset=0;
    [...text].forEach((c,i)=>{const tilt=[-.018,.012,-.01,.017,0][i%5];(glyph[c]||[]).forEach(path=>all.push(path.map(q=>project([x+(offset+q[0]+q[1]*tilt)*s,y+(q[1]+[0,.1,-.08,.04][i%4])*s]))));offset+=advance[c]||6.4;});
    all.forEach((path,i)=>pen(ctx,path,clamp(p*all.length-i),.79,alpha,.8));
    return offset*s;
  }
  function drivers(ctx,p){
    // McKinsey Valuation, 7e, Exhibit 3.1: growth + ROIC drive cash flow;
    // cash flow + cost of capital drive value. Cost of capital denotes WACC.
    // Source: https://www.oreilly.com/library/view/valuation-7th-edition/9781119610885/c03.xhtml
    // Expanded operating identity:
    // McKinsey Global Institute, Making it in America technical appendix, p. 11:
    // https://www.mckinsey.org/~/media/mckinsey/featured%20insights/americas/making%20it%20in%20america%20revitalizing%20us%20manufacturing/making-it-in-americarevitalizing-us-manufacturing-technical-appendix.pdf
    // ROIC = (NOPLAT / revenue) * (revenue / average operating invested capital).
    // The first factor is after-tax operating margin, the second capital turnover.
    // ROIC uses the same average operating invested capital denominator and
    // matching measurement period; do not substitute net-income margin or assets.
    // V = NOPLAT_1 * (1 - g / ROIC) / (WACC - g), under constant reinvestment
    // return equal to ROIC and steady-state g < WACC. The general formula for
    // future reinvestment uses RONIC. This drawing is a driver overview.
    const margin=curve([74,55],[86,55],[85,80],[98,80]);
    const turnover=curve([82,98],[90,98],[87,80],[98,80]);
    draft(ctx,margin,.075);draft(ctx,turnover,.065);
    // Plain-language labels keep this a conceptual driver sketch. Internally,
    // margin denotes after-tax operating margin; capital efficiency means turnover.
    words(ctx,'margin',19,47.5,9.5,phase(p,0,.23),.8);
    words(ctx,'capital',15,85,9.5,phase(p,.04,.22),.8);
    words(ctx,'efficiency',3,98,9.5,phase(p,.1,.28),.8);
    pen(ctx,margin,phase(p,.21,.37),.91,.72);
    pen(ctx,turnover,phase(p,.25,.4),.91,.72);
    words(ctx,'ROIC',102,75,9.5,phase(p,.39,.54),.82);
    words(ctx,'growth',88,19,9.5,phase(p,.4,.58),.79);
    const growth=curve([144,25],[153,25],[152,54],[163,54]);
    const roic=curve([142,80],[152,80],[152,55],[163,54]);
    pen(ctx,roic,phase(p,.51,.68),.94,.73);
    pen(ctx,growth,phase(p,.55,.71),.94,.73);
    words(ctx,'cash flow',168,48,9.5,phase(p,.64,.8),.83);
    pencilColor(ctx,[[168,61],[235,60],[235,63.2],[168,64]],pigments.ochre,.21,-.63,1.35,phase(p,.75,.87));
    words(ctx,'cost of',174,84,9.5,phase(p,.64,.735),.75);
    words(ctx,'capital',176,97,9.5,phase(p,.7,.79),.75);
    pen(ctx,curve([234,98],[251,97],[247,56],[260,56]),phase(p,.78,.91),.74,.63);
    pen(ctx,curve([242,55],[248,55],[253,55.6],[260,56]),phase(p,.77,.89),1.05,.79);
    const valueBox=chain(curve([266,42],[277,41],[296,41.6],[311,41]),curve([311,41],[312.1,47],[311.4,60],[312,68]),curve([312,68],[298,68.3],[278,69.2],[265,68]),curve([265,68],[264.2,59],[265,49],[266,42]));
    pen(ctx,valueBox,phase(p,.85,.98),.84,.67);
    words(ctx,'value',270,50,9.4,phase(p,.88,1),.87);
    pencilColor(ctx,valueBox,pigments.blue,.14,-.63,1.6,phase(p,.92,1));
    pencilColor(ctx,[[89,33],[134,32.5],[134,35.6],[89,36]],pigments.sage,.2,-.62,1.4,phase(p,.58,.73));
    pen(ctx,curve([188,114],[197,115],[211,114],[220,112]),phase(p,.94,1),.36,.23);
  }
  function model(ctx,p){
    const A=[43,37],B=[184,25],C=[214,122],D=[68,139];
    const map=q=>{const u=q[0]/150,v=q[1]/100;return [lerp(lerp(A[0],B[0],u),lerp(D[0],C[0],u),v),lerp(lerp(A[1],B[1],u),lerp(D[1],C[1],u),v)];};
    const project=pts=>pts.map(map);
    const paper=[A,B,C,D,A];
    pen(ctx,polygon(paper),Math.max(.08,phase(p,0,.3)),.96,.78);
    pen(ctx,polygon([D,[C[0]+1,C[1]+2.8],[B[0]+1.6,B[1]+3]]),phase(p,.16,.42),.44,.35);
    words(ctx,'forecast',11,8.5,7.2,phase(p,.08,.34),.74,map);
    const columns=[10,49,72,95,118,141],rows=[27,38,49,60,71];
    rows.forEach((y,i)=>pen(ctx,project(segment([10,y],[141,y])),phase(p,.2+i*.035,.43+i*.035),i===0?.75:.43,i===0?.65:.33));
    columns.forEach((x,i)=>pen(ctx,project(segment([x,27],[x,71])),phase(p,.24+i*.026,.45+i*.026),.4,.29));
    pencilColor(ctx,project([[10,27],[141,27],[141,38],[10,38]]),pigments.blue,.18,-.62,1.5,phase(p,.4,.65));
    // Each little cell is a non-numeric graphite notation, not invented data.
    const cellWidths=[14,10,16,11];
    for(let row=0;row<3;row++){
      const y=43+row*11;
      pen(ctx,project(curve([15,y],[19,y-.45],[24+row*2,y+.4],[33+row*3,y-.1])),phase(p,.4+row*.05,.58+row*.05),.54,.48);
      for(let col=0;col<4;col++){
        const x=54+col*23,w=cellWidths[(row+col)%4]*.46;
        const delay=.45+col*.045+row*.025;
        pen(ctx,project(curve([x,y],[x+w*.23,y-.8],[x+w*.68,y+.7],[x+w,y-.25])),phase(p,delay,delay+.15),.53,.46);
        if((col+row)%3===0)pen(ctx,project(segment([x+w+2,y+.2],[x+w+3.8,y-.35])),phase(p,delay+.05,delay+.19),.4,.32);
      }
    }
    words(ctx,'value',14,80,7.4,phase(p,.64,.84),.75,map);
    const range=phase(p,.73,.97);
    pencilColor(ctx,project([[85,81],[120,81],[120,87],[85,87]]),pigments.ochre,.31,-.6,1.1,phase(p,.78,.99));
    pen(ctx,project(curve([69,84],[84,84.6],[119,83.3],[137,84])),range,.93,.76);
    pen(ctx,project(segment([69,80],[69,88])),phase(p,.76,.9),.61,.59);
    pen(ctx,project(segment([137,80],[137,88])),phase(p,.87,.98),.61,.59);
    pen(ctx,project(segment([105,80.5],[105,88.5])),phase(p,.94,1),.83,.76);
    // A slender pencil settles next to the worksheet; it never sweeps or loops.
    const pencil=phase(p,.47,.87),travel=3*(1-smooth(pencil));
    if(pencil>0){ctx.save();ctx.translate(travel,-travel);ctx.globalAlpha*=smooth(phase(pencil,0,.23));
      const body=[[211,51],[216,49.5],[241,113],[236,115],[211,51]];
      stroke(ctx,body,phase(pencil,0,.77),.71,.68);
      stroke(ctx,[[236,115],[241,113],[242.3,124],[236,115]],phase(pencil,.5,1),.65,.67);
      pen(ctx,segment([239.8,120.3],[242.3,124]),phase(pencil,.73,1),.97,.82);
      pen(ctx,segment([214,51],[238.8,113.4]),phase(pencil,.2,.84),.38,.37);
      pencilColor(ctx,body.slice(0,-1),pigments.sage,.29,-.65,1.15,phase(pencil,.33,.94));
      ctx.restore();
    }
  }
  window.drawMidoValuationOption=function(ctx,variant,p,width,height,ink){
    ctx.clearRect(0,0,width,height);ctx.save();
    const view=variant==='model'?[34,18,215,128]:[-1,8,322,112];
    const scale=Math.min(width/view[2],height/view[3]);
    ctx.translate((width-view[2]*scale)/2-view[0]*scale,(height-view[3]*scale)/2-view[1]*scale);ctx.scale(scale,scale);
    ctx.fillStyle=ink;ctx.strokeStyle=ink;
    (variant==='model'?model:drivers)(ctx,clamp(p));ctx.restore();
  };
})();
