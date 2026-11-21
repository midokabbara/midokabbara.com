(function () {
  'use strict';

  // Independent, transparent 220 × 112 product-iteration sketch. The caller owns playback;
  // a single 4.0 second pass from p=0 to p=1 ends in a still drawing.
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

  const ground=86, radius=8, originX=44, axleSpacing=46, travel=45;

  // The awkward pass is an exact quarter-turn about the square's lower-right
  // corner. Both axles share the same phase, so the rigid tray stays level.
  function poseAt(p) {
    const turn=smooth(phase(p,.25,.46)),theta=turn*Math.PI/2;
    const rounded=smooth(phase(p,.52,.68));
    const distance=travel*smooth(phase(p,.705,.965));
    return {
      x:originX+radius*(1-Math.cos(theta)+Math.sin(theta))+distance,
      y:ground-radius*(Math.sin(theta)+Math.cos(theta)),
      angle:theta+distance/radius,
      rounded
    };
  }
  function wheelContour(cx,cy,angle,rounded) {
    const ca=Math.cos(angle),sa=Math.sin(angle);
    return Array.from({length:97},(_,i)=>{
      const t=i/96*Math.PI*2,c=Math.cos(t),s=Math.sin(t);
      const squareRadius=radius/Math.max(Math.abs(c),Math.abs(s));
      const r=lerp(squareRadius,radius,rounded),x=r*c,y=r*s;
      return [cx+x*ca-y*sa,cy+x*sa+y*ca];
    });
  }
  function wheel(ctx,cx,cy,pose,p) {
    const outline=wheelContour(cx,cy,pose.angle,pose.rounded);
    const amount=phase(p,.08,.235);
    pencilColor(ctx,outline,pigments.sage,.12,-.58,1.25,phase(p,.17,.25));
    pen(ctx,outline,amount,.81,.79);
    pen(ctx,ellipse(cx,cy,1.08,1.02),phase(p,.145,.24),.48,.55);
    const spokeAngle=pose.angle+.22;
    const tip=[cx+Math.cos(spokeAngle)*5.4,cy+Math.sin(spokeAngle)*5.4];
    pen(ctx,segment([cx+Math.cos(spokeAngle)*1.45,cy+Math.sin(spokeAngle)*1.45],tip),phase(p,.16,.24),.39,.39);
  }

  function cart(ctx,p) {
    const pose=poseAt(p),trayY=pose.y-13;
    const at=(x,y)=>[pose.x+x,trayY+y];
    const project=points=>points.map(q=>at(...q));

    // The ground is a quiet datum, not a travelling shadow or a speed line.
    pen(ctx,curve([20,ground],[66,ground-.14],[148,ground+.15],[202,ground],64),phase(p,.015,.195),.38,.28);

    // Axle supports are behind the wheel rims. The cargo, platform and handle
    // share one rigid transform; nothing floats while the square wheels rise.
    [[18,2.5],[18+axleSpacing,2.5]].forEach((q,i)=>
      pen(ctx,segment(at(...q),at(q[0],13)),phase(p,.055+i*.012,.19+i*.012),.59,.56));
    const platform=project([[0,0],[78,0],[80,-4.6],[80,2.6],[0,2.6],[0,0]]);
    stroke(ctx,platform,phase(p,.025,.19),.76,.73);
    pen(ctx,project(curve([1.3,1.4],[25,1.3],[52,1.7],[77.8,1.35],28)),phase(p,.09,.21),.32,.29);
    const handle=project(chain(
      segment([7,-.1],[-5.5,-32.4]),
      curve([-5.5,-32.4],[-6.0,-34.2],[-7.3,-35],[-9.2,-35],12),
      segment([-9.2,-35],[-18,-35])
    ));
    pen(ctx,handle,phase(p,.055,.215),.82,.72);
    pen(ctx,project(segment([-17.2,-35],[-10.5,-35])),phase(p,.16,.235),1.3,.38);

    const front=project([[28,-26],[55,-26],[55,0],[28,0],[28,-26]]);
    const top=project([[28,-26],[34,-31],[61,-31],[55,-26],[28,-26]]);
    const side=project([[55,-26],[61,-31],[61,-5],[55,0],[55,-26]]);
    const reveal=phase(p,.13,.245);
    pencilColor(ctx,front,pigments.blue,.35,-.61,1.3,reveal);
    pencilColor(ctx,top,pigments.blue,.17,-.61,1.3,reveal);
    pencilColor(ctx,side,pigments.blue,.25,-.61,1.3,reveal);
    stroke(ctx,top,phase(p,.055,.19),.55,.59);
    stroke(ctx,side,phase(p,.075,.205),.57,.63);
    stroke(ctx,front,phase(p,.065,.21),.71,.72);
    // A faint second pass at the resting edge lends pencil pressure without a
    // fuzzy duplicate contour around the whole block.
    pen(ctx,project(curve([28.6,-.5],[37,-.35],[47,-.6],[54.5,-.45],20)),phase(p,.17,.245),.32,.20);

    wheel(ctx,pose.x+18,pose.y,pose,p);
    wheel(ctx,pose.x+18+axleSpacing,pose.y,pose,p);
  }

  window.drawMidoProductCart=function(ctx,p,width,height,ink){
    if(!ctx||!(width>0)||!(height>0))return;
    const progress=Number.isFinite(p)?clamp(p):1;
    ctx.clearRect(0,0,width,height);ctx.save();
    const scale=Math.min(width/220,height/112);
    ctx.translate((width-220*scale)/2,(height-112*scale)/2);ctx.scale(scale,scale);
    ctx.fillStyle=ink||'#252522';ctx.strokeStyle=ink||'#252522';
    cart(ctx,progress);ctx.restore();
  };
})();
