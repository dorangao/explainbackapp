import {physicsAt,physicsSummary} from './motion.mjs';
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
export function renderPhysicsPanel(container,graph,language,time=0){
 container.hidden=!graph;if(!graph){container.replaceChildren();return;}
 const zh=language==='zh',s=graph.scenario,t=Math.max(0,Math.min(time,s.T)),fmt=n=>Number(n.toFixed(2)).toLocaleString(zh?'zh-CN':'en-US');
 const a=physicsSummary(s,'uniform'),b=physicsSummary(s,s.profileB),pa=physicsAt(s,'uniform',t),pb=physicsAt(s,s.profileB,t);
 container.setAttribute('aria-label',zh?'力与体感对照':'Force and feel comparison');
 const heading=el('h3',zh?'力与体感：这个运动能做到吗？':'Force & feel: could this motion fit?');
 const settings=el('p',zh?`每辆车总质量 ${s.massKg} kg（含乘员）；重量 ${fmt(a.weight/1000)} kN。μ=${s.grip} → 抓地上限 ${fmt(a.tractionForce/1000)} kN；轮端功率上限 ${s.powerKw} kW。`:`Each car: ${s.massKg} kg total mass, including occupants; weight ${fmt(a.weight/1000)} kN. μ=${s.grip} → grip ceiling ${fmt(a.tractionForce/1000)} kN; wheel-power cap ${s.powerKw} kW.`,'fine');
 const table=el('table');table.className='physics-table';
 table.append(el('caption',zh?`t=${fmt(t)} s 的需求，以及整个区间的峰值`:`Demand at t=${fmt(t)} s, and peaks over the whole interval`));
 const thead=el('thead'),head=el('tr');
 for(const label of [zh?'量':'Quantity','A','B']){const th=el('th',label);th.scope='col';head.append(th);}thead.append(head);table.append(thead);
 const body=el('tbody');
 const rows=[
  [zh?'此刻力 (kN)':'Force now (kN)',pa.force/1000,pb.force/1000],
  [zh?'此刻功率 (kW)':'Power now (kW)',pa.powerKw,pb.powerKw],
  [zh?'峰值加速度 (g)':'Peak acceleration (g)',a.peakAccelerationG,b.peakAccelerationG],
  [zh?'峰值力 (kN)':'Peak force (kN)',a.peakForce/1000,b.peakForce/1000],
  [zh?'峰值功率 (kW)':'Peak power (kW)',a.peakPowerKw,b.peakPowerKw],
  [zh?'区间内峰值 |j| (m/s³)':'Peak interior |jerk| (m/s³)',a.peakJerk,b.peakJerk],
  [zh?'同一曲线的理想最短时间 ≈ (s)':'Ideal minimum time for this shape ≈ (s)',a.minimumDuration,b.minimumDuration],
 ];
 for(const [label,x,y]of rows){const tr=el('tr'),th=el('th',label);th.scope='row';tr.append(th,el('td',fmt(x)),el('td',fmt(y)));body.append(tr);}
 const limits=el('tr'),th=el('th',zh?'整个区间的核验':'Whole-interval check');th.scope='row';limits.append(th);
 for(const r of [a,b]){
  const result=r.withinLimits?(zh?'两个理想上限内':'Within both ideal limits'):(zh?`超出${!r.tractionOK?'抓地':''}${!r.tractionOK&&!r.powerOK?' / ':''}${!r.powerOK?'功率':''}`:`Exceeds ${[!r.tractionOK?'grip':null,!r.powerOK?'power':null].filter(Boolean).join(' / ')}`);
  limits.append(el('td',result,r.withinLimits?'limit-within':'limit-exceeded'));
 }body.append(limits);table.append(body);
 const model=el('p',zh?'曲线是预先设定的目标；质量改变时，所需力和功率改变，目标速度曲线不自动改变。F=ma；重量=mg；P=Fv。固定推力下，较重的车加速度更小。理想轮胎上限 a≤μg 中质量抵消。表中最短时间仅使该曲线满足抓地与功率两个上限，不是实车最短加速时间。':'These curves are prescribed targets: changing mass changes demand, not the target motion. F=ma; weight=mg; P=Fv. At fixed force a heavier car accelerates less. Mass cancels from the ideal tire limit a≤μg. The listed minimum time only satisfies the two limits for that shape; it is not a real vehicle’s fastest time.','fine');
 const feel=el('p',zh?`j=da/dt 描述推背感变化的快慢。A 区间内 j=0，但与静止和匀速衔接时加速度突变，理想 j 无界。${b.endpointJumps?'当前 B 也有加速度突变。':'余弦 B 在两端的加速度和 j 都为零，但峰值加速度是 A 的两倍。'}平滑衔接不等于舒适：加速度大小、持续时间、座椅和悬架也重要。`:`Jerk j=da/dt describes how quickly the acceleration you feel changes. A has zero interior jerk, but acceleration jumps when joined to rest and cruise: ideal unbounded jerk. ${b.endpointJumps?'The selected B also has a jump at a join.':'Cosine B has zero acceleration and jerk at both joins, but twice A’s peak acceleration.'} Smooth joins do not guarantee comfort: acceleration magnitude, duration, seating and suspension also matter.`);
 const trig=el('details'),summary=el('summary',zh?'为什么用 sin / cos？':'Why use sin / cos?');
 trig.append(summary,el('p',zh?'不是必须，但适合构造平滑衔接。令 u=t/T，选择 a=(V/T)[1−cos(2πu)]，积分得 v=V[u−sin(2πu)/(2π)]，求导得 j=(2πV/T²)sin(2πu)。起点和终点 a=j=0；中点 a=2V/T。多项式也能构造平滑曲线。':'They are useful, not required. With u=t/T, choose a=(V/T)[1−cos(2πu)]. Integration gives v=V[u−sin(2πu)/(2π)]; differentiation gives j=(2πV/T²)sin(2πu). Both ends have a=j=0; the midpoint has a=2V/T. Polynomial profiles can also make smooth joins.'));
 const caveat=el('p',zh?'必要条件核验，不是可行性或舒适度认证。未模拟阻力、电机扭矩曲线、下压力、悬架或着陆。':'A necessary-condition check, not a feasibility or comfort certification. Drag, motor torque curves, downforce, suspension and landing are omitted.','physics-caveat');
 const sources=el('p',zh?'物理依据：':'Physics references: ','fine');
 for(const [label,url]of [[zh?'牛顿第二定律':'Newton’s second law','https://openstax.org/books/physics/pages/4-3-newtons-second-law-of-motion'],[zh?'摩擦':'Friction','https://openstax.org/books/university-physics-volume-1/pages/6-2-friction'],[zh?'功率':'Power','https://openstax.org/books/university-physics-volume-1/pages/7-4-power'],[zh?'加加速度':'Jerk','https://www.mathworks.com/help/fusion/ug/define-waypointTrajectory-using-position-and-ground-speed.html']]){
  const link=el('a',label);link.href=url;link.target='_blank';link.rel='noreferrer';sources.append(link,document.createTextNode(' · '));
 }
 // Preserve the learner's expanded explanation while scrubbing time.
 const open=container.querySelector('details')?.open??false;trig.open=open;
 container.replaceChildren(heading,settings,table,model,feel,trig,caveat,sources);
}
