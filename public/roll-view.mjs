// Generic code-drawn vehicle, projected from a fixed three-quarter camera.
// Only y/z rotate: the longitudinal x axis does not pitch or yaw.
const NS='http://www.w3.org/2000/svg';
const node=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
export const rollPoint=([x,y,z],angle)=>[x,y*Math.cos(angle)-z*Math.sin(angle),y*Math.sin(angle)+z*Math.cos(angle)];
const project=([x,y,z])=>[.866*x+.5*y,.171*x-.296*y-.94*z,.47*x-.814*y+.342*z];
const sum=(a,b)=>a.map((v,i)=>v+b[i]);
export function thrusterCaption(jets,language='en'){
 const zh=language==='zh',label=zh?{'spin-up':'气流建立横滚','spin-down':'反向气流制动横滚',coast:'喷流关闭；角速度可不为零',off:'接触阶段喷流关闭'}:{'spin-up':'Jets build roll','spin-down':'Reverse jets brake roll',coast:'Jets off; angular speed may remain',off:'Jets off during contact'};
 return label[jets.phase]+(jets.active?` · τ=${Number((jets.torque/1000).toFixed(2))} kN·m · ${zh?'每个推力':'each force'}=${Number((jets.forceEach/1000).toFixed(2))} kN`:'');
}
export function mountRollVehicle(parent,color='#176f65'){
 const group=node('g',{'data-roll-vehicle':'true'});parent.append(group);
 const faces=[];
 const addFace=(points,fill)=>{const element=node('polygon',{fill,stroke:'#243d37','stroke-width':.5,'stroke-linejoin':'round'});faces.push({points,element});group.append(element);};
 const box=(x1,x2,y1,y2,z1,z2,colors)=>{
  const p=[[x1,y1,z1],[x2,y1,z1],[x2,y2,z1],[x1,y2,z1],[x1,y1,z2],[x2,y1,z2],[x2,y2,z2],[x1,y2,z2]];
  [[0,3,2,1],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].forEach((ids,i)=>addFace(ids.map(j=>p[j]),Array.isArray(colors)?colors[i]:colors));
 };
 box(-38,38,-21,21,-7,7,['#253b36',color,color,color,color,'#75a99a']);
 // Trapezoidal passenger cabin: clearly different roof and underside at half roll.
 const lower=[[-24,-19,7],[24,-19,7],[24,19,7],[-24,19,7]],upper=[[-14,-16,23],[11,-16,23],[11,16,23],[-14,16,23]];
 for(let i=0;i<4;i++)addFace([lower[i],lower[(i+1)%4],upper[(i+1)%4],upper[i]],i===1?'#d9efec':'#a9cbd0');
 addFace(upper,'#e4eeea');
 for(const x of [-25,25])for(const y of [-24,24]){
  const ring=side=>Array.from({length:12},(_,i)=>[x+7*Math.cos(i*Math.PI/6),y+side*3,-7+7*Math.sin(i*Math.PI/6)]);
  const a=ring(-1),b=ring(1);addFace(a,'#1d302c');addFace(b,'#1d302c');
  for(let i=0;i<12;i++)addFace([a[i],a[(i+1)%12],b[(i+1)%12],b[i]],'#314a43');
 }
 for(const y of [-15,15]){addFace([[38,y-4,-1],[38,y+4,-1],[38,y+4,3],[38,y-4,3]],'#f8e5b3');addFace([[-38,y-4,-1],[-38,y+4,-1],[-38,y+4,3],[-38,y-4,3]],'#ba7356');}
 const axis=node('path',{fill:'none',stroke:'#6f8f88','stroke-width':1,'stroke-dasharray':'3 3',opacity:.7});group.append(axis);
 const ports=[-1,1].map(side=>{
  const plume=node('path',{fill:'#83d0e4',stroke:'#57a9c0','stroke-width':.7,opacity:.65}),core=node('path',{fill:'#edfdfd',opacity:.9}),streak=node('path',{fill:'none',stroke:'#6bbccf','stroke-width':1.2}),force=node('path',{fill:'none',stroke:'#b86b3b','stroke-width':1.8}),nozzle=node('circle',{r:2.5,fill:'#375e61',stroke:'#b4ecf3','stroke-width':1});
  group.append(plume,core,streak,force,nozzle);return {side,plume,core,streak,force,nozzle};
 });
 const path=points=>points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
 return {group,set({angle=0,jets={active:false,ports:[]},time=0,scale=1,opacity=1,x=0,y=0}){
  group.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);group.setAttribute('opacity',opacity);
  group.dataset.jetPhase=jets.phase??'off';group.dataset.rollAngle=String(angle);group.dataset.activeJets=jets.active?'2':'0';
  const P=p=>project(rollPoint(p,angle));
  const ordered=faces.map(f=>{const points=f.points.map(P);f.element.setAttribute('points',points.map(p=>p.slice(0,2).join(',')).join(' '));return {...f,depth:points.reduce((v,p)=>v+p[2],0)/points.length};}).sort((a,b)=>a.depth-b.depth);
  for(const f of ordered)group.append(f.element);
  axis.setAttribute('d',path([P([-51,0,0]),P([51,0,0])]));group.append(axis);
  for(const port of ports){
   const anchor=[0,port.side*27,0],point=P(anchor);port.nozzle.setAttribute('cx',point[0]);port.nozzle.setAttribute('cy',point[1]);group.append(port.nozzle);
   const jet=jets.ports.find(p=>p.side===port.side);for(const n of [port.plume,port.core,port.streak,port.force])n.setAttribute('visibility',jet?'visible':'hidden');if(!jet)continue;
   const direction=-jet.bodyDirection,length=18+48*Math.sqrt(jets.intensity),width=4+4*jets.intensity;
   const exhaust=(dz,dy=0)=>P(sum(anchor,[0,dy,direction*dz]));
   port.plume.setAttribute('d',path([exhaust(2,-2),exhaust(length,-width),exhaust(length+6,0),exhaust(length,width),exhaust(2,2)])+' Z');
   port.core.setAttribute('d',path([exhaust(1,-1),exhaust(length*.82,0),exhaust(1,1)])+' Z');
   const drift=(time*2.7)%1;
   port.streak.setAttribute('d',[-1,1].map(side=>path([exhaust(length*(.15+.25*drift),side*width*.45),exhaust(length*(.55+.35*drift),side*width*.8)])).join(' '));
   const start=P(sum(anchor,[0,0,jet.bodyDirection*5])),end=P(sum(anchor,[0,0,jet.bodyDirection*(16+14*jets.intensity)]));
   const dx=end[0]-start[0],dy=end[1]-start[1],n=Math.hypot(dx,dy),ux=dx/n,uy=dy/n;
   port.force.setAttribute('d',path([start,end])+` M ${end[0]-ux*5-uy*3} ${end[1]-uy*5+ux*3} L ${end[0]} ${end[1]} L ${end[0]-ux*5+uy*3} ${end[1]-uy*5-ux*3}`);
   group.append(port.plume,port.core,port.streak,port.force,port.nozzle);
  }
 }};
}
