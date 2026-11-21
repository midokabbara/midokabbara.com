(function () {
  'use strict';

  // Independent, transparent 220 × 112 consulting sketch. The caller owns playback;
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

  // All paper and pencil positions are authored poses. Repeated renders of a
  // progress value therefore have exactly the same contours and pencil grain.
  function note(ctx,pose,progress,kind,pigment) {
    if(progress<=0)return;
    const [x,y,angle,w,h]=pose;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const shape=[[-w/2,-h/2],[w/2,-h/2+.7],[w/2-.6,h/2],[-w/2,h/2-.8]];
    stroke(ctx,shape.concat([shape[0]]),phase(progress,0,.62),.62,.59);
    stroke(ctx,[[-w/2,h/2+.7],[w/2-.7,h/2+1.5]],phase(progress,.4,.85),.3,.25);
    const tint=[[-w/2+4,-h/2+5],[-w/2+18,-h/2+5.5],[-w/2+17,-h/2+11],[-w/2+4,-h/2+10.5]];
    pencilColor(ctx,tint,pigment,.3,-.59,1.25,phase(progress,.45,.88));
    // Small authored strokes suggest work notes, without invented handwriting.
    const left=-w/2+5,top=-h/2+15;
    const lengths=kind===0?[w-15,w-22,w-18]:kind===1?[w-18,w-11,w-27]:[w-13,w-20,w-14];
    lengths.forEach((length,i)=>{
      const line=curve([left,top+i*4.3],[left+length*.27,top+i*4.3-.35],
        [left+length*.66,top+i*4.3+.4],[left+length,top+i*4.3+.05],16);
      pen(ctx,line,phase(progress,.52+i*.055,.83+i*.055),.34,.34);
    });
    ctx.restore();
  }

  function drawingPencil(ctx,tip,angle,alpha) {
    if(alpha<=0)return;
    const [x,y]=tip,dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
    const pt=(d,s)=>[x+dx*d+nx*s,y+dy*d+ny*s];
    const outline=[pt(0,0),pt(4.4,-1.3),pt(40,-1.3),pt(41,0),pt(40,1.3),pt(4.4,1.3),pt(0,0)];
    ctx.save();ctx.globalAlpha*=alpha;
    erase(ctx,outline);stroke(ctx,outline,1,.55,.68);
    stroke(ctx,[pt(4.4,-1.3),pt(5.2,0),pt(4.4,1.3)],1,.35,.38);
    stroke(ctx,[pt(6,0),pt(38.8,0)],1,.34,.25);
    pencilColor(ctx,[pt(5.3,-1.2),pt(39,-1.2),pt(39,1.2),pt(5.3,1.2)],pigments.ochre,.36,-.48,1.2);
    pen(ctx,segment(pt(0,0),pt(1.65,0)),1,.77,.79);
    ctx.restore();
  }

  function synthesis(ctx,p) {
    // Three distinct observations arrive as loose paper, then gather once.
    const gather=smooth(phase(p,.29,.59));
    const starts=[[43,62,-.19,46,34],[116,26,.13,55,30],[173,63,.18,44,32]];
    const ends=[[71,49,-.26,46,34],[111,29,.075,55,30],[140,57,.22,44,32]];
    starts.forEach((s,i)=>{
      const pose=s.map((v,j)=>lerp(v,ends[i][j],gather));
      note(ctx,pose,phase(p,.025+i*.045,.32+i*.045),i,[pigments.blue,pigments.sage,pigments.ochre][i]);
    });

    // The recommendation is a larger, orderly sheet laid over the source notes.
    // Transparent knockout supplies occlusion without an opaque background.
    const sheetProgress=phase(p,.44,.73),slide=4*(1-smooth(sheetProgress));
    const A=[73,25+slide],B=[165,36+slide],C=[149,95+slide],D=[57,84+slide];
    const map=(u,v)=>[lerp(lerp(A[0],B[0],u),lerp(D[0],C[0],u),v),
      lerp(lerp(A[1],B[1],u),lerp(D[1],C[1],u),v)];
    const project=pts=>pts.map(q=>map(q[0],q[1]));
    if(sheetProgress>0){
      ctx.save();ctx.globalAlpha*=smooth(phase(sheetProgress,0,.3));erase(ctx,[A,B,C,D]);ctx.restore();
      stroke(ctx,[A,B,C,D,A],sheetProgress,.83,.76);
      stroke(ctx,[[D[0]+.1,D[1]+1.6],[C[0],C[1]+1.7],[B[0]+.5,B[1]+1.3]],phase(p,.62,.8),.32,.31);
    }

    // A short heading and two concise points make the front sheet visibly
    // clearer than the loose notes. These are writing marks, not fake words.
    const title=project(curve([.16,.19],[.31,.18],[.48,.195],[.62,.19],24));
    pen(ctx,title,phase(p,.66,.79),.71,.64);
    pencilColor(ctx,project([[.145,.155],[.65,.155],[.65,.225],[.145,.225]]),pigments.blue,.22,-.62,1.25,phase(p,.71,.85));
    const rows=[{v:.4,end:.77},{v:.57,end:.62}];
    rows.forEach((r,i)=>{
      const dot=map(.17,r.v);
      pen(ctx,ellipse(dot[0],dot[1],.7,.58),phase(p,.72+i*.05,.8+i*.05),.45,.49);
      const line=project(curve([.23,r.v],[.37,r.v-.006],[.49,r.v+.005],[r.end,r.v],24));
      pen(ctx,line,phase(p,.73+i*.045,.84+i*.045),.42,.54);
      if(i===0)pen(ctx,project(segment([.23,r.v+.065],[.63,r.v+.065])),phase(p,.77,.87),.31,.31);
    });

    // The pencil draws one final, economical underline, lifts, and comes to rest.
    const markProgress=smooth(phase(p,.82,.94));
    const finalMark=project(curve([.24,.77],[.35,.765],[.46,.774],[.56,.77],30));
    pen(ctx,finalMark,markProgress,.61,.63);
    const at=map(lerp(.24,.56,markProgress),.77);
    const rest=smooth(phase(p,.94,.99));
    const restTip=[148,87],tip=[lerp(at[0],restTip[0],rest),lerp(at[1],restTip[1],rest)-2.2*Math.sin(Math.PI*rest)];
    const appear=smooth(phase(p,.79,.825));
    drawingPencil(ctx,tip,lerp(-.80,-.71,rest),appear);
  }

  window.drawMidoConsultingOption=function(ctx,variant,p,width,height,ink){
    if(!ctx||!(width>0)||!(height>0))return;
    const progress=Number.isFinite(p)?clamp(p):1;
    ctx.clearRect(0,0,width,height);ctx.save();
    const scale=Math.min(width/220,height/112);
    ctx.translate((width-220*scale)/2,(height-112*scale)/2);ctx.scale(scale,scale);
    ctx.fillStyle=ink||'#252522';ctx.strokeStyle=ink||'#252522';
    synthesis(ctx,progress);
    ctx.restore();
  };
})();
