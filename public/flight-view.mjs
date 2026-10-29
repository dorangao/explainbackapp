import {rotationAt,contactAt,flightAt,flightSummary,airThrustersAt} from './flight.mjs';
import {mountRollVehicle,thrusterCaption} from './roll-view.mjs';
const NS='http://www.w3.org/2000/svg';
const svgNode=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const fmt=n=>Number(n.toFixed(3));
const rotationMetrics=['angle','omega','torque'];
export const flightMetrics=[['angle','Roll angle θ (rad)','横滚角 θ (rad)'],['omega','Roll rate ω (rad/s)','横滚角速度 ω (rad/s)'],['torque','Roll torque τ (kN·m)','横滚力矩 τ (kN·m)'],['height','Vertical position (m)','竖直位置 (m)'],['verticalVelocity','Vertical velocity (m/s)','竖直速度 (m/s)'],['contactForce','Upward contact force (kN)','向上接触力 (kN)']];
function value(s,metric,t,mode='controlled',contact=false){
 if(rotationMetrics.includes(metric))return rotationAt(s,mode,t)[metric]/(metric==='torque'?1000:1);
 const p=contact?contactAt(s,Math.min(s.stopTime,Math.max(0,t-s.airtime))):flightAt(s,t);
 return p[metric]/(metric==='contactForce'?1000:1);
}
export function flightReadout(s,time,metric,language){
 const zh=language==='zh',t=Math.min(s.airtime+s.stopTime,Math.max(0,time)),label=flightMetrics.find(m=>m[0]===metric)?.[zh?2:1];
 if(rotationMetrics.includes(metric))return t>s.airtime?(zh?'已进入接触阶段；接地后的旋转未模拟，A 的剩余角速度并未消失。':'Contact phase: post-touchdown rotation is not modeled; A’s residual spin has not disappeared.'):
  `t=${fmt(t)} s · ${label}: A=${fmt(value(s,metric,t,'coast'))}, B=${fmt(value(s,metric,t))}`;
 return `t=${fmt(t)} s · ${label}: ${fmt(value(s,metric,t))} · ${t>s.airtime?(zh?'竖直制停':'vertical stopping'):(zh?'抛体飞行':'ballistic flight')}`;
}
export function drawFlightView(scene,plot,panel,graph,language,time=0,metric='torque'){
 const zh=language==='zh',info=flightMetrics.find(m=>m[0]===metric);if(!info)throw new Error('Unknown flight graph.');
 scene.hidden=!graph;panel.hidden=!graph;plot.classList.toggle('flight-plot',Boolean(graph));
 if(!graph){scene.replaceChildren();panel.replaceChildren();const svg=svgNode('svg',{viewBox:'0 0 640 400',role:'img','aria-label':zh?'先预测，核验后显示横滚。':'Predict first; rotation appears after checking.'});svg.append(svgNode('text',{x:320,y:190,'text-anchor':'middle',fill:'#5d6c67','font-size':18},zh?'先预测，再探索横滚与着陆。':'Predict, then explore sideways roll and landing.'));plot.replaceChildren(svg);return;}
 const s=graph.scenario,r=flightSummary(s),end=s.airtime+s.stopTime,t=Math.max(0,Math.min(end,time)),flightTime=Math.min(t,s.airtime);
 const picture=svgNode('svg',{viewBox:'0 0 640 350',role:'img','aria-label':zh?'绕车身纵轴侧向翻滚。A 自由旋转，B 由相反气流的反作用力控制。':'Sideways roll about the longitudinal axis. A coasts; opposed air-jet reaction forces control B.'});
 picture.append(svgNode('text',{x:20,y:22,fill:'#20332f','font-size':14},zh?'侧向翻滚 · 绕车头到车尾的纵轴 · 图示不按比例':'Sideways roll · front-to-back axis · schematic scales'));
 picture.append(svgNode('line',{x1:30,y1:244,x2:610,y2:244,stroke:'#9bab9f','stroke-dasharray':'4 5'}));
 const h=flightAt(s,flightTime).height,y=225-h/Math.max(.1,r.apexHeight)*90;
 for(const [mode,x,color,name]of [['coast',174,'#116d60',zh?'A · 无喷流，自由旋转':'A · unpowered coast'],['controlled',466,'#a35c32',zh?'B · 理想空气推力偶':'B · ideal air-jet couple']]){
  const p=rotationAt(s,mode,flightTime),jets=airThrustersAt(s,mode,flightTime,t<=s.airtime);
  mountRollVehicle(picture,color).set({x,y,angle:p.angle,jets,time:flightTime,opacity:t>s.airtime?.55:1});
  picture.append(svgNode('text',{x,y:49,'text-anchor':'middle',fill:color,'font-size':14},name));
  picture.append(svgNode('text',{x,y:268,'text-anchor':'middle',fill:color,'font-size':12},`θ=${fmt(p.angle)} rad · ω=${fmt(p.omega)} rad/s`));
 }
 const jets=airThrustersAt(s,'controlled',flightTime,t<=s.airtime);
 picture.setAttribute('aria-label',picture.getAttribute('aria-label')+' '+thrusterCaption(jets,language));
 picture.append(svgNode('text',{x:320,y:294,'text-anchor':'middle',fill:'#365c64','font-size':12},thrusterCaption(jets,language)));
 picture.append(svgNode('text',{x:320,y:318,'text-anchor':'middle',fill:'#5d6c67','font-size':12},zh?'蓝色：示意排气；橙色：反向作用在车上的力。':'Blue: illustrative exhaust. Orange: opposite force on the vehicle.'));
 picture.append(svgNode('text',{x:320,y:340,'text-anchor':'middle',fill:t>s.airtime?'#8c352b':'#5d6c67','font-size':11},t>s.airtime?(zh?'接地快照；后续旋转未模拟，A 仍有剩余角动量。':'Touchdown snapshot; later rotation unresolved, including A’s spin.'):(zh?`质心高度 h=${fmt(h)} m；气体储存、流量与执行器能力未建模。`:`COM height h=${fmt(h)} m; gas storage, flow and actuator capability unmodeled.`)));
 scene.replaceChildren(picture);
 const svg=svgNode('svg',{viewBox:'0 0 640 370',role:'img','aria-label':info[zh?2:1]}),left=72,right=614,top=38,bottom=303;
 const rotational=rotationMetrics.includes(metric),contactOnly=metric==='contactForce',xStart=contactOnly?s.airtime:0,plotSpan=end-xStart,series=[];
 if(rotational){for(const [mode,color,dash]of [['coast','#116d60',''],['controlled','#a35c32','7 4']])series.push({color,dash,points:Array.from({length:121},(_,i)=>{const x=s.airtime*i/120;return [x,value(s,metric,x,mode)];})});}
 else{
  // Separate paths preserve the one-sided contact-force jump at touchdown.
  if(!contactOnly)series.push({color:'#116d60',points:Array.from({length:101},(_,i)=>{const x=s.airtime*i/100;return [x,value(s,metric,x)];})});
  series.push({color:'#a35c32',points:Array.from({length:101},(_,i)=>{const x=s.airtime+s.stopTime*i/100;return [x,value(s,metric,x,'controlled',true)];})});
 }
 const ys=series.flatMap(l=>l.points.map(p=>p[1])),lo=Math.min(0,...ys),hi=Math.max(1e-6,...ys),range=hi-lo;
 const px=x=>left+(x-xStart)/plotSpan*(right-left),py=v=>bottom-(v-lo+range*.05)/(range*1.1)*(bottom-top);
 svg.append(svgNode('rect',{x:px(s.airtime),y:top,width:right-px(s.airtime),height:bottom-top,fill:'#e5dfd2',opacity:.55}));
 svg.append(svgNode('text',{x:left,y:20,fill:'#20332f','font-size':14},info[zh?2:1]));
 for(let i=0;i<=4;i++){const x=xStart+plotSpan*i/4,v=lo+range*i/4;svg.append(svgNode('line',{x1:px(x),y1:top,x2:px(x),y2:bottom,stroke:'#d6ddd5'}),svgNode('text',{x:px(x),y:bottom+20,'text-anchor':'middle',fill:'#5d6c67','font-size':11},fmt(x-xStart)),svgNode('line',{x1:left,y1:py(v),x2:right,y2:py(v),stroke:'#d6ddd5'}),svgNode('text',{x:left-7,y:py(v)+4,'text-anchor':'end',fill:'#5d6c67','font-size':11},fmt(v)));}
 for(const line of series)svg.append(svgNode('path',{d:line.points.map(([x,v],i)=>`${i?'L':'M'}${px(x)},${py(v)}`).join(' '),fill:'none',stroke:line.color,'stroke-width':2.5,'stroke-dasharray':line.dash??''}));
 if(metric==='contactForce')svg.append(svgNode('line',{x1:px(s.airtime),y1:py(r.averageContactForce/1000),x2:right,y2:py(r.averageContactForce/1000),stroke:'#8c352b','stroke-dasharray':'3 4'}));
 svg.append(svgNode('line',{x1:px(s.airtime),y1:top,x2:px(s.airtime),y2:bottom,stroke:'#8c352b','stroke-dasharray':'3 5'}));
 if(t>=xStart)svg.append(svgNode('line',{x1:px(t),y1:top,x2:px(t),y2:bottom,stroke:'#20332f','stroke-width':1.5}));
 svg.append(svgNode('text',{x:right,y:346,'text-anchor':'end',fill:'#5d6c67','font-size':12},contactOnly?(zh?'接地后经过时间 t−T (s) · 接触阶段放大':'Elapsed contact time t−T (s) · contact zoom'):(zh?`时间 t (s) · 阴影：接触阶段，T=${s.airtime}`:`Time t (s) · shaded: contact, T=${s.airtime}`)));
 plot.replaceChildren(svg);
 renderPanel(panel,s,r,zh);
}
function table(headers,rows){const table=el('table',undefined,'physics-table'),head=el('thead'),tr=el('tr');for(const name of headers){const th=el('th',name);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=el('tbody');for(const row of rows){const tr=el('tr');row.forEach((v,i)=>{const cell=el(i?'td':'th',String(v));if(!i)cell.scope='row';tr.append(cell);});body.append(tr);}table.append(body);return table;}
function renderPanel(panel,s,r,zh){
 panel.setAttribute('aria-label',zh?'旋转与接触证据':'Rotation and contact evidence');
 const title=el('h3',zh?'一圈之后，还有什么没停下？':'After one turn, what is still moving?');
 const rotation=table([zh?'旋转量':'Rotation','A','B'],[
  [zh?'接地角度 (rad)':'Touchdown angle (rad)',fmt(2*Math.PI),fmt(2*Math.PI)],
  [zh?'接地角速度 (rad/s)':'Touchdown ω (rad/s)',fmt(r.touchdownOmegaA),0],
  [zh?'空中峰值 |力矩| (N·m)':'Peak airborne |torque| (N·m)',0,fmt(r.peakTorque)],
  [zh?'剩余转动能 (J)':'Residual rotational energy (J)',fmt(r.residualEnergyA),0],
 ]);
 const couple=el('p',zh?`I=mk²=${fmt(r.inertia)} kg·m²。B 的理想空气反作用力偶间距 d=${s.separation} m；每个力的峰值 |τ|/d=${fmt(r.peakCoupleForce)} N。两力大小相等、方向相反，合力为零。喷流反向以制动横滚；所需力不证明空气系统能实现。A 的初始旋转来自未建模的起飞前过程。`:`I=mk²=${fmt(r.inertia)} kg·m². B assumes an opposed air-jet reaction-force couple separated by d=${s.separation} m; each force peaks at |τ|/d=${fmt(r.peakCoupleForce)} N. Equal opposite forces give zero resultant force. Jet direction reverses to brake the roll; the required force is not proof an air system can deliver it. A’s initial spin comes from an unmodeled pre-flight process.`,'fine');
 const contact=table([zh?'独立竖直接触模型':'Separate vertical contact model',zh?'数值':'Value'],[
  [zh?'接地向下速度 (m/s)':'Downward impact speed (m/s)',fmt(r.impactSpeed)],
  [zh?'平均接触力 (kN)':'Average contact force (kN)',fmt(r.averageContactForce/1000)],
  [zh?'峰值接触力 (kN)':'Peak contact force (kN)',fmt(r.peakContactForce/1000)],
  [zh?'净冲量 (N·s)':'Net impulse (N·s)',fmt(r.netLandingImpulse)],
  [zh?'接触冲量 (N·s)':'Contact impulse (N·s)',fmt(r.contactImpulse)],
  [zh?'所需竖直制停行程 (m)':'Required vertical stopping travel (m)',fmt(r.stoppingTravel)],
 ]);
 const note=el('p',zh?'N_avg=mg+mU/D。更长的制停时间降低动态平均力，但需要更大的行程。余弦脉冲的峰值为 mg+2mU/D；相同冲量不决定峰值。图中红色虚线为平均接触力。N 是全体模型的总接触力，不是单个轮胎或乘员载荷。接触起止点使用理想单侧值，可能有力的突变。':'N_avg=mg+mU/D. More stopping time lowers dynamic average force but requires more travel. A cosine pulse peaks at mg+2mU/D; equal impulse does not fix peak force. The red dashed line in the contact-force graph is its average. N is total body contact force, not one tire’s or an occupant’s load. Contact endpoints use ideal one-sided values and may have force jumps.');
 const caveat=el('p',zh?'回正 ≠ 停止旋转 ≠ 安全着陆。B 即使角速度为零，仍有向下速度。A 的接地后旋转未解决；接触模型不模拟横滚耦合、悬架、结构或乘员。这里没有“安全着陆”的判定。':'Upright ≠ stopped spinning ≠ a safe landing. Even B approaches with downward velocity. A’s post-touchdown rotation is unresolved; the contact model omits roll coupling, suspension, structure and occupants. There is no “safe landing” verdict.','physics-caveat');
 const detail=el('details'),summary=el('summary',zh?'公式与物理依据':'Equations and physics references');detail.open=panel.querySelector('details')?.open??false;
 detail.append(summary,el('p','u=t/T; θ_B=2πu−sin(2πu); ω_B=(2π/T)[1−cos(2πu)]; α_B=(4π²/T²)sin(2πu); τ=Iα. U=gT/2; ∫(N−mg)dt=mU.'));
 for(const [label,url]of [[zh?'转动的牛顿第二定律':'Newton’s second law for rotation','https://openstax.org/books/university-physics-volume-1/pages/10-7-newtons-second-law-for-rotation'],[zh?'冲量与碰撞':'Impulse and collisions','https://openstax.org/books/university-physics-volume-1/pages/9-2-impulse-and-collisions']]){const p=el('p'),a=el('a',label);a.href=url;a.target='_blank';a.rel='noreferrer';p.append(a);detail.append(p);}
 panel.replaceChildren(title,rotation,couple,contact,note,caveat,detail);
}
