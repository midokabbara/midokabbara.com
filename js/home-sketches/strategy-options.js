(function () {
  'use strict';

  // Independent, transparent 220 × 112 sketches. The caller owns playback;
  // a single 1.7–2.0 second pass from p=0 to p=1 ends in a still drawing.
  const clamp = n => Math.max(0, Math.min(1, n));
  const phase = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const curve = (a, b, c, d, n = 36) => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [u*u*u*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t*t*t*d[0],
            u*u*u*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t*t*t*d[1]];
  });
  const segment = (a, b) => Array.from({ length: 13 }, (_, i) =>
    [lerp(a[0], b[0], i / 12), lerp(a[1], b[1], i / 12)]);
  const chain = (...parts) => parts.flatMap((a, i) => i ? a.slice(1) : a);
  const polygon = pts => chain(...pts.slice(1).map((q, i) => segment(pts[i], q)));
  const pigments = { blue: '#8da5bd', sage: '#91ad95', ochre: '#c5ad96' };

  // The accepted site's pressure-shaped ribbon, kept private and deterministic.
  function pen(ctx, pts, amount = 1, width = 1, alpha = .85, pressure = .7) {
    if (amount <= 0 || pts.length < 2) return;
    amount = clamp(amount);
    const dist = [0];
    for (let i = 1; i < pts.length; i++)
      dist[i] = dist[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
    const total = dist.at(-1), target = total * amount, visible = [pts[0]], fractions = [0];
    if (!total) return;
    for (let i = 1; i < pts.length; i++) {
      if (dist[i] <= target) { visible.push(pts[i]); fractions.push(dist[i] / total); }
      else {
        const t = (target - dist[i-1]) / (dist[i] - dist[i-1]);
        visible.push([lerp(pts[i-1][0], pts[i][0], t), lerp(pts[i-1][1], pts[i][1], t)]);
        fractions.push(target / total); break;
      }
    }
    const left = [], right = [];
    for (let i = 0; i < visible.length; i++) {
      const prev = visible[Math.max(0, i-1)], next = visible[Math.min(visible.length-1, i+1)];
      const dx = next[0]-prev[0], dy = next[1]-prev[1], length = Math.hypot(dx,dy) || 1;
      const t = fractions[i], enter = Math.min(1, .3+t*8);
      const exit = amount === 1 ? Math.min(1, .22+(1-t)*9) : 1;
      const force = (1-pressure*.15) + pressure*.15*Math.sin(Math.PI*t);
      const half = width*.5*enter*exit*force;
      left.push([visible[i][0]-dy/length*half, visible[i][1]+dx/length*half]);
      right.push([visible[i][0]+dy/length*half, visible[i][1]-dx/length*half]);
    }
    ctx.save(); ctx.globalAlpha *= alpha; ctx.beginPath();
    left.forEach((q,i) => i ? ctx.lineTo(q[0],q[1]) : ctx.moveTo(q[0],q[1]));
    right.reverse().forEach(q => ctx.lineTo(q[0],q[1]));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  const stroke = (ctx,pts,p=1,w=1,a=.85) => pen(ctx,polygon(pts),p,w,a,.25);
  function ellipse(cx,cy,rx,ry,start=0,end=Math.PI*2,n=48) {
    return Array.from({length:n+1},(_,i) => {
      const a=lerp(start,end,i/n); return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];
    });
  }
  function erase(ctx,shape) {
    ctx.save(); ctx.globalCompositeOperation='destination-out';
    ctx.beginPath(); shape.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function pencilColor(ctx,shape,pigment,opacity=.35,angle=-.58,spacing=1.6,reveal=1) {
    if(reveal<=0||shape.length<3)return;
    const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
    const us=shape.map(q=>q[0]*dx+q[1]*dy),vs=shape.map(q=>q[0]*nx+q[1]*ny);
    const u0=Math.min(...us)-3,u1=Math.max(...us)+3;
    const v0=Math.floor(Math.min(...vs)/spacing),v1=Math.ceil(Math.max(...vs)/spacing);
    const xs=shape.map(q=>q[0]),ys=shape.map(q=>q[1]);
    const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    ctx.save(); ctx.globalCompositeOperation='destination-over'; ctx.fillStyle=pigment;
    ctx.beginPath(); shape.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));
    ctx.closePath();ctx.clip();
    if(reveal<1){ctx.beginPath();ctx.rect(x0-1,y0-1,(x1-x0+2)*reveal,y1-y0+2);ctx.clip();}
    for(let k=v0;k<=v1;k++) {
      const n=Math.sin(k*12.9898+37.17)*43758.5453,f=n-Math.floor(n),v=k*spacing+(f-.5)*.26;
      const a=[dx*u0+nx*v,dy*u0+ny*v],b=[dx*u1+nx*v,dy*u1+ny*v];
      pen(ctx,segment(a,b),1,.8+f*.65,opacity*(.72+f*.28),.85);
    }
    ctx.restore();
  }
  function ribbon(pts,halfWidth=2.4) {
    const sides=[[],[]];
    pts.forEach((q,i)=>{
      const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
      const t=i/(pts.length-1),w=halfWidth*(.42+.58*Math.sin(Math.PI*t));
      sides[0].push([q[0]-dy/len*w,q[1]+dx/len*w]);
      sides[1].push([q[0]+dy/len*w,q[1]-dx/len*w]);
    });
    return sides[0].concat(sides[1].reverse());
  }
  function dashed(ctx,pts,amount,width,alpha) {
    // Short authored intervals read as provisional pencil, not an animated dash.
    for(let i=0;i<pts.length-1;i+=7) {
      const end=Math.min(i+4,pts.length-1);
      pen(ctx,pts.slice(i,end+1),phase(amount,i/(pts.length-1),end/(pts.length-1)),width,alpha);
    }
  }

  function choices(ctx,p) {
    const root=curve([30,84],[52,82],[65,69],[84,57],42);
    const upper=curve([84,57],[114,29],[143,23],[181,28],48);
    const middle=curve([84,57],[116,52],[144,61],[184,56],42);
    const lower=curve([84,57],[110,81],[143,93],[177,87],44);
    const choice=chain(root,upper);

    // Explore three routes first. None is enclosed in a box or a diagram node.
    pen(ctx,root,phase(p,.025,.28),.65,.46);
    pen(ctx,upper,phase(p,.15,.43),.52,.29);
    pen(ctx,middle,phase(p,.22,.49),.52,.28);
    pen(ctx,lower,phase(p,.28,.55),.52,.28);
    // Small pressure tails retain the feel of a pencil lifted off the page.
    pen(ctx,curve([164,56.9],[170,57.5],[177,56.8],[183,57.1]),phase(p,.42,.59),.28,.15);
    pen(ctx,curve([152,89],[163,90],[168,88.4],[175,87.9]),phase(p,.46,.62),.27,.14);

    // A considered pause precedes the decisive stroke. Its grain stays anchored.
    const commit=phase(p,.57,.91);
    pencilColor(ctx,ribbon(choice,2.6),pigments.sage,.29,-.62,1.25,commit);
    pen(ctx,choice,commit,.96,.78);
    // An open, lightly retraced oval resolves the selected end, not a UI icon.
    const end=chain(
      curve([180.6,24.2],[185.8,23.3],[188.3,27.1],[185.5,30.8],22),
      curve([185.5,30.8],[181.6,33.3],[177.7,29.6],[180.6,24.2],22)
    );
    pen(ctx,end,phase(p,.87,.97),.66,.66);
    pencilColor(ctx,end,pigments.blue,.25,-.54,1.15,phase(p,.9,.98));
  }

  function board(ctx,p) {
    const A=[78,24],B=[194,43],C=[145,91],D=[29,71];
    const map=(u,v)=>[lerp(lerp(A[0],B[0],u),lerp(D[0],C[0],u),v),
                     lerp(lerp(A[1],B[1],u),lerp(D[1],C[1],u),v)];
    const project=pts=>pts.map(q=>map(q[0],q[1]));
    const outline=[A,B,C,D,A];
    stroke(ctx,outline,phase(p,.015,.36),.84,.73);
    stroke(ctx,[D,[D[0]+.1,D[1]+2.6],[C[0],C[1]+2.8],[B[0],B[1]+2.4],B],phase(p,.16,.42),.5,.42);
    stroke(ctx,[C,[C[0],C[1]+2.8]],phase(p,.3,.44),.46,.37);
    pencilColor(ctx,[D,C,[C[0],C[1]+2.8],[D[0]+.1,D[1]+2.6]],pigments.ochre,.3,-.5,1.3,phase(p,.28,.5));

    // A quiet board with a few ruled divisions, not a recognisable chess set.
    [.25,.5,.75].forEach((u,i)=>pen(ctx,project(segment([u,0],[u,1])),phase(p,.15+i*.045,.39+i*.045),.34,.24));
    [.333,.667].forEach((v,i)=>pen(ctx,project(segment([0,v],[1,v])),phase(p,.21+i*.05,.46+i*.05),.34,.24));
    const destinationCell=project([[.5,0],[.75,0],[.75,.333],[.5,.333]]);
    pencilColor(ctx,destinationCell,pigments.sage,.19,-.62,1.5,phase(p,.48,.78));

    const start=[.25,.72],target=[.625,.25];
    const chosenUV=curve(start,[.37,.7],[.46,.37],target,48);
    const chosen=project(chosenUV);
    const optionA=project(curve(start,[.19,.57],[.13,.36],[.17,.19],42));
    const optionB=project(curve(start,[.47,.79],[.65,.86],[.82,.76],42));
    dashed(ctx,optionA,phase(p,.35,.57),.49,.34);
    dashed(ctx,optionB,phase(p,.4,.61),.49,.34);
    dashed(ctx,chosen,phase(p,.44,.64),.47,.35);
    const ghostA=map(.17,.19),ghostB=map(.82,.76);
    pen(ctx,ellipse(...ghostA,3.6,1.6),phase(p,.53,.63),.42,.29);
    pen(ctx,ellipse(...ghostB,3.6,1.6),phase(p,.57,.67),.42,.29);

    const move=smooth(phase(p,.64,.92));
    const t=move,u=1-t;
    const uv=[u*u*u*start[0]+3*u*u*t*.37+3*u*t*t*.46+t*t*t*target[0],
              u*u*u*start[1]+3*u*u*t*.7+3*u*t*t*.37+t*t*t*target[1]];
    const at=map(...uv);
    pencilColor(ctx,ribbon(chosen,1.6),pigments.ochre,.2,-.57,1.3,phase(p,.65,.93));
    pen(ctx,chosen,move,.64,.63);
    const origin=map(...start);
    pen(ctx,ellipse(...origin,3.5,1.55),phase(p,.72,.9),.4,.27);

    // One plain wooden counter lifts, chooses, and settles. No repeated bobbing.
    const appear=smooth(phase(p,.26,.43));
    if(appear>0){
      const lift=2.7*Math.sin(Math.PI*move);
      const x=at[0],y=at[1]-lift-3*(1-appear);
      const body=chain(
        curve([x-5.6,y-1],[x-5.2,y-5],[x-4.4,y-9],[x-4.6,y-12],18),
        ellipse(x,y-12,4.6,2.1,Math.PI,Math.PI*2,22),
        curve([x+4.6,y-12],[x+4.8,y-8],[x+5.4,y-4],[x+5.6,y-1],18),
        ellipse(x,y-1,5.6,2.4,0,Math.PI,22)
      );
      ctx.save();ctx.globalAlpha*=appear;
      erase(ctx,body);
      pen(ctx,body,1,.78,.78);
      pen(ctx,ellipse(x,y-12,4.6,2.1,0,Math.PI,22),1,.55,.55);
      pencilColor(ctx,body,pigments.blue,.27,-.64,1.25);
      pen(ctx,curve([x+3.3,y-9],[x+3.7,y-7],[x+3.9,y-4],[x+4.2,y-2]),1,.3,.23);
      ctx.restore();
    }
  }

  window.drawMidoStrategyOption=function(ctx,variant,p,width,height,ink){
    if(!ctx||!(width>0)||!(height>0))return;
    const progress=Number.isFinite(p)?clamp(p):1;
    ctx.clearRect(0,0,width,height);ctx.save();
    const scale=Math.min(width/220,height/112);
    ctx.translate((width-220*scale)/2,(height-112*scale)/2);ctx.scale(scale,scale);
    ctx.fillStyle=ink||'#252522';ctx.strokeStyle=ink||'#252522';
    (variant==='board'?board:choices)(ctx,progress);
    ctx.restore();
  };
})();
